# Graph Report - camera-events-v2 (2026-08-15)

## Corpus Check

- 308 files · ~145,475 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 1334 nodes · 2289 edges · 161 communities (77 shown, 84 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `88bf549f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- SettingsPage.tsx
- CameraEventDetailPage.tsx
- SortableCamerasGrid.tsx
- client.ts
- sqlite/index.ts
- routeTree.gen.ts
- CLAUDE.md Project Instructions
- camera-events.index.tsx
- Header.tsx
- sw-push-handlers.ts
- compilerOptions
- types.ts
- mock-client.ts
- getSessionConfig
- usePullToRefresh Hook
- cache.ts
- What You Must Do When Invoked
- mqtt.ts
- entry
- session.ts
- Home (Memory Vault Index)
- Inline Event Clip Playback
- audit-advisories.ts
- EventCard.tsx
- dependencies
- Vertical Feature-Sliced Pattern
- FrigateEvent
- event-batcher.ts
- push-notify.ts
- Cross-Platform PWA Constraint
- scripts
- SendThrottle
- NotificationSettings.tsx
- client.test.ts
- useCameraOrder.ts
- src/server/mqtt.ts Module
- Frigate sample.config.yml
- PR Checks Workflow
- manifest.json
- Storybook Stories for All Components and Pages Spec
- isValidEventId
- resyncExistingPushSubscription
- push_notification_preferences Table Usage
- Subscription Storage (push-store.ts)
- devDependencies
- go2rtc RTSP Restream Config
- package.json
- validation.ts
- push-store.ts
- startMqttSubscriber Function
- EventBatcher Class
- test-auth.ts
- mock-events.ts
- EventCard.test.tsx
- web-push.d.ts
- cameras-reorder.spec.ts
- EventBatcher Leading-Edge Flush
- vite.config.ts
- applypatch-msg
- commit-msg
- post-applypatch
- post-commit
- post-rewrite
- pre-applypatch
- pre-auto-gc
- pre-merge-commit
- pre-rebase
- Push Payload Format (title/body/url)
- verify-bun-bundle.mjs
- post-checkout
- post-merge
- pre-commit
- pre-push
- prepare-commit-msg
- CameraEventsListPage.tsx
- @dnd-kit/modifiers
- @dnd-kit/sortable
- @dnd-kit/utilities
- Obsidian Memory Vault Decision
- GitHub Pull Request Workflow
- AlertBanner.stories.tsx
- Header.stories.tsx
- entrypoint.sh
- husky
- jsdom
- lint-staged
- nitro
- mqtt
- react
- react-dom
- serwist
- @tailwindcss/vite
- @tanstack/react-devtools
- @tanstack/react-start
- @tanstack/router-plugin
- web-push
- knip
- playwright
- prettier
- @serwist/build
- @tailwindcss/typography
- @tanstack/devtools-vite
- @tanstack/eslint-config
- @testing-library/dom
- @testing-library/jest-dom
- @testing-library/react
- @types/better-sqlite3
- @types/node
- @types/react
- @types/react-dom
- typescript
- @vitejs/plugin-react
- vitest
- @vitest/browser
- @vitest/browser-playwright
- @vitest/coverage-v8
- prettier.config.js
- Allow-All Crawling Directive
- Runtime-Portable SQLite Driver
- Feature Slice
- npx tsr generate
- Pull-to-Refresh Spec
- Rearrange Cameras on Feed Spec
- Web Push Notifications Spec
- Apple Touch Icon
- Favicon (Abstract Camera/Network Mark)
- PWA Icon (192x192)
- PWA Icon (512x512)
- Maskable App Icon (192x192)
- Maskable App Icon (512x512)
- Surveillance Camera Illustration 1
- Placeholder Camera Snapshot (Mock Frigate)
- favorites-handlers.ts
- graphify reference: extra exports and benchmark
- SnapshotLightbox.tsx
- clip-proxy.ts
- graphify reference: query, path, explain
- CameraEventsLoading.tsx
- router.tsx
- Permissions Policy
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- InfoCard.tsx
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- claude-skills.md
- rules/graphify.md
- workflows/graphify.md
- CLAUDE.md
- extraction-spec.md
- @tanstack/react-router-devtools

## God Nodes (most connected - your core abstractions)

1. `getSessionConfig()` - 25 edges
2. `FileRoutesByPath` - 24 edges
3. `CLAUDE.md Project Instructions` - 24 edges
4. `loadMock()` - 18 edges
5. `FrigateEvent` - 18 edges
6. `SessionData` - 18 edges
7. `compilerOptions` - 17 edges
8. `scripts` - 14 edges
9. `getPushStore()` - 14 edges
10. `useTheme()` - 13 edges

## Surprising Connections (you probably didn't know these)

- `EventBatcher Burst Detection` --semantically_similar_to--> `EventBatcher (fixed-window description)` [AMBIGUOUS] [semantically similar]
  CLAUDE.md → docs/claude/backend.md
- `Object Tracking (person, min_score 0.75)` --conceptually_related_to--> `parseFrigateEvent Function` [INFERRED]
  frigate/sample.config.yml → docs/specs/mqtt-push-notifications.md
- `CLAUDE.md Project Instructions` --shares_data_with--> `Deployment & Environment Doc` [INFERRED]
  CLAUDE.md → docs/claude/deployment.md
- `CLAUDE.md Project Instructions` --shares_data_with--> `PWA, SSR & Tailwind Doc` [INFERRED]
  CLAUDE.md → docs/claude/pwa-ssr.md
- `CLAUDE.md Project Instructions` --shares_data_with--> `Authentication & Security Doc` [INFERRED]
  CLAUDE.md → docs/claude/auth-security.md

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **Camera Drag-and-Drop Reorder Feature** — docs_specs_rearrange_cameras_on_feed_cameraspage, docs_specs_rearrange_cameras_on_feed_sortablecamerasgrid, docs_specs_rearrange_cameras_on_feed_sortablecameratile, docs_specs_rearrange_cameras_on_feed_dndkit, docs_specs_rearrange_cameras_on_feed_usecameraorder [EXTRACTED 1.00]
- **CI Check to Image Build to Release Promotion Pipeline** — github_workflows_pr_docker_build, github_workflows_build_image_build_and_push, github_workflows_promote_release_promote_to_test, github_workflows_promote_release_promote_to_prod [EXTRACTED 1.00]
- **Camera Events Feature Split Sequence (1→2→3)** — docs_specs_feature_split_1_extract_shared_foundations, docs_specs_feature_split_2_extract_favorites_feature, docs_specs_feature_split_3_extract_camera_details_feature [EXTRACTED 1.00]
- **MQTT Event Processing Pipeline** — docs_specs_mqtt_cache_invalidation_onfrigatemessage, docs_specs_mqtt_push_notifications_parsefrigateevent, docs_specs_mqtt_push_notifications_eventbatcher, docs_specs_mqtt_push_notifications_notifyusersforcamera [EXTRACTED 1.00]
- **TanStack Start's Four Environment Primitives** — claude_skills_tanstack_start_boundaries_skill_createserverfn, claude_skills_tanstack_start_boundaries_skill_createserveronlyfn, claude_skills_tanstack_start_boundaries_skill_createclientonlyfn, claude_skills_tanstack_start_boundaries_skill_createisomorphicfn [EXTRACTED 1.00]
- **Web Push Subscription Infrastructure** — docs_specs_web_push_notifications_vapid_config, docs_specs_web_push_notifications_push_subscription_api, docs_specs_web_push_notifications_pushstore, docs_specs_web_push_notifications_webpush_lib, docs_specs_web_push_notifications_sw_push_handler [EXTRACTED 1.00]
- **Camera Event Detail Page Evolution Across Specs** — docs_specs_feature_split_3_extract_camera_details_feature, docs_specs_mobile_event_detail_redesign, docs_specs_inline_event_clip_playback [INFERRED 0.75]
- **Defense-in-Depth Input Validation Before Frigate URL Construction** — docs_memory_decisions_2026_04_14_frigate_api_client_frigate_api_client, docs_memory_decisions_2026_04_14_server_function_authentication_server_function_authentication, docs_memory_decisions_2026_04_14_frigate_api_client_client_ts [INFERRED 0.75]
- **iOS/Android Cross-Platform PWA Constraint Cluster** — docs_memory_decisions_2026_04_17_cross_platform_pwa_first_cross_platform_pwa_constraint, docs_memory_gotchas_ios_ignores_silent_and_renotify_ios_silent_renotify_gotcha, docs_memory_decisions_2026_08_02_alert_once_per_burst_then_patch_alert_once_per_burst, docs_memory_gotchas_push_subscription_desync_push_subscription_desync, docs_memory_gotchas_ssr_hydration_browser_globals_ssr_hydration_gotcha [INFERRED 0.75]
- **Burst-Based Notification Dedup Pattern** — docs_specs_camera_motion_notification_dedup_event_batcher, docs_specs_camera_motion_notification_dedup_plan_notification, docs_specs_camera_motion_notification_dedup_send_throttle [INFERRED 0.85]
- **Favorite Toggle Persistence Pattern** — docs_specs_event_favorites_slice_1_favorite_button, docs_specs_event_favorites_slice_1_favorites_store, docs_specs_event_favorites_slice_1_event_favorites_table [INFERRED 0.85]
- **Red-Green-Refactor Discipline Mandated Across Docs** — claude_skills_test_driven_development_skill_doc, claude_doc, docs_claude_testing_doc, agents_doc [INFERRED 0.85]

## Communities (161 total, 84 thin omitted)

### Community 0 - "SettingsPage.tsx"

Cohesion: 0.05
Nodes (52): loadEventsFn, getSettingsContent(), paletteOptions, pillClass(), SettingsPage(), mockSetEventLimit, mockSetPalette, mockSetTheme (+44 more)

### Community 1 - "CameraEventDetailPage.tsx"

Cohesion: 0.27
Nodes (11): EventClipPlayer(), EventSnapshot(), CameraEventDetailPage(), DetailPageState, formatDuration(), formatTimestamp(), getDetailPageState(), getDownloadUrl() (+3 more)

### Community 2 - "SortableCamerasGrid.tsx"

Cohesion: 0.21
Nodes (9): reorderOnDragEnd(), SortableCamerasGrid(), SortableCamerasGridProps, DragEndEvent, SortableCameraTile(), SortableCameraTileProps, getOutput(), MediaCard() (+1 more)

### Community 3 - "client.ts"

Cohesion: 0.14
Nodes (27): buildUrl(), frigateBinary(), FrigateClipStreamResponse, frigateFetch(), frigateGet(), getCameras(), getConfig(), getEventClipStream() (+19 more)

### Community 4 - "sqlite/index.ts"

Cohesion: 0.07
Nodes (34): getMqttConnectionState(), mockGetEvent, mockRequireSession, mockRetainEvent, mockUnretainEvent, createFavoritesStore(), FavoritesStore, checkDatabase() (+26 more)

### Community 5 - "routeTree.gen.ts"

Cohesion: 0.06
Nodes (35): Route, Route, ApiAuthGoogleCallbackRoute, ApiAuthGoogleRoute, ApiAuthGoogleRouteChildren, ApiAuthGoogleRouteWithChildren, ApiAuthLogoutRoute, ApiCamerasNameLatestRoute (+27 more)

### Community 6 - "CLAUDE.md Project Instructions"

Cohesion: 0.08
Nodes (41): Beads Config (.beads/config.yaml), bd CLI, Beads Issue Tracker, Beads README, Dolt Database, CLAUDE.md Project Instructions, EventBatcher Burst Detection, Feature-Sliced Architecture (+33 more)

### Community 7 - "camera-events.index.tsx"

Cohesion: 0.06
Nodes (39): makeEvent(), mockEventClipPlayer, mockEventSnapshot, mockFavoriteButton, mockSnapshotLightbox, mockToggle, mockUseFavoriteToggle, successResult() (+31 more)

### Community 8 - "Header.tsx"

Cohesion: 0.07
Nodes (28): isStandalone(), needsSessionRefresh(), SESSION_EXPIRY_REFRESH_WINDOW_MS, SESSION_LAST_REFRESH_KEY, SESSION_REFRESH_MIN_INTERVAL_MS, SESSION_REFRESH_THRESHOLD_MS, t0, useSessionRefresh() (+20 more)

### Community 9 - "sw-push-handlers.ts"

Cohesion: 0.10
Nodes (30): Clients, ExtendableEvent, ExtendableMessageEvent, NotificationEvent, buildNotificationBody(), buildNotificationOptions(), DEFAULT_PAYLOAD, formatLocalTime() (+22 more)

### Community 10 - "compilerOptions"

Cohesion: 0.07
Nodes (27): DOM, DOM.Iterable, ES2022, eslint.config.js, prettier.config.js, **/\*.ts, **/\*.tsx, vite/client (+19 more)

### Community 11 - "types.ts"

Cohesion: 0.09
Nodes (21): isNonZeroBox(), BoundingBox, FrigateCameraConfig, FrigateCameraStats, FrigateConfig, FrigateCpuUsage, FrigateDetectorStats, FrigateEventData (+13 more)

### Community 12 - "mock-client.ts"

Cohesion: 0.11
Nodes (36): BoundingBox, generateCameraConfig(), generateEvent(), generateReview(), generateTimelineEntry(), getCameras(), getConfig(), getEvent() (+28 more)

### Community 13 - "getSessionConfig"

Cohesion: 0.22
Nodes (19): getVapidPublicKey(), handleGetPreferences(), HandlerResult, handleSetPreference(), handleSubscribe(), handleTest(), handleUnsubscribe(), handleVapidPublicKey() (+11 more)

### Community 14 - "usePullToRefresh Hook"

Cohesion: 0.10
Nodes (21): Pull Activation Threshold (80px default), camera-events.index.tsx Route Integration, cameras.tsx Route Integration, iOS Native Pull-to-Refresh Conflict, overscroll-behavior-y: contain, PullToRefreshIndicator Component, touchmove preventDefault Technique, usePullToRefresh Hook (+13 more)

### Community 15 - "cache.ts"

Cohesion: 0.13
Nodes (10): handlers, mockClient, mockEnd, mockSubscribe, CACHE_MAX_ENTRIES, CACHE_TTL_MS, CacheEntry, clearFrigateCache() (+2 more)

### Community 16 - "What You Must Do When Invoked"

Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 17 - "mqtt.ts"

Cohesion: 0.16
Nodes (14): BatcherConfig, Env, parseDurationMs(), resolveAppleUpdateIntervalMs(), resolveBatcherConfig(), dispatchBatch(), eventBatcher, MqttConnectionState (+6 more)

### Community 18 - "entry"

Cohesion: 0.11
Nodes (17): entry, ignoreBinaries, ignoreDependencies, project, $schema, only-allow, src/router.tsx, src/routes/\*_/_.{ts,tsx} (+9 more)

### Community 19 - "session.ts"

Cohesion: 0.12
Nodes (27): buildOAuthState(), decryptOAuthState(), deriveKey(), encryptOAuthState(), getCurrentUserFn, OAUTH_SCOPES, OAUTH_STATE_COOKIE_NAME, OAUTH_STATE_COOKIE_OPTIONS (+19 more)

### Community 20 - "Home (Memory Vault Index)"

Cohesion: 0.18
Nodes (16): Frigate HTTP API Surface, MQTT to Push Notification Pipeline, System Overview, Theming System, Frigate client.ts, Frigate Single-Client, Cache, Mock, Validation Decision, frigateCache (TtlCache), Arctic OAuth Library (+8 more)

### Community 21 - "Inline Event Clip Playback"

Cohesion: 0.18
Nodes (17): Feature Split 1: Extract Shared Foundations, Feature Split 2: Extract Favorites Feature, Feature Split 3: Extract Camera-Details Feature, Refetch on Focus / Notification Tap, useRefetchOnFocus Hook, Frigate API Client (Read Operations), FrigateResult<T> Discriminated Union, Google OAuth Production Mode with Email Allowlist (+9 more)

### Community 22 - "audit-advisories.ts"

Cohesion: 0.16
Nodes (15): Advisory, COLOR, fetchAdvisories(), FetchResult, Finding, formatFinding(), InstalledPackage, main() (+7 more)

### Community 23 - "EventCard.tsx"

Cohesion: 0.16
Nodes (10): EventCard(), EventThumbnail(), FavoriteButton(), FavoriteButtonProps, mockInvalidate, mockToggleFavoriteFn, useFavoriteToggle(), toggleFavoriteFn (+2 more)

### Community 24 - "dependencies"

Cohesion: 0.13
Nodes (15): arctic, @dnd-kit/core, lucide-react, dependencies, arctic, @dnd-kit/core, lucide-react, tailwindcss (+7 more)

### Community 25 - "Vertical Feature-Sliced Pattern"

Cohesion: 0.18
Nodes (15): Cameras Page Route, Camera Snapshot Proxy Route, Event Limit SSR Fix, iOS Standalone Download Fix, Clip Proxy Route, Clip/Snapshot Download Links, useEventLimit Hook, event_favorites SQLite Table (+7 more)

### Community 26 - "FrigateEvent"

Cohesion: 0.16
Nodes (8): mockEventCard, FavoritesPage(), getUserFavoritedEventsFn, FrigateEvent, favoritesLoader(), Route, MOCK_EVENTS, mockGetUserFavoritedEventsFn

### Community 27 - "event-batcher.ts"

Cohesion: 0.18
Nodes (4): EventBatcher, FlushCallback, FlushMeta, FrigateEventInfo

### Community 28 - "push-notify.ts"

Cohesion: 0.28
Nodes (11): appleUpdateThrottle, buildCameraPayload(), cameraNotificationTag(), endpointHost(), formatCameraName(), formatLabel(), formatTime(), notifyUsersForCamera() (+3 more)

### Community 29 - "Cross-Platform PWA Constraint"

Cohesion: 0.20
Nodes (14): Cross-Platform PWA Constraint, Login Allow-list in Google Cloud, Session Lifetime & Proactive Refresh, Alert Once Per Burst, Then Patch, Event, Event Batching, Frigate, Review (+6 more)

### Community 30 - "scripts"

Cohesion: 0.14
Nodes (14): scripts, audit:advisories, build, check, dev, format, knip, lint (+6 more)

### Community 31 - "SendThrottle"

Cohesion: 0.21
Nodes (6): originals, TUNABLES, NotifyOptions, shouldSendToEndpoint(), isAppleEndpoint(), SendThrottle

### Community 32 - "NotificationSettings.tsx"

Cohesion: 0.24
Nodes (9): CameraPref, CameraPreferences(), formatCameraName(), NotificationSection(), NotificationSettings(), formatSubscribeError(), urlBase64ToUint8Array(), usePushSubscription() (+1 more)

### Community 33 - "client.test.ts"

Cohesion: 0.17
Nodes (4): MOCK_EVENT, MOCK_REVIEW, FrigateReview, FrigateReviewSummary

### Community 34 - "useCameraOrder.ts"

Cohesion: 0.26
Nodes (7): SAVE_ERROR_MESSAGE, useCameraOrder(), loadOrder(), saveOrder(), SaveResult, STORAGE_KEY, mergeCameraOrder()

### Community 35 - "src/server/mqtt.ts Module"

Cohesion: 0.22
Nodes (10): clearFrigateCache Function, src/server/mqtt.ts Module, onFrigateMessage Handler, MQTT Event-Driven Cache Invalidation Spec, FrigateEventInfo Type, parseFrigateEvent Function, MQTT-Driven Push Notifications with Per-Camera Opt-Out Spec, clearCache Server Function (+2 more)

### Community 36 - "Frigate sample.config.yml"

Cohesion: 0.22
Nodes (10): frigate/events MQTT Topic, frigate/reviews MQTT Topic, SUBSCRIBED_TOPICS Constant, Birdseye Continuous Mode, Coral EdgeTPU Detector, ffmpeg Global/Input/Hwaccel Args, Frigate sample.config.yml, Frigate MQTT Config Block (+2 more)

### Community 37 - "PR Checks Workflow"

Cohesion: 0.29
Nodes (10): build-and-push job (build-image.yml), Build & Push Docker Image Workflow, changes job (pr.yml), code_quality job (pr.yml), PR Checks Workflow, docker_build job (pr.yml), tests job (pr.yml), Promote Image to Release Workflow (+2 more)

### Community 38 - "manifest.json"

Cohesion: 0.20
Nodes (9): background_color, display, icons, name, orientation, scope, short_name, start_url (+1 more)

### Community 39 - "Storybook Stories for All Components and Pages Spec"

Cohesion: 0.22
Nodes (9): CameraEventDetailPage.stories.tsx, CameraEventsListPage.stories.tsx, CamerasPage.stories.tsx, Footer.stories.tsx, src/stories/ Placeholder Files, ServiceWorkerRegistration (excluded from stories), SettingsPage.stories.tsx, Storybook Stories for All Components and Pages Spec (+1 more)

### Community 40 - "isValidEventId"

Cohesion: 0.28
Nodes (6): handleSnapshotRequest(), handleThumbnailRequest(), isValidEventId(), resolveIsAuthenticated(), Route, Route

### Community 41 - "resyncExistingPushSubscription"

Cohesion: 0.44
Nodes (4): resyncExistingPushSubscription(), resyncSubscription(), ServiceWorkerRegistration(), resyncMock

### Community 42 - "push_notification_preferences Table Usage"

Cohesion: 0.29
Nodes (7): Opt-Out Default Preference Model, Preferences API (GET/PUT /api/push/preferences), push_notification_preferences Table Usage, Per-Camera Toggle Settings UI, push_notification_preferences Table, Settings Notifications Section, Camera: gavl_vest

### Community 43 - "Subscription Storage (push-store.ts)"

Cohesion: 0.33
Nodes (7): Push Subscription API Endpoints, push_subscriptions Table, Subscription Storage (push-store.ts), usePushSubscription Hook, VAPID Key Config, GET /api/push/vapid-public-key, web-push Library Integration

### Community 44 - "devDependencies"

Cohesion: 0.29
Nodes (7): eslint, devDependencies, better-sqlite3, eslint, vite, better-sqlite3, vite

### Community 45 - "go2rtc RTSP Restream Config"

Cohesion: 0.29
Nodes (7): Camera: garage, Camera: gavl_oest, Camera: have, Camera: koekken, Camera: stuen, Camera: vaerksted, go2rtc RTSP Restream Config

### Community 46 - "package.json"

Cohesion: 0.29
Nodes (6): imports, lint-staged, \*.{js,jsx,ts,tsx,md,json,css,yml,yaml}, name, private, type

### Community 47 - "validation.ts"

Cohesion: 0.33
Nodes (3): handleSnapshotRequest(), isValidCameraName(), Route

### Community 48 - "push-store.ts"

Cohesion: 0.27
Nodes (6): PushEventInfo, PushPayload, PushSubscriptionInfo, createPushStore(), PushStore, PushSubscriptionRow

### Community 49 - "startMqttSubscriber Function"

Cohesion: 0.40
Nodes (5): MQTT_URL Environment Variable, MQTT.js v5 Library, Nitro MQTT Startup Plugin, RabbitMQ MQTT Broker, startMqttSubscriber Function

### Community 50 - "EventBatcher Class"

Cohesion: 0.40
Nodes (5): EventBatcher Class, notifyUsersForCamera Function, Per-Camera 10-Second Batching Window, Preference Store (push-store.ts, extended), sendPushNotification Wrapper

### Community 52 - "mock-events.ts"

Cohesion: 0.60
Nodes (3): CameraEvent, findEventById(), PLACEHOLDER_EVENTS

### Community 53 - "EventCard.test.tsx"

Cohesion: 0.40
Nodes (3): mockFavoriteButton, mockToggle, mockUseFavoriteToggle

### Community 54 - "web-push.d.ts"

Cohesion: 0.40
Nodes (4): PushSubscription, SendResult, web-push, WebPush

### Community 56 - "EventBatcher Leading-Edge Flush"

Cohesion: 0.83
Nodes (4): EventBatcher Leading-Edge Flush, planNotification Merge Logic, SendThrottle Apple Pacing, Notification Tag/Renotify Fix (F3)

### Community 67 - "Push Payload Format (title/body/url)"

Cohesion: 0.67
Nodes (3): Push Payload Format (title/body/url), Service Worker Push/NotificationClick Handler, URL Field Forward Compatibility

### Community 75 - "CameraEventsListPage.tsx"

Cohesion: 0.32
Nodes (7): FilterPill(), CameraEventsListPage(), EventsPageState, filterEvents(), getEventsPageState(), getUniqueCameras(), getUniqueLabels()

### Community 141 - "favorites-handlers.ts"

Cohesion: 0.42
Nodes (9): getUserFavoritedEventIdsHandler(), getUserFavoritedEventsHandler(), toggleFavoriteHandler(), getFavoritesStore(), frigateWrite(), getEvent(), retainEvent(), unretainEvent() (+1 more)

### Community 142 - "graphify reference: extra exports and benchmark"

Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 143 - "SnapshotLightbox.tsx"

Cohesion: 0.42
Nodes (7): clampTranslation(), distance(), IDENTITY, midpoint(), SnapshotLightbox(), SnapshotLightboxProps, Transform

### Community 144 - "clip-proxy.ts"

Cohesion: 0.39
Nodes (4): handleClipRequest(), mockFetchStream(), streamFrom(), Route

### Community 145 - "graphify reference: query, path, explain"

Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 146 - "CameraEventsLoading.tsx"

Cohesion: 0.47
Nodes (3): CameraEventsLoading(), FavoritesLoading(), SkeletonCard()

### Community 147 - "router.tsx"

Cohesion: 0.33
Nodes (5): getRouter(), Register, @tanstack/react-router, Register, routeTree

### Community 148 - "Permissions Policy"

Cohesion: 0.50
Nodes (3): Permissions Policy, Pre-Approved Permissions, Rule

### Community 149 - "graphify reference: add a URL and watch a folder"

Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 150 - "graphify reference: commit hook and native CLAUDE.md integration"

Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 151 - "graphify reference: incremental update and cluster-only"

Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

## Ambiguous Edges - Review These

- `Feature Split 3: Extract Camera-Details Feature` → `Mobile Event Detail Redesign` [AMBIGUOUS]
  docs/specs/mobile-event-detail-redesign.md · relation: conceptually_related_to
- `EventBatcher Burst Detection` → `EventBatcher (fixed-window description)` [AMBIGUOUS]
  docs/claude/backend.md · relation: semantically_similar_to

## Knowledge Gaps

- **420 isolated node(s):** `entrypoint.sh script`, `$schema`, `src/routes/**/*.{ts,tsx}`, `src/router.tsx`, `src/server.ts` (+415 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **84 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Feature Split 3: Extract Camera-Details Feature` and `Mobile Event Detail Redesign`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `EventBatcher Burst Detection` and `EventBatcher (fixed-window description)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `FrigateEvent` connect `FrigateEvent` to `SettingsPage.tsx`, `CameraEventDetailPage.tsx`, `client.test.ts`, `client.ts`, `camera-events.index.tsx`, `CameraEventsListPage.tsx`, `mock-client.ts`, `favorites-handlers.ts`, `types.ts`, `EventCard.test.tsx`, `EventCard.tsx`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `FrigateResult` connect `camera-events.index.tsx` to `SettingsPage.tsx`, `CameraEventDetailPage.tsx`, `client.ts`, `CameraEventsListPage.tsx`, `mock-client.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `getPushStore()` connect `getSessionConfig` to `push-store.ts`, `push-notify.ts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `CLAUDE.md Project Instructions` (e.g. with `AGENTS.md` and `Authentication & Security Doc`) actually correct?**
  _`CLAUDE.md Project Instructions` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `entrypoint.sh script`, `$schema`, `src/routes/**/\*.{ts,tsx}` to the rest of the system?\*\*
  _420 weakly-connected nodes found - possible documentation gaps or missing edges._
