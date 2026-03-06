import './ProposalReviewTable.css';

export interface ProposalReviewRow {
  id: string;
  entity: string;
  currentValue: string;
  proposedValue: string;
  reason: string;
  approved: boolean;
}

interface ProposalReviewTableProps {
  title?: string;
  source?: string;
  rows: ProposalReviewRow[];
  applying?: boolean;
  onToggleRow: (id: string, approved: boolean) => void;
  onApproveSelected: () => void;
  onCancel: () => void;
}

export default function ProposalReviewTable({
  title = 'Proposal Review',
  source,
  rows,
  applying = false,
  onToggleRow,
  onApproveSelected,
  onCancel
}: ProposalReviewTableProps): JSX.Element | null {
  if (!rows.length) {
    return null;
  }

  const selectedCount = rows.filter((row) => row.approved).length;

  return (
    <section className="proposal-review">
      <header className="proposal-review-head">
        <h3>{title}</h3>
        {source && <span className="proposal-review-source">source: {source}</span>}
      </header>

      <div className="proposal-review-table">
        <div className="proposal-review-row header">
          <span>Approve</span>
          <span>Entity</span>
          <span>Current</span>
          <span>Proposed</span>
          <span>Reason</span>
        </div>
        {rows.map((row) => (
          <div key={row.id} className="proposal-review-row">
            <label>
              <input
                type="checkbox"
                checked={row.approved}
                onChange={(event) => onToggleRow(row.id, event.target.checked)}
              />
            </label>
            <span>{row.entity}</span>
            <span>{row.currentValue}</span>
            <span>{row.proposedValue}</span>
            <span>{row.reason}</span>
          </div>
        ))}
      </div>

      <footer className="proposal-review-actions">
        <button type="button" className="proposal-btn secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="proposal-btn primary"
          onClick={onApproveSelected}
          disabled={applying || selectedCount === 0}
        >
          {applying ? 'Applying...' : 'Approve selected'}
        </button>
      </footer>
    </section>
  );
}
