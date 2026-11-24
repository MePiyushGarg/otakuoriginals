// OtakuOriginals - Google Sheet backend (v3.3)
// Setup: Script properties ADMIN_USER + ADMIN_PASS, then Deploy > Web app (Execute as Me, Access: Anyone)

var ORDERS_SHEET = "Orders";
var REVIEWS_SHEET = "Reviews";
var PRODUCTS_SHEET = "Products";
var REVIEW_FOLDER = "OtakuOriginals Review Photos";
var PRODUCT_FOLDER = "OtakuOriginals Product Photos";
var OWNER_EMAIL = "OtakuOriginals7@gmail.com";   // gets an email when a new review arrives (set "" to turn off)
var DISCOUNTS_SHEET = "Discounts";
var DEFAULT_CATEGORIES = ["Action Figures", "Posters", "Stickers", "Anime Merch"];
var DEFAULT_BADGES = ["Bestseller", "New", "Limited"];

var ORDER_HEADERS = ["Order ID", "First seen", "Last updated", "Status", "Name", "Phone", "Street", "Landmark", "City", "State",
  "Pincode", "Note", "Items", "Item count", "Subtotal", "Offer discount", "UPI discount", "Delivery", "Free gifts", "Total payable",
  "Payment method", "UTR / ref", "Rank", "Page", "Follow-up notes", "Discount code"];
var REVIEW_HEADERS = ["Review ID", "Date", "Status", "Name", "Product", "Rating", "Comment", "Photo 1", "Photo 2", "Likes"];
var DISCOUNT_HEADERS = ["ID", "Active", "Title", "Code", "Type", "Value", "Min order", "Auto apply", "Show on site", "Start", "End", "Max uses", "Description", "Created"];
var PRODUCT_HEADERS = ["ID", "Active", "Name", "Category", "Price", "Original price", "Badge", "In stock", "Description", "Images", "Created"];

/* ENTRY POINTS */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse(e.postData.contents);
    var t = data.type;

    // public actions (used by the website)
    if (t === "order") { saveOrder_(data); return json_({ ok: true }); }
    if (t === "review") { saveReview_(data); return json_({ ok: true }); }
    if (t === "like") { saveLike_(data); return json_({ ok: true }); }

    // admin login
    if (t === "adminLogin") return json_(adminLogin_(data));

    // everything below needs a valid admin token
    if (!tokenOk_(data.token)) return json_({ ok: false, error: "unauthorized" });
    if (t === "adminOrders") return json_({ ok: true, orders: adminOrders_() });
    if (t === "adminNote") return json_(adminNote_(data));
    if (t === "adminSetStatus") return json_(adminSetStatus_(data));
    if (t === "adminProducts") return json_({ ok: true, products: readProducts_(true), options: getOptions_() });
    if (t === "adminAddOption") return json_(adminAddOption_(data));
    if (t === "adminRemoveOption") return json_(adminRemoveOption_(data));
    if (t === "adminDiscounts") return json_({ ok: true, discounts: adminDiscounts_() });
    if (t === "adminSaveDiscount") return json_(adminSaveDiscount_(data.discount || {}));
    if (t === "adminDeleteDiscount") return json_(adminDeleteDiscount_(data.id));
    if (t === "adminSaveProduct") return json_(adminSaveProduct_(data.product || {}));
    if (t === "adminDeleteProduct") return json_(adminDeleteProduct_(data.id));
    if (t === "adminLogout") { CacheService.getScriptCache().remove("adm_tok_" + String(data.token)); return json_({ ok: true }); }
    return json_({ ok: false, error: "unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* ignore */ }
  }
}

function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : "";
  if (action === "reviews") return json_({ ok: true, reviews: approvedReviews_() });
  if (action === "products") {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRODUCTS_SHEET);
    if (!sh) return json_({ ok: true, managed: false, products: [] });
    return json_({ ok: true, managed: true, products: readProducts_(false) });
  }
  if (action === "discounts") return json_({ ok: true, discounts: publicDiscounts_() });
  if (action === "validate") return json_(validateCode_(e.parameter.code));
  var pr = PropertiesService.getScriptProperties();
  return json_({ ok: true, service: "OtakuOriginals backend", version: "3.3", adminReady: !!(pr.getProperty("ADMIN_USER") && pr.getProperty("ADMIN_PASS")) });
}

