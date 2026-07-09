/* ===================================================================
   GUDO Space 後台管理
   =================================================================== */

const state = { me: null, content: null, subs: [], users: [], view: "submissions" };

/* ---------- 小工具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const clone = (o) => JSON.parse(JSON.stringify(o));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function el(tag, props = {}, kids = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const c of [].concat(kids)) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
}

let toastTimer;
function toast(msg, isErr = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (isErr ? " err" : "");
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

async function api(method, path, body) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "操作失敗");
  return data;
}

/* 編輯欄位建構器：input/textarea/select，改動即寫回 obj[key] */
function bindInput(obj, key, { textarea = false, placeholder = "", type = "text" } = {}) {
  const node = textarea
    ? el("textarea", { placeholder })
    : el("input", { type, placeholder });
  node.value = obj[key] ?? "";
  node.addEventListener("input", () => (obj[key] = node.value));
  return node;
}
function field(labelText, node) {
  return el("div", { class: "field" }, [el("label", {}, labelText), node]);
}
function select(obj, key, options) {
  const s = el("select");
  for (const o of options) {
    const opt = el("option", { value: o.value }, o.label);
    if (obj[key] === o.value) opt.selected = true;
    s.append(opt);
  }
  s.addEventListener("change", () => (obj[key] = s.value));
  return s;
}

/* 可增減的字串清單（feats、paragraphs、form 選項…）；opts.library=true 時附「從圖庫加入」 */
function stringListEditor(arr, placeholder = "輸入後按 Enter", opts = {}) {
  const wrap = el("div", { class: "chips-edit" });
  function render() {
    wrap.innerHTML = "";
    arr.forEach((v, i) => {
      wrap.append(el("span", { class: "chip-x" }, [
        v,
        el("button", { type: "button", title: "移除", onclick: () => { arr.splice(i, 1); render(); } }, "×"),
      ]));
    });
    const inp = el("input", { type: "text", placeholder, style: "flex:1;min-width:160px;border:1px solid var(--cream-line);border-radius:8px;padding:8px 10px;background:#fff" });
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); const val = inp.value.trim(); if (val) { arr.push(val); render(); wrap.querySelector("input").focus(); } }
    });
    wrap.append(inp);
    if (opts.library) {
      const lib = el("button", { type: "button", class: "btn btn--dark btn--sm" }, "從圖庫加入");
      lib.addEventListener("click", () => openLibrary((f) => { arr.push(f); render(); }));
      wrap.append(lib);
    }
  }
  render();
  return wrap;
}

const STATUS_OPTS = [
  { value: "open", label: "開放預約" },
  { value: "wait", label: "候補中" },
  { value: "full", label: "已額滿" },
];

/* ---------- 儲存內容區塊 ---------- */
async function saveSection(key, value, label) {
  try {
    const r = await api("PUT", "/api/content", { [key]: value });
    state.content = r.content;
    toast((label || "內容") + "已儲存 ✓");
  } catch (e) { toast(e.message, true); }
}

/* =================================================================
   各視圖
   ================================================================= */
const VIEWS = {};

/* ---- 預約收單 ---- */
VIEWS.submissions = {
  title: "預約收單",
  actions: () => [
    el("a", { class: "btn btn--ghost btn--sm", href: "/api/submissions.csv" }, "⬇ 匯出 CSV"),
  ],
  async render() {
    state.subs = await api("GET", "/api/submissions");
    const box = el("div");
    if (!state.subs.length) { box.append(el("div", { class: "empty" }, "目前還沒有預約名單。前台表單送出後會顯示在這裡。")); return box; }

    const label = { new: "未處理", contacted: "已聯繫", done: "已完成" };
    const table = el("table", { class: "table" });
    table.append(el("thead", {}, el("tr", { html:
      "<th>時間</th><th>狀態</th><th>姓名 / 聯絡</th><th>想了解 / 身分</th><th>時間 / 參觀</th><th>備註</th><th></th>" })));
    const tb = el("tbody");
    for (const s of state.subs) {
      const statusSel = select(s, "status", [
        { value: "new", label: "未處理" }, { value: "contacted", label: "已聯繫" }, { value: "done", label: "已完成" }]);
      statusSel.style.cssText = "padding:5px 8px;border-radius:8px;border:1px solid var(--cream-line)";
      statusSel.addEventListener("change", async () => {
        try { await api("PATCH", "/api/submissions/" + s.id, { status: s.status }); toast("狀態已更新"); } catch (e) { toast(e.message, true); }
      });
      const tags = (a) => a && a.length ? `<div class="tags">${a.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>` : "";
      tb.append(el("tr", {}, [
        el("td", { html: `<span class="muted">${esc((s.createdAt || "").replace("T", " ").slice(0, 16))}</span>` }),
        el("td", {}, statusSel),
        el("td", { html: `<strong>${esc(s.name)}</strong><br><span class="muted">${esc(s.phone)}</span>${s.email ? "<br>" + esc(s.email) : ""}${s.line ? `<br>Line: ${esc(s.line)}` : ""}` }),
        el("td", { html: tags(s.interest) + tags(s.identity) }),
        el("td", { html: tags(s.timeline) + tags(s.visit) + (s.slot ? `<div class="muted">${esc(s.slot)}</div>` : "") }),
        el("td", { html: s.note ? esc(s.note) : "<span class='muted'>—</span>" }),
        el("td", {}, el("button", { class: "btn btn--danger btn--sm", onclick: async () => {
          if (!confirm("確定刪除這筆名單？")) return;
          try { await api("DELETE", "/api/submissions/" + s.id); toast("已刪除"); rerender(); } catch (e) { toast(e.message, true); }
        } }, "刪除")),
      ]));
    }
    table.append(tb);
    box.append(el("div", { class: "panel" }, table));
    return box;
  },
};

