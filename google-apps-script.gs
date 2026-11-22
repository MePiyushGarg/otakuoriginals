/**
 * OtakuOriginals — Google Sheet backend (orders log + customer reviews + likes)
 *
 * ONE-TIME SETUP (about 5 minutes)
 * 1. Go to sheets.new and name the sheet "OtakuOriginals Orders".
 * 2. Menu: Extensions > Apps Script. Delete everything there, paste this whole file, click Save.
 * 3. Click Deploy > New deployment > type "Web app".
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    Click Deploy and allow the permissions Google asks for
 *    (Advanced > Go to project (unsafe) is normal for your own script).
 * 4. Copy the "Web app URL" (ends with /exec) and paste it into products.js:
 *      sheetWebhookUrl: "PASTE_URL_HERE",
 * 5. Upload the updated products.js to GitHub. Done.
 *
 * AFTER YOU CHANGE THIS CODE: Deploy > Manage deployments > pencil icon > Version: New version > Deploy.
 * (The URL stays the same.)
 *
 * HOW YOU USE IT
 * - Sheet "Orders": one row per order. The Status column shows how far the customer got:
 *     "Details entered - NOT submitted"  -> typed name + phone but never pressed Send  (follow up!)
 *     "Copied summary - not sent yet"    -> copied the text but may not have sent it
 *     "Submitted - opening WhatsApp"     -> pressed Send
 *     "Redirected to WhatsApp"           -> WhatsApp was opened with the order (check your WhatsApp for it)
 *   Note: "Redirected" means WhatsApp opened. Only your WhatsApp inbox can confirm the message was really sent.
 * - Sheet "Reviews": new reviews arrive as Status = Pending. Change it to "Approved" to show it on the
 *   website, or "Hidden" to remove it. Photos are saved in your Google Drive folder "OtakuOriginals Review Photos".
 * - Rows with status "Details entered - NOT submitted" are your abandoned checkouts. Message or mail those customers.
 */

var ORDERS_SHEET = "Orders";
var REVIEWS_SHEET = "Reviews";
var PHOTO_FOLDER = "OtakuOriginals Review Photos";
var OWNER_EMAIL = "OtakuOriginals7@gmail.com";   // gets an email when a new review arrives (set "" to turn off)

var ORDER_HEADERS = ["Order ID", "First seen", "Last updated", "Status", "Name", "Phone", "Street", "Landmark", "City", "State",
  "Pincode", "Note", "Items", "Item count", "Subtotal", "Discount", "Delivery", "Free gifts", "Total", "Rank", "Page", "Follow-up notes"];
var REVIEW_HEADERS = ["Review ID", "Date", "Status", "Name", "Product", "Rating", "Comment", "Photo 1", "Photo 2", "Likes"];

/* ---------- entry points ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var data = JSON.parse(e.postData.contents);
    if (data.type === "order") saveOrder_(data);
    else if (data.type === "review") saveReview_(data);
    else if (data.type === "like") saveLike_(data);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* ignore */ }
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === "reviews") return json_({ ok: true, reviews: approvedReviews_() });
  return json_({ ok: true, service: "OtakuOriginals backend" });
}

/* ---------- helpers ---------- */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
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

/* ---------- orders ---------- */
function saveOrder_(d) {
  var sh = sheet_(ORDERS_SHEET, ORDER_HEADERS);
  var id = clean_(d.orderId, 20);
  if (!id) return;
  var now = new Date();
  var rank = num_(d.rank);
  var finder = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).createTextFinder(id).matchEntireCell(true);
  var hit = sh.getLastRow() > 1 ? finder.findNext() : null;

  var row = [id, now, now, clean_(d.status, 60), clean_(d.name, 80), clean_(d.phone, 15), clean_(d.street, 200),
    clean_(d.landmark, 100), clean_(d.city, 60), clean_(d.state, 60), clean_(d.pincode, 10), clean_(d.note, 300),
    clean_(d.items, 800), num_(d.itemCount), num_(d.subtotal), num_(d.discount), clean_(d.delivery, 60),
    clean_(d.gifts, 200), num_(d.total), rank, clean_(d.page, 200), ""];

  if (!hit) {
    sh.appendRow(row);
    var r = sh.getLastRow();
    sh.getRange(r, 6).setNumberFormat("@").setValue(row[5]);    // keep phone as text
    sh.getRange(r, 11).setNumberFormat("@").setValue(row[10]);  // keep pincode as text
    sh.getRange(r, 2, 1, 2).setNumberFormat("dd-mmm-yyyy hh:mm:ss");
    return;
  }
  var rr = hit.getRow();
  var oldRank = num_(sh.getRange(rr, 20).getValue());
  // Update the details and totals every time, but never move the status backwards.
  var values = row.slice(4, 19);                                  // Name .. Total
  sh.getRange(rr, 5, 1, values.length).setValues([values]);
  sh.getRange(rr, 6).setNumberFormat("@").setValue(row[5]);
  sh.getRange(rr, 11).setNumberFormat("@").setValue(row[10]);
  sh.getRange(rr, 3).setValue(now).setNumberFormat("dd-mmm-yyyy hh:mm:ss");
  if (rank >= oldRank) {
    sh.getRange(rr, 4).setValue(clean_(d.status, 60));
    sh.getRange(rr, 20).setValue(rank);
  }
}

/* ---------- reviews ---------- */
function saveReview_(d) {
  var sh = sheet_(REVIEWS_SHEET, REVIEW_HEADERS);
  var name = clean_(d.name, 40), comment = clean_(d.comment, 400);
  if (name.length < 2 || comment.length < 5) return;
  var id = "R" + Utilities.getUuid().replace(/-/g, "").substring(0, 10);
  var urls = [];
  var imgs = (d.images || []).slice(0, 2);
  for (var i = 0; i < imgs.length; i++) {
    var u = savePhoto_(imgs[i], id + "-" + (i + 1));
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
function savePhoto_(dataUrl, name) {
  var m = String(dataUrl || "").match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (!m || m[2].length > 2000000) return "";          // images only, about 1.5 MB max after compression
  var folders = DriveApp.getFoldersByName(PHOTO_FOLDER);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER);
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), "image/jpeg", name + ".jpg");
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w800";
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
