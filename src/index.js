const ROOT_ID = "roam-contribution-graph-root";
const TOPBAR_BUTTON_ID = "roam-contribution-graph-button";
const COMMAND_LABEL = "Contribution Graph: Open complete history";
const SHOW_BUTTON_SETTING = "showTopbarButton";
const CACHE_TTL_MS = 60_000;
const SVG_NS = "http://www.w3.org/2000/svg";
const CELL_SIZE = 11;
const CELL_GAP = 3;
const CELL_STEP = CELL_SIZE + CELL_GAP;
const GRAPH_TOP = 18;
const GRAPH_LEFT = 38;
const SHARE_SCALE = 3;
const SHARE_PADDING = 32;
const SHARE_PANEL_WIDTH = 836;
const SHARE_PANEL_HEIGHT = 116;
const SHARE_PANEL_GAP = 4;
const SHARE_HEADER_HEIGHT = 132;
const SHARE_FOOTER_HEIGHT = 36;
const ROAM_UI_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

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

const formatShareDate = (date) =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);

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

export const getCalendarCellPeriod = (
  { key, inYear },
  { firstUseDate = null, todayKey = null } = {}
) => {
  if (!inYear) return "outside";
  if (todayKey && key > todayKey) return "future";
  if (!firstUseDate || key < firstUseDate) return "before-history";
  return "history";
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
  const firstUseDate = activeKeys[0] || null;
  const todayDate = createLocalDate(today.getFullYear(), today.getMonth(), today.getDate());
  const daysInRoam = firstUseDate
    ? Math.max(0, Math.round((todayDate - dateFromKey(firstUseDate)) / 86_400_000) + 1)
    : 0;

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
    daysInRoam,
    firstUseDate,
    currentStreak,
    longestStreak,
  };
};

export const buildShareImageLayout = (
  counts,
  currentYear = new Date().getFullYear()
) => {
  const years = getHistoryYears(counts, currentYear);
  const columns = 1;
  const rows = years.length;
  return {
    years,
    columns,
    rows,
    width:
      SHARE_PADDING * 2 +
      columns * SHARE_PANEL_WIDTH +
      (columns - 1) * SHARE_PANEL_GAP,
    height:
      SHARE_HEADER_HEIGHT +
      rows * SHARE_PANEL_HEIGHT +
      Math.max(0, rows - 1) * SHARE_PANEL_GAP +
      SHARE_FOOTER_HEIGHT,
  };
};

const drawRoundedRect = (context, x, y, width, height, radius, fill, stroke) => {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  if (fill) {
    context.fillStyle = fill;
    context.fill();
  }
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.stroke();
  }
};

const drawShareYear = (context, { year, counts, x, y, fontFamily, bounds }) => {
  const calendar = buildYearCalendar(year, counts);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const levelColors = ["#ebf1f5", "#c6e6f4", "#79c0e8", "#2b95d6", "#106ba3"];
  const gridLeft = x + GRAPH_LEFT;
  const gridTop = y + GRAPH_TOP;

  context.fillStyle = "#293742";
  context.font = `700 11px ${fontFamily}`;
  context.textAlign = "left";
  context.fillText(String(year), x, y + 10);

  context.fillStyle = "#394b59";
  context.font = `600 10px ${fontFamily}`;
  context.textAlign = "left";
  for (const { month, week } of calendar.monthColumns) {
    context.fillText(monthNames[month], gridLeft + week * CELL_STEP, y + 10);
  }
  for (const [weekday, label] of [[1, "Mon"], [3, "Wed"], [5, "Fri"]]) {
    context.fillText(label, x, gridTop + weekday * CELL_STEP + 8);
  }

  for (const cell of calendar.cells) {
    const period = getCalendarCellPeriod(cell, bounds);
    if (period === "outside" || period === "future") continue;
    const cellX = gridLeft + cell.week * CELL_STEP;
    const cellY = gridTop + cell.weekday * CELL_STEP;
    if (period === "before-history") {
      context.strokeStyle = "#d8e1e8";
      context.lineWidth = 0.5;
      context.strokeRect(cellX + 0.25, cellY + 0.25, CELL_SIZE - 0.5, CELL_SIZE - 0.5);
      continue;
    }
    context.fillStyle = levelColors[getContributionLevel(cell.count)];
    context.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
  }
};

