---
target: Camera Details page layout and visuals
total_score: 22
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: 'file:/Users/blc/Documents/Git/camera-events-v2/src/routes/_authenticated/camera-events.$id.tsx'
target_fingerprint: 'sha256:ee3b5090d64d1bb8602a3fbe6014a5a17458f972d8ab672beee5834ed9e698ac'
target_path: /Users/blc/Documents/Git/camera-events-v2/src/routes/_authenticated/camera-events.$id.tsx
timestamp: 2026-11-01T10-09-50Z
slug: src-routes-authenticated-camera-events-id-tsx
---

# Critique: event detail page (/camera-events/$id), 22/40 Acceptable

Method: dual-agent (A: design review · B: detector + Playwright)

Heuristics: 1 Status 2 (Pending copy says "checking" after polling stops, :139) · 2 Real world 2 (raw snake_case zones, Frigate/disk/confidence jargon) · 3 Control 3 · 4 Consistency 2 (downloads look like data rows; no summary chevron; native checkbox) · 5 Error prevention 3 · 6 Recognition 2 (icon-only heart/share) · 7 Efficiency 2 (no prev/next in burst, no jump to live) · 8 Minimalist 2 (duplicate camera, Clip:None, confidence bar) · 9 Recovery 2 ("Event not found" for every error :245; Ghost is generic) · 10 Help 2.

Specificity: glass system applied faithfully, but the layout is a generic record-detail template; no burst context, "nothing since" or live link. Detector: source 0 findings; in-page desktop 5-7 nested-cards (tiles = false positives; clip <details> :331 = real), mobile 0. Muted contrast 6.2-6.7:1.

Priority issues:
- [P1] Clip is not the hero: it sits in a collapsible <details> below the snapshot, has no poster and lands below the fold. Fix: clip first with snapshot as poster, snapshot as fallback, drop the accordion. (layout)
- [P1] Error/Ghost states: "Event not found" for every error; no Ghost state; Pending never becomes Ghost; copy names Frigate. Fix: separate titles, re-check at the deadline, plain copy. (harden, clarify)
- [P2] Downloads disguised as metadata: button wraps dt/dd (InfoCard.tsx:40-48). Fix: explicit download actions near the media; drop "Clip: None". (distill)
- [P2] Raw/duplicate metadata: snake_case zones, duplicate camera row, confidence bar in the action colour. Fix: format zones, drop the camera row, show confidence as a chip. (distill)
- [P2] Icon-only top actions; share sheet has a native checkbox, no event context, unannounced "Sent". Fix: labels, house checkbox, sheet header with event. (clarify, adapt)

Personas: Casey: actions at the top, small play control, no swipe through the burst, back link costs about 120 px. Sam: invalid dl, Pending resolution not announced, formatRelativeTime reads Date.now() during render (SSR rule). Danish family member: "Registreringssikkerhed", English zone codes, Frigate in copy, no "Se live".

Minor: media not edge to edge (double gutter); generic app-name eyebrow on error cards; tall empty clip-error pane on desktop; English sub_label from Frigate; ShareButton icon swap after mount.
Questions: Why is the clip in a drawer? Should the page say "Live now" / "Nothing since"? Does the family use confidence, zones or downloads at all?
