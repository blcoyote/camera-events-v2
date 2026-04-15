# Spec: Vertical Feature-Sliced Architecture Refactor

## Intent Description

Restructure the existing codebase from a technical-role layout (`components/`, `hooks/`, `pages/`, `server/`, `data/`) into a vertical feature-sliced architecture under `src/features/`. Each feature owns all of its components, hooks, utilities, types, server logic, stories, and tests. Features must never import from other features — shared code lives exclusively in `src/features/shared/`. Route files under `src/routes/` remain in place (TanStack Router requires file-based routing) and act as the composition layer that wires features to URLs.

## Current State

The codebase is organized by **technical role**:

```
src/
  components/       # UI components (Header, Footer, ThemeToggle, MediaCard, AlertBanner, ServiceWorkerRegistration)
  hooks/            # React hooks (useEventLimit, usePushSubscription)
  pages/            # Page components grouped by domain (camera-events/, cameras/, home/, settings/)
  data/             # Mock/placeholder data
  server/           # All server-side logic (auth, frigate client, push, mqtt, session)
  routes/           # TanStack Router file-based routes + API route handlers
```

This creates implicit cross-cutting dependencies: the settings page imports from `hooks/`, which is also used by camera-events routes; page components import server types directly; proxy handlers in `routes/api/` import from `server/frigate/`.

## User-Facing Behavior

```gherkin
Feature: Feature-sliced architecture refactor

  Background:
    Given the codebase has been restructured into src/features/

  Scenario: No functional regressions after refactor
    When the application is built with pnpm build
    Then the build completes without errors
    And all existing pages render identically
    And all API routes return the same responses
    And all tests pass without modification to assertions

  Scenario: Feature isolation is enforced
    Given any file inside src/features/<feature-a>/
    Then it must not import from src/features/<feature-b>/ where feature-a != feature-b and feature-b != "shared"
    And it may import from src/features/shared/
    And it may import from external packages

  Scenario: Routes compose features without feature-to-feature coupling
    Given the route files under src/routes/
    Then routes may import from any feature under src/features/
    And routes serve as the composition/wiring layer
    And no business logic lives directly in route files

  Scenario: Shared code is genuinely reusable
    Given any module in src/features/shared/
    Then it must be imported by at least two different features or by route files
    And it must not contain feature-specific business logic
```

## Feature Inventory

Analysis of the codebase identifies **7 feature slices** plus `shared`:

### 1. `camera-events` — Browsing and viewing Frigate detection events

**Domain**: Event list page, event detail page, event media proxy handlers, event formatting utilities, mock event data for stories.

| Current location | Target location |
|---|---|
| `src/pages/camera-events/CameraEventsListPage.tsx` | `src/features/camera-events/components/CameraEventsListPage.tsx` |
| `src/pages/camera-events/CameraEventsListPage.stories.tsx` | `src/features/camera-events/components/CameraEventsListPage.stories.tsx` |
| `src/pages/camera-events/CameraEventDetailPage.tsx` | `src/features/camera-events/components/CameraEventDetailPage.tsx` |
| `src/pages/camera-events/CameraEventDetailPage.stories.tsx` | `src/features/camera-events/components/CameraEventDetailPage.stories.tsx` |
| `src/routes/api/events/-clip-proxy.ts` | `src/features/camera-events/server/clip-proxy.ts` |
| `src/routes/api/events/-clip-proxy.test.ts` | `src/features/camera-events/server/clip-proxy.test.ts` |
| `src/routes/api/events/-snapshot-proxy.ts` | `src/features/camera-events/server/snapshot-proxy.ts` |
| `src/routes/api/events/-snapshot-proxy.test.ts` | `src/features/camera-events/server/snapshot-proxy.test.ts` |
| `src/routes/api/events/-thumbnail-proxy.ts` | `src/features/camera-events/server/thumbnail-proxy.ts` |
| `src/data/camera-events.ts` | `src/features/camera-events/data/mock-events.ts` |
| `src/data/-camera-events.test.ts` | `src/features/camera-events/data/mock-events.test.ts` |
| *(extracted from CameraEventsListPage)* | `src/features/camera-events/utils.ts` |

