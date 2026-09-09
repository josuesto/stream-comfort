# Stream Comfort

A Chrome extension that automates repetitive playback controls, with independent skip choices and local preferences. The goal is to support more streaming platforms over time. Version **0.5.0** supports the observed Spanish web players on **Crunchyroll and HBO Max**.

The popup defaults to **English**, with an **English / Español** language selector. This updates labels, status messages, errors, and platform settings. Your choice is saved on this device. The popup stability fix from 0.3.1 is retained; the user has confirmed the reported flickering stopped.

Choose your skip preferences from **any tab**, before opening a streaming episode. One shared set applies to every enabled platform. The popup says **Currently supports Crunchyroll and HBO Max**; its heading no longer changes with the current service.

## Available actions

| Option | Crunchyroll | HBO Max | Default |
| --- | --- | --- | --- |
| Skip intros | Native “Saltar intro” button | Native “Omitir intro” button | On |
| Skip recaps | Native “Saltar resumen” button, when offered | Native “Omitir resumen” button | On |
| Skip credits | Requires visible credits and Next episode controls | Uses the native next-episode offer during credits | Off |
| Next episode | When the native credits prompt and next button are visible; also at actual video end if next remains available | When the native next-episode offer appears, without waiting for the video to end | Off |

The extension activates recognized, visible playback controls. It never estimates intro boundaries or uses arbitrary content timestamps. **Next episode now clicks the offer when it appears**, even with Skip credits off. Both options can skip credits and post-credit scenes; either can request the same advance, and enabling both still produces one attempt. Leave both off to have the extension preserve credits.

Crunchyroll's next button is permanently present in its toolbar. During playback, the extension requires the observed “Saltar créditos” prompt before using it; merely showing the toolbar does not skip an episode. If that prompt is absent, Next episode can still act at the actual media end when the next button is visible.

## Install or update

Requires Chrome 120 or later.

1. Extract the release ZIP into a folder you can keep.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the **dist** folder containing `manifest.json`.
4. Pin **Stream Comfort** in Chrome’s extensions menu for easy access.
5. Reload streaming pages that were already open before installation.

If already installed from this folder, click **Reload** on its extension card, then reload open streaming pages. The card should show **0.5.0**. Keep the extension installed to preserve its settings. This update keeps all saved choices and changes an enabled Next episode option to act when the offer appears. When upgrading from pre-0.4.0 per-platform settings, matching old action choices are kept; an action previously off on either platform starts off in the shared settings. Missing old service settings use the previous safe defaults.

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
- Advancement requires a visible, enabled contextual next offer, or the actual media end with a valid next control. There is no remaining-time threshold or countdown delay. Native autoplay may act first.
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

Version 0.5.0 passes **275 tests across nine suites**. Regression coverage includes immediate HBO offers with native autoplay on or off, Next episode enabled independently of credits, Crunchyroll's permanent-toolbar guard, duplicate prevention, actual-end fallback, manual holds, episode navigation, settings, and both popup languages. Detection uses controls inspected on the live services; the new automatic-offer behavior is fixture-tested. Installed end-to-end playback checks are tracked separately.

See the [verification report](docs/VERIFICATION.md), [acceptance criteria](docs/RELEASE.md), [manual checklist](docs/MANUAL-TESTS.md), [Chrome architecture](docs/CHROME-ARCHITECTURE.md), and [backlog](docs/BACKLOG.md). Historical verification notes are retained in Spanish.
