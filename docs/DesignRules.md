# Design Rules

- Contract precedence:
  1. `STRUCTURAL_&_MOTION_DESIGN_CONTRACT.md`
  2. `UI_TONE_AND_VISUAL_SOFTNESS_STANDARD.md`
  3. `MOBILE_INTERACTION_SOFTNESS_STANDARD.md`
  4. `UX_UI_FEATURES_RULES.md` section **Authoritative Design Contract (SSOT)**
- Global app shell is mandatory: fixed top control strip + left sidebar + routed content region.
- The top control strip is a hard boundary across all pages.
- Page body background uses pure white (`#FFFFFF`); cards/panels/drawers use white surfaces only.
- Text uses near-black by default (not pure `#000000`).
- Cards are neutral with subtle borders/shadows and low-noise hover states.
- **Primary accent color**: `#00C7FF` / `rgba(0, 199, 255, 1)`.
- Accent is reserved for primary intent buttons (for example Ask Delta / AI triggers), very limited primary CTAs, and minimal brand/logo usage only.
- No accent-derived fills, no accent hover backgrounds, and no accent tonal ramp expansion.
- **Border radius tokens**: Use canonical tokens from `UX_UI_FEATURES_RULES.md` (`--r-xs`, `--r-sm`, `--r-md`, `--r-lg`, `--r-xl`, `--r-full`). No new ad-hoc radius values.
- Ask Delta button uses the primary accent color with subtle hover brightness/glow while preserving the same hue.
- Focus and hover states are grayscale-only and low-noise.
- Selection/active row fills use very light neutral gray (no accent tint).
- Border hierarchy: avoid nested borders; one border per structural layer; use separators/spacing for child rows.
- Spacing follows an 8px rhythm.
- **Sidebar**: Collapsible sidebar with icons that show text labels when expanded. Icons should be smaller (16px) and positioned to allow text expansion.
- **Use-case agnostic**: No specific domain terminology (e.g., "Global Payments", "Health & Fitness") in the scaffolding.
