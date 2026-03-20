import type { Event } from '../../types/Event';

interface AiRailCardProps {
  currentBlock: Event | null;
  onOpen: () => void;
}

export default function AiRailCard({ currentBlock, onOpen }: AiRailCardProps): JSX.Element {
  return (
    <section className="shell-card shell-card-frosted shell-ai-card">
      <div className="shell-card-head">
        <span className="shell-kicker">AI</span>
        <button type="button" className="shell-rail-action" onClick={onOpen}>
          Open
        </button>
      </div>
      <div className="shell-ai-preview">
        <strong>Delta chat</strong>
        <p>
          {currentBlock
            ? `Current context ready: ${currentBlock.title}`
            : 'Summary-first shell card. Full chat panel will expand from here.'}
        </p>
      </div>
      <div className="shell-ai-status-line">
        <span className="shell-ai-status-dot" aria-hidden="true" />
        <span>{currentBlock ? 'block-aware context primed' : 'waiting for active context'}</span>
      </div>
    </section>
  );
}