/* ---- 名額管理 ---- */
VIEWS.availability = {
  title: "名額管理",
  render() {
    const work = clone(state.content.availability || []);
    const box = el("div");
    box.append(el("p", { class: "hint" }, "更新各會員類型的開放名額文字與狀態；前台「目前名額」區與會員方案卡會即時反映。"));
    const list = el("div");
    const renderList = () => {
      list.innerHTML = "";
      work.forEach((a, i) => list.append(el("div", { class: "item" }, [
        el("div", { class: "item__bar" }, [el("strong", {}, a.name || `類型 ${i + 1}`),
          el("button", { class: "btn btn--danger btn--sm", onclick: () => { work.splice(i, 1); renderList(); } }, "刪除")]),
        el("div", { class: "row-3" }, [
          field("名稱", bindInput(a, "name")),
          field("名額文字", bindInput(a, "open", { placeholder: "例如：開放名額 16–18 席" })),
          field("狀態", select(a, "status", STATUS_OPTS)),
        ]),
      ])));
    };
    renderList();
    box.append(el("div", { class: "panel__head" }, [el("h3", {}, "名額類型"),
      el("button", { class: "btn btn--ghost btn--sm", onclick: () => { work.push({ name: "", open: "", status: "open" }); renderList(); } }, "＋ 新增類型")]));
    box.append(list, el("button", { class: "btn btn--gold", onclick: () => saveSection("availability", work, "名額") }, "儲存名額"));
    return box;
  },
};

/* ---- 會員方案（含產品頁詳情） ---- */
VIEWS.plans = {
  title: "會員方案",
  render() {
    const work = clone(state.content.plans || []);
    const box = el("div");
    box.append(el("p", { class: "hint" }, "編輯方案卡與「完整介紹頁」內容。主打卡以深綠色強調（建議僅一張）。詳情頁網址為 /plan/方案代稱。" ));
    const list = el("div");
    const renderPlans = () => {
    list.innerHTML = "";
    work.forEach((p, i) => {
      if (!Array.isArray(p.longDesc)) p.longDesc = [];
      if (!Array.isArray(p.includes)) p.includes = [];
      if (!Array.isArray(p.suitableFor)) p.suitableFor = [];
      if (!Array.isArray(p.notes)) p.notes = [];
      if (!Array.isArray(p.gallery)) p.gallery = [];
      if (!Array.isArray(p.faq)) p.faq = [];
      const feats = p.feats || (p.feats = []);

      // 方案 FAQ 編輯
      const faqWrap = el("div", { class: "field" }, el("label", {}, "方案常見問題"));
      const faqList = el("div");
      const renderFaq = () => {
        faqList.innerHTML = "";
        p.faq.forEach((f, fi) => faqList.append(el("div", { class: "item", style: "background:#fff" }, [
          el("div", { class: "item__bar" }, [el("span", { class: "muted" }, `Q${fi + 1}`), el("button", { class: "btn btn--danger btn--sm", onclick: () => { p.faq.splice(fi, 1); renderFaq(); } }, "×")]),
          field("問題", bindInput(f, "q")), field("答覆", bindInput(f, "a", { textarea: true })),
        ])));
      };
      renderFaq();
      const faqAdd = el("button", { type: "button", class: "btn btn--ghost btn--sm" }, "＋ 新增問題");
      faqAdd.addEventListener("click", () => { p.faq.push({ q: "", a: "" }); renderFaq(); });
      faqWrap.append(faqList, faqAdd);

      const item = el("div", { class: "item" }, [
        el("div", { class: "item__bar" }, [
          el("strong", {}, `方案：${p.name || i + 1}`),
          el("div", { class: "inline" }, [
            el("a", { class: "muted", href: `/plan/${encodeURIComponent(p.slug || "")}`, target: "_blank", style: "font-size:12px" }, "預覽詳情頁"),
            el("label", { class: "inline muted" }, [
              (() => { const c = el("input", { type: "checkbox" }); c.checked = !!p.featured; c.addEventListener("change", () => (p.featured = c.checked)); return c; })(),
              " 主打卡",
            ]),
            el("button", { class: "btn btn--danger btn--sm", onclick: () => { if (confirm(`刪除方案「${p.name || ""}」？`)) { work.splice(i, 1); renderPlans(); } } }, "刪除"),
          ]),
        ]),
        el("div", { class: "row-3" }, [
          field("方案名稱", bindInput(p, "name")),
          field("價格（元／月）", bindInput(p, "price")),
          field("狀態", select(p, "status", STATUS_OPTS)),
        ]),
        el("div", { class: "row" }, [
          field("方案代稱（網址用，英文）", bindInput(p, "slug", { placeholder: "fixed / hotdesk / flexible" })),
          field("一句話標語", bindInput(p, "tagline")),
        ]),
        field("卡片說明（首頁方案卡）", bindInput(p, "desc", { textarea: true })),
        field("卡片權益（按 Enter 新增）", stringListEditor(feats, "新增一項權益")),
        el("hr", { style: "border:none;border-top:1px dashed var(--cream-line);margin:8px 0" }),
        el("p", { class: "muted", style: "font-weight:700" }, "── 完整介紹頁內容 ──"),
        field("方案介紹（每段一列，按 Enter 新增段落）", stringListEditor(p.longDesc, "新增一段介紹")),
        field("方案包含（按 Enter 新增）", stringListEditor(p.includes, "新增一項")),
        field("適合對象（按 Enter 新增）", stringListEditor(p.suitableFor, "新增一項")),
        field("使用須知（按 Enter 新增）", stringListEditor(p.notes, "新增一項")),
        field("空間實景相簿（從圖庫加入，或輸入檔名按 Enter）", stringListEditor(p.gallery, "例如 office-06.jpg", { library: true })),
        faqWrap,
      ]);
      list.append(item);
    });
    };
    renderPlans();
    box.append(el("div", { class: "panel__head" }, [el("h3", {}, "方案列表"),
      el("button", { class: "btn btn--ghost btn--sm", onclick: () => { work.push({ name: "新方案", price: "0", status: "open", desc: "", feats: [], slug: "", longDesc: [], includes: [], suitableFor: [], notes: [], gallery: [], faq: [] }); renderPlans(); } }, "＋ 新增方案")]));
    box.append(list, el("button", { class: "btn btn--gold", onclick: () => saveSection("plans", work, "會員方案") }, "儲存方案"));
    return box;
  },
};

