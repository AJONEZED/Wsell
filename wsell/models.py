"""Core domain types shared across the pipeline stages."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class SubscriptionTier(Enum):
    LIGHT = "light"
    STANDARD = "standard"
    FAMILY = "family"


@dataclass(frozen=True)
class Zone:
    id: str
    name: str


@dataclass(frozen=True)
class Market:
    id: str
    name: str
    zone_id: str


@dataclass(frozen=True)
class Household:
    id: str
    name: str
    zone_id: str
    tier: SubscriptionTier
    delivery_day: str
    # Sequence position for delivery routing, e.g. distance-from-market rank.
    # A real system would derive this from geocoding; kept explicit here so
    # routing logic has no hidden network dependency.
    route_position: int


@dataclass(frozen=True)
class Runner:
    id: str
    name: str
    zone_id: str
    market_id: str
    id_verified: bool
    vehicle_verified: bool
    reliability_score: float = 1.0  # 0..1, starts neutral-trusting

    @property
    def is_eligible(self) -> bool:
        return self.id_verified and self.vehicle_verified


@dataclass(frozen=True)
class OrderItem:
    sku: str
    unit: str  # e.g. "kg", "case", "dozen"
    quantity: float


@dataclass(frozen=True)
class HouseholdOrder:
    household_id: str
    zone_id: str
    week_id: str
    items: tuple[OrderItem, ...]


@dataclass
class ReceiptLine:
    sku: str
    unit: str
    quantity: float
    unit_price: float

    @property
    def total(self) -> float:
        return self.quantity * self.unit_price


@dataclass
class Receipt:
    runner_id: str
    market_id: str
    lines: list[ReceiptLine] = field(default_factory=list)

    @property
    def total(self) -> float:
        return sum(line.total for line in self.lines)