**Extracted utilities** (`utils.ts`): `formatRelativeTime`, `formatLabelName`, `getLabelDotColor`, `LABEL_DOT_COLORS` — currently defined in `CameraEventsListPage.tsx` and imported by `CameraEventDetailPage.tsx`.

**Internal imports**: `shared/server/frigate` (types, client), `shared/components/MediaCard`.

### 2. `cameras` — Live camera snapshot listing

**Domain**: Cameras page, camera snapshot proxy handler.

| Current location | Target location |
|---|---|
| `src/pages/cameras/CamerasPage.tsx` | `src/features/cameras/components/CamerasPage.tsx` |
| `src/pages/cameras/CamerasPage.stories.tsx` | `src/features/cameras/components/CamerasPage.stories.tsx` |
| `src/routes/api/cameras/-snapshot-proxy.ts` | `src/features/cameras/server/snapshot-proxy.ts` |
| `src/routes/api/cameras/-snapshot-proxy.test.ts` | `src/features/cameras/server/snapshot-proxy.test.ts` |

**Internal imports**: `shared/server/frigate` (client, config types, validation), `shared/components/MediaCard`.

### 3. `auth` — Google SSO authentication

**Domain**: OAuth flow, session management helpers, token encryption, Google provider setup.

| Current location | Target location |
|---|---|
| `src/server/auth.ts` | `src/features/auth/server/auth.ts` |
| `src/server/auth.test.ts` | `src/features/auth/server/auth.test.ts` |
| `src/server/auth-crypto.ts` | `src/features/auth/server/auth-crypto.ts` |
| `src/server/google-oauth.ts` | `src/features/auth/server/google-oauth.ts` |
| `src/server/google-oauth.test.ts` | `src/features/auth/server/google-oauth.test.ts` |

**Internal imports**: `shared/server/session` (types and config).

### 4. `push-notifications` — Server-side push notification pipeline

**Domain**: VAPID/web-push sending, subscription storage (SQLite), per-camera preferences, MQTT subscriber, event batching, notification dispatch.

| Current location | Target location |
|---|---|
| `src/server/push.ts` | `src/features/push-notifications/server/push.ts` |
| `src/server/push.test.ts` | `src/features/push-notifications/server/push.test.ts` |
| `src/server/push-store.ts` | `src/features/push-notifications/server/push-store.ts` |
| `src/server/push-store.test.ts` | `src/features/push-notifications/server/push-store.test.ts` |
| `src/server/push-notify.ts` | `src/features/push-notifications/server/push-notify.ts` |
| `src/server/push-notify.test.ts` | `src/features/push-notifications/server/push-notify.test.ts` |
| `src/server/event-batcher.ts` | `src/features/push-notifications/server/event-batcher.ts` |
| `src/server/event-batcher.test.ts` | `src/features/push-notifications/server/event-batcher.test.ts` |
| `src/server/mqtt.ts` | `src/features/push-notifications/server/mqtt.ts` |
| `src/server/mqtt.test.ts` | `src/features/push-notifications/server/mqtt.test.ts` |
| `src/server/mqtt-cache.integration.test.ts` | `src/features/push-notifications/server/mqtt-cache.integration.test.ts` |
| `src/routes/api/push/-push-handlers.ts` | `src/features/push-notifications/server/push-handlers.ts` |

**Internal imports**: `shared/server/frigate` (client — for camera list in preferences), `shared/server/frigate/cache` (cache invalidation from MQTT).

### 5. `settings` — User preferences UI

**Domain**: Settings page layout, notification settings UI, push subscription hook. The settings page is a **composite** — it renders configuration UI that touches multiple domains. To honor the no-cross-feature-import rule, all UI and hooks that the settings page uses directly must live here or in `shared`.

