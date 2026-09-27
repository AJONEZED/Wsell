"""Step 7: feedback loop.

Runner reliability is an exponential moving average over three signals
per cycle: on-time delivery, order accuracy (fulfilled vs. ordered items),
and whether their receipt got flagged. It's what gates eligibility for
more zones/subscribers. Household complaints are tallied per household so
churn/complaint rate can feed back into subscription pricing and zone
density decisions.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .models import Runner


@dataclass(frozen=True)
class CycleOutcome:
    on_time: bool
    receipt_flagged: bool
    items_ordered: int
    items_fulfilled: int

    @property
    def accuracy(self) -> float:
        if self.items_ordered == 0:
            return 1.0
        return self.items_fulfilled / self.items_ordered


def update_runner_reliability(
    runner: Runner, outcome: CycleOutcome, smoothing: float = 0.3
) -> Runner:
    """Return a new Runner with reliability_score nudged toward this cycle's signal."""
    signal = outcome.accuracy
    if not outcome.on_time:
        signal *= 0.5
    if outcome.receipt_flagged:
        signal *= 0.5

    new_score = (1 - smoothing) * runner.reliability_score + smoothing * signal
    new_score = max(0.0, min(1.0, new_score))

    return Runner(
        id=runner.id,
        name=runner.name,
        zone_id=runner.zone_id,
        market_id=runner.market_id,
        id_verified=runner.id_verified,
        vehicle_verified=runner.vehicle_verified,
        reliability_score=new_score,
    )


MIN_RELIABILITY_FOR_MORE_ZONES = 0.7


def eligible_for_expansion(runner: Runner) -> bool:
    return runner.is_eligible and runner.reliability_score >= MIN_RELIABILITY_FOR_MORE_ZONES


@dataclass
class HouseholdFeedbackLedger:
    """Running complaint/churn tally, keyed by household id."""

    complaints: dict[str, int] = field(default_factory=dict)
    cycles_served: dict[str, int] = field(default_factory=dict)

    def record_cycle(self, household_id: str, complaint: bool) -> None:
        self.cycles_served[household_id] = self.cycles_served.get(household_id, 0) + 1
        if complaint:
            self.complaints[household_id] = self.complaints.get(household_id, 0) + 1

    def complaint_rate(self, household_id: str) -> float:
        served = self.cycles_served.get(household_id, 0)
        if served == 0:
            return 0.0
        return self.complaints.get(household_id, 0) / served
