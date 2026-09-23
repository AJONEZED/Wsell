"""Step 1: onboarding loop for households and runners.

Households just need a zone assignment. Runners must pass ID + vehicle
verification before they are eligible to be assigned to a zone/market.
"""

from __future__ import annotations

from .models import Household, Runner


class OnboardingError(ValueError):
    pass


def onboard_household(household: Household, known_zones: set[str]) -> Household:
    if household.zone_id not in known_zones:
        raise OnboardingError(f"unknown delivery zone: {household.zone_id}")
    return household


def onboard_runner(runner: Runner, known_zones: set[str]) -> Runner:
    if runner.zone_id not in known_zones:
        raise OnboardingError(f"unknown zone: {runner.zone_id}")
    if not runner.is_eligible:
        raise OnboardingError(
            f"runner {runner.id} failed verification "
            f"(id_verified={runner.id_verified}, vehicle_verified={runner.vehicle_verified})"
        )
    return runner