| Current location | Target location |
|---|---|
| `src/pages/settings/SettingsPage.tsx` | `src/features/settings/components/SettingsPage.tsx` |
| `src/pages/settings/SettingsPage.stories.tsx` | `src/features/settings/components/SettingsPage.stories.tsx` |
| `src/pages/settings/NotificationSettings.tsx` | `src/features/settings/components/NotificationSettings.tsx` |
| `src/pages/settings/NotificationSettings.stories.tsx` | `src/features/settings/components/NotificationSettings.stories.tsx` |
| `src/pages/settings/NotificationSettings.test.ts` | `src/features/settings/components/NotificationSettings.test.ts` |
| `src/hooks/usePushSubscription.ts` | `src/features/settings/hooks/usePushSubscription.ts` |
| `src/hooks/usePushSubscription.test.ts` | `src/features/settings/hooks/usePushSubscription.test.ts` |

**Rationale for `usePushSubscription` in settings**: This hook is only consumed by `NotificationSettings`, which lives in settings. The push-notifications feature is server-only. If a future feature needs this hook, it moves to `shared/` at that time.

**Internal imports**: `shared/hooks/useEventLimit`.

### 6. `home` — Landing / login page

**Domain**: Home page with sign-in CTA and alert banners.

| Current location | Target location |
|---|---|
| `src/pages/home/HomePage.tsx` | `src/features/home/components/HomePage.tsx` |
| `src/pages/home/HomePage.stories.tsx` | `src/features/home/components/HomePage.stories.tsx` |

**Internal imports**: `shared/components/AlertBanner`.

### 7. `shell` — App chrome (header, footer, theme, service worker)

**Domain**: Layout components rendered by the root route — not page-specific, used app-wide.

| Current location | Target location |
|---|---|
| `src/components/Header.tsx` | `src/features/shell/components/Header.tsx` |
| `src/components/Header.test.tsx` | `src/features/shell/components/Header.test.tsx` |
| `src/components/Header.stories.tsx` | `src/features/shell/components/Header.stories.tsx` |
| `src/components/Footer.tsx` | `src/features/shell/components/Footer.tsx` |
| `src/components/Footer.stories.tsx` | `src/features/shell/components/Footer.stories.tsx` |
| `src/components/ThemeToggle.tsx` | `src/features/shell/components/ThemeToggle.tsx` |
| `src/components/ThemeToggle.stories.tsx` | `src/features/shell/components/ThemeToggle.stories.tsx` |
| `src/components/ServiceWorkerRegistration.tsx` | `src/features/shell/components/ServiceWorkerRegistration.tsx` |

**Internal imports**: `shared/server/session` (SessionData type for Header).

### `shared` — Code used by multiple features

| Current location | Target location |
|---|---|
| `src/components/MediaCard.tsx` | `src/features/shared/components/MediaCard.tsx` |
| `src/components/AlertBanner.tsx` | `src/features/shared/components/AlertBanner.tsx` |
| `src/components/AlertBanner.test.ts` | `src/features/shared/components/AlertBanner.test.ts` |
| `src/components/AlertBanner.stories.tsx` | `src/features/shared/components/AlertBanner.stories.tsx` |
| `src/server/session.ts` | `src/features/shared/server/session.ts` |
| `src/server/session.test.ts` | `src/features/shared/server/session.test.ts` |
| `src/server/frigate/types.ts` | `src/features/shared/server/frigate/types.ts` |
| `src/server/frigate/config.ts` | `src/features/shared/server/frigate/config.ts` |
| `src/server/frigate/config.test.ts` | `src/features/shared/server/frigate/config.test.ts` |
| `src/server/frigate/client.ts` | `src/features/shared/server/frigate/client.ts` |
| `src/server/frigate/client.test.ts` | `src/features/shared/server/frigate/client.test.ts` |
| `src/server/frigate/cache.ts` | `src/features/shared/server/frigate/cache.ts` |
| `src/server/frigate/cache.test.ts` | `src/features/shared/server/frigate/cache.test.ts` |
| `src/server/frigate/mock-client.ts` | `src/features/shared/server/frigate/mock-client.ts` |
| `src/server/frigate/mock-client.test.ts` | `src/features/shared/server/frigate/mock-client.test.ts` |
| `src/server/frigate/validation.ts` | `src/features/shared/server/frigate/validation.ts` |
| `src/server/frigate/validation.test.ts` | `src/features/shared/server/frigate/validation.test.ts` |
| `src/server/frigate/assets/placeholder.jpeg` | `src/features/shared/server/frigate/assets/placeholder.jpeg` |
| `src/hooks/useEventLimit.ts` | `src/features/shared/hooks/useEventLimit.ts` |
| `src/hooks/useEventLimit.test.ts` | `src/features/shared/hooks/useEventLimit.test.ts` |

