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
      // keep only valid items that still exist in the catalog
      return raw.filter((i) => PRODUCTS.some((p) => p.id === i.id && p.inStock) && i.qty > 0);
    } catch (e) { return []; }
  }
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (e) { /* storage unavailable */ }
  }

  /* ---------- Static store info ---------- */
  function initStoreInfo() {
    const c = STORE_CONFIG;
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

  function renderProducts() {
    const list = getVisibleProducts();
    const grid = $("#productGrid");
    $("#emptyState").hidden = list.length > 0;
    $("#resultCount").textContent = list.length + (list.length === 1 ? " item" : " items");

    grid.innerHTML = list.map((p) => {
      const off = discount(p);
      return `
      <article class="card reveal" data-id="${p.id}" tabindex="0" aria-label="${esc(p.name)}">
        <div class="card-img">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
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
    if (line) line.qty += qty; else state.cart.push({ id, qty });
    saveCart(); renderCart();
    toast(`Added “${p.name}” to cart`);
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
  const cartLines = () => state.cart.map((i) => ({ ...PRODUCTS.find((p) => p.id === i.id), qty: i.qty }));
  const cartSubtotal = () => cartLines().reduce((s, l) => s + l.price * l.qty, 0);
  const cartCountTotal = () => state.cart.reduce((s, i) => s + i.qty, 0);

  function renderCart() {
    const lines = cartLines();
    $("#cartCount").textContent = cartCountTotal();
    $("#cartSubtotal").textContent = inr(cartSubtotal());
    $("#checkoutBtn").disabled = lines.length === 0;

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
  function openDrawer() { $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); syncOverlay(); }
  function closeDrawer() { $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); syncOverlay(); }
  function openModal(id) { const m = $("#" + id); m.classList.add("open"); m.setAttribute("aria-hidden", "false"); syncOverlay(); }
  function closeModal(m) { m.classList.remove("open"); m.setAttribute("aria-hidden", "true"); syncOverlay(); }
  function closeAll() { closeDrawer(); $$(".modal.open").forEach(closeModal); }

  function openQuickView(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return;
    const off = discount(p);
    $("#quickContent").innerHTML = `
      <div class="qv-img"><img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.onerror=null;this.src='${FALLBACK_IMG}'"></div>
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
    openModal("quickModal");
  }

  const POLICIES = {
    shipping: `
      <h3>Shipping Policy</h3>
      <p>We deliver across India through trusted courier partners.</p>
      <ul>
        <li>Every order is stock-verified by our team before packing.</li>
        <li>Shipping charges are calculated and confirmed on WhatsApp during verification.</li>
        <li>Orders are typically dispatched within 2–4 working days after you approve.</li>
        <li>Delivery usually takes 4–8 working days depending on your location.</li>
        <li>Tracking details are shared on WhatsApp once your order ships.</li>
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
      <p>Contact us: <strong>${esc(STORE_CONFIG.email)}</strong> or WhatsApp +${esc(STORE_CONFIG.whatsappNumber)}.</p>`
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

  function buildOrderText(orderId, data) {
    const lines = cartLines();
    const items = lines.map((l, i) => `${i + 1}. ${l.name}\n   ${l.qty} x ${inr(l.price)} = ${inr(l.price * l.qty)}`).join("\n");
    return [
      `*New Order — ${STORE_CONFIG.brandName}*`,
      `*Order ID:* ${orderId}`,
      ``,
      `*Items*`,
      items,
      ``,
      `*Subtotal:* ${inr(cartSubtotal())}`,
      `*Shipping:* ${STORE_CONFIG.shippingText}`,
      ``,
      `*Customer Details*`,
      `Name: ${data.name.trim()}`,
      `Phone: ${data.phone.trim()}`,
      `Address: ${data.street.trim()}, Landmark: ${data.landmark.trim()}, ${data.city.trim()}, ${data.state.trim()} - ${data.pincode.trim()}`,
      `Note: ${data.note && data.note.trim() ? data.note.trim() : "None"}`,
      ``,
      `*Notice:* No payment has been made. Payment will not be processed until admin verifies stock availability and takes my approval to pack the order.`
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

  function submitOrder(e) {
    e.preventDefault();
    if (state.cart.length === 0) { toast("Your cart is empty"); return; }
    const form = e.currentTarget;
    if (!validateForm(form)) return;

    const orderId = generateOrderId();
    const text = buildOrderText(orderId, getFormData(form));
    state.lastOrderText = text;
    const url = "https://wa.me/" + STORE_CONFIG.whatsappNumber + "?text=" + encodeURIComponent(text);
    const win = window.open(url, "_blank", "noopener");
    if (!win) window.location.href = url; // popup blocked fallback

    toast(`Order ${orderId} sent to WhatsApp ✓`);
    state.cart = []; saveCart(); renderCart();
    form.reset();
    closeAll();
  }

  async function copySummary() {
    const form = $("#checkoutForm");
    if (state.cart.length === 0) { toast("Your cart is empty"); return; }
    if (!validateForm(form)) return;
    const text = buildOrderText(generateOrderId(), getFormData(form));
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
      if (state.cart.length === 0) return;
      closeDrawer(); openModal("checkoutModal");
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
    // digits only
    ["phone", "pincode"].forEach((n) => {
      form.elements[n].addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, ""); });
    });
  }

  function setCategory(cat) {
    state.category = cat;
    $$(".pill").forEach((p) => p.classList.toggle("active", p.dataset.cat === cat));
    renderProducts();
  }

  /* ---------- Init ---------- */
  initStoreInfo();
  bindEvents();
  renderProducts();
  renderCart();
  observeReveals();
})();
