const ROOT_ID = "roam-contribution-graph-root";
const TOPBAR_BUTTON_ID = "roam-contribution-graph-button";
const COMMAND_LABEL = "Contribution Graph: Open complete history";
const SHOW_BUTTON_SETTING = "showTopbarButton";
const CACHE_TTL_MS = 60_000;
const SVG_NS = "http://www.w3.org/2000/svg";
const CELL_SIZE = 7;
const CELL_GAP = 2;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const GRAPH_TOP = 17;
const GRAPH_LEFT = 24;

export const ALL_BLOCKS_QUERY = `[:find ?entity ?time
  :timeout 60000
  :where
  [?entity :block/string]
  [?entity :create/time ?time]]`;

export const OWN_BLOCKS_QUERY = `[:find ?entity ?time
  :timeout 60000
  :in $ ?user-uid
  :where
  [?user :user/uid ?user-uid]
  [?entity :create/user ?user]
  [?entity :block/string]
  [?entity :create/time ?time]]`;

const nextFrame = () =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });

const createLocalDate = (year, month, day) => new Date(year, month, day, 12, 0, 0, 0);

export const formatDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date, amount) => {
  const next = createLocalDate(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
};

const dateFromKey = (key) => {
  const [year, month, day] = key.split("-").map(Number);
  return createLocalDate(year, month - 1, day);
};

export const getContributionLevel = (count) => {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (count < 10) return 1;
  if (count < 25) return 2;
  if (count < 50) return 3;
  return 4;
};

export const aggregateTimestamps = (timestamps) => {
  const counts = Object.create(null);
  for (const timestamp of timestamps) {
    const key = formatDateKey(timestamp);
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
};

export const aggregateTimestampsInBatches = async (
  timestamps,
  { chunkSize = 25_000, shouldContinue = () => true, yieldControl = nextFrame } = {}
) => {
  const counts = Object.create(null);
  for (let index = 0; index < timestamps.length; index += 1) {
    if (!shouldContinue()) return null;
    const key = formatDateKey(timestamps[index]);
    if (key) counts[key] = (counts[key] || 0) + 1;
    if (index > 0 && index % chunkSize === 0) await yieldControl();
  }
  return counts;
};

export const buildYearCalendar = (year, counts = {}) => {
  const firstDay = createLocalDate(year, 0, 1);
  const lastDay = createLocalDate(year, 11, 31);
  const gridStart = addDays(firstDay, -firstDay.getDay());
  const gridEnd = addDays(lastDay, 6 - lastDay.getDay());
  const cells = [];
  const monthColumns = [];
  let current = gridStart;
  let week = 0;
  let lastMonth = null;

  while (current <= gridEnd) {
    const inYear = current.getFullYear() === year;
    const key = formatDateKey(current);
    const month = current.getMonth();
    if (inYear && month !== lastMonth) {
      monthColumns.push({ month, week });
      lastMonth = month;
    }
    cells.push({
      key,
      week,
      weekday: current.getDay(),
      inYear,
      count: inYear ? counts[key] || 0 : 0,
    });
    if (current.getDay() === 6) week += 1;
    current = addDays(current, 1);
  }

  return { year, cells, monthColumns, weekCount: week };
};

export const getHistoryYears = (counts, currentYear = new Date().getFullYear()) => {
  const years = Object.keys(counts)
    .map((key) => Number(key.slice(0, 4)))
    .filter(Number.isFinite);
  const earliest = years.length > 0 ? Math.min(...years) : currentYear;
  const latest = Math.max(currentYear, ...(years.length > 0 ? years : [currentYear]));
  return Array.from({ length: latest - earliest + 1 }, (_, index) => latest - index);
};

export const calculateStats = (counts, today = new Date()) => {
  const activeKeys = Object.keys(counts)
    .filter((key) => counts[key] > 0)
    .sort();
  const totalBlocks = activeKeys.reduce((total, key) => total + counts[key], 0);

  let longestStreak = 0;
  let runningStreak = 0;
  let previous = null;
  for (const key of activeKeys) {
    const date = dateFromKey(key);
    const consecutive = previous && Math.round((date - previous) / 86_400_000) === 1;
    runningStreak = consecutive ? runningStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, runningStreak);
    previous = date;
  }

  let currentStreak = 0;
  let cursor = createLocalDate(today.getFullYear(), today.getMonth(), today.getDate());
  while ((counts[formatDateKey(cursor)] || 0) > 0) {
    currentStreak += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    totalBlocks,
    activeDays: activeKeys.length,
    currentStreak,
    longestStreak,
  };
};

const resolveQuery = (api) => {
  if (api?.data?.async?.q) return api.data.async.q.bind(api.data.async);
  if (api?.data?.fast?.q) return api.data.fast.q.bind(api.data.fast);
  if (api?.data?.q) return api.data.q.bind(api.data);
  if (api?.q) return api.q.bind(api);
  throw new Error("Roam Datalog query API is unavailable");
};

export const queryCreationTimestamps = async ({ api, scope = "all", userUid = null }) => {
  const query = resolveQuery(api);
  const rows = await (
    scope === "own"
      ? userUid
        ? query(OWN_BLOCKS_QUERY, userUid)
        : (() => {
            throw new Error("Current Roam user is unavailable");
          })()
      : query(ALL_BLOCKS_QUERY)
  );

  return (Array.isArray(rows) ? rows : [])
    .map((row) => (Array.isArray(row) ? row[row.length - 1] : row))
    .filter((timestamp) => Number.isFinite(timestamp));
};

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const createSvgElement = (tag, attributes = {}) => {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  return element;
};

const renderYearGraph = (year, counts) => {
  const calendar = buildYearCalendar(year, counts);
  const width = GRAPH_LEFT + calendar.weekCount * CELL_STEP + 4;
  const height = GRAPH_TOP + 7 * CELL_STEP + 4;
  const yearCells = calendar.cells.filter((cell) => cell.inYear);
  const yearTotal = yearCells.reduce((total, cell) => total + cell.count, 0);
  const activeDays = yearCells.filter((cell) => cell.count > 0).length;
  const section = createElement("section", "rcg-year");
  const headingRow = createElement("div", "rcg-year__header");
  const heading = createElement("h3", "rcg-year__heading", String(year));
  const summary = createElement(
    "span",
    "rcg-year__summary",
    `${yearTotal.toLocaleString()} blocks · ${activeDays.toLocaleString()} active days`
  );
  headingRow.append(heading, summary);
  const scroller = createElement("div", "rcg-year__scroller");
  const svg = createSvgElement("svg", {
    class: "rcg-year__svg",
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
    "aria-label": `${year} Roam block contribution graph`,
  });
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (const { month, week } of calendar.monthColumns) {
    const label = createSvgElement("text", {
      x: GRAPH_LEFT + week * CELL_STEP,
      y: 8,
      class: "rcg-year__label",
    });
    label.textContent = monthNames[month];
    svg.appendChild(label);
  }

  for (const [weekday, labelText] of [[1, "Mon"], [3, "Wed"], [5, "Fri"]]) {
    const label = createSvgElement("text", {
      x: 0,
      y: GRAPH_TOP + weekday * CELL_STEP + CELL_SIZE - 1,
      class: "rcg-year__label",
    });
    label.textContent = labelText;
    svg.appendChild(label);
  }

  for (const cell of calendar.cells) {
    const rect = createSvgElement("rect", {
      x: GRAPH_LEFT + cell.week * CELL_STEP,
      y: GRAPH_TOP + cell.weekday * CELL_STEP,
      width: CELL_SIZE,
      height: CELL_SIZE,
      rx: 1.5,
      class: cell.inYear
        ? `rcg-cell rcg-cell--level-${getContributionLevel(cell.count)}`
        : "rcg-cell rcg-cell--outside",
      "data-date": cell.key,
      "data-count": cell.count,
    });
    if (cell.inYear) {
      const title = createSvgElement("title");
      title.textContent = `${cell.count} block${cell.count === 1 ? "" : "s"} on ${cell.key}`;
      rect.appendChild(title);
    }
    svg.appendChild(rect);
  }

  scroller.appendChild(svg);
  section.append(headingRow, scroller);
  return section;
};

const renderLegend = () => {
  const legend = createElement("div", "rcg-legend");
  legend.appendChild(createElement("span", "", "Less"));
  for (let level = 0; level <= 4; level += 1) {
    const cell = createElement("span", `rcg-legend__cell rcg-cell--level-${level}`);
    cell.title = ["0", "1-9", "10-24", "25-49", "50+"][level];
    legend.appendChild(cell);
  }
  legend.appendChild(createElement("span", "", "More"));
  return legend;
};

const renderStats = (container, counts) => {
  const stats = calculateStats(counts);
  const values = [
    ["Blocks", stats.totalBlocks.toLocaleString()],
    ["Active days", stats.activeDays.toLocaleString()],
    ["Current streak", `${stats.currentStreak}d`],
    ["Longest streak", `${stats.longestStreak}d`],
  ];
  container.replaceChildren(
    ...values.map(([label, value]) => {
      const card = createElement("div", "rcg-stat");
      card.append(
        createElement("strong", "rcg-stat__value", value),
        createElement("span", "rcg-stat__label", label)
      );
      return card;
    })
  );
};

const renderHistory = (container, counts) => {
  const yearsGrid = createElement("div", "rcg-years");
  const years = getHistoryYears(counts);
  yearsGrid.setAttribute("aria-label", `Complete history from ${years.at(-1)} to ${years[0]}`);
  for (const year of years) yearsGrid.appendChild(renderYearGraph(year, counts));
  container.replaceChildren(yearsGrid, renderLegend());
};

const formatLoadedStatus = ({ scope, counts, cached = false }) => {
  const years = getHistoryYears(counts);
  const range = years[0] === years.at(-1) ? String(years[0]) : `${years.at(-1)}–${years[0]}`;
  const total = calculateStats(counts).totalBlocks.toLocaleString();
  const source = scope === "all" ? "Entire graph" : "Current user";
  const freshness = cached ? "cached" : `updated ${new Date().toLocaleTimeString()}`;
  return `${source} · ${range} · ${total} blocks · ${freshness}`;
};

const getCurrentUserUid = (api) => {
  try {
    return api?.user?.uid?.() || null;
  } catch {
    return null;
  }
};

const normalizeChecked = (event) =>
  typeof event === "boolean" ? event : Boolean(event?.target?.checked);

export const createExtensionController = ({ extensionAPI, api = window.roamAlphaAPI }) => {
  let destroyed = false;
  let root = null;
  let topbarObserver = null;
  let loadVersion = 0;
  const cache = new Map();
  const cleanup = [];
  const userUid = getCurrentUserUid(api);

  const removeTopbarButton = () => document.getElementById(TOPBAR_BUTTON_ID)?.remove();

  const open = () => {
    if (destroyed) return;
    if (!root) root = createDialog();
    root.classList.add("rcg-root--open");
    root.setAttribute("aria-hidden", "false");
    root.querySelector(".rcg-dialog")?.focus();
    void load(false);
  };

  const close = () => {
    if (!root) return;
    loadVersion += 1;
    root.classList.remove("rcg-root--open");
    root.setAttribute("aria-hidden", "true");
  };

  const ensureTopbarButton = () => {
    if (destroyed || extensionAPI.settings.get(SHOW_BUTTON_SETTING) === false) {
      removeTopbarButton();
      return;
    }
    if (document.getElementById(TOPBAR_BUTTON_ID)) return;
    const topbar = document.querySelector(".rm-topbar");
    if (!topbar) return;
    const button = createElement("button", "bp3-button bp3-minimal rcg-topbar-button", "▦");
    button.id = TOPBAR_BUTTON_ID;
    button.type = "button";
    button.title = "Open complete Roam contribution history";
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", open);
    topbar.appendChild(button);
  };

  const setTopbarEnabled = (enabled) => {
    extensionAPI.settings.set(SHOW_BUTTON_SETTING, enabled);
    if (enabled) ensureTopbarButton();
    else removeTopbarButton();
  };

  const createDialog = () => {
    const overlay = createElement("div", "rcg-root");
    overlay.id = ROOT_ID;
    overlay.setAttribute("aria-hidden", "true");
    const dialog = createElement("div", "rcg-dialog");
    dialog.tabIndex = -1;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "rcg-title");

    const header = createElement("header", "rcg-header");
    const mark = createElement("span", "rcg-mark", "▦");
    mark.setAttribute("aria-hidden", "true");
    const titleGroup = createElement("div", "rcg-heading");
    const title = createElement("h2", "rcg-title", "Contribution Graph");
    title.id = "rcg-title";
    titleGroup.append(
      title,
      createElement("p", "rcg-subtitle", "Complete Roam block creation history")
    );
    const actions = createElement("div", "rcg-actions");
    const scopeLabel = createElement("label", "rcg-scope");
    scopeLabel.appendChild(createElement("span", "rcg-visually-hidden", "History scope"));
    const scope = createElement("select", "bp3-input rcg-scope__select");
    scope.name = "scope";
    const allOption = createElement("option", "", "Entire graph");
    allOption.value = "all";
    scope.appendChild(allOption);
    if (userUid) {
      const ownOption = createElement("option", "", "Current Roam user");
      ownOption.value = "own";
      scope.appendChild(ownOption);
    }
    scope.value = "all";
    scope.addEventListener("change", () => void load(true));
    scopeLabel.appendChild(scope);
    const refresh = createElement("button", "bp3-button rcg-refresh", "↻ Refresh");
    refresh.type = "button";
    refresh.addEventListener("click", () => void load(true));
    const closeButton = createElement("button", "bp3-button bp3-minimal rcg-close", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close contribution graph");
    closeButton.addEventListener("click", close);
    actions.append(scopeLabel, refresh, closeButton);
    header.append(mark, titleGroup, actions);

    const note = createElement(
      "p",
      "rcg-note",
      "Every dated block is included. Imports and Agents count under their creator. Data stays in this browser."
    );
    const status = createElement("div", "rcg-status", "Open the graph to load activity.");
    status.setAttribute("role", "status");
    const stats = createElement("div", "rcg-stats");
    const overviewMeta = createElement("div", "rcg-overview__meta");
    overviewMeta.append(status, note);
    const overview = createElement("section", "rcg-overview");
    overview.append(stats, overviewMeta);
    const content = createElement("div", "rcg-content");
    dialog.append(header, overview, content);
    overlay.appendChild(dialog);
    overlay.addEventListener("pointerdown", (event) => {
      if (event.target === overlay) close();
    });
    document.body.appendChild(overlay);
    return overlay;
  };

  const load = async (force) => {
    if (!root || destroyed) return;
    const scope = root.querySelector("select[name='scope']")?.value || "all";
    const status = root.querySelector(".rcg-status");
    const stats = root.querySelector(".rcg-stats");
    const content = root.querySelector(".rcg-content");
    const refresh = root.querySelector(".rcg-refresh");
    const cached = cache.get(scope);
    if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      renderStats(stats, cached.counts);
      renderHistory(content, cached.counts);
      status.textContent = formatLoadedStatus({ scope, counts: cached.counts, cached: true });
      return;
    }

    const version = ++loadVersion;
    status.textContent = "Reading complete Roam history…";
    status.classList.remove("rcg-status--error");
    refresh.disabled = true;
    stats.replaceChildren();
    content.replaceChildren(createElement("div", "rcg-loading", "Loading…"));
    await nextFrame();

    try {
      const timestamps = await queryCreationTimestamps({ api, scope, userUid });
      status.textContent = `Aggregating ${timestamps.length.toLocaleString()} blocks across all years…`;
      const counts = await aggregateTimestampsInBatches(timestamps, {
        shouldContinue: () => !destroyed && version === loadVersion,
      });
      if (!counts || destroyed || version !== loadVersion) return;
      cache.set(scope, { counts, rowCount: timestamps.length, loadedAt: Date.now() });
      renderStats(stats, counts);
      renderHistory(content, counts);
      status.textContent = formatLoadedStatus({ scope, counts });
    } catch (error) {
      if (destroyed || version !== loadVersion) return;
      content.replaceChildren();
      status.textContent = `Could not load contribution history: ${error?.message || error}`;
      status.classList.add("rcg-status--error");
    } finally {
      if (!destroyed && version === loadVersion) refresh.disabled = false;
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape" && root?.classList.contains("rcg-root--open")) close();
  };

  const init = () => {
    const showButtonSetting = extensionAPI.settings.get(SHOW_BUTTON_SETTING);
    if (showButtonSetting !== true && showButtonSetting !== false) {
      extensionAPI.settings.set(SHOW_BUTTON_SETTING, true);
    }
    extensionAPI.settings.panel.create({
      tabTitle: "Contribution Graph",
      settings: [
        {
          id: SHOW_BUTTON_SETTING,
          name: "Show topbar button",
          description: "The command palette remains available when this is disabled.",
          action: {
            type: "switch",
            defaultValue: true,
            onChange: (event) => setTopbarEnabled(normalizeChecked(event)),
          },
        },
      ],
    });
    extensionAPI.ui.commandPalette.addCommand({ label: COMMAND_LABEL, callback: open });
    document.addEventListener("keydown", onKeyDown, true);
    cleanup.push(() => document.removeEventListener("keydown", onKeyDown, true));
    topbarObserver = new MutationObserver(ensureTopbarButton);
    topbarObserver.observe(document.body, { childList: true, subtree: true });
    ensureTopbarButton();
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    loadVersion += 1;
    topbarObserver?.disconnect();
    topbarObserver = null;
    removeTopbarButton();
    root?.remove();
    root = null;
    for (const dispose of cleanup.splice(0)) dispose();
    try {
      extensionAPI.ui.commandPalette.removeCommand({ label: COMMAND_LABEL });
    } catch {
      // Commands registered through extensionAPI are also cleaned by Roam on unload.
    }
  };

  return { init, destroy, open, close };
};

let activeController = null;

export default {
  onload: ({ extensionAPI }) => {
    activeController?.destroy();
    activeController = createExtensionController({ extensionAPI });
    activeController.init();
  },
  onunload: () => {
    activeController?.destroy();
    activeController = null;
  },
};
