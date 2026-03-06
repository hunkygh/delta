import { describe, expect, it } from 'vitest';
import { filterProjects } from '../src/utils/tagUtils';

describe('tag helpers', () => {
  it('filters projects by name', () => {
    const projects = [
      { id: '1', name: 'Health' },
      { id: '2', name: 'Business Ops' }
    ];

    const filtered = filterProjects(projects, 'business');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.name).toBe('Business Ops');
  });
});
