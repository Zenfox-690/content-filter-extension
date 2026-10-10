const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const popupScript = fs.readFileSync(
  path.join(__dirname, "..", "popup.js"),
  "utf8"
);

function createPopup({ url = "https://www.youtube.com/", settings = {}, getError = false, setError = false } = {}) {
  const ids = ["keyword", "mode", "enabled", "support-status", "status", "save"];
  const elements = Object.fromEntries(ids.map(id => [id, {
    value: "",
    textContent: "",
    addEventListener(event, callback) {
      if (event === "click") this.click = callback;
    }
  }]));
  const saved = [];
  const chrome = {
    runtime: { lastError: null },
    tabs: {
      query(_options, callback) {
        callback([{ url }]);
      }
    },
    storage: {
      local: {
        get(_keys, callback) {
          chrome.runtime.lastError = getError ? { message: "read failed" } : null;
          callback({ ...settings });
          chrome.runtime.lastError = null;
        },
        set(value, callback) {
          saved.push(value);
          chrome.runtime.lastError = setError ? { message: "write failed" } : null;
          callback();
          chrome.runtime.lastError = null;
        }
      }
    }
  };

  vm.runInNewContext(popupScript, {
    document: { getElementById: id => elements[id] },
    chrome,
    URL
  });

  return { elements, saved };
}

test("popup loads saved settings and indicates a supported site", () => {
  const { elements } = createPopup({
    settings: { keyword: " video ", filterMode: "blacklist", enabled: false }
  });
  assert.equal(elements.keyword.value, " video ");
  assert.equal(elements.mode.value, "blacklist");
  assert.equal(elements.enabled.value, "false");
  assert.equal(elements["support-status"].textContent, "Filtering is supported on this website.");
});

test("popup reports unsupported pages instead of implying filtering is active", () => {
  const { elements } = createPopup({ url: "https://youtube.com.attacker.test/" });
  assert.equal(elements["support-status"].textContent, "Filtering is available on YouTube and Reddit.");
});

test("popup validates and persists trimmed settings", () => {
  const { elements, saved } = createPopup();
  elements.keyword.value = "  cats, dogs  ";
  elements.mode.value = "blacklist";
  elements.enabled.value = "false";
  elements.save.click();

  assert.equal(JSON.stringify(saved), JSON.stringify([
    { keyword: "cats, dogs", filterMode: "blacklist", enabled: false }
  ]));
  assert.equal(elements.status.textContent, "Settings saved.");
});

test("popup rejects invalid controls and reports storage failures", () => {
  const invalid = createPopup();
  invalid.elements.mode.value = "invalid";
  invalid.elements.save.click();
  assert.equal(invalid.saved.length, 0);
  assert.equal(invalid.elements.status.textContent, "Choose a valid filtering mode.");

  const failedRead = createPopup({ getError: true });
  assert.equal(failedRead.elements.status.textContent, "Could not load saved settings.");

  const failedWrite = createPopup({ setError: true });
  failedWrite.elements.save.click();
  assert.equal(failedWrite.elements.status.textContent, "Could not save settings.");
});