/* ---- 加購與租借 ---- */
VIEWS.rentals = {
  title: "加購與租借",
  render() {
    const work = clone(state.content.rentals || []);
    const box = el("div");
    box.append(el("p", { class: "hint" }, "大會議室、大教室或其他空間的租借價目。" ));
    const list = el("div");
    const renderList = () => {
    list.innerHTML = "";
    work.forEach((r, idx) => {
      const rowsWrap = el("div");
      const renderRows = () => {
        rowsWrap.innerHTML = "";
        (r.rows || (r.rows = [])).forEach((row, ri) => {
          rowsWrap.append(el("div", { class: "row", style: "margin-bottom:8px;align-items:end" }, [
            field("項目", bindInput(row, "k")),
            el("div", { class: "inline" }, [
              field("價格", bindInput(row, "v")),
              el("button", { class: "btn btn--danger btn--sm", onclick: () => { r.rows.splice(ri, 1); renderRows(); } }, "×"),
            ]),
          ]));
        });
        rowsWrap.append(el("button", { class: "btn btn--ghost btn--sm", onclick: () => { r.rows.push({ k: "", v: "" }); renderRows(); } }, "+ 新增一列"));
      };
      renderRows();
      list.append(el("div", { class: "item" }, [
        el("div", { class: "item__bar" }, [el("strong", {}, r.title || `項目 ${idx + 1}`),
          el("button", { class: "btn btn--danger btn--sm", onclick: () => { work.splice(idx, 1); renderList(); } }, "刪除")]),
        el("div", { class: "row" }, [field("標題", bindInput(r, "title")), field("副標", bindInput(r, "sub"))]),
        rowsWrap,
      ]));
    });
    };
    renderList();
    box.append(el("div", { class: "panel__head" }, [el("h3", {}, "租借項目"),
      el("button", { class: "btn btn--ghost btn--sm", onclick: () => { work.push({ title: "新項目", sub: "", rows: [{ k: "", v: "" }] }); renderList(); } }, "＋ 新增項目")]));
    box.append(list, el("button", { class: "btn btn--gold", onclick: () => saveSection("rentals", work, "租借價目") }, "儲存租借"));
    return box;
  },
};

/* ---- 活動管理 ---- */
VIEWS.events = {
  title: "活動管理",
  render() {
    const events = clone(state.content.events || []);
    const types = clone(state.content.eventTypes || []);
    const box = el("div");

    // 近期活動
    const evPanel = el("div", { class: "panel" });
    evPanel.append(el("div", { class: "panel__head" }, [el("h3", {}, "近期活動"),
      el("button", { class: "btn btn--ghost btn--sm", onclick: () => { events.push({ tag: "交流會", fee: "會員免費", title: "", date: "近期公告", time: "", place: "GUDO Space", target: "", active: true }); renderEvents(); } }, "+ 新增活動")]));
    const evList = el("div");
    function renderEvents() {
      evList.innerHTML = "";
      events.forEach((e, i) => {
        const on = el("input", { type: "checkbox" }); on.checked = e.active !== false; on.addEventListener("change", () => (e.active = on.checked));
        evList.append(el("div", { class: "item" }, [
          el("div", { class: "item__bar" }, [el("strong", {}, `活動 ${i + 1}`),
            el("div", { class: "inline" }, [
              el("label", { class: "inline muted" }, [on, " 顯示於前台"]),
              el("button", { class: "btn btn--danger btn--sm", onclick: () => { events.splice(i, 1); renderEvents(); } }, "刪除"),
            ])]),
          el("div", { class: "row-3" }, [field("類型標籤", bindInput(e, "tag")), field("費用", bindInput(e, "fee")), field("日期", bindInput(e, "date"))]),
          field("活動名稱", bindInput(e, "title")),
          el("div", { class: "row-3" }, [field("時間", bindInput(e, "time", { placeholder: "19:00–21:00" })), field("地點", bindInput(e, "place")), field("適合對象", bindInput(e, "target"))]),
        ]));
      });
    }
    renderEvents();
    evPanel.append(evList, el("button", { class: "btn btn--gold", onclick: () => saveSection("events", events, "近期活動") }, "儲存活動"));

    // 活動類型
    const tyPanel = el("div", { class: "panel" });
    tyPanel.append(el("div", { class: "panel__head" }, [el("h3", {}, "活動類型"),
      el("button", { class: "btn btn--ghost btn--sm", onclick: () => { types.push({ icon: "🌿", t: "", d: "" }); renderTypes(); } }, "+ 新增類型")]));
    const tyList = el("div");
    function renderTypes() {
      tyList.innerHTML = "";
      types.forEach((t, i) => {
        tyList.append(el("div", { class: "item" }, [
          el("div", { class: "item__bar" }, [el("strong", {}, `類型 ${i + 1}`),
            el("button", { class: "btn btn--danger btn--sm", onclick: () => { types.splice(i, 1); renderTypes(); } }, "刪除")]),
          el("div", { class: "row", style: "grid-template-columns:80px 1fr" }, [field("圖示", bindInput(t, "icon")), field("名稱", bindInput(t, "t"))]),
          field("說明", bindInput(t, "d", { textarea: true })),
        ]));
      });
    }
    renderTypes();
    tyPanel.append(tyList, el("button", { class: "btn btn--gold", onclick: () => saveSection("eventTypes", types, "活動類型") }, "儲存類型"));

    box.append(evPanel, tyPanel);
    return box;
  },
};

