import type { PlanObject } from '../types/PlanObject';
import Button from './Button';

interface ProposalCardProps {
  proposal: PlanObject;
}

export default function ProposalCard({ proposal }: ProposalCardProps): JSX.Element {
  return (
    <section className="card">
      <h3>Proposal</h3>
      <p>{proposal.event.title}</p>
      <p>{proposal.event.description}</p>
      <div className="inline-row">
        <Button>Approve</Button>
        <Button variant="secondary">Modify</Button>
      </div>
    </section>
  );
}
