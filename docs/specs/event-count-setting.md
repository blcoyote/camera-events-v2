# Spec: Event Count Setting

## Intent Description

The settings page is currently a placeholder. This feature adds the first real control: a range slider that lets users choose how many camera events are displayed on the Camera Events list page (20–100, default 20). The chosen value persists in `localStorage` via the `useLocalStorage` hook from the `usehooks-ts` library so it survives page refreshes and browser restarts. The Camera Events route reads this value and passes it as the `limit` parameter to `getEvents`, replacing the current hard-coded limit of 50.

## User-Facing Behavior

```gherkin
Feature: Event count setting
  Users can control how many events appear on the Camera Events page
  via a slider on the Settings page. The value persists in localStorage.

  Background:
    Given the user is authenticated

  Scenario: Default value when no preference is saved
    Given no event count preference exists in localStorage
    When the user navigates to the Settings page
    Then the slider displays a value of 20

  Scenario: User adjusts the slider
    Given the user is on the Settings page
    When the user drags the slider to 60
    Then the slider displays a value of 60
    And the value 60 is persisted to localStorage

  Scenario: Saved value is reflected on Settings page reload
    Given the user previously set the slider to 80
    When the user navigates to the Settings page
    Then the slider displays a value of 80

  Scenario: Events page respects the saved limit
    Given the user has set the event count to 40
    When the user navigates to the Camera Events page
    Then the events API is called with limit=40

  Scenario: Events page uses default when no preference is saved
    Given no event count preference exists in localStorage
    When the user navigates to the Camera Events page
    Then the events API is called with limit=20

  Scenario: Slider enforces minimum bound
    Given the user is on the Settings page
    Then the slider cannot be set below 20

  Scenario: Slider enforces maximum bound
    Given the user is on the Settings page
    Then the slider cannot be set above 100

  Scenario: Slider is accessible via keyboard
    Given the user focuses the slider with the keyboard
    When the user presses arrow keys
    Then the slider value changes
    And the new value is announced to screen readers
```

## Architecture Specification

**Components:**

| Component | Change |
|-----------|--------|
| `package.json` | **Modify** — add `usehooks-ts` dependency |
| `src/hooks/useEventLimit.ts` | **New** — shared hook wrapping `useLocalStorage('event-limit', 20)` |
| `src/pages/settings/SettingsPage.tsx` | **Modify** — add Event Count slider section using `useEventLimit` |
| `src/routes/_authenticated/camera-events.index.tsx` | **Modify** — read limit from route search params (default 20), pass to `loadEvents` |

**Design:**

- **`src/hooks/useEventLimit.ts`** — thin wrapper around `useLocalStorage<number>('event-limit', 20)` from `usehooks-ts`. Shared between the settings page (writes) and events page (reads). Exports the hook plus the `EVENT_LIMIT_KEY`, `DEFAULT_EVENT_LIMIT`, `MIN_EVENT_LIMIT`, and `MAX_EVENT_LIMIT` constants.

- **Settings page** — adds a labeled `<input type="range">` with `min=20`, `max=100`, `step=10`. Displays the current numeric value beside the slider. Uses `useEventLimit()` for state.

- **Camera Events route** — the route's `search` schema validates an optional `limit` param (number, default 20). The loader passes this to `loadEvents`. On the client, when navigating to camera events, the limit from localStorage is included as a search param via the `Link` component or programmatic navigation.

**What is NOT in scope:**
- Per-camera event limits
- Server-side persistence of the setting
- Debouncing the slider (localStorage writes are cheap)
- Changing the events grid layout based on count

**Constraints:**
- One new npm dependency: `usehooks-ts`
- Slider must be accessible (proper `aria-label`, keyboard operable)
- SSR-safe: no `window` access during server rendering

## Acceptance Criteria

| # | Criterion | Pass condition |
|---|-----------|----------------|
| 1 | Slider renders on Settings page | Range input visible with min=20, max=100, default=20 |
| 2 | Value persists to localStorage | Changing slider writes to `localStorage` key `event-limit` |
| 3 | Value survives page reload | Reloading settings page shows previously saved value |
| 4 | Events page uses saved limit | `getEvents` is called with the saved limit value |
| 5 | Default limit is 20 | Without a saved preference, events load with limit=20 |
| 6 | Slider has proper labels | Accessible name, current value visible to users and screen readers |
| 7 | Tests pass | `tsc --noEmit` clean, all unit tests pass |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior has a corresponding BDD scenario
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