/* HELPERS */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (sh && sh.getLastRow() >= 1) {
    var have = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
    while (have.length && have[have.length - 1] === "") have.pop();
    var n = Math.min(have.length, headers.length);
    if (have.slice(0, n).join("|") !== headers.slice(0, n).join("|")) {   // old layout: keep it, start a fresh tab
      sh.setName(name + " (old " + Utilities.formatDate(new Date(), "Asia/Kolkata", "dd-MMM HH.mm") + ")");
      sh = null;
    } else if (have.length < headers.length) {                            // newer version added columns: append headers
      sh.getRange(1, have.length + 1, 1, headers.length - have.length).setValues([headers.slice(have.length)])
        .setFontWeight("bold").setBackground("#111111").setFontColor("#ffffff");
    }
  }
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#111111").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  }
  return sh;
}
// Stops "=formulas" typed by visitors from running inside your sheet, and trims length
function clean_(v, max) {
  var s = String(v == null ? "" : v).substring(0, max || 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function num_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function idx_(headers, name) { return headers.indexOf(name); }
function same_(a, b) {                                   // constant-time-ish string compare
  a = String(a); b = String(b);
  var diff = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
function iso_(v) { return v instanceof Date ? v.toISOString() : String(v || ""); }

/* ORDERS */
function saveOrder_(d) {
  var sh = sheet_(ORDERS_SHEET, ORDER_HEADERS);
  var H = ORDER_HEADERS, n = H.length;
  var id = clean_(d.orderId, 20);
  if (!id) return;
  var now = new Date(), rank = num_(d.rank);

  var rec = {
    "Order ID": id, "Status": clean_(d.status, 60), "Name": clean_(d.name, 80), "Phone": clean_(d.phone, 15),
    "Street": clean_(d.street, 200), "Landmark": clean_(d.landmark, 100), "City": clean_(d.city, 60),
    "State": clean_(d.state, 60), "Pincode": clean_(d.pincode, 10), "Note": clean_(d.note, 300),
    "Items": clean_(d.items, 800), "Item count": num_(d.itemCount), "Subtotal": num_(d.subtotal),
    "Offer discount": num_(d.discount), "UPI discount": num_(d.upiDiscount), "Delivery": clean_(d.delivery, 60),
    "Free gifts": clean_(d.gifts, 200), "Total payable": num_(d.total), "Payment method": clean_(d.paymentMethod, 10),
    "UTR / ref": clean_(d.utr, 30), "Rank": rank, "Page": clean_(d.page, 200),
    "Discount code": clean_(d.discountCode, 40)
  };

  var last = sh.getLastRow();
  var hit = last > 1 ? sh.getRange(2, 1, last - 1, 1).createTextFinder(id).matchEntireCell(true).findNext() : null;

  if (!hit) {
    var row = H.map(function (h) { return rec.hasOwnProperty(h) ? rec[h] : ""; });
    row[idx_(H, "First seen")] = now;
    row[idx_(H, "Last updated")] = now;
    sh.appendRow(row);
    var r = sh.getLastRow();
    sh.getRange(r, idx_(H, "Phone") + 1).setNumberFormat("@").setValue(rec["Phone"]);      // keep as text
    sh.getRange(r, idx_(H, "Pincode") + 1).setNumberFormat("@").setValue(rec["Pincode"]);
    sh.getRange(r, 2, 1, 2).setNumberFormat("dd-mmm-yyyy hh:mm:ss");
    return;
  }

  var rr = hit.getRow();
  var cur = sh.getRange(rr, 1, 1, n).getValues()[0];
  var next = cur.slice();
  var keep = { "Order ID": 1, "First seen": 1, "Follow-up notes": 1, "Status": 1, "Rank": 1 };
  H.forEach(function (h, i) {
    if (keep[h] || !rec.hasOwnProperty(h)) return;
    if (h === "UTR / ref" && !rec[h]) return;                  // never wipe a saved UTR
    next[i] = rec[h];
  });
  next[idx_(H, "Last updated")] = now;
  if (rank >= num_(cur[idx_(H, "Rank")])) {                    // never move the status backwards
    next[idx_(H, "Status")] = rec["Status"];
    next[idx_(H, "Rank")] = rank;
  }
  sh.getRange(rr, 1, 1, n).setValues([next]);
}

function adminOrders_() {
  var sh = sheet_(ORDERS_SHEET, ORDER_HEADERS);
  var H = ORDER_HEADERS, last = sh.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - 499);                          // newest 500 rows
  var vals = sh.getRange(start, 1, last - start + 1, H.length).getValues();
  var out = vals.map(function (r) {
    function g(h) { return r[idx_(H, h)]; }
    return {
      id: String(g("Order ID")), first: iso_(g("First seen")), updated: iso_(g("Last updated")), status: String(g("Status")),
      name: String(g("Name")), phone: String(g("Phone")), street: String(g("Street")), landmark: String(g("Landmark")),
      city: String(g("City")), state: String(g("State")), pincode: String(g("Pincode")), note: String(g("Note")),
      items: String(g("Items")), itemCount: num_(g("Item count")), subtotal: num_(g("Subtotal")),
      discount: num_(g("Offer discount")), upiDiscount: num_(g("UPI discount")), delivery: String(g("Delivery")),
      gifts: String(g("Free gifts")), total: num_(g("Total payable")), method: String(g("Payment method")),
      utr: String(g("UTR / ref")), rank: num_(g("Rank")), followup: String(g("Follow-up notes")),
      code: String(g("Discount code"))
    };
  });
  out.sort(function (a, b) { return a.updated < b.updated ? 1 : -1; });
  return out;
}

function adminNote_(d) {
  var sh = sheet_(ORDERS_SHEET, ORDER_HEADERS), H = ORDER_HEADERS, last = sh.getLastRow();
  if (last < 2) return { ok: false, error: "not found" };
  var hit = sh.getRange(2, 1, last - 1, 1).createTextFinder(clean_(d.orderId, 20)).matchEntireCell(true).findNext();
  if (!hit) return { ok: false, error: "not found" };
  var cell = sh.getRange(hit.getRow(), idx_(H, "Follow-up notes") + 1);
  var stamp = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd MMM HH:mm");
  var text = (cell.getValue() ? cell.getValue() + " | " : "") + stamp + ": " + clean_(d.note, 200);
  cell.setValue(text);
  return { ok: true, followup: text };
}

/* ADMIN LOGIN (checked here on the server, never in the website code) */
// Admin sets the order stage: confirmed / shipped / delivered / cancelled / reopen
function adminSetStatus_(d) {
  var map = {
    reopen: [5, "Reopened - check payment"], confirmed: [6, "Confirmed - payment verified"],
    shipped: [7, "Shipped"], delivered: [8, "Delivered"], cancelled: [9, "Cancelled"]
  };
  var m = map[String(d.status)];
  if (!m) return { ok: false, error: "unknown status" };
  var sh = sheet_(ORDERS_SHEET, ORDER_HEADERS), H = ORDER_HEADERS, last = sh.getLastRow();
  if (last < 2) return { ok: false, error: "not found" };
  var hit = sh.getRange(2, 1, last - 1, 1).createTextFinder(clean_(d.orderId, 20)).matchEntireCell(true).findNext();
  if (!hit) return { ok: false, error: "not found" };
  var r = hit.getRow();
  sh.getRange(r, idx_(H, "Status") + 1).setValue(m[1]);
  sh.getRange(r, idx_(H, "Rank") + 1).setValue(m[0]);
  sh.getRange(r, idx_(H, "Last updated") + 1).setValue(new Date());
  return { ok: true, status: m[1], rank: m[0] };
}

function adminLogin_(d) {
  var props = PropertiesService.getScriptProperties();
  var u = props.getProperty("ADMIN_USER"), p = props.getProperty("ADMIN_PASS");
  if (!u || !p) return { ok: false, error: "Admin login is not set up. Add ADMIN_USER and ADMIN_PASS in Script properties, then redeploy." };
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get("adm_fails") || 0);
  if (fails >= 5) return { ok: false, error: "Too many wrong attempts. Try again in 15 minutes." };
  u = String(u).trim(); p = String(p).trim();
  var okU = same_(String(d.user || "").trim(), u), okP = same_(String(d.pass || "").trim(), p);
  if (!(okU && okP)) {
    cache.put("adm_fails", String(fails + 1), 900);
    Utilities.sleep(700);
    return { ok: false, error: "Wrong username or password." };
  }
  cache.remove("adm_fails");
  var token = Utilities.getUuid() + Utilities.getUuid();
  cache.put("adm_tok_" + token, "1", 21600);                    // valid for 6 hours
  return { ok: true, token: token };
}
function tokenOk_(token) {
  token = String(token || "");
  if (token.length < 40) return false;
  return CacheService.getScriptCache().get("adm_tok_" + token) === "1";
}

/* OPTIONS: categories and badges you can extend from the admin */
function getOptions_() {
  var saved = {};
  try { saved = JSON.parse(PropertiesService.getScriptProperties().getProperty("OPTIONS") || "{}"); } catch (x) { saved = {}; }
  var cats = DEFAULT_CATEGORIES.concat(saved.categories || []), badges = DEFAULT_BADGES.concat(saved.badges || []);
  readProducts_(true).forEach(function (p) {
    if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category);
    if (p.badge && badges.indexOf(p.badge) < 0) badges.push(p.badge);
  });
  return { categories: cats, badges: badges, custom: { categories: saved.categories || [], badges: saved.badges || [] } };
}
function adminAddOption_(d) {
  var kind = d.kind === "badge" ? "badges" : "categories";
  var val = clean_(d.value, 30).replace(/^'/, "").trim();
  if (val.length < 2) return { ok: false, error: "Please enter at least 2 characters." };
  var pr = PropertiesService.getScriptProperties(), saved = {};
  try { saved = JSON.parse(pr.getProperty("OPTIONS") || "{}"); } catch (x) { saved = {}; }
  var all = (kind === "badges" ? getOptions_().badges : getOptions_().categories).map(function (x) { return x.toLowerCase(); });
  if (all.indexOf(val.toLowerCase()) >= 0) return { ok: false, error: "That already exists." };
  saved[kind] = (saved[kind] || []).concat([val]);
  pr.setProperty("OPTIONS", JSON.stringify(saved));
  return { ok: true, options: getOptions_() };
}
function adminRemoveOption_(d) {
  var kind = d.kind === "badge" ? "badges" : "categories";
  var pr = PropertiesService.getScriptProperties(), saved = {};
  try { saved = JSON.parse(pr.getProperty("OPTIONS") || "{}"); } catch (x) { saved = {}; }
  saved[kind] = (saved[kind] || []).filter(function (x) { return x !== String(d.value); });
  pr.setProperty("OPTIONS", JSON.stringify(saved));
  return { ok: true, options: getOptions_() };
}

/* DISCOUNTS */
function todayIST_() { return Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd"); }
function dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, "Asia/Kolkata", "yyyy-MM-dd");
  var s = String(v || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}
function readDiscounts_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DISCOUNTS_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  var H = DISCOUNT_HEADERS, out = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getValues().forEach(function (r) {
    function g(h) { return r[idx_(H, h)]; }
    if (!g("ID") || !g("Title")) return;
    out.push({
      id: num_(g("ID")), active: String(g("Active")).trim().toLowerCase() !== "no", title: String(g("Title")),
      code: String(g("Code") || "").toUpperCase(), type: String(g("Type")) === "flat" ? "flat" : "percent",
      value: num_(g("Value")), min: num_(g("Min order")), autoApply: String(g("Auto apply")).trim().toLowerCase() === "yes",
      showOnSite: String(g("Show on site")).trim().toLowerCase() === "yes", start: dateStr_(g("Start")), end: dateStr_(g("End")),
      maxUses: num_(g("Max uses")), description: String(g("Description") || "")
    });
  });
  return out;
}
function discountState_(d) {
  if (!d.active) return "off";
  var t = todayIST_();
  if (d.start && t < d.start) return "scheduled";
  if (d.end && t > d.end) return "expired";
  return "active";
}
// how many real orders used each code (cancelled and abandoned ones do not count)
function usesMap_() {
  var map = {}, sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ORDERS_SHEET);
  if (!sh || sh.getLastRow() < 2) return map;
  var have = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var ci = have.indexOf("Discount code"), ri = have.indexOf("Rank");
  if (ci < 0 || ri < 0) return map;
  var last = sh.getLastRow(), start = Math.max(2, last - 1999);
  sh.getRange(start, 1, last - start + 1, have.length).getValues().forEach(function (r) {
    var c = String(r[ci] || "").toUpperCase(), rk = num_(r[ri]);
    if (c && rk >= 4 && rk <= 8) map[c] = (map[c] || 0) + 1;
  });
  return map;
}
function publicShape_(d) {
  return { id: d.id, title: d.title, type: d.type, value: d.value, min: d.min, autoApply: d.autoApply, end: d.end, description: d.description };
}
// What the website may see: automatic offers + offers you chose to show. Hidden codes are never listed.
function publicDiscounts_() {
  var uses = null, out = [];
  readDiscounts_().forEach(function (d) {
    if (discountState_(d) !== "active") return;
    if (!(d.autoApply || d.showOnSite)) return;
    if (d.maxUses > 0) { uses = uses || usesMap_(); if ((uses[d.code] || 0) >= d.maxUses) return; }
    var o = publicShape_(d);
    o.showOnSite = d.showOnSite;
    if (!d.autoApply) o.code = d.code;
    out.push(o);
  });
  return out;
}
function validateCode_(code) {
  code = String(code || "").trim().toUpperCase();
  var bad = { ok: false, error: "This code is not valid or has expired." };
  if (!code || code.length > 30) return bad;
  var list = readDiscounts_();
  for (var i = 0; i < list.length; i++) {
    var d = list[i];
    if (d.autoApply || d.code !== code) continue;
    if (discountState_(d) !== "active") return bad;
    if (d.maxUses > 0 && (usesMap_()[code] || 0) >= d.maxUses) return { ok: false, error: "This code has reached its usage limit." };
    var o = publicShape_(d); o.code = d.code;
    return { ok: true, discount: o };
  }
  return bad;
}
function adminDiscounts_() {
  var uses = usesMap_();
  return readDiscounts_().map(function (d) {
    d.state = discountState_(d); d.uses = d.code ? (uses[d.code] || 0) : 0; return d;
  });
}
function adminSaveDiscount_(p) {
  var title = clean_(p.title, 60).replace(/^'/, "");
  var type = p.type === "flat" ? "flat" : "percent", value = num_(p.value);
  if (title.length < 2) return { ok: false, error: "Please enter a title." };
  if (!(value > 0)) return { ok: false, error: "Please enter the discount value." };
  if (type === "percent" && value > 90) return { ok: false, error: "Percent discount can be at most 90." };
  if (type === "flat" && value > 100000) return { ok: false, error: "Flat discount is too large." };
  var auto = p.autoApply === true;
  var code = String(p.code || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!auto && (code.length < 3 || code.length > 20)) return { ok: false, error: "Code must be 3 to 20 letters or numbers." };
  if (auto) code = "";
  var start = dateStr_(p.start), end = dateStr_(p.end);
  if (start && end && end < start) return { ok: false, error: "The end date is before the start date." };

  var sh = sheet_(DISCOUNTS_SHEET, DISCOUNT_HEADERS), H = DISCOUNT_HEADERS;
  try { sh.getRange(2, idx_(H, "Start") + 1, Math.max(sh.getMaxRows() - 1, 1), 2).setNumberFormat("@"); } catch (x) { /* dates are also read back safely */ }
  var last = sh.getLastRow(), id = num_(p.id), rowNum = 0, maxId = 200;
  if (last > 1) {
    var vals = sh.getRange(2, 1, last - 1, H.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      var v = num_(vals[i][0]);
      if (v > maxId) maxId = v;
      if (id && v === id) rowNum = i + 2;
      if (code && String(vals[i][idx_(H, "Code")]).toUpperCase() === code && v !== id) return { ok: false, error: "That code already exists." };
    }
  }
  var rec = {
    "Active": p.active === false ? "No" : "Yes", "Title": title, "Code": code, "Type": type, "Value": value,
    "Min order": num_(p.min), "Auto apply": auto ? "Yes" : "No", "Show on site": p.showOnSite === true ? "Yes" : "No",
    "Start": start, "End": end, "Max uses": auto ? 0 : num_(p.maxUses), "Description": clean_(p.description, 200)
  };
  if (rowNum) {
    var cur = sh.getRange(rowNum, 1, 1, H.length).getValues()[0];
    sh.getRange(rowNum, 1, 1, H.length).setValues([H.map(function (h, k) { return rec.hasOwnProperty(h) ? rec[h] : cur[k]; })]);
    return { ok: true, id: id };
  }
  var newId = maxId + 1;
  var row = H.map(function (h) { return rec.hasOwnProperty(h) ? rec[h] : ""; });
  row[idx_(H, "ID")] = newId; row[idx_(H, "Created")] = new Date();
  sh.appendRow(row);
  return { ok: true, id: newId };
}
function adminDeleteDiscount_(id) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DISCOUNTS_SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: false, error: "not found" };
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (num_(ids[i][0]) === num_(id)) { sh.deleteRow(i + 2); return { ok: true }; }
  }
  return { ok: false, error: "not found" };
}

