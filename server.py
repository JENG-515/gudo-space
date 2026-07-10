#!/usr/bin/env python3
"""
GUDO Space — 官網 + 後台管理伺服器
-------------------------------------------------
資料存取透過 store.py：本機用 data/*.json，設定 SUPABASE_* 後改用 Supabase。
新預約可用 Resend 寄通知。可部署到 Vercel（serverless）或任何能跑 Python 的主機。
"""
import os
import io
import csv
import json
import time
import secrets
from datetime import datetime, timedelta

# ---- 本機開發：載入 .env（Vercel 等平台改用環境變數設定，無此檔）----
def _load_dotenv():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(p):
        return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


_load_dotenv()

import requests  # noqa: E402
from flask import (  # noqa: E402
    Flask, request, session, jsonify, send_from_directory, abort, Response, redirect
)
from werkzeug.security import generate_password_hash as _gph, check_password_hash  # noqa: E402
from werkzeug.utils import secure_filename  # noqa: E402

import store  # noqa: E402

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "web")
ADMIN_DIR = os.path.join(BASE_DIR, "admin")
ASSETS_DIR = store.ASSETS_DIR
DATA_DIR = store.DATA_DIR
SECRET_FILE = os.path.join(DATA_DIR, "secret.key")

CONTENT_SECTIONS = {
    "settings", "copy", "personas", "stats", "spaces",
    "plans", "rentals", "availability", "eventTypes", "events", "faq", "form",
    "sections", "brands", "customBlocks",
}


def generate_password_hash(password):
    return _gph(password, method="pbkdf2:sha256")


def now_iso():
    return store.now_iso()


# ------------------------------------------------------------------ 金鑰
def get_secret_key():
    key = os.environ.get("GUDO_SECRET")
    if key:
        return key
    if os.path.exists(SECRET_FILE):
        return open(SECRET_FILE, "r", encoding="utf-8").read().strip()
    key = secrets.token_hex(32)
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(SECRET_FILE, "w", encoding="utf-8") as f:
            f.write(key)
    except OSError:
        pass
    return key


# ------------------------------------------------------------------ Resend 寄信
def send_email(subject, html, to=None):
    api = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("RESEND_FROM") or "GUDO Space <onboarding@resend.dev>"
    to = to or os.environ.get("NOTIFY_EMAIL")
    if not api or not to:
        return False
    try:
        r = requests.post("https://api.resend.com/emails",
                          headers={"Authorization": "Bearer " + api, "Content-Type": "application/json"},
                          json={"from": sender, "to": [to], "subject": subject, "html": html}, timeout=15)
        return r.ok
    except Exception:
        return False


# ------------------------------------------------------------------ seed
def ensure_seed():
    default_user = os.environ.get("GUDO_ADMIN_USER") or "admin"
    default_pass = os.environ.get("GUDO_ADMIN_PASS") or "gudoadmin2026"
    if store.seed_owner(default_user, "管理員", generate_password_hash(default_pass)):
        print("=" * 60)
        print(" 已建立預設後台帳號（請盡快到「使用者」頁修改密碼）")
        print(f"   帳號：{default_user}")
        print(f"   密碼：{default_pass}")
        print("=" * 60)


# ------------------------------------------------------------------ app
app = Flask(__name__, static_folder=None)
app.secret_key = get_secret_key()
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
    MAX_CONTENT_LENGTH=12 * 1024 * 1024,
)
try:
    ensure_seed()
except Exception as e:
    print("seed 略過：", e)

_login_fails = {}


@app.after_request
def add_no_cache(resp):
    ctype = resp.headers.get("Content-Type", "")
    if any(t in ctype for t in ("text/html", "javascript", "text/css", "application/json")):
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
    return resp


# ------------------------------------------------------------------ auth
def current_user():
    uid = session.get("uid")
    return store.users_find_by_id(uid) if uid else None


def login_required(f):
    from functools import wraps

    @wraps(f)
    def wrap(*a, **kw):
        if not current_user():
            return jsonify(error="需要登入"), 401
        return f(*a, **kw)
    return wrap


def owner_required(f):
    from functools import wraps

    @wraps(f)
    def wrap(*a, **kw):
        u = current_user()
        if not u:
            return jsonify(error="需要登入"), 401
        if u.get("role") != "owner":
            return jsonify(error="僅限擁有者操作"), 403
        return f(*a, **kw)
    return wrap


