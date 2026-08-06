import test from "node:test";
import assert from "node:assert/strict";

import { createExtensionController } from "../src/index.js";

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  values() {
    return this.element.className.split(/\s+/).filter(Boolean);
  }

  add(...names) {
    this.element.className = [...new Set([...this.values(), ...names])].join(" ");
  }

  remove(...names) {
    this.element.className = this.values().filter((name) => !names.includes(name)).join(" ");
  }

  contains(name) {
    return this.values().includes(name);
  }
}

class FakeElement {
  constructor(tagName, documentRef) {
    this.tagName = tagName.toLowerCase();
    this.ownerDocument = documentRef;
    this.id = "";
    this.className = "";
    this.classList = new FakeClassList(this);
    this.children = [];
    this.parent = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.style = {};
    this.disabled = false;
    this.value = "";
    this.name = "";
    this.textContent = "";
    this.tabIndex = 0;
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    for (const child of children) this.appendChild(child);
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    this.append(...children);
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  dispatchEvent(event) {
    event.target ||= this;
    event.currentTarget = this;
    for (const handler of this.listeners.get(event.type) || []) handler(event);
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent({ type: "click" });
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "name") this.name = String(value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  focus() {
    this.ownerDocument.activeElement = this;
  }

  contains(candidate) {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains(candidate));
  }

  matches(selector) {
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    const named = selector.match(/^([a-z]+)\[name=['\"]([^'\"]+)['\"]\]$/i);
    if (named) return this.tagName === named[1].toLowerCase() && this.name === named[2];
    return this.tagName === selector.toLowerCase();
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  querySelectorAll(selector) {
    const selectors = selector.split(",").map((part) => part.trim());
    const matches = [];
    for (const child of this.children) {
      const isMatch = selectors.some((part) => {
        if (part === "button:not([disabled])") return child.tagName === "button" && !child.disabled;
        if (part === "select:not([disabled])") return child.tagName === "select" && !child.disabled;
        return child.matches(part);
      });
      if (isMatch) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }
}

const findById = (element, id) => {
  if (element.id === id) return element;
  for (const child of element.children) {
    const match = findById(child, id);
    if (match) return match;
  }
  return null;
};

const installFakeDom = () => {
  const previous = {
    document: globalThis.document,
    MutationObserver: globalThis.MutationObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  };
  const documentListeners = new Map();
  const documentRef = {
    activeElement: null,
    createElement: (tag) => new FakeElement(tag, documentRef),
    createElementNS: (_namespace, tag) => new FakeElement(tag, documentRef),
    getElementById: (id) => findById(documentRef.body, id),
    querySelector: (selector) => documentRef.body.querySelector(selector),
    querySelectorAll: (selector) => documentRef.body.querySelectorAll(selector),
    addEventListener: (type, handler) => {
      const handlers = documentListeners.get(type) || [];
      handlers.push(handler);
      documentListeners.set(type, handlers);
    },
    removeEventListener: (type, handler) => {
      documentListeners.set(
        type,
        (documentListeners.get(type) || []).filter((candidate) => candidate !== handler)
      );
    },
    dispatchEvent: (event) => {
      for (const handler of documentListeners.get(event.type) || []) handler(event);
      return !event.defaultPrevented;
    },
  };
  documentRef.body = new FakeElement("body", documentRef);
  const topbar = new FakeElement("div", documentRef);
  topbar.className = "rm-topbar";
  documentRef.body.appendChild(topbar);

  globalThis.document = documentRef;
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);

  return {
    documentRef,
    topbar,
    restore() {
      globalThis.document = previous.document;
      globalThis.MutationObserver = previous.MutationObserver;
      globalThis.requestAnimationFrame = previous.requestAnimationFrame;
    },
  };
};

const createExtensionApi = () => {
  const values = new Map();
  return {
    settings: {
      get: (key) => values.get(key),
      set: (key, value) => values.set(key, value),
      panel: { create() {} },
    },
    ui: {
      commandPalette: {
        addCommand() {},
        removeCommand() {},
      },
    },
  };
};

const waitFor = async (predicate, message) => {
  const deadline = Date.now() + 1_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

test("returning to a recently loaded scope reuses its cache", async () => {
  const dom = installFakeDom();
  let queryCalls = 0;
  const api = {
    user: { uid: () => "user-123" },
    data: {
      async: {
        q: async () => {
          queryCalls += 1;
          return [[queryCalls, Date.UTC(2026, 7, 6, 12)]];
        },
      },
    },
  };
  const controller = createExtensionController({ extensionAPI: createExtensionApi(), api });

  try {
    controller.init();
    controller.open();
    await waitFor(() => queryCalls === 1 && !document.querySelector(".rcg-share").disabled, "all scope did not load");

    const scope = document.querySelector("select[name='scope']");
    scope.value = "own";
    scope.dispatchEvent({ type: "change" });
    await waitFor(() => queryCalls === 2 && !document.querySelector(".rcg-share").disabled, "own scope did not load");

    scope.value = "all";
    scope.dispatchEvent({ type: "change" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(queryCalls, 2);
  } finally {
    controller.destroy();
    dom.restore();
  }
});

test("live metric values do not duplicate day units", async () => {
  const dom = installFakeDom();
  const api = {
    user: { uid: () => "user-123" },
    data: { async: { q: async () => [[1, Date.now()]] } },
  };
  const controller = createExtensionController({ extensionAPI: createExtensionApi(), api });

  try {
    controller.init();
    controller.open();
    await waitFor(() => !document.querySelector(".rcg-share").disabled, "history did not load");
    const values = document
      .querySelectorAll(".rcg-stat__value")
      .map((element) => element.textContent);
    assert.equal(values.length, 4);
    assert.ok(values.every((value) => !value.endsWith("d")));
  } finally {
    controller.destroy();
    dom.restore();
  }
});

test("a failed refresh does not enable sharing stale cached data", async () => {
  const dom = installFakeDom();
  let queryCalls = 0;
  const api = {
    user: { uid: () => "user-123" },
    data: {
      async: {
        q: async () => {
          queryCalls += 1;
          if (queryCalls === 2) throw new Error("query timed out");
          return [[1, Date.UTC(2026, 7, 6, 12)]];
        },
      },
    },
  };
  const controller = createExtensionController({ extensionAPI: createExtensionApi(), api });

  try {
    controller.init();
    controller.open();
    const share = document.querySelector(".rcg-share");
    await waitFor(() => queryCalls === 1 && !share.disabled, "initial history did not load");

    document.querySelector(".rcg-refresh").click();
    const status = document.querySelector(".rcg-status");
    await waitFor(() => status.classList.contains("rcg-status--error"), "refresh error was not shown");
    assert.equal(share.disabled, true);
  } finally {
    controller.destroy();
    dom.restore();
  }
});

test("a failed forced refresh invalidates that scope cache", async () => {
  const dom = installFakeDom();
  let queryCalls = 0;
  const api = {
    user: { uid: () => "user-123" },
    data: {
      async: {
        q: async () => {
          queryCalls += 1;
          if (queryCalls === 2) throw new Error("query timed out");
          return [[queryCalls, Date.UTC(2026, 7, 6, 12)]];
        },
      },
    },
  };
  const controller = createExtensionController({ extensionAPI: createExtensionApi(), api });

  try {
    controller.init();
    controller.open();
    await waitFor(
      () => queryCalls === 1 && !document.querySelector(".rcg-share").disabled,
      "initial history did not load"
    );

    document.querySelector(".rcg-refresh").click();
    await waitFor(
      () => document.querySelector(".rcg-status").classList.contains("rcg-status--error"),
      "refresh error was not shown"
    );
    controller.close();
    controller.open();
    await waitFor(() => queryCalls === 3, "reopening did not perform a fresh query");
  } finally {
    controller.destroy();
    dom.restore();
  }
});

test("modal focus is trapped and restored to its opener", async () => {
  const dom = installFakeDom();
  const api = {
    user: { uid: () => "user-123" },
    data: { async: { q: async () => [[1, Date.UTC(2026, 7, 6, 12)]] } },
  };
  const controller = createExtensionController({ extensionAPI: createExtensionApi(), api });

  try {
    controller.init();
    const opener = document.getElementById("roam-contribution-graph-button");
    opener.focus();
    opener.click();
    const dialog = document.querySelector(".rcg-dialog");
    assert.equal(document.activeElement, dialog);
    await waitFor(() => !document.querySelector(".rcg-share").disabled, "history did not load");

    const scope = document.querySelector("select[name='scope']");
    const close = document.querySelector(".rcg-close");
    close.focus();
    const forwardTab = {
      type: "keydown",
      key: "Tab",
      shiftKey: false,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    document.dispatchEvent(forwardTab);
    assert.equal(forwardTab.defaultPrevented, true);
    assert.equal(document.activeElement, scope);

    scope.focus();
    const backwardTab = {
      type: "keydown",
      key: "Tab",
      shiftKey: true,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    document.dispatchEvent(backwardTab);
    assert.equal(backwardTab.defaultPrevented, true);
    assert.equal(document.activeElement, close);

    controller.close();
    assert.equal(document.activeElement, opener);
  } finally {
    controller.destroy();
    dom.restore();
  }
});

test("a cached scope clears an error left by another scope", async () => {
  const dom = installFakeDom();
  let queryCalls = 0;
  const api = {
    user: { uid: () => "user-123" },
    data: {
      async: {
        q: async () => {
          queryCalls += 1;
          if (queryCalls === 2) throw new Error("own scope unavailable");
          return [[1, Date.UTC(2026, 7, 6, 12)]];
        },
      },
    },
  };
  const controller = createExtensionController({ extensionAPI: createExtensionApi(), api });

  try {
    controller.init();
    controller.open();
    await waitFor(
      () => queryCalls === 1 && !document.querySelector(".rcg-share").disabled,
      "initial history did not load"
    );

    const scope = document.querySelector("select[name='scope']");
    const status = document.querySelector(".rcg-status");
    scope.value = "own";
    scope.dispatchEvent({ type: "change" });
    await waitFor(() => status.classList.contains("rcg-status--error"), "scope error was not shown");

    scope.value = "all";
    scope.dispatchEvent({ type: "change" });
    await waitFor(() => !document.querySelector(".rcg-share").disabled, "cached scope did not render");
    assert.equal(queryCalls, 2);
    assert.equal(status.classList.contains("rcg-status--error"), false);
  } finally {
    controller.destroy();
    dom.restore();
  }
});
