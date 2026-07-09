/* 方案完整介紹頁（產品頁風格） */
(async function () {
  const STATUS = { open: ["開放預約", "status-open"], wait: ["候補中", "status-wait"], full: ["已額滿", "status-full"] };
  const content = await G.renderChrome("plans");
  const root = document.getElementById("planRoot");
  const slug = G.slugFromPath();
  const plans = (content && content.plans) || [];
  const plan = plans.find((p) => p.slug === slug) || plans.find((p) => G.esc(p.name) === slug);
  const L = (content.copy && content.copy.planDetail) || {};

  if (!plan) {
    root.innerHTML = `<div class="empty-state"><h2 class="heading">找不到這個方案</h2><p><a class="btn btn--dark" href="/#plans">返回會員方案</a></p></div>`;
    return;
  }

  document.title = `${plan.name}｜GUDO Space`;
  const [statusLabel, statusClass] = STATUS[plan.status] || STATUS.open;
  const gallery = plan.gallery && plan.gallery.length ? plan.gallery : [];
  const heroImg = gallery[0] || "";

  const mediaHTML = (file, label) =>
    `<div class="media" data-label="${G.esc(label)}">${file ? `<img src="/assets/${G.esc(file)}" alt="${G.esc(label)}" onerror="this.remove()" />` : ""}</div>`;

  const section = (title, inner) => title && inner ? `<div class="pd__section"><h2>${G.esc(title)}</h2>${inner}</div>` : "";
  const listUL = (arr, cls) => arr && arr.length ? `<ul class="${cls}">${arr.map((x) => `<li>${G.esc(x)}</li>`).join("")}</ul>` : "";

  const faqHTML = (plan.faq && plan.faq.length) ? `
    <div class="pd__section">
      <h2>${G.esc(L.faqTitle || "方案常見問題")}</h2>
      <div class="faq">${plan.faq.map((f) => `
        <div class="faq__item">
          <button class="faq__q"><span>${G.esc(f.q)}</span><span class="faq__icon">+</span></button>
          <div class="faq__a"><div class="faq__a-inner">${G.esc(f.a)}</div></div>
        </div>`).join("")}</div>
    </div>` : "";

  const galleryHTML = gallery.length ? `
    <div class="pd__section">
      <h2>${G.esc(L.galleryTitle || "空間實景")}</h2>
      <div class="gallery">${gallery.map((g) => mediaHTML(g, plan.name)).join("")}</div>
    </div>` : "";

  root.innerHTML = `
    <nav class="breadcrumb"><a href="/">首頁</a><span>›</span><a href="/#plans">會員方案</a><span>›</span>${G.esc(plan.name)}</nav>

    <section class="pd">
      <div class="pd__top">
        <div class="pd__info">
          ${plan.featured ? '<span class="pd__flag">熱門方案</span>' : ""}
          <h1 class="pd__name">${G.esc(plan.name)}</h1>
          ${plan.tagline ? `<p class="pd__tagline">${G.esc(plan.tagline)}</p>` : ""}
          <div class="pd__price">${G.esc(plan.price)} <span>元／月</span></div>
          <div><span class="pd__status ${statusClass}"><span class="dot"></span>${statusLabel}</span></div>
          <p class="pd__lead">${G.esc(plan.desc || "")}</p>
          <div class="pd__cta">
            <button type="button" class="btn btn--gold js-book">${G.esc(L.cta || "預約參觀")}</button>
            <a class="btn btn--dark" href="/#plans">${G.esc(L.back || "返回所有方案")}</a>
          </div>
        </div>
        <div class="pd__media">${mediaHTML(heroImg, plan.name + " 空間")}</div>
      </div>

      <div class="pd__body">
        <div class="pd__main">
          ${section("方案介紹", G.nl2p((plan.longDesc || []).join("\n\n")))}
          ${section(L.includesTitle || "方案包含", listUL(plan.includes, "pd__list"))}
          ${section(L.suitableTitle || "適合這樣的你", listUL(plan.suitableFor, "pd__list"))}
          ${galleryHTML}
          ${section(L.notesTitle || "使用須知", listUL(plan.notes, "notes"))}
          ${faqHTML}
        </div>
        <aside class="pd__aside">
          <h3>${G.esc(plan.name)}</h3>
          <span class="pd__status ${statusClass}"><span class="dot"></span>${statusLabel}</span>
          <div class="pd__price">${G.esc(plan.price)} <span>元／月</span></div>
          <button type="button" class="btn btn--gold js-book" style="width:100%">${G.esc(L.cta || "預約參觀")}</button>
          <p class="muted">預約後由專人帶你參觀，並依需求說明方案細節。</p>
        </aside>
      </div>
    </section>`;

  // 預約參觀 → 跳出表單並帶入本方案
  root.querySelectorAll(".js-book").forEach((b) => b.addEventListener("click", () => G.openBooking(content, plan.name)));

  // FAQ 手風琴
  root.querySelectorAll(".faq__q").forEach((btn) => {
    const item = btn.closest(".faq__item"); const ans = item.querySelector(".faq__a");
    btn.addEventListener("click", () => {
      const open = item.classList.toggle("is-open");
      ans.style.maxHeight = open ? ans.scrollHeight + "px" : 0;
    });
  });
})();