def public_user(u):
    return {"id": u["id"], "username": u["username"], "name": u.get("name", ""), "role": u.get("role", "editor")}


# ================================================================== 前台頁面
@app.route("/")
def home():
    return send_from_directory(PUBLIC_DIR, "index.html")


@app.route("/robots.txt")
def robots():
    body = "User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: %ssitemap.xml\n" % request.url_root
    return Response(body, mimetype="text/plain")


@app.route("/sitemap.xml")
def sitemap():
    base = request.url_root.rstrip("/")
    content = store.get_content()
    urls = [base + "/", base + "/news", base + "/chronicle"]
    for p in content.get("plans", []):
        if p.get("slug"):
            urls.append(base + "/plan/" + p["slug"])
    try:
        for post in store.coll_public("posts"):
            urls.append(base + "/news/" + post["slug"])
        for ch in store.coll_public("chronicles"):
            urls.append(base + "/chronicle/" + ch["slug"])
    except Exception:
        pass
    xml = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        xml.append("  <url><loc>%s</loc></url>" % u)
    xml.append("</urlset>")
    return Response("\n".join(xml), mimetype="application/xml")


@app.route("/plan/<slug>")
def plan_page(slug):
    return send_from_directory(PUBLIC_DIR, "plan.html")


@app.route("/news")
@app.route("/news/")
def news_page():
    return send_from_directory(PUBLIC_DIR, "news.html")


@app.route("/news/<slug>")
def post_page(slug):
    return send_from_directory(PUBLIC_DIR, "post.html")


@app.route("/chronicle")
@app.route("/chronicle/")
def chronicle_page():
    return send_from_directory(PUBLIC_DIR, "chronicle.html")


@app.route("/chronicle/<slug>")
def story_page(slug):
    return send_from_directory(PUBLIC_DIR, "story.html")


# 圖片：本機有檔就直接給；沒有且使用 Supabase 就轉址到 Storage 公開網址
@app.route("/assets/<path:name>")
def assets(name):
    local = os.path.join(ASSETS_DIR, name)
    if os.path.isfile(local):
        return send_from_directory(ASSETS_DIR, name)
    if store.USE_SUPABASE and not name.startswith("."):
        return redirect(store.media_public_url(name))
    abort(404)


@app.route("/<path:filename>")
def public_files(filename):
    full = os.path.join(PUBLIC_DIR, filename)
    if os.path.isfile(full):
        return send_from_directory(PUBLIC_DIR, filename)
    abort(404)


@app.route("/admin")
@app.route("/admin/")
def admin_home():
    if not current_user():
        return redirect("/admin/login")
    return send_from_directory(ADMIN_DIR, "index.html")


@app.route("/admin/login")
def admin_login_page():
    if current_user():
        return redirect("/admin")
    return send_from_directory(ADMIN_DIR, "login.html")


@app.route("/admin/<path:filename>")
def admin_files(filename):
    full = os.path.join(ADMIN_DIR, filename)
    if os.path.isfile(full):
        return send_from_directory(ADMIN_DIR, filename)
    abort(404)


# ================================================================== 公開 API
@app.get("/api/content")
def api_get_content():
    return jsonify(store.get_content())


@app.post("/api/submissions")
def api_create_submission():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "?").split(",")[0].strip()
    data = request.get_json(silent=True) or {}
    if data.get("_hp"):
        return jsonify(ok=True), 200
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    if not name or not phone:
        return jsonify(error="請填寫姓名與手機"), 400
    if len(json.dumps(data, ensure_ascii=False)) > 6000:
        return jsonify(error="內容過長"), 400

    entry = store.subs_create({
        "status": "new", "ip": ip, "name": name, "phone": phone,
        "email": (data.get("email") or "").strip(), "line": (data.get("line") or "").strip(),
        "interest": data.get("interest") or [], "timeline": data.get("timeline") or [],
        "identity": data.get("identity") or [], "visit": data.get("visit") or [],
        "slot": (data.get("slot") or "").strip(), "note": (data.get("note") or "").strip(),
    })

    # Resend 通知（best-effort，不影響送出）
    def esc(s):
        return str(s or "").replace("<", "&lt;").replace(">", "&gt;")
    rows = "".join(
        f"<tr><td style='padding:4px 10px;color:#5c574d'>{k}</td><td style='padding:4px 10px'><b>{esc(v)}</b></td></tr>"
        for k, v in [
            ("姓名", name), ("手機", phone), ("Email", entry.get("email")), ("Line", entry.get("line")),
            ("想了解方案", "、".join(entry.get("interest") or [])),
            ("預計使用時間", "、".join(entry.get("timeline") or [])),
            ("身分", "、".join(entry.get("identity") or [])),
            ("是否參觀", "、".join(entry.get("visit") or [])),
            ("希望時段", entry.get("slot")), ("備註", entry.get("note")),
        ] if v)
    send_email("【GUDO Space】新預約參觀：" + name,
               f"<h2>有新的預約參觀</h2><table style='border-collapse:collapse;font-family:sans-serif'>{rows}</table>"
               f"<p style='color:#888'>到後台查看：/admin</p>")
    return jsonify(ok=True, id=entry["id"]), 201


