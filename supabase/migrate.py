#!/usr/bin/env python3
"""
一次性搬遷：把本機 data/*.json 內容與 public/assets 圖片匯入 Supabase。
用法（在專案根目錄，已設好 .env）：
    python3 supabase/migrate.py
可重複執行：會先清空 posts/chronicles 再重新匯入；圖片以 upsert 覆蓋。
"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 載入 .env
_envp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(_envp):
    for line in open(_envp, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

import store  # noqa: E402

assert store.USE_SUPABASE, "沒有偵測到 Supabase 設定（.env 的 SUPABASE_URL / SERVICE_ROLE_KEY）"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
ASSETS = os.path.join(ROOT, "public", "assets")


def load(name):
    p = os.path.join(DATA, name)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None


# 1) 內容
content = load("content.json") or {}
store.save_content(content)
print("✓ 內容 content.json 已匯入 app_content")

# 2) posts / chronicles（先清空再匯入，保留 slug）
for table, fname in [("posts", "posts.json"), ("chronicles", "chronicles.json")]:
    for old in store.coll_all(table):
        store.coll_delete(table, old["id"])
    items = load(fname) or []
    for it in reversed(items):   # 保持日期順序
        store.coll_create(table, it)
    print(f"✓ {table}：匯入 {len(items)} 筆")

# 3) 圖片 → Supabase Storage
count = 0
for fn in sorted(os.listdir(ASSETS)):
    if fn.startswith(".") or not fn.lower().endswith(store.IMG_EXT):
        continue
    with open(os.path.join(ASSETS, fn), "rb") as f:
        store.media_save(fn, f.read())
    count += 1
print(f"✓ 圖片：上傳 {count} 張到 Storage（media bucket）")

print("\n搬遷完成 🎉  Supabase 現在有你的內容、文章、活動與所有圖片。")
