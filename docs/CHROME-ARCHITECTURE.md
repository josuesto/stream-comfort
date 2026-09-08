# Chrome extension architecture verification

Checked against the current official Chrome documentation on 2026-09-07. These are implementation recommendations, not evidence of streaming player support. Firecrawl was authenticated but its fetch failed through the local network proxy; the official sources below were opened with the web tool.

## Minimal permissions and packaging

Use Manifest V3, a packaged service worker, one packaged content-script bundle, and a packaged popup. For known supported service origins, declare static `content_scripts.matches` with `run_at: "document_idle"` and the default isolated world. Static content scripts do not need the `scripting` or `activeTab` permissions. The inspected integrations run on exactly `https://www.crunchyroll.com/*` and `https://play.hbomax.com/*`; neither requires iframe access. Disabling a platform is a local automation preference, not a revocation of Chrome's declared site access. If a future player is in another frame, `all_frames` only covers frames whose own URLs match the declared patterns; it does not grant general cross-origin DOM access. [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)

Start with `permissions: ["storage"]`. The popup can obtain the active tab ID with `chrome.tabs.query({active: true, currentWindow: true})` and call `chrome.tabs.sendMessage(tabId, ...)` without requesting `tabs`. That permission gates sensitive tab properties such as URL/title; do not depend on them for unsupported-page detection. A missing content-script response should yield a clear unavailable/unsupported state, with a reload hint for a service tab open before installation. If using multiple frames, explicitly target the responsible frame/document instead of accepting a race between responders. [Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs)

Bundle all executable code locally. Avoid inline JavaScript, eval, remote script imports, CDN dependencies, and unnecessary web-accessible resources. The default extension-page CSP is adequate; an explicit stricter policy may also block network connections. CSS and images should be local so the popup makes no external requests. [Manifest CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)

## Durable local settings and temporary tab state

Use `storage.local` for a versioned, schema-validated settings object. It survives browser restarts and cache/history clearing; it is removed on uninstall. Never use sync storage because the product promises local preferences. Listen to `storage.onChanged` to apply edits immediately in running content scripts.

Store temporary pause in `storage.session` under one key per tab, owned by the service worker. This survives worker termination and ordinary tab reloads, while being cleared when the extension reloads/disables/updates or Chrome restarts. Remove a tab's key on `tabs.onRemoved`. Keep the default trusted-context access for session storage; answer content-script state queries through the worker using `sender.tab.id`, never a page-provided tab ID. Persist preferences only. Never collect viewing history or store page content. Episode IDs used to prevent duplicate actions stay in memory. `storage.session` and access-level controls require Chrome 102+. [Storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)

Initialize content-script automation disabled until both saved preferences and the current tab pause state have loaded. Storage failure should disable automation and surface an error rather than silently restoring enabled defaults. Use one key per tab to avoid overwriting another tab's pause during concurrent writes. These are design choices based on the asynchronous APIs.

## Messaging and worker lifetime

Use JSON-serializable typed messages and validate their shape at runtime. For asynchronous message responses, prefer a non-async `onMessage` listener that calls `sendResponse` after completing work and returns literal `true`. Current Chrome documentation says Promise-returning listeners start in Chrome 148 with gradual rollout; an async listener can also consume messages unintentionally by returning an implicit result. Handle rejected `sendMessage` calls as expected when a tab navigates or has no receiver. [Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

Register service-worker event listeners synchronously at module top level before asynchronous initialization. Load required state inside each handler. Keep no correctness-critical settings or pause state solely in worker globals. [Service-worker migration](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)

Chrome normally terminates inactive extension workers after 30 seconds. Do not use artificial heartbeats or a permanent connection to hold the worker open. The content script should own DOM observation; the worker should wake only for settings/tab-state messages and lifecycle events. Test explicitly after terminating the worker. [Worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)

## SPA, fullscreen, and action safety

Chrome's `webNavigation.onHistoryStateUpdated` explicitly reports History API URL changes, but requires the extra `webNavigation` permission. A page restored from the back-forward cache does not receive a new DOMContentLoaded event. [WebNavigation API](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)

For this minimal first integration, prefer content-local observation: debounce player DOM mutations, recheck the current episode/page identity at every evaluation and immediately before clicking, and rescan on popstate, hashchange, pageshow, and fullscreenchange. A low-frequency location-change check can supplement mutation observation if actual player inspection shows silent pushState transitions. This is an engineering recommendation, not a Chrome guarantee that mutations indicate navigation. Patching `history.pushState` in an isolated world is not a dependable hook into the page's own execution world.

Cancel pending actions on route/episode/player replacement. At click time require the same connected element, same active player, same episode identity, an enabled action, a visible/enabled control, and no manual override. Record an action as consumed before clicking so synchronous page mutations cannot schedule a duplicate. Keep per-episode latches across replacement of the same control; do not interpret element replacement alone as permission to click again. Record trusted manual actions separately from synthetic clicks. These safety rules need focused unit tests and live validation against observed player behavior.

## Recommended checks

- Build/install unpacked with no manifest, CSP, or worker errors; use a declared minimum Chrome version consistent with used APIs.
- Popup works on unsupported pages without sensitive tab permissions.
- Global and action settings survive restart, update immediately, and sanitize malformed values.
- A paused tab remains paused after page reload, SPA episode change, popup close, and service-worker termination; closing the tab removes its state.
- No old control can fire after route/episode replacement; visibility changes and duplicate nodes do not produce repeated actions.
- Intro/recap checks remain separate from credits/next-episode advancement, which defaults off.
- Verify normal/fullscreen playback, back/forward navigation, and direct entry from a tab opened before extension installation.

## Popup stability (0.3.1)

Chrome automatically sizes its popup to the document within 25×25 and 800×600 pixels. Use a fixed 350×600 document and scroll its body to prevent native resizing as panels or status text change. Compare successive status payloads and do not render an unchanged response. Preserve actual status updates and discard responses predating a successful pause interaction. [Action popup documentation](https://developer.chrome.com/docs/extensions/reference/api/action)

## Popup language (0.3.2)

Use bundled, typed English and Spanish catalogs with a locally saved `language` preference. Missing or invalid values normalize to English without resetting version-1 playback settings. The popup-only `SET_LANGUAGE` request uses the same serialized storage queue as other preferences. No new permission, network request, browser-language dependency, or remote translation service is involved.

Adapters expose optional semantic capability reasons so the popup can explain player limitations in either UI language. Older status payloads remain accepted; English uses a generic localized explanation when no reason code is available. Native control labels and selectors are not translated or changed. Language rendering updates text without replacing the control nodes. Unchanged status polls continue to avoid DOM writes.

## Retired episode-list settings (0.3.3)

The action schema and engine support only intro, recap, credits, and nextEpisode. Normalization drops the retired `episodeLists` and `selectedEpisode` fields. A serialized GET_SETTINGS handler detects them in known version-1 settings and writes the normalized object once, preserving current preferences. All normal preference writes normalize too. The retired list request is no longer handled and the retired action key is rejected. No old list can enable advancement in the new engine.
