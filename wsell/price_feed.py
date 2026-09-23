"""Live wholesale price feed — the one real external dependency.

This is the piece flagged as unsolved: without a trustworthy per-market,
per-day price source, step 3 (price verification) can't distinguish a fair
receipt from an inflated one, and the whole fraud-check model collapses
into "just trust the runner."

`PriceFeed` is the interface the rest of the pipeline codes against.
`StubPriceFeed` is a fixed-table placeholder for tests and local runs.
Swap in a real implementation (a market's own API, a scraped/manually
entered daily sheet, or a paid data vendor) by implementing the same
interface — nothing else in the pipeline needs to change.
"""

from __future__ import annotations

from typing import Protocol


class PriceUnavailableError(KeyError):
    pass


class PriceFeed(Protocol):
    def unit_price(self, market_id: str, sku: str, unit: str) -> float:
        """Return today's expected per-unit wholesale price at a market."""
        ...


class StubPriceFeed:
    """Fixed-table stand-in for a real live feed.

    prices: (market_id, sku, unit) -> unit_price
    """

    def __init__(self, prices: dict[tuple[str, str, str], float]):
        self._prices = dict(prices)

    def unit_price(self, market_id: str, sku: str, unit: str) -> float:
        key = (market_id, sku, unit)
        try:
            return self._prices[key]
        except KeyError as exc:
            raise PriceUnavailableError(
                f"no price for sku={sku!r} unit={unit!r} at market={market_id!r}"
            ) from exc
