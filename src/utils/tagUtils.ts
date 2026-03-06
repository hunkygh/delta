import type { Project } from '../types/Project';

export function findProjectById(projects: Project[], id: string): Project | undefined {
  return projects.find((project) => project.id === id);
}

export function filterProjects(projects: Project[], query: string): Project[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return projects;
  return projects.filter((project) => project.name.toLowerCase().includes(normalized));
}
