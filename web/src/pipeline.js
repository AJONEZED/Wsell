// Client-side port of the aggregation -> price-verification -> allocation ->
// billing steps from wsell/ (see ../../wsell/*.py for the source of truth).
// Kept deliberately narrow: just enough of the pipeline to demo the fraud
// check and proportional billing live in a browser.

export function aggregate(households) {
  const totalQty = households.reduce((sum, h) => sum + h.qty, 0);
  return { totalQty, households };
}

export function expectedCostBand(totalQty, unitPrice, tolerancePct = 0.08) {
  const expectedTotal = totalQty * unitPrice;
  return {
    expectedTotal,
    low: expectedTotal * (1 - tolerancePct),
    high: expectedTotal * (1 + tolerancePct),
  };
}

export function verifyReceipt(band, submittedTotal) {
  const flagged = submittedTotal < band.low || submittedTotal > band.high;
  const deviationPct = band.expectedTotal
    ? (submittedTotal - band.expectedTotal) / band.expectedTotal
    : 0;
  return { flagged, deviationPct, submittedTotal };
}

export function allocate(aggregated, receiptTotal) {
  const { totalQty, households } = aggregated;
  return households.map((h) => ({
    id: h.id,
    wholesaleCost: totalQty > 0 ? (h.qty / totalQty) * receiptTotal : 0,
  }));
}

export function bill(allocations, runnerFlatFee, platformFeePct = 0.1) {
  const feeShare = allocations.length ? runnerFlatFee / allocations.length : 0;
  return allocations.map((a) => {
    const platformFee = a.wholesaleCost * platformFeePct;
    return {
      id: a.id,
      wholesaleCost: a.wholesaleCost,
      platformFee,
      runnerFeeShare: feeShare,
      total: a.wholesaleCost + platformFee + feeShare,
    };
  });
}

export function runWeeklyCycle({ households, unitPrice, receiptTotal, runnerFlatFee }) {
  const aggregated = aggregate(households);
  const band = expectedCostBand(aggregated.totalQty, unitPrice);
  const check = verifyReceipt(band, receiptTotal);
  const allocations = allocate(aggregated, receiptTotal);
  const bills = bill(allocations, runnerFlatFee);
  return { aggregated, band, check, bills };
}
