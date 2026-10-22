from datetime import datetime, timedelta, timezone

from app.services.time_tracking import overlaps, validate_window

NOW = datetime(2026, 1, 10, 12, 0, tzinfo=timezone.utc)


def _h(hours):
    return NOW + timedelta(hours=hours)


def test_valid_window():
    assert validate_window(_h(-3), _h(-2), NOW) is None
    assert validate_window(_h(-1), None, NOW) is None


def test_end_must_follow_start():
    assert validate_window(_h(-2), _h(-2), NOW) is not None
    assert validate_window(_h(-2), _h(-3), NOW) is not None


def test_future_rejected_with_tolerance():
    assert validate_window(_h(-1), NOW + timedelta(minutes=4), NOW) is None
    assert validate_window(_h(-1), NOW + timedelta(minutes=6), NOW) is not None
    assert validate_window(NOW + timedelta(minutes=6), None, NOW) is not None


def test_duration_cap():
    assert validate_window(_h(-24), NOW, NOW) is None
    assert validate_window(_h(-25), NOW, NOW) is not None


def test_overlap_boundaries():
    assert overlaps(_h(-3), _h(-1), _h(-2), _h(0), NOW)
    assert not overlaps(_h(-3), _h(-2), _h(-2), _h(-1), NOW)  # touching
    assert overlaps(_h(-3), _h(-1), _h(-4), _h(-2), NOW)
    assert overlaps(_h(-3), None, _h(-1), _h(-0.5), NOW)  # running extends to now
    assert not overlaps(_h(-3), _h(-2), _h(-1), None, NOW)
