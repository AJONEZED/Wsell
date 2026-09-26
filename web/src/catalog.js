// Product catalog stub. Swap this for a real catalog/pricing API later —
// everything downstream only depends on the {id, name, category, unit,
// stubPrice} shape below.
export const CATALOG_ITEMS = [
  { id: "tomato", name: "Tomato", category: "Vegetables", unit: "kg", stubPrice: 2.0 },
  { id: "potato", name: "Potato", category: "Vegetables", unit: "kg", stubPrice: 1.2 },
  { id: "onion", name: "Onion", category: "Vegetables", unit: "kg", stubPrice: 1.0 },
  { id: "carrot", name: "Carrot", category: "Vegetables", unit: "kg", stubPrice: 1.3 },
  { id: "zucchini", name: "Zucchini", category: "Vegetables", unit: "kg", stubPrice: 1.8 },
  { id: "bell-pepper", name: "Bell pepper", category: "Vegetables", unit: "kg", stubPrice: 2.5 },
  { id: "cucumber", name: "Cucumber", category: "Vegetables", unit: "kg", stubPrice: 1.5 },
  { id: "eggplant", name: "Eggplant", category: "Vegetables", unit: "kg", stubPrice: 1.9 },
  { id: "garlic", name: "Garlic", category: "Vegetables", unit: "kg", stubPrice: 4.0 },
  { id: "lettuce", name: "Lettuce", category: "Vegetables", unit: "piece", stubPrice: 1.0 },
  { id: "parsley", name: "Parsley", category: "Vegetables", unit: "bunch", stubPrice: 0.5 },
  { id: "coriander", name: "Coriander", category: "Vegetables", unit: "bunch", stubPrice: 0.5 },
  { id: "mint", name: "Mint", category: "Vegetables", unit: "bunch", stubPrice: 0.6 },
  { id: "orange", name: "Orange", category: "Fruits", unit: "kg", stubPrice: 1.8 },
  { id: "banana", name: "Banana", category: "Fruits", unit: "kg", stubPrice: 1.5 },
  { id: "apple", name: "Apple", category: "Fruits", unit: "kg", stubPrice: 2.2 },
  { id: "strawberry", name: "Strawberry", category: "Fruits", unit: "kg", stubPrice: 4.5 },
  { id: "grapes", name: "Grapes", category: "Fruits", unit: "kg", stubPrice: 3.5 },
  { id: "watermelon", name: "Watermelon", category: "Fruits", unit: "piece", stubPrice: 3.0 },
  { id: "lemon", name: "Lemon", category: "Fruits", unit: "kg", stubPrice: 2.0 },
  { id: "avocado", name: "Avocado", category: "Fruits", unit: "piece", stubPrice: 1.2 },
];

export const CATEGORIES = ["All", "Vegetables", "Fruits"];

const BY_ID = new Map(CATALOG_ITEMS.map((item) => [item.id, item]));

export function getItem(id) {
  return BY_ID.get(id);
}

export function stepForUnit(unit) {
  return unit === "kg" ? 0.5 : 1;
}

export function unitLabel(unit, qty) {
  if (unit === "kg") return "kg";
  if (unit === "bunch") return qty === 1 ? "bunch" : "bunches";
  return qty === 1 ? "piece" : "pieces";
}

export function formatQty(qty, unit) {
  const rounded = Math.round(qty * 100) / 100;
  return `${rounded} ${unitLabel(unit, rounded)}`;
}