**Justification**: The Frigate client is the central data-access layer used by camera-events, cameras, push-notifications, and route loaders. `SessionData` is used by auth, shell (Header), and multiple route guards. `MediaCard` is used by camera-events and cameras. `useEventLimit` is used by the camera-events route loader and the settings page. `AlertBanner` is used by home and is a generic reusable component.

## Files That Stay in Place

These files are **not moved** — they are entry points, generated files, or router-required locations:

| File | Reason |
|---|---|
| `src/routes/**/*.tsx`, `src/routes/**/*.ts` | TanStack Router file-based routing requires these locations |
| `src/routes/_authenticated/-*.test.ts` | Co-located route tests stay with routes |
| `src/routes/-index.test.ts` | Co-located route test |
| `src/routes/-authenticated.test.ts` | Co-located route test |
| `src/routeTree.gen.ts` | Auto-generated by TanStack Router |
| `src/router.tsx` | Router config entry point |
| `src/server.ts` | Server entry point |
| `src/styles.css` | Global stylesheet |
| `src/sw.ts` | Service worker entry point |
| `src/sw-push-handlers.ts` | Service worker push handler |
| `src/sw-push-handlers.test.ts` | Co-located test |
| `src/web-push.d.ts` | Type declaration |

Route files will have their import paths updated to point to the new feature locations.

## Target Directory Structure

```
src/
  features/
    shared/
      components/
        MediaCard.tsx
        AlertBanner.tsx
        AlertBanner.test.ts
        AlertBanner.stories.tsx
      server/
        session.ts
        session.test.ts
        frigate/
          types.ts
          config.ts
          config.test.ts
          client.ts
          client.test.ts
          cache.ts
          cache.test.ts
          mock-client.ts
          mock-client.test.ts
          validation.ts
          validation.test.ts
          assets/
            placeholder.jpeg
      hooks/
        useEventLimit.ts
        useEventLimit.test.ts

    auth/
      server/
        auth.ts
        auth.test.ts
        auth-crypto.ts
        google-oauth.ts
        google-oauth.test.ts

    camera-events/
      components/
        CameraEventsListPage.tsx
        CameraEventsListPage.stories.tsx
        CameraEventDetailPage.tsx
        CameraEventDetailPage.stories.tsx
      server/
        clip-proxy.ts
        clip-proxy.test.ts
        snapshot-proxy.ts
        snapshot-proxy.test.ts
        thumbnail-proxy.ts
      data/
        mock-events.ts
        mock-events.test.ts
      utils.ts

    cameras/
      components/
        CamerasPage.tsx
        CamerasPage.stories.tsx
      server/
        snapshot-proxy.ts
        snapshot-proxy.test.ts

    push-notifications/
      server/
        push.ts
        push.test.ts
        push-store.ts
        push-store.test.ts
        push-notify.ts
        push-notify.test.ts
        event-batcher.ts
        event-batcher.test.ts
        mqtt.ts
        mqtt.test.ts
        mqtt-cache.integration.test.ts
        push-handlers.ts

    settings/
      components/
        SettingsPage.tsx
        SettingsPage.stories.tsx
        NotificationSettings.tsx
        NotificationSettings.stories.tsx
        NotificationSettings.test.ts
      hooks/
        usePushSubscription.ts
        usePushSubscription.test.ts

    home/
      components/
        HomePage.tsx
        HomePage.stories.tsx

    shell/
      components/
        Header.tsx
        Header.test.tsx
        Header.stories.tsx
        Footer.tsx
        Footer.stories.tsx
        ThemeToggle.tsx
        ThemeToggle.stories.tsx
        ServiceWorkerRegistration.tsx

  routes/          # Unchanged location — import paths updated
  router.tsx       # Unchanged
  routeTree.gen.ts # Auto-generated
  server.ts        # Server entry point — import path updated
  styles.css       # Unchanged
  sw.ts            # Unchanged
  sw-push-handlers.ts  # Unchanged
  web-push.d.ts    # Unchanged
```