export const createShareScreenshot = async ({
  counts,
  scope = "all",
  now = new Date(),
  documentRef = document,
}) => {
  const layout = buildShareImageLayout(counts, now.getFullYear());
  const canvas = documentRef.createElement("canvas");
  canvas.width = layout.width * SHARE_SCALE;
  canvas.height = layout.height * SHARE_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable");
  context.imageSmoothingEnabled = false;
  context.scale(SHARE_SCALE, SHARE_SCALE);
  const fontFamily = ROAM_UI_FONT_FAMILY;
  context.fillStyle = "#f5f8fa";
  context.fillRect(0, 0, layout.width, layout.height);

  const stats = calculateStats(counts, now);
  const range =
    layout.years[0] === layout.years.at(-1)
      ? String(layout.years[0])
      : `${layout.years.at(-1)}–${layout.years[0]}`;
  const scopeLabel = scope === "all" ? "Entire graph" : "Current Roam user";

  context.fillStyle = "#182026";
  context.font = `600 23px ${fontFamily}`;
  context.textAlign = "left";
  context.fillText("Contribution Graph", SHARE_PADDING, 38);
  context.fillStyle = "#394b59";
  context.font = `600 12px ${fontFamily}`;
  context.fillText(
    `${scopeLabel} · Complete block history · ${range} · @RoamResearch`,
    SHARE_PADDING,
    61
  );
  context.textAlign = "right";
  context.fillText(
    formatShareDate(now),
    layout.width - SHARE_PADDING,
    38
  );

  const statItems = [
    ["DAYS IN ROAM", stats.daysInRoam.toLocaleString()],
    ["LONGEST STREAK", stats.longestStreak.toLocaleString()],
    ["CURRENT STREAK", stats.currentStreak.toLocaleString()],
    ["BLOCKS", stats.totalBlocks.toLocaleString()],
  ];
  const statsY = 72;
  const statsWidth = layout.width - SHARE_PADDING * 2;
  const statWidth = statsWidth / statItems.length;
  drawRoundedRect(context, SHARE_PADDING, statsY, statsWidth, 46, 3, "#ffffff", "#d8e1e8");
  for (const [index, [label, value]] of statItems.entries()) {
    const statX = SHARE_PADDING + index * statWidth;
    if (index > 0) {
      context.strokeStyle = "#d8e1e8";
      context.beginPath();
      context.moveTo(statX, statsY);
      context.lineTo(statX, statsY + 46);
      context.stroke();
    }
    context.fillStyle = "#182026";
    context.font = `600 16px ${fontFamily}`;
    context.textAlign = "left";
    context.fillText(value, statX + 12, statsY + 22);
    context.fillStyle = "#394b59";
    context.font = `600 9px ${fontFamily}`;
    context.fillText(label, statX + 12, statsY + 39);
  }

  for (const [index, year] of layout.years.entries()) {
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    drawShareYear(context, {
      year,
      counts,
      x: SHARE_PADDING + column * (SHARE_PANEL_WIDTH + SHARE_PANEL_GAP),
      y: SHARE_HEADER_HEIGHT + row * (SHARE_PANEL_HEIGHT + SHARE_PANEL_GAP),
      fontFamily,
      bounds: { firstUseDate: stats.firstUseDate, todayKey: formatDateKey(now) },
    });
  }

  const footerCenterY = layout.height - 21;
  const legendX = layout.width - SHARE_PADDING - 106;
  context.fillStyle = "#394b59";
  context.font = `600 9px ${fontFamily}`;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText("Less", legendX, footerCenterY);
  for (let level = 0; level <= 4; level += 1) {
    context.fillStyle = ["#ebf1f5", "#c6e6f4", "#79c0e8", "#2b95d6", "#106ba3"][level];
    context.fillRect(legendX + 27 + level * 10, footerCenterY - 4, 8, 8);
  }
  context.fillStyle = "#394b59";
  context.fillText("More", legendX + 82, footerCenterY);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Could not create screenshot"))),
      "image/png"
    );
  });
  return {
    blob,
    filename: `roam-contribution-graph-${formatDateKey(now)}.png`,
    width: layout.width,
    height: layout.height,
  };
};

