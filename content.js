const SITE_CONFIGS = [
  {
    name: "YouTube",
    match: (host) => host.includes("youtube.com"),
    cardSelector: "ytd-rich-item-renderer",
    titleSelector: "h3 a"
  },

  {
    name: "Reddit",
    match: (host) => host.includes("reddit.com"),
    cardSelector: "shreddit-post",
    titleSelector: "[slot='title']"
  }
];

let observer = null;

function getSiteConfig() {
  const host = window.location.hostname;

  return SITE_CONFIGS.find(site => site.match(host));
}

function applyHiddenStyles(card) {
  card.style.setProperty("visibility", "hidden", "important");
  card.style.setProperty("min-height", "1px", "important");
  card.style.setProperty("margin", "0", "important");
}

function resetStyles(card) {
  card.style.removeProperty("visibility");
  card.style.removeProperty("min-height");
  card.style.removeProperty("margin");
}

function filterCards(config, keyword, filterMode) {

  const cards = document.querySelectorAll(config.cardSelector);

  const keywords = keyword
    .split(",")
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);

  cards.forEach(card => {

    const titleEl = card.querySelector(config.titleSelector);

    if (!titleEl) return;

    const title = titleEl.textContent
      .trim()
      .toLowerCase();

    const match = keywords.some(keyword =>
      title.includes(keyword)
    );

    const shouldShow =
      filterMode === "whitelist"
        ? match
        : !match;

    if (shouldShow) {
      resetStyles(card);
    } else {
      applyHiddenStyles(card);
    }

  });

}

function runFilter(config, settings) {
  filterCards(
    config,
    settings.keyword || "",
    settings.filterMode || "whitelist"
  );
}

function startObserver(config, settings) {
  if (observer) {
    observer.disconnect();
  }

  runFilter(config, settings);

  observer = new MutationObserver(() => {
    runFilter(config, settings);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

const config = getSiteConfig();

if (config) {

  chrome.storage.local.get(
    ["keyword", "filterMode"],
    (settings) => {
      startObserver(config, settings);
    }
  );

  chrome.storage.onChanged.addListener(() => {

    chrome.storage.local.get(
      ["keyword", "filterMode"],
      (settings) => {
        startObserver(config, settings);
      }
    );

  });

}