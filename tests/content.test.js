const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const contentScript = fs.readFileSync(
  path.join(__dirname, "..", "content.js"),
  "utf8"
);

class FakeStyle {
  constructor() {
    this.properties = new Map();
    this.writes = 0;
  }

  getPropertyValue(property) {
    return this.properties.get(property)?.value || "";
  }

  getPropertyPriority(property) {
    return this.properties.get(property)?.priority || "";
  }

  setProperty(property, value, priority = "") {
    this.writes += 1;
    this.properties.set(property, { value, priority });
  }

  removeProperty(property) {
    this.writes += 1;
    this.properties.delete(property);
  }
}

class FakeText {
  constructor(text, parentElement) {
    this.nodeType = 3;
    this.textContent = text;
    this.parentElement = parentElement;
  }
}

class FakeElement {
  constructor(selector = null) {
    this.nodeType = 1;
    this.selector = selector;
    this.parentElement = null;
    this.children = [];
    this.style = new FakeStyle();
  }

  append(...nodes) {
    nodes.forEach(node => {
      node.parentElement = this;
      this.children.push(node);
    });
  }

  remove(node) {
    this.children = this.children.filter(child => child !== node);
    node.parentElement = null;
  }

  matches(selector) {
    return this.selector === selector;
  }

  closest(selector) {
    for (let element = this; element; element = element.parentElement) {
      if (element.matches?.(selector)) return element;
    }
    return null;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches?.(selector)) return child;
      const match = child.querySelector?.(selector);
      if (match) return match;
    }
    return null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = element => {
      element.children.forEach(child => {
        if (child.matches?.(selector)) matches.push(child);
        visit(child);
      });
    };
    visit(this);
    return matches;
  }

  contains(node) {
    return this === node || this.children.some(child => child.contains?.(node));
  }
}

class FakeCard extends FakeElement {
  constructor(selector, titleSelector, title = null) {
    super(selector);
    this.titleSelector = titleSelector;
    this.titleNode = title === null ? null : new FakeText(title, this);
  }

  querySelector(selector) {
    if (selector === this.titleSelector) return this.titleNode;
    return super.querySelector(selector);
  }

  setTitle(title) {
    this.titleNode = new FakeText(title, this);
  }
}

function createHarness({
  hostname = "www.youtube.com",
  settings = {},
  cards = [],
  storageError = false,
  deferStorageRead = false
} = {}) {
  const isReddit = hostname === "reddit.com" || hostname.endsWith(".reddit.com");
  const cardSelector = isReddit ? "shreddit-post" : "ytd-rich-item-renderer";
  const titleSelector = isReddit ? "[slot='title']" : "h3 a";
  const body = new FakeElement();
  body.append(...cards);
  const documentElement = new FakeElement();
  documentElement.append(body);
  let documentQueries = 0;

  const document = {
    body,
    documentElement,
    querySelectorAll(selector) {
      documentQueries += 1;
      return body.querySelectorAll(selector);
    }
  };
  const observers = [];
  const storageListeners = [];
  const storedSettings = { ...settings };
  let storageReads = 0;
  let completeStorageRead = null;

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.active = false;
      this.options = null;
      observers.push(this);
    }

    observe(_target, options) {
      this.active = true;
      this.options = options;
    }

    disconnect() {
      this.active = false;
    }

    emit(records) {
      if (this.active) this.callback(records);
    }
  }

  const chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(_keys, callback) {
          storageReads += 1;
          completeStorageRead = () => {
            chrome.runtime.lastError = storageError ? { message: "storage unavailable" } : null;
            callback({ ...storedSettings });
            chrome.runtime.lastError = null;
          };
          if (!deferStorageRead) completeStorageRead();
        }
      },
      onChanged: {
        addListener(listener) {
          storageListeners.push(listener);
        }
      }
    }
  };

  vm.runInNewContext(contentScript, {
    window: { location: { hostname } },
    document,
    chrome,
    MutationObserver: FakeMutationObserver
  });

  return {
    body,
    cardSelector,
    titleSelector,
    observers,
    document,
    get documentQueries() { return documentQueries; },
    get storageReads() { return storageReads; },
    completeStorageRead() { completeStorageRead?.(); },
    updateSettings(changes, areaName = "local") {
      const updates = {};
      Object.entries(changes).forEach(([key, value]) => {
        updates[key] = { oldValue: storedSettings[key], newValue: value };
        if (value === undefined) delete storedSettings[key];
        else storedSettings[key] = value;
      });
      storageListeners.forEach(listener => listener(updates, areaName));
    },
    mutate(target, { addedNodes = [], removedNodes = [] } = {}) {
      observers[0]?.emit([{ target, addedNodes, removedNodes }]);
    }
  };
}

