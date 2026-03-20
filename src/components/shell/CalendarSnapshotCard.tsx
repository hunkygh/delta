import { ArrowUpLeft } from 'lucide-react';

const days = Array.from({ length: 31 }, (_, index) => index + 1);
const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface CalendarSnapshotCardProps {
  onOpen: () => void;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  dimmed?: boolean;
}

export default function CalendarSnapshotCard({
  onOpen,
  selectedDate,
  onSelectDate,
  dimmed = false
}: CalendarSnapshotCardProps): JSX.Element {
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthLabel = now.toLocaleDateString([], { month: 'long' });

  return (
    <section
      className={`shell-card shell-card-frosted shell-calendar-card ${dimmed ? 'dimmed' : ''}`.trim()}
      aria-label="Calendar snapshot"
    >
      <div className="shell-calendar-card-head">
        <strong>{monthLabel}</strong>
        <button type="button" className="shell-calendar-expand-btn" onClick={onOpen} aria-label="Open calendar">
          <ArrowUpLeft size={15} />
        </button>
      </div>
      <div className="shell-calendar-weekdays" aria-hidden="true">
        {weekdayLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="shell-calendar-month">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            className={`shell-calendar-day ${
              day === today ? 'current' : ''
            } ${
              selectedDate.getFullYear() === currentYear &&
              selectedDate.getMonth() === currentMonth &&
              selectedDate.getDate() === day
                ? 'selected'
                : ''
            }`.trim()}
            onClick={() => onSelectDate(new Date(currentYear, currentMonth, day))}
            aria-pressed={
              selectedDate.getFullYear() === currentYear &&
              selectedDate.getMonth() === currentMonth &&
              selectedDate.getDate() === day
            }
          >
            <span>{day}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