/* ---- FAQ ---- */
VIEWS.faq = {
  title: "FAQ",
  render() {
    const work = clone(state.content.faq || []);
    const box = el("div");
    const list = el("div");
    function renderList() {
      list.innerHTML = "";
      work.forEach((f, i) => {
        const openC = el("input", { type: "checkbox" }); openC.checked = !!f.open; openC.addEventListener("change", () => (f.open = openC.checked));
        list.append(el("div", { class: "item" }, [
          el("div", { class: "item__bar" }, [el("strong", {}, `問題 ${i + 1}`),
            el("div", { class: "inline" }, [
              el("label", { class: "inline muted" }, [openC, " 預設展開"]),
              el("button", { class: "btn btn--ghost btn--sm", onclick: () => { if (i > 0) { [work[i - 1], work[i]] = [work[i], work[i - 1]]; renderList(); } } }, "↑"),
              el("button", { class: "btn btn--danger btn--sm", onclick: () => { work.splice(i, 1); renderList(); } }, "刪除"),
            ])]),
          field("問題", bindInput(f, "q")),
          field("答覆", bindInput(f, "a", { textarea: true })),
        ]));
      });
    }
    renderList();
    box.append(el("div", { class: "panel__head" }, [el("h3", {}, "常見問題"),
      el("button", { class: "btn btn--ghost btn--sm", onclick: () => { work.push({ q: "", a: "", open: false }); renderList(); } }, "+ 新增問題")]));
    box.append(list, el("button", { class: "btn btn--gold", onclick: () => saveSection("faq", work, "FAQ") }, "儲存 FAQ"));
    return box;
  },
};

/* ---- 頁面文案 ---- */
VIEWS.pages = {
  title: "頁面文案",
  render() {
    const c = clone(state.content.copy || {});
    const settings = clone(state.content.settings || {});
    const personas = clone(state.content.personas || []);
    const stats = clone(state.content.stats || []);
    const spaces = clone(state.content.spaces || []);
    const box = el("div");

    const panel = (titleText, saveKey, saveVal, ...fields) => {
      const p = el("div", { class: "panel" }, [el("div", { class: "panel__head" }, el("h3", {}, titleText)), ...fields,
        el("button", { class: "btn btn--gold btn--sm", onclick: () => saveSection(saveKey, saveVal(), titleText) }, "儲存")]);
      return p;
    };

    // 網站設定
    settings.contact = settings.contact || {};
    box.append(panel("網站設定", "settings", () => settings,
      el("div", { class: "row" }, [field("品牌名稱", bindInput(settings, "brandName")),
        field("表單收單網址（Formspree／Apps Script，留空則存本後台）", bindInput(settings, "formEndpoint"))]),
      el("div", { class: "row" }, [field("地區", bindInput(settings.contact, "area")), field("交通", bindInput(settings.contact, "transit"))]),
    ));

    // Hero
    c.hero = c.hero || {};
    box.append(panel("首頁 Hero", "copy", () => c,
      el("div", { class: "row" }, [field("標籤", bindInput(c.hero, "tag")), field("主標", bindInput(c.hero, "title"))]),
      field("副標", bindInput(c.hero, "lede")),
      field("內文", bindInput(c.hero, "text", { textarea: true })),
      field("底部資訊列", bindInput(c.hero, "meta")),
      imageField("首圖（右側主視覺）", c.hero, "image", "hero"),
    ));

    // 品牌理念
    c.about = c.about || { paragraphs: [] };
    box.append(panel("品牌理念", "copy", () => c,
      el("div", { class: "row" }, [field("小標", bindInput(c.about, "eyebrow")), field("大標（可用換行）", bindInput(c.about, "title", { textarea: true }))]),
      field("段落（按 Enter 新增一段）", stringListEditor(c.about.paragraphs || (c.about.paragraphs = []), "新增一段文字")),
      field("結語", bindInput(c.about, "lead")),
    ));

    // 差異化
    c.diff = c.diff || { paragraphs: [] };
    box.append(panel("差異化區塊", "copy", () => c,
      el("div", { class: "row" }, [field("小標", bindInput(c.diff, "eyebrow")), field("大標", bindInput(c.diff, "title", { textarea: true }))]),
      field("段落", stringListEditor(c.diff.paragraphs || (c.diff.paragraphs = []), "新增一段")),
      imageField("區塊圖片", c.diff, "image", "diff"),
    ));

    // 空間介紹文案
    c.space = c.space || { paragraphs: [] };
    box.append(panel("空間介紹文案", "copy", () => c,
      el("div", { class: "row" }, [field("小標", bindInput(c.space, "eyebrow")), field("大標", bindInput(c.space, "title", { textarea: true }))]),
      field("段落", stringListEditor(c.space.paragraphs || (c.space.paragraphs = []), "新增一段")),
    ));

    // 頁尾 + 預約成功訊息
    c.footer = c.footer || {}; c.bookingIntro = c.bookingIntro || {};
    box.append(panel("頁尾與成功訊息", "copy", () => c,
      field("頁尾標語", bindInput(c.footer, "tagline", { textarea: true })),
      field("版權列", bindInput(c.footer, "copyright")),
      field("預約送出後的成功訊息", bindInput(c.bookingIntro, "success", { textarea: true })),
    ));

    // 空間數據
    const statsList = el("div", { class: "row" });
    stats.forEach((s) => statsList.append(el("div", { class: "item" }, [field("數字", bindInput(s, "num")), field("說明", bindInput(s, "label"))])));
    box.append(el("div", { class: "panel" }, [el("div", { class: "panel__head" }, el("h3", {}, "空間數據（4 項）")), statsList,
      el("button", { class: "btn btn--gold btn--sm", onclick: () => saveSection("stats", stats, "空間數據") }, "儲存")]));

    // 社群成員
    const perWrap = el("div");
    const renderPer = () => {
      perWrap.innerHTML = "";
      personas.forEach((p, i) => perWrap.append(el("div", { class: "item" }, [
        el("div", { class: "item__bar" }, [el("strong", {}, `成員 ${i + 1}`), el("button", { class: "btn btn--danger btn--sm", onclick: () => { personas.splice(i, 1); renderPer(); } }, "刪除")]),
        el("div", { class: "row", style: "grid-template-columns:90px 1fr" }, [field("編號", bindInput(p, "n")), field("標題", bindInput(p, "t"))]),
        field("說明", bindInput(p, "d", { textarea: true })),
      ])));
    };
    renderPer();
    box.append(el("div", { class: "panel" }, [el("div", { class: "panel__head" }, [el("h3", {}, "社群成員"),
      el("button", { class: "btn btn--ghost btn--sm", onclick: () => { personas.push({ n: String(personas.length + 1).padStart(2, "0"), t: "", d: "" }); renderPer(); } }, "+ 新增")]),
      perWrap, el("button", { class: "btn btn--gold btn--sm", onclick: () => saveSection("personas", personas, "社群成員") }, "儲存")]));

    // 空間卡（文案＋圖片）
    const spWrap = el("div");
    spaces.forEach((s) => spWrap.append(el("div", { class: "item" }, [
      el("div", { class: "row" }, [field("空間名稱", bindInput(s, "t")), field("說明", bindInput(s, "d", { textarea: true }))]),
      imageField("卡片圖片", s, "image", "space"),
    ])));
    box.append(el("div", { class: "panel" }, [el("div", { class: "panel__head" }, el("h3", {}, "空間卡（文案＋圖片）")), spWrap,
      el("button", { class: "btn btn--gold btn--sm", onclick: () => saveSection("spaces", spaces, "空間卡") }, "儲存")]));

    return box;
  },
};

