# UX_UI_FEATURES_RULES.md

## Purpose

This document is the UX/UI SSOT for Delta. It defines the mandatory layout system, visual language, interaction behavior, and modular build order. Future edits must preserve this baseline unless explicitly superseded in this file.

## Design Standards Precedence

Use this precedence order for design interpretation:
1. `STRUCTURAL_&_MOTION_DESIGN_CONTRACT.md`
2. `UI_TONE_AND_VISUAL_SOFTNESS_STANDARD.md`
3. `MOBILE_INTERACTION_SOFTNESS_STANDARD.md`
4. `UX_UI_FEATURES_RULES.md` (this document)
5. Supporting docs (`ANIMATION_INTERACTION_RULES.md`, `DesignRules.md`, etc.)

## Authoritative Design Contract (SSOT)

This section is the authoritative visual contract. If other docs conflict, this section wins.

### 1) Grayscale-first System

1. Desktop page background is pure white: `#FFFFFF`.
2. Mobile background uses near-white neutral (not pure `#FFFFFF`).
3. Surfaces, cards, drawers, and panels use neutral grayscale backgrounds only.
4. No tinted or colored surface backgrounds are allowed.
5. Primary text uses near-black (not pure `#000000`).
6. Secondary and muted text use neutral gray.
7. Selection and active row fills use very light neutral gray only.
8. Hover and focus states must remain grayscale-only:
   - opacity shift
   - light gray fill
   - neutral border contrast
9. No hue-shift hover or focus behavior is allowed.

### 2) Single Accent Discipline

1. Accent color is fixed:
   - HEX: `#00C7FF`
   - RGBA: `rgba(0, 199, 255, 1)`
2. Accent use is reserved strictly for:
   - primary intent buttons (for example Ask Delta / AI trigger buttons)
   - very limited primary CTAs
   - optional minimal brand/logo usage
3. Accent-derived background fills are not allowed.
4. Accent-based hover backgrounds are not allowed.
5. No tonal ramp expansion is allowed (no blue-50/100/200 style palettes).
6. Primary button hover may only use subtle brightness/glow while preserving the same accent hue.
7. Hard mobile/compact limits:
   - maximum 1 primary accent surface per view
   - maximum 2 accent elements visible simultaneously
   - accent should not exceed ~3% visible screen area

### 3) Border and Hierarchy Discipline

1. Avoid nested borders.
2. One border per structural layer.
3. If a container has a border, child rows must use separators and spacing, not boxed borders.
4. Borders are allowed only for:
   - top-level containers (cards, drawers, panels)
   - popovers and menus
   - explicit mode changes (for example editing state)
5. Nested items (actions/sub-actions) must use indentation and spacing, not rectangles.

### 4) Border Radius Tokens

Canonical radius tokens are locked:

- `--r-xs: 6px`
- `--r-sm: 10px`
- `--r-md: 14px`
- `--r-lg: 18px`
- `--r-xl: 24px`
- `--r-full: 9999px`

Mapping rules:

1. Primary and standard buttons use `--r-md`.
2. Icon buttons, tiny controls, and chips use `--r-sm` (or `--r-xs` only when truly tiny).
3. Inputs, selects, and textareas use `--r-sm`.
4. Popovers, tooltips, and menus use `--r-md`.
5. Cards, large panels, drawers, and modals use `--r-lg`.
6. Selected row highlights use grayscale fill only; if rounded, use `--r-md`.

### 5) Guardrails

1. No new ad-hoc radius values are allowed.
2. Allowed forms are:
   - `border-radius: var(--r-*)`
   - Tailwind radius classes only if explicitly mapped 1:1 to these tokens.
3. Do not introduce one-off values such as `12px`, `13px`, or arbitrary bracket classes.
4. Migration policy:
   - New work must use `--r-*` tokens.
   - Existing ad-hoc values are migrated incrementally in dedicated passes.

## Canonical Layout Contract

1. Delta uses a global shell on all pages.
2. The top header strip is a hard boundary and must always render across routes.
3. Header strip is not primary navigation; sidebar is primary navigation.
4. Sidebar starts below the header strip and remains icon-first.
5. Page content renders inside the shell content area, below header and right of sidebar.

## Header Strip Contract

1. Header strip color: `#202020`.
2. Header strip height token: `--header-height-sm` (current baseline: `40px`).
3. Header controls use compact shared height token `--header-block-height` (current baseline: `27px`).
4. Header control order:
   - Left: logo
   - Middle: calendar snapshot
   - Middle: search field
   - Right: Ask Delta button
5. Search placeholder text baseline: `Search`.

## Ask Delta Contract

1. Ask Delta is a rounded-rectangle button (not pill).
2. Ask Delta uses the single accent color `#00C7FF` (`rgba(0, 199, 255, 1)`).
3. Button icon/text:
   - Atom icon (white)
   - Compact icon-first treatment is valid.
4. Open behavior:
   - Opens right-side AI panel.
   - Panel must not overlap header strip.
   - Panel keeps detached edge spacing and rounded corners.
   - Panel keeps minimal style (no heavy shadow).
5. Panel baseline state:
   - Chat fills the panel body (no nested inner card).
   - Message rail is the only scroll container.
   - Composer is pinned to bottom with:
     - context chips row
     - voice mode button (UI scaffold)
     - AI/Memo toggle (Memo path scaffolded for Docs write, not fully wired in this phase)

## AI Panel Docking Rules

1. Desktop behavior: docked overlay hybrid.
   - Panel opens on right.
   - Main content shifts left to make room.
2. Mobile/smaller view behavior:
   - Panel remains overlay.
   - Main content does not shift.
3. Docked panel remains non-modal so app navigation is still usable.

## Launchpad Card Contract

1. Card baseline:
   - White surface
   - Light border
   - Subtle shadow
2. Header:
   - Compact title row
   - Title + up-right arrow shown as one control
   - Hover underline on title control
3. Expand/Add action buttons:
   - Hidden by default in non-fullscreen state
   - Reveal only on card hover/focus-within
   - Fast fade-in (no hard pop)
4. Expanded (fullscreen) card:
   - Centered in viewport
   - Small outside margin preserved for click-out close
   - Header strip inside expanded card uses `#f1f1f1`

## Visual Language

1. Body background: `#FFFFFF`.
2. Card/panel/drawer background: white only.
3. Default text: near-black (not pure `#000000`).
4. Secondary text: neutral gray.
5. Selection/active rows: very light neutral gray (no accent tint).
6. Hover/focus states: grayscale only.
7. Font family baseline: Roboto.
8. Spacing rhythm baseline: 8px scale.

## Modular Construction Rules

1. Build shell boundaries first: header strip, sidebar, content container.
2. Add feature frames next: cards, panels, control rows.
3. Add interactions after frame geometry is stable.
4. Backend wiring follows UI lock-in.
5. New components must map to this shell model; no route may bypass the global header boundary.

## Non-Regression Rules

1. Do not replace global header strip with page-local headers.
2. Do not convert Ask Delta into a pure modal that blocks app navigation by default.
3. Do not reintroduce always-visible launchpad add/expand controls.
4. Do not move sidebar above header boundary.

## UI Copy Suppression Contract (Mandatory)

1. No instructional copy.
2. No helper text.
3. No onboarding text.
4. No placeholder paragraphs.
5. No headings unless structurally required.
6. Only the components explicitly described.
7. If a label is not specified, do not invent one.
8. No marketing tone.
9. No explanatory text.
