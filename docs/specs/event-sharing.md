# Spec: Event Sharing

## Intent Description

A signed-in user can share an Event with one or more other registered users. The share button sits on the event detail page, next to download and favorite. It shows the platform's own share icon: the iOS/macOS "square with arrow" (`lucide` `Share`) on Apple devices and the Android "three nodes" (`Share2`) elsewhere. `Share2` is the neutral icon rendered on the server and before mount, so SSR and hydration match.

Tapping the button opens an in-app Sheet (not `navigator.share`). It lists every registered user except the caller, as checkboxes with avatar and first name, falling back to email. After Send, the button reads "Sent ✓" for about a second and the Sheet closes. On failure an `Alert` stays in the Sheet. If no one else has signed in, the Sheet shows an empty message. Senders have no history of their shares and cannot unshare.

Each recipient gets a push Alert on every Device, in that Device's own locale, for example "Anna shared an event" / "Person · Front door". Tapping it opens the event detail page. Shares ignore the admin Mute and per-camera Preferences because they are deliberate messages from a person. Each share notification has its own tag (`share:<eventId>`), so it never merges into a camera's motion notification.

The share also appears on the recipient's Favorites page. Favorites and shares form one list, newest first by the most recent of favorited-at and shared-at. A shared card shows a shared icon and "from Anna", or "from Anna +N" when several people shared it. The heart still shows and works independently. On the detail page, a recipient who holds a share sees "Shared by Anna · Remove". Remove deletes only the caller's own share rows for that event.

Shares count toward Retention together with Favorites. Frigate is asked to retain the event when its first Favorite or Share is added, and to unretain it when the last one is removed. Retention calls are best-effort, as for Favorites.

Sharing again with the same recipient keeps one row per (event, sender, recipient), updates `created_at`, and sends a new notification. Recipients may share onward. A sender missing from `users` is shown as "someone" / "nogen".

## User-Facing Behavior

```gherkin
Feature: Share an event

  Background:
    Given Anna, Bo and Cy are registered users
    And Anna is signed in and viewing event E on camera "front_door"

  Scenario: Share button uses the platform icon
    Given Anna is on an Apple device
    When the detail page has mounted
    Then the share button shows the iOS share icon

  Scenario: Picker lists everyone except the sender
    When Anna taps the share button
    Then a sheet lists Bo and Cy
    And Anna is not listed

  Scenario: Share with several users
    When Anna selects Bo and Cy and taps Send
    Then the Send button shows "Sent ✓" and the sheet closes
    And Bo and Cy each receive a push Alert "Anna shared an event"
    And tapping it opens /camera-events/E

  Scenario: Share ignores Mute and camera Preferences
    Given notifications are globally muted
    And Bo has turned off notifications for "front_door"
    When Anna shares E with Bo
    Then Bo still receives the share notification

  Scenario: Share notification uses the device locale
    Given Bo's phone is subscribed with locale "da"
    When Anna shares E with Bo
    Then Bo's phone shows "Anna delte en hændelse"

  Scenario: Empty picker
    Given Anna is the only registered user
    When Anna taps the share button
    Then the sheet says no one else has signed in yet

  Scenario: Send failure
    Given the share request fails
    When Anna taps Send
    Then an error alert is shown in the sheet
    And the sheet stays open

Feature: Shared events on Favorites

  Scenario: Shared event appears with sender
    Given Anna shared E with Bo
    When Bo opens /favorites
    Then E is shown with the shared icon and "from Anna"

  Scenario: Several senders
    Given Anna and Cy both shared E with Bo
    When Bo opens /favorites
    Then E is shown once with "from Anna +1" (Anna shared first)

  Scenario: Shared and favorited
    Given Anna shared E with Bo
    And Bo favorited E
    Then E is shown once with both the shared icon and a filled heart

  Scenario: Merged ordering
    Given Bo favorited F yesterday and Anna shared E with Bo today
    Then E is listed before F

  Scenario: Unknown sender
    Given a share of E to Bo from a sender not in the users table
    Then E is shown with "from someone"

Feature: Remove a received share

  Scenario: Recipient removes a share
    Given Anna and Cy shared E with Bo
    When Bo opens E and taps Remove in "Shared by Anna +1 · Remove"
    Then both of Bo's share rows for E are deleted
    And E leaves Bo's Favorites unless Bo favorited it
    And Anna's and Cy's other shares are untouched

Feature: Retention counts Favorites and Shares

  Scenario: First share retains
    Given E has no Favorites and no Shares
    When Anna shares E with Bo
    Then Frigate retain is called for E

  Scenario: Removing the last share keeps a Favorite's retention
    Given E is favorited by Cy and shared with Bo
    When Bo removes the share
    Then Frigate unretain is NOT called

  Scenario: Last reference unretains
    Given E's only reference is Bo's share
    When Bo removes the share
    Then Frigate unretain is called for E
```