/* PRODUCTS */
function readProducts_(includeHidden) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRODUCTS_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  var H = PRODUCT_HEADERS;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, H.length).getValues();
  var out = [];
  vals.forEach(function (r) {
    function g(h) { return r[idx_(H, h)]; }
    var active = String(g("Active")).trim().toLowerCase() !== "no";
    if (!includeHidden && !active) return;
    if (!g("Name") || !g("ID")) return;
    var images = String(g("Images") || "").split(/\s*\n\s*/).filter(function (x) { return x; });
    out.push({
      id: num_(g("ID")), active: active, name: String(g("Name")), category: String(g("Category")),
      price: num_(g("Price")), originalPrice: num_(g("Original price")), badge: String(g("Badge")),
      inStock: String(g("In stock")).trim().toLowerCase() !== "no", description: String(g("Description")),
      image: images[0] || "", images: images
    });
  });
  return out;
}

function saveImage_(dataUrl, name, folderName) {
  var m = String(dataUrl || "").match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (!m || m[2].length > 3000000) return "";                   // images only, about 2 MB max
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), "image/jpeg", name + ".jpg");
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
}

function adminSaveProduct_(p) {
  var name = clean_(p.name, 120);
  var price = num_(p.price);
  if (name.length < 2) return { ok: false, error: "Please enter a product name." };
  if (!(price > 0) || price > 1000000) return { ok: false, error: "Please enter a valid price." };

  var sh = sheet_(PRODUCTS_SHEET, PRODUCT_HEADERS), H = PRODUCT_HEADERS;
  var category = clean_(p.category, 30) || "Anime Merch";
  var tag = "P" + new Date().getTime();

  var urls = [];
  (p.images || []).slice(0, 5).forEach(function (img, i) {
    var s = String(img || "");
    if (/^https:\/\//i.test(s) && s.length < 600) urls.push(s);
    else if (/^data:image\//i.test(s)) { var u = saveImage_(s, tag + "-" + (i + 1), PRODUCT_FOLDER); if (u) urls.push(u); }
  });

  var rec = {
    "Active": p.active === false ? "No" : "Yes", "Name": name, "Category": category, "Price": price,
    "Original price": num_(p.originalPrice), "Badge": clean_(p.badge, 20), "In stock": p.inStock === false ? "No" : "Yes",
    "Description": clean_(p.description, 600), "Images": urls.join("\n")
  };

  var last = sh.getLastRow(), id = num_(p.id), rowNum = 0, maxId = 100;
  if (last > 1) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var v = num_(ids[i][0]);
      if (v > maxId) maxId = v;
      if (id && v === id) rowNum = i + 2;
    }
  }
  if (rowNum) {
    var cur = sh.getRange(rowNum, 1, 1, H.length).getValues()[0];
    var next = H.map(function (h, k) { return rec.hasOwnProperty(h) ? rec[h] : cur[k]; });
    sh.getRange(rowNum, 1, 1, H.length).setValues([next]);
    return { ok: true, id: id };
  }
  var newId = maxId + 1;
  var row = H.map(function (h) { return rec.hasOwnProperty(h) ? rec[h] : ""; });
  row[idx_(H, "ID")] = newId;
  row[idx_(H, "Created")] = new Date();
  sh.appendRow(row);
  return { ok: true, id: newId };
}

