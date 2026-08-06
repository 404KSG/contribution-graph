import test from "node:test";
import assert from "node:assert/strict";

import { createExtensionController } from "../src/index.js";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.id = "";
    this.className = "";
    this.children = [];
    this.parent = null;
    this.listeners = new Map();
  }

  appendChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
    this.parent = null;
  }

  setAttribute() {}
}

const findById = (element, id) => {
  if (element.id === id) return element;
  for (const child of element.children) {
    const match = findById(child, id);
    if (match) return match;
  }
  return null;
};

test("controller is lazy and cleans up its Roam surfaces", () => {
  const previousDocument = globalThis.document;
  const previousMutationObserver = globalThis.MutationObserver;
  const body = new FakeElement("body");
  const topbar = new FakeElement("div");
  topbar.className = "rm-topbar";
  body.appendChild(topbar);
  const documentListeners = new Map();
  let disconnected = false;

  globalThis.document = {
    body,
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => findById(body, id),
    querySelector: (selector) => (selector === ".rm-topbar" ? topbar : null),
    addEventListener: (type, handler) => documentListeners.set(type, handler),
    removeEventListener: (type, handler) => {
      if (documentListeners.get(type) === handler) documentListeners.delete(type);
    },
  };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {
      disconnected = true;
    }
  };

  const values = new Map();
  const commands = [];
  const removedCommands = [];
  let queryCalls = 0;
  const extensionAPI = {
    settings: {
      get: (key) => values.get(key),
      set: (key, value) => values.set(key, value),
      panel: { create() {} },
    },
    ui: {
      commandPalette: {
        addCommand: (command) => commands.push(command),
        removeCommand: (command) => removedCommands.push(command),
      },
    },
  };
  const api = {
    user: { uid: () => "user-123" },
    data: { fast: { q: () => (queryCalls += 1, []) } },
  };

  try {
    const controller = createExtensionController({ extensionAPI, api });
    controller.init();

    assert.equal(queryCalls, 0, "initialization must not scan the graph");
    assert.equal(values.get("showTopbarButton"), true);
    assert.equal(commands.length, 1);
    assert.ok(findById(body, "roam-contribution-graph-button"));
    assert.equal(documentListeners.has("keydown"), true);

    controller.destroy();
    assert.equal(findById(body, "roam-contribution-graph-button"), null);
    assert.equal(documentListeners.size, 0);
    assert.equal(disconnected, true);
    assert.equal(removedCommands.length, 1);
    assert.equal(queryCalls, 0);
  } finally {
    globalThis.document = previousDocument;
    globalThis.MutationObserver = previousMutationObserver;
  }
});
