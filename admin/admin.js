/* =====================================================================
   OtakuOriginals — Admin console
   Login is checked on the server (Google Apps Script), not in this file.
   ===================================================================== */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
  const URL_ = (STORE_CONFIG.sheetWebhookUrl || "").trim();
  const TOKEN_KEY = "oo_admin_token";
  const state = { token: "", orders: [], products: [], discounts: [], options: { categories: [], badges: [], custom: { categories: [], badges: [] } }, view: "overview", filter: "all", sel: null, editing: null, images: [], loaded: 0 };
  try { state.token = sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { /* ignore */ }

  /* ---------- helpers ---------- */
  let toastT;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }
  function ago(iso) {
    const t = Date.parse(iso); if (!t) return "";
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "just now"; if (m < 60) return m + " min ago";
    const h = Math.round(m / 60); if (h < 24) return h + " hr ago";
    const d = Math.round(h / 24); if (d < 30) return d + " day" + (d > 1 ? "s" : "") + " ago";
    return new Date(t).toLocaleDateString("en-IN");
  }
  const phone91 = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 ? "91" + d : d; };

  async function api(payload, withToken = true) {
    if (!URL_) throw new Error("Your Google Sheet link is not set. Add sheetWebhookUrl in settings.js.");
    const body = JSON.stringify(withToken ? Object.assign({ token: state.token }, payload) : payload);
    let r;
    try { r = await fetch(URL_, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body }); }
    catch (e) { throw new Error("Cannot reach your Google script. Check the web app link in settings.js ends with /exec and the deployment access is set to Anyone."); }
    let d;
    try { d = await r.json(); } catch (e) { throw new Error("Google did not return data. Open Deploy > Manage deployments, set access to Anyone, and deploy a New version."); }
    if (d && d.error === "unauthorized") { signOut("Your session ended. Please sign in again."); throw new Error("Session ended"); }
    return d;
  }

  /* ---------- connection check (login screen) ---------- */
  async function checkConn() {
    const box = $("#conn"), txt = $("#connText");
    const set = (s, m) => { box.dataset.s = s; txt.textContent = m; };
    if (!URL_) { set("bad", "Google Sheet link is not set. Add sheetWebhookUrl in settings.js on GitHub."); return; }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(URL_)) { set("bad", "The link in settings.js must look like https://script.google.com/macros/s/…/exec"); return; }
    try {
      const r = await fetch(URL_ + "?action=ping");
      const d = await r.json();
      if (!d || !d.version) set("warn", "Connected, but an OLD script version is running. In Apps Script: Deploy > Manage deployments > Edit > New version > Deploy.");
      else if (!d.adminReady) set("warn", "Connected, but ADMIN_USER / ADMIN_PASS are not set in Script properties.");
      else set("ok", "Connected to your Google Sheet (script v" + d.version + ")");
    } catch (e) { set("bad", "Cannot reach your Google script. Check the link ends with /exec and Deploy access is set to Anyone."); }
  }

  /* ---------- sign in / out ---------- */
  function showApp() { $("#loginView").hidden = true; $("#appView").hidden = false; go(state.view); loadAll(); }
  function signOut(msg) {
    state.token = ""; try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    closeDrawer(); $("#appView").hidden = true; $("#loginView").hidden = false; $("#pass").value = "";
    $("#loginErr").textContent = msg || ""; checkConn();
  }
  $("#pwToggle").addEventListener("click", () => {
    const p = $("#pass"), show = p.type === "password"; p.type = show ? "text" : "password"; $("#pwToggle").textContent = show ? "Hide" : "Show";
  });
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn"); $("#loginErr").textContent = ""; btn.disabled = true; btn.textContent = "Signing in…";
    try {
      const d = await api({ type: "adminLogin", user: $("#user").value.trim(), pass: $("#pass").value.trim() }, false);
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
      const [o, p, d] = await Promise.all([api({ type: "adminOrders" }), api({ type: "adminProducts" }), api({ type: "adminDiscounts" })]);
      state.orders = (o && o.orders) || []; state.products = (p && p.products) || []; state.discounts = (d && d.discounts) || [];
      if (p && p.options) state.options = p.options;
      state.loaded = Date.now(); render(); if (manual) toast("Updated");
    } catch (err) { if (err.message !== "Session ended") toast(err.message); }
  }

  /* ---------- order stages ---------- */
  function stage(o) {
    const r = o.rank, cod = String(o.method || "").toUpperCase() === "COD";
    if (r <= 3) return { k: "aband", t: "Abandoned", c: "gray", sub: o.status };
    if (r === 4) return cod ? { k: "new", t: "New COD order", c: "blue" } : { k: "new", t: "UPI app opened", c: "amber", sub: "Check your UPI app" };
    if (r === 5) return cod ? { k: "new", t: "New COD order", c: "blue" } : { k: "new", t: "Paid? Verify", c: "amber", sub: "Customer says paid" };
    if (r === 6) return { k: "confirmed", t: "Confirmed", c: "green" };
    if (r === 7) return { k: "shipped", t: "Shipped", c: "purple" };
    if (r === 8) return { k: "delivered", t: "Delivered", c: "green" };
    return { k: "cancelled", t: "Cancelled", c: "red" };
  }
  const isOrder = (o) => o.rank >= 4;
  const isAband = (o) => o.rank <= 3;
  const FILTERS = [["all", "All"], ["new", "New"], ["confirmed", "Confirmed"], ["shipped", "Shipped"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]];

  /* ---------- navigation ---------- */
  const TITLES = {
    overview: ["Overview", "What needs your attention right now."],
    orders: ["Orders", "Real orders. Verify the payment in your UPI app, then confirm and ship."],
    discounts: ["Discounts", "Create offers for everyone or private voucher codes for creators and customers."],
    products: ["Products", "Manage what your store sells."]
  };
  function go(v) {
    state.view = v; state.filter = "all"; $("#orderSearch").value = "";
    $$("#nav button").forEach((b) => b.classList.toggle("on", b.dataset.view === v));
    $("#viewTitle").textContent = TITLES[v][0]; $("#viewSub").textContent = TITLES[v][1];
    $("#vOverview").hidden = v !== "overview"; $("#vOrders").hidden = v !== "orders"; $("#vDiscounts").hidden = v !== "discounts"; $("#vProducts").hidden = v !== "products";
    render(); window.scrollTo(0, 0);
  }
  $("#nav").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) go(b.dataset.view); });
  document.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) go(g.dataset.go); });

  function render() {
    const nNew = state.orders.filter((o) => o.rank === 4 || o.rank === 5).length;
    $("#nOrders").textContent = state.orders.filter(isOrder).length; $("#nOrders").classList.toggle("hot", nNew > 0);
    $("#nDisc").textContent = state.discounts.filter((d) => d.state === "active").length; $("#nProducts").textContent = state.products.length;
    $("#updated").textContent = state.loaded ? "Updated " + new Date(state.loaded).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
    if (state.view === "overview") renderOverview(); else if (state.view === "products") renderProducts(); else if (state.view === "discounts") renderDiscounts(); else renderOrders();
    if (state.sel) renderDrawer();
  }

  /* ---------- rows ---------- */
  function row(o) {
    const st = stage(o);
    return `<div class="row" data-open="${esc(o.id)}" tabindex="0">
      <div><div class="r-name">${esc(o.name || "(no name yet)")}</div><div class="r-sub">${esc(o.phone)} · ${esc(o.id)}</div></div>
      <div class="r-items">${esc(o.items) || "—"}</div>
      <div class="r-amt"><b>${inr(o.total)}</b><span class="r-sub">${esc(o.method || "")}</span></div>
      <div class="r-stage"><span class="badge ${st.c}">${esc(st.t)}</span><span class="r-sub">${st.sub ? esc(st.sub) + " · " : ""}${esc(ago(o.updated))}</span></div>
    </div>`;
  }
  document.addEventListener("click", (e) => { const r = e.target.closest("[data-open]"); if (r) openDrawer(r.dataset.open); });
  document.addEventListener("keydown", (e) => { if (e.key === "Enter") { const r = e.target.closest("[data-open]"); if (r) openDrawer(r.dataset.open); } });

  /* ---------- overview ---------- */
  function renderOverview() {
    const O = state.orders, today = new Date().toDateString();
    const fresh = O.filter((o) => o.rank === 4 || o.rank === 5), live = state.discounts.filter((d) => d.state === "active");
    const todayN = O.filter((o) => isOrder(o) && Date.parse(o.first) && new Date(o.first).toDateString() === today).length;
    const rev = O.filter((o) => o.rank >= 6 && o.rank <= 8).reduce((s, o) => s + o.total, 0);
    $("#kpis").innerHTML = [
      [`New orders to verify`, fresh.length, "check payment, then confirm", fresh.length ? "alert" : ""],
      [`Active discounts`, live.length, "running on your store right now", ""],
      [`Orders today`, todayN, "placed since midnight", ""],
      [`Confirmed revenue`, inr(rev), "confirmed, shipped or delivered", ""]
    ].map((k) => `<div class="kpi ${k[3]}"><span>${k[0]}</span><b>${k[1]}</b><small>${k[2]}</small></div>`).join("");
    $("#ovNew").innerHTML = fresh.length ? fresh.slice(0, 6).map(row).join("") : `<div class="empty">Nothing to verify. 🎉</div>`;
    $("#ovDisc").innerHTML = live.length ? live.slice(0, 5).map(discRow).join("") : `<div class="empty">No discounts running. Create one in Discounts.</div>`;
  }

  /* ---------- orders / abandoned ---------- */
  function renderOrders() {
    const ab = false;
    const base = state.orders.filter(isOrder);
    $("#chips").innerHTML = FILTERS.map(([k, l]) => {
      const n = k === "all" ? base.length : base.filter((o) => stage(o).k === k).length;
      return `<button class="chip ${state.filter === k ? "on" : ""}" data-f="${k}">${l}<b>${n}</b></button>`;
    }).join("");
    const q = $("#orderSearch").value.trim().toLowerCase();
    let list = base.filter((o) => ab || state.filter === "all" || stage(o).k === state.filter);
    if (q) list = list.filter((o) => (o.name + " " + o.phone + " " + o.id).toLowerCase().includes(q));
    $("#orderList").innerHTML = list.length ? list.map(row).join("") : `<div class="empty">No orders here yet.</div>`;
  }
  $("#chips").addEventListener("click", (e) => { const c = e.target.closest("[data-f]"); if (c) { state.filter = c.dataset.f; renderOrders(); } });
  $("#orderSearch").addEventListener("input", renderOrders);

  /* ---------- order drawer ---------- */
  function openDrawer(id) { state.sel = id; $("#drawerWrap").hidden = false; document.body.style.overflow = "hidden"; renderDrawer(); }
  function closeDrawer() { state.sel = null; $("#drawerWrap").hidden = true; document.body.style.overflow = ""; }
  $("#drawerScrim").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeForm(); closeDiscountForm(); } });

  function renderDrawer() {
    const o = state.orders.find((x) => x.id === state.sel); if (!o) { closeDrawer(); return; }
    const st = stage(o), cod = String(o.method || "").toUpperCase() === "COD";
    const addr = [o.street, o.landmark, o.city, o.state, o.pincode].filter(Boolean).join(", ");
    const aband = o.rank <= 3;
    const wa = "https://wa.me/" + phone91(o.phone) + "?text=" + encodeURIComponent(aband
      ? `Hi ${o.name || "there"}, this is Piyush from OtakuOriginals 👋 I saw you were placing an order${o.items ? " (" + o.items.split(";")[0] + ")" : ""} but it didn't go through. Can I help you complete it?`
      : `Hi ${o.name || "there"}, this is Piyush from OtakuOriginals 👋 about your order ${o.id}.`);
    const actions = [];
    if (o.rank >= 4 && o.rank <= 5) actions.push(`<button class="btn primary" data-st="confirmed">✓ ${cod ? "Confirm order" : "Payment received — confirm"}</button>`);
    if (o.rank === 6) actions.push(`<button class="btn primary" data-st="shipped">Mark shipped</button>`);
    if (o.rank === 7) actions.push(`<button class="btn primary" data-st="delivered">Mark delivered</button>`);
    if (o.rank >= 4 && o.rank <= 7) actions.push(`<button class="btn danger" data-st="cancelled">Cancel order</button>`);
    if (o.rank >= 8 && o.rank !== 8 || o.rank === 9) actions.push(`<button class="btn" data-st="reopen">Reopen</button>`);
    $("#drawer").innerHTML = `
      <div class="d-head"><div><h2>${esc(o.name || "(no name yet)")}</h2><div class="r-sub">${esc(o.id)} · ${esc(ago(o.updated))}</div>
        <div style="margin-top:8px"><span class="badge ${st.c}">${esc(st.t)}</span></div></div>
        <button class="x" id="dClose" aria-label="Close">✕</button></div>
      <div class="d-sec"><h3>Contact</h3>
        <div class="d-actions">
          <a class="btn primary sm" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>
          <a class="btn sm" href="tel:${esc(o.phone)}">Call ${esc(o.phone)}</a>
        </div>
        ${addr ? `<div class="addr">${esc(addr)}</div><button class="btn sm" style="margin-top:8px" data-copy="${esc(o.name + ", " + o.phone + ", " + addr)}">Copy address</button>` : `<p class="hint">No address entered yet.</p>`}
        ${o.note ? `<p class="hint">Customer note: ${esc(o.note)}</p>` : ""}
      </div>
      <div class="d-sec"><h3>Items</h3><div>${esc(o.items) || "—"}</div></div>
      <div class="d-sec"><h3>Payment</h3>
        <div class="kv"><span>Method</span><span>${cod ? "Cash on Delivery" : "UPI"}</span></div>
        <div class="kv"><span>Subtotal</span><span>${inr(o.subtotal)}</span></div>
        ${o.discount ? `<div class="kv"><span>Discount${o.code ? " (code " + esc(o.code) + ")" : ""}</span><span>−${inr(o.discount)}</span></div>` : ""}
        ${o.upiDiscount ? `<div class="kv"><span>UPI discount</span><span>−${inr(o.upiDiscount)}</span></div>` : ""}
        <div class="kv"><span>Delivery</span><span>${esc(o.delivery || "FREE")}</span></div>
        <div class="kv total"><span>${cod ? "Collect on delivery" : "Amount to receive"}</span><span>${inr(o.total)}</span></div>
        ${o.utr ? `<div class="kv"><span>UTR / ref</span><span>${esc(o.utr)}</span></div>` : ""}
        ${!cod && o.rank >= 4 && o.rank <= 5 ? `<p class="hint">Open your UPI app and look for ${inr(o.total)} with the note “Order ${esc(o.id)}”. The website cannot confirm payment by itself.</p>` : ""}
      </div>
      ${actions.length ? `<div class="d-sec"><h3>Order status</h3><div class="d-actions">${actions.join("")}</div></div>` : ""}
      <div class="d-sec"><h3>Follow-up notes</h3>
        ${o.followup ? `<div class="notes">${esc(o.followup)}</div>` : `<p class="hint" style="margin:0 0 10px">No notes yet.</p>`}
        <div class="note-add"><input type="text" id="noteInput" maxlength="200" placeholder="e.g. Called, will pay tonight"><button class="btn dark" id="noteSave">Save</button></div>
      </div>`;
  }
  $("#drawer").addEventListener("click", async (e) => {
    if (e.target.closest("#dClose")) { closeDrawer(); return; }
    const cp = e.target.closest("[data-copy]");
    if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copy); toast("Address copied"); } catch (x) { toast("Could not copy"); } return; }
    const o = state.orders.find((x) => x.id === state.sel); if (!o) return;
    const st = e.target.closest("[data-st]");
    if (st) {
      if (st.dataset.st === "cancelled" && !confirm("Cancel this order?")) return;
      st.disabled = true;
      try {
        const d = await api({ type: "adminSetStatus", orderId: o.id, status: st.dataset.st });
        if (d.ok) { o.status = d.status; o.rank = d.rank; o.updated = new Date().toISOString(); render(); toast("Order updated"); }
        else { toast(d.error || "Could not update"); st.disabled = false; }
      } catch (err) { toast(err.message); st.disabled = false; }
      return;
    }
    if (e.target.closest("#noteSave")) {
      const v = $("#noteInput").value.trim(); if (!v) return;
      try {
        const d = await api({ type: "adminNote", orderId: o.id, note: v });
        if (d.ok) { o.followup = d.followup; render(); toast("Note saved"); } else toast(d.error || "Could not save");
      } catch (err) { toast(err.message); }
    }
  });

  /* ---------- products ---------- */
  function renderProducts() {
    $("#productList").innerHTML = state.products.length ? state.products.map((p) => `
      <div class="prow">
        <img src="${esc(p.image || "")}" alt="" onerror="this.style.visibility='hidden'">
        <div>
          <div class="p-name">${esc(p.name)}</div>
          <div class="p-meta">${esc(p.category)}${p.badge ? " · " + esc(p.badge) : ""} · ${inr(p.price)}${p.originalPrice > p.price ? ` <s>${inr(p.originalPrice)}</s>` : ""} · ID ${p.id}</div>
          <div class="tags"><span class="badge ${p.inStock ? "green" : "red"}">${p.inStock ? "In stock" : "Out of stock"}</span>${p.active ? "" : '<span class="badge gray">Hidden</span>'}</div>
        </div>
        <div class="p-actions">
          <button class="btn sm" data-edit="${p.id}">Edit</button>
          <button class="btn sm" data-stock="${p.id}">${p.inStock ? "Mark out of stock" : "Mark in stock"}</button>
          <button class="btn sm" data-vis="${p.id}">${p.active ? "Hide" : "Show"}</button>
          <button class="btn danger sm" data-del="${p.id}">Delete</button>
        </div>
      </div>`).join("") :
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

  /* ---------- discounts ---------- */
  const STATE_BADGE = { active: ["green", "Active"], scheduled: ["blue", "Scheduled"], expired: ["gray", "Expired"], off: ["gray", "Paused"] };
  function discValue(d) { return d.type === "flat" ? inr(d.value) + " off" : d.value + "% off"; }
  function discWhen(d) {
    if (!d.start && !d.end) return "Lifetime";
    const f = (s) => s ? new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "…";
    return f(d.start) + " → " + f(d.end);
  }
  function discRow(d) {
    const sb = STATE_BADGE[d.state] || STATE_BADGE.off;
    return `<div class="drow">
      <div><div class="d-title">${esc(d.title)}</div>
        <div class="r-sub">${d.autoApply ? "Applied automatically" : `Code <span class="codechip">${esc(d.code)}</span>`}${d.min ? " · min " + inr(d.min) : ""}</div></div>
      <div><b>${discValue(d)}</b><div class="r-sub">${esc(discWhen(d))}</div></div>
      <div><span class="badge ${sb[0]}">${sb[1]}</span>
        <div class="r-sub">${d.showOnSite ? "Shown on main page" : "Not on main page"}${d.code ? " · used " + d.uses + (d.maxUses ? "/" + d.maxUses : "") : ""}</div></div>
      <div class="p-actions">
        <button class="btn sm" data-dedit="${d.id}">Edit</button>
        <button class="btn sm" data-dpause="${d.id}">${d.active ? "Pause" : "Resume"}</button>
        <button class="btn danger sm" data-ddel="${d.id}">Delete</button>
      </div></div>`;
  }
  function renderDiscounts() {
    $("#discountList").innerHTML = state.discounts.length ? state.discounts.map(discRow).join("") :
      `<div class="empty">No discounts yet. Tap “Create discount” to make your first one.</div>`;
  }
  $("#discountList").addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const find = (id) => state.discounts.find((d) => d.id === +id);
    if (b.dataset.dedit) { openDiscountForm(find(b.dataset.dedit)); return; }
    if (b.dataset.ddel) {
      const d = find(b.dataset.ddel);
      if (!confirm(`Delete “${d.title}”? Customers will no longer be able to use it.`)) return;
      try { const r = await api({ type: "adminDeleteDiscount", id: d.id }); if (r.ok) { toast("Deleted"); loadAll(); } else toast(r.error || "Could not delete"); } catch (err) { toast(err.message); }
      return;
    }
    if (b.dataset.dpause) {
      const d = find(b.dataset.dpause); b.disabled = true;
      try { const r = await api({ type: "adminSaveDiscount", discount: Object.assign({}, d, { active: !d.active }) }); if (r.ok) { toast(d.active ? "Paused" : "Resumed"); loadAll(); } else toast(r.error || "Could not update"); } catch (err) { toast(err.message); }
    }
  });
  $("#addDiscountBtn").addEventListener("click", () => openDiscountForm(null));

  const df = () => $("#discountForm");
  function syncDiscountForm() {
    const f = df(), code = f.mode.value === "code";
    $("#codeFields").hidden = !code; $("#dateFields").hidden = f.dur.value !== "range";
  }
  function openDiscountForm(d) {
    const f = df(); f.reset(); $("#discountErr").textContent = ""; state.editingDisc = d ? d.id : null;
    $("#discountFormTitle").textContent = d ? "Edit discount" : "Create discount";
    if (d) {
      f.title.value = d.title; f.type.value = d.type; f.value.value = d.value; f.min.value = d.min || "";
      f.mode.value = d.autoApply ? "auto" : "code"; f.code.value = d.code || ""; f.maxUses.value = d.maxUses || "";
      f.dur.value = d.start || d.end ? "range" : "life"; f.start.value = d.start || ""; f.end.value = d.end || "";
      f.showOnSite.checked = !!d.showOnSite; f.description.value = d.description || ""; f.active.checked = d.active !== false;
    }
    syncDiscountForm(); $("#discountModal").hidden = false; document.body.style.overflow = "hidden";
  }
  function closeDiscountForm() { if ($("#discountModal").hidden) return; $("#discountModal").hidden = true; document.body.style.overflow = state.sel ? "hidden" : ""; }
  $("#discountClose").addEventListener("click", closeDiscountForm);
  $("#discountCancel").addEventListener("click", closeDiscountForm);
  $("#discountModal").addEventListener("click", (e) => { if (e.target.id === "discountModal") closeDiscountForm(); });
  df().addEventListener("change", syncDiscountForm);
  $("#genCode").addEventListener("click", () => {
    const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let c = "OTAKU";
    for (let i = 0; i < 4; i++) c += abc[Math.floor(Math.random() * abc.length)];
    df().code.value = c;
  });
  df().code.addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""); });
  df().addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = df(), err = $("#discountErr"); err.textContent = "";
    const auto = f.mode.value === "auto", range = f.dur.value === "range", value = Number(f.value.value);
    if (f.title.value.trim().length < 2) { err.textContent = "Please enter a title."; return; }
    if (!(value > 0)) { err.textContent = "Please enter the discount value."; return; }
    if (f.type.value === "percent" && value > 90) { err.textContent = "Percent discount can be at most 90."; return; }
    if (!auto && f.code.value.trim().length < 3) { err.textContent = "Please enter a code (3 to 20 letters or numbers), or tap Generate."; return; }
    if (range && !f.start.value && !f.end.value) { err.textContent = "Pick a start date, an end date, or both."; return; }
    if (range && f.start.value && f.end.value && f.end.value < f.start.value) { err.textContent = "The end date is before the start date."; return; }
    const btn = $("#discountSave"); btn.disabled = true; btn.textContent = "Saving…";
    try {
      const r = await api({ type: "adminSaveDiscount", discount: {
        id: state.editingDisc, title: f.title.value.trim(), type: f.type.value, value, min: Number(f.min.value) || 0,
        autoApply: auto, code: auto ? "" : f.code.value.trim(), maxUses: auto ? 0 : (Number(f.maxUses.value) || 0),
        start: range ? f.start.value : "", end: range ? f.end.value : "", showOnSite: f.showOnSite.checked,
        description: f.description.value.trim(), active: f.active.checked } });
      if (r.ok) { closeDiscountForm(); toast("Discount saved"); await loadAll(); } else err.textContent = r.error || "Could not save.";
    } catch (x) { err.textContent = x.message; }
    btn.disabled = false; btn.textContent = "Save discount";
  });

  /* ---------- product form ---------- */
  function openForm(p) {
    const f = $("#productForm"); f.reset(); $("#productErr").textContent = "";
    fillOptions(p ? p.category : "", p ? p.badge : "");
    state.editing = p ? p.id : null;
    state.images = p ? (p.images || []).slice() : [];
    $("#productFormTitle").textContent = p ? "Edit product" : "Add product";
    if (p) {
      f.name.value = p.name; f.category.value = p.category; f.badge.value = p.badge || ""; syncOptButtons();
      f.price.value = p.price; f.originalPrice.value = p.originalPrice || "";
      f.description.value = p.description || ""; f.inStock.checked = !!p.inStock; f.active.checked = p.active !== false;
    }
    drawThumbs(); $("#productModal").hidden = false; document.body.style.overflow = "hidden";
  }
  /* categories & badges you can extend */
  function fillOptions(cat, badge) {
    const o = state.options, f = $("#productForm");
    const cats = o.categories.slice(); if (cat && !cats.includes(cat)) cats.push(cat);
    const badges = o.badges.slice(); if (badge && !badges.includes(badge)) badges.push(badge);
    f.category.innerHTML = cats.map((c) => `<option>${esc(c)}</option>`).join("");
    f.badge.innerHTML = '<option value="">None</option>' + badges.map((b) => `<option>${esc(b)}</option>`).join("");
    if (cat) f.category.value = cat;
    f.badge.value = badge || "";
    syncOptButtons();
  }
  function usedBy(kind, val) { return state.products.some((p) => (kind === "badge" ? p.badge : p.category) === val); }
  function syncOptButtons() {
    const f = $("#productForm"), c = state.options.custom || { categories: [], badges: [] };
    $("#catRemove").hidden = !(c.categories.includes(f.category.value) && !usedBy("category", f.category.value));
    $("#badgeRemove").hidden = !(f.badge.value && c.badges.includes(f.badge.value) && !usedBy("badge", f.badge.value));
  }
  $("#productForm").addEventListener("change", (e) => { if (e.target.id === "catSelect" || e.target.id === "badgeSelect") syncOptButtons(); });
  async function addOption(kind) {
    const v = (prompt(kind === "badge" ? "New badge name (e.g. Hot Deal):" : "New category name (e.g. Keychains):") || "").trim();
    if (!v) return;
    try {
      const r = await api({ type: "adminAddOption", kind, value: v });
      if (!r.ok) { toast(r.error || "Could not add"); return; }
      state.options = r.options; const f = $("#productForm"), keepC = f.category.value, keepB = f.badge.value;
      fillOptions(kind === "badge" ? keepC : v, kind === "badge" ? v : keepB); toast("Added");
    } catch (err) { toast(err.message); }
  }
  async function removeOption(kind) {
    const f = $("#productForm"), v = kind === "badge" ? f.badge.value : f.category.value;
    if (!v || !confirm(`Remove “${v}” from the list?`)) return;
    try {
      const r = await api({ type: "adminRemoveOption", kind, value: v });
      if (r.ok) { state.options = r.options; fillOptions(kind === "badge" ? f.category.value : "", ""); toast("Removed"); }
    } catch (err) { toast(err.message); }
  }
  $("#catAdd").addEventListener("click", () => addOption("category"));
  $("#badgeAdd").addEventListener("click", () => addOption("badge"));
  $("#catRemove").addEventListener("click", () => removeOption("category"));
  $("#badgeRemove").addEventListener("click", () => removeOption("badge"));

  function closeForm() { if ($("#productModal").hidden) return; $("#productModal").hidden = true; document.body.style.overflow = state.sel ? "hidden" : ""; }
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
  checkConn();
  if (state.token && URL_) showApp();
})();