/* ---- 區塊管理（顯示隱藏 / 進駐品牌 / 自訂區塊） ---- */
const SECTION_LABELS = [
  ["about", "品牌理念"], ["diff", "差異化區塊"], ["personas", "社群成員"], ["space", "空間介紹"],
  ["brands", "進駐品牌"], ["plans", "會員方案"], ["availability", "目前名額"], ["events", "活動介紹"],
  ["customBlocks", "自訂區塊"], ["homeNews", "最新消息"], ["faq", "FAQ"],
];
VIEWS.blocks = {
  title: "區塊管理",
  render() {
    const box = el("div");

    // 1) 區塊顯示 / 隱藏
    const sections = Object.assign({}, state.content.sections || {});
    const togWrap = el("div", { class: "row-3" });
    SECTION_LABELS.forEach(([k, label]) => {
      const cb = el("input", { type: "checkbox" });
      cb.checked = sections[k] !== false;
      cb.addEventListener("change", () => (sections[k] = cb.checked));
      togWrap.append(el("label", { class: "inline", style: "padding:10px 12px;border:1px solid var(--cream-line);border-radius:10px;background:#fff" }, [cb, " " + label]));
    });
    box.append(el("div", { class: "panel" }, [
      el("div", { class: "panel__head" }, el("h3", {}, "區塊顯示／隱藏")),
      el("p", { class: "hint" }, "取消勾選即在官網隱藏該區塊（資料仍保留）。"),
      togWrap,
      el("button", { class: "btn btn--gold btn--sm", style: "margin-top:14px", onclick: () => saveSection("sections", sections, "區塊顯示設定") }, "儲存顯示設定"),
    ]));

    // 2) 進駐品牌
    const brands = clone(state.content.brands || []);
    const bPanel = el("div", { class: "panel" });
    bPanel.append(el("div", { class: "panel__head" }, [el("h3", {}, "進駐品牌"),
      el("button", { class: "btn btn--ghost btn--sm", onclick: () => { brands.push({ name: "", logo: "", url: "", desc: "" }); renderBrands(); } }, "＋ 新增品牌")]));
    bPanel.append(el("p", { class: "hint" }, "新增進駐品牌的 logo 與簡介。要顯示在官網，請在上方勾選「進駐品牌」並至少有一個品牌。"));
    const bList = el("div");
    function renderBrands() {
      bList.innerHTML = "";
      brands.forEach((b, i) => bList.append(el("div", { class: "item" }, [
        el("div", { class: "item__bar" }, [el("strong", {}, b.name || `品牌 ${i + 1}`),
          el("button", { class: "btn btn--danger btn--sm", onclick: () => { brands.splice(i, 1); renderBrands(); } }, "刪除")]),
        el("div", { class: "row" }, [field("品牌名稱", bindInput(b, "name")), field("連結（選填）", bindInput(b, "url", { placeholder: "https://" }))]),
        field("簡介（選填）", bindInput(b, "desc", { textarea: true })),
        imageField("品牌 Logo", b, "logo", "brand"),
      ])));
    }
    renderBrands();
    bPanel.append(bList, el("button", { class: "btn btn--gold btn--sm", onclick: () => saveSection("brands", brands, "進駐品牌") }, "儲存品牌"));
    box.append(bPanel);

    // 3) 自訂區塊
    const blocks = clone(state.content.customBlocks || []);
    const cPanel = el("div", { class: "panel" });
    cPanel.append(el("div", { class: "panel__head" }, [el("h3", {}, "自訂區塊"),
      el("button", { class: "btn btn--ghost btn--sm", onclick: () => { blocks.push({ eyebrow: "", title: "新區塊標題", paragraphs: [], image: "", imagePos: "right", theme: "cream", enabled: true }); renderBlocks(); } }, "＋ 新增區塊")]));
    cPanel.append(el("p", { class: "hint" }, "自由新增內容區塊（顯示在官網「活動」與「最新消息」之間）。可選左右配圖或純文字、淺色或深綠底。"));
    const cList = el("div");
    function renderBlocks() {
      cList.innerHTML = "";
      blocks.forEach((b, i) => {
        if (!Array.isArray(b.paragraphs)) b.paragraphs = [];
        const en = el("input", { type: "checkbox" }); en.checked = b.enabled !== false; en.addEventListener("change", () => (b.enabled = en.checked));
        cList.append(el("div", { class: "item" }, [
          el("div", { class: "item__bar" }, [el("strong", {}, b.title || `區塊 ${i + 1}`),
            el("div", { class: "inline" }, [
              el("label", { class: "inline muted" }, [en, " 顯示"]),
              el("button", { class: "btn btn--danger btn--sm", onclick: () => { blocks.splice(i, 1); renderBlocks(); } }, "刪除")])]),
          el("div", { class: "row" }, [field("小標（選填）", bindInput(b, "eyebrow")), field("大標", bindInput(b, "title"))]),
          field("內文段落（按 Enter 新增一段）", stringListEditor(b.paragraphs, "新增一段文字")),
          el("div", { class: "row-3" }, [
            field("配圖位置", select(b, "imagePos", [{ value: "right", label: "圖在右" }, { value: "left", label: "圖在左" }, { value: "none", label: "不放圖" }])),
            field("背景", select(b, "theme", [{ value: "cream", label: "淺色" }, { value: "dark", label: "深綠" }])),
            el("div"),
          ]),
          imageField("區塊圖片", b, "image", "block"),
        ]));
      });
    }
    renderBlocks();
    cPanel.append(cList, el("button", { class: "btn btn--gold btn--sm", onclick: () => saveSection("customBlocks", blocks, "自訂區塊") }, "儲存自訂區塊"));
    box.append(cPanel);

    return box;
  },
};

