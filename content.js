function filterCards(keyword, filterMode) {
  if (!keyword) return;
  const cards = document.querySelectorAll("ytd-rich-item-renderer");
  cards.forEach(card => {
    const titleEl = card.querySelector("h3 a");
    if (!titleEl) return;
    const match = titleEl.textContent.trim().toLowerCase()
      .includes(keyword.toLowerCase());
    const shouldShow = filterMode === "whitelist" ? match : !match;

    if (shouldShow) {
      card.style.removeProperty("visibility");
      card.style.removeProperty("min-height");
      card.style.removeProperty("margin");
    } else {
      card.style.setProperty("visibility", "hidden", "important");
      card.style.setProperty("min-height", "1px", "important");
      card.style.setProperty("margin", "0", "important");
    }
  });
}

function startObserver(keyword, filterMode) {
  filterCards(keyword, filterMode);
  setTimeout(() => filterCards(keyword, filterMode), 1500);
  new MutationObserver(() => filterCards(keyword, filterMode))
    .observe(document.body, { childList: true, subtree: true });
}

chrome.storage.local.get(
  ["keyword", "filterMode"],
  (result) => {
    const keyword = result.keyword || "music";
    const filterMode = result.filterMode || "whitelist";
    startObserver(keyword, filterMode);
  }
);