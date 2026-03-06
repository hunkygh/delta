UI Tone & Visual Softness Standard
Version 1.1
Authoritative Tone & Visual Control Contract

Purpose:
Ensure Delta feels calm, controlled, minimal, and premium, never harsh, brittle, or loud.

------------------------------------------------------------
1. Core Principle
------------------------------------------------------------

Softness is not decoration.
Softness is controlled contrast + restrained structure + disciplined color use.

Harsh UI is caused by:
- Pure white backgrounds
- True black text
- Thin typography everywhere
- Too many borders
- High-contrast dividers
- Accent overuse
- Inconsistent motion

Soft UI is achieved by restraint.

------------------------------------------------------------
2. Background Rules (No Pure White)
------------------------------------------------------------

Never use pure white (`#FFFFFF`) for primary app backgrounds.

Approved background range:
- `#F7F8FA`
- `#F5F6F8`
- Very subtle neutral near-white only

Why:
Pure white + dark gray text creates glare and sharpness.
Near-white softens perceived contrast.

------------------------------------------------------------
3. Text Contrast Rules (No True Black)
------------------------------------------------------------

Never use `#000000` for text.

Primary text:
- `#1F1F1F` to `#2A2A2A`

Secondary text:
- `#6B6F76` to `#8C9096`

Muted/meta:
- `#A0A4AA` range

Target effective contrast:
`85-92%`, not `100%`.

True black on near white feels brittle.

------------------------------------------------------------
4. Typography Weight Distribution
------------------------------------------------------------

Do not default to weight 400 for everything.

Standard distribution:
- Major titles -> 600
- Section titles -> 600
- Primary body -> 500
- Secondary -> 400
- Meta -> 400 with reduced contrast

Thin text + high contrast = fragile feeling.

Weight 500 significantly improves perceived quality.

------------------------------------------------------------
5. Border Discipline
------------------------------------------------------------

Borders are a last resort, not a layout strategy.

Allowed:
- Single outer container where structurally required
- 1px very low-contrast row dividers
- Minimal elevation (subtle shadow)

Avoid:
- Card inside card inside card
- Nested bordered containers
- Dark divider lines
- Boxed textareas
- Visible input boxes for simple inline editing

Replace borders with:
- Spacing
- Background tone differences
- Subtle elevation only when necessary

------------------------------------------------------------
6. Divider Rules
------------------------------------------------------------

Dividers must be barely visible.

Recommended:
- `rgba(0,0,0,0.06)`
- `rgba(0,0,0,0.08)`

Never exceed:
- `rgba(0,0,0,0.12)`

Dividers should support structure, not dominate it.

------------------------------------------------------------
7. Elevation > Outlines
------------------------------------------------------------

Hierarchy should prefer:
- Slight background shifts
- Very subtle shadow
- Clean spacing

Over:
- Outlined boxes
- Heavy borders
- Thick separators

If spacing and background can express hierarchy,
do not use borders.

------------------------------------------------------------
8. Accent Discipline (Strict)
------------------------------------------------------------

Primary accent:
`#00C7FF`

Accent is a signal color, not a decoration color.

Accent may only indicate:
- Primary CTA
- AI-triggered action
- Critical system interaction

Hard limits:
- Maximum 1 primary accent surface per view
- Maximum 2 accent elements visible simultaneously
- Accent must not repeat in vertical list patterns
- Accent must not be used for hover variations
- Accent must not be used for decorative icons
- Accent must not be used for section headers
- Accent must not be used for secondary UI

Screen-space rule:

Accent should occupy less than ~3% of visible screen area.

If accent occupies more than that,
it is overused.

Enforcement rule:

If unsure:
Use grayscale.

Escalate to accent only when removing it would reduce clarity of the primary action.

Button hierarchy (strict):
- Secondary and tertiary buttons are always plain text by default.
- Secondary and tertiary buttons never use persistent fill, border, or accent color.
- Secondary and tertiary hover/focus state may use only a light gray background fill.
- Close buttons (including `X`) follow the same plain-text rule and never use persistent fill or border.
- Per surface (screen, modal, drawer, popover), only one colored button is allowed: the primary action.

------------------------------------------------------------
9. Animation Tone
------------------------------------------------------------

Motion must reinforce calmness.

Use:
- Directional slide
- Consistent easing (`cubic-bezier(0.22, 1, 0.36, 1)`)
- Controlled duration (`160-260ms`)

Avoid:
- Instant structural appearance
- Bounce
- Mixed animation styles
- Fade-only structural surfaces

Content should feel revealed, not dropped.

------------------------------------------------------------
10. Spacing & Density
------------------------------------------------------------

Use 8px base grid.

Common spacing:
- 16px internal
- 24px section separation
- 32px major separation

Do not compress spacing for density.

Crowding increases perceived harshness.

------------------------------------------------------------
11. Softness Diagnostic Checklist
------------------------------------------------------------

If the UI feels harsh, check:
1. Is background too white?
2. Is text too close to black?
3. Is text weight too thin?
4. Are there too many borders?
5. Are dividers too dark?
6. Is accent overused?
7. Is animation inconsistent?
8. Is spacing too tight?

Fix those before adding styling.

------------------------------------------------------------
12. Tone Goal
------------------------------------------------------------

Delta should feel:
- Calm
- Neutral
- Structured
- Intentional
- Slightly muted
- Premium without gloss
- Intelligent without noise

Complexity belongs in the data model, not in the visuals.

------------------------------------------------------------
13. Event Editor Surface Rules
------------------------------------------------------------

Event create/edit surfaces (desktop drawer, mobile sheet) follow a strict structure:
- One continuous editor surface. Avoid nested cards and stacked boxed groups.
- Top priority row order:
  1. Title
  2. Time/date
  3. Repeat summary
  4. Contents summary
  5. Notes summary
- Advanced controls are progressively disclosed and hidden by default.
- Section grouping uses spacing + hairline separators, not heavy containers.

Action hierarchy inside event editor surfaces:
- Exactly one filled primary action (`Add` or `Save`) per surface.
- All other actions (`Cancel`, `Close`, `Remove`, helper controls) are plain text/icon.
- Non-primary actions use grayscale hover/focus fill only.
