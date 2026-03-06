import { addDays, isSameDay } from './calendarUtils';

interface WeekHeaderProps {
  startOfWeek: Date;
  daysCount?: number;
}

export default function WeekHeader({ startOfWeek, daysCount = 7 }: WeekHeaderProps): JSX.Element {
  const today = new Date();
  const days = Array.from({ length: daysCount }, (_, index) => addDays(startOfWeek, index));

  return (
    <header className="week-header" aria-label="Week day header">
      <div className="week-header-time-spacer" aria-hidden="true" />
      <div className="week-header-days">
        {days.map((date) => {
          const isToday = isSameDay(date, today);
          return (
            <div key={date.toISOString()} className={`week-header-day ${isToday ? 'today' : ''}`.trim()}>
              <span className="week-header-day-name">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <span className="week-header-day-number">{date.getDate()}</span>
            </div>
          );
        })}
      </div>
    </header>
  );
}
