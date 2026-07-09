"""
store.py — GUDO Space 資料存取層
------------------------------------------------------------------
本機開發：沒有設定 SUPABASE_* 時，沿用原本的 data/*.json 檔（不變）。
正式部署：設了 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 就改用 Supabase：
  - 內容：app_content（單列 jsonb）
  - posts / chronicles / submissions / app_users：關聯表
  - 圖片：Supabase Storage 的 media bucket
server.py 只呼叫本模組的函式，不直接碰檔案或資料庫。
"""
import os
import json
import threading
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    requests = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("GUDO_DATA_DIR", os.path.join(BASE_DIR, "data"))
ASSETS_DIR = os.path.join(BASE_DIR, "web", "assets")

SUPA_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
SUPA_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
BUCKET = os.environ.get("SUPABASE_MEDIA_BUCKET", "media")
USE_SUPABASE = bool(SUPA_URL and SUPA_KEY and requests)

_lock = threading.RLock()  # 可重入，避免 merge→save 巢狀取鎖死結

CONTENT_FILE = os.path.join(DATA_DIR, "content.json")
SUBMISSIONS_FILE = os.path.join(DATA_DIR, "submissions.json")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
POSTS_FILE = os.path.join(DATA_DIR, "posts.json")
CHRONICLES_FILE = os.path.join(DATA_DIR, "chronicles.json")
_FILES = {"posts": POSTS_FILE, "chronicles": CHRONICLES_FILE}


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


# ================================================================ JSON 檔工具
def _read_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


