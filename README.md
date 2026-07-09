# GUDO Space 官網 + 後台管理

美好生活創業者的共享基地 — 官方網站與後台管理系統。依《GUDO Space 官網規格書與文案》與 UI 設計稿製作。

- **前台官網**：單頁式行銷網站（Hero、理念、空間、方案、名額、活動、預約表單、FAQ）。
- **後台管理**：Flask 伺服器 + 多人帳號登入，可線上管理名額、方案、活動、FAQ、頁面文案、空間照片，並收集與匯出預約名單。

前台內容由後台 API 即時提供；後台一改，官網重新整理即生效。

---

## 目錄結構

```
GUDO Space/
├─ server.py            ← Flask 伺服器（前台 + 後台 + API）
├─ requirements.txt
├─ public/              ← 前台官網（多頁）
│  ├─ index.html        ← 首頁（長版 Landing）
│  ├─ plan.html         ← 方案完整介紹頁（/plan/<代稱>）
│  ├─ news.html         ← 最新消息列表（/news）
│  ├─ post.html         ← 文章內頁（/news/<slug>）
│  ├─ chronicle.html    ← 活動紀實列表（/chronicle）
│  ├─ story.html        ← 紀實內頁（/chronicle/<slug>）
│  ├─ site.js / site.css  ← 跨頁共用 header/footer 與樣式
│  ├─ styles.css / main.js ← 首頁樣式與邏輯
│  ├─ plan.js / listpage.js / article.js ← 子頁邏輯
│  └─ assets/           ← logo 與圖片（hero.jpg、space-*.jpg、post-*、chron-* …）
├─ admin/               ← 後台管理
│  ├─ login.html        ← 獨立登入頁（/admin/login）
│  ├─ index.html        ← 後台主控台（/admin，未登入自動導轉登入頁）
│  ├─ admin.css / admin.js
└─ data/                ← JSON 資料庫（不對外開放）
   ├─ content.json      ← 網站內容（含方案詳情）
   ├─ posts.json        ← 最新消息文章
   ├─ chronicles.json   ← 活動紀實
   ├─ submissions.json  ← 預約名單
   ├─ users.json        ← 後台帳號（密碼經雜湊）
   └─ secret.key        ← session 金鑰（自動產生）
```

> `data/` 只透過受保護的 API 存取，不會被當成靜態檔案外洩。

## 網站頁面

| 網址 | 內容 |
|---|---|
| `/` | 首頁（Hero、理念、空間、方案、名額、活動、最新消息、預約、FAQ） |
| `/plan/<代稱>` | 方案完整介紹頁（產品頁風格），CTA 為「預約參觀」 |
| `/news`、`/news/<slug>` | 最新消息（部落格）列表與文章 |
| `/chronicle`、`/chronicle/<slug>` | 活動紀實列表與內頁（含相簿） |
| `/admin/login` → `/admin` | 後台登入頁 → 後台主控台 |

---

## 本機啟動

需要 Python 3。

```bash
pip3 install -r requirements.txt
python3 server.py
```

- 官網： <http://localhost:4000>
- 後台： <http://localhost:4000/admin>

首次啟動會自動建立預設管理員帳號並印在終端機：

```
帳號：admin
密碼：gudospace2026
```

**請登入後立刻到「使用者」頁修改密碼。** 也可用環境變數改預設值：
`GUDO_ADMIN_USER`、`GUDO_ADMIN_PASS`、`PORT`、`GUDO_SECRET`。

---

## 後台功能（對應規格書第十四節）

| 頁面 | 功能 |
|---|---|
| **預約收單** | 檢視所有預約名單、標記狀態（未處理／已聯繫／已完成）、刪除、**匯出 CSV**（含 BOM，Excel 直接開） |
| **最新消息** | 部落格文章 CRUD：標題、分類、日期、封面上傳、摘要、內文、發佈開關 |
| **活動紀實** | 活動回顧 CRUD：封面、多張現場照片相簿、地點、回顧文字、發佈開關 |
| **名額管理** | 更新固定座／自由座／彈性會員的名額文字與狀態（開放預約／候補中／已額滿）；前台即時反映 |
| **會員方案** | 編輯卡片與**完整介紹頁**：代稱、標語、長介紹、方案包含、適合對象、須知、相簿、方案 FAQ |
| **加購與租借** | 大會議室／大教室價目 |
| **活動管理** | 新增／修改／上下架活動與活動類型 |
| **FAQ** | 新增／編輯／排序常見問題 |
| **頁面文案** | 首頁主標、各區文案、社群成員、空間數據、頁尾、網站設定；Hero／差異化／空間卡圖片可從圖庫挑 |
| **媒體庫** | 集中管理所有圖片：多檔上傳、複製檔名、刪除；各處圖片欄位皆可「從圖庫挑」快速選用 |
| **使用者** | 多人帳號；擁有者可新增／刪除帳號、指派角色，成員可改自己密碼 |

**角色**：`擁有者(owner)` 可管理使用者；`編輯者(editor)` 可管理內容與名單。

---

## 預約表單收單方式

前台表單送出時：
1. 優先 POST 到本後台 `/api/submissions`，存進 `data/submissions.json`，後台即可看到。
2. 若後台無法連線且有設定「表單收單網址」（後台 → 頁面文案 → 網站設定），則改送該外部網址（Formspree／Apps Script）。

送出後可再串接 Email／Line 官方帳號／Slack／Notion 通知（規格書第十四節，屬後續整合）。

---

## 部署（需要可執行 Python 的主機）

因含後端，需部署到有伺服器執行環境的平台（非純靜態）：

- **Render / Railway / Fly.io**：均有免費方案。啟動指令 `python3 server.py`（或用 `gunicorn server:app`）。
- **一般 VPS**：`gunicorn -w 2 -b 0.0.0.0:4000 server:app`，前面可加 Nginx。

部署注意：
- 設定環境變數 `GUDO_SECRET`（固定值，避免重啟後登入失效）與 `GUDO_ADMIN_PASS`。
- `data/` 需為可持久化寫入的路徑（Render 免費方案重啟會清空磁碟，正式營運建議掛載持久磁碟或改接資料庫）。
- 建議掛在 HTTPS 網域下（session cookie 才安全）。

> 若日後想回到「純靜態、免費部署」：`public/` 資料夾本身就是完整官網，`main.js` 內建離線 fallback，直接丟到 Netlify／Vercel／GitHub Pages 也能顯示（此時改用外部表單服務收單、內容以 `main.js` 的 DEFAULTS 或 `data/content.json` 為準）。

---

## 對照規格書

已涵蓋：網站定位、首頁文案、品牌理念、差異化、社群成員、空間介紹與規格、會員方案、加購與租借、目前名額、預約參觀表單、活動介紹、FAQ、視覺風格（墨綠／米白／金），以及第十四節後台四大功能（名額管理、表單收單、活動管理、頁面管理）＋多人帳號登入。
