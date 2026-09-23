from __future__ import annotations

import pytest

from wsell.allocation import allocate_receipt
from wsell.aggregation import aggregate_orders
from wsell.billing import bill_households
from wsell.feedback import (
    CycleOutcome,
    HouseholdFeedbackLedger,
    eligible_for_expansion,
    update_runner_reliability,
)
from wsell.models import (
    Household,
    HouseholdOrder,
    Market,
    OrderItem,
    Receipt,
    ReceiptLine,
    Runner,
    SubscriptionTier,
    Zone,
)
from wsell.onboarding import OnboardingError, onboard_household, onboard_runner
from wsell.pipeline import run_weekly_cycle
from wsell.price_feed import StubPriceFeed


ZONE = Zone(id="z1", name="Downtown")
MARKET = Market(id="m1", name="City Wholesale Market", zone_id="z1")


def make_households() -> dict[str, Household]:
    return {
        "h1": Household(
            id="h1", name="Ada", zone_id="z1", tier=SubscriptionTier.STANDARD,
            delivery_day="Wed", route_position=2,
        ),
        "h2": Household(
            id="h2", name="Grace", zone_id="z1", tier=SubscriptionTier.FAMILY,
            delivery_day="Wed", route_position=1,
        ),
    }


def make_runner(reliability: float = 1.0) -> Runner:
    return Runner(
        id="r1", name="Sam", zone_id="z1", market_id="m1",
        id_verified=True, vehicle_verified=True, reliability_score=reliability,
    )


def make_orders() -> list[HouseholdOrder]:
    return [
        HouseholdOrder(
            household_id="h1", zone_id="z1", week_id="2026-W38",
            items=(OrderItem(sku="tomato", unit="kg", quantity=4),),
        ),
        HouseholdOrder(
            household_id="h2", zone_id="z1", week_id="2026-W38",
            items=(OrderItem(sku="tomato", unit="kg", quantity=6),),
        ),
    ]


def make_price_feed() -> StubPriceFeed:
    return StubPriceFeed({("m1", "tomato", "kg"): 2.0})


class TestOnboarding:
    def test_household_onboards_into_known_zone(self):
        household = make_households()["h1"]
        assert onboard_household(household, {"z1"}) is household

    def test_household_rejects_unknown_zone(self):
        household = Household(
            id="h3", name="X", zone_id="unknown", tier=SubscriptionTier.LIGHT,
            delivery_day="Wed", route_position=1,
        )
        with pytest.raises(OnboardingError):
            onboard_household(household, {"z1"})

    def test_runner_requires_verification(self):
        unverified = Runner(
            id="r2", name="Bad", zone_id="z1", market_id="m1",
            id_verified=True, vehicle_verified=False,
        )
        with pytest.raises(OnboardingError):
            onboard_runner(unverified, {"z1"})

    def test_verified_runner_onboards(self):
        runner = make_runner()
        assert onboard_runner(runner, {"z1"}) is runner


class TestAggregation:
    def test_orders_group_into_one_list_per_runner(self):
        runner = make_runner()
        aggregated = aggregate_orders(make_orders(), [runner], [MARKET])
        assert len(aggregated) == 1
        agg = aggregated[0]
        assert agg.runner_id == "r1"
        assert agg.totals[("tomato", "kg")] == 10
        assert agg.household_shares[("tomato", "kg")] == {"h1": 4, "h2": 6}


