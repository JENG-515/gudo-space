/* ===================================================================
   GUDO Space — 共用前台工具與版型（header / footer）
   給子頁面（方案詳情、最新消息、活動紀實）共用，維持一致與正式感。
   =================================================================== */
(function () {
  const G = window.G = {};

  G.esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  G.el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  G.nl2p = (s) => (s || "").split(/\n{2,}/).map((p) => `<p>${G.esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  // 輕量 Markdown：## 標題、### 小標、- 清單、**粗體**、段落（逐行解析，可混排）
  const _bold = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  G.mdToHtml = (s) => {
    const html = []; let para = []; let lst = [];
    const flushP = () => { if (para.length) { html.push(`<p>${_bold(G.esc(para.join("\n")).replace(/\n/g, "<br>"))}</p>`); para = []; } };
    const flushL = () => { if (lst.length) { html.push(`<ul>${lst.map((x) => `<li>${_bold(G.esc(x))}</li>`).join("")}</ul>`); lst = []; } };
    (s || "").split(/\n/).forEach((raw) => {
      const st = raw.trim();
      if (!st) { flushP(); flushL(); return; }
      if (/^###\s+/.test(st)) { flushP(); flushL(); html.push(`<h3>${G.esc(st.replace(/^###\s+/, ""))}</h3>`); }
      else if (/^##\s+/.test(st)) { flushP(); flushL(); html.push(`<h2>${G.esc(st.replace(/^##\s+/, ""))}</h2>`); }
      else if (/^[-•]\s+/.test(st)) { flushP(); lst.push(st.replace(/^[-•]\s+/, "")); }
      else { flushL(); para.push(st); }
    });
    flushP(); flushL();
    return html.join("");
  };
  G.fmtDate = (s) => { if (!s) return ""; const m = String(s).slice(0, 10).split("-"); return m.length === 3 ? `${m[0]}.${m[1]}.${m[2]}` : s; };
  G.qs = (k) => new URLSearchParams(location.search).get(k);
  G.slugFromPath = () => decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");

  G.fetchJSON = async (url) => {
    const res = await fetch(url, { credentials: "same-origin" });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };

  const NAV = [
    { key: "about", label: "關於", href: "/#about" },
    { key: "space", label: "空間", href: "/#space" },
    { key: "plans", label: "方案", href: "/#plans" },
    { key: "chronicle", label: "活動紀實", href: "/chronicle" },
    { key: "news", label: "最新消息", href: "/news" },
    { key: "faq", label: "FAQ", href: "/#faq" },
  ];

  G.renderChrome = async (activeKey) => {
    let c = {};
    try { c = await G.fetchJSON("/api/content"); } catch (_) {}
    const brand = (c.settings && c.settings.brandName) || "GUDO Space";
    const contact = (c.settings && c.settings.contact) || { area: "信義區生活圈", transit: "捷運象山站步行約 3 分鐘" };
    const footer = (c.copy && c.copy.footer) || {};
    const tagline = footer.tagline || "美好生活創業者的共享基地。一起把美好生活，變成人人都能擁有的日常。";
    const copyright = footer.copyright || "© 2026 GUDO Space　·　美好生活創業者的共享基地";

    const navLinks = NAV.map((n) => `<a href="${n.href}" class="${n.key === activeKey ? "is-active" : ""}">${n.label}</a>`).join("");

    // Header
    const header = G.el(`
      <header class="nav" id="top">
        <div class="container nav__inner">
          <a class="brand" href="/" aria-label="${G.esc(brand)} 首頁">
            <img src="/assets/logo.svg" alt="" class="brand__mark" width="34" height="34" />
            <span class="brand__name">${G.esc(brand)}</span>
          </a>
          <nav class="nav__links" aria-label="主選單">${navLinks}</nav>
          <div class="nav__actions">
            <a class="btn btn--gold btn--sm" href="/#booking">預約參觀</a>
            <button class="nav__toggle" id="navToggle" aria-label="開啟選單" aria-expanded="false"><span></span><span></span><span></span></button>
          </div>
        </div>
        <div class="nav__mobile" id="navMobile" hidden>
          ${NAV.map((n) => `<a href="${n.href}">${n.label}</a>`).join("")}
          <a class="btn btn--gold" href="/#booking">預約參觀</a>
        </div>
      </header>`);

    // Footer
    const footerEl = G.el(`
      <footer class="footer section--dark">
        <div class="container footer__grid">
          <div class="footer__brand">
            <a class="brand" href="/"><img src="/assets/logo.svg" alt="" class="brand__mark" width="34" height="34" /><span class="brand__name">${G.esc(brand)}</span></a>
            <p>${G.esc(tagline)}</p>
          </div>
          <div class="footer__col">
            <h4>地點與交通</h4>
            <p>${G.esc(contact.area || "")}</p>
            <p>${G.esc(contact.transit || "")}</p>
          </div>
          <nav class="footer__col" aria-label="網站導覽">
            <h4>網站導覽</h4>
            <a href="/#about">關於 GUDO Space</a>
            <a href="/#plans">會員方案</a>
            <a href="/chronicle">活動紀實</a>
            <a href="/news">最新消息</a>
          </nav>
          <div class="footer__col">
            <h4>開始</h4>
            <a class="btn btn--gold" href="/#booking">預約參觀</a>
          </div>
        </div>
        <div class="footer__bar">
          <div class="container footer__bar-inner">
            <span>${G.esc(copyright)}</span>
            <a href="/admin" class="footer__admin">管理員登入</a>
          </div>
        </div>
      </footer>`);

    const headerMount = document.getElementById("siteHeader");
    const footerMount = document.getElementById("siteFooter");
    if (headerMount) headerMount.replaceWith(header);
    if (footerMount) footerMount.replaceWith(footerEl);

    // 行動選單
    const toggle = document.getElementById("navToggle");
    const mobile = document.getElementById("navMobile");
    if (toggle && mobile) {
      toggle.addEventListener("click", () => {
        const open = mobile.classList.toggle("is-open");
        mobile.hidden = !open;
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
    return c;
  };

  /* ---------- 預約參觀彈窗（可帶入方案） ---------- */
  G.openBooking = async function (content, prefillPlan) {
    if (!content) { try { content = await G.fetchJSON("/api/content"); } catch (_) { content = {}; } }
    const form = content.form || {
      interest: ["彈性會員 3,800 元／月", "自由座會員 5,800 元／月", "固定座會員 7,000 元／月", "置物櫃加購", "大會議室租借", "大教室租借", "活動合作", "還不確定，想先了解"],
      timeline: ["這個月內", "1–2 個月內", "3 個月內", "只是先了解", "想預約參觀後再決定"],
      identity: ["生活服務創業者", "自由工作者／接案者", "講師／顧問", "小型品牌主", "創業團隊", "公司／企業單位", "其他"],
      visit: ["想預約參觀", "否，想先線上了解"],
    };
    const intro = (content.copy || {}).bookingIntro || {};
    const successMsg = intro.success || "感謝您預約 GUDO Space。我們已收到您的資訊，將盡快與您聯繫，協助安排參觀與方案說明。";
    const endpoint = ((content.settings || {}).formEndpoint) || "";

    const chipRow = (id, multi) => `<div class="chips" data-multi="${multi}" id="${id}"></div>`;
    const overlay = G.el(`
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal-panel">
          <button class="modal-close" aria-label="關閉">×</button>
          <div class="modal-body">
            <span class="eyebrow eyebrow--gold">預約參觀</span>
            <h3 class="modal-title">預約參觀 GUDO Space</h3>
            <p class="modal-sub">${prefillPlan ? `想了解「${G.esc(prefillPlan)}」嗎？` : ""}留下資訊，我們會安排專人與您聯繫。</p>
            <form class="form" id="mForm" novalidate>
              <div class="form__row">
                <div class="field"><label>姓名 <span class="req">*</span></label><input id="m-name" type="text" placeholder="您的稱呼" required /></div>
                <div class="field"><label>手機 <span class="req">*</span></label><input id="m-phone" type="tel" placeholder="09xx-xxx-xxx" required /></div>
              </div>
              <div class="form__row">
                <div class="field"><label>Email <span class="opt">選填</span></label><input id="m-email" type="email" placeholder="you@example.com" /></div>
                <div class="field"><label>Line ID <span class="opt">選填</span></label><input id="m-line" type="text" placeholder="您的 Line ID" /></div>
              </div>
              <div class="field"><label>想了解的方案 <span class="req">*</span> <span class="opt">可複選</span></label>${chipRow("m-interest", true)}</div>
              <div class="field"><label>預計使用時間 <span class="opt">選填</span></label>${chipRow("m-timeline", false)}</div>
              <div class="field"><label>身分類型 <span class="opt">可複選</span></label>${chipRow("m-identity", true)}</div>
              <div class="field"><label>是否想預約參觀 <span class="req">*</span></label>${chipRow("m-visit", false)}</div>
              <div class="form__row">
                <div class="field"><label>希望參觀時段 <span class="opt">選填</span></label><input id="m-slot" type="text" placeholder="例如：平日下午、週六上午" /></div>
                <div class="field"><label>備註 <span class="opt">選填</span></label><input id="m-note" type="text" placeholder="想先了解的事情" /></div>
              </div>
              <input type="text" id="m-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;opacity:0" aria-hidden="true" />
              <button type="submit" class="btn btn--gold btn--block">送出預約</button>
              <p class="form__error" id="m-err" hidden></p>
            </form>
            <div class="form-success" id="m-success" hidden>
              <div class="form-success__mark">✓</div>
              <h3>感謝您預約 GUDO Space</h3>
              <p>${G.esc(successMsg)}</p>
            </div>
          </div>
        </div>
      </div>`);

    const q = (s) => overlay.querySelector(s);
    const buildChips = (id, opts, preselect) => {
      const wrap = q("#" + id);
      opts.forEach((opt) => {
        const chip = G.el(`<button type="button" class="chip" aria-pressed="${preselect && opt.includes(preselect) ? "true" : "false"}">${G.esc(opt)}</button>`);
        chip.addEventListener("click", () => {
          if (wrap.dataset.multi !== "true") wrap.querySelectorAll(".chip").forEach((c) => { if (c !== chip) c.setAttribute("aria-pressed", "false"); });
          chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") === "true" ? "false" : "true");
        });
        wrap.append(chip);
      });
    };
    buildChips("m-interest", form.interest, prefillPlan);
    buildChips("m-timeline", form.timeline);
    buildChips("m-identity", form.identity);
    buildChips("m-visit", form.visit);
    const picked = (id) => [...q("#" + id).querySelectorAll('.chip[aria-pressed="true"]')].map((c) => c.textContent.trim());

    const close = () => { overlay.remove(); document.body.style.overflow = ""; };
    q(".modal-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); } });

    q("#mForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = q("#m-err"); err.hidden = true;
      const name = q("#m-name").value.trim(), phone = q("#m-phone").value.trim();
      const interest = picked("m-interest"), visit = picked("m-visit");
      if (!name || !phone || !interest.length || !visit.length) {
        err.textContent = "請填寫姓名、手機，並至少選擇「想了解的方案」與「是否想預約參觀」。"; err.hidden = false; return;
      }
      const payload = { name, phone, email: q("#m-email").value.trim(), line: q("#m-line").value.trim(),
        interest, timeline: picked("m-timeline"), identity: picked("m-identity"), visit,
        slot: q("#m-slot").value.trim(), note: q("#m-note").value.trim(), _hp: q("#m-hp").value };
      const btn = q('#mForm button[type="submit"]'); btn.disabled = true; btn.textContent = "送出中…";
      try {
        let ok = false;
        try { const r = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); ok = r.ok; } catch (_) {}
        if (!ok && endpoint) { const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) }); ok = r.ok; }
        if (!ok && !endpoint) ok = true;
        if (!ok) throw new Error();
        q("#mForm").hidden = true; q("#m-success").hidden = false;
      } catch (_) { err.textContent = "送出時發生問題，請稍後再試。"; err.hidden = false; btn.disabled = false; btn.textContent = "送出預約"; }
    });

    document.body.append(overlay);
    document.body.style.overflow = "hidden";
    q("#m-name").focus();
  };
})();