## Dependency Rules

1. **Feature → Feature**: FORBIDDEN. No feature may import from another feature.
2. **Feature → Shared**: ALLOWED. Any feature may import from `src/features/shared/`.
3. **Feature → External packages**: ALLOWED.
4. **Route → Feature**: ALLOWED. Route files may import from any feature (they are the composition layer).
5. **Route → Shared**: ALLOWED.
6. **Shared → Feature**: FORBIDDEN. Shared code must not depend on any specific feature.
7. **Shared → External packages**: ALLOWED.

## Import Path Convention

The `#/*` path alias maps to `src/*`. After the refactor, feature imports will look like:

```ts
// From a route file
import { CamerasPage } from '#/features/cameras/components/CamerasPage'
import { getEvents } from '#/features/shared/server/frigate/client'

// From within a feature
import { formatRelativeTime } from '../utils'  // relative within feature
import { MediaCard } from '#/features/shared/components/MediaCard'  // shared
```

## Key Refactoring Decisions

1. **Extract `camera-events/utils.ts`**: `formatRelativeTime`, `formatLabelName`, `getLabelDotColor`, and `LABEL_DOT_COLORS` are currently defined in `CameraEventsListPage.tsx` and imported by `CameraEventDetailPage.tsx`. Extract to a separate utils module within the feature.

2. **`usePushSubscription` lives in `settings`**: It is only consumed by `NotificationSettings`. The server-side push pipeline (`push-notifications` feature) is independent. This avoids a cross-feature import.

3. **`useEventLimit` lives in `shared`**: Used by both the camera-events route loader (`readEventLimit()`) and the settings page (`useEventLimit()` hook).

4. **Frigate client is shared infrastructure**: It's the data-access layer used by 3+ features. It belongs in `shared/server/frigate/`.

5. **Route handler logic moves into features**: Files like `-clip-proxy.ts`, `-push-handlers.ts` contain business logic extracted for testability. They move into their owning feature. The thin route files in `src/routes/api/` remain and update their imports.

6. **`shell` is a feature, not shared**: Header/Footer/ThemeToggle are used only by the root route, not by other features. They form a cohesive "app shell" feature.

7. **Service worker files stay at `src/` root**: `sw.ts` and `sw-push-handlers.ts` are build entry points registered by the browser, not feature code.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Import paths break during migration | Migrate one feature at a time; run `pnpm tsc --noEmit` after each move |
| Route tree breaks | Never move files under `src/routes/`; only update imports within them |
| Storybook paths break | Update Storybook story imports; run `pnpm storybook` to verify |
| Circular dependency introduced | Shared never imports from features; features never import from each other |
| Test file discovery changes | Vitest globbing (`**/*.test.ts`) works regardless of directory structure |
