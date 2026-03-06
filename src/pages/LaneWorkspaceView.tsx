import { Plus, Settings, Layers } from 'lucide-react';
import { useParams } from 'react-router-dom';

const mockSpaces = [
  { id: 'everything', name: 'Everything' },
  { id: 'global-payments', name: 'Global Payments' },
  { id: 'health-fitness', name: 'Health & Fitness' },
  { id: 'personal', name: 'Personal' },
];

export default function LaneWorkspaceView(): JSX.Element {
  const { domainId } = useParams<{ domainId?: string }>();

  const currentSpace = mockSpaces.find(space => space.id === domainId) || 
    { id: 'everything', name: 'Everything' };

  return (
    <section className="app-page lane-workspace-page">
      <div className="lane-workspace-head">
        <div className="lane-title-row">
          <h1 className="page-title">{currentSpace.name}</h1>
          <div className="lane-title-buttons">
            <button className="btn-primary">
              <Plus size={14} />
              New
            </button>
            <button className="btn-ghost">
              <Settings size={14} />
              Config
            </button>
          </div>
        </div>
      </div>

      <div className="app-page-scroll lane-workspace-scroll">
        <div className="lane-empty-state">
          <div className="lane-empty-icon">
            <Layers size={48} />
          </div>
          <h2>No lists yet</h2>
          <p>Create your first list to get started with organizing your work.</p>
          <button className="btn-primary">
            <Plus size={16} />
            Create List
          </button>
        </div>
      </div>
    </section>
  );
}
