import type { Project } from '../types/Project';

interface ProjectTagProps {
  project: Project;
}

export default function ProjectTag({ project }: ProjectTagProps): JSX.Element {
  return <span className="project-tag">#{project.name}</span>;
}
