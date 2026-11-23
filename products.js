/* =====================================================================
   OtakuOriginals — STORE SETTINGS, OFFERS & PRODUCTS
   - Your private settings (Google Sheet link, UPI ID, Instagram reels)
     live in settings.js, NOT here.
   - Products can be added from the admin panel (yoursite/admin/). The
     product list below is only the fallback shown until you add products
     there, so you can leave it as it is.
   ===================================================================== */

const STORE_CONFIG = {
  brandName: "OtakuOriginals",
  whatsappNumber: "919115521711",              // country code + number, no "+" or spaces
  email: "OtakuOriginals7@gmail.com",
  instagram: "https://instagram.com/OtakuOriginals",
  youtube: "https://youtube.com",              // TODO: paste your exact YouTube channel link here later

  // Delivery & payments
  freeDelivery: true,                          // true = free delivery on EVERY order
  shippingText: "FREE delivery on every order",
  codEnabled: true,                            // Cash on Delivery on/off
  upiDiscountPercent: 5,                       // extra % off when paying by UPI (not on COD). Set 0 to turn off
  paymentText: "Pay by UPI (extra 5% off) or Cash on Delivery.",
  trackingText: "Tracking details are shared on WhatsApp as soon as your order ships.",

  // Set in settings.js: sheetWebhookUrl, upiId, upiName
  sheetWebhookUrl: "",
  upiId: "",
  upiName: "OtakuOriginals"
};

/* =====================================================================
   AUTO OFFERS  (applied automatically in the cart — edit freely)
   - "min" is the cart subtotal needed (offer applies at that amount or more).
   - discount: flat ₹ off | gift: items added free.
   - If several tiers are met: biggest discount wins and the highest tier's gift is given.
   - Free delivery on every order is controlled by freeDelivery above.
   ===================================================================== */
const OFFERS = [
  { min: 1499, icon: "₹", short: "₹100", title: "₹100 OFF",
    desc: "Flat ₹100 off on orders of ₹1,499 and above.", discount: 100 },
  { min: 2000, icon: "🎁", short: "Gift", title: "Free Gift",
    desc: "1 surprise keychain + 5 stickers free on orders of ₹2,000 and above.",
    gift: { mystery: 0, keychains: 1, stickers: 5 } },
  { min: 5000, icon: "★", short: "Mega", title: "Mega Reward",
    desc: "1 mystery gift + 1 keychain + 10 stickers free on orders of ₹5,000 and above.",
    gift: { mystery: 1, keychains: 1, stickers: 10 } }
];

/* Offers that are not based on cart value (shown in the offers section and ticker only) */
const BONUS_OFFERS = [
  { label: "Every order", title: "Free Delivery", desc: "Free delivery on every order, anywhere in India. No minimum." },
  { label: "Pay by UPI", title: "Extra 5% OFF", desc: "Get an extra 5% off your total when you pay by UPI. Not applicable on Cash on Delivery." }
];

/* Free gifts are picked at random from these lists when an order is placed.
   Add or rename items to match what you actually have in stock. */
const GIFT_POOL = {
  keychains: ["Chibi Ninja Keychain", "Pirate Captain Keychain", "Sword Spirit Keychain", "Cyber Fox Keychain", "Mecha Pilot Keychain"],
  mystery: ["Anime Mini Poster (A4)", "Acrylic Mini Standee", "Enamel Pin", "Anime Wristband", "Mini Manga Notebook"]
};

/* =====================================================================
   PRODUCTS (fallback list)
   Once you add your first product in the admin panel, the admin list
   replaces this one automatically.
   category must be: "Action Figures" | "Posters" | "Stickers" | "Anime Merch"
   ===================================================================== */
