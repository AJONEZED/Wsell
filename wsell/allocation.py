"""Step 4 (second half): split the aggregated purchase back per household.

The runner buys one aggregated list, not N household baskets. Once the
receipt is in, each household's wholesale cost is its ordered quantity's
share of the total ordered quantity for that item, applied to what the
receipt actually shows was paid for that item. Items the runner couldn't
source (present in the order, absent from the receipt) are reported
separately rather than silently dropped or charged for.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .aggregation import AggregatedList
from .models import Receipt


@dataclass
class HouseholdAllocation:
    household_id: str
    # sku -> wholesale cost charged to this household
    item_costs: dict[str, float] = field(default_factory=dict)

    @property
    def wholesale_total(self) -> float:
        return sum(self.item_costs.values())


@dataclass
class AllocationResult:
    allocations: dict[str, HouseholdAllocation]
    unfulfilled_skus: list[str]


def allocate_receipt(aggregated: AggregatedList, receipt: Receipt) -> AllocationResult:
    receipt_totals = {(line.sku, line.unit): line.total for line in receipt.lines}

    allocations: dict[str, HouseholdAllocation] = {
        hid: HouseholdAllocation(household_id=hid) for hid in aggregated.household_ids
    }
    unfulfilled_skus: list[str] = []

    for key, ordered_qty in aggregated.totals.items():
        sku, _unit = key
        line_total = receipt_totals.get(key)
        if line_total is None:
            unfulfilled_skus.append(sku)
            continue
        if ordered_qty <= 0:
            continue

        shares = aggregated.household_shares.get(key, {})
        for household_id, household_qty in shares.items():
            share_ratio = household_qty / ordered_qty
            cost = line_total * share_ratio
            allocation = allocations[household_id]
            allocation.item_costs[sku] = allocation.item_costs.get(sku, 0.0) + cost

    return AllocationResult(allocations=allocations, unfulfilled_skus=unfulfilled_skus)
