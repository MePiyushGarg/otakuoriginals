/* =====================================================================
   OtakuOriginals — customer accounts (Google sign-in)
   - Sign in / sign up with Google, mandatory delivery details
   - "My account": order history, tracking, saved details
   - Checkout and reviews require an account (once Google sign-in is set up)
   The Google Client ID lives in your Apps Script Script properties
   (GOOGLE_CLIENT_ID), not in this file.
   ===================================================================== */
(function () {
  "use strict";
  const OO = window.OO, C = OO.config, esc = OO.esc, inr = OO.inr, toast = OO.toast;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const KEY = "oo_acct_v1", GID_KEY = "oo_gcid_v1";
  const URL_ = () => (C.sheetWebhookUrl || "").trim();

  let S = null;                       // { session, user:{email,name,picture}, profile, complete }
  try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.session) S = null;
  let clientId = "", cfgDone = false, cfgPromise = null, pending = null, gsiPromise = null, orders = null, tab = "orders";
  try { clientId = localStorage.getItem(GID_KEY) || ""; } catch (e) { /* ignore */ }

  const save = () => { try { S ? localStorage.setItem(KEY, JSON.stringify(S)) : localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };
  const enabled = () => !!URL_();
  const gated = () => enabled() && !!clientId;                 // customers must sign in only when Google sign-in is set up
  const ready = () => !gated() || !!(S && S.session && S.complete);

  /* ---------- server calls (readable responses) ---------- */
  async function call(payload, withSession = true) {
    if (!enabled()) return { ok: false, error: "Not available right now." };
    const body = JSON.stringify(withSession ? Object.assign({ session: S && S.session }, payload) : payload);
    const attempts = payload.type === "customerOrders" || payload.type === "customerMe" ? 2 : 1;
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      if (i) await new Promise((r) => setTimeout(r, 1200));
      const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 35000);
      try {
        const r = await fetch(URL_(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, signal: ctl.signal });
        const d = await r.json();
        if (d && d.error === "login") { signOut(true); return { ok: false, error: "Your session ended. Please sign in again.", login: true }; }
        return d;
      } catch (e) { lastErr = e; } finally { clearTimeout(tm); }
    }
    return { ok: false, error: lastErr && lastErr.name === "AbortError" ? "Google is taking too long. Please try again." : "Could not connect. Please check your internet and try again." };
  }

  /* ---------- config + Google script ---------- */
  function loadConfig() {
    if (cfgPromise) return cfgPromise;
    cfgPromise = (async () => {
      if (!enabled()) { cfgDone = true; return; }
      try {
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(URL_() + "?action=config", { signal: ctl.signal }); clearTimeout(tm);
        const d = await r.json();
        if (d && d.ok) { clientId = d.googleClientId || ""; try { localStorage.setItem(GID_KEY, clientId); } catch (e) { /* ignore */ } }
      } catch (e) { /* keep cached value */ }
      cfgDone = true; paintHeader();
    })();
    return cfgPromise;
  }
  function loadGsi() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    if (gsiPromise) return gsiPromise;
    gsiPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
      s.onload = resolve; s.onerror = () => { gsiPromise = null; reject(new Error("gsi")); };
      document.head.appendChild(s);
    });
    return gsiPromise;
  }

  /* ---------- header button ---------- */
  function initials(n) { return (String(n || "?").trim()[0] || "?").toUpperCase(); }
  function paintHeader() {
    const b = $("#acctBtn"); if (!b) return;
    b.hidden = !enabled() || (cfgDone && !clientId);
    if (S) {
      const first = String(S.user.name || S.user.email || "").split(/[\s@]/)[0];
      b.innerHTML = `<span class="av">${S.user.picture ? `<img src="${esc(S.user.picture)}" alt="" referrerpolicy="no-referrer">` : esc(initials(S.user.name || S.user.email))}</span><span class="acct-label">${esc(first)}</span>`;
      b.setAttribute("aria-label", "My account");
    } else {
      b.innerHTML = `<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span class="acct-label">Sign in</span>`;
      b.setAttribute("aria-label", "Sign in or sign up");
    }
  }

  /* ---------- modal views ---------- */
  const box = () => $("#authContent");
  function show(html) { box().innerHTML = html; }
  function openModal() { OO.openModal("authModal"); }
  function closeModal() { OO.closeModal($("#authModal")); }

  async function open(view) {
    openModal();
    show(`<p class="muted" style="padding:30px 0;text-align:center">Loading…</p>`);
    await loadConfig();
    if (!clientId) { show(`<h3>Sign-in is coming soon</h3><p class="muted">Customer accounts are not available yet. You can still order, and message us on WhatsApp for help.</p>`); return; }
    if (!S) return signInView();
    if (!S.complete) return profileView(true);
    return accountView(view || "orders");
  }

  async function signInView(reason) {
    show(`
      <h3>Sign in or create your account</h3>
      ${reason ? `<p class="auth-reason">${esc(reason)}</p>` : ""}
      <ul class="auth-perks">
        <li>Track every order and see your order history</li>
        <li>Save your delivery details for faster checkout</li>
        <li>Share reviews with the OtakuOriginals community</li>
      </ul>
      <div id="gBtn" class="gbtn"></div>
      <p class="err" id="authErr" role="alert"></p>
      <p class="consent">We use Google only to confirm your email. We never see your Google password. By continuing you agree to our Terms and Privacy Policy. If sign-in does not open in your app's built-in browser, open this page in Chrome.</p>`);
    try {
      await loadGsi();
      google.accounts.id.initialize({ client_id: clientId, callback: onCredential, ux_mode: "popup", auto_select: false });
      const w = Math.min(320, Math.max(200, (box().clientWidth || 280) - 4));
      google.accounts.id.renderButton($("#gBtn"), { theme: "filled_black", size: "large", shape: "rectangular", text: "continue_with", width: w });
    } catch (e) { $("#authErr").textContent = "Could not load Google sign-in. Please check your connection or try another browser."; }
  }

  async function onCredential(resp) {
    show(`<p class="muted" style="padding:30px 0;text-align:center">Signing you in…</p>`);
    const d = await call({ type: "customerLogin", credential: resp && resp.credential }, false);
    if (!d || !d.ok) { await signInView(); const e = $("#authErr"); if (e) e.textContent = (d && d.error) || "Sign-in failed. Please try again."; return; }
    S = { session: d.session, user: d.user, profile: d.profile, complete: !!d.profileComplete }; save(); paintHeader(); orders = null;
    if (!S.complete) return profileView(true);
    finishLogin();
  }
  function finishLogin() {
    if (pending) { const cb = pending; pending = null; closeModal(); toast("Signed in as " + S.user.name); setTimeout(cb, 150); return; }
    accountView("orders");
  }

  const FIELDS = [
    ["name", "Full name *", "text", "name", 80], ["phone", "Mobile number (10 digits) *", "tel", "tel-national", 10],
    ["street", "Address (house no., street, area) *", "text", "street-address", 200], ["landmark", "Landmark (near which place) *", "text", "off", 100],
    ["city", "City *", "text", "address-level2", 60], ["state", "State *", "text", "address-level1", 60], ["pincode", "Pincode *", "tel", "postal-code", 6]
  ];
  function profileForm(p, label) {
    return `<form id="profileForm" novalidate>
      ${FIELDS.map(([k, l, t, ac, max]) => `<label>${l}<input type="${t}" name="${k}" maxlength="${max}" autocomplete="${ac}" ${t === "tel" ? 'inputmode="numeric"' : ""} value="${esc((p && p[k]) || "")}"></label>`).join("")}
      <p class="err" id="profileErr" role="alert"></p>
      <button type="submit" class="btn btn-primary block" id="profileSave">${label}</button></form>`;
  }
  function profileView(first) {
    show(`<h3>${first ? "One last step: your delivery details" : "Your details"}</h3>
      <p class="muted small">${first ? "We need these to deliver your orders. You can change them anytime in My Account." : "Used to fill your checkout form."}</p>
      ${profileForm(S.profile, first ? "Save and continue" : "Save details")}
      ${first ? `<button type="button" class="link-btn" id="authSignOut">Use a different account</button>` : ""}`);
    $("#profileForm [name=name]").focus();
  }
  async function saveProfile(form, first) {
    const err = $("#profileErr"), btn = $("#profileSave"); err.textContent = "";
    const p = {}; FIELDS.forEach(([k]) => { p[k] = form[k].value.trim(); });
    if (p.name.length < 2) { err.textContent = "Please enter your full name."; return; }
    if (!/^[6-9]\d{9}$/.test(p.phone.replace(/\D/g, "").slice(-10))) { err.textContent = "Please enter a valid 10-digit mobile number."; return; }
    if (p.street.length < 5) { err.textContent = "Please enter your full address."; return; }
    if (p.landmark.length < 2) { err.textContent = "Please enter a landmark so our courier can find you."; return; }
    if (p.city.length < 2 || p.state.length < 2) { err.textContent = "Please enter your city and state."; return; }
    if (!/^\d{6}$/.test(p.pincode)) { err.textContent = "Please enter a valid 6-digit pincode."; return; }
    btn.disabled = true; const label = btn.textContent; btn.textContent = "Saving…";
    const d = await call(Object.assign({ type: "customerSaveProfile" }, p));
    btn.disabled = false; btn.textContent = label;
    if (!d || !d.ok) { err.textContent = (d && d.error) || "Could not save. Please try again."; return; }
    S.profile = d.profile; S.complete = true; S.user.name = d.profile.name; save(); paintHeader();
    if (first) finishLogin(); else { toast("Details saved"); accountView("details"); }
  }

  /* ---------- account: orders + details ---------- */
  const STEPS = ["Placed", "Confirmed", "Shipped", "Delivered"];
  function stageOf(o) {
    const r = o.rank, cod = String(o.method).toUpperCase() === "COD";
    if (r >= 9) return { step: -1, t: "Cancelled", c: "red", note: "This order was cancelled. Message us on WhatsApp if you have questions." };
    if (r === 8) return { step: 3, t: "Delivered", c: "green", note: "" };
    if (r === 7) return { step: 2, t: "Shipped", c: "purple", note: "Your order is on the way." };
    if (r === 6) return { step: 1, t: "Confirmed", c: "green", note: "Payment verified. We are packing your order." };
    return { step: 0, t: "Placed", c: "amber", note: cod ? "We will confirm your order and contact you shortly." : "We are checking your payment. We will contact you shortly with delivery information." };
  }
  function orderCard(o) {
    const st = stageOf(o), when = o.date ? new Date(o.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
    const trk = o.tracking ? (/^https:\/\//i.test(o.tracking) ? `<a href="${esc(o.tracking)}" target="_blank" rel="noopener">Track shipment ↗</a>` : `Tracking ID: <b>${esc(o.tracking)}</b>`) : "";
    return `<article class="ord">
      <div class="ord-top"><div><b>${esc(o.id)}</b><span class="muted small"> · ${esc(when)}</span></div><span class="opill ${st.c}">${esc(st.t)}</span></div>
      <p class="ord-items">${esc(o.items)}</p>
      ${st.step >= 0 ? `<ol class="steps">${STEPS.map((s, i) => `<li class="${i <= st.step ? "done" : ""}"><i></i><span>${s}</span></li>`).join("")}</ol>` : ""}
      ${st.note ? `<p class="small muted">${esc(st.note)}</p>` : ""}
      ${o.courier || trk ? `<p class="trk small">${o.courier ? "Courier: <b>" + esc(o.courier) + "</b>" : ""}${o.courier && trk ? " · " : ""}${trk}</p>` : ""}
      <div class="ord-foot"><span class="muted small">${esc(String(o.method).toUpperCase() === "COD" ? "Cash on Delivery" : "Paid by UPI")}${o.code ? " · code " + esc(o.code) : ""}</span><b>${inr(o.total)}</b></div>
    </article>`;
  }
  async function accountView(which) {
    tab = which || tab;
    const u = S.user;
    show(`<div class="acct-head"><span class="av lg">${u.picture ? `<img src="${esc(u.picture)}" alt="" referrerpolicy="no-referrer">` : esc(initials(u.name))}</span>
        <div><b>${esc(u.name || "Welcome")}</b><div class="muted small">${esc(u.email)}</div></div></div>
      <div class="tabs" role="tablist"><button type="button" data-tab="orders" class="${tab === "orders" ? "on" : ""}">My orders</button><button type="button" data-tab="details" class="${tab === "details" ? "on" : ""}">My details</button></div>
      <div id="acctBody"></div>
      <button type="button" class="link-btn" id="authSignOut">Sign out</button>`);
    if (tab === "details") { $("#acctBody").innerHTML = profileForm(S.profile, "Save details"); return; }
    const body = $("#acctBody");
    if (orders) { body.innerHTML = orders.length ? orders.map(orderCard).join("") : `<p class="muted" style="text-align:center;padding:20px 0">No orders yet. Your orders will show here.</p>`; return; }
    body.innerHTML = `<p class="muted" style="text-align:center;padding:20px 0">Loading your orders…</p>`;
    const d = await call({ type: "customerOrders" });
    if (!$("#acctBody")) return;
    if (d && d.ok) { orders = d.orders || []; accountView("orders"); }
    else if (!d.login) body.innerHTML = `<p class="err">${esc((d && d.error) || "Could not load your orders.")}</p><button class="btn btn-ghost" id="ordersRetry">Try again</button>`;
  }

  function signOut(silent) {
    S = null; orders = null; save(); paintHeader();
    try { window.google && google.accounts && google.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ }
    if (!silent) { closeModal(); toast("Signed out"); }
  }

  /* ---------- events ---------- */
  document.addEventListener("click", (e) => {
    if (e.target.closest("#acctBtn")) { open(); return; }
    if (!e.target.closest("#authModal")) return;
    const t = e.target.closest("[data-tab]"); if (t) { accountView(t.dataset.tab); return; }
    if (e.target.closest("#authSignOut")) { signOut(); return; }
    if (e.target.closest("#ordersRetry")) { orders = null; accountView("orders"); }
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "profileForm") { e.preventDefault(); saveProfile(e.target, !S.complete); }
  });

  /* ---------- API for the rest of the site ---------- */
  window.OOAuth = {
    enabled, gated, ready, call,
    session: () => (S && S.session) || "",
    user: () => (S && S.user) || null,
    whenConfigured: () => Promise.race([loadConfig(), new Promise((r) => setTimeout(r, 4500))]),
    // Run cb once the customer is signed in with complete details (opens the sign-in flow if needed)
    require(reason, cb) {
      if (ready()) { cb(); return; }
      pending = cb; openModal();
      loadConfig().then(() => {
        if (!gated()) { pending = null; closeModal(); cb(); return; }
        if (!S) signInView(reason === "checkout" ? "Sign in to place your order. It takes a few seconds." : reason === "review" ? "Sign in to share a review." : "");
        else if (!S.complete) profileView(true);
        else { pending = null; closeModal(); cb(); }
      });
    },
    // Confirms the saved session still works (call before taking a payment)
    async verify() {
      if (!gated()) return true;
      if (!S || !S.session) return false;
      const d = await call({ type: "customerMe" });
      if (d && d.ok) { S.profile = d.profile; S.complete = !!d.profileComplete; save(); return S.complete; }
      return !!(d && !d.login && /connect|slow|taking/i.test(d.error || "")) ? null : false;   // null = could not check (network)
    },
    prefill(form) {
      if (!S || !S.profile) return;
      ["name", "phone", "street", "landmark", "city", "state", "pincode"].forEach((k) => {
        const el = form.elements[k]; if (el && !el.value && S.profile[k]) { el.value = S.profile[k]; el.dispatchEvent(new Event("input", { bubbles: true })); }
      });
      const who = $("#signedAs"); if (who) { who.hidden = false; who.innerHTML = `Ordering as <b>${esc(S.user.email)}</b>`; }
    },
    open, refreshOrders() { orders = null; }
  };

  paintHeader();
  loadConfig();
})();