function adminDeleteProduct_(id) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRODUCTS_SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: false, error: "not found" };
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (num_(ids[i][0]) === num_(id)) { sh.deleteRow(i + 2); return { ok: true }; }
  }
  return { ok: false, error: "not found" };
}

/* REVIEWS */
function saveReview_(d) {
  var sh = sheet_(REVIEWS_SHEET, REVIEW_HEADERS);
  var name = clean_(d.name, 40), comment = clean_(d.comment, 400);
  if (name.length < 2 || comment.length < 5) return;
  var id = "R" + Utilities.getUuid().replace(/-/g, "").substring(0, 10);
  var urls = [];
  var imgs = (d.images || []).slice(0, 2);
  for (var i = 0; i < imgs.length; i++) {
    var u = saveImage_(imgs[i], id + "-" + (i + 1), REVIEW_FOLDER);
    if (u) urls.push(u);
  }
  var rating = Math.max(1, Math.min(5, Math.round(num_(d.rating)) || 5));
  sh.appendRow([id, new Date(), "Pending", name, clean_(d.product, 120), rating, comment, urls[0] || "", urls[1] || "", 0]);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat("dd-mmm-yyyy hh:mm");
  if (OWNER_EMAIL) {
    try {
      MailApp.sendEmail(OWNER_EMAIL, "New OtakuOriginals review (pending approval)",
        name + " rated " + rating + "/5\n\n" + comment + "\n\nOpen the 'Reviews' sheet and set Status to Approved to publish.");
    } catch (x) { /* email is optional */ }
  }
}
function approvedReviews_() {
  var sh = sheet_(REVIEWS_SHEET, REVIEW_HEADERS);
  if (sh.getLastRow() < 2) return [];
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, REVIEW_HEADERS.length).getValues();
  var out = [];
  for (var i = vals.length - 1; i >= 0; i--) {              // newest first
    var r = vals[i];
    if (String(r[2]).trim().toLowerCase() !== "approved") continue;
    out.push({
      id: r[0], name: r[3], product: r[4], rating: r[5], comment: r[6],
      images: [r[7], r[8]].filter(function (x) { return x; }), likes: num_(r[9]),
      date: Utilities.formatDate(new Date(r[1]), Session.getScriptTimeZone(), "yyyy-MM-dd")
    });
    if (out.length >= 60) break;
  }
  return out;
}
function saveLike_(d) {
  var sh = sheet_(REVIEWS_SHEET, REVIEW_HEADERS);
  if (sh.getLastRow() < 2) return;
  var hit = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(clean_(d.id, 20)).matchEntireCell(true).findNext();
  if (!hit) return;
  var cell = sh.getRange(hit.getRow(), 10);
  cell.setValue(Math.max(0, num_(cell.getValue()) + (num_(d.delta) >= 0 ? 1 : -1)));
}