# ================================================================ Supabase REST
def _sb_headers(extra=None):
    h = {"apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY, "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def _sb(method, path, params=None, json_body=None, prefer=None):
    url = SUPA_URL + "/rest/v1/" + path
    headers = _sb_headers({"Prefer": prefer} if prefer else None)
    r = requests.request(method, url, headers=headers, params=params, json=json_body, timeout=20)
    if not r.ok:
        raise RuntimeError("Supabase %s %s -> %s %s" % (method, path, r.status_code, r.text[:300]))
    return r.json() if r.text else None


def _norm(entity, row):
    """把資料庫欄位轉回應用習慣用的鍵。"""
    if not isinstance(row, dict):
        return row
    if "created_at" in row and "createdAt" not in row:
        row["createdAt"] = row["created_at"]
    if entity == "users" and "password_hash" in row:
        row["passwordHash"] = row.pop("password_hash")
    return row


# ================================================================ 內容 content
def get_content():
    if USE_SUPABASE:
        rows = _sb("GET", "app_content", params={"id": "eq.1", "select": "data"})
        return (rows[0]["data"] if rows else {}) or {}
    return _read_json(CONTENT_FILE, {})


def save_content(data):
    if USE_SUPABASE:
        with _lock:
            _sb("PATCH", "app_content", params={"id": "eq.1"},
                json_body={"data": data, "updated_at": now_iso()})
        return
    _write_json(CONTENT_FILE, data)


def merge_content_sections(sections_dict, allowed):
    """把若干區塊合併進內容並存回（對應 PUT /api/content）。"""
    with _lock:
        content = get_content()
        for k, v in sections_dict.items():
            if k in allowed:
                content[k] = v
        save_content(content)
        return content


# ================================================================ posts / chronicles
_COLL_FIELDS = {
    "posts": ["slug", "title", "date", "category", "cover", "excerpt", "body", "published"],
    "chronicles": ["slug", "title", "date", "location", "cover", "gallery", "excerpt", "body", "published"],
}


def coll_public(table):
    if USE_SUPABASE:
        rows = _sb("GET", table, params={"published": "eq.true", "order": "date.desc", "select": "*"})
        return [_norm(table, r) for r in rows]
    items = [x for x in _read_json(_FILES[table], []) if x.get("published", True)]
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    return items


def coll_all(table):
    if USE_SUPABASE:
        rows = _sb("GET", table, params={"order": "date.desc", "select": "*"})
        return [_norm(table, r) for r in rows]
    items = _read_json(_FILES[table], [])
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    return items


def _is_uuid(s):
    import re
    return bool(re.match(r"^[0-9a-fA-F-]{32,36}$", s or ""))


def coll_find(table, key):
    if USE_SUPABASE:
        rows = _sb("GET", table, params={"slug": "eq." + key, "select": "*"})
        if not rows and _is_uuid(key):
            rows = _sb("GET", table, params={"id": "eq." + key, "select": "*"})
        return _norm(table, rows[0]) if rows else None
    for x in _read_json(_FILES[table], []):
        if x.get("slug") == key or x.get("id") == key:
            return x
    return None


def _slugify(text, fallback):
    import re
    s = re.sub(r"[^a-z0-9一-鿿]+", "-", (text or "").strip().lower()).strip("-")
    return s or fallback


def coll_create(table, data):
    fields = _COLL_FIELDS[table]
    obj = {f: data[f] for f in fields if f in data}
    obj["title"] = (obj.get("title") or "").strip() or "未命名"
    obj["slug"] = _slugify(obj.get("slug") or obj.get("title"), "item")
    obj.setdefault("date", now_iso()[:10])
    obj.setdefault("published", True)
    if USE_SUPABASE:
        with _lock:
            exists = _sb("GET", table, params={"slug": "eq." + obj["slug"], "select": "id"})
            if exists:
                obj["slug"] = obj["slug"] + "-" + now_iso()[11:19].replace(":", "")
            rows = _sb("POST", table, json_body=obj, prefer="return=representation")
            return _norm(table, rows[0])
    # JSON
    import secrets
    obj["id"] = secrets.token_hex(8)
    obj["createdAt"] = now_iso()
    with _lock:
        items = _read_json(_FILES[table], [])
        if any(x.get("slug") == obj["slug"] for x in items):
            obj["slug"] += "-" + obj["id"][:4]
        items.insert(0, obj)
        _write_json(_FILES[table], items)
    return obj


def coll_update(table, item_id, data):
    fields = _COLL_FIELDS[table]
    patch = {f: data[f] for f in fields if f in data}
    if "title" in patch:
        patch["title"] = (patch.get("title") or "").strip() or "未命名"
    if patch.get("slug"):
        patch["slug"] = _slugify(patch["slug"], item_id)
    if USE_SUPABASE:
        with _lock:
            rows = _sb("PATCH", table, params={"id": "eq." + item_id}, json_body=patch, prefer="return=representation")
            return _norm(table, rows[0]) if rows else None
    with _lock:
        items = _read_json(_FILES[table], [])
        hit = next((x for x in items if x["id"] == item_id), None)
        if not hit:
            return None
        hit.update(patch)
        _write_json(_FILES[table], items)
        return hit


def coll_delete(table, item_id):
    if USE_SUPABASE:
        with _lock:
            _sb("DELETE", table, params={"id": "eq." + item_id})
        return True
    with _lock:
        items = _read_json(_FILES[table], [])
        rest = [x for x in items if x["id"] != item_id]
        if len(rest) == len(items):
            return False
        _write_json(_FILES[table], rest)
        return True


# ================================================================ 收單 submissions
_SUB_FIELDS = ["status", "name", "phone", "email", "line", "interest", "timeline",
               "identity", "visit", "slot", "note", "ip"]


def subs_list():
    if USE_SUPABASE:
        rows = _sb("GET", "submissions", params={"order": "created_at.desc", "select": "*"})
        return [_norm("submissions", r) for r in rows]
    return _read_json(SUBMISSIONS_FILE, [])


def subs_create(data):
    obj = {f: data.get(f) for f in _SUB_FIELDS if data.get(f) is not None}
    obj.setdefault("status", "new")
    if USE_SUPABASE:
        rows = _sb("POST", "submissions", json_body=obj, prefer="return=representation")
        return _norm("submissions", rows[0])
    import secrets
    obj = dict(obj)
    obj["id"] = secrets.token_hex(8)
    obj["createdAt"] = now_iso()
    with _lock:
        subs = _read_json(SUBMISSIONS_FILE, [])
        subs.insert(0, obj)
        _write_json(SUBMISSIONS_FILE, subs)
    return obj


def subs_update_status(sid, status):
    if USE_SUPABASE:
        rows = _sb("PATCH", "submissions", params={"id": "eq." + sid},
                   json_body={"status": status}, prefer="return=representation")
        return bool(rows)
    with _lock:
        subs = _read_json(SUBMISSIONS_FILE, [])
        hit = next((s for s in subs if s["id"] == sid), None)
        if not hit:
            return False
        hit["status"] = status
        _write_json(SUBMISSIONS_FILE, subs)
        return True


def subs_delete(sid):
    if USE_SUPABASE:
        _sb("DELETE", "submissions", params={"id": "eq." + sid})
        return True
    with _lock:
        subs = _read_json(SUBMISSIONS_FILE, [])
        rest = [s for s in subs if s["id"] != sid]
        if len(rest) == len(subs):
            return False
        _write_json(SUBMISSIONS_FILE, rest)
        return True


# ================================================================ 帳號 users
def users_list():
    if USE_SUPABASE:
        rows = _sb("GET", "app_users", params={"order": "created_at.asc", "select": "*"})
        return [_norm("users", r) for r in rows]
    return _read_json(USERS_FILE, [])


def users_find(username):
    for u in users_list():
        if u["username"].lower() == (username or "").lower():
            return u
    return None


def users_find_by_id(uid):
    for u in users_list():
        if u["id"] == uid:
            return u
    return None


def users_create(obj):
    row = {"username": obj["username"], "name": obj.get("name", ""),
           "role": obj.get("role", "editor"), "password_hash": obj["passwordHash"]}
    if USE_SUPABASE:
        rows = _sb("POST", "app_users", json_body=row, prefer="return=representation")
        return _norm("users", rows[0])
    obj = dict(obj)
    obj["createdAt"] = now_iso()
    with _lock:
        users = _read_json(USERS_FILE, [])
        users.append(obj)
        _write_json(USERS_FILE, users)
    return obj


def users_set_password(uid, password_hash):
    if USE_SUPABASE:
        rows = _sb("PATCH", "app_users", params={"id": "eq." + uid},
                   json_body={"password_hash": password_hash}, prefer="return=representation")
        return bool(rows)
    with _lock:
        users = _read_json(USERS_FILE, [])
        hit = next((u for u in users if u["id"] == uid), None)
        if not hit:
            return False
        hit["passwordHash"] = password_hash
        _write_json(USERS_FILE, users)
        return True


def users_delete(uid):
    if USE_SUPABASE:
        _sb("DELETE", "app_users", params={"id": "eq." + uid})
        return True
    with _lock:
        users = _read_json(USERS_FILE, [])
        rest = [u for u in users if u["id"] != uid]
        _write_json(USERS_FILE, rest)
        return True


def seed_owner(username, name, password_hash):
    """若還沒有任何帳號，建立一個 owner。回傳是否新建。"""
    if users_list():
        return False
    if USE_SUPABASE:
        _sb("POST", "app_users", json_body={"username": username, "name": name,
            "role": "owner", "password_hash": password_hash})
    else:
        import secrets
        _write_json(USERS_FILE, [{"id": secrets.token_hex(8), "username": username, "name": name,
            "role": "owner", "passwordHash": password_hash, "createdAt": now_iso()}])
    return True


# ================================================================ 圖片 media
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp", ".gif")
_CT = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
       ".webp": "image/webp", ".gif": "image/gif"}