/* ---- 媒體庫（圖庫） ---- */
VIEWS.media = {
  title: "媒體庫",
  actions: () => {
    const inp = el("input", { type: "file", accept: "image/*", multiple: "true", style: "display:none" });
    inp.addEventListener("change", async () => {
      const files = [...inp.files]; if (!files.length) return;
      let ok = 0;
      for (const f of files) {
        const fd = new FormData(); fd.append("file", f);
        try { const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" }); if (r.ok) ok++; } catch (_) {}
      }
      toast(`已上傳 ${ok} 張`); rerender();
    });
    const btn = el("button", { class: "btn btn--gold btn--sm", onclick: () => inp.click() }, "⬆ 上傳圖片（可多選）");
    btn.append(inp);
    return [btn];
  },
  async render() {
    const items = await api("GET", "/api/media");
    const box = el("div");
    box.append(el("p", { class: "hint" }, `圖庫共 ${items.length} 張。這裡集中管理所有圖片；在「頁面文案／方案／最新消息／活動紀實」的圖片欄位，都可以按「從圖庫挑」直接選用。滑鼠移到圖片可複製檔名或刪除。` ));
    const grid = el("div", { class: "media-grid" });
    items.forEach((it) => {
      const kb = Math.round(it.size / 1024);
      grid.append(el("div", { class: "media-cell" }, [
        el("img", { class: "thumb", src: it.url + "?t=" + Math.round(it.mtime), loading: "lazy" }),
        el("div", { class: "media-cell__name" }, `${it.name}　${kb}KB`),
        el("div", { class: "inline", style: "margin-top:4px;gap:6px" }, [
          el("button", { class: "btn btn--ghost btn--sm", onclick: () => { navigator.clipboard && navigator.clipboard.writeText(it.name); toast("已複製檔名：" + it.name); } }, "複製檔名"),
          el("button", { class: "btn btn--danger btn--sm", onclick: async () => {
            if (!confirm(`刪除 ${it.name}？若某頁正在使用會變回色塊。`)) return;
            try { await api("DELETE", "/api/media/" + encodeURIComponent(it.name)); toast("已刪除"); rerender(); } catch (e) { toast(e.message, true); }
          } }, "刪除"),
        ]),
      ]));
    });
    box.append(el("div", { class: "panel" }, grid));
    return box;
  },
};

/* ---- 圖庫挑選器（Modal），回呼選到的檔名 ---- */
async function openLibrary(cb) {
  let items = [];
  try { items = await api("GET", "/api/media"); } catch (_) {}
  const overlay = el("div", { class: "lib-overlay" });
  const panel = el("div", { class: "lib-panel" });
  panel.append(el("div", { class: "lib-head" }, [
    el("strong", {}, "從圖庫挑選"),
    el("button", { class: "btn btn--ghost btn--sm", onclick: () => overlay.remove() }, "關閉"),
  ]));
  const grid = el("div", { class: "media-grid" });
  items.forEach((it) => {
    const cell = el("div", { class: "media-cell lib-pick" }, [
      el("img", { class: "thumb", src: it.url + "?t=" + Math.round(it.mtime), loading: "lazy" }),
      el("div", { class: "media-cell__name" }, it.name),
    ]);
    cell.addEventListener("click", () => { cb(it.name); overlay.remove(); });
    grid.append(cell);
  });
  panel.append(grid);
  overlay.append(panel);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.append(overlay);
}

/* ---- 使用者 ---- */
VIEWS.users = {
  title: "使用者",
  async render() {
    state.users = await api("GET", "/api/users");
    const isOwner = state.me.role === "owner";
    const box = el("div");

    const table = el("table", { class: "table" });
    table.append(el("thead", {}, el("tr", { html: "<th>名稱</th><th>帳號</th><th>角色</th><th></th>" })));
    const tb = el("tbody");
    state.users.forEach((u) => {
      const actions = el("div", { class: "inline" });
      // 改密碼：擁有者可改所有人，自己可改自己
      if (isOwner || u.id === state.me.id) {
        actions.append(el("button", { class: "btn btn--ghost btn--sm", onclick: async () => {
          const pw = prompt(`設定 ${u.name} 的新密碼（至少 6 碼）`);
          if (!pw) return;
          try { await api("POST", `/api/users/${u.id}/password`, { password: pw }); toast("密碼已更新"); } catch (e) { toast(e.message, true); }
        } }, "改密碼"));
      }
      if (isOwner && u.id !== state.me.id) {
        actions.append(el("button", { class: "btn btn--danger btn--sm", onclick: async () => {
          if (!confirm(`確定刪除使用者 ${u.name}？`)) return;
          try { await api("DELETE", "/api/users/" + u.id); toast("已刪除"); rerender(); } catch (e) { toast(e.message, true); }
        } }, "刪除"));
      }
      tb.append(el("tr", {}, [
        el("td", { html: `<strong>${esc(u.name)}</strong>${u.id === state.me.id ? " <span class='muted'>(你)</span>" : ""}` }),
        el("td", {}, u.username),
        el("td", { html: `<span class="badge ${u.role === "owner" ? "wait" : "new"}">${u.role === "owner" ? "擁有者" : "編輯者"}</span>` }),
        el("td", {}, actions),
      ]));
    });
    table.append(tb);
    box.append(el("div", { class: "panel" }, table));

    // 新增使用者（僅擁有者）
    if (isOwner) {
      const nu = { username: "", name: "", password: "", role: "editor" };
      box.append(el("div", { class: "panel" }, [
        el("div", { class: "panel__head" }, el("h3", {}, "新增使用者")),
        el("div", { class: "row-3" }, [field("帳號", bindInput(nu, "username")), field("顯示名稱", bindInput(nu, "name")), field("密碼（至少 6 碼）", bindInput(nu, "password", { type: "password" }))]),
        field("角色", select(nu, "role", [{ value: "editor", label: "編輯者（可管理內容與名單）" }, { value: "owner", label: "擁有者（另可管理使用者）" }])),
        el("button", { class: "btn btn--gold", onclick: async () => {
          try { await api("POST", "/api/users", nu); toast("已新增使用者"); rerender(); } catch (e) { toast(e.message, true); }
        } }, "新增"),
      ]));
    } else {
      box.append(el("p", { class: "hint" }, "只有「擁有者」可以新增或刪除使用者。你可以在上方修改自己的密碼。"));
    }
    return box;
  },
};

/* ---- 圖片上傳工具 ---- */
function pickAndUpload(base, cb) {
  const inp = el("input", { type: "file", accept: "image/*", style: "display:none" });
  inp.addEventListener("change", async () => {
    const f = inp.files[0]; if (!f) return;
    const ext = (f.name.match(/\.[a-z0-9]+$/i) || [".jpg"])[0].toLowerCase();
    const fd = new FormData(); fd.append("file", f);
    if (base) fd.append("as", base + ext);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "same-origin" });
      const d = await res.json(); if (!res.ok) throw new Error(d.error || "上傳失敗");
      cb(d.path.replace(/^assets\//, ""));
      toast("已上傳圖片");
    } catch (e) { toast(e.message, true); }
    inp.remove();
  });
  document.body.append(inp); inp.click();
}

