import { aggregateTimestamps, buildYearCalendar, getHistoryYears } from "../src/index.js";

const ROWS = 500_000;
const START = Date.UTC(2016, 0, 1, 12);
const DAY = 86_400_000;
const SPAN_DAYS = 10 * 366;
const timestamps = Array.from(
  { length: ROWS },
  (_, index) => START + (index % SPAN_DAYS) * DAY
);

const aggregateStart = performance.now();
const counts = aggregateTimestamps(timestamps);
const aggregateMs = performance.now() - aggregateStart;

const renderModelStart = performance.now();
const years = getHistoryYears(counts, 2026);
const calendars = years.map((year) => buildYearCalendar(year, counts));
const renderModelMs = performance.now() - renderModelStart;
const cells = calendars.reduce((total, calendar) => total + calendar.cells.length, 0);

console.log(
  JSON.stringify(
    {
      rows: ROWS,
      years: years.length,
      cells,
      aggregateMs: Number(aggregateMs.toFixed(1)),
      calendarModelMs: Number(renderModelMs.toFixed(1)),
    },
    null,
    2
  )
);

if (aggregateMs > 5_000 || renderModelMs > 1_000) {
  throw new Error("Performance benchmark exceeded its generous regression budget");
}
