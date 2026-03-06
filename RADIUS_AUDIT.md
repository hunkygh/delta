# Radius Audit

Scope: inventory of direct radius usage (`border-radius`, inline `borderRadius`, and `rounded-*` usage).  
Note: this is an audit only; no mappings were applied in code.

| File Path | Line Snippet (short) | Value Used | Suggested Token Mapping |
|---|---|---|---|
| `src/styles/global.css` | `border-radius: 8px;` / `border-radius: 12px;` / `border-radius: 999px;` | `0`, `2px`, `4px`, `5px`, `6px`, `7px`, `8px`, `9px`, `10px`, `11px`, `12px`, `15px`, `16px`, `18px`, `24px`, `48px`, `50%`, `999px`, `var(--radius-sm)`, `var(--radius-md)`, mixed side-specific values | `--r-xs` for 2–7px, `--r-sm` for 8–11px, `--r-md` for 12–16px, `--r-lg` for 18px, `--r-xl` for 24px, `--r-full` for 50%/999px/48px pill; keep `0` as-is |
| `src/pages/ListView.css` | `border-radius: 10px;` / `border-radius: 14px;` | `4px`, `6px`, `7px`, `8px`, `10px`, `12px`, `14px`, `50%`, `999px` | `--r-xs` for 4–7px, `--r-sm` for 8–10px, `--r-md` for 12–14px, `--r-full` for 50%/999px |
| `src/styles/components.css` | `border-radius: var(--delta-radius-md);` | `var(--delta-radius-md)`, `var(--delta-radius-lg)`, `var(--delta-radius-xl)` | migrate to `var(--r-sm)`, `var(--r-md)`, `var(--r-xl)` based on component intent |
| `src/components/Auth/Login.css` | `border-radius: 12px;` | `6px`, `12px` | `--r-xs` (small controls), `--r-md` (card/input blocks) |
| `src/components/ErrorBoundary.jsx` | `borderRadius: '8px'` | `'4px'`, `'8px'` (inline style) | `--r-xs`/`--r-sm` via CSS class tokens (avoid inline ad-hoc) |
| `src/components/FocalBoard/ActionList.css` | `border-radius: 999px;` | `4px`, `6px`, `8px`, `999px` | `--r-xs`, `--r-sm`, `--r-full` |
| `src/components/FocalBoard/FocalBoard.css` | `border-radius: 12px;` | `0`, `4px`, `8px`, `12px`, `999px`, `inherit` | `--r-xs`, `--r-sm`, `--r-md`, `--r-full`; keep `0`/`inherit` when required |
| `src/components/FocalBoard/ItemList.css` | `border-radius: 50%;` | `0`, `4px`, `6px`, `8px`, `50%`, `999px` | `--r-xs`, `--r-sm`, `--r-full`; keep `0` when required |
| `src/components/FocalBoard/LaneList.css` | `border-radius: 10px;` | `7px`, `8px`, `10px`, `12px`, `999px` | `--r-xs`, `--r-sm`, `--r-md`, `--r-full` |
| `src/components/FocalBoard/StatusSelect.css` | `border-radius: 50%;` | `6px`, `7px`, `10px`, `50%`, `999px` | `--r-xs`, `--r-sm`, `--r-full` |
| `src/components/ProposalReviewTable.css` | `border-radius: 10px;` | `8px`, `10px` | `--r-sm` (table wrappers), `--r-md` (primary review container if needed) |
| `src/components/UI/InlineInput.css` | `border-radius: 8px;` | `6px`, `8px` | `--r-xs`/`--r-sm` |
| `src/components/Sidebar-broken-design.tsx` | `className=\"... rounded-md ...\"` | `rounded-md` | map to blessed token alias only (recommended `--r-xs` equivalent); no new ad-hoc rounded classes |
| `src/components/Sidebar.tsx` | `className={\`rounded-triangle ...\`}` | `rounded-triangle` (custom class name) | N/A token mapping (not a Tailwind radius utility) |
| `docs/UX_UI_FEATURES_RULES.md` | `Ask Delta is a rounded-rectangle button` | descriptive radius language only | align wording to token usage (`--r-*`) |
