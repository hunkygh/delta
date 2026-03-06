# Overview

**Purpose:**

*   Centralized brain-dump → execution system for daily life, time blocking, tasks, and subtasks.
*   Google Calendar is the single source of truth for time-blocked events.
*   ClickUp is optional, only used for project/task grouping or “reference data” like meal plans, workouts, etc.
*   Primary goal: fast, semantically intelligent organization of thoughts into actionable blocks.

**Core Principles:**

*   Calendar-first execution. Tasks in ClickUp only if explicitly requested.
*   Flexible, hierarchical tasks and subtasks embedded inside time-blocks.
*   Minimal reliance on external tooling beyond Google Calendar API.
*   Clean, uncluttered UX — consistent spacing, sizing, and hierarchy.

# Design Rules

**1\. Global Layout Rules**

*   **Background:** Always pure white (#FFFFFF). No exceptions for cards, modals, pages, or sections.
*   **Text color:** Default black (#000000) for all text unless inside a colored button.
*   **Spacing & hierarchy:** Use consistent spacing units (e.g., 8px grid). Define vertical rhythm for headings, text, and cards.
*   **Containers & cards:** Transparent fill only; no pastel or colored fills for cards. Borders optional but minimal (#E0E0E0 or similar).

**2\. Typography**

*   **Headings:** H1-H6 with exact font sizes & weights; maintain spacing above and below.
*   **Body text:** Consistent line height and font size for readability.
*   **Button text:** Maintain same font as body, bold where needed.

**3\. Buttons & Interactive Elements**

*   **Default state:** Clear, no shadow unless functional, primary buttons colored, secondary buttons outlined.
*   **Hover/focus states:**
*       *   Slight elevation or border color change only.
    *   **Never** drastically different color. For example, a blue button should stay blue; on hover, maybe darken 5–10% or add subtle shadow.
    *   Focus outline: thin border or subtle shadow; do not invert colors.
*   *   **Sizing:** Buttons must match ClickUp dimensions on mobile & desktop. Maintain padding consistency inside buttons.

**4\. Cards**

*   White background, black text.
*   Border optional; no colored fill.
*   Hover state: subtle elevation or border darken.
*   Always consistent padding & margin.

**5\. Forms & Inputs**

*   White background, black text, single-color border (#E0E0E0 or darker for focus).
*   Placeholder text: dark gray (#888888).
*   Hover/focus: subtle shadow or border color change.

**6\. Icons**

*   Black by default; color only if semantic (e.g., red for error, green for success).
*   Hover/focus: slightly darker or lighter variant if necessary; no fill change unless functional.

**7\. Focus & Accessibility**

*   Every interactive element has a visible focus state (border, shadow, or slight brightness adjustment).
*   Keyboard navigation fully functional; tab order logical.
*   All color combinations pass contrast requirements.

**8\. Layout Responsiveness**

*   Define breakpoints for mobile, tablet, and desktop.
*   Ensure padding, card width, and button sizes scale consistently.
*   Text resizing rules: headings scale proportionally; body text stays legible.

# UX Flow/Feature Mapping

**Time Blocking Flow:**

1. User input via AI chat → parsed intent.
2. Proposal card generated: title, description, start/end, recurrence, mode (calendar or clickup\_task).
3. User modifies/approves in card → triggers execution:
4.     *   Default: Google Calendar event.
    *   Optional: ClickUp task + recurrence mapped.
5. 

**Task Embedding:**

*   Tasks/subtasks live within events as descriptions.
*   Clickable links to internal app tasks if needed.
*   Tags allow project-level aggregation.

1\. Page & Card Hierarchy

*   Home/dashboard page: central hub with cards for major life/work areas.
*   Card types: Projects, Tasks, Bookmarks, Docs, Resources.
*   Each card expandable to show full details.

2\. Interactive Flow

*   Hover states: subtle, consistent with design outline.
*   Click: expand card/modal, maintain white BG, black text.
*   Inline edits: clean, minimal borders, no color fills.

3\. Time Blocking & Tasks

*   Events appear in calendar view with descriptions/tasks inside.
*   Tasks inside a block: black text, white background, subtle border if needed.
*   Clicking task: expands inline with hover/focus states applied consistently.

4\. Buttons & Actions

*   All inline action buttons maintain sizing, spacing, hover/focus rules.
*   Approve/modify flows: consistent card styling, consistent spacing for text and buttons.

5\. Alerts/Notifications

*   Minimal, subtle. Only colored for semantic reason (success/error).
*   Background never colored; text bold or colored to indicate type.

6\. Micro-interactions

*   Consistent animation speed, subtle, no heavy color shifts.
*   Expand/collapse: smooth, linear, no jarring changes.

**Project / Tag Flow:**

*   Label tasks/events with project or category.
*   Overview page shows aggregated tasks/events per project.
*   Filters + mini-calendar view per project card.

# Edge Functions & Execution

| Function | Purpose | Input | Output | Notes |
| ---| ---| ---| ---| --- |
| chat | Accepts user input and generates proposals | raw text, context | proposal object | Now calendar-first |
| calendar-executor | Create/update Google Calendar events | proposal object | event ID, status | Handles retries & idempotency |
| clickup-task-creator | Optional creation of ClickUp tasks | proposal object | task ID, status | Triggered explicitly |
| document-sync | Keep docs synced / versioned | doc object | status | Existing functionality preserved |
| archive-events | Optional cleanup of old events/tasks | filters | status | Can be removed after migration |
| config | Env, feature flags | n/a | current config | Use for CALENDAR\_FIRST\_ENABLED etc |

# API/Schema

**Proposal Object (versioned):**

```plain
 {
  "mode": "calendar_description | clickup_task",
  "event": {
    "title": "string",
    "description": "string",
    "start": "ISO8601",
    "end": "ISO8601",
    "recurrence": "string",
    "timezone": "string"
  },
  "clickup": {
    "spaceId": "string",
    "listId": "string",
    "title": "string",
    "description": "string",
    "start": "ISO8601",
    "end": "ISO8601",
    "recurrence": "string"
  },
  "metadata": {
    "confidence": "number",
    "requiresClarification": "boolean",
    "sourceIntent": "string"
  }
}
```

Execution result:

```json
{
  "calendarEventId": "string",
  "clickupTaskId": "string | null",
  "executionMode": "calendar_description | clickup_task",
  "partialSuccess": "boolean",
  "timestamp": "ISO8601"
}
```

# Documents & Resource Management

*   **Card-based interface:** docs, bookmarks, tasks, resources.
*   **Tags/projects:** documents can be tagged and aggregated similar to tasks.
*   **AI-enabled creation:** use / commands to generate documents, link tasks, or create checklists.
*   **Versioning / history:** preserve edit history for all docs.

# Testing & Migration Notes

**Testing:**

*   Unit tests: plan normalization, schema validation, recurrence logic.
*   Integration: chat → proposal → approve → calendar/task creation.
*   E2E: ensure frontend shows correct cards, fields, and status.

**Migration Strategy:**

*   Shim current chat endpoint.
*   Deprecate old ClickUp-first task routing.
*   Default to calendar-first execution; optional task mode explicit only.