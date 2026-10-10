# Content Filter

A lightweight Manifest V3 Chrome extension that filters already-rendered feed cards by comma-separated keywords. It does not change site recommendations, block requests, or send browsing data anywhere.

## Install

1. Open `chrome://extensions` in Chrome and enable **Developer mode**.
2. Choose **Load unpacked** and select this project folder.
3. Open YouTube or Reddit, then use the extension popup to set keywords, a filtering mode, and whether filtering is enabled. Changes apply to open supported pages without a refresh.

## Behavior

- Supported sites: YouTube and Reddit, including their subdomains.
- Matching is case-insensitive substring matching. Separate multiple keywords with commas.
- Whitelist mode shows cards containing any keyword. Blacklist mode hides cards containing any keyword.
- Empty keywords restore cards and suspend filtering until a keyword is saved.
- Filtering applies only to cards already rendered by the site and to cards or titles added or changed later. It does not prevent network requests.
- YouTube hidden cards retain a minimal height to preserve feed scrolling behavior.

## Permissions and privacy

The extension uses `storage` to save settings and `activeTab` so the popup can report whether the selected tab is supported. Host access and content-script matches are limited to YouTube and Reddit because filtering requires reading and styling their rendered feed cards. Settings remain in `chrome.storage.local`; the extension uses no remote scripts, analytics, or external services.

## Tests and manual checks

Run the dependency-free regression suite with Node.js 18 or newer:

```powershell
node --test tests/*.test.js
```

After loading or updating the unpacked extension, reload the YouTube or Reddit tab. In a live browser, verify feed layout and scrolling, popup support status, keyword and mode changes, repeated enable/disable, and dynamic feed loading. Automated tests use a mocked DOM and Chrome storage API; they do not replace live-site compatibility checks.

## Limitations

Site DOM selectors can change as YouTube or Reddit updates its interface. The extension filters supported card types only, and it cannot run on Chrome-internal pages or other unsupported websites.
