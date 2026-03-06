# COLOR TOKEN PROPOSAL

Proposal-only pass based on [`DESIGN_TOKEN_AUDIT.md`](/Users/hunkyg/Desktop/apps/Delta/docs/design/DESIGN_TOKEN_AUDIT.md) Step 2 inventory.
No code changes.

## 1) Proposed Reduced Semantic Color System

### BACKGROUNDS
Token: `--color-bg-page`  
Proposed value: `#FFFFFF`  
Reason: matches current direction (clean white canvas) and highest-frequency production value.  
Merge these current values: `#fbfcfe`, `#f9fafb`, `#fafafa`, `#f7f8fa`, `#edf2fd`, `#f8f9fc`  
Status: `KEEP`

Token: `--color-bg-subtle`  
Proposed value: `#F7F8FA`  
Reason: single neutral non-white background for hover/focus/state surfaces.  
Merge these current values: `#f5f5f5`, `#f2f4f7`, `#f3f4f6`, `#efeff1`  
Status: `MERGE`

Token: `--color-bg-muted`  
Proposed value: `#EDF2FD`  
Reason: keep one cool-tinted muted layer for selected/auxiliary states only, not structural page fill.  
Merge these current values: `#eef1f5`, `#eef2f6`, `#eef2f7`  
Status: `MERGE`

### SURFACES
Token: `--color-surface-card`  
Proposed value: `#FFFFFF`  
Reason: aligns with “cards white” directive and existing dominant card value.  
Merge these current values: all near-white card fills (`#fefeff`, `#fcfdff`, `#fafbfc`)  
Status: `KEEP`

Token: `--color-surface-panel`  
Proposed value: `#FFFFFF`  
Reason: simplify panel/card split; reduce visual noise.  
Merge these current values: `#f9fafb`, `#f7f8fa` when used as panel fill  
Status: `MERGE`

Token: `--color-surface-float`  
Proposed value: `#FFFFFF`  
Reason: drawers/popovers should stay neutral; depth should come from border/shadow, not tint shifts.  
Merge these current values: `#fbfcfe`, `#f8f9fc`  
Status: `MERGE`

### BORDERS
Token: `--color-border-subtle`  
Proposed value: `rgba(0, 0, 0, 0.06)`  
Reason: consistent hairline separators.  
Merge these current values: `#e9ecf1`, `#e8ebf0`, `#e6e8ec`, `#ececec`, `#eceef2`  
Status: `KEEP`

Token: `--color-border-default`  
Proposed value: `#E4E6EA`  
Reason: current stable neutral border in tokens and broad usage.  
Merge these current values: `#d8dbe2`, `#d4d4d8`, `#e5e7eb`, `#d1d5db`, `#e4e4e7`  
Status: `MERGE`

Token: `--color-border-focus`  
Proposed value: `#00C7FF`  
Reason: single accent border for focused/selected primary states.  
Merge these current values: `#00b7f4`, `rgba(0,199,255,0.88)`, `rgba(0,181,254,0.88)`  
Status: `MERGE`

### TEXT
Token: `--color-text-primary`  
Proposed value: `#27272A`  
Reason: most used high-contrast neutral; avoids true black.  
Merge these current values: `#222327`, `#2f343d`, `#2d323b`, `#1f2937`, `#111827`  
Status: `KEEP`

Token: `--color-text-secondary`  
Proposed value: `#52525B`  
Reason: clear hierarchy step below primary with strong readability.  
Merge these current values: `#3f3f46`, `#4b5563`, `#5f6874`, `#646b76`, `#6b7280`  
Status: `MERGE`

Token: `--color-text-muted`  
Proposed value: `#71717A`  
Reason: stable meta/placeholder tone.  
Merge these current values: `#9ca3af`, `#a1a1aa`, `#9ba2ad`, `#727985`, `#707680`  
Status: `MERGE`

Token: `--color-text-inverse`  
Proposed value: `#FFFFFF`  
Reason: required for accent/solid dark buttons and dark surfaces.  
Merge these current values: `#fff`, `#ffffff`  
Status: `KEEP`

### ACCENT / PRIMARY
Token: `--color-accent-primary`  
Proposed value: `#00C7FF`  
Reason: current logo-aligned blue and explicit product direction.  
Merge these current values: `#00b7f4`, `rgba(0,199,255,1)`  
Status: `KEEP`

Token: `--color-accent-hover`  
Proposed value: `#00B8EA`  
Reason: subtle darken for pressed/hover while keeping same hue family.  
Merge these current values: custom one-off hover blues  
Status: `MERGE`

Token: `--color-accent-pressed`  
Proposed value: `#00A9D6`  
Reason: single pressed state avoids random darker blue literals.  
Merge these current values: legacy darker accent variants  
Status: `MERGE`

