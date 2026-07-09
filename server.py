#!/usr/bin/env python3
"""
GUDO Space — 官網 + 後台管理伺服器
-------------------------------------------------
單一 Flask 應用，同時提供：
  • 前台官網（public/）           → GET /
  • 公開 API                      → GET /api/content, POST /api/submissions
  • 後台管理介面（admin/）        → GET /admin
  • 後台 API（需登入）            → 內容、活動、名額、FAQ、收單、使用者管理

資料以 JSON 檔儲存在 data/，不需資料庫。
密碼以 werkzeug scrypt/pbkdf2 雜湊儲存，登入採 session cookie（SameSite=Lax）。
"""

import os
import io
import csv
import json
import time
import threading
import secrets
from datetime import datetime, timezone, timedelta
from functools import wraps

from flask import (
    Flask, request, session, jsonify, send_from_directory, abort, Response, redirect
)
from werkzeug.security import generate_password_hash as _gph, check_password_hash
from werkzeug.utils import secure_filename


def generate_password_hash(password):
    # 指定 pbkdf2：部分 Python 版本的 hashlib 未編入 scrypt
    return _gph(password, method="pbkdf2:sha256")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
ADMIN_DIR = os.path.join(BASE_DIR, "admin")
ASSETS_DIR = os.path.join(PUBLIC_DIR, "assets")

CONTENT_FILE = os.path.join(DATA_DIR, "content.json")
SUBMISSIONS_FILE = os.path.join(DATA_DIR, "submissions.json")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
POSTS_FILE = os.path.join(DATA_DIR, "posts.json")
CHRONICLES_FILE = os.path.join(DATA_DIR, "chronicles.json")
SECRET_FILE = os.path.join(DATA_DIR, "secret.key")

_lock = threading.Lock()

# ------------------------------------------------------------------ utils
def _read_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path, data):
    """原子寫入：先寫暫存檔再取代，避免中途損毀。"""
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def slugify(text, fallback):
    import re
    s = re.sub(r"[^a-z0-9一-鿿]+", "-", (text or "").strip().lower()).strip("-")
    return s or fallback


def get_secret_key():
    key = os.environ.get("GUDO_SECRET")
    if key:
        return key
    if os.path.exists(SECRET_FILE):
        return open(SECRET_FILE, "r", encoding="utf-8").read().strip()
    key = secrets.token_hex(32)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(SECRET_FILE, "w", encoding="utf-8") as f:
        f.write(key)
    return key


# ------------------------------------------------------------------ seed
def ensure_seed():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(SUBMISSIONS_FILE):
        _write_json(SUBMISSIONS_FILE, [])
    if not os.path.exists(POSTS_FILE):
        _write_json(POSTS_FILE, [])
    if not os.path.exists(CHRONICLES_FILE):
        _write_json(CHRONICLES_FILE, [])
    if not os.path.exists(USERS_FILE):
        default_user = os.environ.get("GUDO_ADMIN_USER", "admin")
        default_pass = os.environ.get("GUDO_ADMIN_PASS", "gudospace2026")
        _write_json(USERS_FILE, [{
            "id": secrets.token_hex(8),
            "username": default_user,
            "name": "管理員",
            "role": "owner",
            "passwordHash": generate_password_hash(default_pass),
            "createdAt": now_iso(),
        }])
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
    MAX_CONTENT_LENGTH=8 * 1024 * 1024,  # 8MB 上傳上限
)
ensure_seed()


@app.after_request
def add_no_cache(resp):
    # 前台/後台的 HTML、JS、CSS 與 API 一律不快取，避免瀏覽器用到舊檔造成登入畫面與功能不同步
    ctype = resp.headers.get("Content-Type", "")
    if any(t in ctype for t in ("text/html", "javascript", "text/css", "application/json")):
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
    return resp


# 簡易登入失敗節流（每 IP）
_login_fails = {}


# ------------------------------------------------------------------ auth helpers
def find_user(username):
    for u in _read_json(USERS_FILE, []):
        if u["username"].lower() == username.lower():
            return u
    return None


def find_user_by_id(uid):
    for u in _read_json(USERS_FILE, []):
        if u["id"] == uid:
            return u
    return None


def current_user():
    uid = session.get("uid")
    return find_user_by_id(uid) if uid else None


