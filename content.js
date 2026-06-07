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
  if (!keyword) return;

  const cards = document.querySelectorAll(config.cardSelector);

  cards.forEach(card => {
    const titleEl = card.querySelector(config.titleSelector);

    if (!titleEl) return;

    const title = titleEl.textContent
      .trim()
      .toLowerCase();

    const match = title.includes(keyword.toLowerCase());

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

function startObserver(config, keyword, filterMode) {
  filterCards(config, keyword, filterMode);

  setTimeout(() => {
    filterCards(config, keyword, filterMode);
  }, 1500);

  new MutationObserver(() => {
    filterCards(config, keyword, filterMode);
  }).observe(document.body, {
    childList: true,
    subtree: true
  });
}

const config = getSiteConfig();

if (config) {
  chrome.storage.local.get(
    ["keyword", "filterMode"],
    (result) => {
      startObserver(
        config,
        result.keyword || "",
        result.filterMode || "whitelist"
      );
    }
  );
}