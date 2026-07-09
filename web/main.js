/* ===================================================================
   GUDO Space — 前台
   內容由後台 API 提供：GET /api/content。
   若 API 無法連線（例如純靜態部署），退回 DEFAULTS，網站仍可運作。
   =================================================================== */

/* 離線／靜態後備內容（與 data/content.json 同步的一份預設值） */
const DEFAULTS = {
  settings: { brandName: "GUDO Space", formEndpoint: "", contact: { area: "信義區生活圈", transit: "捷運象山站步行約 3 分鐘" } },
  copy: {},
  personas: [
    { n: "01", t: "生活服務創業者", d: "整理收納、清潔、搬家、居家維修、代租代管、銀髮服務、家務協助、寵物服務、空間服務等領域的創業者。" },
    { n: "02", t: "自由工作者與接案者", d: "設計師、攝影師、行銷人、顧問、講師、教練、社群經營者、內容創作者。" },
    { n: "03", t: "小型品牌主", d: "正在經營個人品牌、課程品牌、服務品牌、生活選品、在地服務的人。" },
    { n: "04", t: "想從專業工作者變成經營者的人", d: "不只是會做服務，也想學會接案、定價、行銷、管理、合作與擴張的人。" },
    { n: "05", t: "相信共好的人", d: "願意交流資源、互相推薦、一起辦活動、一起讓產業變得更成熟的人。" },
  ],
  stats: [
    { num: "3 分", label: "捷運象山站步行" }, { num: "22", label: "可出租席位" },
    { num: "16–18", label: "固定座席次" }, { num: "12", label: "吧台座位" },
  ],
  spaces: [
    { t: "固定座區", d: "提供固定座會員長期使用，建議開放 16–18 席，維持舒適不擁擠的工作環境。" },
    { t: "吧台區", d: "約 12 張椅子，提供自由座、彈性會員與臨時工作者入座。" },
    { t: "公共空間", d: "交流、簡易會談、休息與臨時工作，非固定課程或活動時間可供會員使用。" },
    { t: "大會議室", d: "會員會議、客戶洽談與團隊討論。固定座會員每月可登記使用 2 小時。" },
    { t: "大教室", d: "課程、講座、說明會、活動與培訓使用。會員享優惠價，非會員可依檔期租借。" },
  ],
  plans: [
    { name: "彈性會員", price: "3,800", status: "open", desc: "每月可使用 8 天公共座位／吧台席，不固定座位。適合偶爾需要工作空間、每週約來 1–2 次的人。", feats: ["每月 8 天使用權", "使用公共座位／吧台席", "Wi-Fi", "公共空間使用", "可參加社群活動", "大教室會員價租借"] },
    { name: "自由座會員", price: "5,800", status: "wait", desc: "平日不限次數使用公共座位／吧台席，不固定座位。適合常常需要工作空間，但還不需要固定桌位的人。", feats: ["平日不限次數使用", "使用公共座位／吧台席", "Wi-Fi", "公共空間使用", "可參加社群活動", "大教室會員價租借"] },
    { name: "固定座會員", price: "7,000", status: "open", featured: true, desc: "擁有一個固定工作座位，適合每天需要穩定辦公環境的人。", feats: ["專屬固定座位", "大會議室每月可登記 2 小時", "Wi-Fi", "公共空間使用", "可參加社群活動", "大教室會員價租借", "可加購個人置物櫃"] },
  ],
  rentals: [
    { title: "大會議室", sub: "適合會議、客戶洽談、團隊討論。", rows: [{ k: "固定座會員", v: "每月登記 2 小時" }, { k: "會員加購", v: "500 元／小時" }, { k: "非會員租借", v: "800 元／小時" }] },
    { title: "大教室", sub: "適合課程、講座、工作坊、說明會。", rows: [{ k: "會員價", v: "1,500–2,000 元／小時" }, { k: "非會員價", v: "2,500–3,000 元／小時" }, { k: "半日／全日", v: "6,000–8,000 / 10,000–15,000" }] },
  ],
  availability: [
    { name: "固定座會員", open: "開放名額 16–18 席", status: "open" },
    { name: "自由座會員", open: "開放名額 4–6 名", status: "wait" },
    { name: "彈性會員", open: "開放名額 6–8 名", status: "open" },
  ],
  eventTypes: [
    { icon: "🌱", t: "生活服務創業分享", d: "邀請整理收納、清潔、搬家、銀髮服務、空間設計等領域創業者分享實戰經驗。" },
    { icon: "🤝", t: "自由工作者交流會", d: "讓設計師、行銷人、顧問、講師、內容創作者認識彼此，交換接案與合作經驗。" },
    { icon: "✳️", t: "小型品牌工作坊", d: "協助小型品牌主釐清定位、定價、行銷、銷售與顧客經營。" },
    { icon: "🌿", t: "GUDO 生活服務社群活動", d: "圍繞「美好生活，人人都可以擁有」的理念，串聯更多生活服務相關夥伴。" },
    { icon: "📚", t: "課程與講座", d: "提供講師、品牌主舉辦課程與講座的場域，讓會員有更多學習與曝光機會。" },
  ],
  events: [
    { tag: "交流會", fee: "會員免費", title: "生活服務創業交流夜", date: "近期公告", time: "19:00–21:00", place: "GUDO Space", target: "適合創業者與自由工作者", active: true },
    { tag: "工作坊", fee: "付費", title: "小型品牌定位工作坊", date: "近期公告", time: "14:00–17:00", place: "GUDO Space", target: "適合小型品牌主與接案者", active: true },
  ],
  faq: [
    { q: "GUDO Space 是一般共享辦公室嗎？", a: "GUDO Space 提供共享工作空間、固定座、自由座、會議室與活動空間，但我們不只是一個出租座位的空間。我們更希望成為生活服務創業者、自由工作者、講師、顧問與小型品牌主的交流基地。", open: true },
    { q: "固定座、自由座、彈性會員有什麼不同？", a: "固定座會員有專屬固定座位，適合每天需要穩定辦公的人。自由座會員可平日不限次數使用公共座位與吧台席，但不固定座位。彈性會員每月可使用 8 天，適合偶爾需要工作空間的人。" },
    { q: "自由座與彈性會員一定有位置嗎？", a: "自由座與彈性會員使用公共座位與吧台席，不保證固定座位。我們會控制會員數量，盡量維持舒適使用品質。" },
    { q: "可以公司登記嗎？", a: "第一版建議不要先主打公司登記，避免增加管理與法務成本。若未來開放，將另設公司登記／通訊地址服務（另洽）。" },
    { q: "可以租借大教室辦活動嗎？", a: "可以。大教室適合課程、講座、說明會、工作坊、品牌活動與社群聚會。會員可享優惠價，非會員可依檔期申請租借。" },
    { q: "會員可以使用大會議室嗎？", a: "固定座會員每月可登記使用大會議室 2 小時。自由座會員與彈性會員如需使用會議室，可另行加購。" },
    { q: "可以先參觀再決定嗎？", a: "可以。歡迎先填寫預約表單，我們會協助安排參觀與方案說明。" },
    { q: "適合什麼樣的人加入？", a: "GUDO Space 適合生活服務創業者、自由工作者、講師、顧問、接案者、小型品牌主與正在創業路上的朋友。如果你相信生活可以更好，也希望認識更多正在創造美好生活服務的人，這裡會很適合你。" },
  ],
  form: {
    interest: ["彈性會員 3,800 元／月", "自由座會員 5,800 元／月", "固定座會員 7,000 元／月", "置物櫃加購", "大會議室租借", "大教室租借", "活動合作", "還不確定，想先了解"],
    timeline: ["這個月內", "1–2 個月內", "3 個月內", "只是先了解", "想預約參觀後再決定"],
    identity: ["生活服務創業者", "自由工作者／接案者", "講師／顧問", "小型品牌主", "創業團隊", "公司／企業單位", "其他"],
    visit: ["想預約參觀", "否，想先線上了解"],
  },
};