def login_required(f):
    @wraps(f)
    def wrap(*a, **kw):
        if not current_user():
            return jsonify(error="需要登入"), 401
        return f(*a, **kw)
    return wrap


def owner_required(f):
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


# ---- 多頁漂亮網址（前台） ----
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


@app.route("/<path:filename>")
def public_files(filename):
    # 僅服務 public/ 內的檔案；data/ 不在此範圍，不會外洩
    full = os.path.join(PUBLIC_DIR, filename)
    if os.path.isfile(full):
        return send_from_directory(PUBLIC_DIR, filename)
    abort(404)


# ---- 後台：登入頁與後台分離 ----
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
    """前台讀取全部內容。"""
    return jsonify(_read_json(CONTENT_FILE, {}))


@app.post("/api/submissions")
def api_create_submission():
    """前台預約表單送出。公開端點，含基本驗證與節流。"""
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "?").split(",")[0].strip()
    data = request.get_json(silent=True) or {}

    # 蜜罐：若填了隱藏欄位視為機器人
    if data.get("_hp"):
        return jsonify(ok=True), 200

    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    if not name or not phone:
        return jsonify(error="請填寫姓名與手機"), 400
    if len(json.dumps(data, ensure_ascii=False)) > 5000:
        return jsonify(error="內容過長"), 400

    entry = {
        "id": secrets.token_hex(8),
        "createdAt": now_iso(),
        "status": "new",              # new / contacted / done
        "ip": ip,
        "name": name,
        "phone": phone,
        "email": (data.get("email") or "").strip(),
        "line": (data.get("line") or "").strip(),
        "interest": data.get("interest") or [],
        "timeline": data.get("timeline") or [],
        "identity": data.get("identity") or [],
        "visit": data.get("visit") or [],
        "slot": (data.get("slot") or "").strip(),
        "note": (data.get("note") or "").strip(),
    }
    with _lock:
        subs = _read_json(SUBMISSIONS_FILE, [])
        subs.insert(0, entry)
        _write_json(SUBMISSIONS_FILE, subs)
    return jsonify(ok=True, id=entry["id"]), 201


# ================================================================== 認證 API
@app.post("/api/login")
def api_login():
    ip = request.remote_addr or "?"
    fails = _login_fails.get(ip, {"n": 0, "until": 0})
    if fails["until"] > time.time():
        return jsonify(error="嘗試過於頻繁，請稍後再試"), 429

    data = request.get_json(silent=True) or {}
    u = find_user((data.get("username") or "").strip())
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


# ================================================================== 內容管理 API（需登入）
# 允許整份或分區塊更新內容
CONTENT_SECTIONS = {
    "settings", "copy", "personas", "stats", "spaces",
    "plans", "rentals", "availability", "eventTypes", "events", "faq", "form",
    "sections", "brands", "customBlocks",
}


@app.put("/api/content")
@login_required
def api_put_content():
    body = request.get_json(silent=True) or {}
    with _lock:
        content = _read_json(CONTENT_FILE, {})
        # 只接受已知區塊，避免寫入任意鍵
        for k, v in body.items():
            if k in CONTENT_SECTIONS:
                content[k] = v
        _write_json(CONTENT_FILE, content)
    return jsonify(ok=True, content=content)


# ================================================================== 最新消息 / 活動紀實
POST_FIELDS = ["slug", "title", "date", "category", "cover", "excerpt", "body", "published"]
CHRON_FIELDS = ["slug", "title", "date", "location", "cover", "gallery", "excerpt", "body", "published"]


def _coll_public(path):
    items = [x for x in _read_json(path, []) if x.get("published", True)]
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    return items


def _coll_find(path, key):
    for x in _read_json(path, []):
        if x.get("slug") == key or x.get("id") == key:
            return x
    return None


def _coll_create(path, data, fields):
    item = {"id": secrets.token_hex(8), "createdAt": now_iso()}
    for f in fields:
        if f in data:
            item[f] = data[f]
    item["title"] = (item.get("title") or "").strip() or "未命名"
    item["slug"] = slugify(item.get("slug") or item.get("title"), item["id"])
    item.setdefault("date", now_iso()[:10])
    item.setdefault("published", True)
    with _lock:
        items = _read_json(path, [])
        # slug 若重複，加上短碼避免撞頁
        if any(x.get("slug") == item["slug"] for x in items):
            item["slug"] = item["slug"] + "-" + item["id"][:4]
        items.insert(0, item)
        _write_json(path, items)
    return item


