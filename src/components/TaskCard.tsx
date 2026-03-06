import type { Task } from '../types/Task';

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps): JSX.Element {
  return (
    <article className="card">
      <h4>{task.title}</h4>
      <p>{task.description || 'No description'}</p>
      <p>Status: {task.completed ? 'Done' : 'Open'}</p>
    </article>
  );
}
