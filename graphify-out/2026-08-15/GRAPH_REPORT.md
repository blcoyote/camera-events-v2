# Graph Report - camera-events-v2 (2026-08-15)

## Corpus Check

- 310 files · ~133,844 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 1260 nodes · 2229 edges · 141 communities (64 shown, 77 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output (graphify's own counter — no Gemini key was set, so semantic extraction ran through ~14 Claude Code subagents instead; those consumed roughly 600K+ tokens total but that spend isn't captured by this counter, only by the host session's own usage tracking). AST extraction (1030 of 1260 nodes) is deterministic and genuinely free.

## Community Hubs (Navigation)

- Settings & Event Loading
- Camera Event Detail Components
- Event Detail Page Tests
- Media Proxy Routes
- Favorites Server Logic
- TanStack Router Setup
- Beads Issue Tracking & Docs
- Loading Skeletons
- Session Refresh Hook
- Service Worker Push Handlers
- TypeScript & Lint Config
- Frigate Types & Bounding Box
- Mock Frigate Client
- Push API Handlers
- Pull-to-Refresh Mechanics
- MQTT Cache Integration Tests
- Session Cookie & TTL
- Push Batching Env Config
- Knip Unused-Code Config
- OAuth State & Session Auth
- Architecture Overview Docs
- Feature Split Specs
- Dependency Advisory Audit Script
- Mock Frigate Data Generators
- Package Dependencies List
- Cameras Page & Downloads
- List Page Tests
- Event Batcher Class
- Push Notification Formatting
- Push & Session Decision Records
- NPM Scripts
- Apple Push Throttling
- Notification Settings UI
- Frigate Client Tests
- OAuth Crypto & Subscribe Route
- MQTT Cache Invalidation Spec
- Frigate MQTT Topics & Config
- CI Build & PR Workflows
- PWA Manifest Config
- Storybook Stories
- Google OAuth Parsing
- Push Subscription Resync
- Notification Opt-Out Preferences
- Push Subscription Storage
- Dev Dependencies
- Frigate Camera Names
- Lint-Staged Config
- Camera Snapshot Proxy
- Push Store Driver
- MQTT Broker Startup
- Push Dispatch Pipeline
- Test Auth Guard
- Mock Camera Events Data
- EventCard Component Tests
- Web Push Type Defs
- Camera Reorder E2E Test
- Burst Notification Dedup Logic
- Vite Config & SW Plugin
- Git Hook: applypatch-msg
- Git Hook: commit-msg
- Git Hook: post-applypatch
- Git Hook: post-commit
- Git Hook: post-rewrite
- Git Hook: pre-applypatch
- Git Hook: pre-auto-gc
- Git Hook: pre-merge-commit
- Git Hook: pre-rebase
- Push Payload Format
- Bun Bundle Verification Script
- Git Hook: post-checkout
- Git Hook: post-merge
- Git Hook: pre-commit
- Git Hook: pre-push
- Git Hook: prepare-commit-msg
- dnd-kit Core Dependency
- dnd-kit Modifiers Dependency
- dnd-kit Sortable Dependency
- dnd-kit Utilities Dependency
- Obsidian Vault Decision
- PR Workflow & Husky Docs
- Storybook Stories (Alerts/Home)
- Header Storybook Decorator
- Docker Entrypoint Script
- Husky Dependency
- jsdom Dependency
- lint-staged Dependency
- Nitro Dependency
- MQTT.js Dependency
- React Dependency
- React DOM Dependency
- Serwist Dependency
- Tailwind Vite Plugin Dependency
- TanStack React Devtools Dependency
- TanStack React Start Dependency
- TanStack Router Plugin Dependency
- web-push Dependency
- Knip Dependency
- Playwright Dependency
- Prettier Dependency
- Serwist Build Dependency
- Tailwind Typography Dependency
- TanStack Devtools Vite Dependency
- TanStack ESLint Config Dependency
- Testing Library DOM Dependency
- Testing Library Jest-DOM Dependency
- Testing Library React Dependency
- better-sqlite3 Types Dependency
- Node Types Dependency
- React Types Dependency
- React DOM Types Dependency
- TypeScript Dependency
- Vite React Plugin Dependency
- Vitest Dependency
- Vitest Browser Dependency
- Vitest Browser Playwright Dependency
- Vitest Coverage Dependency
- Prettier Config File
- Robots.txt Crawling Policy
- SQLite Driver Decision
- Feature Slice Concept
- tsr Generate Gotcha
- Pull-to-Refresh Spec Doc
- Camera Rearrange Spec Doc
- Web Push Spec Doc
- Apple Touch Icon Asset
- Favicon Asset
- PWA Icon 192px
- PWA Icon 512px
- Maskable Icon 192px
- Maskable Icon 512px
- Camera Illustration Asset
- Mock Snapshot Placeholder

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
- `CLAUDE.md Project Instructions` --shares_data_with--> `Deployment & Environment Doc` [INFERRED]
  CLAUDE.md → docs/claude/deployment.md
- `CLAUDE.md Project Instructions` --shares_data_with--> `PWA, SSR & Tailwind Doc` [INFERRED]
  CLAUDE.md → docs/claude/pwa-ssr.md
- `Object Tracking (person, min_score 0.75)` --conceptually_related_to--> `parseFrigateEvent Function` [INFERRED]
  frigate/sample.config.yml → docs/specs/mqtt-push-notifications.md
- `Copilot Agent Onboarding Instructions` --conceptually_related_to--> `CLAUDE.md Project Instructions` [INFERRED]
  .github/copilot-instructions.md → CLAUDE.md

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **TanStack Start's Four Environment Primitives** — claude_skills_tanstack_start_boundaries_skill_createserverfn, claude_skills_tanstack_start_boundaries_skill_createserveronlyfn, claude_skills_tanstack_start_boundaries_skill_createclientonlyfn, claude_skills_tanstack_start_boundaries_skill_createisomorphicfn [EXTRACTED 1.00]
- **CI Check to Image Build to Release Promotion Pipeline** — github_workflows_pr_docker_build, github_workflows_build_image_build_and_push, github_workflows_promote_release_promote_to_test, github_workflows_promote_release_promote_to_prod [EXTRACTED 1.00]
- **Red-Green-Refactor Discipline Mandated Across Docs** — claude_skills_test_driven_development_skill_doc, claude_doc, docs_claude_testing_doc, agents_doc [INFERRED 0.85]
- **MQTT Event Processing Pipeline** — docs_specs_mqtt_cache_invalidation_onfrigatemessage, docs_specs_mqtt_push_notifications_parsefrigateevent, docs_specs_mqtt_push_notifications_eventbatcher, docs_specs_mqtt_push_notifications_notifyusersforcamera [EXTRACTED 1.00]
- **Camera Drag-and-Drop Reorder Feature** — docs_specs_rearrange_cameras_on_feed_cameraspage, docs_specs_rearrange_cameras_on_feed_sortablecamerasgrid, docs_specs_rearrange_cameras_on_feed_sortablecameratile, docs_specs_rearrange_cameras_on_feed_dndkit, docs_specs_rearrange_cameras_on_feed_usecameraorder [EXTRACTED 1.00]
- **Web Push Subscription Infrastructure** — docs_specs_web_push_notifications_vapid_config, docs_specs_web_push_notifications_push_subscription_api, docs_specs_web_push_notifications_pushstore, docs_specs_web_push_notifications_webpush_lib, docs_specs_web_push_notifications_sw_push_handler [EXTRACTED 1.00]
- **Burst-Based Notification Dedup Pattern** — docs_specs_camera_motion_notification_dedup_event_batcher, docs_specs_camera_motion_notification_dedup_plan_notification, docs_specs_camera_motion_notification_dedup_send_throttle [INFERRED 0.85]
- **Favorite Toggle Persistence Pattern** — docs_specs_event_favorites_slice_1_favorite_button, docs_specs_event_favorites_slice_1_favorites_store, docs_specs_event_favorites_slice_1_event_favorites_table [INFERRED 0.85]
- **Camera Events Feature Split Sequence (1→2→3)** — docs_specs_feature_split_1_extract_shared_foundations, docs_specs_feature_split_2_extract_favorites_feature, docs_specs_feature_split_3_extract_camera_details_feature [EXTRACTED 1.00]
- **Camera Event Detail Page Evolution Across Specs** — docs_specs_feature_split_3_extract_camera_details_feature, docs_specs_mobile_event_detail_redesign, docs_specs_inline_event_clip_playback [INFERRED 0.75]
- **Defense-in-Depth Input Validation Before Frigate URL Construction** — docs_memory_decisions_2026_04_14_frigate_api_client_frigate_api_client, docs_memory_decisions_2026_04_14_server_function_authentication_server_function_authentication, docs_memory_decisions_2026_04_14_frigate_api_client_client_ts [INFERRED 0.75]
- **iOS/Android Cross-Platform PWA Constraint Cluster** — docs_memory_decisions_2026_04_17_cross_platform_pwa_first_cross_platform_pwa_constraint, docs_memory_gotchas_ios_ignores_silent_and_renotify_ios_silent_renotify_gotcha, docs_memory_decisions_2026_08_02_alert_once_per_burst_then_patch_alert_once_per_burst, docs_memory_gotchas_push_subscription_desync_push_subscription_desync, docs_memory_gotchas_ssr_hydration_browser_globals_ssr_hydration_gotcha [INFERRED 0.75]

## Communities (141 total, 77 thin omitted)

### Community 0 - "Settings & Event Loading"

Cohesion: 0.05
Nodes (51): loadEventsFn, getSettingsContent(), paletteOptions, pillClass(), SettingsPage(), mockSetEventLimit, mockSetPalette, mockSetTheme (+43 more)

### Community 1 - "Camera Event Detail Components"

Cohesion: 0.07
Nodes (37): EventClipPlayer(), EventSnapshot(), InfoCard(), clampTranslation(), distance(), IDENTITY, midpoint(), SnapshotLightbox() (+29 more)

### Community 2 - "Event Detail Page Tests"

Cohesion: 0.06
Nodes (33): makeEvent(), mockEventClipPlayer, mockEventSnapshot, mockFavoriteButton, mockSnapshotLightbox, mockToggle, mockUseFavoriteToggle, successResult() (+25 more)

### Community 3 - "Media Proxy Routes"

Cohesion: 0.09
Nodes (39): handleClipRequest(), mockFetchStream(), streamFrom(), handleSnapshotRequest(), handleThumbnailRequest(), getUserFavoritedEventIdsHandler(), getUserFavoritedEventsHandler(), toggleFavoriteHandler() (+31 more)

### Community 4 - "Favorites Server Logic"

Cohesion: 0.07
Nodes (34): getMqttConnectionState(), mockGetEvent, mockRequireSession, mockRetainEvent, mockUnretainEvent, createFavoritesStore(), FavoritesStore, checkDatabase() (+26 more)

### Community 5 - "TanStack Router Setup"

Cohesion: 0.05
Nodes (44): getRouter(), Register, @tanstack/react-router, Route, Route, Route, Route, Route (+36 more)

### Community 6 - "Beads Issue Tracking & Docs"

Cohesion: 0.08
Nodes (41): Beads Config (.beads/config.yaml), bd CLI, Beads Issue Tracker, Beads README, Dolt Database, CLAUDE.md Project Instructions, EventBatcher Burst Detection, Feature-Sliced Architecture (+33 more)

### Community 7 - "Loading Skeletons"

Cohesion: 0.09
Nodes (26): loadEventFn, CameraEventsLoading(), CamerasLoading(), FavoritesLoading(), PullToRefreshIndicator(), SkeletonCard(), getScrollTop(), Options (+18 more)

### Community 8 - "Session Refresh Hook"

Cohesion: 0.09
Nodes (26): isStandalone(), needsSessionRefresh(), SESSION_EXPIRY_REFRESH_WINDOW_MS, SESSION_LAST_REFRESH_KEY, SESSION_REFRESH_MIN_INTERVAL_MS, SESSION_REFRESH_THRESHOLD_MS, t0, useSessionRefresh() (+18 more)

### Community 9 - "Service Worker Push Handlers"

Cohesion: 0.10
Nodes (30): Clients, ExtendableEvent, ExtendableMessageEvent, NotificationEvent, buildNotificationBody(), buildNotificationOptions(), DEFAULT_PAYLOAD, formatLocalTime() (+22 more)

### Community 10 - "TypeScript & Lint Config"

Cohesion: 0.07
Nodes (27): DOM, DOM.Iterable, ES2022, eslint.config.js, prettier.config.js, **/\*.ts, **/\*.tsx, vite/client (+19 more)

### Community 11 - "Frigate Types & Bounding Box"

Cohesion: 0.08
Nodes (24): isNonZeroBox(), BoundingBox, FrigateCameraConfig, FrigateCameraStats, FrigateCpuUsage, FrigateDetectorStats, FrigateEventData, FrigateEventSummary (+16 more)

### Community 12 - "Mock Frigate Client"

Cohesion: 0.11
Nodes (21): BoundingBox, generateCameraConfig(), getCameras(), getConfig(), getEventClipStream(), getEventSnapshot(), getEventThumbnail(), getLatestSnapshot() (+13 more)

### Community 13 - "Push API Handlers"

Cohesion: 0.22
Nodes (17): getVapidPublicKey(), handleGetPreferences(), HandlerResult, handleSetPreference(), handleSubscribe(), handleTest(), handleUnsubscribe(), handleVapidPublicKey() (+9 more)

### Community 14 - "Pull-to-Refresh Mechanics"

Cohesion: 0.10
Nodes (21): Pull Activation Threshold (80px default), camera-events.index.tsx Route Integration, cameras.tsx Route Integration, iOS Native Pull-to-Refresh Conflict, overscroll-behavior-y: contain, PullToRefreshIndicator Component, touchmove preventDefault Technique, usePullToRefresh Hook (+13 more)

### Community 15 - "MQTT Cache Integration Tests"

Cohesion: 0.13
Nodes (10): handlers, mockClient, mockEnd, mockSubscribe, CACHE_MAX_ENTRIES, CACHE_TTL_MS, CacheEntry, clearFrigateCache() (+2 more)

### Community 16 - "Session Cookie & TTL"

Cohesion: 0.19
Nodes (8): SESSION_CONFIG_BASE, SESSION_COOKIE_NAME, SessionData, SESSION_MAX_AGE_SECONDS, getAuthRedirect(), Route, getHomeRedirect(), Route

### Community 17 - "Push Batching Env Config"

Cohesion: 0.16
Nodes (14): BatcherConfig, Env, parseDurationMs(), resolveAppleUpdateIntervalMs(), resolveBatcherConfig(), dispatchBatch(), eventBatcher, MqttConnectionState (+6 more)

### Community 18 - "Knip Unused-Code Config"

Cohesion: 0.11
Nodes (17): entry, ignoreBinaries, ignoreDependencies, project, $schema, only-allow, src/router.tsx, src/routes/\*_/_.{ts,tsx} (+9 more)

### Community 19 - "OAuth State & Session Auth"

Cohesion: 0.24
Nodes (13): buildOAuthState(), getCurrentUserFn, OAUTH_SCOPES, OAUTH_STATE_COOKIE_NAME, OAUTH_STATE_COOKIE_OPTIONS, redirectTo(), resolveUserFromSession(), sanitizeReturnTo() (+5 more)

### Community 20 - "Architecture Overview Docs"

Cohesion: 0.18
Nodes (16): Frigate HTTP API Surface, MQTT to Push Notification Pipeline, System Overview, Theming System, Frigate client.ts, Frigate Single-Client, Cache, Mock, Validation Decision, frigateCache (TtlCache), Arctic OAuth Library (+8 more)

### Community 21 - "Feature Split Specs"

Cohesion: 0.18
Nodes (17): Feature Split 1: Extract Shared Foundations, Feature Split 2: Extract Favorites Feature, Feature Split 3: Extract Camera-Details Feature, Refetch on Focus / Notification Tap, useRefetchOnFocus Hook, Frigate API Client (Read Operations), FrigateResult<T> Discriminated Union, Google OAuth Production Mode with Email Allowlist (+9 more)

### Community 22 - "Dependency Advisory Audit Script"

Cohesion: 0.16
Nodes (15): Advisory, COLOR, fetchAdvisories(), FetchResult, Finding, formatFinding(), InstalledPackage, main() (+7 more)

### Community 23 - "Mock Frigate Data Generators"

Cohesion: 0.23
Nodes (17): generateEvent(), generateReview(), generateTimelineEntry(), getEvent(), getEvents(), getEventSummary(), getReviewByEvent(), getReviews() (+9 more)

### Community 24 - "Package Dependencies List"

Cohesion: 0.13
Nodes (15): arctic, lucide-react, dependencies, arctic, lucide-react, tailwindcss, @tanstack/react-router, @tanstack/react-router-devtools (+7 more)

### Community 25 - "Cameras Page & Downloads"

Cohesion: 0.18
Nodes (15): Cameras Page Route, Camera Snapshot Proxy Route, Event Limit SSR Fix, iOS Standalone Download Fix, Clip Proxy Route, Clip/Snapshot Download Links, useEventLimit Hook, event_favorites SQLite Table (+7 more)

### Community 26 - "List Page Tests"

Cohesion: 0.17
Nodes (7): mockEventCard, FavoritesPage(), getUserFavoritedEventsFn, FrigateEvent, favoritesLoader(), MOCK_EVENTS, mockGetUserFavoritedEventsFn

### Community 27 - "Event Batcher Class"

Cohesion: 0.18
Nodes (4): EventBatcher, FlushCallback, FlushMeta, FrigateEventInfo

### Community 28 - "Push Notification Formatting"

Cohesion: 0.28
Nodes (11): appleUpdateThrottle, buildCameraPayload(), cameraNotificationTag(), endpointHost(), formatCameraName(), formatLabel(), formatTime(), notifyUsersForCamera() (+3 more)

### Community 29 - "Push & Session Decision Records"

Cohesion: 0.20
Nodes (14): Cross-Platform PWA Constraint, Login Allow-list in Google Cloud, Session Lifetime & Proactive Refresh, Alert Once Per Burst, Then Patch, Event, Event Batching, Frigate, Review (+6 more)

### Community 30 - "NPM Scripts"

Cohesion: 0.14
Nodes (14): scripts, audit:advisories, build, check, dev, format, knip, lint (+6 more)

### Community 31 - "Apple Push Throttling"

Cohesion: 0.21
Nodes (6): originals, TUNABLES, NotifyOptions, shouldSendToEndpoint(), isAppleEndpoint(), SendThrottle

### Community 32 - "Notification Settings UI"

Cohesion: 0.24
Nodes (9): CameraPref, CameraPreferences(), formatCameraName(), NotificationSection(), NotificationSettings(), formatSubscribeError(), urlBase64ToUint8Array(), usePushSubscription() (+1 more)

### Community 33 - "Frigate Client Tests"

Cohesion: 0.17
Nodes (4): MOCK_EVENT, MOCK_REVIEW, FrigateReview, FrigateReviewSummary

### Community 34 - "OAuth Crypto & Subscribe Route"

Cohesion: 0.31
Nodes (7): decryptOAuthState(), deriveKey(), encryptOAuthState(), getSessionConfig(), Route, Route, Route

### Community 35 - "MQTT Cache Invalidation Spec"

Cohesion: 0.22
Nodes (10): clearFrigateCache Function, src/server/mqtt.ts Module, onFrigateMessage Handler, MQTT Event-Driven Cache Invalidation Spec, FrigateEventInfo Type, parseFrigateEvent Function, MQTT-Driven Push Notifications with Per-Camera Opt-Out Spec, clearCache Server Function (+2 more)

### Community 36 - "Frigate MQTT Topics & Config"

Cohesion: 0.22
Nodes (10): frigate/events MQTT Topic, frigate/reviews MQTT Topic, SUBSCRIBED_TOPICS Constant, Birdseye Continuous Mode, Coral EdgeTPU Detector, ffmpeg Global/Input/Hwaccel Args, Frigate sample.config.yml, Frigate MQTT Config Block (+2 more)

### Community 37 - "CI Build & PR Workflows"

Cohesion: 0.29
Nodes (10): build-and-push job (build-image.yml), Build & Push Docker Image Workflow, changes job (pr.yml), code_quality job (pr.yml), PR Checks Workflow, docker_build job (pr.yml), tests job (pr.yml), Promote Image to Release Workflow (+2 more)

### Community 38 - "PWA Manifest Config"

Cohesion: 0.20
Nodes (9): background_color, display, icons, name, orientation, scope, short_name, start_url (+1 more)

### Community 39 - "Storybook Stories"

Cohesion: 0.22
Nodes (9): CameraEventDetailPage.stories.tsx, CameraEventsListPage.stories.tsx, CamerasPage.stories.tsx, Footer.stories.tsx, src/stories/ Placeholder Files, ServiceWorkerRegistration (excluded from stories), SettingsPage.stories.tsx, Storybook Stories for All Components and Pages Spec (+1 more)

### Community 40 - "Google OAuth Parsing"

Cohesion: 0.56
Nodes (6): parseOAuthState(), getAppOrigin(), getGoogleProvider(), parseIdTokenClaims(), validateIdTokenClaims(), Route

### Community 41 - "Push Subscription Resync"

Cohesion: 0.44
Nodes (4): resyncExistingPushSubscription(), resyncSubscription(), ServiceWorkerRegistration(), resyncMock

### Community 42 - "Notification Opt-Out Preferences"

Cohesion: 0.29
Nodes (7): Opt-Out Default Preference Model, Preferences API (GET/PUT /api/push/preferences), push_notification_preferences Table Usage, Per-Camera Toggle Settings UI, push_notification_preferences Table, Settings Notifications Section, Camera: gavl_vest

### Community 43 - "Push Subscription Storage"

Cohesion: 0.33
Nodes (7): Push Subscription API Endpoints, push_subscriptions Table, Subscription Storage (push-store.ts), usePushSubscription Hook, VAPID Key Config, GET /api/push/vapid-public-key, web-push Library Integration

### Community 44 - "Dev Dependencies"

Cohesion: 0.29
Nodes (7): eslint, devDependencies, better-sqlite3, eslint, vite, better-sqlite3, vite

### Community 45 - "Frigate Camera Names"

Cohesion: 0.29
Nodes (7): Camera: garage, Camera: gavl_oest, Camera: have, Camera: koekken, Camera: stuen, Camera: vaerksted, go2rtc RTSP Restream Config

### Community 46 - "Lint-Staged Config"

Cohesion: 0.29
Nodes (6): imports, lint-staged, \*.{js,jsx,ts,tsx,md,json,css,yml,yaml}, name, private, type

### Community 48 - "Push Store Driver"

Cohesion: 0.60
Nodes (3): createPushStore(), PushStore, PushSubscriptionRow

### Community 49 - "MQTT Broker Startup"

Cohesion: 0.40
Nodes (5): MQTT_URL Environment Variable, MQTT.js v5 Library, Nitro MQTT Startup Plugin, RabbitMQ MQTT Broker, startMqttSubscriber Function

### Community 50 - "Push Dispatch Pipeline"

Cohesion: 0.40
Nodes (5): EventBatcher Class, notifyUsersForCamera Function, Per-Camera 10-Second Batching Window, Preference Store (push-store.ts, extended), sendPushNotification Wrapper

### Community 52 - "Mock Camera Events Data"

Cohesion: 0.60
Nodes (3): CameraEvent, findEventById(), PLACEHOLDER_EVENTS

### Community 53 - "EventCard Component Tests"

Cohesion: 0.40
Nodes (3): mockFavoriteButton, mockToggle, mockUseFavoriteToggle

### Community 54 - "Web Push Type Defs"

Cohesion: 0.40
Nodes (4): PushSubscription, SendResult, web-push, WebPush

### Community 56 - "Burst Notification Dedup Logic"

Cohesion: 0.83
Nodes (4): EventBatcher Leading-Edge Flush, planNotification Merge Logic, SendThrottle Apple Pacing, Notification Tag/Renotify Fix (F3)

### Community 67 - "Push Payload Format"

Cohesion: 0.67
Nodes (3): Push Payload Format (title/body/url), Service Worker Push/NotificationClick Handler, URL Field Forward Compatibility

## Ambiguous Edges - Review These

- `EventBatcher (fixed-window description)` → `EventBatcher Burst Detection` [AMBIGUOUS]
  docs/claude/backend.md · relation: semantically_similar_to
- `Feature Split 3: Extract Camera-Details Feature` → `Mobile Event Detail Redesign` [AMBIGUOUS]
  docs/specs/mobile-event-detail-redesign.md · relation: conceptually_related_to

## Knowledge Gaps

- **372 isolated node(s):** `entrypoint.sh script`, `$schema`, `src/routes/**/*.{ts,tsx}`, `src/router.tsx`, `src/server.ts` (+367 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **77 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `EventBatcher (fixed-window description)` and `EventBatcher Burst Detection`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `Feature Split 3: Extract Camera-Details Feature` and `Mobile Event Detail Redesign`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `FrigateEvent` connect `List Page Tests` to `Settings & Event Loading`, `Camera Event Detail Components`, `Event Detail Page Tests`, `Media Proxy Routes`, `Frigate Client Tests`, `Loading Skeletons`, `Frigate Types & Bounding Box`, `Mock Frigate Client`, `EventCard Component Tests`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `FrigateResult` connect `Event Detail Page Tests` to `Settings & Event Loading`, `Camera Event Detail Components`, `Media Proxy Routes`, `Loading Skeletons`, `Mock Frigate Client`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `getPushStore()` connect `Push API Handlers` to `Push Store Driver`, `Push Notification Formatting`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `CLAUDE.md Project Instructions` (e.g. with `AGENTS.md` and `Authentication & Security Doc`) actually correct?**
  _`CLAUDE.md Project Instructions` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `entrypoint.sh script`, `$schema`, `src/routes/**/\*.{ts,tsx}` to the rest of the system?\*\*
  _372 weakly-connected nodes found - possible documentation gaps or missing edges._
