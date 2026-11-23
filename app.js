/* =====================================================================
   OtakuOriginals — app logic
   Cart (localStorage), filters, search, sort, modals, scroll reveal,
   and the WhatsApp order formatter. Store data lives in products.js.
   ===================================================================== */

(function () {
  "use strict";

  /* ---------- Helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const altText = (p) => p.name + " – " + p.category.toLowerCase() + " online in India | OtakuOriginals";
  const discount = (p) => (p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0);
  const FALLBACK_IMG = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" fill="#999" font-family="sans-serif" font-size="28" text-anchor="middle">OtakuOriginals</text></svg>'
  );
  const CART_KEY = "otakuoriginals_cart_v1";

  /* ---------- State ---------- */
  const state = { category: "All", sort: "featured", query: "", cart: loadCart(), lastOrderText: "" };

  function loadCart() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY)) || [];
      // shape check only. Items are matched to the catalogue after products finish loading (pruneCart)
      return raw.filter((i) => i && +i.qty > 0 && Number.isFinite(+i.id)).map((i) => ({ id: +i.id, qty: Math.min(+i.qty, 20) }));
    } catch (e) { return []; }
  }
  function saveCart() {
    touchActive();
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (e) { /* storage unavailable */ }
  }

  /* ---------- Static store info ---------- */
  function initStoreInfo() {
    const c = STORE_CONFIG;
    $$("[data-cfg]").forEach((el) => { el.textContent = c[el.dataset.cfg] || ""; });
    $("#igLink").href = c.instagram;
    $("#ytLink").href = c.youtube;
    $("#waLink").href = "https://wa.me/" + c.whatsappNumber;
    $("#mailLink").href = "mailto:" + c.email;
    $("#mailLink").textContent = c.email;
    const waText = $("#waText");
    waText.href = "https://wa.me/" + c.whatsappNumber;
    waText.textContent = "WhatsApp: +" + c.whatsappNumber.replace(/^(\d{2})(\d{5})(\d{5})$/, "$1 $2$3");
    $("#shippingNote").textContent = "Shipping: " + c.shippingText;
    $("#year").textContent = new Date().getFullYear();
  }

  /* ---------- Product rendering ---------- */
  function getVisibleProducts() {
    const q = state.query.trim().toLowerCase();
    let list = PRODUCTS.filter((p) =>
      (state.category === "All" || p.category === state.category) &&
      (!q || (p.name + " " + p.category + " " + p.description).toLowerCase().includes(q))
    );
    if (state.sort === "low") list = list.slice().sort((a, b) => a.price - b.price);
    if (state.sort === "high") list = list.slice().sort((a, b) => b.price - a.price);
    return list;
  }

  const PRODUCTS_CACHE = "oo_products_cache_v1";
  const CAT_ORDER = ["Action Figures", "Posters", "Stickers", "Anime Merch"];
  function normProduct(p) {
    const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    const image = p.image || imgs[0] || "";
    return {
      id: +p.id, name: String(p.name || ""), category: String(p.category || "Anime Merch"),
      price: +p.price || 0, originalPrice: +p.originalPrice || 0, badge: String(p.badge || ""),
      image, images: imgs.length ? imgs : [image], inStock: p.inStock !== false && String(p.inStock).toLowerCase() !== "no",
      description: String(p.description || "")
    };
  }
  function setProducts(list) { PRODUCTS.splice(0, PRODUCTS.length, ...list.map(normProduct).filter((p) => Number.isFinite(p.id) && p.name)); }
  function applyCachedProducts() {
    if (!STORE_CONFIG.sheetWebhookUrl) return;
    try {
      const c = JSON.parse(localStorage.getItem(PRODUCTS_CACHE));
      if (c && c.managed && Array.isArray(c.list)) setProducts(c.list);
    } catch (e) { /* ignore */ }
  }
  async function loadRemoteProducts() {
    if (!STORE_CONFIG.sheetWebhookUrl) return;
    try {
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 9000);
      const r = await fetch(STORE_CONFIG.sheetWebhookUrl + "?action=products", { signal: ctl.signal });
      clearTimeout(tm);
      const d = await r.json();
      if (!d || !d.ok || !d.managed || !Array.isArray(d.products)) return;     // not managed yet: keep products.js list
      setProducts(d.products);
      try { localStorage.setItem(PRODUCTS_CACHE, JSON.stringify({ managed: true, list: d.products })); } catch (e) { /* ignore */ }
      refreshCatalog();
    } catch (e) { /* offline or not set up: keep what we have */ }
  }
  function refreshCatalog() {
    pruneCart(); renderPills(); syncCategoryUI(); renderProducts(); renderCart(); injectProductSchema();
    document.dispatchEvent(new CustomEvent("oo:products"));
  }
  function categoriesInUse() {
    const have = Array.from(new Set(PRODUCTS.map((p) => p.category)));
    return CAT_ORDER.filter((c) => have.includes(c)).concat(have.filter((c) => !CAT_ORDER.includes(c)));
  }
  function renderPills() {
    const cats = categoriesInUse();
    if (state.category !== "All" && !cats.includes(state.category)) state.category = "All";
    $("#pills").innerHTML = ["All"].concat(cats).map((c) => `<button class="pill ${c === state.category ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
    $("#pills").hidden = cats.length <= 1;                       // no filters needed with a single category
    $("#sortSelect").hidden = PRODUCTS.length <= 1;
    $(".toolbar").hidden = cats.length <= 1 && PRODUCTS.length <= 1;
  }
  function syncCategoryUI() {
    const have = new Set(PRODUCTS.map((p) => p.category));
    $$("a[data-cat]").forEach((a) => { (a.closest("li") || a).hidden = !have.has(a.dataset.cat); });
  }

  function renderProducts() {
    const list = getVisibleProducts();
    $("#emptyState").textContent = PRODUCTS.length === 0 ? "New products are coming soon. Follow us on Instagram for updates!" : "No products found. Try a different search or category.";
    const grid = $("#productGrid");
    $("#emptyState").hidden = list.length > 0;
    $("#resultCount").textContent = list.length + (list.length === 1 ? " item" : " items");

    grid.innerHTML = list.map((p) => {
      const off = discount(p);
      return `
      <article class="card reveal" data-id="${p.id}" tabindex="0" aria-label="${esc(p.name)}">
        <div class="card-img">
          <img src="${esc(p.image)}" alt="${esc(altText(p))}" loading="lazy" width="600" height="750">
          ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
          ${off ? `<span class="badge off">-${off}%</span>` : ""}
          ${!p.inStock ? `<div class="sold">Out of Stock</div>` : ""}
        </div>
        <div class="card-body">
          <span class="card-cat">${esc(p.category)}</span>
          <h3 class="card-name">${esc(p.name)}</h3>
          <div class="price-row">
            <span class="price">${inr(p.price)}</span>
            ${off ? `<span class="old">${inr(p.originalPrice)}</span>` : ""}
          </div>
        </div>
        <button class="btn btn-ghost" data-add="${p.id}" ${p.inStock ? "" : "disabled"}>${p.inStock ? "Add to Cart" : "Sold Out"}</button>
      </article>`;
    }).join("");

    $$("img", grid).forEach((img) => img.addEventListener("error", () => { img.src = FALLBACK_IMG; }, { once: true }));
    observeReveals();
  }

  /* ---------- Scroll reveal ---------- */
  let observer;
  function observeReveals() {
    if (!("IntersectionObserver" in window)) { $$(".reveal").forEach((el) => el.classList.add("in")); return; }
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("in"); observer.unobserve(e.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    }
    $$(".reveal:not(.in)").forEach((el, i) => {
      el.style.transitionDelay = Math.min(i % 4, 3) * 70 + "ms";
      observer.observe(el);
    });
  }

  /* ---------- Cart logic ---------- */
  function addToCart(id, qty = 1) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p || !p.inStock) return;
    const line = state.cart.find((i) => i.id === id);
    const before = unlockedCount();
    if (line) line.qty += qty; else state.cart.push({ id, qty });
    saveCart(); renderCart();
    const after = unlockedCount();
    toast(after > before ? `🎉 Unlocked: ${TIERS[after - 1].title}` : `Added “${p.name}” to cart`);
    const badge = $("#cartCount");
    badge.classList.add("bump"); setTimeout(() => badge.classList.remove("bump"), 250);
  }
  function changeQty(id, delta) {
    const line = state.cart.find((i) => i.id === id);
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) state.cart = state.cart.filter((i) => i.id !== id);
    saveCart(); renderCart();
  }
  function removeItem(id) {
    state.cart = state.cart.filter((i) => i.id !== id);
    saveCart(); renderCart();
  }
  const cartLines = () => state.cart.map((i) => { const p = PRODUCTS.find((x) => x.id === i.id); return p ? { ...p, qty: i.qty } : null; }).filter(Boolean);
  function pruneCart() {
    const before = state.cart.length;
    state.cart = state.cart.filter((i) => i.qty > 0 && PRODUCTS.some((p) => p.id === i.id && p.inStock));
    if (state.cart.length !== before) saveCart();
  }
  const cartSubtotal = () => cartLines().reduce((s, l) => s + l.price * l.qty, 0);
  const cartCountTotal = () => cartLines().reduce((s, l) => s + l.qty, 0);

  /* ---------- Offers engine (driven by OFFERS in products.js) ---------- */
  const TIERS = (typeof OFFERS !== "undefined" ? OFFERS : []).slice().sort((a, b) => a.min - b.min);
  const MAX_TIER = TIERS.length ? TIERS[TIERS.length - 1].min : 1;
  const GIFTS = typeof GIFT_POOL !== "undefined" ? GIFT_POOL : { keychains: [], mystery: [] };

  function computeTotals() {
    const subtotal = cartSubtotal();
    let discount = 0, giftTier = null;
    let freeShip = STORE_CONFIG.freeDelivery !== false && subtotal > 0;
    if (subtotal > 0) {
      TIERS.forEach((o) => {
        if (subtotal >= o.min) {
          discount = Math.max(discount, o.discount || 0);
          if (o.freeShipping) freeShip = true;
          if (o.gift) giftTier = o;
        }
      });
    }
    const next = subtotal > 0 ? TIERS.find((o) => o.min > subtotal) || null : null;
    return { subtotal, discount, freeShip, giftTier, next, total: Math.max(subtotal - discount, 0) };
  }
  const unlockedCount = () => TIERS.filter((o) => cartSubtotal() >= o.min).length;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  // Random gifts are picked once per tier and remembered until the order is sent
  function pickGifts(tier) {
    if (!tier) return [];
    if (state.giftPick && state.giftPick.min === tier.min) return state.giftPick.list;
    const g = tier.gift, list = [];
    if (g.mystery) shuffle(GIFTS.mystery.slice()).slice(0, g.mystery).forEach((n) => list.push(n));
    if (g.keychains) shuffle(GIFTS.keychains.slice()).slice(0, g.keychains).forEach((n) => list.push(n));
    if (g.stickers) list.push(g.stickers + " assorted stickers");
    state.giftPick = { min: tier.min, list };
    return list;
  }
  function giftSummary(tier) {
    const g = tier.gift, parts = [];
    if (g.mystery) parts.push(g.mystery + " mystery gift");
    if (g.keychains) parts.push(g.keychains + " surprise keychain" + (g.keychains > 1 ? "s" : ""));
    if (g.stickers) parts.push(g.stickers + " stickers");
    return parts.join(" + ");
  }

  function renderProgress(t) {
    const box = $("#offerProgress");
    if (t.subtotal <= 0 || !TIERS.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    const msg = t.next
      ? `Add <b>${inr(t.next.min - t.subtotal)}</b> more to unlock <b>${esc(t.next.title)}</b>`
      : `🎉 <b>All rewards unlocked!</b> Enjoy your free gifts.`;
    const pct = Math.min(t.subtotal / MAX_TIER * 100, 100);
    const marks = TIERS.map((o) => {
      const on = t.subtotal >= o.min;
      return `<span class="pg-mark ${on ? "on" : ""}" style="left:${o.min / MAX_TIER * 100}%">${on ? "✓" : o.icon}<small>${esc(o.short)}</small></span>`;
    }).join("");
    box.innerHTML = `<div class="pg-msg">${msg}</div><div class="pg-bar"><div class="pg-fill" style="width:${pct}%"></div>${marks}</div>`;
  }

  function renderRecs(t) {
    const box = $("#cartRecs");
    if (!state.cart.length) { box.innerHTML = ""; return; }
    const inCart = new Set(state.cart.map((i) => i.id));
    const pool = PRODUCTS.filter((p) => p.inStock && !inCart.has(p.id));
    if (!pool.length) { box.innerHTML = ""; return; }
    const gap = t.next ? t.next.min - t.subtotal : 0;
    const picks = [];
    if (t.next) {
      // the cheapest single product that unlocks the next reward
      const closer = pool.filter((p) => p.price >= gap).sort((a, b) => a.price - b.price)[0];
      if (closer) picks.push({ p: closer, tag: "Unlocks " + t.next.title });
    }
    pool
      .filter((p) => !picks.some((x) => x.p.id === p.id))
      .sort((a, b) => ((b.badge === "Bestseller") - (a.badge === "Bestseller")) || (discount(b) - discount(a)))
      .forEach((p) => {
        if (picks.length < 3) picks.push({ p, tag: t.next && p.price < gap ? "Gets you closer" : (p.badge || "Popular") });
      });
    const title = t.next ? `Fill your cart · unlock ${esc(t.next.title)}` : "You may also like";
    box.innerHTML = `<h4>${title}</h4>` + picks.map(({ p, tag }) => `
      <div class="rec">
        <img src="${esc(p.image)}" alt="${esc(altText(p))}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
        <div><span class="tag">${esc(tag)}</span><div class="rn">${esc(p.name)}</div><div class="rp">${inr(p.price)}</div></div>
        <button data-add="${p.id}">+ Add</button>
      </div>`).join("");
  }

  /* ---------- Payment: UPI (extra discount) or Cash on Delivery ---------- */
  const upiDiscountAmount = (total) => Math.round(total * (STORE_CONFIG.upiDiscountPercent || 0) / 100);
  function payInfo(method, t) {
    t = t || computeTotals();
    const upiDiscount = method === "UPI" ? upiDiscountAmount(t.total) : 0;
    return { method, upiDiscount, payable: Math.max(t.total - upiDiscount, 0) };
  }
  function selectedMethod() {
    const r = $('#checkoutForm input[name="payMethod"]:checked');
    return r ? r.value : "UPI";
  }
  function syncPayUI() {
    const upiOk = !!STORE_CONFIG.upiId, codOk = STORE_CONFIG.codEnabled !== false;
    const upi = $('#checkoutForm input[value="UPI"]'), cod = $('#checkoutForm input[value="COD"]');
    upi.disabled = !upiOk; cod.disabled = !codOk;
    $("#optUpi").classList.toggle("off", !upiOk); $("#optCod").classList.toggle("off", !codOk);
    $("#optCod").hidden = !codOk;
    const pct = STORE_CONFIG.upiDiscountPercent || 0;
    $("#upiTag").hidden = !(pct > 0 && upiOk);
    $("#upiTag").textContent = "Extra " + pct + "% OFF";
    if ((upi.checked && !upiOk) && codOk) cod.checked = true;
    if ((cod.checked && !codOk) && upiOk) upi.checked = true;
    $("#placeBtn").textContent = selectedMethod() === "COD" ? "Place Order (Cash on Delivery)" : "Continue to UPI Payment";
  }
  function renderCheckoutSummary() {
    const t = computeTotals(), m = selectedMethod(), pi = payInfo(m, t);
    const gifts = pickGifts(t.giftTier), pct = STORE_CONFIG.upiDiscountPercent || 0;
    $("#coSummary").innerHTML =
      `<div class="row"><span>Items (${cartCountTotal()})</span><span>${inr(t.subtotal)}</span></div>` +
      (t.discount ? `<div class="row ok"><span>Offer discount</span><span>-${inr(t.discount)}</span></div>` : "") +
      (pi.upiDiscount ? `<div class="row ok"><span>UPI discount (${pct}%)</span><span>-${inr(pi.upiDiscount)}</span></div>` : "") +
      `<div class="row"><span>Delivery</span><span class="${t.freeShip ? "ok" : ""}">${t.freeShip ? "FREE" : "Confirmed at verification"}</span></div>` +
      (gifts.length ? `<div class="row ok"><span>Free gifts</span><span>${esc(gifts.join(" + "))}</span></div>` : "") +
      `<div class="row total"><span>${m === "COD" ? "To pay on delivery" : "To pay by UPI"}</span><span>${inr(pi.payable)}</span></div>`;
    syncPayUI();
  }

  function initOffers() {
    const fill = (el, html, times) => { if (!el) return; const half = html.repeat(times); el.innerHTML = half + half; };
    const grid = $("#offerGrid");
    const bonus = typeof BONUS_OFFERS !== "undefined" ? BONUS_OFFERS : [];
    if (grid) grid.innerHTML =
      bonus.map((o) => `<div class="offer bonus reveal"><span class="o-min">${esc(o.label)}</span><h3>${esc(o.title)}</h3><p>${esc(o.desc)}</p></div>`).join("") +
      TIERS.map((o) => `<div class="offer reveal"><span class="o-min">Above ${inr(o.min)}</span><h3>${esc(o.title)}</h3><p>${esc(o.desc)}</p></div>`).join("");
    fill($("#tickerTrack"),
      bonus.map((o) => `<span><b>✦</b>${esc(o.title)} · ${esc(o.label)}</span>`).join("") +
      TIERS.map((o) => `<span><b>✦</b>${esc(o.title)} · from ${inr(o.min)}</span>`).join(""), 3);
    const words = ["ORIGINALS", "POW!", "COLLECT", "BAM!", "OTAKU", "ZAP!", "MANGA", "ANIME"];
    fill($("#bandTrack"), words.map((w, i) => `<span class="${i % 2 ? "out" : ""}">${w}</span><span>✦</span>`).join(""), 2);
  }

  function renderCart() {
    const lines = cartLines();
    $("#cartCount").textContent = cartCountTotal();
    const t = computeTotals();
    $("#cartSubtotal").textContent = inr(t.subtotal);
    $("#discRow").hidden = !t.discount;
    $("#cartDiscount").textContent = "-" + inr(t.discount);
    $("#shipVal").textContent = lines.length === 0 ? "—" : (t.freeShip ? "FREE 🎉" : "At verification");
    $("#shippingNote").textContent = t.freeShip ? "Free delivery on every order." : "Shipping: " + STORE_CONFIG.shippingText;
    const hint = $("#upiHint"), pct = STORE_CONFIG.upiDiscountPercent || 0;
    if (lines.length && pct > 0 && STORE_CONFIG.upiId) {
      const save = upiDiscountAmount(t.total);
      hint.hidden = false;
      hint.innerHTML = `⚡ Pay by UPI at checkout and save an extra <b>${inr(save)}</b> (${pct}% off) → <b>${inr(t.total - save)}</b>`;
    } else hint.hidden = true;
    const gifts = pickGifts(t.giftTier);
    $("#giftRow").hidden = !t.giftTier;
    if (t.giftTier) $("#giftRow").innerHTML = "🎁 <b>Free gift:</b> " + esc(giftSummary(t.giftTier)) + " (picked at random when you order)";
    $("#cartTotal").textContent = inr(t.total);
    $("#checkoutBtn").disabled = lines.length === 0;
    renderProgress(t);
    renderRecs(t);

    $("#cartItems").innerHTML = lines.length === 0
      ? `<p class="cart-empty">Your cart is empty.<br>Find something you love ✦</p>`
      : lines.map((l) => `
        <div class="cart-item">
          <img src="${esc(l.image)}" alt="${esc(l.name)}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'">
          <div>
            <div class="ci-name">${esc(l.name)}</div>
            <div class="ci-price">${inr(l.price)} each</div>
            <div class="ci-controls">
              <div class="qty">
                <button data-dec="${l.id}" aria-label="Decrease quantity">−</button>
                <span>${l.qty}</span>
                <button data-inc="${l.id}" aria-label="Increase quantity">+</button>
              </div>
              <button class="remove" data-remove="${l.id}">Remove</button>
            </div>
          </div>
        </div>`).join("");
  }

  /* ---------- Overlay, drawer, modals ---------- */
  function syncOverlay() {
    const anyOpen = $("#drawer").classList.contains("open") || $$(".modal.open").length > 0;
    $("#overlay").classList.toggle("show", $("#drawer").classList.contains("open"));
    document.body.classList.toggle("lock", anyOpen);
  }
  function openDrawer() { hideNudge(false); $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); syncOverlay(); }
  function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); syncOverlay(); }
  function openModal(id) { const m = $("#" + id); m.classList.add("open"); m.setAttribute("aria-hidden", "false"); syncOverlay(); }
  function closeModal(m) { m.classList.remove("open"); m.setAttribute("aria-hidden", "true"); syncOverlay(); }
  function closeAll() { closeDrawer(); $$(".modal.open").forEach(closeModal); }

  function openQuickView(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    const off = discount(p);
    $("#quickContent").innerHTML = `
      ${galleryHTML(p)}
      <div class="qv-info">
        <span class="card-cat">${esc(p.category)}${p.badge ? " · " + esc(p.badge) : ""}</span>
        <h3>${esc(p.name)}</h3>
        <div class="qv-price">
          <span class="price">${inr(p.price)}</span>
          ${off ? `<span class="old">${inr(p.originalPrice)}</span><span class="off-tag">${off}% OFF</span>` : ""}
        </div>
        <span class="stock ${p.inStock ? "in" : "out"}">${p.inStock ? "● In Stock (verified at order confirmation)" : "● Currently Out of Stock"}</span>
        <p class="muted" style="margin:0">${esc(p.description)}</p>
        <button class="btn btn-primary block" data-add="${p.id}" data-closeqv ${p.inStock ? "" : "disabled"}>${p.inStock ? "Add to Cart" : "Sold Out"}</button>
      </div>`;
    state.gallery = { imgs: galleryImages(p), i: 0 };
    openModal("quickModal");
  }

  /* ---------- Product photo gallery (quick view) ---------- */
  function galleryImages(p) { return Array.isArray(p.images) && p.images.length ? p.images : [p.image]; }
  function galleryHTML(p) {
    const imgs = galleryImages(p), multi = imgs.length > 1;
    const err = `onerror="this.onerror=null;this.src='${FALLBACK_IMG}'"`;
    return `<div class="qv-img gallery">
      <div class="g-main" id="gMain"><img id="gImg" src="${esc(imgs[0])}" alt="${esc(altText(p))}" ${err}></div>
      ${multi ? `<button type="button" class="g-nav prev" data-gdir="-1" aria-label="Previous photo">‹</button>
      <button type="button" class="g-nav next" data-gdir="1" aria-label="Next photo">›</button>
      <div class="g-thumbs">${imgs.map((src, i) => `<button type="button" class="g-thumb ${i ? "" : "on"}" data-gi="${i}" aria-label="Photo ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy" ${err}></button>`).join("")}</div>` : ""}
    </div>`;
  }
  function gallerySet(i) {
    const g = state.gallery; if (!g) return;
    g.i = (i + g.imgs.length) % g.imgs.length;
    const img = $("#gImg"); if (img) img.src = g.imgs[g.i];
    $$(".g-thumb").forEach((t, k) => t.classList.toggle("on", k === g.i));
  }
  function bindGallery() {
    const qc = $("#quickContent");
    qc.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-gdir]"); if (nav) { gallerySet((state.gallery ? state.gallery.i : 0) + +nav.dataset.gdir); return; }
      const th = e.target.closest("[data-gi]"); if (th) gallerySet(+th.dataset.gi);
    });
    let sx = null;
    qc.addEventListener("touchstart", (e) => { sx = e.target.closest("#gMain") ? e.touches[0].clientX : null; }, { passive: true });
    qc.addEventListener("touchend", (e) => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) gallerySet((state.gallery ? state.gallery.i : 0) + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  const POLICIES = {
    shipping: `
      <h3>Shipping Policy</h3>
      <p>We deliver across India through trusted courier partners.</p>
      <ul>
        <li>Every order is stock-verified by our team before packing.</li>
        <li>Delivery is free on every order.</li>
        <li>Orders are typically dispatched within 2–4 working days after you approve.</li>
        <li>Delivery usually takes 4–8 working days depending on your location.</li>
        <li>Tracking details are shared on WhatsApp once your order ships.</li>
        <li>Payment: pay by UPI (extra 5% off) or choose Cash on Delivery.</li>
      </ul>
      <p class="muted">Timelines are estimates and may vary due to courier delays or remote pincodes.</p>`,
    returns: `
      <h3>Return Policy</h3>
      <p>We want you to love your order. If something is wrong, we'll make it right.</p>
      <ul>
        <li>Report damaged, defective or wrong items within 48 hours of delivery.</li>
        <li>Share an unboxing video or clear photos on WhatsApp for a quick resolution.</li>
        <li>Eligible items are replaced or refunded after verification.</li>
        <li>Items must be unused and in original packaging. Opened stickers and custom-sized apparel are not returnable unless defective.</li>
      </ul>
      <p>Contact us: <strong>${esc(STORE_CONFIG.email)}</strong> or WhatsApp +${esc(STORE_CONFIG.whatsappNumber)}.</p>`,
    privacy: `
      <h3>Privacy Policy</h3>
      <p class="muted">Last updated: November 2026</p>
      <p><strong>Who we are:</strong> OtakuOriginals, run by Piyush from Patiala, Punjab, India. Contact: ${esc(STORE_CONFIG.email)}.</p>
      <p><strong>What we collect</strong></p>
      <ul>
        <li>Order details: your name, phone number, delivery address, order note and the items in your cart.</li>
        <li>Partly filled orders: if you start filling in the order form, we may save what you entered so we can help you finish the order.</li>
        <li>Payment: the payment method you choose and the UPI reference (UTR) if you enter it. We never see your UPI PIN or bank details; UPI payments go straight to our UPI ID through your own UPI app.</li>
        <li>Reviews: your name, comment, rating and any photos you choose to upload.</li>
        <li>Your cart is saved in your own browser (local storage) so it is still there when you return.</li>
      </ul>
      <p><strong>How we use it:</strong> to verify stock, pack and deliver your order, to contact you on WhatsApp about your order or if you need help completing it, to show approved reviews, and to improve the store.</p>
      <p><strong>Where it is stored:</strong> order and review records are kept in Google Sheets and Google Drive managed by us. If you message us on WhatsApp, WhatsApp (Meta) delivers the message to us. We share your name, phone and address with courier partners only to deliver your order. We do not sell your data.</p>
      <p><strong>Your choices:</strong> you can ask us to correct or delete your details or a review by emailing ${esc(STORE_CONFIG.email)}. We keep order records for as long as needed for delivery, support and legal or tax requirements.</p>
      <p><strong>Public content:</strong> reviews and photos you submit may be shown publicly on this website once approved.</p>
      <p class="muted">We may update this policy from time to time. Continued use of the site means you accept the updated policy.</p>`,
    terms: `
      <h3>Terms &amp; Conditions</h3>
      <p class="muted">Last updated: November 2026</p>
      <ul>
        <li><strong>Orders:</strong> placing an order is a request to buy. It becomes confirmed after we verify your payment and stock. If any item is unavailable we will tell you and refund any UPI payment for it.</li>
        <li><strong>Prices:</strong> all prices are in Indian Rupees (₹). We may correct pricing or stock errors and will tell you before packing.</li>
        <li><strong>Payment:</strong> you can pay by UPI (scan the QR code or use your UPI app) and get an extra 5% off, or choose Cash on Delivery, which does not get the UPI discount. If an item turns out to be unavailable, we refund any UPI payment for it in full.</li>
        <li><strong>Products:</strong> we currently sell general anime-inspired merchandise. Items are not official licensed products unless the product page says so. Photos are for illustration and small colour or finish differences can occur.</li>
        <li><strong>Offers:</strong> delivery is free on every order, and paying by UPI gives an extra discount (not on Cash on Delivery). We may change or end offers at any time.</li>
        <li><strong>Shipping and returns:</strong> please read our Shipping Policy and Return Policy.</li>
        <li><strong>Reviews:</strong> by submitting a review or photo you allow us to display it on this site. We may remove content that is abusive, unrelated or unsafe.</li>
        <li><strong>Liability:</strong> to the extent allowed by law, our liability for any order is limited to the amount paid for that order.</li>
        <li><strong>Governing law:</strong> these terms are governed by the laws of India, and courts at Patiala, Punjab have jurisdiction.</li>
      </ul>
      <p>Questions? Email ${esc(STORE_CONFIG.email)} or WhatsApp +${esc(STORE_CONFIG.whatsappNumber)}.</p>`
  };

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  /* ---------- Checkout ---------- */
  const VALIDATORS = {
    name: (v) => (v.trim().length >= 2 ? "" : "Please enter your full name."),
    phone: (v) => (/^[6-9]\d{9}$/.test(v.trim()) ? "" : "Enter a valid 10-digit mobile number."),
    street: (v) => (v.trim().length >= 3 ? "" : "Please enter house / street."),
    landmark: (v) => (v.trim().length >= 2 ? "" : "Please enter a landmark."),
    city: (v) => (v.trim().length >= 2 ? "" : "Please enter your city."),
    state: (v) => (v.trim().length >= 2 ? "" : "Please enter your state."),
    pincode: (v) => (/^[1-9]\d{5}$/.test(v.trim()) ? "" : "Enter a valid 6-digit pincode.")
  };

  function validateField(input) {
    const fn = VALIDATORS[input.name];
    if (!fn) return true;
    const msg = fn(input.value);
    input.classList.toggle("invalid", !!msg);
    const err = input.parentElement.querySelector(".err");
    if (err) err.textContent = msg;
    return !msg;
  }

  function generateOrderId() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let id = "";
    for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return "OO-" + id;
  }

  function buildOrderText(orderId, data, extra = {}) {
    const lines = cartLines();
    const t = computeTotals();
    const method = extra.method || data.payMethod || "COD", pi = payInfo(method, t), pct = STORE_CONFIG.upiDiscountPercent || 0;
    const gifts = pickGifts(t.giftTier);
    const items = lines.map((l, i) => `${i + 1}. ${l.name}\n   ${l.qty} x ${inr(l.price)} = ${inr(l.price * l.qty)}`).join("\n");
    return [
      `*New Order — ${STORE_CONFIG.brandName}*`,
      `*Order ID:* ${orderId}`,
      ``,
      `*Items*`,
      items,
      ``,
      `*Subtotal:* ${inr(t.subtotal)}`,
      ...(t.discount ? [`*Offer Discount:* -${inr(t.discount)}`] : []),
      ...(pi.upiDiscount ? [`*UPI Discount (${pct}%):* -${inr(pi.upiDiscount)}`] : []),
      `*Delivery:* ${t.freeShip ? "FREE" : STORE_CONFIG.shippingText}`,
      ...(gifts.length ? [`*Free Gifts:* ${gifts.join(" + ")}`] : []),
      `*Total:* ${inr(pi.payable)}`,
      method === "COD"
        ? `*Payment:* Cash on Delivery - ${inr(pi.payable)} to pay on delivery`
        : (extra.paid ? `*Payment:* UPI - ${inr(pi.payable)} PAID to ${STORE_CONFIG.upiId}` : `*Payment:* UPI - ${inr(pi.payable)} (to be paid)`),
      ...(method === "UPI" && extra.paid ? [`*UTR / Ref:* ${extra.utr ? extra.utr : "I will share the payment screenshot"}`] : []),
      ``,
      `*Customer Details*`,
      `Name: ${data.name.trim()}`,
      `Phone: ${data.phone.trim()}`,
      `Address: ${data.street.trim()}, Landmark: ${data.landmark.trim()}, ${data.city.trim()}, ${data.state.trim()} - ${data.pincode.trim()}`,
      `Note: ${data.note && data.note.trim() ? data.note.trim() : "None"}`,
      ``,
      `*Notice:* Please verify stock availability. If any item is unavailable, please remove it${method === "UPI" ? " and refund that amount to my UPI" : ""}.`
    ].join("\n");
  }

  function getFormData(form) {
    const fd = new FormData(form);
    const data = {};
    fd.forEach((v, k) => { data[k] = v; });
    return data;
  }

  function validateForm(form) {
    let ok = true;
    $$("input[required]", form).forEach((inp) => { if (!validateField(inp)) ok = false; });
    if (!ok) { const first = $(".invalid", form); if (first) first.focus(); }
    return ok;
  }

  /* ---------- Google Sheet order log ---------- */
  // Every checkout gets one Order ID. The row in the sheet is created when the customer has
  // typed a valid name + phone, then upgraded: Details entered -> Copied -> Submitted -> Redirected.
  const RANK = { lead: 1, copied: 2, upiPending: 3, submitted: 4, redirected: 5 };
  const STATUS_TEXT = {
    lead: "Details entered - NOT submitted",
    copied: "Copied summary - not sent yet",
    upiPending: "UPI payment pending - QR shown",
    submitted: "Order placed - check payment",
    redirected: "Customer says paid - verify and deliver",
    redirectedSame: "Customer says paid - verify and deliver"
  };
  function postToSheet(payload, keepalive = true) {
    const url = STORE_CONFIG.sheetWebhookUrl;
    if (!url) return Promise.resolve(false);
    return fetch(url, { method: "POST", mode: "no-cors", keepalive, headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(() => true).catch(() => false);
  }
  function ensureOrderId() { if (!state.pendingOrderId) state.pendingOrderId = generateOrderId(); return state.pendingOrderId; }
  function logOrder(kind, data, orderId, extra = {}) {
    if (!STORE_CONFIG.sheetWebhookUrl || cartLines().length === 0) return;
    const t = computeTotals(), gifts = pickGifts(t.giftTier);
    const method = extra.method || data.payMethod || "UPI", pi = payInfo(method, t);
    postToSheet({
      type: "order", orderId, rank: RANK[kind === "redirectedSame" ? "redirected" : kind], status: extra.status || STATUS_TEXT[kind],
      name: (data.name || "").trim(), phone: (data.phone || "").trim(), street: (data.street || "").trim(),
      landmark: (data.landmark || "").trim(), city: (data.city || "").trim(), state: (data.state || "").trim(),
      pincode: (data.pincode || "").trim(), note: (data.note || "").trim(),
      items: cartLines().map((l) => l.name + " x" + l.qty + " (" + inr(l.price * l.qty) + ")").join("; "),
      itemCount: cartCountTotal(), subtotal: t.subtotal, discount: t.discount, upiDiscount: pi.upiDiscount,
      delivery: t.freeShip ? "FREE" : "Confirmed at verification", gifts: gifts.join(" + "), total: pi.payable,
      paymentMethod: method === "COD" ? "COD" : "UPI", utr: (extra.utr || "").trim(),
      page: location.origin + location.pathname
    });
  }
  let leadTimer;
  function leadReady(d) { return !VALIDATORS.name(d.name || "") && !VALIDATORS.phone(d.phone || ""); }
  function scheduleLead() {
    if (!STORE_CONFIG.sheetWebhookUrl) return;
    clearTimeout(leadTimer);
    leadTimer = setTimeout(flushLead, 1500);
  }
  function flushLead() {
    clearTimeout(leadTimer);
    if (!$("#checkoutModal").classList.contains("open") || cartLines().length === 0) return;
    const d = getFormData($("#checkoutForm"));
    if (leadReady(d)) logOrder("lead", d, ensureOrderId());
  }

  function submitOrder(e) {
    e.preventDefault();
    pruneCart();
    if (cartLines().length === 0) { toast("Your cart is empty"); return; }
    const form = e.currentTarget;
    if (!validateForm(form)) return;
    const orderId = ensureOrderId(), data = getFormData(form), method = data.payMethod === "COD" ? "COD" : "UPI";
    if (method === "UPI") {
      if (!STORE_CONFIG.upiId) { toast("UPI is not available right now. Please choose Cash on Delivery."); return; }
      openPayment(orderId, data);
      return;
    }
    if (STORE_CONFIG.codEnabled === false) { toast("Cash on Delivery is not available right now."); return; }
    finalizeOrder(orderId, data, "COD", "");
  }

  // COD: save the order and show the confirmation screen (no WhatsApp redirect).
  function finalizeOrder(orderId, data, method, utr) {
    const extra = { method, utr, status: method === "COD" ? "COD order placed - confirm and deliver" : undefined };
    state.lastOrderText = buildOrderText(orderId, data, extra);
    logOrder("submitted", data, orderId, extra);
    logOrder("redirected", data, orderId, extra);
    showThanks(orderId, data, method);
  }

  function showThanks(orderId, data, method) {
    const phone = esc((data.phone || "").trim());
    const paid = method === "UPI";
    const wa = "https://wa.me/" + STORE_CONFIG.whatsappNumber + "?text=" + encodeURIComponent("Hi OtakuOriginals, my order ID is " + orderId + ".");
    $("#payContent").innerHTML = `
      <div class="thanks">
        <div class="tick" aria-hidden="true">✓</div>
        <h3>${paid ? "Thank you! Payment submitted" : "Thank you! Order placed"}</h3>
        <p class="muted">Order ID <b>${esc(orderId)}</b></p>
        <p>${paid ? "We will check that your payment has arrived in our account. " : ""}<b>Our admin will reach out to you on ${phone} shortly and share the delivery information.</b></p>
        <p class="muted small">Please keep your phone handy. If you need anything, message us on WhatsApp with your order ID.</p>
        <a class="btn btn-ghost block" href="${esc(wa)}" target="_blank" rel="noopener">Message us on WhatsApp</a>
        <button type="button" class="btn btn-primary block" id="payClose">Continue shopping</button>
      </div>`;
    state.pendingOrderId = null; state.pay = null;
    state.cart = []; state.giftPick = null; saveCart(); renderCart();
    $("#checkoutForm").reset(); syncPayUI();
    closeModal($("#checkoutModal"));
    openModal("payModal");
  }

  /* ---------- UPI payment screen (QR + pay button) ---------- */
  function upiLink(amount, orderId) {
    const c = STORE_CONFIG, enc = encodeURIComponent;
    return "upi://pay?pa=" + c.upiId.trim() + "&pn=" + enc(c.upiName || c.brandName) + "&am=" + Number(amount).toFixed(2) + "&cu=INR&tn=" + enc("Order " + orderId);
  }
  function openPayment(orderId, data) {
    const t = computeTotals(), pi = payInfo("UPI", t), pct = STORE_CONFIG.upiDiscountPercent || 0;
    state.pay = { orderId, data, payable: pi.payable, opened: false };
    const link = upiLink(pi.payable, orderId);
    let qr = "";
    try { qr = window.OOQR ? window.OOQR.svg(link, { size: 240, label: "UPI payment QR code for " + inr(pi.payable) }) : ""; } catch (err) { qr = ""; }
    $("#payContent").innerHTML = `
      <h3>Pay ${inr(pi.payable)} by UPI</h3>
      <p class="muted small">Order ${esc(orderId)}${pi.upiDiscount ? ` · includes your extra ${pct}% UPI discount (−${inr(pi.upiDiscount)})` : ""}</p>
      <a class="btn btn-primary block" href="${esc(link)}" id="payOpen">Pay ${inr(pi.payable)} with UPI app</a>
      <p class="pay-steps">Opens GPay, PhonePe, Paytm or any UPI app on your phone with the amount filled in.</p>
      <p class="pay-steps"><b>On a computer?</b> Scan this QR with any UPI app:</p>
      <div class="pay-qr">${qr || "<p>QR code unavailable. Use the button or UPI ID below.</p>"}</div>
      <div class="pay-id"><span>UPI ID: <b>${esc(STORE_CONFIG.upiId)}</b></span><button type="button" class="chip" id="payCopy">Copy</button></div>
      <button type="button" class="btn btn-ghost block" id="payPaid">I have already paid (scanned the QR)</button>
      <button type="button" class="btn btn-ghost block" id="payBack">← Change payment method</button>
      <p class="consent">Your order is saved when you tap Pay. We then check your payment, and our admin contacts you with delivery information. If an item is unavailable, we refund it.</p>`;
    logOrder("upiPending", data, orderId, { method: "UPI" });
    closeModal($("#checkoutModal"));
    openModal("payModal");
  }
  // Shown when the customer comes back from the UPI app
  function showPayCheck() {
    const p = state.pay; if (!p) return;
    $("#payContent").innerHTML = `
      <h3>Did your payment go through?</h3>
      <p class="muted">Order <b>${esc(p.orderId)}</b> · ${inr(p.payable)}</p>
      <button type="button" class="btn btn-primary block" id="payYes">Yes, I have paid</button>
      <button type="button" class="btn btn-ghost block" id="payNo">No, try again</button>
      <label class="utr">UPI reference / UTR (optional, helps us find your payment)
        <input type="text" id="payUtr" maxlength="30" autocomplete="off" placeholder="12-digit number from your UPI app">
      </label>`;
  }
  function bindPayment() {
    $("#payContent").addEventListener("click", async (e) => {
      if (e.target.closest("#payBack")) { closeModal($("#payModal")); renderCheckoutSummary(); openModal("checkoutModal"); return; }
      if (e.target.closest("#payClose")) { closeModal($("#payModal")); return; }
      if (e.target.closest("#payCopy")) {
        try { await navigator.clipboard.writeText(STORE_CONFIG.upiId); toast("UPI ID copied"); } catch (err) { toast("Long-press the UPI ID to copy"); }
        return;
      }
      if (e.target.closest("#payOpen") && state.pay) {   // link still opens the UPI app; we save the order first
        state.pay.opened = true;
        logOrder("submitted", state.pay.data, state.pay.orderId, { method: "UPI", status: "UPI app opened - check payment" });
        return;
      }
      if (e.target.closest("#payPaid") && state.pay) { showPayCheck(); return; }
      if (e.target.closest("#payNo") && state.pay) { openPayment(state.pay.orderId, state.pay.data); return; }
      if (e.target.closest("#payYes") && state.pay) {
        const utr = (($("#payUtr") || {}).value || "").trim();
        finalizeOrder(state.pay.orderId, state.pay.data, "UPI", utr);
      }
    });
    $$('#checkoutForm input[name="payMethod"]').forEach((r) => r.addEventListener("change", renderCheckoutSummary));
    // Coming back from the UPI app -> ask whether the payment went through
    document.addEventListener("visibilitychange", () => {
      const p = state.pay; if (!p || !p.opened) return;
      if (document.hidden) p.wasHidden = true;
      else if (p.wasHidden && $("#payOpen")) { p.wasHidden = false; showPayCheck(); }
    });
  }

  async function copySummary() {
    const form = $("#checkoutForm");
    if (cartLines().length === 0) { toast("Your cart is empty"); return; }
    if (!validateForm(form)) return;
    const copyId = ensureOrderId(), copyData = getFormData(form);
    const text = buildOrderText(copyId, copyData, { method: copyData.payMethod === "COD" ? "COD" : "UPI", paid: false });
    logOrder("copied", copyData, copyId);
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e2) { /* ignore */ }
      ta.remove();
    }
    toast("Order summary copied — paste it in WhatsApp");
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    // Search / sort / category filters
    $("#searchInput").addEventListener("input", (e) => { state.query = e.target.value; renderProducts(); });
    $("#sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; renderProducts(); });
    $("#pills").addEventListener("click", (e) => {
      const btn = e.target.closest(".pill");
      if (btn) setCategory(btn.dataset.cat);
    });
    // Nav & footer category links
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a[data-cat]");
      if (link) setCategory(link.dataset.cat);
      const pol = e.target.closest("[data-policy]");
      if (pol) { e.preventDefault(); $("#policyContent").innerHTML = POLICIES[pol.dataset.policy]; openModal("policyModal"); }
    });

    // Product grid: add to cart / quick view
    $("#productGrid").addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      if (add) { e.stopPropagation(); addToCart(+add.dataset.add); return; }
      const card = e.target.closest(".card");
      if (card) openQuickView(+card.dataset.id);
    });
    $("#productGrid").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.classList.contains("card")) openQuickView(+e.target.dataset.id);
    });

    // Quick view add
    $("#quickContent").addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      if (add) { addToCart(+add.dataset.add); closeModal($("#quickModal")); openDrawer(); }
    });

    // Cart drawer
    $("#cartBtn").addEventListener("click", openDrawer);
    $("#cartItems").addEventListener("click", (e) => {
      const t = e.target;
      if (t.dataset.inc) changeQty(+t.dataset.inc, 1);
      else if (t.dataset.dec) changeQty(+t.dataset.dec, -1);
      else if (t.dataset.remove) removeItem(+t.dataset.remove);
    });
    $("#checkoutBtn").addEventListener("click", () => {
      pruneCart();
      if (cartLines().length === 0) return;
      renderCheckoutSummary();
      ensureOrderId();
      closeDrawer(); openModal("checkoutModal");
    });
    // Recommended products inside the cart
    $("#cartRecs").addEventListener("click", (e) => {
      const add = e.target.closest("[data-add]");
      if (add) addToCart(+add.dataset.add);
    });

    // Closing
    $("#overlay").addEventListener("click", closeAll);
    $$("[data-close]").forEach((b) => b.addEventListener("click", closeAll));
    $$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) closeModal(m); }));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

    // Checkout form
    const form = $("#checkoutForm");
    form.addEventListener("submit", submitOrder);
    $("#copyBtn").addEventListener("click", copySummary);
    $$("input", form).forEach((inp) => {
      inp.addEventListener("blur", () => validateField(inp));
      inp.addEventListener("input", () => { if (inp.classList.contains("invalid")) validateField(inp); });
    });
    // save partly filled details (once name + phone are valid) so we can follow up
    form.addEventListener("input", scheduleLead);
    document.addEventListener("visibilitychange", () => { if (document.hidden) flushLead(); });
    window.addEventListener("pagehide", flushLead);
    bindGallery();
    bindPayment();
    // digits only
    ["phone", "pincode"].forEach((n) => {
      form.elements[n].addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, ""); });
    });
  }

  function setCategory(cat) {
    state.category = cat;
    $$(".pill").forEach((p) => p.classList.toggle("active", p.dataset.cat === cat));
    // keep the selected pill centred in the swipeable row
    const box = $("#pills"), act = $(".pill.active");
    if (box && act && box.scrollWidth > box.clientWidth) {
      box.scrollTo({ left: act.offsetLeft - (box.clientWidth - act.offsetWidth) / 2, behavior: "smooth" });
    }
    renderProducts();
  }

  /* ---------- SEO: Product list schema generated from products.js ---------- */
  function injectProductSchema() {
    try {
      const abs = (u) => /^https?:/i.test(u) ? u : "https://otakuoriginals.shop/" + String(u).replace(/^\.?\//, "");
      const data = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "OtakuOriginals anime merchandise",
        "itemListElement": PRODUCTS.map((p, i) => ({
          "@type": "ListItem", "position": i + 1,
          "item": {
            "@type": "Product", "name": p.name, "description": p.description, "image": galleryImages(p).map(abs),
            "category": p.category, "brand": { "@type": "Brand", "name": "OtakuOriginals" },
            "offers": {
              "@type": "Offer", "url": "https://otakuoriginals.shop/#shop", "priceCurrency": "INR", "price": String(p.price),
              "availability": p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              "itemCondition": "https://schema.org/NewCondition"
            }
          }
        }))
      };
      const old = document.getElementById("ld-products"); if (old) old.remove();
      const s = document.createElement("script");
      s.id = "ld-products"; s.type = "application/ld+json"; s.textContent = JSON.stringify(data);
      document.head.appendChild(s);
    } catch (e) { /* schema is optional */ }
  }

  /* ---------- Abandoned-cart nudge ---------- */
  const LAST_KEY = "otakuoriginals_last_active", NUDGE_KEY = "otakuoriginals_nudge_dismissed";
  function touchActive() { try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch (e) { /* ignore */ } }
  function nudgeDismissed() { try { return sessionStorage.getItem(NUDGE_KEY) === "1"; } catch (e) { return false; } }
  function hideNudge(remember) {
    const n = $("#nudge"); if (!n) return;
    n.classList.remove("show"); setTimeout(() => { n.hidden = true; }, 300);
    if (remember) { try { sessionStorage.setItem(NUDGE_KEY, "1"); } catch (e) { /* ignore */ } }
  }
  function showNudge() {
    if (!state.cart.length || nudgeDismissed()) return;
    if ($("#drawer").classList.contains("open") || $$(".modal.open").length) return;
    const t = computeTotals(), n = cartCountTotal();
    let msg = `🛒 You left <b>${n} item${n > 1 ? "s" : ""}</b> in your cart (${inr(t.total)}).`;
    if (TIERS.length) msg += t.next ? ` Add <b>${inr(t.next.min - t.subtotal)}</b> more to unlock <b>${esc(t.next.title)}</b>.` : " 🎉 All rewards unlocked!";
    $("#nudgeText").innerHTML = msg;
    const el = $("#nudge"); el.hidden = false; requestAnimationFrame(() => el.classList.add("show"));
  }
  function initNudge() {
    $("#nudgeGo").addEventListener("click", () => { hideNudge(true); openDrawer(); });
    $("#nudgeClose").addEventListener("click", () => hideNudge(true));
    setTimeout(showNudge, 6000);                       // returning visitor with items still in cart
    let hiddenAt = 0;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > 120000) showNudge();   // came back after 2+ minutes
    });
  }

  /* ---------- Shared helpers for extras.js ---------- */
  window.OO = { esc, inr, toast, openModal, closeModal, closeAll, postToSheet, observeReveals, FALLBACK_IMG, config: STORE_CONFIG };

  /* ---------- Init ---------- */
  initStoreInfo();
  applyCachedProducts();
  if (!STORE_CONFIG.sheetWebhookUrl) pruneCart();
  renderPills();
  syncCategoryUI();
  injectProductSchema();
  initOffers();
  bindEvents();
  renderProducts();
  renderCart();
  observeReveals();
  initNudge();
  loadRemoteProducts();
})();
