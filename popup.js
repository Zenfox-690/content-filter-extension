const keywordInput = document.getElementById("keyword");
const modeInput = document.getElementById("mode");
const enabledInput = document.getElementById("enabled");
const supportStatus = document.getElementById("support-status");
const status = document.getElementById("status");

function isSupportedUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return ["youtube.com", "reddit.com"].some(domain =>
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (chrome.runtime.lastError || !tabs?.length) {
    supportStatus.textContent = "Unable to check the current website.";
    return;
  }

  supportStatus.textContent = isSupportedUrl(tabs[0].url)
    ? "Filtering is supported on this website."
    : "Filtering is available on YouTube and Reddit.";
});

chrome.storage.local.get(["keyword", "filterMode", "enabled"], result => {
  if (chrome.runtime.lastError) {
    status.textContent = "Could not load saved settings.";
    return;
  }

  keywordInput.value = typeof result.keyword === "string" ? result.keyword : "";
  modeInput.value = result.filterMode === "blacklist" ? "blacklist" : "whitelist";
  enabledInput.value = String(typeof result.enabled === "boolean" ? result.enabled : true);
});

document.getElementById("save").addEventListener("click", () => {
  if (!["whitelist", "blacklist"].includes(modeInput.value)) {
    status.textContent = "Choose a valid filtering mode.";
    return;
  }

  if (!["true", "false"].includes(enabledInput.value)) {
    status.textContent = "Choose whether filtering is enabled.";
    return;
  }

  chrome.storage.local.set({
    keyword: keywordInput.value.trim(),
    filterMode: modeInput.value,
    enabled: enabledInput.value === "true"
  }, () => {
    status.textContent = chrome.runtime.lastError
      ? "Could not save settings."
      : "Settings saved.";
  });
});