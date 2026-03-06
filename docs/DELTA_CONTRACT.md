# DELTA_CONTRACT.md

## Naming Manifest (Canonical References)

| Concept | Canonical Name | Notes |
| ---| ---| --- |
| Life Area | Focal | Top-level container for projects/tasks/events |
| Project | Project | Optional grouping inside a Focal |
| Task | Task | Core actionable item, can be nested under Project or Focal |
| Subtask | Subtask | Nested under a Task |
| Time Block | TimeBlock | Scheduled event that can host Tasks/Subtasks |
| Launchpad | Launchpad | Main home interface with card-based quick access |
| Comment Thread | CommentThread | Persistent across Task recurrence, can toggle scope (Task / Project / Focal) |
| Recurrence | Recurrence | Rules for repeating TimeBlocks, Tasks, Subtasks |
| Journal Entry | JournalEntry | Optional Task type with comment integration for Docs |
| Doc | Doc | Editable rich-text document, AI-interactable |
| AI Chat | AIChat | Inline assistant, can read/write to CommentThreads, Docs, and Tasks |

## Purpose

The Delta Contract establishes the structural and build rules for the app. It serves as the single source of truth (SSOT) for AI builders and developers to:

1. Maintain design and modular construction integrity
2. Ensure environment consistency (cloud-only deployment)
3. Standardize naming, feature mapping, and hierarchy

## Core Principles

1. Modular Construction – All UI elements are built individually; no filler content or pre-populated demo data. Each component is created, styled, and positioned before wiring backend logic.
2. Architectural Purity – UI hierarchy mirrors feature hierarchy. Task -> Subtask -> TimeBlock -> Project -> Focal.
3. Environment – Fully cloud-deployed; no local instance. API interactions (e.g., Google Calendar) are sandboxed to prevent payload conflicts.
4. Design Consistency – Buttons, cards, and text follow strict sizing rules. The global shell (header strip + sidebar + content region) is mandatory across all routes. Design/motion precedence is:
   - `STRUCTURAL_&_MOTION_DESIGN_CONTRACT.md`
   - `UI_TONE_AND_VISUAL_SOFTNESS_STANDARD.md`
   - `MOBILE_INTERACTION_SOFTNESS_STANDARD.md`
   - `UX_UI_FEATURES_RULES.md`
   If supporting docs conflict, precedence docs win.
5. AI Integration – Inline AI can read/write to Comments, Docs, Tasks, Projects, and Focals. All actions respect modular construction rules.
6. Persistence – CommentThreads, Journals, and Recurrences are persistent and trackable across sessions and repeated instances.

## Shell Boundary Rules

1. The top header strip is a hard layout boundary and must exist on all pages.
2. Header strip acts as a control island, not primary navigation.
3. Sidebar is the primary navigation surface and always begins below the header strip.
4. All route content must render inside the shell content container, below the header and to the right of the sidebar.
5. Any new page/view that bypasses this shell is contract-invalid.

## AI Panel Rules (Current Baseline)

1. Ask Delta opens a right-anchored panel that does not overlap the header strip.
2. Desktop layout uses docked overlay behavior (content shifts to make room).
3. Smaller viewports use overlay behavior (content does not shift).
4. Panel remains non-blocking for navigation and workspace interaction.
5. Composer supports mode scaffolding:
   - `AI` mode (default): sends to AI endpoint.
   - `Memo` mode (scaffolded): reserved for Docs persistence path and must bypass AI endpoint once wired.
6. Voice mode is UI-first scaffolding in this phase (toggle/button only, no transcription pipeline yet).
7. Context tags are removable chip tokens in the composer rail; no global "Clear" control in chat composer.

## Modular Construction Rules

*   Step 1: Build global shell frame/container first. Example: Header strip boundary + Sidebar frame + content region. No feature content yet.
*   Step 2: Add individual elements one at a time: buttons, cards, fields. Confirm size, color, spacing, and alignment.
*   Step 3: Wire backend logic after UI structure is locked.
*   Step 4: Ensure compliance with naming manifest and design rules before progressing to next module.

## Environment Rules

*   Cloud-only deployment
*   Google Calendar API used for TimeBlocks/events; description field optional, supports markdown formatting but does not include nested tasks/subtasks
*   Comments, Journals, and Docs stored and managed internally
*   Inline AI operations respect scope and do not override environment constraints

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
