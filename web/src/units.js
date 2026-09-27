// Unit logic lives here only, so a unit (e.g. lb) can be added later without
// touching catalog data, the picker, or the math.
const UNITS = {
  kg: { step: 0.5, label: (q) => "kg" },
  bunch: { step: 1, label: (q) => (q === 1 ? "bunch" : "bunches") },
  piece: { step: 1, label: (q) => (q === 1 ? "piece" : "pieces") },
  unit: { step: 1, label: (q) => (q === 1 ? "unit" : "units") },
};

export function stepForUnit(unit) {
  return UNITS[unit]?.step ?? 1;
}

export function unitLabel(unit, qty) {
  return UNITS[unit]?.label(qty) ?? unit;
}

export function formatQty(qty, unit) {
  const rounded = Math.round(qty * 100) / 100;
  return `${rounded} ${unitLabel(unit, rounded)}`;
}
