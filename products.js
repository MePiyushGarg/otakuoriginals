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
    inStock: true,
    description: "Embroidered adjustable cap with a matching pair of wristbands. One size fits most."
  }
];
