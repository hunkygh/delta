Delta UI Tone & Visual Softness Standard

Version 1.0
Purpose: Eliminate harshness. Enforce calm, controlled visual tone.

⸻

1. The Core Problem

Harsh UI is caused by stacking these factors:
	•	Pure white backgrounds (#FFFFFF)
	•	True black text (#000000)
	•	Excessively thin typography (400 everywhere)
	•	Overuse of borders
	•	High-contrast dividers
	•	Inconsistent animation
	•	Accent color overuse

Soft UI is not achieved through blur or heavy styling.
It is achieved through controlled contrast, weight distribution, and restraint.

⸻

2. Background Rules (No Pure White)

Never use pure white for the main app background.

Use near-white neutral tones:

Recommended:
	•	#F7F8FA
	•	#F5F6F8

Why:
Pure white + dark gray text creates glare and sharpness.
Slightly muted backgrounds reduce visual fatigue and increase perceived polish.

⸻

3. Text Contrast Rules (No True Black)

Never use #000000 for body text.

Primary text:
	•	#1F1F1F to #2A2A2A

Secondary text:
	•	#6B6F76
	•	#8C9096

Muted/meta:
	•	#A0A4AA range

Target effective contrast:
85–92%, not 100%.

True black on near white = brittle.

⸻

4. Typography Weight Distribution

Do NOT default to 400 for everything.

Use structured hierarchy:
	•	Section titles → 600
	•	Primary body → 500
	•	Secondary → 400
	•	Meta → 400 + reduced contrast

Thin 400 text on high contrast background feels fragile.

500 weight dramatically improves perceived solidity.

⸻

5. Border Discipline

Harsh UI often comes from too many borders.

Allowed:
	•	1px subtle row dividers (very low contrast)
	•	Single outer container where categorically required

Avoid:
	•	Nested card borders
	•	Stacked outlined containers
	•	Dark divider lines
	•	Boxed textareas

Replace borders with:
	•	Spacing
	•	Background contrast blocks
	•	Elevation (subtle shadow only when necessary)

⸻

6. Divider Rules

Row separators should be extremely subtle.

Recommended:
	•	rgba(0,0,0,0.06) to rgba(0,0,0,0.08)

Never:
	•	rgba(0,0,0,0.2)+
	•	Full dark gray lines

Dividers should barely be noticed.

⸻

7. Elevation > Outlines

ClickUp feels soft because it uses:
	•	Slight background shifts
	•	Gentle shadow
	•	Minimal outlines

If hierarchy can be expressed via background and spacing,
do not use borders.

⸻

8. Accent Color Discipline (#00B7F4)

Electric blue must be rare.

Use ONLY for:
	•	Primary CTA
	•	AI trigger buttons
	•	Selected active state indicator

Never:
	•	Blue hover variants
	•	Blue section backgrounds
	•	Blue text for secondary UI

All hover/focus states should be grayscale shifts only.

⸻

9. Animation Tone

Harshness is amplified by:
	•	Instant pop-ins
	•	Inconsistent slide/fade combos
	•	Abrupt state changes

Standard:
	•	Directional slide
	•	Consistent easing (cubic-bezier(0.22, 1, 0.36, 1))
	•	No bounce
	•	No random opacity-only transitions

Movement should feel architectural, not decorative.

⸻

10. Density & Spacing

Softness is also achieved through breathing room.

Minimum vertical rhythm:
	•	8px base grid
	•	16px common vertical spacing
	•	24px for major section separation

Do not compress spacing to “fit more.”

Crowding = visual aggression.

⸻

11. Tone Goal

Delta should feel:
	•	Calm
	•	Neutral
	•	Structural
	•	Intentional
	•	Slightly muted
	•	Never glossy
	•	Never loud

Complexity should live in data, not in visuals.

⸻

12. Anti-Drift Rule

If the UI feels sharp:
	•	Reduce contrast
	•	Remove borders
	•	Increase text weight
	•	Reduce accent usage
	•	Increase whitespace

Never add styling to compensate.
