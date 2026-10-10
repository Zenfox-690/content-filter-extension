const SITE_CONFIGS = [
  {
    name: "YouTube",
    match: (host) => host === "youtube.com" || host.endsWith(".youtube.com"),
    cardSelector: "ytd-rich-item-renderer",
    titleSelector: "h3 a"
  },

  {
    name: "Reddit",
    match: (host) => host === "reddit.com" || host.endsWith(".reddit.com"),
    cardSelector: "shreddit-post",
    titleSelector: "[slot='title']"
  }
];

let observer = null;
let processedCards = new WeakMap();
let originalStyles = new WeakMap();
const ownedStyleProperties = ["visibility", "min-height", "margin"];

function getSiteConfig() {
  const host = window.location.hostname;

  return SITE_CONFIGS.find(site => site.match(host));
}

function rememberOriginalStyles(card) {
  if (originalStyles.has(card)) return;

  const styles = {};
  ownedStyleProperties.forEach(property => {
    styles[property] = {
      value: card.style.getPropertyValue(property),
      priority: card.style.getPropertyPriority(property)
    };
  });

  originalStyles.set(card, styles);
}

function applyHiddenStyles(card) {
  rememberOriginalStyles(card);
  card.style.setProperty("visibility", "hidden", "important");
  card.style.setProperty("min-height", "1px", "important");
  card.style.setProperty("margin", "0", "important");
}

function resetStyles(card) {
  const styles = originalStyles.get(card);
  if (!styles) return;

  ownedStyleProperties.forEach(property => {
    const original = styles[property];
    if (original.value) {
      card.style.setProperty(property, original.value, original.priority);
    } else {
      card.style.removeProperty(property);
    }
  });

  originalStyles.delete(card);
}

function getKeywords(keyword) {
  return keyword
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeSettings(settings) {
  if (!settings || typeof settings !== "object") settings = {};

  return {
    keyword: typeof settings.keyword === "string" ? settings.keyword.trim() : "",
    filterMode: settings.filterMode === "blacklist" ? "blacklist" : "whitelist",
    enabled: typeof settings.enabled === "boolean" ? settings.enabled : true
  };
}

function filterCard(config, card, settings, keywords) {
  const titleEl = card.querySelector(config.titleSelector);
  if (!titleEl) {
    resetStyles(card);
    processedCards.delete(card);
    return;
  }

  const title = titleEl.textContent.trim().toLowerCase();
  const previous = processedCards.get(card);
  if (
    previous &&
    previous.title === title &&
    previous.keyword === settings.keyword &&
    previous.filterMode === settings.filterMode
  ) return;

  const match = keywords.some(keyword => title.includes(keyword));
  const shouldShow = settings.filterMode === "whitelist" ? match : !match;

  if (shouldShow) {
    resetStyles(card);
  } else {
    applyHiddenStyles(card);
  }

  processedCards.set(card, {
    title,
    keyword: settings.keyword,
    filterMode: settings.filterMode
  });
}

function filterCards(config, cards, settings, keywords) {
  cards.forEach(card => filterCard(config, card, settings, keywords));
}

function runFilter(config, settings) {
  const cards = document.querySelectorAll(config.cardSelector);
  filterCards(config, cards, settings, getKeywords(settings.keyword));
}

function addAncestorCard(node, selector, cards) {
  const element = node.nodeType === 1 ? node : node.parentElement;
  if (!element || typeof element.closest !== "function") return;

  const card = element.closest(selector);
  if (card) cards.add(card);
}

function addCardsInSubtree(node, selector, cards) {
  addAncestorCard(node, selector, cards);

  const element = node.nodeType === 1 ? node : null;
  if (!element || typeof element.querySelectorAll !== "function") return;

  if (element.matches(selector)) cards.add(element);
  element.querySelectorAll(selector).forEach(card => cards.add(card));
}

function handleMutations(config, mutations) {
  const keywords = getKeywords(currentSettings.keyword);
  if (!currentSettings.enabled || keywords.length === 0) return;

  const affectedCards = new Set();
  mutations.forEach(mutation => {
    addAncestorCard(mutation.target, config.cardSelector, affectedCards);
    mutation.addedNodes.forEach(node => {
      addCardsInSubtree(node, config.cardSelector, affectedCards);
    });
    mutation.removedNodes.forEach(node => {
      addCardsInSubtree(node, config.cardSelector, affectedCards);
    });
  });

  affectedCards.forEach(card => {
    if (document.documentElement.contains(card)) {
      filterCard(config, card, currentSettings, keywords);
    } else {
      resetStyles(card);
      processedCards.delete(card);
    }
  });
}

function startObserver(config) {
  if (!document.body) return;

  if (!observer) {
    observer = new MutationObserver(mutations => handleMutations(config, mutations));
  }

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  runFilter(config, currentSettings);
}

function stopObserver() {
  if (observer) observer.disconnect();
}

function resetAllCards(config) {
  const cards = document.querySelectorAll(config.cardSelector);
  cards.forEach(card => {
    resetStyles(card);
    processedCards.delete(card);
  });
}

const config = getSiteConfig();

let currentSettings = {
  keyword: "",
  filterMode: "whitelist",
  enabled: true
};

function applyCurrentFilter() {
  if (!config) return;

  if (!currentSettings.enabled || getKeywords(currentSettings.keyword).length === 0) {
    stopObserver();
    resetAllCards(config);
    return;
  }

  processedCards = new WeakMap();
  startObserver(config);
}

if (config) {

  let settingsLoaded = false;
  const pendingSettingsChanges = {};

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;

    const relevantKeys = ["keyword", "filterMode", "enabled"];
    if (!relevantKeys.some(key => Object.hasOwn(changes, key))) return;

    relevantKeys.forEach(key => {
      if (Object.hasOwn(changes, key)) {
        pendingSettingsChanges[key] = changes[key].newValue;
      }
    });

    if (settingsLoaded) {
      currentSettings = normalizeSettings({ ...currentSettings, ...pendingSettingsChanges });
      applyCurrentFilter();
    }
  });

  chrome.storage.local.get(
    ["keyword", "filterMode", "enabled"],
    (settings) => {
      currentSettings = normalizeSettings({ ...settings, ...pendingSettingsChanges });
      settingsLoaded = true;
      applyCurrentFilter();
    }
  );
}