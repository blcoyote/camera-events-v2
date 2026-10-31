# Camera Events

A companion app for browsing Frigate NVR events and getting push notifications about camera activity on subscribed devices.

## Language

**Frigate**:
The network video recorder that owns cameras, recordings and detection. This app mostly reads from it; the one exception is Retention, where favoriting an Event tells Frigate to keep it.

**Camera**:
A video source configured in Frigate, identified by name.

**Detection**:
The instant message Frigate publishes when it first notices an object on a camera. It triggers a push before anything is saved, and it may never become an Event. Not yet saved within the 2-minute grace window it is a Pending detection; after that, a Ghost detection.
_Avoid_: Event (for the message), motion

**Event**:
The saved record of a detection, with a clip and/or snapshot, that users browse in the app. "Saved" means Frigate persisted it, nothing else.
_Avoid_: Detection (for the saved record), saved (for favorited; see Favorite)

**Review**:
Frigate's grouping of related events into one item for human review.

**Retention**:
Frigate keeping an Event beyond its normal expiry. Starts when an Event gets its first favorite and ends when its last favorite is removed.
_Avoid_: Pinning, saving

**Pending detection**:
A Detection whose Event is not saved yet and is younger than the 2-minute grace window. The detail page shows its `pending` state.

**Ghost detection**:
A Detection still not saved after the grace window, so a notification about it has nothing to open.
_Avoid_: Ghost event

**Favorite**:
A user's marker on an Event. A Favorite starts Retention, but they are separate terms: one is the user's marker, the other is what Frigate does about it.
_Avoid_: Saved, starred, pinned

### Notifications

**Burst**:
A run of detections on one camera that ends after a quiet gap with no further detections.
_Avoid_: Batch, bundle, session, activity

**Alert**:
Any notification that sounds or vibrates the device, including iOS Patches and Availability notifications. The opening Alert is the Alert that opens a Burst.
_Avoid_: Push (for this specific concept)

**Patch**:
An update to the notification already on screen, carrying a count of detections since the last visible notification. Apple pacing (`APPLE_UPDATE_INTERVAL_MS`) and user dismissal can make it undercount. Quiet on Android and desktop; iOS ignores the silent flag, so patches there still alert and are paced instead.
_Avoid_: Re-alert, follow-up notification

**Patch window**:
The per-camera window, `EVENT_BATCH_WINDOW_MS` (default 30s), in which follow-up Detections are batched into one Patch.

**Preference**:
A user's own choice about which notifications they receive, such as opting a single camera out of motion alerts or turning Availability notifications on or off.
_Avoid_: Opt-out, setting, subscription

**Mute**:
An admin-set, time-limited pause of all users' notifications. Overrides every Preference while active. Test push is the deliberate exception: it is never muted.
_Avoid_: Preference (a Mute is not per-user)

**Device**:
One push subscription (one endpoint). A user has many.
_Avoid_: Subscription

**Delivery**:
Deciding who receives a notification (Mute, then each user's Preference) and sending it to their devices. If a Mute swallowed a burst's Alert, the first Delivery after the Mute lapses is promoted to an Alert, so a burst is never patched without having alerted.
_Avoid_: Dispatch (that is the batcher-to-notifier callback in the MQTT code)

### Camera health

**Availability**:
Whether a Camera is Offline or Online.

**Availability notification**:
The push sent when a Camera's Availability changes. Gated by a global opt-in Preference, default off.
_Avoid_: Offline alert

**Offline**:
A camera that Frigate is no longer receiving frames from, or all cameras when Frigate itself is down.

**Online**:
A camera that is receiving frames again after being offline.

### Access

**Admin**:
A user with `users.is_admin`. Admins set the Mute. The flag is seeded one-way from `ADMIN_EMAILS` at sign-in and read fail-closed: anything unexpected means not admin.

## Danish terms

User-facing Danish equivalents of the terms above, approved 2026-10-31. UI copy in `messages/da.json` uses these exactly.

| English                              | Danish                              | Notes                                           |
| ------------------------------------ | ----------------------------------- | ----------------------------------------------- |
| Event                                | Hændelse                            | Plural: hændelser                               |
| Detection                            | Registrering                        | Mostly internal                                 |
| Alert / notification                 | Notifikation                        | "Notifikationer" in Settings                    |
| Mute (admin)                         | Pause                               | Verb "Sæt på pause"; state "På pause til 21.40" |
| Favorite                             | Favorit                             | Plural: favoritter                              |
| Retention                            | Gemmes                              | "Gemmes i Frigate"                              |
| Camera / Cameras                     | Kamera / Kameraer                   |                                                 |
| Live view                            | Live-visning                        |                                                 |
| Snapshot                             | Stillbillede                        |                                                 |
| Clip                                 | Klip                                |                                                 |
| Download                             | Hent                                | "Hent klip"                                     |
| Online / Offline                     | Online / Offline                    |                                                 |
| Availability notifications           | Kamerastatus-notifikationer         |                                                 |
| Preference (per camera)              | Kameravalg                          |                                                 |
| Device                               | Enhed                               |                                                 |
| Pending                              | Behandles                           | "Frigate har ikke gemt den endnu"               |
| Ghost                                | Ikke gemt                           |                                                 |
| Settings                             | Indstillinger                       |                                                 |
| Appearance                           | Udseende                            |                                                 |
| Language / Automatic                 | Sprog / Automatisk                  | Options shown as "English", "Dansk"             |
| Arrange                              | Arranger                            |                                                 |
| Sign in / Sign out                   | Log ind / Log ud                    |                                                 |
| Person, Car, Dog, Cat, Bird, Bicycle | Person, Bil, Hund, Kat, Fugl, Cykel | Frigate labels                                  |
| Motorcycle, Bus, Truck, Boat, Horse  | Motorcykel, Bus, Lastbil, Båd, Hest |                                                 |
| Package, Face, License plate         | Pakke, Ansigt, Nummerplade          |                                                 |
