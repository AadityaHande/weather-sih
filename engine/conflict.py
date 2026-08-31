"""
engine/conflict.py

Tie-break resolver for cards that land in the same priority bucket.

Resolution order (03_personalization_logic_and_decision_matrix.md §8):
  1. P0 always wins outright (separated from ranked list entirely in engine.py).
  2. Higher urgency_multiplier wins.
  3. If still tied, card tied to a DECLARED (not default) persona wins.
  4. If still tied, stable order by CARD_DEFINITION_ORDER.

The result is deterministic for any given input (required by 10_...md §1
"same input → same output, run twice").
"""
from __future__ import annotations

from .cards import CARD_DEFINITION_ORDER
from .models import RankedCard


_PRIORITY_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


def resolve_ties(
    cards: list[RankedCard],
    declared_persona_card_ids: set[str],
) -> list[RankedCard]:
    """
    Sort RankedCards by effective priority, breaking ties deterministically.

    Parameters
    ----------
    cards                    : list to sort (not mutated; returns new list).
    declared_persona_card_ids: card IDs that are tied to at least one of the
                               user's explicitly declared persona(s) — used for
                               tie-break rule 3.  Empty for cold-start users.

    Returns a new sorted list, highest priority first.
    """
    def sort_key(c: RankedCard) -> tuple:
        # Rule 1: priority level (P0 < P1 < P2 < P3 numerically).
        priority_rank = _PRIORITY_ORDER.get(c.priority, 99)

        # Rule 2: higher urgency_multiplier wins (negate for ascending sort).
        urgency = -c.score_components.get("urgency_multiplier", 1.0)

        # Rule 3: declared-persona card beats a default one (0 < 1).
        not_declared = 0 if c.card_id in declared_persona_card_ids else 1

        # Rule 4: stable ordering from CARD_DEFINITION_ORDER.
        try:
            definition_pos = CARD_DEFINITION_ORDER.index(c.card_id)
        except ValueError:
            definition_pos = len(CARD_DEFINITION_ORDER)

        return (priority_rank, urgency, not_declared, definition_pos)

    return sorted(cards, key=sort_key)
