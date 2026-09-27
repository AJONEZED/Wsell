// Six sample past weeks so History isn't empty on first load. Clearly marked
// as sample data — real weeks are appended by the app after a bill is viewed.
import { getItem } from "./catalog.js";
import { lineEstimate } from "./pipeline.js";
import { RUNNER_SHARE_CENTS } from "./config.js";

function sampleLine(itemId, qty, paidCents, chip = "within", note = null) {
  const catalogItem = getItem(itemId);
  const line = {
    lineId: `${itemId}-seed`,
    kind: "catalog",
    itemId,
    name: catalogItem.name,
    category: catalogItem.category,
    unit: catalogItem.unit,
    qty,
    stubPriceCents: catalogItem.stubPriceCents,
    substitution: "substitute",
  };
  return { ...line, paidCents, chip, diffCents: 0, note, estimate: lineEstimate(line) };
}

function week(dateLabel, deliveryStatus, items) {
  const groceriesActual = items.reduce((sum, it) => sum + it.paidCents, 0);
  const charged = groceriesActual + RUNNER_SHARE_CENTS;
  return {
    id: `seed-${dateLabel}`,
    dateLabel,
    itemCount: items.length,
    chargedCents: charged,
    deliveryStatus,
    sample: true,
    bill: {
      groceriesActual,
      runnerShare: RUNNER_SHARE_CENTS,
      charged,
      holdCents: Math.round(charged * 1.15),
      heldRelease: Math.round(charged * 0.15),
      extraCharged: 0,
    },
    items,
  };
}

export function seedHistory() {
  return [
    week("Sat, Aug 30", "Delivered Saturday 11:42, photo confirmed", [
      sampleLine("tomato", 4, 760, "within"),
      sampleLine("potato", 3, 350, "within"),
      sampleLine("gala-apple", 2, 470, "within"),
      sampleLine("mint", 1, 60, "within"),
    ]),
    week("Sat, Sep 6", "Delivered Saturday 11:55, photo confirmed", [
      sampleLine("yellow-onion", 2, 210, "within"),
      sampleLine("carrot", 3, 420, "within"),
      sampleLine("banana", 2, 320, "above"),
      sampleLine("cilantro", 1, 60, "within"),
      sampleLine("romaine-lettuce", 2, 0, "skipped"),
    ]),
    week("Sat, Sep 13", "Delivered Saturday 12:03, photo confirmed", [
      sampleLine("tomato", 6, 1180, "above", null),
      sampleLine("cucumber", 2, 290, "within"),
      sampleLine("strawberry", 1, 430, "within"),
      sampleLine("basil", 1, 90, "within", "Substituted: Similar herb for Basil"),
    ]),
    week("Sat, Sep 20", "Delivered Saturday 11:38, photo confirmed", [
      sampleLine("sweet-potato", 3, 520, "within"),
      sampleLine("broccoli", 2, 430, "within"),
      sampleLine("orange", 3, 500, "within"),
      sampleLine("garlic", 1, 400, "within"),
      sampleLine("rosemary", 1, 80, "within"),
    ]),
    week("Sat, Sep 27", "Delivered Saturday 11:47, photo confirmed", [
      sampleLine("red-bell-pepper", 2, 610, "above"),
      sampleLine("zucchini", 2, 340, "within"),
      sampleLine("avocado", 3, 380, "within"),
      sampleLine("lemon", 2, 380, "within"),
    ]),
    week("Sat, Oct 4", "Delivered Saturday 12:11, photo confirmed", [
      sampleLine("spinach", 1, 350, "within"),
      sampleLine("button-mushroom", 1, 350, "within", "Substituted: Portobello mushroom for Button mushroom"),
      sampleLine("blueberry", 1, 700, "within"),
      sampleLine("banana", 2, 300, "within"),
      sampleLine("thyme", 1, 80, "within"),
    ]),
  ];
}