# ================================================================== 認證
@app.post("/api/login")
def api_login():
    ip = request.remote_addr or "?"
    fails = _login_fails.get(ip, {"n": 0, "until": 0})
    if fails["until"] > time.time():
        return jsonify(error="嘗試過於頻繁，請稍後再試"), 429
    data = request.get_json(silent=True) or {}
    u = store.users_find((data.get("username") or "").strip())
    password = (data.get("password") or "").strip()
    if not u or not check_password_hash(u["passwordHash"], password):
        fails["n"] += 1
        if fails["n"] >= 5:
            fails["until"] = time.time() + 60
            fails["n"] = 0
        _login_fails[ip] = fails
        time.sleep(0.4)
        return jsonify(error="帳號或密碼錯誤"), 401
    _login_fails.pop(ip, None)
    session.clear()
    session["uid"] = u["id"]
    session.permanent = True
    return jsonify(user=public_user(u))


@app.post("/api/logout")
def api_logout():
    session.clear()
    return jsonify(ok=True)


@app.get("/api/me")
def api_me():
    u = current_user()
    return jsonify(user=public_user(u) if u else None)


# ================================================================== 內容管理
@app.put("/api/content")
@login_required
def api_put_content():
    body = request.get_json(silent=True) or {}
    content = store.merge_content_sections(body, CONTENT_SECTIONS)
    return jsonify(ok=True, content=content)


# ================================================================== 最新消息 / 活動紀實
def _register_collection(name):
    def public_list():
        return jsonify(store.coll_public(name))

    def public_get(key):
        item = store.coll_find(name, key)
        if not item or (not item.get("published", True) and not current_user()):
            return jsonify(error="找不到內容"), 404
        return jsonify(item)

    @login_required
    def admin_list():
        return jsonify(store.coll_all(name))

    @login_required
    def create():
        return jsonify(store.coll_create(name, request.get_json(silent=True) or {})), 201

    @login_required
    def update(pid):
        hit = store.coll_update(name, pid, request.get_json(silent=True) or {})
        return (jsonify(hit) if hit else (jsonify(error="找不到內容"), 404))

    @login_required
    def delete(pid):
        return (jsonify(ok=True) if store.coll_delete(name, pid) else (jsonify(error="找不到內容"), 404))

    app.add_url_rule(f"/api/{name}", f"{name}_public_list", public_list, methods=["GET"])
    app.add_url_rule(f"/api/{name}/<key>", f"{name}_public_get", public_get, methods=["GET"])
    app.add_url_rule(f"/api/admin/{name}", f"{name}_admin_list", admin_list, methods=["GET"])
    app.add_url_rule(f"/api/{name}", f"{name}_create", create, methods=["POST"])
    app.add_url_rule(f"/api/{name}/<pid>", f"{name}_update", update, methods=["PUT"])
    app.add_url_rule(f"/api/{name}/<pid>", f"{name}_delete", delete, methods=["DELETE"])


_register_collection("posts")
_register_collection("chronicles")


# ================================================================== 收單管理
@app.get("/api/submissions")
@login_required
def api_list_submissions():
    return jsonify(store.subs_list())


@app.patch("/api/submissions/<sid>")
@login_required
def api_update_submission(sid):
    body = request.get_json(silent=True) or {}
    if body.get("status") not in ("new", "contacted", "done"):
        return jsonify(error="狀態無效"), 400
    return (jsonify(ok=True) if store.subs_update_status(sid, body["status"]) else (jsonify(error="找不到資料"), 404))