def media_public_url(name):
    if USE_SUPABASE:
        return "%s/storage/v1/object/public/%s/%s" % (SUPA_URL, BUCKET, name)
    return "/assets/" + name


def media_list():
    if USE_SUPABASE:
        r = requests.post(
            "%s/storage/v1/object/list/%s" % (SUPA_URL, BUCKET),
            headers=_sb_headers(),
            json={"prefix": "", "limit": 1000, "offset": 0,
                  "sortBy": {"column": "name", "order": "asc"}}, timeout=20)
        r.raise_for_status()
        out = []
        for o in r.json():
            nm = o.get("name")
            if not nm or nm.startswith(".") or not nm.lower().endswith(IMG_EXT):
                continue
            size = ((o.get("metadata") or {}).get("size")) or 0
            out.append({"name": nm, "url": media_public_url(nm), "size": size, "mtime": 0})
        return out
    items = []
    for fn in os.listdir(ASSETS_DIR):
        if fn.startswith(".") or fn == "logo.svg" or not fn.lower().endswith(IMG_EXT):
            continue
        p = os.path.join(ASSETS_DIR, fn)
        items.append({"name": fn, "url": "/assets/" + fn, "size": os.path.getsize(p), "mtime": os.path.getmtime(p)})
    items.sort(key=lambda x: x["name"])
    return items


def media_save(name, data_bytes, content_type=None):
    ext = os.path.splitext(name)[1].lower()
    ct = content_type or _CT.get(ext, "application/octet-stream")
    if USE_SUPABASE:
        url = "%s/storage/v1/object/%s/%s" % (SUPA_URL, BUCKET, name)
        headers = {"apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY,
                   "Content-Type": ct, "x-upsert": "true"}
        r = requests.post(url, headers=headers, data=data_bytes, timeout=60)
        r.raise_for_status()
        return media_public_url(name)
    os.makedirs(ASSETS_DIR, exist_ok=True)
    with open(os.path.join(ASSETS_DIR, name), "wb") as f:
        f.write(data_bytes)
    return "/assets/" + name


def media_delete(name):
    if USE_SUPABASE:
        url = "%s/storage/v1/object/%s/%s" % (SUPA_URL, BUCKET, name)
        r = requests.delete(url, headers={"apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY}, timeout=20)
        return r.ok
    p = os.path.join(ASSETS_DIR, name)
    if not os.path.isfile(p):
        return False
    os.remove(p)
    return True