Token: `--color-accent-tint`  
Proposed value: `rgba(0, 199, 255, 0.12)`  
Reason: selected/tint background for pills/chips/focus containers.  
Merge these current values: `rgba(0,199,255,0.22)`, `rgba(0,199,255,0.24)` and similar  
Status: `MERGE`

Token: `--color-focus-ring`  
Proposed value: `rgba(0, 199, 255, 0.42)`  
Reason: consistent accessible focus ring.  
Merge these current values: mixed `rgba(...0.34/0.5/0.88)` accent ring values  
Status: `MERGE`

### STATUS COLORS
Token: `--color-status-success`  
Proposed value: `#22C55E`  
Reason: already used in list/item status semantics.  
Merge these current values: green variants around `#10b981`, `#2f6a46`  
Status: `KEEP`

Token: `--color-status-warning`  
Proposed value: `#F59E0B`  
Reason: existing status color in board/list data.  
Merge these current values: warm amber/orange variants  
Status: `KEEP`

Token: `--color-status-danger`  
Proposed value: `#DC2626`  
Reason: present in production UI and stronger than `#ef4444` for readable warnings/errors.  
Merge these current values: `#ef4444`, `#e33939`, `#b91c1c`  
Status: `MERGE`

Token: `--color-status-info`  
Proposed value: `#94A3B8`  
Reason: currently used as neutral/open/todo status.  
Merge these current values: related slate grays used as pseudo-status color  
Status: `KEEP`

### GRADIENT / BRAND EXPERIMENTS
Token: `--gradient-brand-core`  
Proposed value: `linear-gradient(140deg, #3F71FF, #FF70CF)`  
Reason: appears as branded accent treatment but should not be structural UI fill.  
Merge these current values: `linear-gradient(135deg, #5558e3, #7c3aed)`, `linear-gradient(135deg, #6366f1, #8b5cf6)`  
Status: `EXPERIMENTAL`

Token: `--gradient-brand-soft`  
Proposed value: `radial-gradient(circle at 20% 25%, rgba(96,196,232,0.18), rgba(143,104,210,0.14))`  
Reason: useful for loading/ambient effects only.  
Merge these current values: other radial ambient backgrounds  
Status: `EXPERIMENTAL`

---

## 2) Major conflicts in current color system

1. Too many near-white values (`#ffffff`, `#fbfcfe`, `#f9fafb`, `#fafafa`, `#f7f8fa`, etc.).
2. Too many dark text values (`#27272a`, `#222327`, `#2d323b`, `#2f343d`, `#111827`, `#1f2937`, etc.).
3. Competing accent blues (`#00c7ff` vs `#00b7f4`, plus multiple rgba accent opacities).
4. Legacy indigo/purple/pink gradients still mixed into structural styles.
5. Harsh dark values and true black-adjacent values still appear in places (`#111111`, `#151515`, `#000000`).
6. Border system is fragmented across dozens of close neutrals (`#d8dbe2`, `#e4e6ea`, `#d4d4d8`, `#e5e7eb`, etc.).

---

## 3) Buckets

### A) CORE DELTA COLORS
- `#FFFFFF`
- `#F7F8FA`
- `#EDF2FD` (state-only)
- `#E4E6EA`
- `rgba(0,0,0,0.06)`
- `#27272A`
- `#52525B`
- `#71717A`
- `#00C7FF`
- `#22C55E`
- `#F59E0B`
- `#DC2626`
- `#94A3B8`

### B) LEGACY / TO REMOVE
- `#00b7f4`
- `#3b82f6`, `#2563eb`, and other old blue ramp literals
- one-off dark text variants (`#2d323b`, `#2f343d`, `#1f2937`, `#111827` in normal text roles)
- one-off neutral border variants (`#d8dbe2`, `#d1d5db`, `#e5e7eb`, `#d4d4d8`, etc.)
- scattered grayscale fills used as alternate card backgrounds

### C) EXPERIMENTAL / PLAYGROUND ONLY
- blue/pink/purple brand gradients (`linear-gradient(...#3F71FF...#FF70CF...)` family)
- ambient radial gradients for capture/AI visual effects
- accent glow stacks and decorative blue shadows

---

## 4) Final compact target size check

This proposal keeps the operational system small:
- Backgrounds: 3
- Surfaces: 3 (all white-based)
- Borders: 3
- Text: 4
- Accent states: 5
- Status colors: 4
- Brand/experimental gradients: 2

---

## 5) Recommended next implementation step

Next pass should be **code refactor only**:
1. Approve this token set first in Figma.
2. Replace legacy color literals with approved tokens component-by-component (or page-by-page), not one global uncontrolled sweep.
3. Do not apply gradients/experimental values to structural UI.
4. Keep a deprecation list and remove old values as each component is migrated.

