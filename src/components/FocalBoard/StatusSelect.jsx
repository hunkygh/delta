import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import './StatusSelect.css';

const normalizeKey = (label) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const isPendingLikeStatus = (status) => {
  if (!status) return true;
  const key = normalizeKey(status.key || status.name || '');
  return key === 'pending' || key === 'not_started' || key === 'needs_action';
};

export default function StatusSelect({
  statuses = [],
  value,
  onChange,
  appearance = 'pill',
  className = '',
  onManageStatuses
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocMouseDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const resolvedStatuses = statuses.length
    ? statuses
    : [
        { id: null, name: 'To do', key: 'pending', color: '#94a3b8' },
        { id: null, name: 'In progress', key: 'in_progress', color: '#f59e0b' },
        { id: null, name: 'Done', key: 'completed', color: '#22c55e' }
      ];

  const selected =
    resolvedStatuses.find((status) => status.id && value && status.id === value) ??
    resolvedStatuses.find((status) => status.key === value) ??
    resolvedStatuses[0];
  const isPendingLike = isPendingLikeStatus(selected);
  const circleClassName = [
    'status-select-circle',
    isPendingLike ? 'pending' : 'active'
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`status-select ${open ? 'open' : ''} ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="status-select-trigger"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {appearance === 'circle' ? (
          <span className={circleClassName} style={{ '--status-color': selected?.color || '#94a3b8' }} />
        ) : (
          <>
            <span className="status-select-pill" style={{ '--status-color': selected?.color || '#94a3b8' }}>
              <span className="status-select-dot" />
              <span className="status-select-label">{selected?.name || 'Status'}</span>
            </span>
            <ChevronDown size={12} className={`status-select-chevron ${open ? 'open' : ''}`.trim()} />
          </>
        )}
      </button>

      {open && (
        <div className="status-select-menu" role="listbox">
          {resolvedStatuses.map((status) => (
            <button
              key={status.id || status.key || normalizeKey(status.name)}
              type="button"
              className={`status-select-option ${
                (status.id && status.id === selected?.id) || status.key === selected?.key ? 'active' : ''
              }`.trim()}
              onClick={(event) => {
                event.stopPropagation();
                onChange?.(status);
                setOpen(false);
              }}
            >
              <span className="status-select-dot" style={{ backgroundColor: status.color || '#94a3b8' }} />
              <span>{status.name}</span>
            </button>
          ))}
          {onManageStatuses && (
            <div className="status-select-menu-footer">
              <button
                type="button"
                className="status-select-manage"
                onClick={() => {
                  onManageStatuses();
                  setOpen(false);
                }}
              >
                Manage statuses
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
