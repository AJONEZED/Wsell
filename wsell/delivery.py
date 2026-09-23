"""Step 5: delivery routing.

A runner only delivers to their own zone's subscribers, so the route is
just that runner's aggregated-list households sequenced for shortest path.
Real routing would call a mapping API; here we sequence by each
household's precomputed `route_position` (e.g. drive-time-from-market
rank), which is the only geospatial input the rest of the pipeline needs
to expose.
"""

from __future__ import annotations

from dataclasses import dataclass

from .aggregation import AggregatedList
from .models import Household


@dataclass(frozen=True)
class DeliveryStop:
    sequence: int
    household_id: str


def build_route(aggregated: AggregatedList, households: dict[str, Household]) -> list[DeliveryStop]:
    ordered = sorted(
        aggregated.household_ids,
        key=lambda hid: households[hid].route_position,
    )
    return [DeliveryStop(sequence=i, household_id=hid) for i, hid in enumerate(ordered, start=1)]
