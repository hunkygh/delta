import type { HoursWindow } from './WeekCalendar';
import { formatHourLabel, getTotalVisibleMinutes } from './calendarUtils';

interface TimeColumnProps {
  hours: HoursWindow;
  pixelsPerMinute: number;
}

export default function TimeColumn({ hours, pixelsPerMinute }: TimeColumnProps): JSX.Element {
  const hourCount = hours.end - hours.start + 1;
  const totalHeight = getTotalVisibleMinutes(hours) * pixelsPerMinute;

  return (
    <aside className="week-time-column" style={{ height: `${totalHeight}px` }} aria-label="Time axis">
      {Array.from({ length: hourCount }, (_, index) => {
        const hour = hours.start + index;
        return (
          <div
            key={hour}
            className="week-time-slot"
            style={{ height: `${60 * pixelsPerMinute}px` }}
          >
            <span className="week-time-label">{formatHourLabel(hour)}</span>
          </div>
        );
      })}
    </aside>
  );
}
