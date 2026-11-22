/* =====================================================================
   OtakuOriginals — STORE SETTINGS & PRODUCT CATALOG
   Edit this file to manage your store. No other file needs changes.
   ===================================================================== */

const STORE_CONFIG = {
  brandName: "OtakuOriginals",
  whatsappNumber: "919115521711",              // country code + number, no "+" or spaces
  email: "OtakuOriginals7@gmail.com",
  instagram: "https://instagram.com/OtakuOriginals",
  youtube: "https://youtube.com",              // TODO: paste your exact YouTube channel link here later
  shippingText: "Calculated & confirmed during stock verification",
  paymentText: "UPI accepted after your order is approved. Cash on Delivery coming soon.",
  trackingText: "Tracking details are shared on WhatsApp as soon as your order ships.",

  // --- Google Sheet order log + customer reviews (see google-apps-script.gs) ---
  // After you deploy the Apps Script, paste its Web App URL here (ends with /exec).
  // Leave it as "" and the site still works (orders go to WhatsApp only, reviews fall back to WhatsApp).
  sheetWebhookUrl: "https://script.google.com/macros/s/AKfycbzTwZkgVPS2TmVBBl36a7iK1AO0rCuLdoCgMh3Abe0496rS82wK-wATJ65Sw0sNtk0J/exec",

  // --- Optional future shipping settings (currently unused) ---
  // flatShippingFee: 79,          // flat fee in ₹
  // freeShippingThreshold: 999,   // free shipping above this subtotal in ₹
};

/* =====================================================================
   AUTO OFFERS  (applied automatically in the cart — edit freely)
   - "min" is the cart subtotal needed (offer applies at that amount or more).
   - discount: flat ₹ off | freeShipping: true | gift: items added free.
   - If several tiers are met: biggest discount wins, free delivery applies
     if any met tier has it, and the highest tier's gift is given.
   - icon/short are the tiny labels shown on the cart progress bar.
   ===================================================================== */
const OFFERS = [
  { min: 1499, icon: "₹", short: "₹100", title: "₹100 OFF",
    desc: "Flat ₹100 off on orders of ₹1,499 and above.", discount: 100 },
  { min: 2000, icon: "🎁", short: "Gift", title: "Free Gift",
    desc: "1 surprise keychain + 5 stickers free on orders of ₹2,000 and above.",
    gift: { mystery: 0, keychains: 1, stickers: 5 } },
  { min: 3000, icon: "🚚", short: "Delivery", title: "Free Delivery",
    desc: "Free delivery on orders of ₹3,000 and above.", freeShipping: true },
  { min: 5000, icon: "★", short: "Mega", title: "Mega Reward",
    desc: "Free delivery + 1 mystery gift + 1 keychain + 10 stickers on orders of ₹5,000 and above.",
    freeShipping: true, gift: { mystery: 1, keychains: 1, stickers: 10 } }
];

/* Free gifts are picked at random from these lists when an order is placed.
   Add or rename items to match what you actually have in stock. */
const GIFT_POOL = {
  keychains: ["Chibi Ninja Keychain", "Pirate Captain Keychain", "Sword Spirit Keychain", "Cyber Fox Keychain", "Mecha Pilot Keychain"],
  mystery: ["Anime Mini Poster (A4)", "Acrylic Mini Standee", "Enamel Pin", "Anime Wristband", "Mini Manga Notebook"]
};

/* =====================================================================
   PRODUCTS
   To add a product: copy ONE block below, paste it at the end of the
   array, give it a NEW unique id, and edit the fields.

   category must be exactly one of:
     "Action Figures" | "Posters" | "Stickers" | "Anime Merch"
   badge: "Bestseller" | "New" | "Limited" | "" (empty for none)
   image: currently placeholder photos. To use your own images, upload
          them to an /images folder in your repo and use a local path:
          image: "images/product-1.jpg"
   ===================================================================== */

