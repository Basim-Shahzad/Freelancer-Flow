"""Pure project-progress math (derived, never stored)."""
from __future__ import annotations

from decimal import Decimal
from typing import Optional


def compute_progress_percent(
    *,
    billing_type: str,
    milestones_enabled: bool,
    milestone_total: int,
    milestone_done: int,
    budget: Optional[Decimal],
    hourly_rate: Optional[Decimal],
    total_minutes: int,
) -> Optional[int]:
    """0-100, or ``None`` when progress cannot be measured.

    Milestones (approved or submitted vs. total) win when enabled and present;
    otherwise hourly projects with a budget measure hours against
    ``budget / hourly_rate``.
    """
    if milestones_enabled and milestone_total > 0:
        return min(100, round(milestone_done * 100 / milestone_total))
    if billing_type == "HOURLY" and budget and hourly_rate and hourly_rate > 0 and budget > 0:
        budget_hours = Decimal(budget) / Decimal(hourly_rate)
        hours = Decimal(total_minutes) / Decimal(60)
        return min(100, int((hours / budget_hours * 100).to_integral_value()))
    return None
