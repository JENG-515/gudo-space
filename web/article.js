/* 最新消息文章 / 活動紀實內頁（依 window.PAGE.type 切換） */
(async function () {
  const CFG = {
    news: { endpoint: "/api/posts", base: "/news", active: "news", label: "最新消息" },
    chronicle: { endpoint: "/api/chronicles", base: "/chronicle", active: "chronicle", label: "活動紀實" },
  };
  const cfg = CFG[(window.PAGE || {}).type] || CFG.news;
  await G.renderChrome(cfg.active);
  const root = document.getElementById("articleRoot");
  const slug = G.slugFromPath();

  let item = null;
  try { item = await G.fetchJSON(`${cfg.endpoint}/${encodeURIComponent(slug)}`); } catch (_) { item = null; }

  if (!item) {
    root.innerHTML = `<div class="empty-state"><h2 class="heading">找不到這篇內容</h2><p><a class="btn btn--dark" href="${cfg.base}">返回${cfg.label}</a></p></div>`;
    return;
  }

  document.title = `${item.title}｜GUDO Space`;
  // SEO：meta description + canonical
  const setMeta = (attr, key, val) => {
    let m = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!m) { m = document.createElement("meta"); m.setAttribute(attr, key); document.head.appendChild(m); }
    m.setAttribute("content", val);
  };
  if (item.excerpt) { setMeta("name", "description", item.excerpt); setMeta("property", "og:description", item.excerpt); }
  setMeta("property", "og:title", item.title + "｜GUDO Space");
  let canon = document.head.querySelector('link[rel="canonical"]');
  if (!canon) { canon = document.createElement("link"); canon.rel = "canonical"; document.head.appendChild(canon); }
  canon.href = location.origin + cfg.base + "/" + encodeURIComponent(item.slug);

  const meta = cfg.active === "news"
    ? `<span>${G.fmtDate(item.date)}</span>${item.category ? `<span class="pcard__cat">${G.esc(item.category)}</span>` : ""}`
    : `<span>${G.fmtDate(item.date)}</span>${item.location ? `<span>📍 ${G.esc(item.location)}</span>` : ""}`;

  const cover = item.cover
    ? `<div class="article__cover"><div class="media" data-label="${G.esc(item.title)}"><img src="/assets/${G.esc(item.cover)}" alt="${G.esc(item.title)}" onerror="this.remove()" /></div></div>` : "";

  const gallery = (cfg.active === "chronicle" && item.gallery && item.gallery.length)
    ? `<div class="pd__section" style="margin-top:44px"><h2>現場紀錄</h2><div class="gallery">${item.gallery.map((g) =>
        `<div class="media" data-label="${G.esc(item.title)}"><img src="/assets/${G.esc(g)}" alt="${G.esc(item.title)}" onerror="this.remove()" /></div>`).join("")}</div></div>` : "";

  root.innerHTML = `
    <article class="article">
      <nav class="breadcrumb"><a href="/">首頁</a><span>›</span><a href="${cfg.base}">${cfg.label}</a><span>›</span>${G.esc(item.title)}</nav>
      <div class="article__meta">${meta}</div>
      <h1 class="article__title">${G.esc(item.title)}</h1>
      ${cover}
      <div class="article__body">${G.mdToHtml(item.body || item.excerpt || "")}</div>
      ${gallery}
      <div class="article__foot"><a class="btn btn--dark" href="${cfg.base}">← 返回${cfg.label}</a></div>
    </article>`;
})();
