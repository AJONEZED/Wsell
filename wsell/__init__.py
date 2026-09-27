"""Wsell: a wholesale-marketplace matching and fulfillment algorithm.

See README.md for the step-by-step design this package implements.
"""

from .pipeline import run_weekly_cycle

__all__ = ["run_weekly_cycle"]
