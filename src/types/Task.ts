export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueAt?: string;
  projectId?: string;
  subtasks?: Task[];
}
