# Camera Events

A companion app for browsing Frigate NVR events and getting push notifications about camera activity on subscribed devices.

## Language

**Frigate**:
The network video recorder that owns cameras, recordings and detection. This app mostly reads from it; the one exception is Retention, where favoriting an Event tells Frigate to keep it.

**Camera**:
A video source configured in Frigate, identified by name.

**Detection**:
The instant message Frigate publishes when it first notices an object on a camera. It triggers a push before anything is saved, and it may never become an Event.
_Avoid_: Event (for the message), motion

**Event**:
The saved record of a detection, with a clip and/or snapshot, that users browse in the app.
_Avoid_: Detection (for the saved record)

**Review**:
Frigate's grouping of related events into one item for human review.

**Retention**:
Frigate keeping an Event beyond its normal expiry. Starts when an Event gets its first favorite and ends when its last favorite is removed.
_Avoid_: Pinning, saving

**Ghost event**:
A detection whose Event is never saved, so a notification about it has nothing to open.

### Notifications

**Burst**:
A run of detections on one camera that ends after a quiet gap with no further detections.
_Avoid_: Batch, bundle, session, activity

**Alert**:
The notification that opens a burst. It makes the device sound or vibrate.
_Avoid_: Push (for this specific concept)

**Patch**:
An update to the notification already on screen, carrying the running count for the current burst. Quiet on Android and desktop; iOS ignores the silent flag, so patches there still alert and are paced instead.
_Avoid_: Re-alert, follow-up notification

**Preference**:
A user's own choice about which notifications they receive, such as opting a single camera out of motion alerts or turning camera offline/online alerts on or off.
_Avoid_: Opt-out, setting, subscription

**Mute**:
An admin-set, time-limited pause of all users' notifications. Overrides every Preference while active.
_Avoid_: Preference (a Mute is not per-user)

### Camera health

**Offline**:
A camera that Frigate is no longer receiving frames from, or all cameras when Frigate itself is down.

**Online**:
A camera that is receiving frames again after being offline.
