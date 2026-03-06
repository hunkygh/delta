import TaskCard from '../components/TaskCard';
import type { Task } from '../types/Task';

const tasks: Task[] = [
  { id: 'task-1', title: 'Write API contracts', description: 'Draft API.md', completed: false },
  { id: 'task-2', title: 'Design proposal card states', completed: true }
];

export default function TaskListView(): JSX.Element {
  return (
    <section className="app-page">
      <h1 className="page-title">Tasks</h1>
      <div className="app-page-scroll">
        <div className="stack">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </div>
    </section>
  );
}