const STATUS_LABEL = { open: "開放預約", wait: "候補中", full: "已額滿" };

const $ = (sel) => document.querySelector(sel);
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nl2br = (s) => esc(s).replace(/\n/g, "<br />");
const setText = (id, val) => { const n = $("#" + id); if (n && val != null) n.textContent = val; };
const setHTML = (id, val) => { const n = $("#" + id); if (n && val != null) n.innerHTML = val; };
const setImg = (id, file) => { const n = $("#" + id); if (n && file) { n.src = "assets/" + file; n.style.display = ""; } };

let C = DEFAULTS;

async function loadContent() {
  try {
    const res = await fetch("/api/content", { credentials: "same-origin" });
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data && Object.keys(data).length) C = mergeDefaults(data);
  } catch (_) { /* 保持 DEFAULTS */ }
}
function mergeDefaults(data) {
  const out = Object.assign({}, DEFAULTS, data);
  out.settings = Object.assign({}, DEFAULTS.settings, data.settings || {});
  out.copy = data.copy || {};
  out.form = Object.assign({}, DEFAULTS.form, data.form || {});
  return out;
}

/* ---------- 套用頁面文案 ---------- */
function applyCopy() {
  const c = C.copy || {};
  if (c.hero) {
    setText("c-hero-tag", c.hero.tag); setHTML("c-hero-title", nl2br(c.hero.title));
    setText("c-hero-lede", c.hero.lede); setText("c-hero-text", c.hero.text); setText("c-hero-meta", c.hero.meta);
    setImg("hero-img", c.hero.image);
  }
  if (c.about) {
    setText("c-about-eyebrow", c.about.eyebrow); setHTML("c-about-title", nl2br(c.about.title));
    const body = (c.about.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("") +
      (c.about.lead ? `<p class="prose__lead">${esc(c.about.lead)}</p>` : "");
    if (body) setHTML("c-about-body", body);
  }
  if (c.diff) {
    setText("c-diff-eyebrow", c.diff.eyebrow); setHTML("c-diff-title", nl2br(c.diff.title));
    if (c.diff.paragraphs) setHTML("c-diff-body", c.diff.paragraphs.map((p) => `<p>${esc(p)}</p>`).join(""));
    setImg("diff-img", c.diff.image);
  }
  if (c.space) {
    setText("c-space-eyebrow", c.space.eyebrow); setHTML("c-space-title", nl2br(c.space.title));
    if (c.space.paragraphs) setHTML("c-space-body", c.space.paragraphs.map((p) => `<p>${esc(p)}</p>`).join(""));
  }
  if (c.personasIntro) { setText("c-personas-eyebrow", c.personasIntro.eyebrow); setHTML("c-personas-title", nl2br(c.personasIntro.title)); }
  if (c.plansIntro) { setText("c-plans-eyebrow", c.plansIntro.eyebrow); setText("c-plans-title", c.plansIntro.title); setText("c-plans-sub", c.plansIntro.sub); }
  if (c.availIntro) { setText("c-avail-eyebrow", c.availIntro.eyebrow); setText("c-avail-title", c.availIntro.title); setText("c-avail-sub", c.availIntro.sub); setText("c-avail-note", c.availIntro.note); }
  if (c.eventsIntro) { setText("c-events-eyebrow", c.eventsIntro.eyebrow); setText("c-events-title", c.eventsIntro.title); setText("c-events-sub", c.eventsIntro.sub); }
  if (c.bookingIntro) { setText("c-booking-eyebrow", c.bookingIntro.eyebrow); setText("c-booking-title", c.bookingIntro.title); setText("c-booking-sub", c.bookingIntro.sub); setText("c-booking-success", c.bookingIntro.success); }
  if (c.brandsIntro) { setText("c-brands-eyebrow", c.brandsIntro.eyebrow); setText("c-brands-title", c.brandsIntro.title); setText("c-brands-sub", c.brandsIntro.sub); }
  if (c.footer) { setText("c-footer-tagline", c.footer.tagline); setText("c-footer-copyright", c.footer.copyright); }
  if (C.settings && C.settings.contact) { setText("c-footer-area", C.settings.contact.area); setText("c-footer-transit", C.settings.contact.transit); }
}

/* ---------- 渲染各區塊 ---------- */
function render() {
  $("#personas").append(...C.personas.map((p) => el(`
    <article class="persona"><div class="persona__num">${esc(p.n)}</div>
      <h3 class="persona__title">${esc(p.t)}</h3><p class="persona__desc">${esc(p.d)}</p></article>`)));

  $("#stats").append(...C.stats.map((s) => el(`
    <div class="stat"><div class="stat__num">${esc(s.num)}</div><div class="stat__label">${esc(s.label)}</div></div>`)));

  $("#spaces").append(...C.spaces.map((s, i) => el(`
    <article class="space-card">
      <div class="media" data-label="${esc(s.t)}"><img src="assets/${esc(s.image || ('space-' + (i + 2) + '.jpg'))}" alt="${esc(s.t)}" onerror="this.remove()" /></div>
      <div class="space-card__body"><h3 class="space-card__title">${esc(s.t)}</h3><p class="space-card__desc">${esc(s.d)}</p></div>
    </article>`)));

  $("#plans-grid").append(...C.plans.map((p) => {
    const url = `/plan/${encodeURIComponent(p.slug || "")}`;
    return el(`
    <article class="plan ${p.featured ? "plan--featured" : ""}">
      ${p.featured ? '<span class="plan__flag">熱門</span>' : ""}
      <h3 class="plan__name"><a href="${url}" style="color:inherit">${esc(p.name)}</a></h3>
      <div class="plan__price">${esc(p.price)} <span>元／月</span></div>
      <p class="plan__desc">${esc(p.desc)}</p>
      <span class="plan__status status-${p.status}"><span class="dot"></span>${STATUS_LABEL[p.status] || ""}</span>
      <ul class="plan__feats">${(p.feats || []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <a class="plan__detail-link" href="${url}">查看完整介紹 →</a>
      <a class="btn ${p.featured ? "btn--gold" : "btn--dark"}" href="#booking">預約參觀</a>
    </article>`);
  }));

  $("#rentals").append(...C.rentals.map((r) => el(`
    <article class="rental"><h3 class="rental__title">${esc(r.title)}</h3><p class="rental__sub">${esc(r.sub)}</p>
      ${(r.rows || []).map((row) => `<div class="rental__row"><span>${esc(row.k)}</span><b>${esc(row.v)}</b></div>`).join("")}</article>`)));

  $("#avail").append(...C.availability.map((a) => el(`
    <div class="avail__row"><div class="avail__info"><h4>${esc(a.name)}</h4><p>${esc(a.open)}</p></div>
      <span class="avail__status status-${a.status}"><span class="dot"></span>${STATUS_LABEL[a.status] || ""}</span></div>`)));

  $("#event-types").append(...C.eventTypes.map((e) => el(`
    <article class="etype"><div class="etype__icon">${esc(e.icon)}</div>
      <h3 class="etype__title">${esc(e.t)}</h3><p class="etype__desc">${esc(e.d)}</p></article>`)));

  const events = C.events.filter((e) => e.active !== false);
  const evHost = $("#events-list");
  if (events.length) {
    evHost.append(...events.map((e) => el(`
      <article class="event">
        <div class="event__top"><span class="event__tag">${esc(e.tag)}</span><span class="event__fee">${esc(e.fee)}</span></div>
        <h3 class="event__title">${esc(e.title)}</h3>
        <div class="event__meta"><span data-i="🕒">${esc(e.time)}</span><span data-i="📍">${esc(e.place)}</span><span data-i="👥">${esc(e.target)}</span></div>
        <div class="event__foot"><span class="event__date">${esc(e.date)}</span><a class="btn btn--dark btn--sm" href="#booking">立即報名</a></div>
      </article>`)));
  } else {
    evHost.closest(".section").querySelector(".subhead").insertAdjacentElement("afterend",
      el('<p class="section__sub">近期活動籌備中，敬請期待。</p>'));
  }

  // FAQ 手風琴
  const faqList = $("#faq-list");
  C.faq.forEach((item) => {
    const node = el(`
      <div class="faq__item ${item.open ? "is-open" : ""}">
        <button class="faq__q" aria-expanded="${item.open ? "true" : "false"}"><span>${esc(item.q)}</span><span class="faq__icon">+</span></button>
        <div class="faq__a"><div class="faq__a-inner">${esc(item.a)}</div></div>
      </div>`);
    const btn = node.querySelector(".faq__q");
    const ans = node.querySelector(".faq__a");
    if (item.open) requestAnimationFrame(() => (ans.style.maxHeight = ans.scrollHeight + "px"));
    btn.addEventListener("click", () => {
      const isOpen = node.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
      ans.style.maxHeight = isOpen ? ans.scrollHeight + "px" : 0;
    });
    faqList.append(node);
  });
  window.addEventListener("resize", () => {
    document.querySelectorAll(".faq__item.is-open .faq__a").forEach((a) => { a.style.maxHeight = a.scrollHeight + "px"; });
  });

  // 表單 chips
  buildChips("#chips-interest", C.form.interest);
  buildChips("#chips-timeline", C.form.timeline);
  buildChips("#chips-identity", C.form.identity);
  buildChips("#chips-visit", C.form.visit);
}

function buildChips(id, options) {
  const wrap = $(id);
  (options || []).forEach((opt) => {
    const chip = el(`<button type="button" class="chip" aria-pressed="false">${esc(opt)}</button>`);
    chip.addEventListener("click", () => {
      const multi = wrap.dataset.multi === "true";
      if (!multi) wrap.querySelectorAll(".chip").forEach((c) => { if (c !== chip) c.setAttribute("aria-pressed", "false"); });
      chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") === "true" ? "false" : "true");
    });
    wrap.append(chip);
  });
}
function selectedChips(id) {
  return [...$(id).querySelectorAll('.chip[aria-pressed="true"]')].map((c) => c.textContent.trim());
}

/* ---------- 表單送出 ---------- */
function wireForm() {
  const form = $("#bookingForm");
  const errorBox = $("#formError");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;

    const name = $("#f-name").value.trim();
    const phone = $("#f-phone").value.trim();
    const interest = selectedChips("#chips-interest");
    const visit = selectedChips("#chips-visit");
    if (!name || !phone || interest.length === 0 || visit.length === 0) {
      errorBox.textContent = "請填寫姓名、手機，並至少選擇「想了解的方案」與「是否想預約參觀」。";
      errorBox.hidden = false;
      errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const payload = {
      name, phone,
      email: $("#f-email").value.trim(), line: $("#f-line").value.trim(),
      interest, timeline: selectedChips("#chips-timeline"), identity: selectedChips("#chips-identity"),
      visit, slot: $("#f-slot").value.trim(), note: $("#f-note").value.trim(),
      _hp: $("#f-hp").value,
    };

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "送出中…";
    try {
      let ok = false;
      // 1) 後台 API
      try {
        const res = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        ok = res.ok;
      } catch (_) { ok = false; }
      // 2) 後備：外部收單網址（純靜態部署時）
      if (!ok && C.settings && C.settings.formEndpoint) {
        const res = await fetch(C.settings.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
        ok = res.ok;
      }
      if (!ok && !(C.settings && C.settings.formEndpoint)) {
        // 3) 皆無：仍顯示成功（示範），並印出資料
        console.log("[GUDO Space] 表單資料（未連線後台）：", payload);
        ok = true;
      }
      if (!ok) throw new Error();
      form.hidden = true;
      const okBox = $("#formSuccess");
      okBox.hidden = false;
      okBox.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (_) {
      errorBox.textContent = "送出時發生問題，請稍後再試，或直接與我們聯繫。";
      errorBox.hidden = false;
      btn.disabled = false; btn.textContent = "送出預約";
    }
  });
}

/* ---------- 行動選單 ---------- */
function wireNav() {
  const toggle = $("#navToggle");
  const mobile = $("#navMobile");
  toggle.addEventListener("click", () => {
    const open = mobile.classList.toggle("is-open");
    mobile.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  mobile.addEventListener("click", (e) => {
    if (e.target.tagName === "A") { mobile.classList.remove("is-open"); mobile.hidden = true; toggle.setAttribute("aria-expanded", "false"); }
  });
}

/* ---------- 首頁最新消息 ---------- */
async function renderHomeNews() {
  if (C.sections && C.sections.homeNews === false) return;
  const hn = C.copy && C.copy.homeNews;
  if (hn) {
    setText("c-homenews-eyebrow", hn.eyebrow); setText("c-homenews-title", hn.title); setText("c-homenews-sub", hn.sub);
    if (hn.more) $("#c-homenews-more").textContent = hn.more + " →";
  }
  let posts = [];
  try { const r = await fetch("/api/posts"); if (r.ok) posts = await r.json(); } catch (_) {}
  if (!posts.length) return;
  const grid = $("#home-news-grid");
  const fmt = (s) => (s || "").slice(0, 10).replace(/-/g, ".");
  grid.append(...posts.slice(0, 3).map((p) => el(`
    <a class="pcard" href="/news/${encodeURIComponent(p.slug)}">
      <div class="pcard__media"><div class="media" data-label="${esc(p.title)}">${p.cover ? `<img src="/assets/${esc(p.cover)}" alt="${esc(p.title)}" onerror="this.remove()" />` : ""}</div></div>
      <div class="pcard__body">
        <div class="pcard__meta"><span>${fmt(p.date)}</span>${p.category ? `<span class="pcard__cat">${esc(p.category)}</span>` : ""}</div>
        <h3 class="pcard__title">${esc(p.title)}</h3>
        <p class="pcard__excerpt">${esc(p.excerpt || "")}</p>
        <span class="pcard__more">閱讀更多 →</span>
      </div>
    </a>`)));
  $("#home-news").hidden = false;
}

/* 區塊顯示／隱藏 */
function applySections() {
  const sec = C.sections || {};
  document.querySelectorAll("[data-sec]").forEach((el) => {
    if (sec[el.dataset.sec] === false) el.hidden = true;
  });
}

/* 進駐品牌 */
function renderBrands() {
  const sec = C.sections || {};
  const brands = (C.brands || []).filter((b) => b.enabled !== false);
  if (sec.brands === false || !brands.length) return;
  const grid = $("#brands-grid");
  grid.append(...brands.map((b) => {
    const inner = `
      <div class="brand-card__logo">${b.logo ? `<img src="assets/${esc(b.logo)}" alt="${esc(b.name)}" onerror="this.parentNode.textContent='${esc(b.name)}'" />` : esc(b.name)}</div>
      ${b.name ? `<div class="brand-card__name">${esc(b.name)}</div>` : ""}
      ${b.desc ? `<div class="brand-card__desc">${esc(b.desc)}</div>` : ""}`;
    return b.url
      ? el(`<a class="brand-card" href="${esc(b.url)}" target="_blank" rel="noopener">${inner}</a>`)
      : el(`<div class="brand-card">${inner}</div>`);
  }));
  $("#brands-section").hidden = false;
}

/* 自訂區塊 */
function renderCustomBlocks() {
  const sec = C.sections || {};
  if (sec.customBlocks === false) return;
  const host = $("#custom-blocks");
  (C.customBlocks || []).filter((b) => b.enabled !== false).forEach((b) => {
    const dark = b.theme === "dark";
    const paras = (b.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join("");
    const media = b.image ? `<div class="split__media"><div class="media"><img src="assets/${esc(b.image)}" alt="${esc(b.title || "")}" onerror="this.style.display='none'" /></div></div>` : "";
    const hasImg = b.image && b.imagePos !== "none";
    let inner;
    if (hasImg) {
      const copy = `<div class="split__copy">
          ${b.eyebrow ? `<span class="eyebrow ${dark ? "eyebrow--gold" : ""}">${esc(b.eyebrow)}</span>` : ""}
          ${b.title ? `<h2 class="heading">${nl2br(b.title)}</h2>` : ""}${paras}</div>`;
      inner = `<div class="container split">${b.imagePos === "left" ? media + copy : copy + media}</div>`;
    } else {
      inner = `<div class="container narrow center">
          ${b.eyebrow ? `<span class="eyebrow ${dark ? "eyebrow--gold" : ""}">${esc(b.eyebrow)}</span>` : ""}
          ${b.title ? `<h2 class="display">${nl2br(b.title)}</h2>` : ""}
          <div class="prose center">${paras}</div></div>`;
    }
    host.append(el(`<section class="section ${dark ? "section--dark" : "section--cream"}">${inner}</section>`));
  });
}

/* 從方案詳情頁帶入的 ?plan= 預選對應方案 */
function preselectPlanFromQuery() {
  const planName = new URLSearchParams(location.search).get("plan");
  if (!planName) return;
  const chips = document.querySelectorAll("#chips-interest .chip");
  for (const c of chips) {
    if (c.textContent.includes(planName)) { c.setAttribute("aria-pressed", "true"); break; }
  }
}

/* ---------- 啟動 ---------- */
(async function init() {
  await loadContent();
  applyCopy();
  render();
  wireForm();
  wireNav();
  applySections();
  renderBrands();
  renderCustomBlocks();
  preselectPlanFromQuery();
  renderHomeNews();
})();