const PRODUCTS = [
  // ---------------- ACTION FIGURES ----------------
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
  },
  {
    id: 2,
    name: "Shadow Swordsman Articulated Figure",
    category: "Action Figures",
    price: 1899,
    originalPrice: 2499,
    badge: "New",
    image: "https://picsum.photos/seed/oo-figure-2/600/750",   // swap: "images/product-2.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-figure-2/600/750", "https://picsum.photos/seed/oo-figure-2-b/600/750", "https://picsum.photos/seed/oo-figure-2-c/600/750"],
    inStock: true,
    description: "Fully articulated 16cm figure with two interchangeable hands and a removable katana accessory."
  },
  {
    id: 3,
    name: "Hidden Leaf Ninja Mini Statue",
    category: "Action Figures",
    price: 999,
    originalPrice: 1299,
    badge: "",
    image: "https://picsum.photos/seed/oo-figure-3/600/750",   // swap: "images/product-3.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-figure-3/600/750", "https://picsum.photos/seed/oo-figure-3-b/600/750", "https://picsum.photos/seed/oo-figure-3-c/600/750"],
    inStock: true,
    description: "Compact 10cm statue with action-ready stance. A great starter piece for any collection."
  },
  {
    id: 4,
    name: "Demon Slayer Corps Collector Edition",
    category: "Action Figures",
    price: 2799,
    originalPrice: 3499,
    badge: "Limited",
    image: "https://picsum.photos/seed/oo-figure-4/600/750",   // swap: "images/product-4.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-figure-4/600/750", "https://picsum.photos/seed/oo-figure-4-b/600/750", "https://picsum.photos/seed/oo-figure-4-c/600/750"],
    inStock: false,
    description: "Limited-run 22cm collector figure with effect parts and premium window-box packaging."
  },

  // ---------------- POSTERS ----------------
  {
    id: 5,
    name: "Minimalist Anime Poster Set (A3, Set of 4)",
    category: "Posters",
    price: 599,
    originalPrice: 899,
    badge: "Bestseller",
    image: "https://picsum.photos/seed/oo-poster-1/600/750",   // swap: "images/product-5.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-poster-1/600/750", "https://picsum.photos/seed/oo-poster-1-b/600/750", "https://picsum.photos/seed/oo-poster-1-c/600/750"],
    inStock: true,
    description: "Four matte-finish A3 prints in a clean minimalist style. 300 GSM art paper, vibrant and fade-resistant."
  },
  {
    id: 6,
    name: "Cyber City Night Poster (A2)",
    category: "Posters",
    price: 449,
    originalPrice: 649,
    badge: "New",
    image: "https://picsum.photos/seed/oo-poster-2/600/750",   // swap: "images/product-6.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-poster-2/600/750", "https://picsum.photos/seed/oo-poster-2-b/600/750", "https://picsum.photos/seed/oo-poster-2-c/600/750"],
    inStock: true,
    description: "Large A2 neon cityscape print inspired by classic cyberpunk anime. Ships rolled in a protective tube."
  },
  {
    id: 7,
    name: "Manga Panel Art Print (A3)",
    category: "Posters",
    price: 349,
    originalPrice: 499,
    badge: "",
    image: "https://picsum.photos/seed/oo-poster-3/600/750",   // swap: "images/product-7.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-poster-3/600/750", "https://picsum.photos/seed/oo-poster-3-b/600/750", "https://picsum.photos/seed/oo-poster-3-c/600/750"],
    inStock: true,
    description: "Bold black-and-white manga panel layout on textured paper. Frame-ready and gallery quality."
  },
  {
    id: 8,
    name: "Spirit Forest Poster Pack (Set of 3)",
    category: "Posters",
    price: 499,
    originalPrice: 749,
    badge: "Limited",
    image: "https://picsum.photos/seed/oo-poster-4/600/750",   // swap: "images/product-8.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-poster-4/600/750", "https://picsum.photos/seed/oo-poster-4-b/600/750", "https://picsum.photos/seed/oo-poster-4-c/600/750"],
    inStock: true,
    description: "Three watercolor-style A3 posters with serene fantasy scenes. Limited print run."
  },

  // ---------------- STICKERS ----------------
  {
    id: 9,
    name: "Anime Sticker Pack (50 Pcs)",
    category: "Stickers",
    price: 249,
    originalPrice: 399,
    badge: "Bestseller",
    image: "https://picsum.photos/seed/oo-sticker-1/600/750",  // swap: "images/product-9.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-sticker-1/600/750", "https://picsum.photos/seed/oo-sticker-1-b/600/750", "https://picsum.photos/seed/oo-sticker-1-c/600/750"],
    inStock: true,
    description: "Waterproof vinyl stickers in assorted designs. Great for laptops, bottles, helmets and journals."
  },
  {
    id: 10,
    name: "Holographic Chibi Stickers (20 Pcs)",
    category: "Stickers",
    price: 199,
    originalPrice: 299,
    badge: "New",
    image: "https://picsum.photos/seed/oo-sticker-2/600/750",  // swap: "images/product-10.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-sticker-2/600/750", "https://picsum.photos/seed/oo-sticker-2-b/600/750", "https://picsum.photos/seed/oo-sticker-2-c/600/750"],
    inStock: true,
    description: "Shiny holographic die-cut chibi stickers that catch the light. Scratch-resistant finish."
  },
  {
    id: 11,
    name: "Kanji Symbols Sticker Sheet",
    category: "Stickers",
    price: 129,
    originalPrice: 179,
    badge: "",
    image: "https://picsum.photos/seed/oo-sticker-3/600/750",  // swap: "images/product-11.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-sticker-3/600/750", "https://picsum.photos/seed/oo-sticker-3-b/600/750", "https://picsum.photos/seed/oo-sticker-3-c/600/750"],
    inStock: true,
    description: "Matte black-and-white kanji sticker sheet with 30 mini designs. Clean and minimal."
  },
  {
    id: 12,
    name: "Mega Laptop Sticker Bomb (100 Pcs)",
    category: "Stickers",
    price: 449,
    originalPrice: 699,
    badge: "Limited",
    image: "https://picsum.photos/seed/oo-sticker-4/600/750",  // swap: "images/product-12.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-sticker-4/600/750", "https://picsum.photos/seed/oo-sticker-4-b/600/750", "https://picsum.photos/seed/oo-sticker-4-c/600/750"],
    inStock: false,
    description: "A huge mixed pack of 100 premium vinyl stickers — the ultimate sticker-bomb starter kit."
  },

  // ---------------- ANIME MERCH ----------------
  {
    id: 13,
    name: "Oversized Anime Graphic Tee",
    category: "Anime Merch",
    price: 899,
    originalPrice: 1299,
    badge: "Bestseller",
    image: "https://picsum.photos/seed/oo-merch-1/600/750",    // swap: "images/product-13.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-merch-1/600/750", "https://picsum.photos/seed/oo-merch-1-b/600/750", "https://picsum.photos/seed/oo-merch-1-c/600/750"],
    inStock: true,
    description: "240 GSM 100% cotton oversized tee with a bold front print. Available in M, L and XL — mention size in the order note."
  },
  {
    id: 14,
    name: "Anime Keychain Set (Set of 3)",
    category: "Anime Merch",
    price: 299,
    originalPrice: 449,
    badge: "New",
    image: "https://picsum.photos/seed/oo-merch-2/600/750",    // swap: "images/product-14.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-merch-2/600/750", "https://picsum.photos/seed/oo-merch-2-b/600/750", "https://picsum.photos/seed/oo-merch-2-c/600/750"],
    inStock: true,
    description: "Double-sided acrylic keychains with metal rings. Lightweight and durable."
  },
  {
    id: 15,
    name: "Ink & Crimson Ceramic Mug",
    category: "Anime Merch",
    price: 499,
    originalPrice: 699,
    badge: "",
    image: "https://picsum.photos/seed/oo-merch-3/600/750",    // swap: "images/product-15.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-merch-3/600/750", "https://picsum.photos/seed/oo-merch-3-b/600/750", "https://picsum.photos/seed/oo-merch-3-c/600/750"],
    inStock: true,
    description: "350ml glossy ceramic mug with a minimalist manga-style print. Dishwasher safe."
  },
  {
    id: 16,
    name: "Anime Cap & Wristband Combo",
    category: "Anime Merch",
    price: 699,
    originalPrice: 999,
    badge: "Limited",
    image: "https://picsum.photos/seed/oo-merch-4/600/750",    // swap: "images/product-16.jpg"
    // Add more photos for the gallery (first one is the main photo). Local example: "images/product-1-2.jpg"
    images: ["https://picsum.photos/seed/oo-merch-4/600/750", "https://picsum.photos/seed/oo-merch-4-b/600/750", "https://picsum.photos/seed/oo-merch-4-c/600/750"],
    inStock: true,
    description: "Embroidered adjustable cap with a matching pair of wristbands. One size fits most."
  }
];


