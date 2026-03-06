import ProjectTag from '../components/ProjectTag';
import type { Project } from '../types/Project';

const projects: Project[] = [
  { id: 'proj-1', name: 'Health' },
  { id: 'proj-2', name: 'Business' },
  { id: 'proj-3', name: 'Personal Systems' }
];

export default function ProjectView(): JSX.Element {
  return (
    <section className="app-page">
      <h1 className="page-title">Projects</h1>
      <div className="app-page-scroll">
        <div className="inline-row wrap">
          {projects.map((project) => (
            <ProjectTag key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  );
}
