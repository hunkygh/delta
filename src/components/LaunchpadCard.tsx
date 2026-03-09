import { useState } from 'react';
import { ArrowUpRight, Maximize2 } from 'lucide-react';
import Button from './Button';

interface LaunchpadCardProps {
  title: 'Notes' | 'Tasks' | 'Bookmarks' | 'Resources';
  subtitle: string;
}

export default function LaunchpadCard({ title, subtitle }: LaunchpadCardProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const cardContent = (
    <>
      <header className={`launchpad-card-header ${expanded ? 'fullscreen' : ''}`.trim()}>
        <button
          type="button"
          className={`launchpad-card-title-link ${expanded ? 'fullscreen' : ''}`.trim()}
          aria-label={`${title} page link coming soon`}
        >
          <span className="launchpad-card-title">{title}</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </button>
        <div className="launchpad-card-controls" aria-label={`${title} controls`}>
          {expanded ? (
            <Button
              variant="secondary"
              className="close-btn"
              aria-label={`Close ${title}`}
              onClick={() => setExpanded(false)}
            >
              ✕
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                className="icon-btn"
                aria-label={`Expand ${title}`}
                onClick={() => setExpanded(true)}
              >
                <Maximize2 size={14} />
              </Button>
              <Button variant="secondary" className="icon-btn" aria-label={`Add ${title}`}>
                +
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="launchpad-card-body">
        {/* Content will be added later */}
      </div>
    </>
  );

  return (
    <>
      {expanded && (
        <div
          className="fullscreen-overlay"
          onClick={() => setExpanded(false)}
          aria-label="Close fullscreen view"
        >
          <article
            className="launchpad-card fullscreen"
            onClick={(event) => event.stopPropagation()}
          >
            {cardContent}
          </article>
        </div>
      )}
      {!expanded && <article className="launchpad-card">{cardContent}</article>}
    </>
  );
}
