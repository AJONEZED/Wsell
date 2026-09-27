// Product catalog stub. Swap this for a real catalog/pricing API later —
// everything downstream only depends on the
// {id, name, aliases, category, unit, stubPriceCents} shape below.
// Prices are stub wholesale cents per unit (per kg / per bunch / per piece).

function slug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function item(name, category, unit, stubPriceCents, aliases = []) {
  return { id: slug(name), name, category, unit, stubPriceCents, aliases };
}

const V = "Vegetables";
const F = "Fruits";
const H = "Herbs";
const KG = "kg";
const BUNCH = "bunch";
const PIECE = "piece";

export const CATALOG_ITEMS = [
  // Vegetables
  item("Tomato", V, KG, 200, ["roma tomato"]),
  item("Potato", V, KG, 120, ["russet potato"]),
  item("Sweet potato", V, KG, 180, ["yam"]),
  item("Yellow onion", V, KG, 100, ["onion"]),
  item("Red onion", V, KG, 130),
  item("White onion", V, KG, 110),
  item("Garlic", V, KG, 400),
  item("Carrot", V, KG, 130),
  item("Celery", V, KG, 150),
  item("Cucumber", V, KG, 150),
  item("Zucchini", V, KG, 180, ["courgette"]),
  item("Yellow squash", V, KG, 180),
  item("Butternut squash", V, KG, 160),
  item("Acorn squash", V, KG, 170),
  item("Red bell pepper", V, KG, 280, ["red pepper", "bell pepper"]),
  item("Green bell pepper", V, KG, 220, ["green pepper"]),
  item("Jalapeño", V, KG, 300, ["jalapeno"]),
  item("Poblano pepper", V, KG, 290),
  item("Eggplant", V, KG, 190, ["aubergine"]),
  item("Broccoli", V, KG, 220),
  item("Cauliflower", V, KG, 210),
  item("Green cabbage", V, KG, 100, ["cabbage"]),
  item("Red cabbage", V, KG, 120),
  item("Brussels sprouts", V, KG, 260),
  item("Kale", V, BUNCH, 220),
  item("Spinach", V, KG, 350),
  item("Swiss chard", V, BUNCH, 230),
  item("Collard greens", V, BUNCH, 210),
  item("Romaine lettuce", V, PIECE, 150, ["lettuce"]),
  item("Iceberg lettuce", V, PIECE, 130),
  item("Arugula", V, KG, 400, ["rocket"]),
  item("Button mushroom", V, KG, 350, ["mushroom"]),
  item("Portobello mushroom", V, KG, 420),
  item("Green beans", V, KG, 260),
  item("Snap peas", V, KG, 320),
  item("Snow peas", V, KG, 330),
  item("Corn", V, PIECE, 70, ["corn on the cob", "sweet corn"]),
  item("Radish", V, KG, 180),
  item("Beet", V, KG, 150, ["beetroot"]),
  item("Turnip", V, KG, 140),
  item("Parsnip", V, KG, 190),
  item("Leek", V, KG, 220),
  item("Fennel", V, KG, 230),
  item("Artichoke", V, PIECE, 180),
  item("Asparagus", V, KG, 450),
  item("Okra", V, KG, 280),
  item("Bok choy", V, KG, 200, ["pak choi"]),
  item("Watercress", V, BUNCH, 200),
  item("Ginger", V, KG, 500, ["ginger root"]),
  item("Shallot", V, KG, 320),
  item("Rutabaga", V, KG, 140),
  item("Jicama", V, KG, 160),
  item("Celeriac", V, KG, 170, ["celery root"]),
  item("Horseradish", V, KG, 480),

  // Fruits
  item("Gala apple", F, KG, 220, ["apple"]),
  item("Fuji apple", F, KG, 230),
  item("Banana", F, KG, 150),
  item("Orange", F, KG, 180),
  item("Mandarin", F, KG, 220, ["clementine", "tangerine"]),
  item("Grapefruit", F, PIECE, 120),
  item("Lemon", F, KG, 200),
  item("Lime", F, KG, 220),
  item("Red grapes", F, KG, 350, ["grapes"]),
  item("Green grapes", F, KG, 340),
  item("Strawberry", F, KG, 450),
  item("Blueberry", F, KG, 700),
  item("Raspberry", F, KG, 800),
  item("Blackberry", F, KG, 750),
  item("Watermelon", F, PIECE, 500),
  item("Cantaloupe", F, PIECE, 350, ["muskmelon"]),
  item("Honeydew melon", F, PIECE, 380),
  item("Pineapple", F, PIECE, 350),
  item("Mango", F, KG, 320),
  item("Papaya", F, PIECE, 280),
  item("Kiwi", F, KG, 380),
  item("Pear", F, KG, 240),
  item("Peach", F, KG, 300),
  item("Nectarine", F, KG, 300),
  item("Plum", F, KG, 290),
  item("Cherry", F, KG, 650),
  item("Apricot", F, KG, 380),
  item("Pomegranate", F, PIECE, 250),
  item("Avocado", F, PIECE, 120),
  item("Coconut", F, PIECE, 250),
  item("Fig", F, KG, 550),
  item("Date", F, KG, 600),

  // Herbs
  item("Cilantro", H, BUNCH, 60, ["coriander"]),
  item("Flat leaf parsley", H, BUNCH, 60, ["parsley"]),
  item("Curly parsley", H, BUNCH, 60),
  item("Basil", H, BUNCH, 90),
  item("Mint", H, BUNCH, 60),
  item("Dill", H, BUNCH, 70),
  item("Thyme", H, BUNCH, 80),
  item("Rosemary", H, BUNCH, 80),
  item("Sage", H, BUNCH, 80),
  item("Oregano", H, BUNCH, 80),
  item("Chives", H, BUNCH, 90),
  item("Tarragon", H, BUNCH, 100),
  item("Marjoram", H, BUNCH, 90),
  item("Scallion", H, BUNCH, 70, ["green onion", "spring onion"]),
  item("Bay leaf", H, BUNCH, 100, ["bay leaves"]),
];

export const CATEGORIES = [V, F, H];

const BY_ID = new Map(CATALOG_ITEMS.map((it) => [it.id, it]));

export function getItem(id) {
  return BY_ID.get(id);
}
