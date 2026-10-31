# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

An installable PWA that runs on iOS (Safari standalone), Android (Chrome) and desktop. All three platforms are first-class; no feature ships on just one.

## Users

A single household that self-hosts a Frigate NVR. Family members check their own home cameras, mostly on their phones and mostly because a notification just arrived. Access is invite-only through a Google email allowlist. One or more members are admins, who can mute everyone's notifications for a limited time.

The users are Danish. Some of them are not technical and should never have to touch Frigate itself.

## Product Purpose

Camera Events turns Frigate's detections into a calm, trustworthy signal on the family's phones. When something happens, a user can get from the notification to the clip in a tap, see what it was, and get back to their day. It works when the family trusts the alerts: alerts reach them when something happens and don't become noise they learn to ignore.

## Positioning

- **Smart notifications.** Detections are grouped into Bursts per camera. Follow-ups are sent as quiet Patches to the notification already on screen, not as new alerts. Users choose per-camera Preferences and opt in to Availability notifications, and an admin can apply a Mute. Frigate's own UI has none of these notification layers.
- **Safe remote access.** Google SSO with an allowlist means family members never get Frigate credentials or a path into the NVR.
- **Phone-first triage.** It is built for the moment after an alert on a phone. Frigate's UI is built for an operator at a desktop.

## Operating Context

- The main path: a push notification arrives, the user taps it, the event detail opens with its clip or snapshot, and the user decides whether it matters.
- Users often open the app in the dark after a night-time alert, so low light is a normal setting, not an edge case.
- Secondary uses: browsing the event feed with label and camera filters, checking which cameras are online, opening a live view, and managing favorites and notification settings.
- A notification can point to a detection that Frigate has not saved yet (Pending) or never will (Ghost). The app has to explain those states instead of failing.
- Frigate events arrive over MQTT through RabbitMQ. The app is self-hosted with Docker behind Traefik.

## Capabilities and Constraints

- Features: an event feed with filters and pagination, event detail with inline clip playback, snapshot and download, a cameras page with an arrangeable order and availability, live view, favorites (which start Retention in Frigate), and settings for the device's push subscription, per-camera Preferences, Availability notifications, appearance, event count and the admin Mute.
- Use the domain terms from `CONTEXT.md` exactly: Detection vs Event, Burst, Alert, Patch, Preference, Mute, Device, Favorite, Retention.
- The UI is English only, with no localisation planned. Open decision: should dates and times follow Danish conventions (24-hour clock, day-month order)?
- Platform constraints such as iOS standalone cookies, iOS ignoring the silent flag on push, and service worker limits are flagged and confirmed before they are worked around, never fixed silently.

## Evidence on Hand

- App icons and the manifest are in `public/` (`icon-*.png`, `favicon.svg`, `surveillance-camera-1.svg`).
- A mock Frigate backend (`FRIGATE_MOCK=true`) supplies realistic event data for development and screenshots.
- There are no testimonials, metrics or public marketing claims. This is a private household tool, and future work must not invent any.

## Product Principles

1. **Trust the alert.** Every notification should be worth the interruption. Batching, patching and muting exist to protect that trust.
2. **Notification to answer in one tap.** The path from an alert to "what was it?" beats every other flow on the device in your hand.
3. **Family-safe by default.** Access stays invite-only and fails closed, and non-technical members never need to understand Frigate.
4. **Every platform or not at all.** iOS, Android and desktop behave the same.
5. **Honest states.** Pending, Ghost, offline and muted are shown plainly, never hidden behind a generic error.

## Accessibility & Inclusion

- WCAG 2.2 AA is the required standard.
- Night use is a primary scenario. Screens must be comfortable and legible in the dark right after a night-time alert, and dark appearance must work fully.
