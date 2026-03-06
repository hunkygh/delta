# DESIGN TOKEN IMPLEMENTATION NOTES

## Canonical token file
The canonical design token source is now:
- [`src/styles/design-tokens.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/design-tokens.css)

It currently defines semantic:
- color tokens
- shadow tokens
- experimental gradient tokens (playground only)

## Migration status
Components are **not migrated yet** in this pass.
No component styles or TSX usage was refactored.

## Next migration passes (component-by-component)
1. Buttons
2. Inputs
3. Cards
4. List rows
5. Panels / drawers
6. Sidebar / navigation
7. Remaining pages

## Critical warning
Do not do a global uncontrolled literal replacement across the app.
Migrate token usage incrementally per component/page with visual QA after each pass.