## Architecture Specification

No feature imports another feature. The UI calls an HTTP route for sending, following the settings → `/api/push/*` pattern, so `camera-details` never imports `push-notifications`.

**Storage (`src/features/shared/server/favorites/favorites-store.ts`)**, in the same DB file as `event_favorites`:

```sql
CREATE TABLE IF NOT EXISTS event_shares (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     TEXT NOT NULL,
  sender_id    TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, sender_id, recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_event_shares_recipient ON event_shares(recipient_id);
```

New store methods:
- `addShare(eventId, senderId, recipientId)`: upsert that refreshes `created_at`.
- `removeSharesForRecipient(recipientId, eventId)`.
- `getSharesForRecipient(recipientId)`: rows `{ event_id, sender_id, created_at }`.
- `getFavoritesWithTime(userId)`: `{ event_id, created_at }`.
- `getReferenceCount(eventId)`: Favorites plus Shares.

The existing `getFavoriteCount` is replaced by `getReferenceCount` in the retention checks.

**Retention (`favorites-handlers.ts`)**: pull the existing try/catch retain and unretain blocks into `retainIfFirst(store, eventId)` and `unretainIfLast(store, eventId)`, both based on `getReferenceCount` (1 after an add means first, 0 after a remove means last). Toggle, share and remove-share all use them. Exported for the share handler.

**Users (`src/features/shared/server/users/user-store.ts`)**: `listUsers(): Array<{ sub, email, firstName, avatarUrl }>`. New server fn `getShareRecipientsFn` (GET), with its handler in `src/features/shared/server/users/`. It calls `requireSession()` first and returns everyone except the caller.

