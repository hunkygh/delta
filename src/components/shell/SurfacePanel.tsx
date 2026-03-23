import type { ReactNode } from 'react';
import { X } from '@phosphor-icons/react';

interface SurfacePanelProps {
  kicker: string;
  kickerContent?: ReactNode;
  title: string;
  subtitle?: string;
  hideHeaderText?: boolean;
  headerActions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  tone?: 'light' | 'dark';
  density?: 'default' | 'compact';
  className?: string;
}

export default function SurfacePanel({
  kicker,
  kickerContent,
  title,
  subtitle,
  hideHeaderText = false,
  headerActions,
  onClose,
  children,
  tone = 'light',
  density = 'default',
  className = ''
}: SurfacePanelProps): JSX.Element {
  const isDark = tone === 'dark';
  return (
    <section
      className={`shell-surface-panel ${isDark ? 'shell-surface-panel-dark' : ''} ${className}`.trim()}
      aria-label={title || kicker}
    >
      <div
        className={`shell-surface-panel-head ${isDark ? 'shell-surface-panel-head-dark' : ''} ${
          density === 'compact' ? 'shell-surface-panel-head-compact' : ''
        }`.trim()}
      >
        <div>
          {kickerContent ?? <span className="shell-kicker">{kicker}</span>}
          {!hideHeaderText && title ? <h2>{title}</h2> : null}
          {!hideHeaderText && subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="shell-surface-panel-head-actions">
          {headerActions}
          <button
            type="button"
            className={`shell-surface-panel-close ${isDark ? 'shell-surface-panel-close-dark' : ''}`.trim()}
            onClick={onClose}
            aria-label="Close panel"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>
      <div className={`shell-surface-panel-body ${isDark ? 'shell-surface-panel-body-dark' : ''}`.trim()}>{children}</div>
    </section>
  );
}
