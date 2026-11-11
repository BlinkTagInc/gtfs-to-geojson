import type { Gtfs } from 'gtfs';
import { calendarDay } from '../config.ts';

// Count scheduled weekdays arithmetically, then apply dated exceptions.
export async function servicesInRange(
  gtfs: Gtfs,
  start = -Infinity,
  end = Infinity,
) {
  const calendars = await gtfs.schedule.calendar.all();
  const exceptions = await gtfs.schedule.calendarDates.all();
  const counts = new Map<string, number>();
  const schedules = new Map(calendars.map((c) => [c.service_id, c]));
  const weekdays = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const;
  const weekday = (day: number) => (((day + 4) % 7) + 7) % 7;
  for (const c of calendars) {
    const first = calendarDay(Math.max(start, c.start_date)),
      last = calendarDay(Math.min(end, c.end_date));
    let count = 0;
    weekdays.forEach((name, index) => {
      const firstMatch = first + ((index - weekday(first) + 7) % 7);
      if (c[name] && firstMatch <= last) {
        count += 1 + Math.floor((last - firstMatch) / 7);
      }
    });
    counts.set(c.service_id, count);
  }
  for (const e of exceptions) {
    if (e.date < start || e.date > end) {
      continue;
    }
    const c = schedules.get(e.service_id);
    const name = weekdays[weekday(calendarDay(e.date))];
    const scheduled =
      name &&
      c &&
      e.date >= c.start_date &&
      e.date <= c.end_date &&
      c[name] === 1;
    const delta =
      e.exception_type === 1 && !scheduled
        ? 1
        : e.exception_type === 2 && scheduled
          ? -1
          : 0;
    counts.set(e.service_id, (counts.get(e.service_id) ?? 0) + delta);
  }
  return new Set(
    [...counts].filter(([, count]) => count > 0).map(([id]) => id),
  );
}
