"""Step 6: billing.

Each household is charged three itemized components: the verified
wholesale cost passthrough (from allocation), a platform fee, and its
share of the runner's flat delivery fee. Nothing is marked up by the
runner — the runner is paid a flat fee regardless of what the basket
cost, which is what keeps pricing trustable.
"""

from __future__ import annotations

from dataclasses import dataclass

from .allocation import AllocationResult


@dataclass(frozen=True)
class HouseholdBill:
    household_id: str
    wholesale_cost: float
    platform_fee: float
    runner_fee_share: float

    @property
    def total(self) -> float:
        return self.wholesale_cost + self.platform_fee + self.runner_fee_share


def bill_households(
    allocation: AllocationResult,
    runner_flat_fee: float,
    platform_fee_pct: float = 0.10,
) -> list[HouseholdBill]:
    household_ids = list(allocation.allocations.keys())
    if not household_ids:
        return []

    fee_share = runner_flat_fee / len(household_ids)

    bills = []
    for household_id in household_ids:
        wholesale_cost = allocation.allocations[household_id].wholesale_total
        bills.append(
            HouseholdBill(
                household_id=household_id,
                wholesale_cost=wholesale_cost,
                platform_fee=wholesale_cost * platform_fee_pct,
                runner_fee_share=fee_share,
            )
        )
    return bills
