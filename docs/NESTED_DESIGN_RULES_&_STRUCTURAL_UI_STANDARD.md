Nested Design Rules & Structural UI Standard
Version 1.0 - Authoritative Design Constraint Document

## 1. Core Principle

Progressive disclosure over visual nesting.

Hierarchy in Delta is expressed through:
- Spacing
- Typography weight
- Alignment
- Interaction

Hierarchy is not expressed through:
- Nested bordered containers
- Card-within-card stacking
- Heavy shadow layering
- Box-based hierarchy

If something is configuration, it must be layered and temporary, not permanently nested into the visible structure.

## 2. Surface Roles

Delta UI consists of three distinct surface types. These must not be blended.

### A. Execution Surface

Examples: Calendar main view, active time block view.

Purpose:
Surface what the user should be doing right now.

Rules:
- Minimal borders
- No nested bento layouts
- No configuration UI visible by default
- Flat layout with clean spacing
- Dividers allowed only for row separation

### B. Configuration Surface

Examples: Event drawer, floating panel, overlay editor.

Purpose:
Adjust rules, settings, mappings, recurrence, linking.

Rules:
- Layered above execution surface
- Temporary
- Opened via inline text buttons
- No permanent card stacks
- No nested configuration blocks
- Close cleanly when finished

Configuration must never permanently reshape the execution surface.

### C. Persistent Content Surface

Examples: Lists, item detail view, comment threads.

Purpose:
Store durable information.

Rules:
- Rows separated by hairline dividers
- No unnecessary bordered text areas
- Inline editing preferred
- Content should feel like typing directly into the page

## 3. Border & Container Rules

Allowed:
- Single outer container when categorically required
- 1px subtle dividers between rows
- Subtle background contrast for grouping

Not allowed:
- Card inside card inside card
- Bordered containers used solely to imply hierarchy
- Stacked shadow layers
- Nested bento layouts for configuration
- Bordered textareas for descriptions

## 4. Text Entry Rules

Text input should feel native and embedded in the page.

Description / notes behavior:
- Default state: borderless
- Click to edit inline
- Focus state may show subtle underline or background tint
- No persistent bordered textarea

The user should feel like they are typing into the document, not into a form field.

## 5. Color System Constraints

Primary accent color:
- `#00C7FF` (`rgba(0, 199, 255, 1)`)

Blue is reserved for:
- Primary CTA buttons
- AI trigger buttons
- Brand accents

Everything else:
- Grayscale only
- Dark gray buttons (not pure black)
- Very light gray hover states
- No lighter/darker blue hover variants

Hover changes must affect lightness, not hue.

## 6. Nesting Depth Limit

Maximum visible nesting depth: 2 levels.

Acceptable:
- Section
- Row
- Expandable region

Not acceptable:
- Card
- Card
- Card
- Form

If more than two visible structural layers are present, the design violates this standard.

## 7. Interaction Rules

Opening configuration:
- Triggered via inline text button
- Opens drawer, popover, or floating panel
- Never permanently embedded as a nested block

Editing:
- Click to edit
- Inline first
- Avoid full-page form transitions

## 8. Structural Preference Hierarchy

When multiple solutions are possible, prefer:
- Flatter layout
- Fewer containers
- Inline editing
- Spacing over borders
- Typography over boxes
- Hidden configuration over persistent structure

## 9. Anti-Drift Enforcement

If visual grouping can be achieved through spacing and typography, do not use borders.

If content can be inline editable, do not render a bordered textarea.

Do not introduce additional shadow layers unless explicitly instructed.

Do not add cards or boxed containers unless the feature is categorically separate from the surrounding content.

## 10. Design Philosophy Anchor

Delta prioritizes:
- Execution clarity
- Context persistence
- Minimal friction
- Invisible structure
- Clean surfaces

The interface must feel calm, deliberate, and light, even when handling complex logic.

Complexity should exist in the data model, not in the visual hierarchy.