/* =====================================================================
   JOURNEY — INSTAGRAM REELS
   Paste your reel links here (one per line). They rotate automatically in
   the "Our Journey" section: 1, 2, 3, then back to 1.
   Leave the list empty to show "coming soon" cards.
   Example: "https://www.instagram.com/reel/AbCdEfGhIjK/",
   ===================================================================== */
const REELS = [
  // "https://www.instagram.com/reel/XXXXXXXXXXX/",
  // "https://www.instagram.com/reel/YYYYYYYYYYY/",
  // "https://www.instagram.com/reel/ZZZZZZZZZZZ/",
];

/* =====================================================================
   FAQ — shown on the site, used by the help assistant, and added to
   Google as FAQ schema. "keys" are words the assistant listens for.
   ===================================================================== */
const FAQS = [
  { q: "How does ordering work?",
    a: "Add products to your cart, fill in your delivery details and tap 'Send Order on WhatsApp'. Our team checks stock and replies with the final shipping details. You pay only after you approve.",
    keys: ["how to order", "how do i order", "how can i order", "place an order", "place order", "ordering", "how do i buy", "how to buy", "buy", "purchase", "process"] },
  { q: "Which payment methods do you accept?",
    a: "We currently accept UPI, and only after your order is approved. Cash on Delivery will be available soon.",
    keys: ["pay", "payment", "upi", "cod", "cash", "gpay", "phonepe", "paytm", "card"] },
  { q: "Do I have to pay while placing the order?",
    a: "No. No payment is taken when you send the order. Payment is requested only after our admin verifies stock and you approve packing.",
    keys: ["advance", "prepay", "pay now", "money", "charge", "when pay"] },
  { q: "How long does delivery take?",
    a: "Orders are usually dispatched within 2-4 working days after approval, and delivery takes about 4-8 working days depending on your location.",
    keys: ["delivery time", "how long", "days", "time", "long", "arrive", "when", "dispatch", "shipped"] },
  { q: "What are the shipping charges?",
    a: "Delivery is free on orders of Rs. 3,000 and above. For smaller orders, the shipping charge is confirmed on WhatsApp during stock verification.",
    keys: ["shipping", "charge", "free delivery", "cost", "fee", "delivery charge"] },
  { q: "How can I track my order?",
    a: "Once your order ships, we send the courier tracking details on the same WhatsApp number you ordered with.",
    keys: ["track", "tracking", "status", "where", "courier", "awb"] },
  { q: "What if a product is out of stock?",
    a: "We will tell you on WhatsApp right away and suggest similar items. You are never charged for something we cannot supply.",
    keys: ["stock", "out of stock", "unavailable", "available", "sold"] },
  { q: "What are the auto offers?",
    a: "Rs. 100 off above Rs. 1,499, a free keychain and 5 stickers above Rs. 2,000, free delivery above Rs. 3,000, and a mega reward (free delivery, mystery gift, keychain and 10 stickers) above Rs. 5,000. They apply automatically in your cart.",
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