/* 圖片欄位（顯示縮圖 + 上傳 + 檔名） */
function imageField(labelText, obj, key, base) {
  const wrap = el("div", { class: "field" }, el("label", {}, labelText));
  const preview = el("img", { class: "thumb", style: "max-width:180px", onerror: "this.style.opacity=.25" });
  const setPrev = () => { preview.src = obj[key] ? `/assets/${obj[key]}?t=${Math.random()}` : ""; preview.style.opacity = obj[key] ? 1 : .25; };
  setPrev();
  const nameInp = bindInput(obj, key, { placeholder: "檔名，例如 office-05.jpg" });
  const set = (fname) => { obj[key] = fname; nameInp.value = fname; setPrev(); };
  const libBtn = el("button", { type: "button", class: "btn btn--dark btn--sm" }, "從圖庫挑");
  libBtn.addEventListener("click", () => openLibrary(set));
  const upBtn = el("button", { type: "button", class: "btn btn--ghost btn--sm" }, "上傳新圖");
  upBtn.addEventListener("click", () => pickAndUpload(base, set));
  wrap.append(preview, el("div", { class: "inline", style: "margin-top:8px;flex-wrap:wrap" }, [nameInp, libBtn, upBtn]));
  return wrap;
}

/* ---- 通用集合管理（最新消息 / 活動紀實） ---- */
function collectionView(cfg) {
  return {
    title: cfg.title,
    actions: () => [
      el("a", { class: "btn btn--ghost btn--sm", href: cfg.base, target: "_blank" }, "🔗 看前台"),
      el("button", { class: "btn btn--gold btn--sm", onclick: async () => {
        try { await api("POST", `/api/${cfg.name}`, cfg.blank()); toast("已新增，請編輯內容"); rerender(); } catch (e) { toast(e.message, true); }
      } }, "＋ 新增"),
    ],
    async render() {
      const items = await api("GET", `/api/admin/${cfg.name}`);
      const box = el("div");
      box.append(el("p", { class: "hint" }, cfg.hint));
      if (!items.length) box.append(el("div", { class: "empty" }, "還沒有內容，點右上角「＋ 新增」開始。"));
      items.forEach((raw) => {
        const it = clone(raw);
        const pub = el("input", { type: "checkbox" }); pub.checked = it.published !== false;
        pub.addEventListener("change", () => (it.published = pub.checked));
        const item = el("div", { class: "item" });
        item.append(el("div", { class: "item__bar" }, [
          el("strong", {}, it.title || "未命名"),
          el("div", { class: "inline" }, [
            el("a", { class: "muted", href: `${cfg.base}/${encodeURIComponent(it.slug)}`, target: "_blank", style: "font-size:12px" }, "預覽"),
            el("label", { class: "inline muted" }, [pub, " 發佈"]),
          ]),
        ]));
        item.append(...cfg.fields(it));
        item.append(el("div", { class: "inline", style: "margin-top:8px" }, [
          el("button", { class: "btn btn--gold btn--sm", onclick: async () => {
            try { await api("PUT", `/api/${cfg.name}/${it.id}`, it); toast("已儲存"); rerender(); } catch (e) { toast(e.message, true); }
          } }, "儲存"),
          el("button", { class: "btn btn--danger btn--sm", onclick: async () => {
            if (!confirm("確定刪除這篇？")) return;
            try { await api("DELETE", `/api/${cfg.name}/${it.id}`); toast("已刪除"); rerender(); } catch (e) { toast(e.message, true); }
          } }, "刪除"),
        ]));
        box.append(item);
      });
      return box;
    },
  };
}

