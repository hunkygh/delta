import type { Lane } from '../types/LaneWorkspace';

export const seedLanes: Lane[] = [
  {
    id: 'lane-sales-prospecting',
    domainName: 'Sales',
    name: 'Prospecting',
    itemTermSingular: 'Lead',
    itemTermPlural: 'Leads',
    items: [
      {
        id: 'item-s-1',
        title: 'Q1 outbound - West region',
        status: 'in_progress',
        owner: 'Grant',
        dueDate: '2026-03-04',
        commentsCount: 3,
        actions: [
          { id: 'action-s-1', title: 'Build account list', completed: true },
          { id: 'action-s-2', title: 'Draft intro sequence', completed: false }
        ]
      },
      {
        id: 'item-s-2',
        title: 'Follow-up sprint',
        status: 'backlog',
        owner: 'Maya',
        dueDate: '2026-03-09',
        commentsCount: 1,
        actions: [{ id: 'action-s-3', title: 'Prioritize warm leads', completed: false }]
      }
    ]
  },
  {
    id: 'lane-product-calendar',
    domainName: 'Product',
    name: 'Calendar UX',
    itemTermSingular: 'Feature',
    itemTermPlural: 'Features',
    items: [
      {
        id: 'item-p-1',
        title: 'Right-side event drawer',
        status: 'in_progress',
        owner: 'Grant',
        dueDate: '2026-03-01',
        commentsCount: 5,
        actions: [
          { id: 'action-p-1', title: 'Finalize recurrence UX', completed: false },
          { id: 'action-p-2', title: 'Wire task linking handoff', completed: false }
        ]
      },
      {
        id: 'item-p-2',
        title: 'Mobile week view pass',
        status: 'blocked',
        owner: 'Alex',
        dueDate: '2026-03-11',
        commentsCount: 2,
        actions: [{ id: 'action-p-3', title: 'Resolve pinch-zoom overflow', completed: false }]
      }
    ]
  }
];

