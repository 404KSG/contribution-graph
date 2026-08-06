import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_BLOCKS_QUERY,
  OWN_BLOCKS_QUERY,
  aggregateTimestamps,
  aggregateTimestampsInBatches,
  buildShareImageLayout,
  buildYearCalendar,
  calculateStats,
  createShareScreenshot,
  deliverShareScreenshot,
  formatLoadedStatus,
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

test("loaded status stays minimal and reports only scope and year coverage", () => {
  assert.equal(
    formatLoadedStatus({
      scope: "all",
      counts: { "2020-01-01": 1, "2026-08-06": 185_322 },
    }),
    "Entire graph · 2020–2026"
  );
});

test("share image layout includes every history year in a compact grid", () => {
  const shortHistory = buildShareImageLayout({ "2026-01-01": 1 }, 2026);
  const longHistory = buildShareImageLayout(
    { "2019-04-01": 1, "2026-08-06": 1 },
    2026
  );
  assert.deepEqual(longHistory.years, [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]);
  assert.equal(longHistory.columns, 1);
  assert.equal(longHistory.rows, 8);
  assert.equal(longHistory.width, shortHistory.width);
  assert.ok(longHistory.height > shortHistory.height);
});

test("share screenshot renderer draws the complete history to a PNG", async () => {
  let fillRects = 0;
  const filledRects = [];
  const drawnText = [];
  const drawnTextEntries = [];
  const drawnFonts = [];
  const context = {
    beginPath() {},
    roundRect() {},
    fill() {},
    stroke() {},
    scale() {},
    fillRect(...args) {
      fillRects += 1;
      filledRects.push(args);
    },
    fillText(value, x, y) {
      drawnText.push(value);
      drawnTextEntries.push({ value, x, y });
      drawnFonts.push(this.font);
    },
    moveTo() {},
    lineTo() {},
  };
  const canvas = {
    getContext: () => context,
    toBlob: (callback) => callback(new Blob(["png"], { type: "image/png" })),
  };
  const result = await createShareScreenshot({
    counts: { "2024-02-29": 2, "2026-08-06": 1 },
    scope: "all",
    now: new Date("2026-08-06T12:00:00Z"),
    documentRef: { createElement: () => canvas },
  });
  assert.equal(result.blob.type, "image/png");
  assert.equal(result.filename, "roam-contribution-graph-2026-08-06.png");
  assert.equal(result.width, 900);
  assert.equal(canvas.width, 2_700);
  assert.equal(context.imageSmoothingEnabled, false);
  assert.ok(fillRects > 1_000, "all three calendar years should be drawn");
  assert.ok(drawnText.includes("DAYS IN ROAM"));
  assert.ok(!drawnText.includes("ACTIVE DAYS"));
  assert.ok(
    drawnText.includes("Entire graph · Complete Roam block history · 2024–2026 · @RoamResearch")
  );
  assert.ok(!drawnText.includes("@RoamResearch · Contribution Graph"));
  assert.equal(drawnText.filter((value) => value === "Less").length, 1);
  assert.equal(drawnText.filter((value) => value === "More").length, 1);
  const moreLabel = drawnTextEntries.find(({ value }) => value === "More");
  const lastLegendCell = filledRects.at(-1);
  assert.ok(lastLegendCell[0] + lastLegendCell[2] < moreLabel.x);
  assert.ok(drawnFonts.every((font) => font.includes("-apple-system")));
});

test("share screenshot falls back to a local PNG download", async () => {
  let clicked = false;
  let appended = false;
  let revoked = false;
  const link = {
    style: {},
    click: () => {
      clicked = true;
    },
    remove() {},
  };
  const result = await deliverShareScreenshot({
    blob: new Blob(["png"], { type: "image/png" }),
    filename: "history.png",
    navigatorRef: {},
    documentRef: {
      createElement: () => link,
      body: { appendChild: () => (appended = true) },
    },
    urlRef: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: () => (revoked = true),
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(result, "downloaded");
  assert.equal(link.download, "history.png");
  assert.equal(appended, true);
  assert.equal(clicked, true);
  assert.equal(revoked, true);
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
    daysInRoam: 6,
    firstUseDate: "2026-08-01",
    currentStreak: 3,
    longestStreak: 3,
  });
});

test("days in Roam is zero when no dated blocks exist", () => {
  const stats = calculateStats({}, new Date("2026-08-06T12:00:00Z"));
  assert.equal(stats.daysInRoam, 0);
  assert.equal(stats.firstUseDate, null);
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
