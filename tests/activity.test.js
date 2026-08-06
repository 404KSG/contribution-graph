import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_BLOCKS_QUERY,
  OWN_BLOCKS_QUERY,
  aggregateTimestamps,
  aggregateTimestampsInBatches,
  buildYearCalendar,
  calculateStats,
  formatDateKey,
  getContributionLevel,
  getHistoryYears,
  queryCreationTimestamps,
} from "../src/index.js";

test("formatDateKey uses calendar dates and rejects invalid values", () => {
  assert.equal(formatDateKey(new Date("2026-08-06T12:00:00Z")), "2026-08-06");
  assert.equal(formatDateKey("not-a-date"), null);
});

test("aggregateTimestamps counts the complete supplied history", () => {
  const counts = aggregateTimestamps([
    Date.UTC(2024, 0, 1, 12),
    Date.UTC(2024, 0, 1, 18),
    Date.UTC(2026, 7, 6, 12),
  ]);
  assert.equal(counts["2024-01-01"], 2);
  assert.equal(counts["2026-08-06"], 1);
});

test("batched aggregation yields without changing results", async () => {
  let yields = 0;
  const timestamps = Array.from({ length: 7 }, (_, index) => Date.UTC(2026, 0, index + 1));
  const counts = await aggregateTimestampsInBatches(timestamps, {
    chunkSize: 2,
    yieldControl: async () => {
      yields += 1;
    },
  });
  assert.equal(Object.keys(counts).length, 7);
  assert.equal(yields, 3);
});

test("batched aggregation can be cancelled", async () => {
  let checks = 0;
  const counts = await aggregateTimestampsInBatches([1, 2, 3], {
    shouldContinue: () => ++checks < 2,
  });
  assert.equal(counts, null);
});

test("fixed contribution levels remain comparable across years", () => {
  assert.deepEqual(
    [0, 1, 9, 10, 24, 25, 49, 50, 500].map(getContributionLevel),
    [0, 1, 1, 2, 2, 3, 3, 4, 4]
  );
});

test("year calendar covers every day including leap day", () => {
  const calendar = buildYearCalendar(2024, { "2024-02-29": 3 });
  const leapDay = calendar.cells.find((cell) => cell.key === "2024-02-29");
  assert.equal(leapDay.count, 3);
  assert.equal(calendar.cells.filter((cell) => cell.inYear).length, 366);
  assert.equal(calendar.cells.length % 7, 0);
  assert.ok(calendar.weekCount >= 53);
});

test("history years include gaps through the current year", () => {
  assert.deepEqual(getHistoryYears({ "2023-04-01": 1 }, 2026), [2026, 2025, 2024, 2023]);
});

test("stats calculate totals and streaks", () => {
  const stats = calculateStats(
    {
      "2026-08-01": 2,
      "2026-08-02": 1,
      "2026-08-04": 3,
      "2026-08-05": 4,
      "2026-08-06": 5,
    },
    new Date("2026-08-06T12:00:00Z")
  );
  assert.deepEqual(stats, {
    totalBlocks: 15,
    activeDays: 5,
    currentStreak: 3,
    longestStreak: 3,
  });
});

test("query selection prefers Roam's asynchronous API", async () => {
  assert.match(ALL_BLOCKS_QUERY, /:find \?entity \?time/);
  assert.match(OWN_BLOCKS_QUERY, /:find \?entity \?time/);
  const calls = [];
  const api = {
    data: {
      async: {
        q: async (...args) => {
          calls.push(args);
          return [[101, 1], [102, 1], [103, 2], [104, "invalid"]];
        },
      },
      fast: { q: () => assert.fail("async API should be preferred") },
    },
  };

  assert.deepEqual(
    await queryCreationTimestamps({ api, scope: "all" }),
    [1, 1, 2],
    "different entities sharing a timestamp must all be counted"
  );
  assert.equal(calls[0][0], ALL_BLOCKS_QUERY);
  assert.deepEqual(
    await queryCreationTimestamps({ api, scope: "own", userUid: "user-123" }),
    [1, 1, 2]
  );
  assert.equal(calls[1][0], OWN_BLOCKS_QUERY);
  assert.equal(calls[1][1], "user-123");
});

test("query selection falls back to the synchronous API", async () => {
  const api = { data: { q: () => [[201, 3], [202, 4]] } };
  assert.deepEqual(await queryCreationTimestamps({ api }), [3, 4]);
});

test("own-author scope fails clearly without a current user", async () => {
  const api = { data: { fast: { q: () => [] } } };
  await assert.rejects(
    queryCreationTimestamps({ api, scope: "own", userUid: null }),
    /Current Roam user is unavailable/
  );
});
