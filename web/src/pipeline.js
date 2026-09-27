// All math for one household's week: live estimate while building the list,
// the card hold at close, the demo market-run simulation, and the reconciled
// bill. Money stays in integer cents throughout; formatting happens in the UI.
import {
  RUNNER_SHARE_CENTS,
  ESTIMATE_BAND_PCT,
  MARKET_VARIANCE_PCT,
  HOLD_BUFFER_PCT,
} from "./config.js";

// A small set of plausible substitute names for the demo's "one item got
// substituted" flourish. Falls back to a generic note when a line's item
// isn't listed.
const SUBSTITUTE_NAMES = {
  tomato: "Roma tomato",
  "romaine-lettuce": "Green leaf lettuce",
  "gala-apple": "Fuji apple",
  "yellow-onion": "White onion",
  cilantro: "Flat leaf parsley",
};

export function lineEstimate(line) {
  if (line.kind !== "catalog") return null;
  const center = Math.round(line.stubPriceCents * line.qty);
  return {
    center,
    low: Math.round(center * (1 - ESTIMATE_BAND_PCT)),
    high: Math.round(center * (1 + ESTIMATE_BAND_PCT)),
  };
}

export function basketSummary(lines) {
  let groceriesLow = 0;
  let groceriesHigh = 0;
  let customCount = 0;
  for (const line of lines) {
    if (line.kind === "catalog") {
      const est = lineEstimate(line);
      groceriesLow += est.low;
      groceriesHigh += est.high;
    } else {
      customCount += 1;
    }
  }
  return { groceriesLow, groceriesHigh, runnerShare: RUNNER_SHARE_CENTS, customCount };
}

export function computeHold(summary) {
  const buffered = Math.round(summary.groceriesHigh * (1 + HOLD_BUFFER_PCT));
  return buffered + summary.runnerShare;
}

function substituteNameFor(line) {
  return SUBSTITUTE_NAMES[line.itemId] || `Similar ${line.category.toLowerCase().replace(/s$/, "")}`;
}

// Generates demo "actual" results for a closed basket. Pure aside from `rng`,
// which defaults to Math.random so callers can inject a seeded RNG in tests.
export function simulateMarketRun(lines, rng = Math.random) {
  const subCandidates = lines.filter((l) => l.kind === "catalog" && l.substitution !== "skip");
  const shouldSubstitute = subCandidates.length > 0 && rng() < 0.7;
  const subLineId = shouldSubstitute ? subCandidates[Math.floor(rng() * subCandidates.length)].lineId : null;

  return lines.map((line) => {
    if (line.substitution === "skip") {
      return { ...line, paidCents: 0, chip: "skipped", diffCents: 0, note: null, estimate: lineEstimate(line) };
    }

    if (line.kind === "custom") {
      const perUnitCents = 300 + Math.floor(rng() * 900); // $3.00-$12.00, invented for a free-text item
      const paidCents = Math.round(perUnitCents * line.qty);
      return { ...line, paidCents, chip: "market", diffCents: 0, note: null, estimate: null };
    }

    const variance = (rng() * 2 - 1) * MARKET_VARIANCE_PCT;
    const unitPriceCents = Math.max(1, Math.round(line.stubPriceCents * (1 + variance)));
    const paidCents = Math.round(unitPriceCents * line.qty);
    const estimate = lineEstimate(line);
    const within = paidCents <= estimate.high;
    const isSubbed = line.lineId === subLineId;
    return {
      ...line,
      paidCents,
      chip: within ? "within" : "above",
      diffCents: within ? 0 : paidCents - estimate.high,
      note: isSubbed ? `Substituted: ${substituteNameFor(line)} for ${line.name}` : null,
      estimate,
    };
  });
}

export function computeBill(results, holdCents) {
  const groceriesActual = results.reduce((sum, r) => sum + (r.paidCents || 0), 0);
  const runnerShare = RUNNER_SHARE_CENTS;
  const charged = groceriesActual + runnerShare;
  const heldRelease = charged <= holdCents ? holdCents - charged : 0;
  const extraCharged = charged > holdCents ? charged - holdCents : 0;
  return { groceriesActual, runnerShare, charged, holdCents, heldRelease, extraCharged };
}
