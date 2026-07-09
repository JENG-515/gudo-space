/* 最新消息 / 活動紀實 — 列表頁（依 window.PAGE.type 切換） */
(async function () {
  const CFG = {
    news: { endpoint: "/api/posts", base: "/news", active: "news", introKey: "newsIntro", more: "閱讀更多" },
    chronicle: { endpoint: "/api/chronicles", base: "/chronicle", active: "chronicle", introKey: "chronicleIntro", more: "看紀實" },
  };
  const cfg = CFG[(window.PAGE || {}).type] || CFG.news;
  const content = await G.renderChrome(cfg.active);
  const intro = (content.copy && content.copy[cfg.introKey]) || {};
  const root = document.getElementById("listRoot");

  let items = [];
  try { items = await G.fetchJSON(cfg.endpoint); } catch (_) { items = []; }

  const head = `
    <div class="page-head">
      <span class="eyebrow">${G.esc(intro.eyebrow || "")}</span>
      <h1 class="display display--sm">${G.esc(intro.title || "")}</h1>
      <p class="section__sub">${G.esc(intro.sub || "")}</p>
    </div>`;

  if (!items.length) {
    root.innerHTML = head + `<div class="empty-state">內容籌備中，敬請期待。</div>`;
    return;
  }

  const media = (file, label) =>
    `<div class="pcard__media"><div class="media" data-label="${G.esc(label)}">${file ? `<img src="/assets/${G.esc(file)}" alt="${G.esc(label)}" onerror="this.remove()" />` : ""}</div></div>`;

  const cards = items.map((it) => {
    const meta = cfg.active === "news"
      ? `<span>${G.fmtDate(it.date)}</span>${it.category ? `<span class="pcard__cat">${G.esc(it.category)}</span>` : ""}`
      : `<span>${G.fmtDate(it.date)}</span>${it.location ? `<span>${G.esc(it.location)}</span>` : ""}`;
    return `
      <a class="pcard" href="${cfg.base}/${encodeURIComponent(it.slug)}">
        ${media(it.cover, it.title)}
        <div class="pcard__body">
          <div class="pcard__meta">${meta}</div>
          <h2 class="pcard__title">${G.esc(it.title)}</h2>
          <p class="pcard__excerpt">${G.esc(it.excerpt || "")}</p>
          <span class="pcard__more">${cfg.more} →</span>
        </div>
      </a>`;
  }).join("");

  root.innerHTML = head + `<section class="section section--tight" style="padding-top:24px"><div class="card-grid">${cards}</div></section>`;
})();
