// Client-side port of the aggregation -> price-verification -> allocation ->
// billing steps from wsell/ (see ../../wsell/*.py for the source of truth).
// Extended to run across many catalog items instead of a single one.

export function aggregateBaskets(baskets) {
  const items = {};
  for (const [householdId, basket] of Object.entries(baskets)) {
    for (const [itemId, qty] of Object.entries(basket)) {
      if (!qty || qty <= 0) continue;
      if (!items[itemId]) items[itemId] = { itemId, totalQty: 0, households: [] };
      items[itemId].totalQty += qty;
      items[itemId].households.push({ id: householdId, qty });
    }
  }
  return items;
}

function bandFromCenter(center, tolerancePct) {
  return {
    expectedTotal: center,
    low: center * (1 - tolerancePct),
    high: center * (1 + tolerancePct),
  };
}

export function expectedCostBand(totalQty, unitPrice, tolerancePct = 0.08) {
  return bandFromCenter(totalQty * unitPrice, tolerancePct);
}

export function verifyAmount(band, submittedTotal) {
  const flagged = submittedTotal < band.low || submittedTotal > band.high;
  const deviationPct = band.expectedTotal
    ? (submittedTotal - band.expectedTotal) / band.expectedTotal
    : 0;
  return { flagged, deviationPct, submittedTotal };
}

export function runWeeklyCycle({
  baskets,
  feedPrices,
  actualPaid,
  runnerFlatFee,
  platformFeePct = 0.1,
  tolerancePct = 0.08,
}) {
  const aggregated = aggregateBaskets(baskets);
  const itemIds = Object.keys(aggregated);

  const itemChecks = itemIds.map((itemId) => {
    const agg = aggregated[itemId];
    const unitPrice = feedPrices[itemId] || 0;
    const paid = actualPaid[itemId] || 0;
    const band = expectedCostBand(agg.totalQty, unitPrice, tolerancePct);
    const { flagged, deviationPct } = verifyAmount(band, paid);
    return { itemId, totalQty: agg.totalQty, unitPrice, paid, band, flagged, deviationPct };
  });

  const totalExpected = itemChecks.reduce((sum, c) => sum + c.band.expectedTotal, 0);
  const totalPaid = itemChecks.reduce((sum, c) => sum + c.paid, 0);
  const totalBand = bandFromCenter(totalExpected, tolerancePct);
  const totalCheck = verifyAmount(totalBand, totalPaid);

  const householdIds = Object.keys(baskets);
  const passthrough = Object.fromEntries(householdIds.map((id) => [id, 0]));
  const itemBreakdownByHousehold = Object.fromEntries(householdIds.map((id) => [id, []]));

  for (const c of itemChecks) {
    const agg = aggregated[c.itemId];
    for (const h of agg.households) {
      const cost = agg.totalQty > 0 ? (h.qty / agg.totalQty) * c.paid : 0;
      passthrough[h.id] += cost;
      itemBreakdownByHousehold[h.id].push({ itemId: c.itemId, qty: h.qty, cost });
    }
  }

  const activeHouseholds = householdIds.filter((id) =>
    Object.values(baskets[id] || {}).some((qty) => qty > 0)
  );

  const bills = householdIds.map((id) => {
    const isActive = activeHouseholds.includes(id);
    const wholesaleCost = passthrough[id] || 0;
    const platformFee = wholesaleCost * platformFeePct;
    const runnerFeeShare =
      isActive && activeHouseholds.length ? runnerFlatFee / activeHouseholds.length : 0;
    const total = wholesaleCost + platformFee + runnerFeeShare;
    return {
      id,
      isActive,
      items: itemBreakdownByHousehold[id],
      wholesaleCost,
      platformFee,
      runnerFeeShare,
      total,
    };
  });

  return { aggregated, itemChecks, totalBand, totalCheck, totalPaid, bills, activeHouseholds };
}

// Rounds bill totals to cents at display time only, forcing the sum of the
// displayed totals across active households to equal the rounded grand
// total exactly (any leftover cent lands on the last active household).
export function reconcileDisplayTotals(bills) {
  const active = bills.filter((b) => b.isActive);
  const displayTotals = {};
  for (const b of bills) displayTotals[b.id] = 0;
  if (active.length === 0) return displayTotals;

  let sumExceptLast = 0;
  const lastId = active[active.length - 1].id;
  for (const b of active) {
    if (b.id === lastId) continue;
    const rounded = Math.round(b.total * 100) / 100;
    displayTotals[b.id] = rounded;
    sumExceptLast += rounded;
  }
  const grandExact = active.reduce((sum, b) => sum + b.total, 0);
  const grandRounded = Math.round(grandExact * 100) / 100;
  displayTotals[lastId] = Math.round((grandRounded - sumExceptLast) * 100) / 100;
  return displayTotals;
}
