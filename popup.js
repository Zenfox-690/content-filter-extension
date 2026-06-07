const keywordInput = document.getElementById("keyword");
const modeInput = document.getElementById("mode");
const status = document.getElementById("status");

chrome.storage.local.get(["keyword", "filterMode"], (result) => {
  keywordInput.value = result.keyword || "";
  modeInput.value = result.filterMode || "whitelist";
});

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.local.set({
    keyword: keywordInput.value.trim(),
    filterMode: modeInput.value
  }, () => {
    status.textContent = "Saved";
  });
});