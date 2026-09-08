# Stream Comfort

A Chrome extension that automates repetitive playback controls, with independent skip choices and local preferences. The goal is to support more streaming platforms over time. Version **0.4.1** supports the observed Spanish web players on **Crunchyroll and HBO Max**.

The popup defaults to **English**, with an **English / Español** language selector. This updates labels, status messages, errors, and platform settings. Your choice is saved on this device. The popup stability fix from 0.3.1 is retained; the user has confirmed the reported flickering stopped.

Choose your skip preferences from **any tab**, before opening a streaming episode. One shared set applies to every enabled platform. The popup says **Currently supports Crunchyroll and HBO Max**; its heading no longer changes with the current service.

## Available actions

| Option | Crunchyroll | HBO Max | Default |
| --- | --- | --- | --- |
| Skip intros | Native “Saltar intro” button | Native “Omitir intro” button | On |
| Skip recaps | Native “Saltar resumen” button, when offered | Native “Omitir resumen” button | On |
| Skip credits | Requires visible credits and Next episode controls | Uses the native next-episode offer during credits | Off |
| Next episode | At the actual video end, if Next episode remains visible | At the actual video end, if the next-episode offer remains visible | Off |

The extension activates recognized, visible playback controls. It never estimates intro boundaries or uses arbitrary content timestamps. Skipping credits may skip post-credit scenes.

## Install or update

Requires Chrome 120 or later.

1. Extract the release ZIP into a folder you can keep.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the **dist** folder containing `manifest.json`.
4. Pin **Stream Comfort** in Chrome’s extensions menu for easy access.
5. Reload streaming pages that were already open before installation.

If already installed from this folder, click **Reload** on its extension card, then reload open streaming pages. The card should show **0.4.1**. Keep the extension installed to preserve its settings. The update preserves your language, global switch, and platform switches. Matching old action choices are kept. If an action was off on either platform, its new shared toggle starts off; this avoids expanding an old advancement opt-in to another platform. Missing old service settings use the previous safe defaults. You can choose the shared value yourself afterward.

Chrome loads the extracted `dist` directory, not the ZIP itself. Keep that directory in place.

## Use

Open the extension popup from any page and toggle what you want. No streaming tab or episode needs to be open to save preferences. Later, open [Crunchyroll](https://www.crunchyroll.com) or [HBO Max](https://play.hbomax.com) and sign in yourself if needed. The extension automatically uses your saved choices when a supported playback control appears. The popup does not need to stay open.

All four preference switches remain configurable regardless of the current page or player capabilities. **Skip recaps** works on both services when the verified native recap control appears. The separate **This tab** section reports current playback status and explains unavailable actions without changing your shared preferences.

**Enable extension** preserves your choices when turned off and on. **Platforms** enables each service independently; **Back** returns to your shared preferences. Neither switch turns on episode advancement. Automation requires the global, platform, and action switches to be enabled, without a tab pause or manual hold. Preference changes apply immediately to running players and are loaded by players opened later. No page reload is needed for ordinary preference changes; refreshing after an extension update replaces the old content script.

Use **Language** near the bottom of any popup panel to choose **English** or **Español**. You may need to scroll inside the popup. The setting persists when you reopen it or restart Chrome, and also works on unsupported pages. It changes only the extension’s interface, not the streaming player’s language or its verified locales.

**Pause for this tab** is available when the current tab has a supported player. It suspends automation until you resume, close the tab, or restart Chrome. This explicit pause persists across navigation and streaming-page reloads. Chrome clears temporary pauses when the extension itself reloads or updates. A manual pause, seek, skip, or HBO countdown cancellation also holds automation for that episode. Click **Resume for this tab** to continue; a new episode releases a manual hold. Volume changes and entering fullscreen do not by themselves hold automation.

**Last action** identifies the last control the extension attempted in this document session. It is not saved viewing history or confirmation that navigation completed.

The service’s own autoplay is independent. Turning off **Next episode** here does not disable Crunchyroll or HBO autoplay. To stop at the end, review the player’s settings too. On HBO, cancelling the credits countdown can let credits finish while native autoplay may still advance at the actual end. [HBO Max help](https://help.hbomax.com/us-en/Answer/Detail/000002541).

## Compatibility and privacy

- Player evidence covers Crunchyroll in Spanish (Spain) and HBO Max in Spanish (Latin America), in the main document. Other player languages, iframes, and platforms are not advertised as verified. English popup text does not imply English player support.
- Controls may be absent from some episodes. A native Crunchyroll “Saltar resumen” control was observed and manually activated on September 8, 2026. The [Crunchyroll help article](https://help.crunchyroll.com/article/what-is-the-skip-intro-feature) still says recaps are unavailable; support here follows the actual inspected player, not a claim of catalog-wide availability. See [fixture provenance](fixtures/README.md).
- Advancement requires a visible, enabled control. Completion uses the actual media state, never proximity to the duration. Native autoplay may act first.
- Only visible documents are automated. Ambiguous, hidden, and stale controls are rejected. Each advancement consumes one attempt and blocks further actions against that episode. The in-memory ledger retains at most 64 episodes; reloading the document starts a new ledger.
- No ad skipping or changes to DRM, subscriptions, or regional restrictions. HBO’s generic promotional “Saltar” control is ignored.
- The only API permission is **storage**. Content scripts run only on `www.crunchyroll.com` and `play.hbomax.com`. No access to all websites or general browsing history is requested.
- Preferences and language use `chrome.storage.local`; temporary tab pauses use `chrome.storage.session`. No backend, telemetry, remote sync, or viewing-history collection.
- Not affiliated with the streaming services.

## Source, build, and verification

With Node.js 22.12 or later, run:

```sh
npm ci
npm run check
```

This checks TypeScript, runs tests, and builds the loadable extension in `dist/`. Individual commands are `npm test`, `npm run typecheck`, and `npm run build`.

Shared types, settings, and episode identity live in `src/shared`; automation in `src/core`; service adapters in `src/services`; the worker and content script in `src`; and the popup and typed language catalogs in `src/popup`. New services require their own evidence and minimal permissions.

Version 0.4.1 passes **267 tests across nine suites**. New tests cover Crunchyroll recap detection, independent preferences, duplicate prevention, reuse of the intro button, stale controls after episode navigation, manual holds, and popup availability. The native recap button was inspected and manually activated on the live service; the new extension automation is fixture-tested. The earlier compiled popup preview and user-confirmed flicker fix remain documented. Installed end-to-end playback checks are tracked separately.

See the [verification report](docs/VERIFICATION.md), [acceptance criteria](docs/RELEASE.md), [manual checklist](docs/MANUAL-TESTS.md), [Chrome architecture](docs/CHROME-ARCHITECTURE.md), and [backlog](docs/BACKLOG.md). Historical verification notes are retained in Spanish.