function makeCard(selector, titleSelector, title, styles = {}) {
  const card = new FakeCard(selector, titleSelector, title);
  Object.entries(styles).forEach(([property, declaration]) => {
    card.style.setProperty(property, declaration.value, declaration.priority);
  });
  card.style.writes = 0;
  return card;
}

function isHidden(card) {
  return card.style.getPropertyValue("visibility") === "hidden";
}

test("whitelist and blacklist apply case-insensitive substring matching", () => {
  const whitelistMatch = makeCard("ytd-rich-item-renderer", "h3 a", "A BLUEbird song");
  const whitelistMiss = makeCard("ytd-rich-item-renderer", "h3 a", "A red song");
  createHarness({ settings: { keyword: "blue", filterMode: "whitelist" }, cards: [whitelistMatch, whitelistMiss] });
  assert.equal(isHidden(whitelistMatch), false);
  assert.equal(isHidden(whitelistMiss), true);

  const blacklistMatch = makeCard("ytd-rich-item-renderer", "h3 a", "A BLUEbird song");
  const blacklistMiss = makeCard("ytd-rich-item-renderer", "h3 a", "A red song");
  createHarness({ settings: { keyword: "blue", filterMode: "blacklist" }, cards: [blacklistMatch, blacklistMiss] });
  assert.equal(isHidden(blacklistMatch), true);
  assert.equal(isHidden(blacklistMiss), false);
});

test("multiple comma-separated keywords are trimmed and matched", () => {
  const first = makeCard("ytd-rich-item-renderer", "h3 a", "Gaming news");
  const second = makeCard("ytd-rich-item-renderer", "h3 a", "Music video");
  const miss = makeCard("ytd-rich-item-renderer", "h3 a", "Cooking show");
  createHarness({ settings: { keyword: " gaming, music " }, cards: [first, second, miss] });
  assert.deepEqual([isHidden(first), isHidden(second), isHidden(miss)], [false, false, true]);
});

test("empty and whitespace-only keywords restore content and stop observing", () => {
  const card = makeCard("ytd-rich-item-renderer", "h3 a", "Unrelated");
  const harness = createHarness({ settings: { keyword: "blocked" }, cards: [card] });
  assert.equal(isHidden(card), true);

  harness.updateSettings({ keyword: "   , " });
  assert.equal(isHidden(card), false);
  assert.equal(harness.observers[0].active, false);
});

test("disabling restores each owned style value and priority exactly", () => {
  const custom = makeCard("ytd-rich-item-renderer", "h3 a", "No match", {
    visibility: { value: "collapse", priority: "" },
    "min-height": { value: "7px", priority: "important" },
    margin: { value: "-4px", priority: "" }
  });
  const absent = makeCard("ytd-rich-item-renderer", "h3 a", "No match");
  const harness = createHarness({ settings: { keyword: "allowed" }, cards: [custom, absent] });
  assert.equal(isHidden(custom), true);
  assert.equal(isHidden(absent), true);

  harness.updateSettings({ enabled: false });
  assert.deepEqual(
    ["visibility", "min-height", "margin"].map(property => [
      custom.style.getPropertyValue(property),
      custom.style.getPropertyPriority(property)
    ]),
    [["collapse", ""], ["7px", "important"], ["-4px", ""]]
  );
  assert.deepEqual(["visibility", "min-height", "margin"].map(property =>
    absent.style.getPropertyValue(property)
  ), ["", "", ""]);
});

test("enable-disable-enable and keyword/mode changes reprocess existing cards", () => {
  const alpha = makeCard("ytd-rich-item-renderer", "h3 a", "Alpha topic");
  const beta = makeCard("ytd-rich-item-renderer", "h3 a", "Beta topic");
  const harness = createHarness({ settings: { keyword: "alpha" }, cards: [alpha, beta] });
  assert.deepEqual([isHidden(alpha), isHidden(beta)], [false, true]);

  harness.updateSettings({ keyword: "beta" });
  assert.deepEqual([isHidden(alpha), isHidden(beta)], [true, false]);
  harness.updateSettings({ filterMode: "blacklist" });
  assert.deepEqual([isHidden(alpha), isHidden(beta)], [false, true]);

  for (let cycle = 0; cycle < 3; cycle += 1) {
    harness.updateSettings({ enabled: false });
    assert.deepEqual([isHidden(alpha), isHidden(beta)], [false, false]);
    assert.equal(harness.observers[0].active, false);
    harness.updateSettings({ enabled: true });
    assert.deepEqual([isHidden(alpha), isHidden(beta)], [false, true]);
    assert.equal(harness.observers[0].active, true);
  }
  assert.equal(harness.observers.length, 1);
});

