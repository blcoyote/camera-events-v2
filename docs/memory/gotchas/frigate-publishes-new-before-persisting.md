---
tags: [gotcha, frigate, mqtt, push-notifications]
created: 2026-08-29
---

# ⚠️ Frigate publishes `"new"` before it persists the event

> The MQTT message that triggers our push arrives **before** the event row
> exists — and for some objects the row is never written at all. Deep-linking
> straight to `/camera-events/{id}` is how "ghost event" notifications happen.

## What bites

`frigate/events` with `"type": "new"` is published from the tracked-object
**update** callback, on the first frame where the object stops being a false
positive (`frigate/track/object_processing.py`):

```python
obj.has_snapshot = self.should_save_snapshot(camera, obj)
obj.has_clip     = self.should_retain_recording(camera, obj)
message = {"before": obj.previous, "after": after,
           "type": "new" if obj.previous["false_positive"] else "update"}
self.dispatcher.publish("events", json.dumps(message), retain=False)
```

The database row is written by a **separate** process, and only when
(`frigate/events/maintainer.py`, `should_update_db`):

```python
if current_event["has_clip"] or current_event["has_snapshot"]:
```

`should_save_snapshot` / `should_retain_recording` both return `False` while:

- `position_changes == 0` — the object has not yet moved out of its stationary
  box (a person standing still, or one just entering frame)
- it has not entered `snapshots.required_zones`
- `max_severity is None` — not yet an alert or a detection
- snapshots / recording are disabled for that camera

`GET /api/events/{id}` reads that table and returns **404** when the row is
absent (`frigate/api/event.py`).

Only **one** `"new"` message is ever published per object — after it, `previous`
carries `false_positive: false`, so every later message is an `"update"`. There
is no second chance to notify.

So there are two distinct failures:

| Class               | Cause                                                              | Recovers?                           |
| ------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| **Race**            | Object will qualify, but hasn't yet when `"new"` fires             | Yes — the row appears seconds later |
| **Permanent ghost** | Object never moves / never enters a required zone / false positive | No — no row is ever written         |

A permanent ghost is also absent from `/api/events`, so it never shows in the
events list either. That is the quick way to tell the two apart in the field.

## What to do instead

Do **not** "verify the event before pushing" by calling `GET /api/events/{id}`
at `"new"` time — at that instant the row is usually absent _by design_, so a
naive existence gate suppresses most notifications, and polling until it appears
destroys the immediate-alert property the batcher's leading-edge flush exists
for (see [[decisions/2026-08-02-alert-once-per-burst-then-patch]]).

Instead, use the free signal Frigate already hands us — `after.has_snapshot` and
`after.has_clip` are Frigate's _own_ persistence predicate and are right there in
the MQTT payload. See
[[decisions/2026-08-29-ghost-event-notifications]] for what we built on it.

## Related

- [[architecture/push-pipeline]]
- [[architecture/frigate-http-api]]
- [[decisions/2026-08-29-ghost-event-notifications]]
- [[Home]]
