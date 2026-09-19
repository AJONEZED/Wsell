"""Step 3: price verification / fraud check.

Before a runner buys, the app prices the aggregated list against the live
wholesale feed and sets an expected cost band. After the runner submits a
receipt, a total that falls outside that band gets flagged for review
instead of being auto-accepted.
"""

from __future__ import annotations

from dataclasses import dataclass

from .aggregation import AggregatedList
from .models import Receipt
from .price_feed import PriceFeed


@dataclass(frozen=True)
class ExpectedCostBand:
    expected_total: float
    tolerance_pct: float

    @property
    def low(self) -> float:
        return self.expected_total * (1 - self.tolerance_pct)

    @property
    def high(self) -> float:
        return self.expected_total * (1 + self.tolerance_pct)

    def contains(self, amount: float) -> bool:
        return self.low <= amount <= self.high


@dataclass(frozen=True)
class ReceiptCheck:
    band: ExpectedCostBand
    submitted_total: float
    flagged: bool
    deviation_pct: float  # signed: positive means receipt is higher than expected


def expected_cost_band(
    aggregated: AggregatedList, price_feed: PriceFeed, tolerance_pct: float = 0.08
) -> ExpectedCostBand:
    """Price the aggregated list against the live feed.

    tolerance_pct defaults to 8%, covering normal day-to-day wholesale
    price movement and small substitutions without masking real overcharges.
    """
    expected_total = 0.0
    for (sku, unit), qty in aggregated.totals.items():
        expected_total += qty * price_feed.unit_price(aggregated.market_id, sku, unit)
    return ExpectedCostBand(expected_total=expected_total, tolerance_pct=tolerance_pct)


def verify_receipt(band: ExpectedCostBand, receipt: Receipt) -> ReceiptCheck:
    submitted_total = receipt.total
    deviation_pct = (
        (submitted_total - band.expected_total) / band.expected_total
        if band.expected_total
        else 0.0
    )
    return ReceiptCheck(
        band=band,
        submitted_total=submitted_total,
        flagged=not band.contains(submitted_total),
        deviation_pct=deviation_pct,
    )