test("new cards and changed titles are filtered; missing titles are restored", () => {
  const card = makeCard("ytd-rich-item-renderer", "h3 a", "Allowed topic");
  const harness = createHarness({ settings: { keyword: "allowed" }, cards: [card] });
  card.setTitle("Blocked topic");
  harness.mutate(card.titleNode);
  assert.equal(isHidden(card), true);

  card.titleNode = null;
  harness.mutate(card);
  assert.equal(isHidden(card), false);

  card.setTitle("Allowed again");
  harness.mutate(card.titleNode);
  assert.equal(isHidden(card), false);

  const inserted = makeCard("ytd-rich-item-renderer", "h3 a", "Blocked new card");
  harness.body.append(inserted);
  harness.mutate(harness.body, { addedNodes: [inserted] });
  assert.equal(isHidden(inserted), true);
});

test("removed cards are restored before they leave the observed feed", () => {
  const card = makeCard("ytd-rich-item-renderer", "h3 a", "Blocked topic");
  const harness = createHarness({ settings: { keyword: "allowed" }, cards: [card] });
  harness.body.remove(card);
  harness.mutate(harness.body, { removedNodes: [card] });
  assert.equal(isHidden(card), false);
});

test("mutation work is targeted and one observer excludes extension style writes", () => {
  const first = makeCard("ytd-rich-item-renderer", "h3 a", "Allowed");
  const second = makeCard("ytd-rich-item-renderer", "h3 a", "Blocked");
  const harness = createHarness({ settings: { keyword: "allowed" }, cards: [first, second] });
  const initialQueries = harness.documentQueries;
  const initialWrites = first.style.writes;

  first.setTitle("Still allowed");
  harness.mutate(first.titleNode);
  assert.equal(harness.documentQueries, initialQueries);
  assert.equal(first.style.writes, initialWrites);
  assert.equal(harness.observers.length, 1);
  assert.equal(harness.observers[0].options.attributes, undefined);
  assert.equal(harness.observers[0].options.childList, true);
});

test("YouTube hidden cards retain the infinite-scroll spacing workaround", () => {
  const card = makeCard("ytd-rich-item-renderer", "h3 a", "Blocked");
  createHarness({ settings: { keyword: "allowed" }, cards: [card] });
  assert.equal(card.style.getPropertyValue("min-height"), "1px");
  assert.equal(card.style.getPropertyValue("margin"), "0");
});

test("Reddit cards are filtered", () => {
  const match = makeCard("shreddit-post", "[slot='title']", "Gaming post");
  const miss = makeCard("shreddit-post", "[slot='title']", "Cooking post");
  createHarness({ hostname: "www.reddit.com", settings: { keyword: "gaming" }, cards: [match, miss] });
  assert.deepEqual([isHidden(match), isHidden(miss)], [false, true]);
});

test("unsupported and lookalike domains do not read settings or start observers", () => {
  for (const hostname of ["example.com", "youtube.com.attacker.test", "notreddit.com"]) {
    const harness = createHarness({ hostname });
    assert.equal(harness.storageReads, 0);
    assert.equal(harness.observers.length, 0);
  }
});

test("malformed settings fail safely and unrelated storage areas are ignored", () => {
  const card = makeCard("ytd-rich-item-renderer", "h3 a", "Any title");
  const harness = createHarness({
    settings: { keyword: 42, filterMode: "regex", enabled: "false" },
    cards: [card]
  });
  assert.equal(isHidden(card), false);
  assert.equal(harness.observers.length, 0);

  harness.updateSettings({ keyword: "Any" }, "sync");
  assert.equal(harness.observers.length, 0);
});

test("storage read errors fall back without throwing", () => {
  const harness = createHarness({ storageError: true });
  assert.equal(harness.observers.length, 0);
});

test("settings changed before the initial storage read are not overwritten", () => {
  const card = makeCard("ytd-rich-item-renderer", "h3 a", "Alpha topic");
  const harness = createHarness({
    settings: { keyword: "alpha" },
    cards: [card],
    deferStorageRead: true
  });

  harness.updateSettings({ keyword: "beta" });
  harness.completeStorageRead();
  assert.equal(isHidden(card), true);
});