def _coll_update(path, pid, data, fields):
    with _lock:
        items = _read_json(path, [])
        hit = next((x for x in items if x["id"] == pid), None)
        if not hit:
            return None
        for f in fields:
            if f in data:
                hit[f] = data[f]
        if "title" in data:
            hit["title"] = (hit.get("title") or "").strip() or "未命名"
        if data.get("slug"):
            hit["slug"] = slugify(data["slug"], hit["id"])
        _write_json(path, items)
        return hit


def _coll_delete(path, pid):
    with _lock:
        items = _read_json(path, [])
        rest = [x for x in items if x["id"] != pid]
        if len(rest) == len(items):
            return False
        _write_json(path, rest)
        return True


def _register_collection(name, path, fields):
    """為 posts / chronicles 註冊一組 CRUD 路由。"""

    def public_list():
        return jsonify(_coll_public(path))

    def public_get(key):
        item = _coll_find(path, key)
        if not item or (not item.get("published", True) and not current_user()):
            return jsonify(error="找不到內容"), 404
        return jsonify(item)

    @login_required
    def admin_list():
        items = _read_json(path, [])
        items.sort(key=lambda x: x.get("date", ""), reverse=True)
        return jsonify(items)

    @login_required
    def create():
        return jsonify(_coll_create(path, request.get_json(silent=True) or {}, fields)), 201

    @login_required
    def update(pid):
        hit = _coll_update(path, pid, request.get_json(silent=True) or {}, fields)
        return (jsonify(hit) if hit else (jsonify(error="找不到內容"), 404))

    @login_required
    def delete(pid):
        return (jsonify(ok=True) if _coll_delete(path, pid) else (jsonify(error="找不到內容"), 404))

    app.add_url_rule(f"/api/{name}", f"{name}_public_list", public_list, methods=["GET"])
    app.add_url_rule(f"/api/{name}/<key>", f"{name}_public_get", public_get, methods=["GET"])
    app.add_url_rule(f"/api/admin/{name}", f"{name}_admin_list", admin_list, methods=["GET"])
    app.add_url_rule(f"/api/{name}", f"{name}_create", create, methods=["POST"])
    app.add_url_rule(f"/api/{name}/<pid>", f"{name}_update", update, methods=["PUT"])
    app.add_url_rule(f"/api/{name}/<pid>", f"{name}_delete", delete, methods=["DELETE"])


_register_collection("posts", POSTS_FILE, POST_FIELDS)
_register_collection("chronicles", CHRONICLES_FILE, CHRON_FIELDS)


# ================================================================== 收單管理 API（需登入）
@app.get("/api/submissions")
@login_required
def api_list_submissions():
    return jsonify(_read_json(SUBMISSIONS_FILE, []))


@app.patch("/api/submissions/<sid>")
@login_required
def api_update_submission(sid):
    body = request.get_json(silent=True) or {}
    new_status = body.get("status")
    if new_status not in ("new", "contacted", "done"):
        return jsonify(error="狀態無效"), 400
    with _lock:
        subs = _read_json(SUBMISSIONS_FILE, [])
        hit = next((s for s in subs if s["id"] == sid), None)
        if not hit:
            return jsonify(error="找不到資料"), 404
        hit["status"] = new_status
        _write_json(SUBMISSIONS_FILE, subs)
    return jsonify(ok=True)


@app.delete("/api/submissions/<sid>")
@login_required
def api_delete_submission(sid):
    with _lock:
        subs = _read_json(SUBMISSIONS_FILE, [])
        subs2 = [s for s in subs if s["id"] != sid]
        if len(subs2) == len(subs):
            return jsonify(error="找不到資料"), 404
        _write_json(SUBMISSIONS_FILE, subs2)
    return jsonify(ok=True)


@app.get("/api/submissions.csv")
@login_required
def api_export_csv():
    subs = _read_json(SUBMISSIONS_FILE, [])
    out = io.StringIO()
    out.write("﻿")  # BOM，讓 Excel 正確顯示中文
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


