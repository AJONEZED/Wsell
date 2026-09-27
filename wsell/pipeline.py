"""Orchestrates one weekly cycle end to end: steps 2 through 6.

Onboarding (step 1) happens once per household/runner, not per cycle, so
it isn't part of this pipeline — see onboarding.py. Step 7 (feedback)
happens after delivery outcomes are known, which is outside a single
synchronous run, so it's exposed as a separate call the caller makes once
outcomes come in — see feedback.py.
"""

from __future__ import annotations

from dataclasses import dataclass

from .aggregation import AggregatedList, aggregate_orders
from .allocation import AllocationResult, allocate_receipt
from .billing import HouseholdBill, bill_households
from .delivery import DeliveryStop, build_route
from .models import Household, HouseholdOrder, Market, Receipt, Runner
from .price_feed import PriceFeed
from .price_verification import ExpectedCostBand, ReceiptCheck, expected_cost_band, verify_receipt


@dataclass
class RunnerCycleResult:
    aggregated: AggregatedList
    cost_band: ExpectedCostBand
    receipt_check: ReceiptCheck
    allocation: AllocationResult
    route: list[DeliveryStop]
    bills: list[HouseholdBill]


def run_weekly_cycle(
    orders: list[HouseholdOrder],
    households: dict[str, Household],
    runners: list[Runner],
    markets: list[Market],
    price_feed: PriceFeed,
    receipts_by_runner: dict[str, Receipt],
    runner_flat_fee: float,
    platform_fee_pct: float = 0.10,
    price_tolerance_pct: float = 0.08,
) -> list[RunnerCycleResult]:
    """Run steps 2-6 for a week's worth of orders.

    Returns one RunnerCycleResult per aggregated list (i.e. per runner who
    had orders to fulfill this cycle).
    """
    aggregated_lists = aggregate_orders(orders, runners, markets)

    results = []
    for aggregated in aggregated_lists:
        receipt = receipts_by_runner.get(aggregated.runner_id)
        if receipt is None:
            raise ValueError(f"no receipt submitted by runner {aggregated.runner_id}")

        band = expected_cost_band(aggregated, price_feed, tolerance_pct=price_tolerance_pct)
        check = verify_receipt(band, receipt)
        allocation = allocate_receipt(aggregated, receipt)
        route = build_route(aggregated, households)
        bills = bill_households(allocation, runner_flat_fee, platform_fee_pct)

        results.append(
            RunnerCycleResult(
                aggregated=aggregated,
                cost_band=band,
                receipt_check=check,
                allocation=allocation,
                route=route,
                bills=bills,
            )
        )

    return results
