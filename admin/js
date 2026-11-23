/* =====================================================================
   OtakuOriginals — Admin panel
   Login is checked on the server (Google Apps Script), not in this file.
   ===================================================================== */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const URL_ = STORE_CONFIG.sheetWebhookUrl;
  const TOKEN_KEY = "oo_admin_token";
  const state = { token: "", orders: [], products: [], tab: "abandoned", editing: null, images: [] };
  try { state.token = sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { /* ignore */ }

  /* ---------- helpers ---------- */
  let toastT;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }

  async function api(payload, withToken = true) {
    if (!URL_) throw new Error("Your Google Sheet link is not set. Add sheetWebhookUrl in settings.js.");
    const body = JSON.stringify(withToken ? Object.assign({ token: state.token }, payload) : payload);
    const r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
    let d;
    try { d = await r.json(); } catch (e) { throw new Error("Could not read the server reply. Check the deployment (Anyone can access) and the URL."); }
    if (d && d.error === "unauthorized") { signOut("Your session ended. Please sign in again."); throw new Error("Session ended"); }
    return d;
  }

  function ago(iso) {
    const t = Date.parse(iso); if (!t) return "";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); if (h < 24) return h + " hr ago";
    const d = Math.round(h / 24); if (d < 30) return d + " day" + (d > 1 ? "s" : "") + " ago";
    return new Date(t).toLocaleDateString("en-IN");
  }
  const phone91 = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 ? "91" + d : d; };

  /* ---------- sign in / out ---------- */
  function showApp() { $("#loginView").hidden = true; $("#appView").hidden = false; loadAll(); }
  function signOut(msg) {
    state.token = ""; try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    $("#appView").hidden = true; $("#loginView").hidden = false; $("#pass").value = "";
    $("#loginErr").textContent = msg || "";
  }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn"); $("#loginErr").textContent = ""; btn.disabled = true; btn.textContent = "Signing in…";
    try {
      const d = await api({ type: "adminLogin", user: $("#user").value.trim(), pass: $("#pass").value }, false);
      if (d && d.ok && d.token) {
        state.token = d.token; try { sessionStorage.setItem(TOKEN_KEY, d.token); } catch (x) { /* ignore */ }
        $("#pass").value = ""; showApp();
      } else $("#loginErr").textContent = (d && d.error) || "Could not sign in.";
    } catch (err) { $("#loginErr").textContent = err.message; }
    btn.disabled = false; btn.textContent = "Sign in";
  });
  $("#logoutBtn").addEventListener("click", async () => { try { await api({ type: "adminLogout" }); } catch (e) { /* ignore */ } signOut(""); });
  $("#refreshBtn").addEventListener("click", () => loadAll(true));

  /* ---------- data ---------- */
  async function loadAll(manual) {
    try {
      const [o, p] = await Promise.all([api({ type: "adminOrders" }), api({ type: "adminProducts" })]);
      state.orders = (o && o.orders) || []; state.products = (p && p.products) || [];
      renderAll(); if (manual) toast("Updated");
    } catch (err) { if (err.message !== "Session ended") toast(err.message); }
  }
  function renderAll() { renderCounts(); renderTab(); }

  /* ---------- tabs ---------- */
  const isAband = (o) => o.rank <= 3;
  function renderCounts() {
    $("#cntAband").textContent = state.orders.filter(isAband).length;
    $("#cntOrders").textContent = state.orders.length;
    $("#cntProducts").textContent = state.products.length;
  }
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest(".tab"); if (!b) return;
    state.tab = b.dataset.tab; $$(".tab").forEach((t) => t.classList.toggle("on", t === b)); renderTab();
  });
  $("#orderSearch").addEventListener("input", renderTab);
  function renderTab() {
    const prod = state.tab === "products";
    $("#panelOrders").hidden = prod; $("#panelProducts").hidden = !prod;
    if (prod) renderProducts(); else renderOrders();
  }

  /* ---------- orders ---------- */
  function renderOrders() {
    const ab = state.tab === "abandoned";
    $("#ordersHelp").textContent = ab
      ? "People who started checkout but did not finish. Message them on WhatsApp to help."
      : "Every checkout saved in your sheet, newest first.";
    const q = $("#orderSearch").value.trim().toLowerCase();
    let list = state.orders.filter((o) => (ab ? isAband(o) : true));
    if (q) list = list.filter((o) => (o.name + " " + o.phone + " " + o.id).toLowerCase().includes(q));
    $("#orderList").innerHTML = list.length ? list.map(orderCard).join("") :
      `<div class="empty">${ab ? "No abandoned checkouts. 🎉" : "No orders yet."}</div>`;
  }
  function orderCard(o) {
    const wa = "https://wa.me/" + phone91(o.phone) + "?text=" + encodeURIComponent(
      `Hi ${o.name || "there"}, this is Piyush from OtakuOriginals 👋 I saw you were placing an order${o.items ? " (" + o.items.split(";")[0] + ")" : ""} but it didn't go through. Can I help you complete it?`);
    const addr = [o.street, o.landmark, o.city, o.state, o.pincode].filter(Boolean).join(", ");
    return `<article class="o-card" data-id="${esc(o.id)}">
      <div class="o-top"><span class="st r${o.rank}">${esc(o.status)}</span><span class="when">${esc(ago(o.updated))}</span></div>
      <div><div class="o-name">${esc(o.name || "(no name yet)")}<a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></div><div class="o-id">${esc(o.id)}</div></div>
      <div class="o-items">${esc(o.items)}</div>
      <div class="o-meta"><span><b>${inr(o.total)}</b> ${esc(o.method || "")}</span>${o.upiDiscount ? `<span>UPI discount −${inr(o.upiDiscount)}</span>` : ""}${o.utr ? `<span>UTR ${esc(o.utr)}</span>` : ""}</div>
      ${addr ? `<div class="o-addr">📍 ${esc(addr)}</div>` : ""}
      ${o.note ? `<div class="o-addr">Customer note: ${esc(o.note)}</div>` : ""}
      ${o.followup ? `<div class="o-notes">${esc(o.followup)}</div>` : ""}
      <div class="o-actions">
        <a class="btn primary sm" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="btn ghost sm" href="tel:${esc(o.phone)}">Call</a>
        <button class="btn ghost sm" data-note="${esc(o.id)}">Mark contacted</button>
      </div>
    </article>`;
  }
  $("#orderList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-note]"); if (!b) return;
    const note = prompt("Note for this customer:", "Contacted on WhatsApp");
    if (note === null) return;
    b.disabled = true;
    try {
      const d = await api({ type: "adminNote", orderId: b.dataset.note, note: note.trim() || "Contacted" });
      if (d.ok) { const o = state.orders.find((x) => x.id === b.dataset.note); if (o) o.followup = d.followup; renderOrders(); toast("Saved"); }
      else toast(d.error || "Could not save");
    } catch (err) { toast(err.message); }
    b.disabled = false;
  });

  /* ---------- products ---------- */
  function renderProducts() {
    $("#productList").innerHTML = state.products.length ? state.products.map((p) => `
      <article class="p-card" data-pid="${p.id}">
        <img src="${esc(p.image || "")}" alt="" onerror="this.style.visibility='hidden'">
        <div>
          <div class="p-name">${esc(p.name)}</div>
          <div class="p-meta">${esc(p.category)}${p.badge ? " · " + esc(p.badge) : ""} · ID ${p.id}</div>
          <div class="p-price"><b>${inr(p.price)}</b>${p.originalPrice > p.price ? `<s>${inr(p.originalPrice)}</s>` : ""}</div>
          <div style="margin-top:6px"><span class="tag ${p.inStock ? "in" : "out"}">${p.inStock ? "In stock" : "Out of stock"}</span>${p.active ? "" : '<span class="tag hide">Hidden</span>'}</div>
        </div>
        <div class="p-actions">
          <button class="btn ghost sm" data-edit="${p.id}">Edit</button>
          <button class="btn ghost sm" data-stock="${p.id}">${p.inStock ? "Mark out of stock" : "Mark in stock"}</button>
          <button class="btn ghost sm" data-vis="${p.id}">${p.active ? "Hide" : "Show"}</button>
          <button class="btn danger sm" data-del="${p.id}">Delete</button>
        </div>
      </article>`).join("") :
      `<div class="empty">No products yet. Tap “Add product” to add your first one.<br>Until then your website shows its sample product.</div>`;
  }
  $("#productList").addEventListener("click", async (e) => {
    const t = e.target.closest("button"); if (!t) return;
    const find = (id) => state.products.find((p) => p.id === +id);
    if (t.dataset.edit) { openForm(find(t.dataset.edit)); return; }
    if (t.dataset.del) {
      const p = find(t.dataset.del);
      if (!confirm(`Delete “${p.name}” permanently?`)) return;
      try { const d = await api({ type: "adminDeleteProduct", id: p.id }); if (d.ok) { toast("Deleted"); loadAll(); } else toast(d.error || "Could not delete"); } catch (err) { toast(err.message); }
      return;
    }
    const p = find(t.dataset.stock || t.dataset.vis); if (!p) return;
    const upd = Object.assign({}, p, t.dataset.stock ? { inStock: !p.inStock } : { active: !p.active });
    t.disabled = true;
    try { const d = await api({ type: "adminSaveProduct", product: upd }); if (d.ok) { toast("Updated"); loadAll(); } else toast(d.error || "Could not update"); } catch (err) { toast(err.message); }
  });
  $("#addProductBtn").addEventListener("click", () => openForm(null));

  /* ---------- product form ---------- */
  function openForm(p) {
    const f = $("#productForm"); f.reset(); $("#productErr").textContent = "";
    state.editing = p ? p.id : null;
    state.images = p ? (p.images || []).slice() : [];
    $("#productFormTitle").textContent = p ? "Edit product" : "Add product";
    if (p) {
      f.name.value = p.name; f.category.value = p.category; f.badge.value = p.badge || "";
      f.price.value = p.price; f.originalPrice.value = p.originalPrice || "";
      f.description.value = p.description || ""; f.inStock.checked = !!p.inStock; f.active.checked = p.active !== false;
    }
    drawThumbs(); $("#productModal").hidden = false; document.body.style.overflow = "hidden";
  }
  function closeForm() { $("#productModal").hidden = true; document.body.style.overflow = ""; }
  $("#productClose").addEventListener("click", closeForm);
  $("#productCancel").addEventListener("click", closeForm);
  $("#productModal").addEventListener("click", (e) => { if (e.target.id === "productModal") closeForm(); });

  function drawThumbs() {
    $("#thumbs").innerHTML = state.images.map((src, i) =>
      `<div class="th ${i === 0 ? "main" : ""}"><img src="${esc(src)}" alt="Photo ${i + 1}" onerror="this.style.visibility='hidden'">
        <button type="button" class="rm" data-rm="${i}" aria-label="Remove">✕</button>
        ${i === 0 ? '<span class="mk">MAIN</span>' : `<button type="button" class="mk" data-main="${i}">Make main</button>`}</div>`).join("");
  }
  $("#thumbs").addEventListener("click", (e) => {
    const rm = e.target.closest("[data-rm]"), mk = e.target.closest("[data-main]");
    if (rm) state.images.splice(+rm.dataset.rm, 1);
    else if (mk) { const [x] = state.images.splice(+mk.dataset.main, 1); state.images.unshift(x); }
    else return;
    drawThumbs();
  });
  function compress(file, max = 1000, q = 0.78) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", q));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
      img.src = url;
    });
  }
  $("#photoFile").addEventListener("change", async (e) => {
    $("#productErr").textContent = "";
    for (const f of Array.from(e.target.files)) {
      if (state.images.length >= 5) { $("#productErr").textContent = "Up to 5 photos."; break; }
      try { state.images.push(await compress(f)); } catch (x) { $("#productErr").textContent = "Could not read one of the photos."; }
    }
    e.target.value = ""; drawThumbs();
  });
  $("#photoUrlBtn").addEventListener("click", () => {
    const u = $("#photoUrl").value.trim();
    if (!/^https:\/\//i.test(u)) { $("#productErr").textContent = "Image links must start with https://"; return; }
    if (state.images.length >= 5) { $("#productErr").textContent = "Up to 5 photos."; return; }
    state.images.push(u); $("#photoUrl").value = ""; $("#productErr").textContent = ""; drawThumbs();
  });

  $("#productForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget, err = $("#productErr"); err.textContent = "";
    const name = f.name.value.trim(), price = Number(f.price.value);
    if (name.length < 2) { err.textContent = "Please enter the product name."; return; }
    if (!(price > 0)) { err.textContent = "Please enter the selling price."; return; }
    const btn = $("#productSave"); btn.disabled = true; btn.textContent = "Saving…";
    try {
      const d = await api({ type: "adminSaveProduct", product: {
        id: state.editing, name, category: f.category.value, badge: f.badge.value, price,
        originalPrice: Number(f.originalPrice.value) || 0, description: f.description.value.trim(),
        inStock: f.inStock.checked, active: f.active.checked, images: state.images } });
      if (d.ok) { closeForm(); toast("Product saved"); await loadAll(); }
      else err.textContent = d.error || "Could not save.";
    } catch (x) { err.textContent = x.message; }
    btn.disabled = false; btn.textContent = "Save product";
  });

  /* ---------- start ---------- */
  if (!URL_) {
    $("#loginErr").textContent = "Your Google Sheet link is not set yet. Add sheetWebhookUrl in settings.js first.";
  }
  if (state.token && URL_) showApp();
})();
