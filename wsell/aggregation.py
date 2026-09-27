"""Step 2: demand aggregation.

Household orders for the week are grouped by zone, then by the wholesale
market that zone is served from, and assigned to the best-eligible runner
for that zone/market pair. The output is one aggregated shopping list per
runner per market — never one list per household.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from .models import HouseholdOrder, Market, OrderItem, Runner


class AggregationError(ValueError):
    pass


@dataclass
class AggregatedList:
    runner_id: str
    market_id: str
    zone_id: str
    week_id: str
    # (sku, unit) -> total quantity across all households
    totals: dict[tuple[str, str], float] = field(default_factory=dict)
    # (sku, unit) -> {household_id: quantity}, needed later for allocation
    household_shares: dict[tuple[str, str], dict[str, float]] = field(default_factory=dict)
    household_ids: set[str] = field(default_factory=set)

    def add(self, household_id: str, item: OrderItem) -> None:
        key = (item.sku, item.unit)
        self.totals[key] = self.totals.get(key, 0.0) + item.quantity
        self.household_shares.setdefault(key, {})
        self.household_shares[key][household_id] = (
            self.household_shares[key].get(household_id, 0.0) + item.quantity
        )
        self.household_ids.add(household_id)


def _pick_runner(candidates: list[Runner]) -> Runner:
    eligible = [r for r in candidates if r.is_eligible]
    if not eligible:
        raise AggregationError("no eligible runner available for this zone/market")
    return max(eligible, key=lambda r: r.reliability_score)


def aggregate_orders(
    orders: list[HouseholdOrder],
    runners: list[Runner],
    markets: list[Market],
) -> list[AggregatedList]:
    """Group household orders into one aggregated list per runner per market."""

    zone_to_market = {m.zone_id: m for m in markets}
    runners_by_zone_market: dict[tuple[str, str], list[Runner]] = defaultdict(list)
    for r in runners:
        runners_by_zone_market[(r.zone_id, r.market_id)].append(r)

    lists_by_runner: dict[str, AggregatedList] = {}

    for order in orders:
        market = zone_to_market.get(order.zone_id)
        if market is None:
            raise AggregationError(f"zone {order.zone_id} has no assigned market")

        candidates = runners_by_zone_market.get((order.zone_id, market.id), [])
        runner = _pick_runner(candidates)

        agg = lists_by_runner.get(runner.id)
        if agg is None:
            agg = AggregatedList(
                runner_id=runner.id,
                market_id=market.id,
                zone_id=order.zone_id,
                week_id=order.week_id,
            )
            lists_by_runner[runner.id] = agg

        for item in order.items:
            agg.add(order.household_id, item)

    return list(lists_by_runner.values())
