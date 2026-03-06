import type { Event } from '../types/Event';
import { formatTimeRange } from '../utils/calendarUtils';

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps): JSX.Element {
  return (
    <article className="card">
      <h4>{event.title}</h4>
      <p>{formatTimeRange(event.start, event.end)}</p>
      <p>{event.description}</p>
    </article>
  );
}