VIEWS.news = collectionView({
  name: "posts", title: "最新消息", base: "/news",
  hint: "撰寫公告、活動預告與觀點文章。內文用「空一行」分段。發佈後會顯示在官網「最新消息」。",
  blank: () => ({ title: "新文章", category: "公告", date: new Date().toISOString().slice(0, 10), excerpt: "", body: "", published: false }),
  fields: (it) => [
    el("div", { class: "row-3" }, [field("標題", bindInput(it, "title")), field("分類", bindInput(it, "category", { placeholder: "公告／觀點／指南" })), field("日期", bindInput(it, "date", { placeholder: "2026-07-01" }))]),
    imageField("封面圖", it, "cover", `post-${it.id}`),
    field("摘要（列表卡片顯示）", bindInput(it, "excerpt", { textarea: true })),
    field("內文（空一行分段）", bindInput(it, "body", { textarea: true })),
  ],
});

VIEWS.chronicles = collectionView({
  name: "chronicles", title: "活動紀實", base: "/chronicle",
  hint: "記錄辦過的活動：封面、多張現場照片與回顧文字。發佈後會顯示在官網「活動紀實」。",
  blank: () => ({ title: "新活動紀實", location: "GUDO Space", date: new Date().toISOString().slice(0, 10), excerpt: "", body: "", gallery: [], published: false }),
  fields: (it) => {
    if (!Array.isArray(it.gallery)) it.gallery = [];
    const gWrap = el("div", { class: "field" }, el("label", {}, "現場照片（相簿）"));
    const grid = el("div", { class: "media-grid", style: "grid-template-columns:repeat(auto-fill,minmax(120px,1fr))" });
    const renderG = () => {
      grid.innerHTML = "";
      it.gallery.forEach((g, i) => {
        grid.append(el("div", {}, [
          el("img", { class: "thumb", src: `/assets/${g}?t=${Math.random()}`, onerror: function () { this.style.opacity = .25; } }),
          el("button", { class: "btn btn--danger btn--sm", style: "margin-top:6px;width:100%", onclick: () => { it.gallery.splice(i, 1); renderG(); } }, "移除"),
        ]));
      });
    };
    renderG();
    const libBtn = el("button", { type: "button", class: "btn btn--dark btn--sm" }, "＋ 從圖庫加入");
    libBtn.addEventListener("click", () => openLibrary((f) => { it.gallery.push(f); renderG(); }));
    const addBtn = el("button", { type: "button", class: "btn btn--ghost btn--sm" }, "＋ 上傳照片");
    addBtn.addEventListener("click", () => pickAndUpload(`chron-${it.id}-${it.gallery.length + 1}`, (f) => { it.gallery.push(f); renderG(); }));
    gWrap.append(grid, el("div", { class: "inline", style: "margin-top:8px" }, [libBtn, addBtn]));
    return [
      el("div", { class: "row-3" }, [field("標題", bindInput(it, "title")), field("地點", bindInput(it, "location")), field("日期", bindInput(it, "date", { placeholder: "2026-06-28" }))]),
      imageField("封面圖", it, "cover", `chron-${it.id}`),
      field("摘要（列表卡片顯示）", bindInput(it, "excerpt", { textarea: true })),
      field("回顧內文（空一行分段）", bindInput(it, "body", { textarea: true })),
      gWrap,
    ];
  },
});

/* =================================================================
   殼層：導覽、切換、登入
   ================================================================= */
async function rerender() {
  const v = VIEWS[state.view];
  $("#view-title").textContent = v.title;
  const actions = $("#view-actions"); actions.innerHTML = "";
  if (v.actions) v.actions().forEach((n) => actions.append(n));
  const host = $("#view"); host.innerHTML = "";
  host.append(el("div", { class: "muted" }, "載入中…"));
  try {
    const node = await v.render();
    host.innerHTML = ""; host.append(node);
  } catch (e) {
    host.innerHTML = ""; host.append(el("div", { class: "empty" }, e.message));
  }
}

function switchView(name) {
  state.view = name;
  document.querySelectorAll("#nav button").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name));
  rerender();
}

async function enterApp(user) {
  state.me = user;
  state.content = await api("GET", "/api/content");
  $("#app").hidden = false;
  $("#me-name").textContent = `${user.name}（${user.role === "owner" ? "擁有者" : "編輯者"}）`;
  document.querySelectorAll("#nav button").forEach((b) => {
    if (!b.dataset.wired) { b.dataset.wired = "1"; b.addEventListener("click", () => switchView(b.dataset.view)); }
  });
  const lo = $("#logout");
  if (!lo.dataset.wired) { lo.dataset.wired = "1"; lo.addEventListener("click", async () => { try { await api("POST", "/api/logout"); } catch (_) {} location.href = "/admin/login"; }); }
  switchView("submissions");
}

// 登入為獨立頁：未登入直接導到 /admin/login
async function boot() {
  let user = null;
  try { user = (await api("GET", "/api/me")).user; } catch (_) { user = null; }
  if (user) { await enterApp(user); }
  else { location.href = "/admin/login"; }
}

boot().catch(() => { location.href = "/admin/login"; });
