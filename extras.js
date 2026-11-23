/* =====================================================================
   OtakuOriginals — extras: FAQ, help assistant, customer reviews,
   Instagram "Our Journey" slider. Needs products.js + app.js first.
   ===================================================================== */
(function () {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const OO = window.OO, C = OO.config, esc = OO.esc, toast = OO.toast;
  const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const waLink = (text) => "https://wa.me/" + C.whatsappNumber + (text ? "?text=" + encodeURIComponent(text) : "");

  /* ================= FAQ + FAQ schema ================= */
  function initFAQ() {
    $("#faqList").innerHTML = FAQS.map((f) =>
      `<details class="faq-item reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
    try {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.textContent = JSON.stringify({
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": FAQS.map((f) => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } }))
      });
      document.head.appendChild(s);
    } catch (e) { /* optional */ }
    OO.observeReveals();
  }

  /* ================= Help assistant (rule-based, free) ================= */
  function initChat() {
    const fab = $("#chatFab"), panel = $("#chatPanel"), log = $("#chatLog"), chips = $("#chatChips"), input = $("#chatInput");
    $("#chatHuman").href = waLink("Hi OtakuOriginals, I need help with my order.");
    let started = false;

    function add(text, who, extra) {
      const m = document.createElement("div");
      m.className = "msg " + who;
      m.textContent = text;
      if (extra) m.appendChild(extra);
      log.appendChild(m);
      log.scrollTop = log.scrollHeight;
    }
    function humanButton(q) {
      const a = document.createElement("a");
      a.className = "msg-btn"; a.target = "_blank"; a.rel = "noopener";
      a.href = waLink("Hi OtakuOriginals, I need help: " + q);
      a.textContent = "Chat with us on WhatsApp →";
      return a;
    }
    function norm(s) { return " " + s.toLowerCase().replace(/[^a-z0-9₹ ]+/g, " ").replace(/\s+/g, " ").trim() + " "; }
    function findAnswer(q) {
      const n = norm(q);
      let best = null, score = 0;
      FAQS.forEach((f) => {
        let sc = 0;
        (f.keys || []).forEach((k) => { if (n.includes(" " + k.toLowerCase() + " ") || n.includes(" " + k.toLowerCase())) sc += k.includes(" ") ? 3 : 2; });
        norm(f.q).split(" ").filter((w) => w.length > 4 && n.includes(" " + w + " ")).forEach(() => { sc += 1; });
        if (sc > score) { score = sc; best = f; }
      });
      return score >= 2 ? best : null;
    }
    function reply(q) {
      const n = norm(q);
      setTimeout(() => {
        if (/ (human|person|agent|owner|call|talk|whatsapp|someone) /.test(n)) {
          add("Sure! Tap below and our team will reply on WhatsApp.", "bot", humanButton(q)); return;
        }
        if (/^ (hi|hii|hello|hey|namaste) $/.test(n)) { add("Hi! 👋 Ask me about orders, payment, delivery, offers or returns.", "bot"); return; }
        const f = findAnswer(q);
        if (f) add(f.a, "bot");
        else add("I'm not sure about that one. Our team can help you directly on WhatsApp.", "bot", humanButton(q));
      }, 350);
    }
    function ask(q) { add(q, "user"); reply(q); }

    chips.innerHTML = ["How does ordering work?", "Payment methods", "Delivery time", "Track my order", "Offers", "Returns"]
      .map((c) => `<button type="button" class="chip">${esc(c)}</button>`).join("");
    chips.addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) ask(b.textContent); });

    function open() {
      panel.hidden = false; requestAnimationFrame(() => panel.classList.add("open"));
      fab.setAttribute("aria-expanded", "true");
      if (!started) { started = true; add("Hi! I'm the Otaku Assistant 👋 How can I help you today?", "bot"); }
      setTimeout(() => input.focus(), 250);
    }
    function close() {
      panel.classList.remove("open"); fab.setAttribute("aria-expanded", "false");
      setTimeout(() => { panel.hidden = true; }, 250);
    }
    fab.addEventListener("click", () => (panel.hidden ? open() : close()));
    $("#chatClose").addEventListener("click", close);
    $("#chatForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = input.value.trim(); if (!q) return;
      input.value = ""; ask(q);
    });
  }

  /* ================= Customer reviews ================= */
  const LIKE_KEY = "oo_likes_v1";
  let liked = new Set();
  try { liked = new Set(JSON.parse(localStorage.getItem(LIKE_KEY)) || []); } catch (e) { /* ignore */ }
  const saveLiked = () => { try { localStorage.setItem(LIKE_KEY, JSON.stringify(Array.from(liked))); } catch (e) { /* ignore */ } };
  const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  const safeUrl = (u) => (/^https:\/\//i.test(u) ? u : "");

  function renderReviews(list) {
    const grid = $("#reviewGrid");
    if (!list.length) {
      grid.innerHTML = `<div class="rv-empty reveal"><strong>Be the first to share your haul!</strong><p class="muted">Ordered from us? Add a photo and a few words. Your review helps other fans.</p></div>`;
      OO.observeReveals(); return;
    }
    grid.innerHTML = list.map((r) => {
      const id = String(r.id), rating = Math.max(1, Math.min(5, parseInt(r.rating, 10) || 5));
      const imgs = (r.images || []).map(safeUrl).filter(Boolean).slice(0, 2);
      const likes = Math.max(0, parseInt(r.likes, 10) || 0);
      return `<article class="rv reveal">
        ${imgs.length ? `<div class="rv-photos n${imgs.length}">${imgs.map((u) => `<img src="${esc(u)}" alt="Photo from ${esc(r.name)}'s order" loading="lazy" onerror="this.style.display='none'">`).join("")}</div>` : ""}
        <div class="rv-body">
          <div class="rv-stars" aria-label="${rating} out of 5 stars">${stars(rating)}</div>
          <p>${esc(r.comment)}</p>
          <div class="rv-meta"><strong>${esc(r.name)}</strong>${r.product ? " · " + esc(r.product) : ""}</div>
          <button type="button" class="like ${liked.has(id) ? "on" : ""}" data-like="${esc(id)}" data-count="${likes}" aria-pressed="${liked.has(id)}">♥ <span>${likes}</span></button>
        </div></article>`;
    }).join("");
    OO.observeReveals();
  }

  async function loadReviews() {
    if (!C.sheetWebhookUrl) { renderReviews([]); return; }
    try {
      const r = await fetch(C.sheetWebhookUrl + "?action=reviews");
      const d = await r.json();
      renderReviews(Array.isArray(d.reviews) ? d.reviews : []);
    } catch (e) { renderReviews([]); }
  }

  function compress(file, max = 900, q = 0.72) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg", q));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
      img.src = url;
    });
  }

  function initReviews() {
    const grid = $("#reviewGrid"), form = $("#reviewForm"), err = $("#reviewErr");
    let photos = [];

    const fillProducts = () => { $("#reviewProduct").innerHTML = '<option value="">Select a product</option>' + PRODUCTS.map((p) => `<option>${esc(p.name)}</option>`).join(""); };
    fillProducts();
    document.addEventListener("oo:products", fillProducts);   // products can load a moment later from the admin list
    $("#openReview").addEventListener("click", () => OO.openModal("reviewModal"));

    grid.addEventListener("click", (e) => {
      const b = e.target.closest("[data-like]"); if (!b) return;
      const id = b.dataset.like, on = !liked.has(id);
      on ? liked.add(id) : liked.delete(id); saveLiked();
      const n = Math.max(0, (parseInt(b.dataset.count, 10) || 0) + (on ? 1 : -1));
      b.dataset.count = n; b.querySelector("span").textContent = n;
      b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on));
      OO.postToSheet({ type: "like", id, delta: on ? 1 : -1 });
    });

    function drawPreviews() {
      $("#photoPreviews").innerHTML = photos.map((src, i) =>
        `<div class="pv"><img src="${src}" alt="Selected photo ${i + 1}"><button type="button" data-rm="${i}" aria-label="Remove photo">✕</button></div>`).join("");
    }
    $("#photoPreviews").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) { photos.splice(+b.dataset.rm, 1); drawPreviews(); } });
    $("#reviewPhotos").addEventListener("change", async (e) => {
      err.textContent = "";
      for (const f of Array.from(e.target.files)) {
        if (photos.length >= 2) { err.textContent = "You can add up to 2 photos."; break; }
        if (!/^image\//.test(f.type)) continue;
        try { photos.push(await compress(f)); } catch (x) { err.textContent = "Could not read that photo."; }
      }
      e.target.value = ""; drawPreviews();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault(); err.textContent = "";
      const fd = new FormData(form);
      if (fd.get("website")) return;                       // spam trap
      const name = (fd.get("name") || "").trim(), comment = (fd.get("comment") || "").trim();
      const rating = parseInt(fd.get("rating"), 10) || 5, product = fd.get("product") || "";
      if (name.length < 2) { err.textContent = "Please enter your name."; return; }
      if (comment.length < 5) { err.textContent = "Please write a short comment."; return; }
      const btn = $("#reviewSubmit"); btn.disabled = true; btn.textContent = "Sending…";
      if (!C.sheetWebhookUrl) {
        // No sheet connected yet: send the review to WhatsApp instead
        window.open(waLink(`Review for OtakuOriginals\nName: ${name}\nProduct: ${product || "-"}\nRating: ${rating}/5\n${comment}\n(I will attach my photos here)`), "_blank");
        toast("Opening WhatsApp so you can send your review");
      } else {
        const ok = await OO.postToSheet({ type: "review", name, product, rating, comment, images: photos }, false);
        toast(ok ? "Thank you! Your review will appear after a quick check." : "Could not send. Please try again.");
        if (!ok) { btn.disabled = false; btn.textContent = "Submit review"; return; }
      }
      form.reset(); photos = []; drawPreviews();
      btn.disabled = false; btn.textContent = "Submit review";
      OO.closeAll();
    });
    loadReviews();
  }

  /* ================= Our Journey: infinite auto-swiping reels ================= */
  function reelId(url) { const m = String(url).match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i); return m ? m[1] : null; }

  function initJourney() {
    const track = $("#journeyTrack"), slider = $("#journeySlider");
    $("#jFollow").href = C.instagram;
    let base = (typeof REELS !== "undefined" ? REELS : []).map((u) => ({ id: reelId(u), url: u })).filter((r) => r.id);
    if (!base.length) base = [1, 2, 3].map((n) => ({ placeholder: n }));
    const n = base.length;
    while (base.length < 4) base = base.concat(base.slice(0, n));        // enough cards for a seamless loop
    const count = base.length;

    const card = (r, i) => r.placeholder
      ? `<a class="reel soon" href="${esc(C.instagram)}" target="_blank" rel="noopener" aria-label="Follow OtakuOriginals on Instagram"><span class="reel-no">0${r.placeholder}</span><strong>Reel coming soon</strong><small>Follow @OtakuOriginals</small></a>`
      : `<div class="reel"><iframe src="https://www.instagram.com/reel/${esc(r.id)}/embed" title="Instagram reel ${i + 1}" loading="lazy" scrolling="no" tabindex="-1"></iframe><a class="reel-link" href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="Watch reel ${i + 1} on Instagram"><span>▶ Watch on Instagram</span></a></div>`;
    track.innerHTML = [0, 1, 2].map(() => base.map(card).join("")).join("");   // 3 identical copies

    const dots = $("#jDots");
    dots.innerHTML = Array.from({ length: n }, () => "<i></i>").join("");

    const cards = $$(".reel", track);
    const step = () => (cards[1].offsetLeft - cards[0].offsetLeft) || 300;
    const half = () => cards[count].offsetLeft - cards[0].offsetLeft;       // width of one copy

    function snapOff(fn) { track.style.scrollSnapType = "none"; fn(); requestAnimationFrame(() => { track.style.scrollSnapType = ""; }); }
    function normalise() {
      const h = half();
      if (track.scrollLeft >= 2 * h) snapOff(() => { track.scrollLeft -= h; });
      else if (track.scrollLeft < h - 2) snapOff(() => { track.scrollLeft += h; });
    }
    function paintDots() {
      const idx = Math.round((track.scrollLeft - half()) / step());
      const cur = ((idx % n) + n) % n;
      $$("i", dots).forEach((d, k) => d.classList.toggle("on", k === cur));
    }
    let settle;
    track.addEventListener("scroll", () => { paintDots(); clearTimeout(settle); settle = setTimeout(normalise, 140); }, { passive: true });

    const go = (dir) => { normalise(); track.scrollBy({ left: dir * step(), behavior: reduceMotion ? "auto" : "smooth" }); };
    $("#jNext").addEventListener("click", () => { go(1); restart(); });
    $("#jPrev").addEventListener("click", () => { go(-1); restart(); });

    let timer = null, paused = false;
    function restart() { clearInterval(timer); if (!reduceMotion && !paused) timer = setInterval(() => { if (!document.hidden) go(1); }, 4200); }
    ["mouseenter", "focusin", "touchstart"].forEach((ev) => slider.addEventListener(ev, () => { paused = true; clearInterval(timer); }, { passive: true }));
    ["mouseleave", "focusout"].forEach((ev) => slider.addEventListener(ev, () => { paused = false; restart(); }));
    slider.addEventListener("touchend", () => { setTimeout(() => { paused = false; restart(); }, 3500); }, { passive: true });

    function start() { snapOff(() => { track.scrollLeft = half(); }); paintDots(); restart(); }
    // only run the loop while the section is on screen
    if ("IntersectionObserver" in window) {
      let started = false;
      new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { if (!started) { started = true; start(); } else if (!paused) restart(); }
        else clearInterval(timer);
      }), { threshold: 0.2 }).observe(slider);
    } else start();
    window.addEventListener("resize", () => snapOff(() => { track.scrollLeft = half(); }));
  }

  /* ================= init ================= */
  initFAQ();
  initChat();
  initReviews();
  initJourney();
})();
