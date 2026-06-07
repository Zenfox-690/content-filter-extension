function filterCards(keyword) {
  if (!keyword) return;
  const cards = document.querySelectorAll("ytd-rich-item-renderer");
  cards.forEach(card => {
    const titleEl = card.querySelector("h3 a");
    if (!titleEl) return;
    const match = titleEl.textContent.trim().toLowerCase()
      .includes(keyword.toLowerCase());
    if (match) {
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

function startObserver(keyword) {
  filterCards(keyword);
  setTimeout(() => filterCards(keyword), 1500);
  new MutationObserver(() => filterCards(keyword))
    .observe(document.body, { childList: true, subtree: true });
}

chrome.storage.local.get(["keyword"], (result) => {
  const keyword = result.keyword || "music";
  startObserver(keyword);
});