**Send: `POST /api/events/$id/share`** (`src/routes/api/events/$id/share.ts`) with body `{ recipientIds: string[] }`. The handler is `handleShareEvent` in `src/features/push-notifications/server/share-handlers.ts`, in this order:
1. `requireSession()` (401 on failure).
2. Validate the input (400 on failure): `isValidEventId`; `recipientIds` is a non-empty array of strings, at most 50, de-duplicated, without the caller, and every ID exists in `users`.
3. `getEvent(eventId)` (404 if it doesn't exist). This gives the label and camera for the notification text.
4. For each recipient, `addShare`, then call `retainIfFirst` once.
5. `delivery.deliver({ ignoreMute: true, isUserEligible: id => recipients.has(id), buildPayload: (_, locale) => ({ title, body, url: '/camera-events/<id>', tag: 'share:<id>', locale }) })`. No `burst` and no `allowEndpoint`: shares are always Alerts, and the Apple pacing throttle only applies to patches.
6. Return 204.

The service worker needs no change. It already shows payloads without `event` as plain notifications, using the payload's `tag` and `url`.

**Delivery (`delivery.ts`)**: add `ignoreMute?: boolean` to `DeliveryRequest`. When true, skip the `isMuted` check, so no swallowed-burst bookkeeping happens either.

**Favorites read path**: replace `getUserFavoritedEventsHandler` with `getFavoritesPageHandler` (behind the same `getUserFavoritedEventsFn`, renamed `getFavoritesPageFn`). It:
- calls `requireSession()` first;
- merges favorites and shares by event ID;
- calls `getEvent` for each ID in parallel and drops IDs that aren't `ok`;
- returns `Array<{ event, favorited: boolean, sharedBy: string[] }>`, where `sharedBy` holds sender display names, oldest share first;
- sorts by the latest timestamp, newest first.

`sharedBy` names use first name, then email, then `null`. The client renders `null` as `m.share_someone()`.

**Detail page**: the route loader also calls `getReceivedSharesFn({ eventId })` (validated, `requireSession`), which returns `sharedBy: (string|null)[]`. `removeReceivedShareFn({ eventId })` (POST, `requireSession`, `isValidEventId`) calls `removeSharesForRecipient`, then `unretainIfLast`.

**UI**
- `src/features/shared/components/EventCard.tsx`: new optional prop `sharedBy?: (string|null)[]`. When non-empty, show the shared icon (`Share2`, matching the button) and the text "from {first}" or "from {first} +{n}".
- `src/features/favorites/pages/FavoritesPage.tsx`: takes the new entries and passes `initialFavorited={favorited}` and `sharedBy`.
- `src/features/camera-details/components/ShareButton.tsx`: picks the icon in `useEffect` from `navigator.userAgent` and `navigator.platform` (iPhone, iPad, Mac, or MacIntel with touch support counts as Apple).
- `src/features/camera-details/components/ShareSheet.tsx`: built on `ui/Sheet`. Loads recipients when it opens via `getShareRecipientsFn`, then sends with `fetch('/api/events/<id>/share', { method: 'POST', credentials: 'same-origin' })`.
- `src/features/camera-details/components/SharedByRow.tsx`: "Shared by … · Remove", then `router.invalidate()`.

**i18n (`messages/en.json`, `messages/da.json`)**: share button label, sheet title, Send, Sent, empty state, error, "from {name}", "Shared by {names}", Remove, `share_someone` ("someone" / "nogen"), and the push title and body. The push text is rendered on the server per locale, like the existing push messages.

## Acceptance Criteria

**Store and retention**
- AC1: `addShare` is idempotent per (event, sender, recipient) and refreshes `created_at`.
- AC2: `getReferenceCount` = favorites + shares for the event, isolated per event.
- AC3: `removeSharesForRecipient` deletes only that recipient's rows for that event.
- AC4: The favorite toggle uses `getReferenceCount`. Favoriting an event that is already shared does not call retain, and unfavoriting while a share remains does not call unretain.

**Share endpoint**
- AC5: Returns 401 when there is no session. Returns 400 for an invalid event ID, an empty or non-array `recipientIds`, more than 50 recipients, an unknown recipient, or the caller as the only recipient. Returns 404 when Frigate doesn't have the event.
- AC6: Recipients get one share row each, retain is called iff the reference count was 0 before, and delivery runs with `ignoreMute: true` and is eligible only for those recipients.
- AC7: The payload has `url` `/camera-events/<id>`, `tag` `share:<id>`, no `event` field, and title and body in the device locale. An unknown sender name never occurs because the caller is always in `users`.
- AC8: `Delivery` with `ignoreMute: true` sends while muted. Without it, the current behaviour is unchanged (existing tests stay green).

**Read paths**
- AC9: `getShareRecipientsFn` requires a session and excludes the caller.
- AC10: `getFavoritesPageHandler` merges, de-duplicates, sorts newest first, drops events missing from Frigate, and resolves sender names (null for unknown senders).
- AC11: `removeReceivedShareFn` requires a session, validates the event ID, removes only the caller's rows, and calls `unretainIfLast`.

**UI**
- AC12: `ShareButton` renders `Share2` on the server and on first render, and `Share` after mount on Apple user agents.
- AC13: `ShareSheet` lists recipients, keeps Send disabled until someone is selected, shows "Sent ✓" then closes on 204, shows an `Alert` on failure, and shows the empty state when the list is empty.
- AC14: `EventCard` with `sharedBy` shows the shared icon and "from X" / "from X +N" / "from someone". Without it, nothing changes.
- AC15: The detail page shows `SharedByRow` only when `sharedBy` is non-empty. Remove calls the server fn and invalidates the router.
- AC16: Every new string exists in both `en.json` and `da.json`.

## Consistency Gate

- [x] Intent is unambiguous: every decision came from the 2026-11-01 design session (19 questions).
- [x] Every behavior in the intent has a scenario.
- [x] No cross-feature imports: storage, retention and users are in `shared/server`, the push send is in `push-notifications` behind an HTTP route, and the UI is in `camera-details`, `favorites` and `shared/components`.
- [x] Every protected entry point calls `requireSession()` first and validates the event ID.
- [x] Cross-platform: text-only notifications on every platform, the SW is unchanged, and the icon is chosen after mount.
