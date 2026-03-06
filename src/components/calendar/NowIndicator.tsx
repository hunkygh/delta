import { useEffect, useState } from 'react';
import type { HoursWindow } from './WeekCalendar';
import { getEndMinute, getMinutesFromStartOfDay, getStartMinute, isSameDay } from './calendarUtils';

interface NowIndicatorProps {
  date: Date;
  hours: HoursWindow;
  pixelsPerMinute: number;
}

export default function NowIndicator({ date, hours, pixelsPerMinute }: NowIndicatorProps): JSX.Element | null {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  if (!isSameDay(date, now)) {
    return null;
  }

  const startMinute = getStartMinute(hours);
  const endMinute = getEndMinute(hours);
  const minutesFromStartOfDay = getMinutesFromStartOfDay(now);

  if (minutesFromStartOfDay < startMinute || minutesFromStartOfDay > endMinute) {
    return null;
  }

  const top = (minutesFromStartOfDay - startMinute) * pixelsPerMinute;

  return (
    <div className="week-now-indicator" style={{ top: `${top}px` }} aria-hidden="true">
      <span className="week-now-indicator-dot" />
      <span className="week-now-indicator-line" />
    </div>
  );
}
