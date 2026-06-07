function filterCards(keyword) {
  if (!keyword) return;
  const cards = document.querySelectorAll("ytd-rich-item-renderer");
  console.log(`[CF] Found ${cards.length} cards`);
  cards.forEach(card => {
    const titleEl = card.querySelector("h3 a");
    if (!titleEl) return;
    const match = titleEl.textContent.trim().toLowerCase()
      .includes(keyword.toLowerCase());
    card.style.setProperty("display", match ? "" : "none", "important");
  });
}

function startObserver(keyword) {
  filterCards(keyword);
  setTimeout(() => filterCards(keyword), 1500);
  setTimeout(() => filterCards(keyword), 3000);
  new MutationObserver(() => filterCards(keyword))
    .observe(document.body, { childList: true, subtree: true });
}

chrome.storage.local.get(["keyword"], (result) => {
  const keyword = result.keyword || "music";
  console.log(`[CF] Loaded keyword: "${keyword}"`);
  startObserver(keyword);
});