"""Domain services, one module per resource.

Despite the name, these are more than CRUD: each public function enforces the
business rules for its operation (state machines, ownership, row locks, money
math via ``app.services.invoicing``), stages audit rows with ``log_activity``
and owns the transaction, committing once at the end. Private helpers only
stage or flush (the one exception is ``portal_tokens._touch_last_used``,
which records link usage from an otherwise read-only request).

Conventions:
- Never import from ``app.api``; routes and dependencies call into here, not
  the other way round.
- Raise ``app.core.errors`` domain errors (``NotFound``, ``Conflict``, ...),
  never ``HTTPException``. ``app.main`` maps them to HTTP responses.
- Routes stay thin: parse input, call one function here, shape the response.
"""
