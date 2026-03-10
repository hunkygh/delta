import { useEffect, useMemo, useState } from 'react';
import { Circle, ChevronRight, X } from 'lucide-react';
import './StatusChangeDialog.css';

export interface StatusDialogOption {
  id?: string | null;
  key: string;
  name: string;
  color?: string;
}

interface StatusChangeDialogProps {
  open: boolean;
  title: string;
  currentStatusLabel: string;
  currentStatusKey?: string | null;
  statuses: StatusDialogOption[];
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (status: StatusDialogOption, note: string) => void | Promise<void>;
}

export default function StatusChangeDialog({
  open,
  title,
  currentStatusLabel,
  currentStatusKey = null,
  statuses,
  saving = false,
  error = null,
  onClose,
  onSubmit
}: StatusChangeDialogProps): JSX.Element | null {
  const [step, setStep] = useState<'select' | 'note'>('select');
  const [selectedStatus, setSelectedStatus] = useState<StatusDialogOption | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) {
      setStep('select');
      setSelectedStatus(null);
      setNote('');
    }
  }, [open]);

  const orderedStatuses = useMemo(() => statuses || [], [statuses]);

  if (!open) return null;

  return (
    <div className="status-change-dialog-overlay" onClick={saving ? undefined : onClose}>
      <section className="status-change-dialog" onClick={(event) => event.stopPropagation()}>
        <header className="status-change-dialog-head">
          <strong>{step === 'select' ? 'Change Status' : 'Add Note'}</strong>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close status dialog">
            <X size={16} />
          </button>
        </header>

        <div className="status-change-dialog-body">
          <h3>{title}</h3>
          {error ? <div className="status-change-dialog-error">{error}</div> : null}

          {step === 'select' ? (
            <div className="status-change-dialog-options">
              {orderedStatuses.map((status) => (
                <button
                  key={status.id || status.key}
                  type="button"
                  className={`status-change-dialog-option ${currentStatusKey === status.key ? 'current' : ''}`.trim()}
                  onClick={() => {
                    setSelectedStatus(status);
                    setStep('note');
                  }}
                >
                  <span className="status-change-dialog-option-copy">
                    <Circle size={12} fill={status.color || 'currentColor'} stroke={status.color || 'currentColor'} />
                    <span>{status.name}</span>
                  </span>
                  {currentStatusKey === status.key ? <span className="status-change-dialog-current">Current</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="status-change-dialog-note">
              <div className="status-change-dialog-summary">
                <span>{currentStatusLabel || 'No status'}</span>
                <ChevronRight size={14} />
                <strong>{selectedStatus?.name || 'Selected status'}</strong>
              </div>
              <label className="status-change-dialog-note-field">
                <span>Completion note</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add context for this status update"
                  rows={4}
                />
              </label>
              <div className="status-change-dialog-actions">
                <button type="button" className="ghost" onClick={() => setStep('select')} disabled={saving}>
                  Back
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => selectedStatus && onSubmit(selectedStatus, note)}
                  disabled={saving || !selectedStatus}
                >
                  {saving ? 'Saving…' : 'Save Update'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
