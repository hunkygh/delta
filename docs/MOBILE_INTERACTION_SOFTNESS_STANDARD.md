Delta – Mobile Interaction Softness Standard
Version 1.0  
Purpose: Ensure mobile UX feels calm, smooth, and tactile, not harsh or brittle.

------------------------------------------------------------
I. WHY CLICKUP FEELS SOFT
------------------------------------------------------------

ClickUp’s mobile UI feels soft because of:

1. Muted background (not `#FFFFFF`)
2. Text contrast below 100% (no pure black)
3. Heavier font weights (500/600 used strategically)
4. Minimal borders (mostly separators, not boxes)
5. Slight elevation instead of outlines
6. Consistent directional motion
7. Touch-friendly spacing
8. Controlled accent usage

Softness is not blur or decoration.  
Softness = controlled contrast + restrained structure + tactile motion.

------------------------------------------------------------
II. BACKGROUND & CONTRAST RULES (MOBILE)
------------------------------------------------------------

- No pure white surfaces.
- Primary background should be near-white neutral.
- Text must not use `#000000`.
- Target ~85-92% contrast.

If UI feels sharp:
- Reduce contrast
- Increase weight
- Reduce border usage

------------------------------------------------------------
III. TOUCH INTERACTION PRINCIPLES
------------------------------------------------------------

Minimum tap target height:
- `44px` (absolute minimum)

Preferred:
- `48-56px` for primary actions

List rows:
- Minimum `48px` height

No cramped controls.

------------------------------------------------------------
IV. BORDER REDUCTION RULE
------------------------------------------------------------

On mobile:
- Avoid boxed sections.
- Avoid stacked containers.
- Use spacing + background shift.

Do not render:

Card  
  Card  
    Card

Nested card stacks create visual noise.

------------------------------------------------------------
V. INLINE EDITING PRINCIPLE
------------------------------------------------------------

Descriptions and notes:
- Must feel like typing into the page.
- No boxed textarea unless categorically required.
- Use underline or subtle focus background only.

------------------------------------------------------------
VI. ANIMATION SOFTNESS
------------------------------------------------------------

No instant structural appearance.

Use:
- Slide reveal
- `160-260ms` timing
- Consistent easing

Content should feel revealed, not dropped.

------------------------------------------------------------
VII. ACCENT DISCIPLINE (CRITICAL)
------------------------------------------------------------

Electric blue `#00C7FF` is a signal color, not a decoration color.

Accent must indicate:
- Primary action
- AI-triggered action
- Critical system interaction

Hard limits:
- Maximum 1 primary accent surface per view
- Maximum 2 accent elements visible simultaneously
- Accent must not repeat in a vertical list pattern
- Accent must not be used for hover/focus variations
- Accent must not be used for secondary buttons
- Accent must not be used for decorative icons
- Accent must not be used for section headers

Button hierarchy (mobile strict):
- Secondary and tertiary buttons are plain text by default.
- Secondary and tertiary buttons have no persistent fill or border.
- Secondary and tertiary hover/focus may use only a light gray fill.
- Close (`X`) buttons follow the same rule: plain text only, no persistent fill/border.
- Per screen/sheet, only one colored button is allowed, the primary action.

Screen-space rule:
- Accent should occupy less than ~3% of visible screen area in a typical view.
- If accent occupies more than that, it is overused.

Interaction rule:
- Accent must draw attention intentionally.
- If the eye does not clearly land on a single focal point, the accent system is broken.

Enforcement rule:
- If unsure whether to use blue, use grayscale.
- Only escalate to accent when removing it would reduce clarity of the primary action.

------------------------------------------------------------
VIII. TEXT WEIGHT DISTRIBUTION (MOBILE)
------------------------------------------------------------

- Titles: `600`
- Primary labels: `500`
- Secondary/meta: `400`

Never `400` everywhere.

------------------------------------------------------------
IX. SPACING SOFTNESS
------------------------------------------------------------

- 8px base grid.

Common spacing:
- 16px internal
- 24px section separation

Crowding increases perceived harshness.

------------------------------------------------------------
X. SOFTNESS TEST
------------------------------------------------------------

If UI feels sharp:
1. Is contrast too high?
2. Are there too many borders?
3. Is text too thin?
4. Is motion inconsistent?
5. Is accent overused?

Fix those before adding styling.
