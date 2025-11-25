# utils/dm_stats.py
from collections import defaultdict
from statistics import mean
from typing import List

def calculate_stats(entries: List):
    """
    Given a list of ORM entry objects, return a dict mapping tuple keys
    (unit, section, parameter) -> { avg, min, max, count }.

    NOTE: keys are tuples of strings. Router will convert keys to JSON-safe strings.
    """
    grouped = defaultdict(list)

    for e in entries:
        # ensure the grouping keys are strings
        unit = str(getattr(e, "unit", "")).strip()
        section = str(getattr(e, "section", "")).strip()
        parameter = str(getattr(e, "parameter", "")).strip()
        try:
            val = float(getattr(e, "value", None))
        except Exception:
            # skip non-numeric values
            continue

        grouped[(unit, section, parameter)].append(val)

    stats = {}
    for k, values in grouped.items():
        if not values:
            continue
        stats[k] = {
            "avg": round(mean(values), 3),
            "min": round(min(values), 3),
            "max": round(max(values), 3),
            "count": len(values)
        }

    return stats