class TestPriceVerificationAndAllocation:
    def test_receipt_within_band_is_not_flagged_and_allocates_proportionally(self):
        runner = make_runner()
        aggregated = aggregate_orders(make_orders(), [runner], [MARKET])[0]
        price_feed = make_price_feed()

        receipt = Receipt(
            runner_id="r1", market_id="m1",
            lines=[ReceiptLine(sku="tomato", unit="kg", quantity=10, unit_price=2.05)],
        )

        results = run_weekly_cycle(
            orders=make_orders(),
            households=make_households(),
            runners=[runner],
            markets=[MARKET],
            price_feed=price_feed,
            receipts_by_runner={"r1": receipt},
            runner_flat_fee=15.0,
        )
        assert len(results) == 1
        result = results[0]

        assert result.receipt_check.flagged is False
        assert result.cost_band.expected_total == pytest.approx(20.0)

        h1_cost = result.allocation.allocations["h1"].wholesale_total
        h2_cost = result.allocation.allocations["h2"].wholesale_total
        assert h1_cost == pytest.approx(20.5 * 0.4)
        assert h2_cost == pytest.approx(20.5 * 0.6)

    def test_inflated_receipt_is_flagged(self):
        runner = make_runner()
        aggregated = aggregate_orders(make_orders(), [runner], [MARKET])[0]
        price_feed = make_price_feed()

        # Expected ~$20; submit $40 -> well outside default 8% tolerance.
        receipt = Receipt(
            runner_id="r1", market_id="m1",
            lines=[ReceiptLine(sku="tomato", unit="kg", quantity=10, unit_price=4.0)],
        )

        results = run_weekly_cycle(
            orders=make_orders(),
            households=make_households(),
            runners=[runner],
            markets=[MARKET],
            price_feed=price_feed,
            receipts_by_runner={"r1": receipt},
            runner_flat_fee=15.0,
        )
        assert results[0].receipt_check.flagged is True
        assert results[0].receipt_check.deviation_pct == pytest.approx(1.0)

    def test_unfulfilled_sku_reported_not_charged(self):
        runner = make_runner()
        orders = make_orders() + [
            HouseholdOrder(
                household_id="h1", zone_id="z1", week_id="2026-W38",
                items=(OrderItem(sku="basil", unit="bunch", quantity=1),),
            )
        ]
        aggregated = aggregate_orders(orders, [runner], [MARKET])[0]
        receipt = Receipt(
            runner_id="r1", market_id="m1",
            lines=[ReceiptLine(sku="tomato", unit="kg", quantity=10, unit_price=2.0)],
        )
        allocation = allocate_receipt(aggregated, receipt)
        assert allocation.unfulfilled_skus == ["basil"]
        assert "basil" not in allocation.allocations["h1"].item_costs


class TestBilling:
    def test_itemized_bill_splits_runner_fee_evenly(self):
        runner = make_runner()
        aggregated = aggregate_orders(make_orders(), [runner], [MARKET])[0]
        receipt = Receipt(
            runner_id="r1", market_id="m1",
            lines=[ReceiptLine(sku="tomato", unit="kg", quantity=10, unit_price=2.0)],
        )
        allocation = allocate_receipt(aggregated, receipt)
        bills = bill_households(allocation, runner_flat_fee=10.0, platform_fee_pct=0.10)

        by_household = {b.household_id: b for b in bills}
        assert by_household["h1"].runner_fee_share == pytest.approx(5.0)
        assert by_household["h2"].runner_fee_share == pytest.approx(5.0)
        assert by_household["h1"].platform_fee == pytest.approx(8.0 * 0.10)
        assert by_household["h1"].total == pytest.approx(8.0 + 0.8 + 5.0)


class TestFeedback:
    def test_flagged_receipt_drags_reliability_down(self):
        runner = make_runner(reliability=0.9)
        bad_outcome = CycleOutcome(
            on_time=True, receipt_flagged=True, items_ordered=10, items_fulfilled=10
        )
        updated = update_runner_reliability(runner, bad_outcome)
        assert updated.reliability_score < runner.reliability_score

    def test_low_reliability_blocks_expansion(self):
        runner = make_runner(reliability=0.5)
        assert eligible_for_expansion(runner) is False

    def test_household_complaint_rate_tracked(self):
        ledger = HouseholdFeedbackLedger()
        ledger.record_cycle("h1", complaint=False)
        ledger.record_cycle("h1", complaint=True)
        assert ledger.complaint_rate("h1") == pytest.approx(0.5)