# ================================================================== 圖片上傳 API（需登入）
@app.post("/api/upload")
@login_required
def api_upload():
    if "file" not in request.files:
        return jsonify(error="沒有檔案"), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify(error="沒有檔案"), 400
    ext = os.path.splitext(f.filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        return jsonify(error="僅支援 jpg / png / webp / gif"), 400
    # 允許以指定名稱覆蓋（例如 hero.jpg），否則用安全檔名
    target = request.form.get("as")
    name = secure_filename(target) if target else secure_filename(f.filename)
    if not name:
        return jsonify(error="檔名無效"), 400
    os.makedirs(ASSETS_DIR, exist_ok=True)
    f.save(os.path.join(ASSETS_DIR, name))
    return jsonify(ok=True, path=f"assets/{name}")


# ================================================================== 媒體庫（圖庫）
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".gif")


@app.get("/api/media")
@login_required
def api_media_list():
    items = []
    for fn in os.listdir(ASSETS_DIR):
        if fn.startswith(".") or fn == "logo.svg":
            continue
        if fn.lower().endswith(IMG_EXT):
            p = os.path.join(ASSETS_DIR, fn)
            items.append({"name": fn, "url": f"/assets/{fn}", "size": os.path.getsize(p), "mtime": os.path.getmtime(p)})
    items.sort(key=lambda x: x["name"])
    return jsonify(items)


@app.delete("/api/media/<name>")
@login_required
def api_media_delete(name):
    name = secure_filename(name)
    if not name or name == "logo.svg":
        return jsonify(error="不可刪除"), 400
    p = os.path.join(ASSETS_DIR, name)
    if not os.path.isfile(p):
        return jsonify(error="找不到檔案"), 404
    os.remove(p)
    return jsonify(ok=True)


# ================================================================== 使用者管理 API（僅擁有者）
@app.get("/api/users")
@login_required
def api_list_users():
    return jsonify([public_user(u) for u in _read_json(USERS_FILE, [])])


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
    with _lock:
        users = _read_json(USERS_FILE, [])
        if any(u["username"].lower() == username.lower() for u in users):
            return jsonify(error="帳號已存在"), 409
        user = {
            "id": secrets.token_hex(8), "username": username, "name": name, "role": role,
            "passwordHash": generate_password_hash(password), "createdAt": now_iso(),
        }
        users.append(user)
        _write_json(USERS_FILE, users)
    return jsonify(user=public_user(user)), 201


@app.post("/api/users/<uid>/password")
@login_required
def api_change_password(uid):
    """擁有者可改任何人；一般使用者只能改自己。"""
    me = current_user()
    if me["role"] != "owner" and me["id"] != uid:
        return jsonify(error="沒有權限"), 403
    body = request.get_json(silent=True) or {}
    new_pass = body.get("password") or ""
    if len(new_pass) < 6:
        return jsonify(error="密碼至少 6 碼"), 400
    with _lock:
        users = _read_json(USERS_FILE, [])
        hit = next((u for u in users if u["id"] == uid), None)
        if not hit:
            return jsonify(error="找不到使用者"), 404
        hit["passwordHash"] = generate_password_hash(new_pass)
        _write_json(USERS_FILE, users)
    return jsonify(ok=True)


@app.delete("/api/users/<uid>")
@owner_required
def api_delete_user(uid):
    me = current_user()
    if me["id"] == uid:
        return jsonify(error="不能刪除自己"), 400
    with _lock:
        users = _read_json(USERS_FILE, [])
        if not any(u["id"] == uid for u in users):
            return jsonify(error="找不到使用者"), 404
        # 至少保留一位擁有者
        remaining_owners = [u for u in users if u["role"] == "owner" and u["id"] != uid]
        target = next(u for u in users if u["id"] == uid)
        if target["role"] == "owner" and not remaining_owners:
            return jsonify(error="必須至少保留一位擁有者"), 400
        users = [u for u in users if u["id"] != uid]
        _write_json(USERS_FILE, users)
    return jsonify(ok=True)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "4000"))
    print(f"GUDO Space 伺服器啟動： http://localhost:{port}  （後台： /admin ）")
    app.run(host="0.0.0.0", port=port, debug=False)