@app.delete("/api/submissions/<sid>")
@login_required
def api_delete_submission(sid):
    return (jsonify(ok=True) if store.subs_delete(sid) else (jsonify(error="找不到資料"), 404))


@app.get("/api/submissions.csv")
@login_required
def api_export_csv():
    subs = store.subs_list()
    out = io.StringIO()
    out.write("﻿")
    w = csv.writer(out)
    w.writerow(["時間", "狀態", "姓名", "手機", "Email", "Line ID",
                "想了解的方案", "預計使用時間", "身分類型", "是否想預約參觀", "希望參觀時段", "備註"])
    label = {"new": "未處理", "contacted": "已聯繫", "done": "已完成"}
    for s in subs:
        w.writerow([
            s.get("createdAt", ""), label.get(s.get("status"), s.get("status", "")),
            s.get("name", ""), s.get("phone", ""), s.get("email", ""), s.get("line", ""),
            "、".join(s.get("interest", [])), "、".join(s.get("timeline", [])),
            "、".join(s.get("identity", [])), "、".join(s.get("visit", [])),
            s.get("slot", ""), s.get("note", ""),
        ])
    fname = "gudo-submissions-%s.csv" % datetime.now().strftime("%Y%m%d")
    return Response(out.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={fname}"})


# ================================================================== 圖片上傳 / 媒體庫
@app.post("/api/upload")
@login_required
def api_upload():
    if "file" not in request.files:
        return jsonify(error="沒有檔案"), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify(error="沒有檔案"), 400
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in store.IMG_EXT:
        return jsonify(error="僅支援 jpg / png / webp / gif"), 400
    target = request.form.get("as")
    name = secure_filename(target) if target else secure_filename(f.filename)
    if not name:
        return jsonify(error="檔名無效"), 400
    store.media_save(name, f.read(), f.mimetype)
    return jsonify(ok=True, path=f"assets/{name}")


@app.get("/api/media")
@login_required
def api_media_list():
    return jsonify(store.media_list())


@app.delete("/api/media/<name>")
@login_required
def api_media_delete(name):
    name = secure_filename(name)
    if not name or name == "logo.svg":
        return jsonify(error="不可刪除"), 400
    return (jsonify(ok=True) if store.media_delete(name) else (jsonify(error="找不到檔案"), 404))


# ================================================================== 使用者管理
@app.get("/api/users")
@login_required
def api_list_users():
    return jsonify([public_user(u) for u in store.users_list()])


@app.post("/api/users")
@owner_required
def api_create_user():
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""
    name = (body.get("name") or "").strip() or username
    role = body.get("role") if body.get("role") in ("owner", "editor") else "editor"
    if not username or len(password) < 6:
        return jsonify(error="請填帳號，密碼至少 6 碼"), 400
    if store.users_find(username):
        return jsonify(error="帳號已存在"), 409
    user = store.users_create({"username": username, "name": name, "role": role,
                               "passwordHash": generate_password_hash(password)})
    return jsonify(user=public_user(user)), 201


@app.post("/api/users/<uid>/password")
@login_required
def api_change_password(uid):
    me = current_user()
    if me["role"] != "owner" and me["id"] != uid:
        return jsonify(error="沒有權限"), 403
    body = request.get_json(silent=True) or {}
    new_pass = body.get("password") or ""
    if len(new_pass) < 6:
        return jsonify(error="密碼至少 6 碼"), 400
    return (jsonify(ok=True) if store.users_set_password(uid, generate_password_hash(new_pass))
            else (jsonify(error="找不到使用者"), 404))


@app.delete("/api/users/<uid>")
@owner_required
def api_delete_user(uid):
    me = current_user()
    if me["id"] == uid:
        return jsonify(error="不能刪除自己"), 400
    users = store.users_list()
    target = next((u for u in users if u["id"] == uid), None)
    if not target:
        return jsonify(error="找不到使用者"), 404
    if target["role"] == "owner" and not [u for u in users if u["role"] == "owner" and u["id"] != uid]:
        return jsonify(error="必須至少保留一位擁有者"), 400
    store.users_delete(uid)
    return jsonify(ok=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4000"))
    mode = "Supabase" if store.USE_SUPABASE else "本機 JSON"
    print(f"GUDO Space 伺服器啟動（{mode} 模式）： http://localhost:{port}  （後台 /admin）")
    app.run(host="0.0.0.0", port=port, debug=False)
