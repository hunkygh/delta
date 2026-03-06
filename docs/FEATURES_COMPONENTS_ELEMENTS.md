# FEATURES_COMPONENTS_ELEMENTS.md

## Naming Manifest (Canonical References)

| Concept | Canonical Name | Notes |
| ---| ---| --- |
| Focal | Focal | Area of focus grouping; top-level organizational unit |
| Project | Project | Collection of Tasks within a Focal |
| Task | Task | Individual actionable item; can belong to Project or Focal |
| Subtask | Subtask | Nested action within a Task |
| TimeBlock | TimeBlock | Scheduled block of time; can contain Tasks |
| CommentThread | CommentThread | Thread attached to Task, Project, or Focal |
| Doc | Doc | Rich text or structured document; can pull in comments |
| LaunchpadCard | LaunchpadCard | Quick-access summary card for Tasks, Docs, Projects |
| Event | Event | Calendar item, singular or recurring |
| AIInline | AIInline | Agentic inline chat element for context-aware actions |
| RecurrenceRule | RecurrenceRule | Rules defining repeating behavior for Tasks or TimeBlocks |
| FilterToggle | FilterToggle | UI control to filter LaunchpadCards by Focal/Project |
| SidebarNav | SidebarNav | Icon-only left navigation panel; links to Docs, Tasks, Calendar, etc. |
| ControlStrip | ControlStrip | Dark gray horizontal strip at top; contains calendar snapshot, search, AI button |
| AppShell | AppShell | Global layout shell enforcing header boundary + sidebar + routed content |
| AIPanel | AIPanel | Right-docked AI workspace panel opened from Ask Delta |

## Overview

This document defines the core features, components, and elemental units of Delta. Each feature maps to UI elements, backend logic, recurrence behavior, and API integration. All naming is canonical and consistent across UX, animation, and contract documentation.

## Feature Breakdown

### Focals

*   Top-level area of focus (e.g., Work, Health, Relationships).
*   Contains Projects and standalone Tasks.
*   Serves as a filter scope in Launchpad and SidebarNav.

### Projects

*   Optional grouping within Focals.
*   Contains Tasks and Subtasks.
*   Supports CommentThreads scoped to Project-level or Task-level.
*   Can feed comments into Docs or Reports via AIInline.

### Tasks & Subtasks

*   Individual action items.
*   Tasks can be assigned to Projects or directly to Focals.
*   Subtasks inherit context from parent Task.
*   Persistent CommentThreads for each recurrence.
*   Custom labels per Focal (e.g., Workout → Lift, Sales → Lead).

### TimeBlocks & Events

*   Scheduled time allocation; singular or recurring.
*   Can attach Tasks directly or via Project association.
*   Supports RecurrenceRules with fresh instance rendering; completed vs uncompleted tasks show appropriately.
*   Sync with Google Calendar; API payload limited to description, duration, start/end time.
*   UI shows nested Tasks within TimeBlock; external calendars show summarized description only.

### CommentThread

*   Attached to Task, Project, or Focal.
*   Supports nested journaling, AIInline suggestions, and project updates.
*   Persist across recurring instances; comments can be pulled into Docs.
*   Tab/slider pill to switch context: Task | Project | Focal.

### Docs

*   Rich text documents; hybrid between Notion and Google Docs.
*   Can pull inline quotes from CommentThreads.
*   Supports structured formatting via TipTap or similar editor.
*   Hierarchical organization in LaunchpadCards; expandable inline editing.

### LaunchpadCards

*   Quick-access overview of Tasks, Docs, Projects, Events.
*   Minimalistic header with title-link control and Expand/Add controls; lists content inline.
*   Expand/Add controls are hidden by default and fade in on card hover/focus.
*   Supports FilterToggle for Focal/Project visibility.
*   Design follows spacing, font, and color rules from design contract.

### SidebarNav

*   Icon-only navigation panel on the left side.
*   Contains Delta logo at top, navigation icons below.
*   Anchors all top-level navigation: Docs, Tasks, Calendar, Projects, Bookmarks, Resources, Settings.
*   Consistent width (64px) and spacing across desktop/mobile.
*   Starts below Control Strip, not full viewport height.

### ControlStrip

*   Dark gray (#202020) horizontal strip at top of page, full width.
*   Contains four elements: logo, calendar snapshot block, centered search bar, Ask Delta button.
*   Height tokenized via `--header-height-sm` and treated as hard boundary for page layouts.
*   Calendar snapshot: shows "calendar snapshot" text with calendar icon.
*   Search bar: global search with icon and `Search` placeholder.
*   Ask Delta button: single-accent primary intent button using `#00C7FF` / `rgba(0, 199, 255, 1)` with white icon/text.
*   Replaces traditional page headers; navigation remains in SidebarNav.

### AppShell

*   Required root layout for routed pages.
*   Enforces fixed ControlStrip top boundary and SidebarNav offset.
*   Hosts all route content within shell-scoped main container.
*   Owns AI open/close state to keep behavior consistent across pages.

### AIPanel

*   Opens from Ask Delta in ControlStrip.
*   Right-anchored, full-height (with edge spacing), rounded container.
*   Must not intrude into ControlStrip boundary.
*   Desktop: docked overlay pattern that shifts main content.
*   Smaller viewports: overlay-only pattern (no content shift).
*   Initial placeholder layout: centered `AI chat goes here` plus close button.

### AIInline

*   Agentic chat embedded contextually.
*   Can add comments, suggest tasks, or modify content inline.
*   Reads CommentThreads, summaries, and metadata to generate recommendations.

### Filters & Toggles

*   FilterToggle: dynamically show/hide LaunchpadCards per Focal or Project.
*   Maintains visual spacing even when fewer cards are present.
*   Avoids clutter; cards remain modular and proportional.

### Recurrence & Refresh

*   RecurrenceRules define repeated Tasks and TimeBlocks.
*   RecurrenceRefresh animation applies fade/slide for new instances.
*   Completed or skipped tasks do not accumulate visually; fresh rendering each cycle.

## Component Mapping to Backend

*   Focal → Focals table/API endpoint.
*   Project → Projects table/API endpoint.
*   Task → Tasks table/API endpoint.
*   Subtask → Subtasks table/API endpoint.
*   TimeBlock/Event → CalendarEvents table/API endpoint.
*   CommentThread → Comments table/API endpoint.
*   Doc → Docs table/API endpoint.
*   AIInline → AgentSession/API endpoint.
*   FilterToggle/SidebarNav → Frontend-only UI controls, mapped to canonical names.
*   AppShell/AIPanel/ControlStrip state → Frontend layout orchestration layer.

## Modular Design Principles

*   Build components individually; no filler content.
*   Each element references canonical name.
*   Reuse styling and spacing rules from `UX_UI_FEATURES_RULES.md` (**Authoritative Design Contract (SSOT)**).
*   Supports independent animations per ANIMATION\_INTERACTION\_RULES.md.

## Notes

*   All terminology matches canonical names to avoid drift across contract, UX/UI, and animations.
*   Updates to one feature/component must propagate through all related docs and build guides.
*   Serves as master reference for Codex/Cascade to construct Delta in modular fashion.