const PRODUCTS = [
  {
    id: 1,
    name: "Straw Hat Captain Figure (18cm)",
    category: "Action Figures",
    price: 1499,
    originalPrice: 1999,
    badge: "Bestseller",
    image: "https://picsum.photos/seed/oo-figure-1/600/750",   // swap: "images/product-1.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-figure-1/600/750", "https://picsum.photos/seed/oo-figure-1-b/600/750", "https://picsum.photos/seed/oo-figure-1-c/600/750"],
    inStock: true,
    description: "Dynamic-pose PVC collectible with detailed paint finish and a sturdy display base. Perfect for shelves and desks."
  }
];

/* =====================================================================
   FAQ — shown on the site, used by the help assistant, and added to
   Google as FAQ schema. "keys" are words the assistant listens for.
   ===================================================================== */
const FAQS = [
  { q: "How does ordering work?",
    a: "Add products to your cart, enter your delivery details, choose UPI or Cash on Delivery and send the order on WhatsApp. Our team then verifies stock and confirms your order.",
    keys: ["how to order", "how do i order", "how can i order", "place an order", "place order", "ordering", "how do i buy", "how to buy", "buy", "purchase", "process"] },
  { q: "Which payment methods do you accept?",
    a: "You can pay by UPI (scan the QR code or open your UPI app) or choose Cash on Delivery. UPI payments get an extra 5% off.",
    keys: ["pay", "payment", "upi", "cod", "cash", "cash on delivery", "gpay", "phonepe", "paytm", "card", "qr"] },
  { q: "What is the UPI discount?",
    a: "Pay by UPI and get an extra 5% off your order total. The 5% UPI discount is not available on Cash on Delivery orders.",
    keys: ["upi discount", "upi offer", "extra 5", "5 percent", "cashback", "upi off"] },
  { q: "How long does delivery take?",
    a: "Orders are usually dispatched within 2-4 working days after confirmation, and delivery takes about 4-8 working days depending on your location.",
    keys: ["delivery time", "how long", "days", "time", "long", "arrive", "when", "dispatch", "shipped"] },
  { q: "What are the shipping charges?",
    a: "Delivery is free on every order, anywhere in India. There is no minimum order value.",
    keys: ["shipping", "charge", "free delivery", "free shipping", "cost", "fee", "delivery charge"] },
  { q: "How can I track my order?",
    a: "Once your order ships, we send the courier tracking details on the same WhatsApp number you ordered with.",
    keys: ["track", "tracking", "status", "where", "courier", "awb"] },
  { q: "What if a product is out of stock?",
    a: "We will tell you on WhatsApp right away. If you already paid by UPI for an item we cannot supply, the full amount for that item is refunded to your UPI ID.",
    keys: ["stock", "out of stock", "unavailable", "available", "sold"] },
  { q: "What are the auto offers?",
    a: "₹100 off above ₹1,499, a free keychain and 5 stickers above ₹2,000, a mega reward (mystery gift, keychain and 10 stickers) above ₹5,000, free delivery on every order, and an extra 5% off with UPI. Cart offers apply automatically.",
    keys: ["offer", "discount", "gift", "free", "coupon", "deal", "reward", "sticker", "keychain"] },
  { q: "Can I return or replace a product?",
    a: "Yes, if an item arrives damaged, defective or wrong. Message us on WhatsApp within 48 hours of delivery with an unboxing video or clear photos.",
    keys: ["return", "refund", "replace", "damaged", "broken", "wrong", "exchange", "defective"] },
  { q: "Are these official licensed products?",
    a: "We currently sell general anime-inspired merchandise, which is not official licensed merchandise unless a product page says so. As we grow, we plan to launch our own OtakuOriginals label.",
    keys: ["official", "original", "licensed", "genuine", "authentic", "fake", "copy", "quality"] },
  { q: "I added items to my cart but have not ordered. What now?",
    a: "Your cart is saved on this device. Open the cart, tap 'Proceed to Order', fill in your details and send the order on WhatsApp. If you need help, message us anytime.",
    keys: ["cart", "added", "checkout", "stuck", "problem", "error", "not working", "help"] }
];
