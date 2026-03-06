# DESIGN_TOKEN_AUDIT

Analysis-only pass. No UI code changed.

- Scope audited: `src/**/*.{css,tsx,jsx}`
- Primary machine inventories normalized from CSS declarations
- Inline styles audited separately (dynamic UI geometry/state styles)
- Generated: 2026-03-05

---

## STEP 1 — STYLE SOURCE MAP

### A) Global style entrypoints
Imported in [`src/main.tsx`](/Users/hunkyg/Desktop/apps/Delta/src/main.tsx):
1. [`src/styles/global.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/global.css)
2. [`src/styles/design-tokens.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/design-tokens.css)
3. [`src/styles/hover-focus.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/hover-focus.css)
4. [`src/styles/responsive.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/responsive.css)

### B) Global layer responsibilities and override behavior
- [`global.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/global.css): base app styles, component surfaces, many literal values.
- [`design-tokens.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/design-tokens.css): core token vars (`--color-*`, spacing/radius/font variables).
- [`hover-focus.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/hover-focus.css): interaction-state overrides.
- [`responsive.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/responsive.css): mobile/tablet overrides and mobile-specific components.
- [`components.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/components.css): reusable component primitives.
- [`design-system.css`](/Users/hunkyg/Desktop/apps/Delta/src/styles/design-system.css): additional/legacy token ramps and utility-like design vars.

### C) Component/page-local style sources
- [`src/pages/ListView.css`](/Users/hunkyg/Desktop/apps/Delta/src/pages/ListView.css): list page tables, rows, field chips, controls.
- [`src/components/Auth/Login.css`](/Users/hunkyg/Desktop/apps/Delta/src/components/Auth/Login.css): auth page visual system.
- [`src/components/FocalBoard/FocalBoard.css`](/Users/hunkyg/Desktop/apps/Delta/src/components/FocalBoard/FocalBoard.css)
- [`src/components/FocalBoard/LaneList.css`](/Users/hunkyg/Desktop/apps/Delta/src/components/FocalBoard/LaneList.css)
- [`src/components/FocalBoard/ItemList.css`](/Users/hunkyg/Desktop/apps/Delta/src/components/FocalBoard/ItemList.css)
- [`src/components/FocalBoard/ActionList.css`](/Users/hunkyg/Desktop/apps/Delta/src/components/FocalBoard/ActionList.css)
- [`src/components/FocalBoard/StatusSelect.css`](/Users/hunkyg/Desktop/apps/Delta/src/components/FocalBoard/StatusSelect.css)
- [`src/components/ProposalReviewTable.css`](/Users/hunkyg/Desktop/apps/Delta/src/components/ProposalReviewTable.css)
- [`src/components/UI/InlineInput.css`](/Users/hunkyg/Desktop/apps/Delta/src/components/UI/InlineInput.css)

### D) Inline style sources (TSX/JSX)
Dynamic inline style usage found in:
- [`src/components/mobile/MobileCalendarWireframe.tsx`](/Users/hunkyg/Desktop/apps/Delta/src/components/mobile/MobileCalendarWireframe.tsx)
- [`src/components/calendar/DayColumn.tsx`](/Users/hunkyg/Desktop/apps/Delta/src/components/calendar/DayColumn.tsx)
- [`src/components/calendar/TimeColumn.tsx`](/Users/hunkyg/Desktop/apps/Delta/src/components/calendar/TimeColumn.tsx)
- [`src/components/calendar/EventCard.tsx`](/Users/hunkyg/Desktop/apps/Delta/src/components/calendar/EventCard.tsx)
- [`src/components/calendar/EventDrawer.tsx`](/Users/hunkyg/Desktop/apps/Delta/src/components/calendar/EventDrawer.tsx)
- [`src/pages/ListView.tsx`](/Users/hunkyg/Desktop/apps/Delta/src/pages/ListView.tsx)
- [`src/components/FocalBoard/StatusSelect.jsx`](/Users/hunkyg/Desktop/apps/Delta/src/components/FocalBoard/StatusSelect.jsx)
- [`src/components/AppErrorBoundary.tsx`](/Users/hunkyg/Desktop/apps/Delta/src/components/AppErrorBoundary.tsx)
- [`src/components/ErrorBoundary.jsx`](/Users/hunkyg/Desktop/apps/Delta/src/components/ErrorBoundary.jsx)

---

## STEP 2 — COLOR INVENTORY

### Inventory summary
- Unique color/gradient literals in CSS: **562**
- Highest-frequency colors in use:
  - `#ffffff`
  - `#edf2fd`
  - `#f7f8fa`
  - `#00c7ff`
  - `#27272a`
  - `#52525b`
  - `#d8dbe2`
  - `#e4e6ea`

### Candidate token categories
- Background: `#ffffff`, `#edf2fd`, `#f7f8fa`, `#fbfcfe`
- Surface/card: `#ffffff`, `#f9fafb`, `#f5f5f5`
- Border/divider: `#e4e6ea`, `#d8dbe2`, `#e5e7eb`, `#d4d4d8`, `rgba(0,0,0,0.06)`
- Primary accent: `#00c7ff` (legacy `#00b7f4` still appears)
- Text primary/secondary/muted: `#27272a`, `#3f3f46`, `#52525b`, `#6b7280`, `#71717a`
- Status/state: `#94a3b8`, `#f59e0b`, `#22c55e`, `#ef4444`

### Full extracted colors (count | value | usage file locations)
```text
137	#ffffff	src/styles/design-system.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/StatusSelect.css, src/components/FocalBoard/LaneList.css, src/styles/responsive.css, src/components/FocalBoard/FocalBoard.css, src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/components/Auth/Login.css, src/components/ProposalReviewTable.css, src/styles/global.css
29	#edf2fd	src/styles/responsive.css, src/components/Auth/Login.css, src/styles/global.css
29	#f7f8fa	src/components/FocalBoard/LaneList.css, src/styles/responsive.css, src/components/FocalBoard/FocalBoard.css, src/pages/ListView.css, src/components/Auth/Login.css, src/components/ProposalReviewTable.css, src/styles/global.css
23	#00c7ff	src/styles/design-tokens.css, src/styles/responsive.css, src/pages/ListView.css, src/styles/global.css
20	#27272a	src/components/FocalBoard/FocalBoard.css, src/pages/ListView.css, src/styles/global.css
16	#52525b	src/pages/ListView.css, src/styles/global.css
16	#6b7280	src/styles/design-system.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
16	#d4d4d8	src/pages/ListView.css, src/styles/global.css
15	#d8dbe2	src/components/FocalBoard/ItemList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/components/ProposalReviewTable.css, src/styles/global.css
14	#111827	src/styles/design-system.css, src/components/FocalBoard/LaneList.css, src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/components/ProposalReviewTable.css
14	#3f3f46	src/pages/ListView.css, src/styles/global.css
13	#71717a	src/pages/ListView.css, src/styles/global.css
13	#e4e6ea	src/styles/design-tokens.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/pages/ListView.css, src/components/ProposalReviewTable.css, src/styles/global.css
12	#666666	src/styles/global.css
12	#e5e7eb	src/components/UI/InlineInput.css, src/styles/design-system.css, src/styles/global.css
12	#eceef2	src/components/FocalBoard/ItemList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/components/FocalBoard/ActionList.css, src/styles/global.css
11	#ececec	src/components/FocalBoard/StatusSelect.css, src/pages/ListView.css, src/styles/global.css
10	#e4e4e7	src/pages/ListView.css, src/styles/global.css
10	#ececf2	src/styles/global.css
10	#eceff3	src/components/FocalBoard/ItemList.css, src/components/FocalBoard/LaneList.css, src/pages/ListView.css, src/styles/global.css
9	#94a3b8	src/components/FocalBoard/StatusSelect.css, src/pages/ListView.css, src/styles/global.css
9	#dc2626	src/components/FocalBoard/FocalBoard.css, src/pages/ListView.css, src/styles/global.css
8	rgba(0, 0, 0, 0.1)	src/styles/design-system.css, src/styles/global.css
7	#374151	src/styles/design-system.css, src/styles/global.css
7	#f0f0f0	src/styles/global.css
7	#f5f5f5	src/pages/ListView.css, src/styles/global.css
6	#a1a1aa	src/pages/ListView.css, src/styles/global.css
6	#efeff1	src/pages/ListView.css
6	#fff	src/styles/responsive.css
5	#18181b	src/components/FocalBoard/FocalBoard.css, src/pages/ListView.css, src/styles/global.css
5	#222327	src/styles/design-tokens.css, src/styles/global.css
5	#2d323b	src/pages/ListView.css, src/styles/global.css
5	#2f343d	src/styles/global.css
5	#2f3640	src/styles/responsive.css
5	#333	src/styles/global.css
5	#6f7682	src/components/FocalBoard/ItemList.css, src/components/FocalBoard/ActionList.css
5	#9ca3af	src/components/UI/InlineInput.css, src/styles/design-system.css, src/components/FocalBoard/FocalBoard.css
5	#d0d0d0	src/styles/global.css
5	#d1d5db	src/styles/design-system.css, src/styles/global.css
5	#e6e8ec	src/components/FocalBoard/ItemList.css, src/pages/ListView.css, src/styles/global.css
5	#e8ebf0	src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/pages/ListView.css, src/components/ProposalReviewTable.css
5	#f9fafb	src/styles/design-system.css, src/styles/global.css
5	#fafafa	src/pages/ListView.css, src/styles/global.css
5	#fbfcfe	src/styles/design-tokens.css, src/styles/responsive.css
5	rgba(0, 0, 0, 0.05)	src/components/UI/InlineInput.css, src/styles/design-system.css, src/styles/global.css
5	rgba(0, 199, 255, 1)	src/styles/responsive.css, src/styles/global.css
4	#0f172a	src/styles/design-system.css, src/components/FocalBoard/LaneList.css, src/styles/global.css
4	#1f2937	src/styles/design-system.css, src/components/Auth/Login.css
4	#2a3038	src/styles/responsive.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
4	#2f343c	src/styles/responsive.css, src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/styles/global.css
4	#3b82f6	src/styles/design-system.css, src/styles/global.css
4	#4b5563	src/styles/design-system.css
4	#646b76	src/components/FocalBoard/FocalBoard.css
4	#757e8a	src/styles/responsive.css
4	#e9ecf1	src/components/FocalBoard/FocalBoard.css, src/pages/ListView.css, src/components/ProposalReviewTable.css
4	#f1f1f1	src/styles/global.css
4	#f2f4f7	src/components/FocalBoard/LaneList.css, src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/components/ProposalReviewTable.css
4	rgba(0, 122, 170, 0)	src/styles/global.css
4	rgba(0, 199, 255, 0.88)	src/styles/global.css
4	rgba(20, 27, 38, 0.08)	src/styles/responsive.css, src/styles/global.css
4	rgba(255, 255, 255, 0.1)	src/styles/global.css
4	rgba(255, 255, 255, 0.2)	src/styles/global.css
3	#00b7f4	src/pages/ListView.css
3	#1d1f27	src/styles/global.css
3	#202833	src/styles/responsive.css
3	#222734	src/styles/global.css
3	#2563eb	src/styles/design-system.css, src/styles/global.css
3	#2d3540	src/styles/responsive.css
3	#333333	src/styles/global.css
3	#334155	src/components/FocalBoard/StatusSelect.css
3	#454b56	src/components/FocalBoard/ItemList.css, src/components/FocalBoard/ActionList.css
3	#4d535d	src/components/FocalBoard/FocalBoard.css
3	#5a6172	src/styles/global.css
3	#64748b	src/components/FocalBoard/StatusSelect.css, src/styles/global.css
3	#666	src/styles/global.css
3	#6a7380	src/styles/responsive.css
3	#707680	src/components/FocalBoard/FocalBoard.css, src/pages/ListView.css, src/components/ProposalReviewTable.css
3	#727985	src/components/FocalBoard/ItemList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ActionList.css
3	#9ba2ad	src/components/FocalBoard/ItemList.css, src/components/FocalBoard/ActionList.css
3	#9c9c9c	src/styles/global.css
3	#cbd5e1	src/styles/design-system.css, src/styles/global.css
3	#d2d5db	src/styles/design-tokens.css, src/styles/global.css
3	#d9dee7	src/styles/global.css
3	#dadadd	src/pages/ListView.css
3	#e0e0e0	src/styles/global.css
3	#e33939	src/styles/global.css
3	#e6e8ed	src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
3	#eef1f5	src/components/FocalBoard/ItemList.css, src/styles/responsive.css, src/styles/global.css
3	#eef2f7	src/pages/ListView.css
3	#f0f0f3	src/styles/global.css
3	#f1f5f9	src/styles/design-system.css, src/styles/global.css
3	#f2f2f2	src/components/FocalBoard/StatusSelect.css
3	#f3f4f6	src/styles/design-system.css, src/styles/global.css
3	linear-gradient(135deg, #6366f1, #8b5cf6)	src/styles/global.css
3	rgba(0, 0, 0, 0.06)	src/styles/hover-focus.css, src/styles/global.css
3	rgba(100, 41, 248, 1)	src/components/UI/InlineInput.css
3	rgba(161, 161, 170, 0.35)	src/pages/ListView.css, src/styles/global.css
3	rgba(18, 24, 38, 0.08)	src/styles/global.css
3	rgba(20, 27, 38, 0.1)	src/styles/responsive.css
2	#111111	src/styles/global.css
2	#151515	src/styles/global.css
2	#1f1f1f	src/styles/global.css
2	#252a31	src/styles/global.css
2	#2a2f38	src/pages/ListView.css
2	#2b3038	src/styles/responsive.css, src/styles/global.css
2	#2d323a	src/components/FocalBoard/ItemList.css, src/styles/responsive.css
2	#2d333c	src/styles/responsive.css, src/styles/global.css
2	#2d3440	src/styles/responsive.css, src/pages/ListView.css
2	#2e333b	src/components/FocalBoard/ItemList.css, src/components/FocalBoard/ActionList.css
2	#2f3647	src/styles/global.css
2	#2f3745	src/pages/ListView.css, src/styles/global.css
2	#344760	src/components/Auth/Login.css
2	#3b4452	src/components/FocalBoard/ItemList.css, src/pages/ListView.css
2	#3f434f	src/styles/global.css
2	#454b55	src/components/ProposalReviewTable.css, src/styles/global.css
2	#4a4f57	src/styles/global.css
2	#4d535e	src/components/FocalBoard/LaneList.css, src/pages/ListView.css
2	#4f5669	src/styles/global.css
2	#5d6070	src/styles/global.css
2	#5e6672	src/styles/responsive.css, src/styles/global.css
2	#5f6874	src/styles/responsive.css
2	#5f6978	src/styles/responsive.css
2	#6366f1	src/styles/design-system.css, src/styles/global.css
2	#666d79	src/components/FocalBoard/LaneList.css, src/pages/ListView.css
2	#6a7280	src/styles/responsive.css
2	#7f8794	src/components/FocalBoard/ItemList.css, src/pages/ListView.css
2	#8f919a	src/styles/global.css
2	#c9ced9	src/styles/global.css
2	#d2d9e2	src/styles/global.css
2	#d4d9e1	src/styles/responsive.css
2	#d7e0f1	src/components/Auth/Login.css
2	#d8dde5	src/styles/responsive.css, src/pages/ListView.css
2	#d8dde6	src/styles/responsive.css
2	#d9dde4	src/styles/responsive.css, src/styles/global.css
2	#dce1e9	src/styles/responsive.css
2	#e1e4ec	src/styles/global.css
2	#e2e7ef	src/styles/responsive.css
2	#e2e8f0	src/styles/design-system.css, src/styles/global.css
2	#e6eaf0	src/pages/ListView.css, src/styles/global.css
2	#eceef4	src/styles/global.css
2	#eef2f6	src/styles/responsive.css
2	#efefef	src/styles/global.css
2	#efeff4	src/styles/global.css
2	#f1f1f3	src/pages/ListView.css
2	#f4f4f5	src/pages/ListView.css
2	#f7f7fa	src/styles/global.css
2	#f8f9fc	src/styles/global.css
2	#fef2f2	src/styles/global.css
2	#fefeff	src/styles/global.css
2	linear-gradient(135deg, #5558e3, #7c3aed)	src/styles/global.css
2	rgba(0, 0, 0, 0.08)	src/styles/global.css
2	rgba(0, 0, 0, 0.12)	src/styles/global.css
2	rgba(255, 112, 207, 0.12)	src/styles/global.css
2	rgba(255, 255, 255, 0.95)	src/styles/responsive.css, src/styles/global.css
2	rgba(59, 130, 246, 0.15)	src/styles/components.css
2	rgba(63, 113, 255, 0.2)	src/styles/global.css
1	#000000	src/components/UI/InlineInput.css
1	#0a53be	src/styles/global.css
1	#0f1724	src/styles/global.css
1	#10b981	src/styles/design-system.css
1	#121212	src/styles/global.css
1	#171b26	src/styles/global.css
1	#1a1a1a	src/styles/global.css
1	#1a1f2c	src/styles/global.css
1	#1b2430	src/components/Auth/Login.css
1	#1d4ed8	src/styles/design-system.css
1	#1e1e26	src/styles/global.css
1	#1e3a8a	src/styles/design-system.css
1	#1e40af	src/styles/design-system.css
1	#1f2433	src/styles/global.css
1	#1f2632	src/styles/responsive.css
1	#1f2b3a	src/components/Auth/Login.css
1	#202020	src/styles/global.css
1	#21283a	src/styles/global.css
1	#212a36	src/styles/responsive.css
1	#222222	src/styles/global.css
1	#223040	src/components/Auth/Login.css
1	#223665	src/styles/global.css
1	#252b3c	src/styles/global.css
1	#262b33	src/components/FocalBoard/LaneList.css
1	#273451	src/styles/global.css
1	#282833	src/styles/global.css
1	#282d35	src/styles/global.css
1	#2a2a2a	src/styles/global.css
1	#2a323d	src/styles/responsive.css
1	#2a3442	src/pages/ListView.css
1	#2a4179	src/styles/global.css
1	#2b3039	src/pages/ListView.css
1	#2b313c	src/styles/global.css
1	#2c313a	src/components/ProposalReviewTable.css
1	#2e333c	src/pages/ListView.css
1	#2e343d	src/styles/global.css
1	#2f2f2f	src/styles/global.css
1	#2f353d	src/components/FocalBoard/FocalBoard.css
1	#2f353e	src/styles/responsive.css
1	#2f353f	src/styles/responsive.css
1	#2f3641	src/pages/ListView.css
1	#2f3742	src/styles/responsive.css
1	#2f3744	src/styles/responsive.css
1	#2f3852	src/styles/global.css
1	#2f4ea8	src/styles/global.css
1	#2f6a46	src/pages/ListView.css
1	#30353d	src/styles/global.css
1	#31363f	src/components/FocalBoard/FocalBoard.css
1	#314c9b	src/styles/global.css
1	#323842	src/styles/global.css
1	#323846	src/styles/global.css
1	#323943	src/styles/responsive.css
1	#333840	src/styles/global.css
1	#333942	src/styles/responsive.css
1	#343943	src/components/FocalBoard/FocalBoard.css
1	#353c46	src/styles/responsive.css
1	#364051	src/pages/ListView.css
1	#39404a	src/styles/responsive.css
1	#3a3b42	src/styles/global.css
1	#3a4049	src/components/FocalBoard/LaneList.css
1	#3a4052	src/styles/global.css
1	#3a4150	src/pages/ListView.css
1	#3b3b46	src/styles/global.css
1	#3b4350	src/styles/responsive.css
1	#3c3f4a	src/styles/global.css
1	#3c4655	src/pages/ListView.css
1	#3e3e3e	src/styles/global.css
1	#3e434b	src/styles/global.css
1	#3e4652	src/styles/global.css
1	#3f444d	src/styles/global.css
1	#3f465c	src/styles/global.css
1	#3f81f9	src/styles/global.css
1	#404040	src/styles/global.css
1	#414852	src/styles/responsive.css
1	#43357f	src/styles/global.css
1	#434852	src/styles/global.css
1	#434951	src/components/FocalBoard/LaneList.css
1	#434953	src/styles/global.css
1	#44474f	src/styles/global.css
1	#444d5a	src/pages/ListView.css
1	#445469	src/components/Auth/Login.css
1	#47505c	src/styles/responsive.css
1	#475569	src/styles/global.css
1	#4a5166	src/styles/global.css
1	#4a5360	src/styles/responsive.css
1	#4b515c	src/components/ProposalReviewTable.css
1	#4b5264	src/styles/global.css
1	#4b5461	src/styles/responsive.css
1	#4b5668	src/styles/responsive.css
1	#4c5663	src/styles/responsive.css
1	#4d5560	src/styles/responsive.css
1	#4d5566	src/styles/global.css
1	#4d5878	src/styles/global.css
1	#4e5968	src/pages/ListView.css
1	#4f5560	src/pages/ListView.css
1	#4f5866	src/styles/responsive.css
1	#4f5d84	src/styles/global.css
1	#505863	src/styles/global.css
1	#525b67	src/styles/global.css
1	#535b66	src/styles/global.css
1	#535b6f	src/styles/global.css
1	#555761	src/styles/global.css
1	#56607a	src/styles/global.css
1	#566171	src/styles/responsive.css
1	#575f6c	src/styles/responsive.css
1	#586172	src/styles/global.css
1	#586272	src/styles/responsive.css
1	#59607a	src/styles/global.css
1	#59626f	src/styles/responsive.css
1	#596270	src/styles/responsive.css
1	#5a616d	src/components/FocalBoard/LaneList.css
1	#5b6470	src/styles/responsive.css
1	#5b6473	src/pages/ListView.css
1	#5b6574	src/styles/responsive.css
1	#5c5c67	src/styles/global.css
1	#5c6470	src/styles/responsive.css
1	#5d6470	src/styles/global.css
1	#5d6571	src/styles/global.css
1	#5d6572	src/styles/global.css
1	#5d6673	src/styles/responsive.css
1	#5d6877	src/pages/ListView.css
1	#5f6570	src/styles/global.css
1	#5f6670	src/styles/global.css
1	#5f6671	src/pages/ListView.css
1	#5f6680	src/styles/global.css
1	#5f6b7b	src/styles/responsive.css
1	#5fc0ff	src/styles/global.css
1	#606774	src/components/FocalBoard/FocalBoard.css
1	#606a78	src/styles/responsive.css
1	#60a5fa	src/styles/design-system.css
1	#616872	src/components/ProposalReviewTable.css
1	#616a75	src/styles/responsive.css
1	#616b7a	src/styles/responsive.css
1	#626d7a	src/styles/responsive.css
1	#636675	src/styles/global.css
1	#636b83	src/styles/global.css
1	#666f86	src/styles/global.css
1	#66707d	src/styles/responsive.css
1	#66c5eb	src/styles/responsive.css
1	#67707d	src/components/Auth/Login.css
1	#677181	src/pages/ListView.css
1	#68717e	src/styles/responsive.css
1	#687181	src/pages/ListView.css
1	#687281	src/styles/responsive.css
1	#697180	src/pages/ListView.css
1	#6a6a73	src/styles/global.css
1	#6a7083	src/styles/global.css
1	#6d7181	src/styles/global.css
1	#6e7180	src/styles/global.css
1	#6e7581	src/pages/ListView.css
1	#6f5de0	src/styles/global.css
1	#6f707b	src/styles/global.css
1	#6f7280	src/styles/global.css
1	#6f7783	src/pages/ListView.css
1	#6f7a8b	src/styles/responsive.css
1	#70757f	src/styles/global.css
1	#70768a	src/styles/global.css
1	#707784	src/components/FocalBoard/LaneList.css
1	#737c89	src/styles/global.css
1	#767b84	src/styles/design-tokens.css
1	#767d88	src/styles/global.css
1	#767d91	src/styles/global.css
1	#767d92	src/styles/global.css
1	#787878	src/styles/global.css
1	#798393	src/styles/responsive.css
1	#7a7a7a	src/styles/global.css
1	#7f8394	src/styles/global.css
1	#7f8894	src/styles/responsive.css
1	#80808a	src/styles/global.css
1	#818cf8	src/styles/design-system.css
1	#81a4f8	src/styles/global.css
1	#828694	src/styles/global.css
1	#8390a2	src/components/Auth/Login.css
1	#848d9a	src/styles/responsive.css
1	#858b9d	src/styles/global.css
1	#888	src/styles/global.css
1	#8a8ea1	src/styles/global.css
1	#8a919b	src/styles/global.css
1	#8b929d	src/styles/responsive.css
1	#8c8ea0	src/styles/global.css
1	#8c90a0	src/styles/global.css
1	#8dd5f2	src/styles/responsive.css
1	#8ea3c6	src/components/Auth/Login.css
1	#8f96a2	src/components/FocalBoard/LaneList.css
1	#93c5fd	src/styles/design-system.css
1	#9797a1	src/styles/global.css
1	#999	src/styles/global.css
1	#999999	src/styles/global.css
1	#9da3be	src/styles/global.css
1	#a78bfa	src/styles/design-system.css
1	#b4232f	src/pages/ListView.css
1	#b8bfcb	src/styles/global.css
1	#b91c1c	src/components/FocalBoard/FocalBoard.css
1	#babfc9	src/components/FocalBoard/LaneList.css
1	#bcc2cb	src/styles/global.css
1	#bfc5ce	src/styles/responsive.css
1	#bfdbfe	src/styles/design-system.css
1	#c7ced9	src/styles/global.css
1	#c9ced6	src/styles/hover-focus.css
1	#c9ced7	src/styles/responsive.css
1	#cad2dc	src/styles/responsive.css
1	#cfd1d9	src/styles/global.css
1	#cfd4dd	src/styles/global.css
1	#cfd5de	src/styles/global.css
1	#cfd5e2	src/styles/global.css
1	#cfd6e0	src/styles/responsive.css
1	#cfd7ef	src/styles/global.css
1	#d0d5de	src/components/FocalBoard/LaneList.css
1	#d0d6de	src/styles/responsive.css
1	#d2d4dc	src/styles/global.css
1	#d2d7e1	src/styles/global.css
1	#d2d8e1	src/styles/responsive.css
1	#d3d9e2	src/styles/responsive.css
1	#d4d8e0	src/styles/global.css
1	#d4dae3	src/styles/responsive.css
1	#d4deef	src/components/Auth/Login.css
1	#d5d8e1	src/styles/global.css
1	#d5dbe3	src/styles/responsive.css
1	#d5dbe4	src/styles/responsive.css
1	#d5dceb	src/styles/responsive.css
1	#d6d6db	src/pages/ListView.css
1	#d6d9e0	src/styles/global.css
1	#d6dae1	src/styles/global.css
1	#d6dbe3	src/styles/responsive.css
1	#d6dce6	src/pages/ListView.css
1	#d7dbe2	src/styles/global.css
1	#d7dce4	src/styles/global.css
1	#d7dce8	src/styles/global.css
1	#d8d9df	src/styles/global.css
1	#d8dce3	src/styles/global.css
1	#d8dce7	src/styles/global.css
1	#d8deef	src/styles/global.css
1	#d8edf9	src/styles/responsive.css
1	#d9d9de	src/styles/global.css
1	#d9dbe3	src/styles/global.css
1	#d9dbe4	src/styles/global.css
1	#dbe0eb	src/styles/global.css
1	#dbe3f1	src/components/FocalBoard/StatusSelect.css
1	#dbe5ff	src/styles/global.css
1	#dbeafe	src/styles/design-system.css
1	#dcdce0	src/styles/global.css
1	#dce0e9	src/styles/global.css
1	#dce0ef	src/styles/global.css
1	#dddddd	src/styles/global.css
1	#ddf4e8	src/pages/ListView.css
1	#dfdfdf	src/styles/global.css
1	#dfdfe6	src/styles/global.css
1	#dfe3ec	src/styles/global.css
1	#dfe4eb	src/styles/global.css
1	#dfe5f7	src/styles/global.css
1	#e1e2e8	src/styles/global.css
1	#e2e2e2	src/styles/global.css
1	#e2e5f2	src/styles/global.css
1	#e3e6ec	src/styles/responsive.css
1	#e44b4b	src/styles/responsive.css
1	#e5e6ec	src/styles/global.css
1	#e6e8f0	src/styles/global.css
1	#e7e7e7	src/styles/global.css
1	#e7e8ed	src/styles/global.css
1	#e7ebf5	src/styles/global.css
1	#e8e8e8	src/styles/global.css
1	#e8ebf3	src/styles/global.css
1	#e9eaf0	src/styles/global.css
1	#e9edf3	src/styles/responsive.css
1	#e9edf6	src/styles/global.css
1	#ececef	src/pages/ListView.css
1	#ececf0	src/styles/global.css
1	#eceff5	src/styles/global.css
1	#edf1fb	src/styles/global.css
1	#edf2fb	src/components/FocalBoard/StatusSelect.css
1	#eeeeee	src/styles/global.css
1	#eef1f6	src/styles/responsive.css
1	#eef1f8	src/styles/global.css
1	#eef3ff	src/styles/global.css
1	#ef4444	src/styles/design-system.css
1	#f0f0f4	src/styles/global.css
1	#f0f1f5	src/styles/global.css
1	#f0f2f7	src/styles/global.css
1	#f0f9ff	src/styles/design-system.css
1	#f1f1f4	src/styles/global.css
1	#f1f2f6	src/styles/global.css
1	#f1f3f7	src/styles/global.css
1	#f1f4f8	src/styles/responsive.css
1	#f2f2f5	src/styles/global.css
1	#f3f5f8	src/styles/global.css
1	#f4f4f8	src/styles/global.css
1	#f59e0b	src/styles/design-system.css
1	#f5f5f7	src/styles/global.css
1	#f5f6fa	src/styles/global.css
1	#f5f7fb	src/styles/responsive.css
1	#f7f5ff	src/styles/global.css
1	#f7f7f7	src/styles/global.css
1	#f8f8f8	src/styles/global.css
1	#f8fafc	src/styles/design-system.css
1	#f9fbff	src/styles/responsive.css
1	#fafafe	src/styles/global.css
1	#fafbfc	src/styles/global.css
1	#fafbfe	src/styles/global.css
1	#fbfbfc	src/pages/ListView.css
1	#fcfcfe	src/styles/global.css
1	#fcfdff	src/styles/global.css
1	#fecaca	src/styles/global.css
1	#fee	src/styles/global.css
1	linear-gradient(#f3f3f6, #f3f3f6)	src/styles/global.css
1	linear-gradient(135deg, #2f58ff 0%, #3a7bff 48%, #4c8dff 70%, #ff7ec8 100%)	src/styles/global.css
1	linear-gradient(138deg, #2f7bff 0%, #4c82f8 42%, #ff5fab 100%)	src/styles/global.css
1	linear-gradient(140deg, #3f71ff, #ff70cf)	src/styles/global.css
1	linear-gradient(145deg, #3f81f9, #5d88eb)	src/styles/global.css
1	linear-gradient(160deg, rgba(72, 149, 255, 0.95)	src/styles/global.css
1	linear-gradient(160deg, rgba(80, 156, 255, 0.38)	src/styles/global.css
1	linear-gradient(180deg, #2f66ff, #ff6ec8)	src/styles/global.css
1	linear-gradient(180deg, #ffffff 0%, #fafafa 100%)	src/styles/global.css
1	linear-gradient(180deg, #ffffff, #f7f9ff)	src/styles/global.css
1	linear-gradient(180deg, #ffffff, #fbfcff)	src/styles/global.css
1	linear-gradient(rgba(246, 248, 251, 0.8)	src/styles/responsive.css
1	radial-gradient(circle at 18% 50%, rgba(95, 192, 228, 0.2)	src/styles/responsive.css
1	radial-gradient(circle at 20% 25%, rgba(96, 196, 232, 0.18)	src/styles/responsive.css
1	radial-gradient(circle at 80% 75%, rgba(156, 120, 208, 0.14)	src/styles/responsive.css
1	radial-gradient(circle at 82% 45%, rgba(143, 104, 210, 0.14)	src/styles/responsive.css
1	rgb(255 255 255 / 0.92)	src/styles/global.css
1	rgba(0, 0, 0, 0.04)	src/styles/global.css
1	rgba(0, 0, 0, 0.07)	src/styles/design-system.css
1	rgba(0, 0, 0, 0.14)	src/styles/global.css
1	rgba(0, 0, 0, 0.15)	src/styles/design-system.css
1	rgba(0, 0, 0, 0.22)	src/styles/global.css
1	rgba(0, 0, 0, 0.25)	src/styles/design-system.css
1	rgba(0, 0, 0, 0.3)	src/styles/global.css
1	rgba(0, 0, 0, 0.5)	src/styles/global.css
1	rgba(0, 122, 170, 0.16)	src/styles/global.css
1	rgba(0, 122, 170, 0.32)	src/styles/global.css
1	rgba(0, 122, 170, 0.34)	src/styles/global.css
1	rgba(0, 122, 170, 0.42)	src/styles/global.css
1	rgba(0, 181, 254, 0.24)	src/styles/global.css
1	rgba(0, 181, 254, 0.5)	src/styles/global.css
1	rgba(0, 181, 254, 0.88)	src/styles/global.css
1	rgba(0, 183, 244, 0.88)	src/pages/ListView.css
1	rgba(0, 199, 255, 0.22)	src/styles/global.css
1	rgba(0, 199, 255, 0.24)	src/styles/global.css
1	rgba(0, 199, 255, 0.26)	src/styles/global.css
1	rgba(0, 199, 255, 0.3)	src/styles/global.css
1	rgba(0, 199, 255, 0.34)	src/styles/global.css
1	rgba(0, 199, 255, 0.42)	src/styles/global.css
1	rgba(0, 199, 255, 0.5)	src/styles/global.css
1	rgba(100, 41, 248, 0.1)	src/components/UI/InlineInput.css
1	rgba(117, 155, 249, 0.34)	src/styles/global.css
1	rgba(12, 14, 18, 0.08)	src/styles/global.css
1	rgba(129, 162, 255, 0.65)	src/styles/global.css
1	rgba(13, 17, 26, 0.08)	src/pages/ListView.css
1	rgba(130, 173, 255, 0.92)	src/styles/global.css
1	rgba(14, 20, 34, 0.14)	src/styles/global.css
1	rgba(146, 181, 255, 0.52)	src/styles/global.css
1	rgba(15, 23, 42, 0.12)	src/components/FocalBoard/StatusSelect.css
1	rgba(161, 161, 170, 0.12)	src/styles/global.css
1	rgba(19, 24, 39, 0.12)	src/styles/global.css
1	rgba(20, 26, 33, 0.14)	src/styles/responsive.css
1	rgba(20, 28, 40, 0.055)	src/styles/responsive.css
1	rgba(20, 28, 40, 0.16)	src/styles/responsive.css
1	rgba(207, 78, 203, 0.14)	src/styles/global.css
1	rgba(209, 219, 245, 0.9)	src/styles/global.css
1	rgba(22, 28, 36, 0.2)	src/styles/responsive.css
1	rgba(228, 228, 231, 0.9)	src/styles/global.css
1	rgba(228, 75, 75, 0.4)	src/styles/responsive.css
1	rgba(228, 75, 75, 0.45)	src/styles/responsive.css
1	rgba(237, 242, 253, 0.9)	src/components/Auth/Login.css
1	rgba(24, 24, 27, 0.06)	src/styles/global.css
1	rgba(24, 24, 27, 0.35)	src/pages/ListView.css
1	rgba(246, 248, 251, 0.9)	src/styles/responsive.css
1	rgba(247, 249, 252, 0.88)	src/styles/responsive.css
1	rgba(25, 30, 50, 0.06)	src/styles/global.css
1	rgba(25, 31, 39, 0.12)	src/styles/responsive.css
1	rgba(255, 102, 189, 0.95)	src/styles/global.css
1	rgba(255, 112, 207, 0.1)	src/styles/global.css
1	rgba(255, 112, 207, 0.24)	src/styles/global.css
1	rgba(255, 255, 255, 0.3)	src/styles/global.css
1	rgba(255, 255, 255, 0.35)	src/styles/global.css
1	rgba(255, 255, 255, 0.56)	src/styles/global.css
1	rgba(255, 255, 255, 0.65)	src/styles/responsive.css
1	rgba(255, 255, 255, 0.74)	src/styles/global.css
1	rgba(255, 255, 255, 0.8)	src/styles/global.css
1	rgba(255, 255, 255, 0.82)	src/styles/responsive.css
1	rgba(255, 255, 255, 0.84)	src/styles/responsive.css
1	rgba(255, 255, 255, 0.85)	src/styles/global.css
1	rgba(255, 255, 255, 0.98)	src/styles/responsive.css
1	rgba(255, 95, 184, 0.32)	src/styles/global.css
1	rgba(26, 32, 42, 0.12)	src/styles/responsive.css
1	rgba(26, 32, 42, 0.14)	src/styles/responsive.css
1	rgba(30, 30, 40, 0.95)	src/styles/global.css
1	rgba(30, 37, 47, 0.06)	src/styles/responsive.css
1	rgba(38, 59, 132, 0.17)	src/styles/global.css
1	rgba(50, 74, 168, 0.2)	src/styles/global.css
1	rgba(58, 95, 201, 0.3)	src/styles/global.css
1	rgba(59, 130, 246, 0.1)	src/styles/global.css
1	rgba(60, 103, 223, 0.35)	src/styles/global.css
1	rgba(62, 101, 215, 0.34)	src/styles/global.css
1	rgba(63, 113, 255, 0.18)	src/styles/global.css
1	rgba(63, 113, 255, 0.22)	src/styles/global.css
1	rgba(67, 86, 155, 0.35)	src/styles/global.css
1	rgba(68, 86, 147, 0.24)	src/styles/global.css
1	rgba(76, 140, 255, 0.16)	src/styles/global.css
1	rgba(79, 120, 255, 0.1)	src/styles/global.css
1	rgba(79, 120, 255, 0.16)	src/styles/global.css
1	rgba(79, 120, 255, 0.38)	src/styles/global.css
1	rgba(80, 31, 198, 1)	src/components/UI/InlineInput.css
1	rgba(97, 174, 233, 0.24)	src/styles/responsive.css
1	rgba(99, 102, 241, 0.2)	src/styles/global.css
1	rgba(99, 102, 241, 0.3)	src/styles/global.css
```

---

## STEP 3 — TYPOGRAPHY INVENTORY

### Inventory summary (CSS declarations)
- Unique typography declarations: **106**
- Font family declarations center around Poppins + system fallbacks.
- Most common font sizes: 11px, 12px, 13px, 14px.
- Most common weights: 500, 600, then 400.

### Semantic role candidate mapping
- Page title: 30px–40px / 600
- Section title: 18px–24px / 600
- Card/list title: 14px–18px / 500–600
- Body: 13px–16px / 400–500
- Caption/meta: 10px–12px / 400–500
- Button labels: 12px–14px / 500–600

### Full extracted typography declarations (count | declaration | files)
```text
78	font-weight: 600;	src/components/FocalBoard/ActionList.css, src/pages/ListView.css, src/styles/responsive.css, src/components/FocalBoard/StatusSelect.css, src/components/ProposalReviewTable.css, src/components/Auth/Login.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
65	font-size: 12px;	src/components/FocalBoard/ActionList.css, src/pages/ListView.css, src/styles/responsive.css, src/components/FocalBoard/StatusSelect.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
59	font-weight: 500;	src/components/UI/InlineInput.css, src/pages/ListView.css, src/styles/responsive.css, src/components/Auth/Login.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
48	font-size: 13px;	src/components/FocalBoard/ActionList.css, src/pages/ListView.css, src/styles/responsive.css, src/components/Auth/Login.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
45	font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;	src/components/FocalBoard/ActionList.css, src/components/UI/InlineInput.css, src/components/Auth/Login.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
36	font-size: 14px;	src/components/UI/InlineInput.css, src/pages/ListView.css, src/styles/responsive.css, src/components/ProposalReviewTable.css, src/components/Auth/Login.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
34	font-size: 11px;	src/components/FocalBoard/ActionList.css, src/pages/ListView.css, src/styles/responsive.css, src/components/FocalBoard/StatusSelect.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
17	font-weight: 400;	src/components/UI/InlineInput.css, src/components/FocalBoard/LaneList.css, src/styles/global.css
14	line-height: 1;	src/components/FocalBoard/ActionList.css, src/pages/ListView.css, src/styles/responsive.css, src/components/FocalBoard/ItemList.css, src/styles/global.css
11	font-family: var(--font-body);	src/styles/responsive.css, src/styles/global.css
10	font-size: 0.68rem;	src/styles/global.css
9	font-size: 0.72rem;	src/styles/global.css
9	font-size: 0.76rem;	src/styles/global.css
9	font-size: 18px;	src/pages/ListView.css, src/styles/responsive.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
8	font-size: 10px;	src/pages/ListView.css, src/styles/responsive.css, src/components/FocalBoard/ItemList.css
8	letter-spacing: 0.01em;	src/styles/responsive.css, src/components/Auth/Login.css, src/styles/global.css
7	font-size: 0.74rem;	src/styles/global.css
7	font-size: 16px;	src/styles/responsive.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
6	font-size: 15px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
6	line-height: 1.35;	src/components/FocalBoard/ActionList.css, src/styles/responsive.css, src/styles/global.css
6	line-height: 1.5;	src/styles/design-tokens.css, src/styles/components.css, src/styles/global.css
5	font-size: 0.78rem;	src/styles/global.css
5	font-size: 0.82rem;	src/styles/global.css
5	font-size: 0.84rem;	src/styles/global.css
5	letter-spacing: 0.05em;	src/pages/ListView.css, src/styles/responsive.css
5	line-height: 1.4;	src/pages/ListView.css, src/styles/responsive.css, src/components/FocalBoard/FocalBoard.css
4	font-size: 0.75rem;	src/styles/global.css
4	font-size: 0.88rem;	src/styles/global.css
4	font-size: 0.95rem;	src/styles/global.css
4	font-size: 1.5rem;	src/styles/global.css
4	font-size: var(--small-size);	src/styles/global.css
4	letter-spacing: 0.005em;	src/styles/global.css
4	letter-spacing: 0.02em;	src/styles/responsive.css, src/styles/global.css
4	letter-spacing: 0.03em;	src/styles/responsive.css
4	line-height: 1.3;	src/components/FocalBoard/ActionList.css, src/styles/global.css
3	font-family: 'Poppins', sans-serif;	src/styles/global.css
3	font-size: 0.64rem;	src/styles/global.css
3	font-size: 0.66rem;	src/styles/global.css
3	font-size: 0.7rem;	src/styles/global.css
3	font-size: 0.8rem;	src/styles/global.css
3	font-size: 17px;	src/pages/ListView.css, src/styles/responsive.css
3	font-size: var(--delta-text-lg);	src/styles/components.css
3	font-size: var(--delta-text-sm);	src/styles/components.css, src/styles/global.css
3	font-weight: var(--delta-font-semibold);	src/styles/components.css, src/styles/global.css
3	letter-spacing: 0.04em;	src/pages/ListView.css, src/styles/global.css
3	line-height: 1.05;	src/styles/responsive.css, src/styles/global.css
3	line-height: 1.45;	src/styles/responsive.css, src/styles/global.css
2	font-family: var(--delta-font-sans);	src/styles/components.css
2	font-size: 0.62rem;	src/styles/global.css
2	font-size: 0.67rem;	src/styles/global.css
2	font-size: 0.69rem;	src/styles/global.css
2	font-size: 0.71rem;	src/styles/global.css
2	font-size: 0.73rem;	src/styles/global.css
2	font-size: 0.86rem;	src/styles/global.css
2	font-size: 0.9rem;	src/styles/global.css
2	font-size: 1.05rem;	src/styles/global.css
2	font-size: 24px;	src/styles/responsive.css, src/styles/global.css
2	font-size: 34px;	src/styles/responsive.css
2	font-weight: 300;	src/styles/global.css
2	letter-spacing: -0.012em;	src/styles/responsive.css
2	letter-spacing: -0.014em;	src/styles/responsive.css
2	letter-spacing: -0.01em;	src/styles/responsive.css
2	letter-spacing: 0.045em;	src/styles/responsive.css, src/styles/global.css
2	letter-spacing: 0.06em;	src/styles/responsive.css
2	line-height: 1.02;	src/styles/responsive.css
2	line-height: 1.1;	src/styles/global.css
1	font-family: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif !important;	src/styles/global.css
1	font-family: monospace;	src/components/FocalBoard/ItemList.css
1	font-size: 0.56rem;	src/styles/global.css
1	font-size: 0.61rem;	src/styles/global.css
1	font-size: 0.6rem;	src/styles/global.css
1	font-size: 0.87rem;	src/styles/global.css
1	font-size: 0.8rem !important;	src/styles/global.css
1	font-size: 0.92rem;	src/styles/global.css
1	font-size: 0;	src/pages/ListView.css
1	font-size: 1.12rem;	src/styles/global.css
1	font-size: 1.17rem;	src/styles/global.css
1	font-size: 1.9rem;	src/styles/global.css
1	font-size: 18px !important;	src/styles/global.css
1	font-size: 1rem;	src/styles/global.css
1	font-size: 20px;	src/styles/responsive.css
1	font-size: 22px;	src/components/Auth/Login.css
1	font-size: 30px;	src/styles/responsive.css
1	font-size: 32px;	src/styles/responsive.css
1	font-size: 38px;	src/styles/responsive.css
1	font-size: 40px;	src/styles/responsive.css
1	font-size: 9px;	src/components/FocalBoard/ActionList.css
1	font-size: var(--body-size);	src/styles/global.css
1	font-size: var(--delta-text-base);	src/styles/global.css
1	font-size: var(--delta-text-xs);	src/styles/components.css
1	font-size: var(--h1-size);	src/styles/global.css
1	font-weight: 700;	src/styles/global.css
1	font-weight: bold;	src/components/FocalBoard/ActionList.css
1	font-weight: var(--delta-font-medium);	src/styles/components.css
1	letter-spacing: 0.015em;	src/styles/global.css
1	letter-spacing: 0.025em !important;	src/styles/global.css
1	letter-spacing: 0.025em;	src/styles/global.css
1	letter-spacing: 0.5px;	src/styles/global.css
1	line-height: 1 !important;	src/styles/global.css
1	line-height: 1.15;	src/styles/global.css
1	line-height: 1.25;	src/components/FocalBoard/ItemList.css
1	line-height: 1.28;	src/styles/responsive.css
1	line-height: 1.2;	src/styles/responsive.css
1	line-height: 1.32;	src/styles/responsive.css
1	line-height: 1.38;	src/styles/responsive.css
1	line-height: var(--line-height);	src/styles/global.css
```

---

## STEP 4 — SPACING INVENTORY

### Inventory summary
- Unique spacing declarations: **269**
- Most common spacing values: `0`, `2`, `4`, `6`, `8`, `10`, `12`, `14`, `16`, `20`, `24`, `32`, `40` px

### Candidate spacing scale
`0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40`

### Outlier patterns
- High number of one-off shorthand combos
- Safe-area and viewport-specific `calc(...)` expressions
- Mixed spacing conventions between desktop and mobile-specific blocks

### Full extracted spacing declarations (count | declaration | files)
```text
106	gap: 8px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/components/FocalBoard/StatusSelect.css, src/components/UI/InlineInput.css, src/styles/responsive.css, src/styles/global.css
61	gap: 6px;	src/pages/ListView.css, src/components/Auth/Login.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/components/FocalBoard/StatusSelect.css, src/styles/responsive.css, src/styles/global.css
56	margin: 0;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/Auth/Login.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/components.css, src/styles/responsive.css, src/styles/global.css
44	padding: 0;	src/pages/ListView.css, src/components/Auth/Login.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/styles/responsive.css, src/styles/global.css
40	gap: 10px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
25	gap: 4px;	src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/StatusSelect.css, src/components/UI/InlineInput.css, src/styles/responsive.css, src/styles/global.css
22	padding: 0 10px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
21	padding: 0 8px;	src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/FocalBoard.css, src/components/FocalBoard/StatusSelect.css, src/styles/responsive.css, src/styles/global.css
17	gap: 12px;	src/pages/ListView.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
16	padding: 0 12px;	src/pages/ListView.css, src/components/Auth/Login.css, src/components/FocalBoard/FocalBoard.css, src/components/UI/InlineInput.css, src/styles/responsive.css, src/styles/global.css
16	padding: 8px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
12	gap: 2px;	src/pages/ListView.css, src/components/FocalBoard/FocalBoard.css, src/components/FocalBoard/StatusSelect.css, src/styles/global.css
11	margin-top: 4px;	src/pages/ListView.css, src/components/FocalBoard/LaneList.css, src/styles/responsive.css, src/styles/global.css
10	padding: 10px 12px;	src/components/Auth/Login.css, src/styles/responsive.css, src/styles/global.css
9	padding: 10px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/LaneList.css, src/styles/responsive.css, src/styles/global.css
9	padding: 4px 8px;	src/styles/responsive.css, src/styles/global.css
9	padding: 8px 10px;	src/pages/ListView.css, src/styles/global.css
8	gap: 14px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
8	gap: 5px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
8	padding: 4px 6px;	src/components/FocalBoard/ActionList.css, src/styles/responsive.css, src/styles/global.css
7	margin-left: auto;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/styles/responsive.css, src/styles/global.css
6	margin-top: 8px;	src/components/FocalBoard/FocalBoard.css, src/styles/global.css
6	padding: 20px;	src/pages/ListView.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
6	padding: 2px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
6	padding: 6px 8px;	src/styles/responsive.css, src/styles/global.css
5	gap: 0;	src/components/FocalBoard/ItemList.css, src/styles/global.css
5	gap: 16px;	src/pages/ListView.css, src/components/Auth/Login.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
5	gap: 7px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
5	margin-top: 2px;	src/components/FocalBoard/ActionList.css, src/components/FocalBoard/ItemList.css, src/styles/responsive.css, src/styles/global.css
5	padding: 0 14px;	src/pages/ListView.css, src/styles/responsive.css
5	padding: 12px 16px;	src/components/UI/InlineInput.css, src/styles/global.css
5	padding: 14px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
5	padding: 16px;	src/components/FocalBoard/FocalBoard.css, src/styles/global.css
5	padding: 6px 12px;	src/components/FocalBoard/FocalBoard.css, src/styles/global.css
5	padding: 6px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
4	gap: 24px;	src/pages/ListView.css, src/styles/global.css
4	gap: var(--space-2);	src/styles/global.css
4	margin-bottom: 4px;	src/components/FocalBoard/ActionList.css, src/styles/global.css
4	margin-top: 6px;	src/pages/ListView.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
4	padding-top: 4px;	src/components/FocalBoard/StatusSelect.css, src/styles/responsive.css, src/styles/global.css
4	padding-top: 8px;	src/styles/global.css
4	padding: 0 4px;	src/components/FocalBoard/StatusSelect.css, src/styles/responsive.css, src/styles/global.css
4	padding: 0 9px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
4	padding: 2px 4px;	src/styles/global.css
4	padding: 4px 0;	src/pages/ListView.css, src/components/UI/InlineInput.css, src/styles/global.css
3	gap: 20px;	src/pages/ListView.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css
3	gap: var(--space-1);	src/styles/responsive.css, src/styles/global.css
3	margin-bottom: 8px;	src/styles/responsive.css, src/styles/global.css
3	margin: 0 auto;	src/styles/global.css
3	padding-bottom: 12px;	src/styles/responsive.css, src/styles/global.css
3	padding-bottom: 6px;	src/styles/responsive.css, src/styles/global.css
3	padding-bottom: 8px;	src/styles/responsive.css, src/styles/global.css
3	padding: 0 2px;	src/styles/responsive.css, src/styles/global.css
3	padding: 26px 36px 26px 12px;	src/styles/global.css
3	padding: 40px;	src/styles/global.css
3	padding: 4px;	src/styles/global.css
3	padding: 6px 10px;	src/styles/global.css
3	padding: 8px 16px;	src/styles/global.css
3	padding: var(--delta-space-3) var(--delta-space-4);	src/styles/components.css, src/styles/global.css
3	padding: var(--delta-space-4) var(--delta-space-6);	src/styles/components.css
3	padding: var(--space-2);	src/styles/global.css
2	gap: 1px;	src/styles/global.css
2	gap: 3px;	src/styles/global.css
2	margin-bottom: 20px;	src/styles/global.css
2	margin-bottom: 6px;	src/styles/responsive.css, src/styles/global.css
2	margin-bottom: var(--space-1);	src/styles/global.css
2	margin-left: 0 !important;	src/styles/responsive.css, src/styles/global.css
2	margin-left: 26px;	src/styles/responsive.css
2	margin-top: 0;	src/styles/responsive.css, src/styles/global.css
2	margin-top: 10px;	src/styles/responsive.css
2	margin-top: 1px;	src/components/FocalBoard/ActionList.css
2	margin-top: 3px;	src/components/FocalBoard/StatusSelect.css, src/styles/global.css
2	margin: 0 0 12px 0;	src/styles/global.css
2	padding-bottom: 0;	src/styles/responsive.css
2	padding-bottom: 4px;	src/styles/responsive.css, src/styles/global.css
2	padding-left: 0;	src/styles/responsive.css
2	padding-right: 8px;	src/styles/global.css
2	padding-top: 0;	src/styles/responsive.css
2	padding-top: 2px;	src/styles/global.css
2	padding-top: 6px;	src/styles/responsive.css, src/styles/global.css
2	padding: 0 11px;	src/pages/ListView.css, src/styles/global.css
2	padding: 0 32px;	src/styles/global.css
2	padding: 10px 14px;	src/components/FocalBoard/ItemList.css, src/styles/global.css
2	padding: 10px 16px;	src/styles/global.css
2	padding: 12px 12px 10px;	src/styles/responsive.css
2	padding: 12px;	src/pages/ListView.css, src/styles/global.css
2	padding: 2px 0 0;	src/styles/responsive.css, src/styles/global.css
2	padding: 2px 8px;	src/styles/global.css
2	padding: 4px 12px;	src/components/FocalBoard/FocalBoard.css, src/styles/global.css
2	padding: 4px 4px 2px;	src/styles/global.css
2	padding: 6px 0;	src/components/FocalBoard/ActionList.css, src/styles/global.css
2	padding: 6px 16px;	src/styles/global.css
2	padding: 7px 8px;	src/styles/global.css
2	padding: 7px 9px;	src/styles/global.css
2	padding: 7px;	src/styles/global.css
2	padding: 8px 12px;	src/styles/global.css
2	padding: 8px 16px 14px;	src/styles/global.css
2	padding: 9px 10px;	src/styles/global.css
1	gap: 10px 14px;	src/styles/global.css
1	gap: 18px;	src/styles/responsive.css
1	gap: 6px 8px;	src/styles/global.css
1	gap: var(--delta-space-2);	src/styles/components.css
1	margin-bottom: 16px;	src/styles/global.css
1	margin-bottom: 24px;	src/styles/global.css
1	margin-bottom: 26px;	src/components/Auth/Login.css
1	margin-bottom: 2px;	src/styles/responsive.css
1	margin-bottom: 40px;	src/styles/global.css
1	margin-bottom: 60px;	src/styles/global.css
1	margin-bottom: var(--delta-space-2);	src/styles/global.css
1	margin-left: -1px;	src/styles/global.css
1	margin-left: 12px;	src/styles/global.css
1	margin-left: 180px;	src/styles/global.css
1	margin-left: 196px;	src/styles/global.css
1	margin-left: 24px;	src/pages/ListView.css
1	margin-left: 2px;	src/styles/global.css
1	margin-left: 32px;	src/components/FocalBoard/ItemList.css
1	margin-left: 44px;	src/styles/responsive.css
1	margin-left: 52px;	src/styles/responsive.css
1	margin-left: 8px;	src/styles/global.css
1	margin-left: var(--sidebar-expanded-width, 196px) !important;	src/styles/global.css
1	margin-left: var(--sidebar-width);	src/styles/global.css
1	margin-right: 0;	src/styles/responsive.css
1	margin-right: 6px;	src/styles/global.css
1	margin-right: 8px;	src/pages/ListView.css
1	margin-right: auto;	src/styles/global.css
1	margin-right: calc(var(--ai-panel-width) + (var(--ai-panel-gap) * 2) + 8px);	src/styles/global.css
1	margin-top: 0 !important;	src/styles/responsive.css
1	margin-top: 16px;	src/components/Auth/Login.css
1	margin-top: 32px;	src/styles/global.css
1	margin-top: auto;	src/styles/global.css
1	margin-top: var(--delta-space-2);	src/styles/global.css
1	margin-top: var(--header-height-sm);	src/styles/global.css
1	margin-top: var(--space-1);	src/styles/global.css
1	margin: 0 !important;	src/styles/global.css
1	margin: 0 0 24px 0;	src/styles/global.css
1	margin: 0 0 6px 0;	src/components/Auth/Login.css
1	margin: 0 0 8px 0;	src/components/FocalBoard/FocalBoard.css
1	margin: 0 0 8px;	src/components/FocalBoard/ItemList.css
1	margin: 0 12px;	src/components/FocalBoard/ItemList.css
1	margin: 0 16px;	src/styles/global.css
1	margin: 0 auto !important;	src/styles/global.css
1	margin: 0 auto 8px;	src/styles/responsive.css
1	margin: 12px 14px 0;	src/components/FocalBoard/LaneList.css
1	margin: 14px 8px;	src/styles/global.css
1	margin: 1px 0;	src/styles/global.css
1	margin: 20px 8px;	src/styles/global.css
1	margin: 2px 0 8px;	src/styles/responsive.css
1	margin: 2px 0;	src/styles/global.css
1	margin: 2px auto 10px;	src/styles/responsive.css
1	margin: 2px auto 8px;	src/styles/responsive.css
1	margin: 6px 6px 6px;	src/styles/global.css
1	margin: 8px 14px 0;	src/components/FocalBoard/ItemList.css
1	margin: 8px 16px;	src/styles/global.css
1	padding-bottom: 1px;	src/components/FocalBoard/LaneList.css
1	padding-left: 12px !important;	src/styles/global.css
1	padding-left: 22px;	src/styles/global.css
1	padding-left: 32px;	src/styles/global.css
1	padding-left: 8px;	src/styles/global.css
1	padding-right: 0;	src/styles/responsive.css
1	padding-right: 34px;	src/styles/global.css
1	padding-right: 36px;	src/styles/responsive.css
1	padding-right: 42px;	src/styles/global.css
1	padding-right: 46px;	src/styles/responsive.css
1	padding-right: 4px;	src/styles/global.css
1	padding-top: 10px;	src/styles/global.css
1	padding-top: 18px;	src/styles/responsive.css
1	padding-top: var(--space-3);	src/styles/global.css
1	padding: 0 !important;	src/styles/responsive.css
1	padding: 0 0 0 20px;	src/components/FocalBoard/ItemList.css
1	padding: 0 0 10px;	src/styles/responsive.css
1	padding: 0 0 12px;	src/styles/global.css
1	padding: 0 0 2px;	src/styles/responsive.css
1	padding: 0 0 5px !important;	src/styles/global.css
1	padding: 0 0 5px;	src/styles/global.css
1	padding: 0 0 8px;	src/styles/responsive.css
1	padding: 0 10px !important;	src/styles/global.css
1	padding: 0 10px 86px;	src/styles/responsive.css
1	padding: 0 12px 12px;	src/styles/global.css
1	padding: 0 14px !important;	src/styles/global.css
1	padding: 0 15px;	src/components/Auth/Login.css
1	padding: 0 16px;	src/styles/global.css
1	padding: 0 5px;	src/pages/ListView.css
1	padding: 0 6px 0 10px;	src/styles/global.css
1	padding: 0 6px;	src/pages/ListView.css
1	padding: 0 7px;	src/components/FocalBoard/LaneList.css
1	padding: 0 8px 8px;	src/styles/global.css
1	padding: 0 calc(0px + env(safe-area-inset-left)) 0 calc(0px + env(safe-area-inset-right));	src/styles/responsive.css
1	padding: 0 var(--space-2);	src/styles/global.css
1	padding: 10px 10px;	src/styles/global.css
1	padding: 10px 12px 10px 12px;	src/styles/responsive.css
1	padding: 10px 12px 12px;	src/styles/responsive.css
1	padding: 10px 12px 6px;	src/styles/global.css
1	padding: 10px 12px 8px;	src/styles/global.css
1	padding: 10px 12px 96px;	src/styles/responsive.css
1	padding: 10px 12px 9px;	src/styles/responsive.css
1	padding: 10px 14px 130px;	src/styles/responsive.css
1	padding: 10px 14px calc(14px + env(safe-area-inset-bottom));	src/styles/responsive.css
1	padding: 10px 16px 6px;	src/styles/responsive.css
1	padding: 10px 48px 10px 12px;	src/styles/global.css
1	padding: 10px 54px 10px 12px;	src/styles/responsive.css
1	padding: 10px 8px 10px;	src/styles/global.css
1	padding: 10px 9px;	src/styles/global.css
1	padding: 11px 14px;	src/components/FocalBoard/LaneList.css
1	padding: 11px;	src/styles/global.css
1	padding: 14px 14px 8px;	src/styles/responsive.css
1	padding: 14px 16px 10px;	src/styles/global.css
1	padding: 14px 16px;	src/styles/global.css
1	padding: 14px 18px;	src/components/FocalBoard/LaneList.css
1	padding: 16px 16px 10px;	src/styles/global.css
1	padding: 16px 16px 14px;	src/styles/global.css
1	padding: 16px 6px 94px;	src/styles/responsive.css
1	padding: 18px 12px;	src/pages/ListView.css
1	padding: 18px 16px 14px;	src/styles/global.css
1	padding: 18px 24px;	src/components/FocalBoard/FocalBoard.css
1	padding: 1px 3px;	src/styles/global.css
1	padding: 1px 6px;	src/components/FocalBoard/ItemList.css
1	padding: 1px;	src/styles/global.css
1	padding: 20px 24px 24px;	src/styles/global.css
1	padding: 20px 24px;	src/components/FocalBoard/LaneList.css
1	padding: 24px;	src/styles/global.css
1	padding: 2px 0 2px;	src/styles/responsive.css
1	padding: 2px 0;	src/styles/global.css
1	padding: 2px 14px 110px;	src/styles/responsive.css
1	padding: 2px 20px 2px 6px;	src/styles/global.css
1	padding: 2px 2px 6px;	src/styles/global.css
1	padding: 2px 7px;	src/components/FocalBoard/StatusSelect.css
1	padding: 3px 0;	src/styles/responsive.css
1	padding: 3px 5px;	src/styles/global.css
1	padding: 3px 6px 3px 8px;	src/components/FocalBoard/ActionList.css
1	padding: 3px 9px;	src/styles/global.css
1	padding: 40px 20px;	src/components/FocalBoard/FocalBoard.css
1	padding: 40px 24px;	src/components/Auth/Login.css
1	padding: 46px 12px 12px;	src/styles/global.css
1	padding: 4px 0 0;	src/styles/global.css
1	padding: 4px 0 8px 16px;	src/styles/global.css
1	padding: 4px 0 8px;	src/styles/global.css
1	padding: 4px 10px;	src/styles/global.css
1	padding: 4px 12px 10px;	src/pages/ListView.css
1	padding: 4px 16px 4px !important;	src/styles/global.css
1	padding: 4px 8px !important;	src/styles/global.css
1	padding: 5px 10px;	src/styles/global.css
1	padding: 5px 11px;	src/styles/global.css
1	padding: 5px 8px;	src/styles/global.css
1	padding: 5px;	src/components/FocalBoard/StatusSelect.css
1	padding: 60px 20px;	src/styles/global.css
1	padding: 6px 0 10px 18px;	src/styles/global.css
1	padding: 6px 0 8px 16px;	src/styles/global.css
1	padding: 6px 4px;	src/styles/global.css
1	padding: 6px 7px;	src/styles/responsive.css
1	padding: 6px 8px !important;	src/styles/global.css
1	padding: 6px 8px 8px 40px;	src/pages/ListView.css
1	padding: 7px 10px;	src/components/FocalBoard/ItemList.css
1	padding: 7px 11px;	src/styles/global.css
1	padding: 8px !important;	src/styles/global.css
1	padding: 8px 0 12px;	src/components/FocalBoard/ItemList.css
1	padding: 8px 10px 10px 44px;	src/styles/global.css
1	padding: 8px 12px 6px;	src/components/FocalBoard/ActionList.css
1	padding: 8px 12px 8px 8px;	src/styles/global.css
1	padding: 8px 16px calc(12px + env(safe-area-inset-bottom));	src/styles/responsive.css
1	padding: 8px 18px calc(14px + env(safe-area-inset-bottom));	src/styles/responsive.css
1	padding: 8px 8px 12px;	src/pages/ListView.css
1	padding: 8px 8px 8px 12px;	src/components/FocalBoard/ItemList.css
1	padding: 8px 9px;	src/styles/global.css
1	padding: var(--delta-space-2) var(--delta-space-3);	src/styles/components.css
1	padding: var(--delta-space-6);	src/styles/components.css
1	padding: var(--space-1) var(--space-2);	src/styles/global.css
1	padding: var(--space-1);	src/styles/global.css
1	padding: var(--space-2) 8px;	src/styles/global.css
1	padding: var(--space-3) 0;	src/styles/global.css
```

---

## STEP 5 — SHAPE TOKENS (RADIUS + BORDERS)

### Inventory summary
- Unique border/radius/outline declarations: **204**
- Frequent radii: `6px`, `8px`, `10px`, `12px`, `14px`, `18px`, `999px`
- Frequent border pattern: `1px solid ...`

### Candidate radius tokens
- `--r-xs: 6px`
- `--r-sm: 10px`
- `--r-md: 14px`
- `--r-lg: 18px`
- `--r-xl: 24px`
- `--r-full: 9999px`

### Border token candidate buckets
- `border-subtle`: 1px solid neutral divider
- `border-strong`: 1px solid high-contrast neutral
- `border-accent`: 1px solid accent blue
- `border-dashed`: 1px dashed neutral

### Full extracted shape declarations (count | declaration | files)
```text
121	border: none;	src/pages/ListView.css, src/components/Auth/Login.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/components/FocalBoard/StatusSelect.css, src/components/UI/InlineInput.css, src/styles/responsive.css, src/styles/global.css
58	border-radius: 8px;	src/pages/ListView.css, src/components/UI/InlineInput.css, src/styles/responsive.css, src/styles/global.css
42	border-radius: 10px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/Auth/Login.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/StatusSelect.css, src/styles/responsive.css, src/styles/global.css
35	outline: none;	src/pages/ListView.css, src/components/Auth/Login.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/ItemList.css, src/components/UI/InlineInput.css, src/styles/components.css, src/styles/responsive.css, src/styles/global.css
34	border-radius: 999px;	src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/components/FocalBoard/StatusSelect.css, src/styles/responsive.css, src/styles/global.css
26	border-radius: 6px;	src/pages/ListView.css, src/components/FocalBoard/StatusSelect.css, src/components/UI/InlineInput.css, src/styles/global.css
20	border-radius: 14px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
18	border-radius: 0;	src/pages/ListView.css, src/components/Auth/Login.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
18	border-radius: 12px;	src/pages/ListView.css, src/components/Auth/Login.css, src/styles/responsive.css, src/styles/global.css
14	border-radius: 7px;	src/pages/ListView.css, src/components/FocalBoard/StatusSelect.css, src/styles/responsive.css, src/styles/global.css
12	border-radius: 4px;	src/pages/ListView.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
12	border-radius: var(--r-md);	src/styles/responsive.css, src/styles/global.css
12	border: 1px solid #d8dbe2;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
11	border: 1px solid #d4d4d8;	src/pages/ListView.css, src/styles/global.css
10	border-bottom: none;	src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
8	border-radius: 18px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
8	border-radius: 50%;	src/pages/ListView.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/StatusSelect.css, src/styles/responsive.css, src/styles/global.css
8	border-top: none;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/styles/responsive.css, src/styles/global.css
7	border-radius: 9px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
6	border-radius: 16px;	src/styles/responsive.css, src/styles/global.css
6	border-radius: var(--radius-sm);	src/styles/global.css
6	border: 1px solid #ececf2;	src/styles/global.css
6	border: 1px solid var(--color-border);	src/styles/global.css
5	border-radius: var(--r-lg);	src/styles/responsive.css, src/styles/global.css
5	border-radius: var(--r-sm);	src/styles/responsive.css, src/styles/global.css
5	border: 1px solid #111827;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/ActionList.css
5	border: 1px solid #e4e6ea;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
5	border: 1px solid #e5e7eb;	src/components/UI/InlineInput.css, src/styles/global.css
5	border: 1px solid transparent;	src/pages/ListView.css, src/components/FocalBoard/LaneList.css, src/styles/global.css
4	border-bottom: 1px solid rgba(20, 27, 38, 0.08);	src/styles/responsive.css, src/styles/global.css
4	border-radius: 22px;	src/styles/responsive.css, src/styles/global.css
4	border-radius: 5px;	src/styles/global.css
4	border: 1px solid #e4e4e7;	src/pages/ListView.css, src/styles/global.css
4	border: 1px solid rgba(0, 199, 255, 0.88);	src/styles/global.css
3	border-bottom: 1px solid #e8ebf0;	src/pages/ListView.css, src/components/FocalBoard/ItemList.css
3	border-bottom: 1px solid #efeff1;	src/pages/ListView.css
3	border-bottom: 1px solid rgba(20, 27, 38, 0.1);	src/styles/responsive.css
3	border-radius: var(--delta-radius-md);	src/styles/components.css
3	border-radius: var(--radius-md);	src/styles/global.css
3	border-right: none;	src/pages/ListView.css, src/styles/global.css
3	border: #e4e6ea;	src/styles/design-tokens.css, src/styles/global.css
3	border: 1px solid #00c7ff;	src/styles/responsive.css, src/styles/global.css
3	border: 1px solid #dadadd;	src/pages/ListView.css
3	border: 1px solid #e0e0e0;	src/styles/global.css
2	border-bottom: 1px solid #e2e7ef;	src/styles/responsive.css
2	border-bottom: 1px solid #e5e7eb;	src/styles/global.css
2	border-bottom: 1px solid #e6e8ed;	src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css
2	border-bottom: 1px solid #eceef4;	src/styles/global.css
2	border-bottom: 1px solid #f0f0f3;	src/styles/global.css
2	border-bottom: 1px solid var(--delta-border-surface);	src/styles/components.css
2	border-radius: 11px;	src/styles/global.css
2	border-radius: 24px;	src/styles/responsive.css, src/styles/global.css
2	border-radius: 26px 26px 0 0;	src/styles/responsive.css
2	border-radius: 2px;	src/styles/global.css
2	border-radius: var(--r-md) !important;	src/styles/global.css
2	border-right: 1px solid #ececf2;	src/styles/global.css
2	border-top: 1px solid #e9ecf1;	src/pages/ListView.css, src/components/ProposalReviewTable.css
2	border: 1.5px solid #c9ced9;	src/styles/global.css
2	border: 1px solid #d0d0d0;	src/styles/global.css
2	border: 1px solid #d7e0f1;	src/components/Auth/Login.css
2	border: 1px solid #d8dde5;	src/pages/ListView.css, src/styles/responsive.css
2	border: 1px solid #d8dde6;	src/styles/responsive.css
2	border: 1px solid #d9dde4;	src/styles/responsive.css, src/styles/global.css
2	border: 1px solid #d9dee7;	src/styles/global.css
2	border: 1px solid #dce1e9;	src/styles/responsive.css
2	border: 1px solid #e1e4ec;	src/styles/global.css
2	border: 1px solid #efeff1;	src/pages/ListView.css
2	border: 1px solid rgba(255, 255, 255, 0.2);	src/styles/global.css
2	border: 1px solid var(--delta-border-surface);	src/styles/components.css
2	border: 2.2px solid #d4d9e1;	src/styles/responsive.css
2	border: none !important;	src/styles/global.css
1	border-bottom: 1px solid #333333;	src/styles/global.css
1	border-bottom: 1px solid #d9dee7;	src/styles/global.css
1	border-bottom: 1px solid #e2e2e2;	src/styles/global.css
1	border-bottom: 1px solid #e4e6ea;	src/components/FocalBoard/FocalBoard.css
1	border-bottom: 1px solid #e8ebf3;	src/styles/global.css
1	border-bottom: 1px solid #e9ecf1;	src/components/FocalBoard/FocalBoard.css
1	border-bottom: 1px solid #ececec;	src/styles/global.css
1	border-bottom: 1px solid #ececf2;	src/styles/global.css
1	border-bottom: 1px solid #eeeeee;	src/styles/global.css
1	border-bottom: 1px solid #eef1f8;	src/styles/global.css
1	border-bottom: 1px solid #f0f0f0;	src/styles/global.css
1	border-bottom: 1px solid #f0f2f7;	src/styles/global.css
1	border-bottom: 1px solid #f4f4f8;	src/styles/global.css
1	border-bottom: 1px solid rgba(0, 0, 0, 0.06);	src/styles/global.css
1	border-bottom: 1px solid rgba(255, 255, 255, 0.1);	src/styles/global.css
1	border-bottom: 1px solid transparent;	src/styles/global.css
1	border-left: 1px solid #e3e6ec;	src/styles/responsive.css
1	border-left: 1px solid #e6e8ed;	src/styles/global.css
1	border-left: 1px solid #ececf0;	src/styles/global.css
1	border-left: none;	src/components/FocalBoard/ItemList.css
1	border-radius: 0 0 16px 16px;	src/styles/global.css
1	border-radius: 0 9px 9px 0;	src/styles/global.css
1	border-radius: 13px;	src/styles/responsive.css
1	border-radius: 15px;	src/styles/global.css
1	border-radius: 16px 16px 0 0;	src/styles/global.css
1	border-radius: 24px 24px 0 0;	src/styles/responsive.css
1	border-radius: 26px;	src/styles/global.css
1	border-radius: 28px;	src/styles/global.css
1	border-radius: 48px;	src/styles/global.css
1	border-radius: 6px !important;	src/styles/global.css
1	border-radius: 9px 0 0 9px;	src/styles/global.css
1	border-radius: inherit;	src/components/FocalBoard/FocalBoard.css
1	border-radius: var(--delta-radius-lg);	src/styles/components.css
1	border-radius: var(--delta-radius-xl);	src/styles/components.css
1	border-right: 1px solid #e4e4e7;	src/styles/global.css
1	border-right: 1px solid #e4e6ea;	src/styles/global.css
1	border-right: 1px solid #efeff1;	src/pages/ListView.css
1	border-right: 1px solid #efeff4;	src/styles/global.css
1	border-right: 1px solid #f0f0f4;	src/styles/global.css
1	border-right: 1px solid var(--color-border) !important;	src/styles/global.css
1	border-right: 1px solid var(--color-border);	src/styles/global.css
1	border-right: 1px solid var(--delta-border-surface);	src/styles/components.css
1	border-top: 1px solid #e5e7eb;	src/styles/global.css
1	border-top: 1px solid #ececec;	src/styles/global.css
1	border-top: 1px solid #ececf2;	src/styles/global.css
1	border-top: 1px solid #eceff5;	src/styles/global.css
1	border-top: 1px solid #edf1fb;	src/styles/global.css
1	border-top: 1px solid #edf2fb;	src/components/FocalBoard/StatusSelect.css
1	border-top: 1px solid #f0f0f3;	src/styles/global.css
1	border-top: 1px solid #f1f1f3;	src/pages/ListView.css
1	border-top: 1px solid #f1f1f4;	src/styles/global.css
1	border-top: 1px solid #f1f2f6;	src/styles/global.css
1	border-top: 1px solid #f7f7fa;	src/styles/global.css
1	border-top: 1px solid var(--color-border);	src/styles/global.css
1	border-top: 2px solid #e33939;	src/styles/global.css
1	border: 1.5px solid;	src/components/FocalBoard/ActionList.css
1	border: 1px dashed #d0d5de;	src/components/FocalBoard/LaneList.css
1	border: 1px dashed #dce0ef;	src/styles/global.css
1	border: 1px dashed #dddddd;	src/styles/global.css
1	border: 1px dashed #dfe5f7;	src/styles/global.css
1	border: 1px dashed #e2e5f2;	src/styles/global.css
1	border: 1px dashed #e6e8f0;	src/styles/global.css
1	border: 1px dashed rgba(67, 86, 155, 0.35);	src/styles/global.css
1	border: 1px solid #00b7f4;	src/pages/ListView.css
1	border: 1px solid #00c7ff !important;	src/styles/global.css
1	border: 1px solid #18181b;	src/components/FocalBoard/FocalBoard.css
1	border: 1px solid #252a31 !important;	src/styles/global.css
1	border: 1px solid #3f81f9;	src/styles/global.css
1	border: 1px solid #6f5de0;	src/styles/global.css
1	border: 1px solid #bfc5ce;	src/styles/responsive.css
1	border: 1px solid #cad2dc;	src/styles/responsive.css
1	border: 1px solid #cfd1d9;	src/styles/global.css
1	border: 1px solid #cfd5e2;	src/styles/global.css
1	border: 1px solid #cfd6e0;	src/styles/responsive.css
1	border: 1px solid #cfd7ef;	src/styles/global.css
1	border: 1px solid #d0d6de;	src/styles/responsive.css
1	border: 1px solid #d1d5db;	src/styles/global.css
1	border: 1px solid #d2d4dc;	src/styles/global.css
1	border: 1px solid #d2d7e1;	src/styles/global.css
1	border: 1px solid #d2d8e1;	src/styles/responsive.css
1	border: 1px solid #d2d9e2;	src/styles/global.css
1	border: 1px solid #d3d9e2;	src/styles/responsive.css
1	border: 1px solid #d4dae3;	src/styles/responsive.css
1	border: 1px solid #d4deef;	src/components/Auth/Login.css
1	border: 1px solid #d5d8e1;	src/styles/global.css
1	border: 1px solid #d5dbe3;	src/styles/responsive.css
1	border: 1px solid #d5dbe4;	src/styles/responsive.css
1	border: 1px solid #d6d6db;	src/pages/ListView.css
1	border: 1px solid #d6dbe3;	src/styles/responsive.css
1	border: 1px solid #d6dce6;	src/pages/ListView.css
1	border: 1px solid #d7dbe2;	src/styles/global.css
1	border: 1px solid #d7dce4;	src/styles/global.css
1	border: 1px solid #d8d9df;	src/styles/global.css
1	border: 1px solid #d8dce7;	src/styles/global.css
1	border: 1px solid #d8deef;	src/styles/global.css
1	border: 1px solid #d9d9de;	src/styles/global.css
1	border: 1px solid #d9dbe3;	src/styles/global.css
1	border: 1px solid #d9dbe4;	src/styles/global.css
1	border: 1px solid #dbe0eb;	src/styles/global.css
1	border: 1px solid #dbe3f1;	src/components/FocalBoard/StatusSelect.css
1	border: 1px solid #dbe5ff;	src/styles/global.css
1	border: 1px solid #dce0e9;	src/styles/global.css
1	border: 1px solid #dfdfdf;	src/styles/global.css
1	border: 1px solid #dfdfe6;	src/styles/global.css
1	border: 1px solid #dfe3ec;	src/styles/global.css
1	border: 1px solid #e1e2e8;	src/styles/global.css
1	border: 1px solid #e4e6ea !important;	src/styles/global.css
1	border: 1px solid #e5e6ec;	src/styles/global.css
1	border: 1px solid #e6eaf0;	src/pages/ListView.css
1	border: 1px solid #e7e8ed;	src/styles/global.css
1	border: 1px solid #e8ebf0;	src/components/ProposalReviewTable.css
1	border: 1px solid #e9edf6;	src/styles/global.css
1	border: 1px solid #ececec;	src/styles/global.css
1	border: 1px solid #ececef;	src/pages/ListView.css
1	border: 1px solid #efefef;	src/styles/global.css
1	border: 1px solid #efeff4;	src/styles/global.css
1	border: 1px solid #fecaca;	src/styles/global.css
1	border: 1px solid rgba(0, 0, 0, 0.14);	src/styles/global.css
1	border: 1px solid rgba(0, 183, 244, 0.88);	src/pages/ListView.css
1	border: 1px solid rgba(129, 162, 255, 0.65);	src/styles/global.css
1	border: 1px solid rgba(209, 219, 245, 0.9);	src/styles/global.css
1	border: 1px solid rgba(255, 255, 255, 0.1);	src/styles/global.css
1	border: 1px solid rgba(255, 255, 255, 0.8);	src/styles/global.css
1	border: 1px solid rgba(68, 86, 147, 0.24);	src/styles/global.css
1	border: 1px solid rgba(79, 120, 255, 0.38);	src/styles/global.css
1	border: 2px solid #00c7ff;	src/styles/responsive.css
1	border: 2px solid #b8bfcb;	src/styles/global.css
1	border: 2px solid var(--delta-border-primary);	src/styles/components.css
1	border: 2px solid var(--delta-border-secondary);	src/styles/components.css
1	border: 2px solid var(--status-color, #94a3b8);	src/components/FocalBoard/StatusSelect.css
1	outline: 2px solid #c9ced6;	src/styles/hover-focus.css
1	outline: 2px solid #d4d4d8;	src/styles/global.css
1	outline: 2px solid rgba(100, 41, 248, 1);	src/components/UI/InlineInput.css
```

---

## STEP 6 — SHADOW / DEPTH INVENTORY

### Inventory summary
- Unique depth declarations (`box-shadow`, `filter`, `backdrop-filter`): **77**
- Mix of no-shadow, subtle depth, and accent glow effects.

### Candidate depth token families
- `shadow-none`
- `shadow-hairline` (0 0 0 1px ...)
- `shadow-soft-sm` (1–2px y offset)
- `shadow-soft-md` (4–8px y offset)
- `shadow-soft-lg` (10px+ y offset)
- `shadow-accent-glow` (blue glow variants)

### Full extracted depth declarations (count | declaration | files)
```text
30	box-shadow: none;	src/pages/ListView.css, src/components/Auth/Login.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/styles/components.css, src/styles/responsive.css, src/styles/global.css
8	filter: brightness(1.03);	src/pages/ListView.css, src/styles/global.css
5	filter: brightness(0) invert(1);	src/styles/global.css
4	box-shadow: none !important;	src/styles/global.css
3	box-shadow: 0 0 0 1px rgba(161, 161, 170, 0.35);	src/pages/ListView.css, src/styles/global.css
3	box-shadow: 0 8px 26px rgba(18, 24, 38, 0.08);	src/styles/global.css
2	box-shadow: 0 0 0 0 rgba(63, 113, 255, 0.2), 0 0 0 0 rgba(255, 112, 207, 0.12);	src/styles/global.css
2	box-shadow: 0 0 0 3px var(--delta-primary-400), 0 0 0 6px rgba(59, 130, 246, 0.15);	src/styles/components.css
2	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);	src/styles/global.css
2	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);	src/styles/global.css
2	box-shadow: var(--delta-shadow-sm);	src/styles/components.css
2	filter: brightness(1.04);	src/styles/global.css
2	filter: brightness(1.06);	src/styles/global.css
1	backdrop-filter: blur(10px);	src/styles/global.css
1	backdrop-filter: blur(16px);	src/styles/components.css
1	backdrop-filter: blur(24px);	src/styles/global.css
1	backdrop-filter: blur(8px);	src/styles/responsive.css
1	backdrop-filter: none;	src/styles/global.css
1	box-shadow: 0 -14px 36px rgba(25, 31, 39, 0.12);	src/styles/responsive.css
1	box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06);	src/styles/global.css
1	box-shadow: 0 0 0 1px rgba(0, 181, 254, 0.5);	src/styles/global.css
1	box-shadow: 0 0 0 1px rgba(0, 199, 255, 0.42), 0 8px 18px rgba(0, 199, 255, 0.26);	src/styles/global.css
1	box-shadow: 0 0 0 1px rgba(0, 199, 255, 0.5), 0 8px 20px rgba(0, 199, 255, 0.34);	src/styles/global.css
1	box-shadow: 0 0 0 1px rgba(117, 155, 249, 0.34);	src/styles/global.css
1	box-shadow: 0 0 0 1px rgba(146, 181, 255, 0.52), 0 10px 24px rgba(60, 103, 223, 0.35);	src/styles/global.css
1	box-shadow: 0 0 0 1px rgba(228, 228, 231, 0.9), 0 6px 14px rgba(24, 24, 27, 0.06);	src/styles/global.css
1	box-shadow: 0 0 0 1px rgba(76, 140, 255, 0.16), 0 4px 10px rgba(207, 78, 203, 0.14);	src/styles/global.css
1	box-shadow: 0 0 0 1px var(--color-accent-primary);	src/styles/global.css
1	box-shadow: 0 0 0 2px rgba(100, 41, 248, 0.1);	src/components/UI/InlineInput.css
1	box-shadow: 0 0 0 2px rgba(237, 242, 253, 0.9);	src/components/Auth/Login.css
1	box-shadow: 0 0 0 2px rgba(63, 113, 255, 0.22), 0 0 0 6px rgba(255, 112, 207, 0.1);	src/styles/global.css
1	box-shadow: 0 0 6px rgba(228, 75, 75, 0.4);	src/styles/responsive.css
1	box-shadow: 0 0 8px rgba(228, 75, 75, 0.45);	src/styles/responsive.css
1	box-shadow: 0 10px 22px rgba(62, 101, 215, 0.34);	src/styles/global.css
1	box-shadow: 0 10px 24px -20px rgba(0, 0, 0, 0.22);	src/styles/global.css
1	box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);	src/components/FocalBoard/StatusSelect.css
1	box-shadow: 0 10px 24px rgba(26, 32, 42, 0.14);	src/styles/responsive.css
1	box-shadow: 0 10px 30px rgba(13, 17, 26, 0.08);	src/pages/ListView.css
1	box-shadow: 0 12px 26px -20px rgba(0, 181, 254, 0.88);	src/styles/global.css
1	box-shadow: 0 12px 32px rgba(63, 113, 255, 0.18), 0 0 0 1px rgba(255, 112, 207, 0.24);	src/styles/global.css
1	box-shadow: 0 18px 40px rgba(20, 28, 40, 0.16);	src/styles/responsive.css
1	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);	src/styles/global.css
1	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);	src/styles/global.css
1	box-shadow: 0 1px 2px rgba(25, 30, 50, 0.06);	src/styles/global.css
1	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);	src/components/UI/InlineInput.css
1	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);	src/styles/global.css
1	box-shadow: 0 25px 80px rgba(0, 0, 0, 0.12);	src/styles/global.css
1	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);	src/styles/hover-focus.css
1	box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);	src/styles/global.css
1	box-shadow: 0 2px 8px rgba(20, 28, 40, 0.055);	src/styles/responsive.css
1	box-shadow: 0 4px 12px rgba(19, 24, 39, 0.12);	src/styles/global.css
1	box-shadow: 0 4px 14px rgba(12, 14, 18, 0.08);	src/styles/global.css
1	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);	src/styles/global.css
1	box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);	src/styles/global.css
1	box-shadow: 0 5px 14px rgba(38, 59, 132, 0.17);	src/styles/global.css
1	box-shadow: 0 6px 14px rgba(0, 199, 255, 0.24);	src/styles/global.css
1	box-shadow: 0 6px 14px rgba(50, 74, 168, 0.2);	src/styles/global.css
1	box-shadow: 0 6px 16px rgba(0, 199, 255, 0.22);	src/styles/global.css
1	box-shadow: 0 7px 18px rgba(58, 95, 201, 0.3);	src/styles/global.css
1	box-shadow: 0 8px 18px rgba(0, 199, 255, 0.3);	src/styles/global.css
1	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);	src/styles/global.css
1	box-shadow: 0 8px 24px rgba(14, 20, 34, 0.14);	src/styles/global.css
1	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);	src/styles/global.css
1	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);	src/styles/global.css
1	box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.85);	src/styles/global.css
1	box-shadow: inset 0 0 0 1px #e4e4e7;	src/styles/global.css
1	box-shadow: inset 0 0 0 1px #ffffff;	src/pages/ListView.css
1	box-shadow: var(--delta-shadow-2xl);	src/styles/components.css
1	box-shadow: var(--delta-shadow-lg);	src/styles/components.css
1	box-shadow: var(--delta-shadow-md);	src/styles/components.css
1	filter: blur(18px);	src/styles/global.css
1	filter: blur(3px);	src/styles/global.css
1	filter: blur(4px);	src/styles/global.css
1	filter: brightness(1.01);	src/styles/global.css
1	filter: brightness(1.05);	src/styles/hover-focus.css
1	filter: saturate(0.95);	src/styles/global.css
1	filter: saturate(1.05);	src/styles/global.css
```

---

## STEP 7 — ANIMATION / MOTION INVENTORY

### Inventory summary
- Unique motion declarations (`transition*`, `animation*`): **72**
- Duration range in active use: ~90ms to 420ms
- Easing families in active use:
  - `ease`, `ease-in-out`, `linear`
  - `cubic-bezier(0.22, 1, 0.36, 1)`
  - `cubic-bezier(0.4, 0, 0.2, 1)`
  - `cubic-bezier(0.2, 0.9, 0.2, 1)`

### Candidate motion tokens
- `motion-fast`: 120–150ms
- `motion-normal`: 180–220ms
- `motion-slow`: 260–340ms
- `ease-standard`: cubic-bezier(0.22, 1, 0.36, 1)
- `ease-ui`: cubic-bezier(0.4, 0, 0.2, 1)

### Full extracted motion declarations (count | declaration | files)
```text
6	transition: background-color 0.15s ease;	src/components/Auth/Login.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css, src/styles/global.css
6	transition: background-color 150ms ease;	src/styles/global.css
5	transition: all 180ms cubic-bezier(0.22, 1, 0.36, 1);	src/components/FocalBoard/ActionList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css
5	transition: opacity 0.2s ease;	src/styles/global.css
4	animation: none;	src/styles/responsive.css, src/styles/global.css
4	transition: all 0.15s ease;	src/components/UI/InlineInput.css, src/styles/global.css
4	transition: all var(--delta-duration-normal) var(--delta-ease-in-out);	src/styles/components.css
4	transition: background 0.2s ease;	src/styles/global.css
3	transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);	src/styles/global.css
3	transition: none;	src/styles/responsive.css, src/styles/global.css
2	animation: drawer-up 180ms cubic-bezier(0.2, 0, 0.2, 1);	src/styles/global.css
2	animation: mobile-capture-bg 6.4s ease-in-out infinite alternate;	src/styles/responsive.css
2	transition: all 0.2s ease;	src/styles/global.css
2	transition: background-color 0.2s ease;	src/styles/global.css
2	transition: background-color 180ms cubic-bezier(0.22, 1, 0.36, 1);	src/components/FocalBoard/ItemList.css, src/components/FocalBoard/FocalBoard.css
2	transition: opacity 0.15s ease, transform 0.15s ease;	src/styles/global.css
2	transition: opacity 120ms ease, background-color 120ms ease;	src/styles/global.css
2	transition: transform 120ms ease;	src/pages/ListView.css, src/components/FocalBoard/StatusSelect.css
2	transition: transform 140ms ease;	src/components/FocalBoard/ItemList.css, src/styles/global.css
2	transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/responsive.css, src/styles/global.css
1	animation-duration: 220ms !important;	src/styles/global.css
1	animation-timing-function: var(--motion-ease-soft) !important;	src/styles/global.css
1	animation: ai-button-gradient-shift 4.2s ease-in-out infinite;	src/styles/global.css
1	animation: ai-panel-enter 220ms cubic-bezier(0.2, 0, 0.2, 1);	src/styles/global.css
1	animation: ask-delta-pulse 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite;	src/styles/global.css
1	animation: ask-delta-rotate 3.6s linear infinite;	src/styles/global.css
1	animation: calendar-contents-enter 170ms ease;	src/styles/global.css
1	animation: drawer-context-pulse 1.8s ease-in-out infinite;	src/styles/global.css
1	animation: drawer-phase-enter 150ms ease;	src/styles/global.css
1	animation: event-drawer-ai-handoff 280ms cubic-bezier(0.2, 0, 0.2, 1);	src/styles/global.css
1	animation: fade-in 200ms ease-out;	src/styles/global.css
1	animation: fadeIn var(--delta-duration-normal) var(--delta-ease-in);	src/styles/components.css
1	animation: fullscreen-expand 300ms cubic-bezier(0.2, 0, 0.2, 1);	src/styles/global.css
1	animation: launchpad-reveal 250ms ease-in-out;	src/styles/global.css
1	animation: mobile-add-sheet-in 320ms cubic-bezier(0.2, 0.9, 0.2, 1);	src/styles/responsive.css
1	animation: mobile-add-sheet-in 340ms cubic-bezier(0.2, 0.9, 0.2, 1);	src/styles/responsive.css
1	animation: mobile-capture-in 240ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/responsive.css
1	animation: mobile-capture-in 280ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/responsive.css
1	animation: pulse 1.5s ease-in-out infinite;	src/styles/global.css
1	animation: slideIn var(--delta-duration-normal) var(--delta-ease-out);	src/styles/components.css
1	transition: all 150ms ease !important;	src/styles/global.css
1	transition: background 180ms ease, border-color 180ms ease;	src/styles/responsive.css
1	transition: background-color 150ms cubic-bezier(0.4, 0, 0.2, 1);	src/styles/global.css
1	transition: background-color 150ms ease, border-color 150ms ease;	src/styles/global.css
1	transition: background-color 180ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms cubic-bezier(0.22, 1, 0.36, 1);	src/components/FocalBoard/LaneList.css
1	transition: background-color 180ms ease, box-shadow 180ms ease;	src/styles/responsive.css
1	transition: border-color 0.15s ease, box-shadow 0.15s ease;	src/components/Auth/Login.css
1	transition: border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1);	src/styles/global.css
1	transition: border-color 220ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/global.css
1	transition: color 150ms cubic-bezier(0.4, 0, 0.2, 1);	src/styles/global.css
1	transition: color 180ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/responsive.css
1	transition: filter 140ms ease, box-shadow 140ms ease, transform 140ms ease;	src/styles/global.css
1	transition: filter 150ms cubic-bezier(0.4, 0, 0.2, 1);	src/styles/global.css
1	transition: filter 170ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 170ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/global.css
1	transition: filter 180ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/global.css
1	transition: height 90ms linear;	src/styles/responsive.css
1	transition: margin-left 200ms cubic-bezier(0.4, 0, 0.2, 1);	src/styles/global.css
1	transition: opacity 140ms cubic-bezier(0.22, 1, 0.36, 1), background-color 140ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/global.css
1	transition: opacity 150ms ease;	src/styles/global.css
1	transition: opacity 320ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/responsive.css
1	transition: transform 0.2s ease, opacity 0.2s ease;	src/styles/global.css
1	transition: transform 0.2s ease;	src/styles/global.css
1	transition: transform 140ms ease, box-shadow 140ms ease, filter 140ms ease;	src/styles/global.css
1	transition: transform 150ms ease, border-color 150ms ease;	src/styles/global.css
1	transition: transform 200ms ease;	src/styles/global.css
1	transition: transform 220ms cubic-bezier(0.2, 0, 0.2, 1), opacity 220ms cubic-bezier(0.2, 0, 0.2, 1);	src/styles/global.css
1	transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/responsive.css
1	transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/responsive.css
1	transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/responsive.css
1	transition: transform 320ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 320ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/responsive.css
1	transition: transform 420ms cubic-bezier(0.18, 0.9, 0.22, 1), opacity 320ms cubic-bezier(0.22, 1, 0.36, 1);	src/styles/responsive.css
1	transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);	src/styles/global.css
```

---

## STEP 8 — COMPONENT SIZING PRIMITIVES

### Inventory summary
- Unique sizing declarations: **210**
- Common size primitives:
  - Heights: 24, 28, 30, 32, 34, 40, 42, 44, 48, 52
  - Icon widths/heights: 14, 16, 18, 20, 24
  - Min-height mobile touch targets appear in 44px+ ranges, but not globally standardized

### Candidate size token buckets
- Button heights: 34 / 40 / 44
- Input heights: 32 / 40 / 42 / 48
- Row heights: 28 / 30 / 34 / 44 / 52
- Icon sizes: 14 / 16 / 18 / 20 / 24

### Full extracted sizing declarations (count | declaration | files)
```text
72	width: 100%;	src/pages/ListView.css, src/components/Auth/Login.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/components/FocalBoard/StatusSelect.css, src/styles/responsive.css, src/styles/global.css
35	min-height: 0;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
27	min-width: 0;	src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/styles/responsive.css, src/styles/global.css
26	height: 30px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/LaneList.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
21	height: 100%;	src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
14	height: 1;	src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/ItemList.css, src/styles/responsive.css, src/styles/global.css
12	height: 28px;	src/pages/ListView.css, src/components/FocalBoard/LaneList.css, src/styles/responsive.css, src/styles/global.css
11	height: 14px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/styles/global.css
11	width: 14px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/styles/global.css
9	height: 20px;	src/components/FocalBoard/LaneList.css, src/components/FocalBoard/ItemList.css, src/styles/global.css
8	height: 18px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
8	height: 34px;	src/pages/ListView.css, src/components/Auth/Login.css, src/styles/responsive.css, src/styles/global.css
8	min-height: 28px;	src/pages/ListView.css, src/components/FocalBoard/StatusSelect.css, src/styles/global.css
8	width: 18px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
8	width: 20px;	src/components/FocalBoard/ItemList.css, src/styles/global.css
7	height: 24px;	src/components/FocalBoard/StatusSelect.css, src/styles/responsive.css, src/styles/global.css
7	height: 32px;	src/pages/ListView.css, src/styles/responsive.css, src/components/UI/InlineInput.css, src/styles/global.css
7	height: auto;	src/styles/responsive.css, src/styles/global.css
7	min-height: 34px;	src/pages/ListView.css, src/components/ProposalReviewTable.css, src/components/FocalBoard/ItemList.css, src/styles/global.css
7	width: 30px;	src/styles/responsive.css, src/styles/global.css
7	width: 32px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
6	height: 1.35;	src/components/FocalBoard/ActionList.css, src/styles/responsive.css, src/styles/global.css
6	height: 1.5;	src/styles/design-tokens.css, src/styles/components.css, src/styles/global.css
6	height: 16px;	src/components/FocalBoard/StatusSelect.css, src/styles/global.css
6	min-height: 24px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
6	width: 16px;	src/components/FocalBoard/StatusSelect.css, src/styles/global.css
6	width: 28px;	src/components/FocalBoard/LaneList.css, src/styles/responsive.css, src/styles/global.css
5	height: 1.4;	src/pages/ListView.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css
5	height: 42px;	src/components/Auth/Login.css, src/styles/responsive.css, src/styles/global.css
5	height: var(--header-block-height);	src/styles/global.css
5	min-height: 40px;	src/pages/ListView.css, src/styles/global.css
5	min-height: 42px;	src/styles/responsive.css, src/styles/global.css
5	width: 24px;	src/styles/responsive.css, src/styles/global.css
5	width: auto;	src/styles/responsive.css, src/styles/global.css
4	height: 1.3;	src/components/FocalBoard/ActionList.css, src/styles/global.css
4	height: 1px;	src/styles/responsive.css, src/styles/global.css
4	height: 22px;	src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/styles/responsive.css
4	height: 26px;	src/pages/ListView.css, src/styles/responsive.css
4	height: 72px;	src/styles/responsive.css
4	height: 8px;	src/components/FocalBoard/FocalBoard.css, src/styles/global.css
4	min-height: 30px;	src/pages/ListView.css, src/components/FocalBoard/ActionList.css, src/components/FocalBoard/StatusSelect.css, src/styles/global.css
4	min-height: 44px;	src/pages/ListView.css, src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css, src/styles/global.css
4	min-height: 52px;	src/pages/ListView.css, src/components/FocalBoard/ItemList.css, src/styles/responsive.css
4	width: 34px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
4	width: 44px;	src/pages/ListView.css, src/styles/responsive.css
4	width: min(520px, calc(100vw - 24px));	src/styles/global.css
3	height: 1.05;	src/styles/responsive.css, src/styles/global.css
3	height: 1.45;	src/styles/responsive.css, src/styles/global.css
3	height: 36px;	src/pages/ListView.css, src/components/FocalBoard/ItemList.css
3	height: 7px;	src/pages/ListView.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/StatusSelect.css
3	max-height: min(72vh, 560px);	src/styles/global.css
3	min-height: 32px;	src/pages/ListView.css, src/styles/responsive.css, src/styles/global.css
3	min-height: 36px;	src/pages/ListView.css, src/styles/global.css
3	width: 22px;	src/pages/ListView.css, src/styles/responsive.css
3	width: 40px;	src/styles/responsive.css
3	width: 72px;	src/styles/responsive.css
3	width: 7px;	src/pages/ListView.css, src/components/FocalBoard/ItemList.css, src/components/FocalBoard/StatusSelect.css
3	width: 8px;	src/styles/global.css
3	width: fit-content;	src/styles/responsive.css, src/styles/global.css
2	height: 1.02;	src/styles/responsive.css
2	height: 1.1;	src/styles/global.css
2	height: 100dvh;	src/styles/responsive.css
2	height: 12px;	src/styles/global.css
2	height: 15px;	src/components/FocalBoard/ActionList.css, src/styles/global.css
2	height: 38px;	src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css
2	height: 40px;	src/styles/responsive.css
2	height: 48px;	src/styles/responsive.css, src/components/UI/InlineInput.css
2	height: 4px;	src/styles/responsive.css
2	height: 52px;	src/styles/responsive.css
2	height: 62px;	src/styles/responsive.css
2	height: calc(100vh - var(--header-height-sm));	src/styles/global.css
2	height: min(75svh, calc(100svh - 16px));	src/styles/responsive.css
2	max-height: 148px;	src/styles/responsive.css
2	max-width: 100%;	src/styles/responsive.css
2	max-width: 100vw;	src/styles/responsive.css
2	max-width: 300px;	src/components/FocalBoard/FocalBoard.css, src/styles/global.css
2	max-width: 400px;	src/styles/global.css
2	min-height: 100vh;	src/components/Auth/Login.css, src/styles/global.css
2	min-height: 26px;	src/pages/ListView.css, src/styles/responsive.css
2	min-height: 38px;	src/components/FocalBoard/FocalBoard.css, src/styles/global.css
2	min-height: 56px;	src/components/FocalBoard/FocalBoard.css, src/styles/responsive.css
2	min-height: 58px;	src/styles/global.css
2	min-width: 200px;	src/styles/global.css
2	min-width: 90px;	src/pages/ListView.css, src/styles/global.css
2	width: 12px;	src/styles/global.css
2	width: 15px;	src/components/FocalBoard/ActionList.css, src/styles/global.css
2	width: 36px;	src/components/FocalBoard/ItemList.css, src/styles/responsive.css
2	width: 397px;	src/styles/global.css
2	width: 42px;	src/styles/global.css
2	width: 48px;	src/styles/responsive.css
2	width: min(var(--ai-panel-width), calc(100vw - 24px));	src/styles/global.css
1	height: 1 !important;	src/styles/global.css
1	height: 1.15;	src/styles/global.css
1	height: 1.25;	src/components/FocalBoard/ItemList.css
1	height: 1.28;	src/styles/responsive.css
1	height: 1.2;	src/styles/responsive.css
1	height: 1.32;	src/styles/responsive.css
1	height: 1.38;	src/styles/responsive.css
1	height: 100dvh !important;	src/styles/responsive.css
1	height: 100vh;	src/styles/global.css
1	height: 10px;	src/pages/ListView.css
1	height: 111px;	src/styles/global.css
1	height: 112px;	src/styles/global.css
1	height: 13px;	src/styles/global.css
1	height: 19px;	src/styles/responsive.css
1	height: 27px;	src/styles/global.css
1	height: 2px;	src/styles/global.css
1	height: 44px;	src/styles/responsive.css
1	height: 46px;	src/components/Auth/Login.css
1	height: 54px;	src/styles/responsive.css
1	height: 600px;	src/styles/global.css
1	height: calc(100% - 12px);	src/styles/responsive.css
1	height: var(--header-height-sm);	src/styles/global.css
1	height: var(--line-height);	src/styles/global.css
1	max-height: 100%;	src/styles/global.css
1	max-height: 116px;	src/styles/responsive.css
1	max-height: 120px;	src/styles/global.css
1	max-height: 136px;	src/styles/global.css
1	max-height: 200px;	src/styles/global.css
1	max-height: 214px;	src/styles/global.css
1	max-height: 220px;	src/styles/global.css
1	max-height: 280px;	src/styles/global.css
1	max-height: 48px;	src/styles/responsive.css
1	max-height: 48vh;	src/styles/responsive.css
1	max-height: 86vh;	src/pages/ListView.css
1	max-height: 88px;	src/styles/global.css
1	max-height: 88vh;	src/pages/ListView.css
1	max-height: calc(100vh - 56px);	src/styles/global.css
1	max-height: min(75svh, calc(100svh - 16px));	src/styles/responsive.css
1	max-width: 120px;	src/styles/responsive.css
1	max-width: 132px;	src/styles/responsive.css
1	max-width: 140px;	src/styles/global.css
1	max-width: 150px;	src/styles/global.css
1	max-width: 160px;	src/pages/ListView.css
1	max-width: 190px;	src/styles/global.css
1	max-width: 220px;	src/styles/global.css
1	max-width: 250px;	src/styles/global.css
1	max-width: 360px;	src/components/Auth/Login.css
1	max-width: 440px;	src/pages/ListView.css
1	max-width: 84%;	src/styles/global.css
1	max-width: 85%;	src/styles/responsive.css
1	max-width: 88%;	src/styles/global.css
1	max-width: auto;	src/styles/global.css
1	min-height: 100%;	src/styles/global.css
1	min-height: 124px;	src/styles/responsive.css
1	min-height: 132px;	src/styles/responsive.css
1	min-height: 14px;	src/styles/global.css
1	min-height: 150px;	src/styles/responsive.css
1	min-height: 160px;	src/styles/responsive.css
1	min-height: 16px;	src/pages/ListView.css
1	min-height: 22px;	src/pages/ListView.css
1	min-height: 280px;	src/styles/global.css
1	min-height: 34px !important;	src/styles/global.css
1	min-height: 38px !important;	src/styles/global.css
1	min-height: 400px;	src/styles/global.css
1	min-height: 48px;	src/styles/global.css
1	min-height: 66px;	src/styles/responsive.css
1	min-height: 76px;	src/styles/responsive.css
1	min-height: 78px;	src/styles/global.css
1	min-height: 84px;	src/styles/global.css
1	min-height: auto !important;	src/styles/global.css
1	min-width: 14px;	src/styles/global.css
1	min-width: 160px;	src/styles/global.css
1	min-width: 164px;	src/components/FocalBoard/StatusSelect.css
1	min-width: 180px;	src/styles/global.css
1	min-width: 18px;	src/pages/ListView.css
1	min-width: 24px;	src/components/FocalBoard/LaneList.css
1	min-width: 250px;	src/styles/global.css
1	min-width: 260px;	src/pages/ListView.css
1	min-width: 32px;	src/styles/responsive.css
1	min-width: 34px;	src/styles/global.css
1	min-width: 42px;	src/styles/global.css
1	min-width: 48px;	src/components/UI/InlineInput.css
1	min-width: 4px;	src/styles/responsive.css
1	min-width: 860px;	src/styles/responsive.css
1	min-width: auto !important;	src/styles/global.css
1	min-width: auto;	src/styles/global.css
1	min-width: var(--ai-panel-width);	src/styles/global.css
1	width: 0;	src/styles/responsive.css
1	width: 100vw;	src/styles/responsive.css
1	width: 10px;	src/pages/ListView.css
1	width: 120px;	src/components/FocalBoard/FocalBoard.css
1	width: 13px;	src/styles/global.css
1	width: 180px !important;	src/styles/global.css
1	width: 196px !important;	src/styles/global.css
1	width: 19px;	src/styles/responsive.css
1	width: 1px;	src/styles/global.css
1	width: 220px;	src/pages/ListView.css
1	width: 230px;	src/styles/global.css
1	width: 235px;	src/styles/global.css
1	width: 26px;	src/styles/responsive.css
1	width: 320px;	src/styles/global.css
1	width: 400px;	src/styles/global.css
1	width: 420px;	src/styles/global.css
1	width: 64px;	src/styles/global.css
1	width: calc((100% - 12px) / 3);	src/styles/responsive.css
1	width: calc(100% - 16px);	src/styles/global.css
1	width: calc(100% - 24px);	src/components/FocalBoard/ItemList.css
1	width: min(1200px, 96vw);	src/pages/ListView.css
1	width: min(1400px, 100%);	src/styles/global.css
1	width: min(320px, 42vw);	src/styles/global.css
1	width: min(760px, 96vw);	src/pages/ListView.css
1	width: min(760px, calc(100vw - 28px));	src/styles/global.css
1	width: min(960px, 96vw);	src/pages/ListView.css
1	width: min(980px, 100%);	src/components/FocalBoard/FocalBoard.css
1	width: min(var(--ai-panel-width), calc(100vw - 20px));	src/styles/global.css
1	width: var(--ai-panel-width);	src/styles/global.css
1	width: var(--search-width);	src/styles/global.css
1	width: var(--sidebar-expanded-width, 196px) !important;	src/styles/global.css
1	width: var(--sidebar-width);	src/styles/global.css
```

---

## INLINE STYLE AUDIT (TSX/JSX)

Inline style usage exists for dynamic visual values not captured by CSS tokenization:
- Dynamic geometry/positioning (`top`, `height`, `transform`) in calendar/mobile timeline components.
- Dynamic status color injection via `style={{ '--status-color': ... }}` and `backgroundColor` in list/field status UI.
- Dynamic width variables (`--sidebar-expanded-width`) in shell layout.
- Error boundary local inline styles with standalone color and spacing values.

Inline style locations:
```text
src/components/AppErrorBoundary.tsx:29:          style={{
src/components/AppErrorBoundary.tsx:41:            <h1 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600 }}>Delta hit a render error</h1>
src/components/AppErrorBoundary.tsx:42:            <p style={{ margin: 0, fontSize: '14px', color: '#5f6874' }}>
src/layouts/AppShell.tsx:15:      style={{ '--sidebar-expanded-width': `${sidebarWidth}px` } as CSSProperties}
src/components/ErrorBoundary.jsx:27:        <div style={{
src/components/ErrorBoundary.jsx:39:            <details style={{ marginTop: '10px' }}>
src/components/ErrorBoundary.jsx:41:              <pre style={{ 
src/components/ErrorBoundary.jsx:61:            style={{
src/components/calendar/EventCard.tsx:85:      style={{
src/components/FocalBoard/StatusSelect.jsx:65:          <span className={circleClassName} style={{ '--status-color': selected?.color || '#94a3b8' }} />
src/components/FocalBoard/StatusSelect.jsx:68:            <span className="status-select-pill" style={{ '--status-color': selected?.color || '#94a3b8' }}>
src/components/FocalBoard/StatusSelect.jsx:92:              <span className="status-select-dot" style={{ backgroundColor: status.color || '#94a3b8' }} />
src/components/calendar/NowIndicator.tsx:37:    <div className="week-now-indicator" style={{ top: `${top}px` }} aria-hidden="true">
src/pages/ListView.tsx:1436:                  <span className="list-status-chip" style={{ '--status-color': status.color } as CSSProperties}>
src/pages/ListView.tsx:1511:                        style={{ gridTemplateColumns: oneOffRowTemplate }}
src/pages/ListView.tsx:1677:                      style={{ gridTemplateColumns: recurringRowTemplate }}
src/pages/ListView.tsx:2073:                    style={{ backgroundColor: status.color }}
src/pages/ListView.tsx:2092:                        style={{ backgroundColor: color }}
src/pages/ListView.tsx:2132:                    style={{ backgroundColor: color }}
src/components/calendar/EventDrawer.tsx:748:                  style={{ border: 'none', padding: '0.15rem 0', minHeight: '80px' }}
src/components/FocalBoard/FocalBoard.jsx:399:                            <span className="lists-progress-fill" style={{ width: `${completionPct}%` }} />
src/components/AppShell.tsx:109:      style={{ '--sidebar-expanded-width': `${sidebarWidth}px` } as CSSProperties}
src/components/calendar/TimeColumn.tsx:14:    <aside className="week-time-column" style={{ height: `${totalHeight}px` }} aria-label="Time axis">
src/components/calendar/TimeColumn.tsx:21:            style={{ height: `${60 * pixelsPerMinute}px` }}
src/components/calendar/DayColumn.tsx:451:      style={{ height: `${columnHeight}px` }}
src/components/calendar/DayColumn.tsx:456:          <span key={`h-${offset}`} className="week-hour-line" style={{ top: `${offset * pixelsPerMinute}px` }} />
src/components/calendar/DayColumn.tsx:462:            style={{ top: `${offset * pixelsPerMinute}px` }}
src/components/calendar/DayColumn.tsx:531:          style={{ top: `${dragTop}px`, height: `${dragHeight}px` }}
src/components/calendar/DayColumn.tsx:542:            style={{ top: `${externalDragPreview.top}px`, height: `${externalDragPreview.height}px` }}
src/components/calendar/DayColumn.tsx:549:        <div className="week-empty-hint" style={{ top: `${Math.max(8, hintTop)}px` }}>
src/components/Calendar.tsx:1940:    <div className="attach-node-row" style={{ marginLeft: `${depth * 10}px` }}>
src/components/mobile/MobileCalendarWireframe.tsx:1308:          style={{ transform: `translateX(${calendarX}px)`, opacity: liveCalendarOpacity }}
src/components/mobile/MobileCalendarWireframe.tsx:1314:              <div className="mobile-timeline" style={{ height: `${timelineHeight + 140}px` }}>
src/components/mobile/MobileCalendarWireframe.tsx:1317:                    <div key={tick.minute} className="mobile-tick-row" style={{ top: `${(tick.minute - DAY_START_MIN) * PX_PER_MIN}px` }}>
src/components/mobile/MobileCalendarWireframe.tsx:1323:                <div className="mobile-now-line" style={{ top: `${nowTop}px` }} />
src/components/mobile/MobileCalendarWireframe.tsx:1334:                        style={{ top: `${top}px`, minHeight: `${height}px` }}
src/components/mobile/MobileCalendarWireframe.tsx:1525:          style={{ transform: `translateX(${aiX}px)`, opacity: aiX >= viewportWidth ? 0.7 : 1 }}
src/components/mobile/MobileCalendarWireframe.tsx:1629:                    <span key={`bar-${idx}`} style={{ height: `${height}px` }} />
src/components/mobile/MobileCalendarWireframe.tsx:1662:                style={{ transform: `translateX(${activeNavIndex * 100}%)` }}
src/components/mobile/MobileCalendarWireframe.tsx:1707:            style={{ transform: `translateY(${addSheetDragY}px)` }}
```

---

## CONSOLIDATED TOKEN CANDIDATE LIST

### COLORS
- Primary Accent: `#00c7ff`
- BG Base: `#ffffff`
- BG Alt: `#edf2fd`, `#f7f8fa`
- Surface/Card: `#ffffff`
- Border: `#e4e6ea`, `#d8dbe2`, `#e5e7eb`
- Text Primary: `#27272a`
- Text Secondary: `#52525b`
- Text Muted: `#6b7280`
- Status: `#94a3b8`, `#f59e0b`, `#22c55e`, `#ef4444`

### TYPOGRAPHY
- Family: `'Poppins', -apple-system, BlinkMacSystemFont, sans-serif`
- Size candidates: `11, 12, 13, 14, 16, 18, 24, 34` px
- Weight candidates: `400, 500, 600`
- Line-height candidates: `1, 1.35, 1.4, 1.5`
- Letter-spacing candidates: `0.01em, 0.02em, 0.04em, 0.05em`

### SPACING
- Scale candidates: `0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40`

### RADIUS
- `6, 10, 14, 18, 24, 9999`

### BORDERS
- Primary: `1px solid` neutral
- Secondary: `1px dashed` neutral
- Accent: `1px solid` accent

### SHADOWS
- `none`
- subtle elevation (`0 1px 2px`, `0 4px 12px`, `0 8px 24px`)
- accent glow variants

### ANIMATION
- Duration buckets: `120, 150, 180, 220, 260, 320`
- Easing buckets: `ease`, `cubic-bezier(0.22,1,0.36,1)`, `cubic-bezier(0.4,0,0.2,1)`

### COMPONENT SIZES
- Buttons: `34–44px`
- Inputs: `32–48px`
- Rows: `28–52px`
- Icons: `14–24px`

---

## OUTLIERS TO RESOLVE IN TOKENIZATION PHASE

1. Legacy duplicate systems: `design-system.css` and `design-tokens.css` both define overlapping token concerns.
2. High literal-value density in `global.css` and `ListView.css`.
3. Large set of one-off spacing shorthand values.
4. Mixed motion curves/durations across components.
5. Inline style dynamic values need a follow-up token strategy (`style` props + CSS vars).