export const deliverShareScreenshot = async ({
  blob,
  filename,
  navigatorRef = navigator,
  documentRef = document,
  urlRef = URL,
}) => {
  const FileType = globalThis.File;
  const file = FileType ? new FileType([blob], filename, { type: "image/png" }) : null;
  let canShareFiles = false;
  try {
    canShareFiles = Boolean(file && navigatorRef?.share && navigatorRef.canShare?.({ files: [file] }));
  } catch {
    canShareFiles = false;
  }
  if (canShareFiles) {
    try {
      await navigatorRef.share({
        title: "Roam Contribution Graph",
        text: "Complete Roam block contribution history",
        files: [file],
      });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") throw error;
    }
  }

  const ClipboardItemType = globalThis.ClipboardItem;
  if (ClipboardItemType && navigatorRef?.clipboard?.write) {
    try {
      await navigatorRef.clipboard.write([new ClipboardItemType({ "image/png": blob })]);
      return "copied";
    } catch {
      // Clipboard image writes are not available in every Roam host; download below.
    }
  }

  const objectUrl = urlRef.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  documentRef.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => urlRef.revokeObjectURL(objectUrl), 0);
  return "downloaded";
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

const renderYearGraph = (year, counts, bounds) => {
  const calendar = buildYearCalendar(year, counts);
  const width = GRAPH_LEFT + calendar.weekCount * CELL_STEP + 4;
  const height = GRAPH_TOP + 7 * CELL_STEP + 4;
  const yearCells = calendar.cells.filter((cell) => cell.inYear);
  const yearTotal = yearCells.reduce((total, cell) => total + cell.count, 0);
  const activeDays = yearCells.filter((cell) => cell.count > 0).length;
  const section = createElement("section", "rcg-year");
  section.title = `${year}: ${yearTotal.toLocaleString()} blocks across ${activeDays.toLocaleString()} active days`;
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

  const yearLabel = createSvgElement("text", {
    x: 0,
    y: 10,
    class: "rcg-year__year",
  });
  yearLabel.textContent = String(year);
  svg.appendChild(yearLabel);

  for (const { month, week } of calendar.monthColumns) {
    const label = createSvgElement("text", {
      x: GRAPH_LEFT + week * CELL_STEP,
      y: 10,
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
    const period = getCalendarCellPeriod(cell, bounds);
    const cellClass = {
      outside: "rcg-cell rcg-cell--outside",
      future: "rcg-cell rcg-cell--future",
      "before-history": "rcg-cell rcg-cell--before-history",
    }[period] || `rcg-cell rcg-cell--level-${getContributionLevel(cell.count)}`;
    const rect = createSvgElement("rect", {
      x: GRAPH_LEFT + cell.week * CELL_STEP,
      y: GRAPH_TOP + cell.weekday * CELL_STEP,
      width: CELL_SIZE,
      height: CELL_SIZE,
      rx: 1.5,
      class: cellClass,
      "data-date": cell.key,
      "data-count": cell.count,
    });
    if (period === "history") {
      const title = createSvgElement("title");
      title.textContent = `${cell.count} block${cell.count === 1 ? "" : "s"} on ${cell.key}`;
      rect.appendChild(title);
    }
    svg.appendChild(rect);
  }

  scroller.appendChild(svg);
  section.appendChild(scroller);
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
    [
      "Days in Roam",
      stats.daysInRoam.toLocaleString(),
      stats.firstUseDate ? `Since the first dated block on ${stats.firstUseDate}` : "No dated blocks yet",
    ],
    ["Longest streak", stats.longestStreak.toLocaleString(), "Longest consecutive run of active days"],
    ["Current streak", stats.currentStreak.toLocaleString(), "Consecutive active days through today"],
    ["Blocks", stats.totalBlocks.toLocaleString(), "All dated blocks in the selected scope"],
  ];
  container.replaceChildren(
    ...values.map(([label, value, title]) => {
      const card = createElement("div", "rcg-stat");
      card.title = title;
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
  const now = new Date();
  const stats = calculateStats(counts, now);
  const bounds = { firstUseDate: stats.firstUseDate, todayKey: formatDateKey(now) };
  yearsGrid.setAttribute("aria-label", `Complete history from ${years.at(-1)} to ${years[0]}`);
  for (const year of years) yearsGrid.appendChild(renderYearGraph(year, counts, bounds));
  container.replaceChildren(yearsGrid, renderLegend());
};

export const formatLoadedStatus = ({ scope, counts }) => {
  const years = getHistoryYears(counts);
  const range = years[0] === years.at(-1) ? String(years[0]) : `${years.at(-1)}–${years[0]}`;
  const source = scope === "all" ? "Entire graph" : "Current user";
  return `${source} · ${range}`;
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
  let shareFeedbackTimer = null;
  let returnFocusTarget = null;
  const cache = new Map();
  const cleanup = [];
  const userUid = getCurrentUserUid(api);

  const removeTopbarButton = () => document.getElementById(TOPBAR_BUTTON_ID)?.remove();

  const open = () => {
    if (destroyed) return;
    const wasOpen = root?.classList.contains("rcg-root--open");
    if (!wasOpen) {
      const activeElement = document.activeElement;
      returnFocusTarget = activeElement && activeElement !== document.body ? activeElement : null;
    }
    if (!root) root = createDialog();
    root.classList.add("rcg-root--open");
    root.setAttribute("aria-hidden", "false");
    root.querySelector(".rcg-dialog")?.focus();
    void load(false);
  };

  const close = () => {
    if (!root || !root.classList.contains("rcg-root--open")) return;
    loadVersion += 1;
    root.classList.remove("rcg-root--open");
    root.setAttribute("aria-hidden", "true");
    const focusTarget = returnFocusTarget;
    returnFocusTarget = null;
    if (
      focusTarget &&
      focusTarget.isConnected !== false &&
      typeof focusTarget.focus === "function"
    ) {
      focusTarget.focus();
    }
  };

  const ensureTopbarButton = () => {
    if (destroyed || extensionAPI.settings.get(SHOW_BUTTON_SETTING) === false) {
      removeTopbarButton();
      return;
    }
    if (document.getElementById(TOPBAR_BUTTON_ID)) return;
    const topbar = document.querySelector(".rm-topbar");
    if (!topbar) return;
    const button = createElement(
      "button",
      "bp3-button bp3-minimal bp3-icon-heat-grid rcg-topbar-button"
    );
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

  const setShareButtonState = (button, { label, icon, resetAfter = 0 }) => {
    if (shareFeedbackTimer) {
      clearTimeout(shareFeedbackTimer);
      shareFeedbackTimer = null;
    }
    for (const iconName of ["camera", "time", "tick", "cross"]) {
      button.classList.remove(`bp3-icon-${iconName}`);
    }
    button.classList.add(`bp3-icon-${icon}`);
    button.textContent = label;
    button.title = label === "Share Screenshot" ? "Share complete history as a high-resolution PNG" : label;
    button.setAttribute("aria-label", button.title);
    if (resetAfter > 0 && !destroyed) {
      shareFeedbackTimer = setTimeout(() => {
        shareFeedbackTimer = null;
        setShareButtonState(button, { label: "Share Screenshot", icon: "camera" });
      }, resetAfter);
    }
  };

  const shareCurrentHistory = async () => {
    if (!root || destroyed) return;
    const scope = root.querySelector("select[name='scope']")?.value || "all";
    const cached = cache.get(scope);
    const shareButton = root.querySelector(".rcg-share");
    if (!cached || !shareButton) return;

    shareButton.disabled = true;
    shareButton.setAttribute("aria-busy", "true");
    setShareButtonState(shareButton, { label: "Preparing…", icon: "time" });
    try {
      const screenshot = await createShareScreenshot({ counts: cached.counts, scope });
      const delivery = await deliverShareScreenshot(screenshot);
      const deliveryLabel = {
        shared: "Shared",
        copied: "Copied",
        downloaded: "Downloaded",
      }[delivery];
      setShareButtonState(shareButton, {
        label: deliveryLabel,
        icon: "tick",
        resetAfter: 2200,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        setShareButtonState(shareButton, {
          label: "Canceled",
          icon: "cross",
          resetAfter: 1800,
        });
      } else {
        setShareButtonState(shareButton, {
          label: "Try again",
          icon: "cross",
          resetAfter: 2600,
        });
      }
    } finally {
      shareButton.disabled = false;
      shareButton.removeAttribute("aria-busy");
    }
  };

  const createDialog = () => {
    const overlay = createElement("div", "rcg-root");
    overlay.id = ROOT_ID;
    overlay.setAttribute("aria-hidden", "true");
    const dialog = createElement("div", "bp3-dialog rcg-dialog");
    dialog.tabIndex = -1;
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "rcg-title");

    const header = createElement("header", "bp3-dialog-header rcg-header");
    const titleGroup = createElement("div", "rcg-heading");
    const title = createElement("h2", "bp3-heading rcg-title", "Contribution Graph");
    title.id = "rcg-title";
    const subline = createElement("div", "rcg-subline");
    subline.append(
      createElement("p", "rcg-subtitle", "Complete block creation history ·"),
      createElement("span", "rcg-roam-attribution", "@RoamResearch")
    );
    titleGroup.append(
      title,
      subline
    );
    const actions = createElement("div", "rcg-actions");
    const scopeLabel = createElement("label", "rcg-scope");
    scopeLabel.appendChild(createElement("span", "rcg-visually-hidden", "History scope"));
    const scopeWrapper = createElement("div", "bp3-select bp3-small rcg-scope__wrapper");
    const scope = createElement("select", "rcg-scope__select");
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
    scope.addEventListener("change", () => void load(false));
    scopeWrapper.appendChild(scope);
    scopeLabel.appendChild(scopeWrapper);
    const shareButton = createElement(
      "button",
      "bp3-button bp3-intent-primary bp3-icon-camera rcg-share",
      "Share Screenshot"
    );
    shareButton.type = "button";
    shareButton.disabled = true;
    shareButton.title = "Share complete history as a high-resolution PNG";
    shareButton.setAttribute("aria-label", shareButton.title);
    shareButton.addEventListener("click", () => void shareCurrentHistory());
    const refresh = createElement(
      "button",
      "bp3-button bp3-minimal bp3-icon-refresh rcg-refresh rcg-icon-button"
    );
    refresh.type = "button";
    refresh.title = "Refresh complete history";
    refresh.setAttribute("aria-label", refresh.title);
    refresh.addEventListener("click", () => void load(true));
    const closeButton = createElement(
      "button",
      "bp3-dialog-close-button bp3-button bp3-minimal bp3-icon-cross rcg-close"
    );
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close contribution graph");
    closeButton.addEventListener("click", close);
    actions.append(scopeLabel, shareButton, refresh, closeButton);
    header.append(titleGroup, actions);

    const status = createElement("div", "rcg-status", "Open the graph to load activity.");
    status.setAttribute("role", "status");
    const stats = createElement("div", "rcg-stats");
    const overviewMeta = createElement("div", "rcg-overview__meta");
    overviewMeta.appendChild(status);
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
    const shareButton = root.querySelector(".rcg-share");
    const cached = cache.get(scope);
    if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
      renderStats(stats, cached.counts);
      renderHistory(content, cached.counts);
      status.textContent = formatLoadedStatus({ scope, counts: cached.counts });
      status.classList.remove("rcg-status--error");
      shareButton.disabled = false;
      return;
    }

    const version = ++loadVersion;
    status.textContent = "Reading complete Roam history…";
    status.classList.remove("rcg-status--error");
    setShareButtonState(shareButton, { label: "Share Screenshot", icon: "camera" });
    refresh.disabled = true;
    shareButton.disabled = true;
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
      shareButton.disabled = false;
    } catch (error) {
      if (destroyed || version !== loadVersion) return;
      if (force) cache.delete(scope);
      content.replaceChildren();
      status.textContent = `Could not load contribution history: ${error?.message || error}`;
      status.classList.add("rcg-status--error");
    } finally {
      if (!destroyed && version === loadVersion) refresh.disabled = false;
    }
  };

  const onKeyDown = (event) => {
    if (!root?.classList.contains("rcg-root--open")) return;
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const dialog = root.querySelector(".rcg-dialog");
    const focusable = Array.from(
      dialog?.querySelectorAll("button:not([disabled]), select:not([disabled])") || []
    );
    if (focusable.length === 0) {
      event.preventDefault();
      dialog?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    const activeElement = document.activeElement;
    const outsideDialog = !dialog?.contains(activeElement);
    if (event.shiftKey && (activeElement === first || activeElement === dialog || outsideDialog)) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (activeElement === last || activeElement === dialog || outsideDialog)
    ) {
      event.preventDefault();
      first.focus();
    }
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
    returnFocusTarget = null;
    if (shareFeedbackTimer) clearTimeout(shareFeedbackTimer);
    shareFeedbackTimer = null;
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
