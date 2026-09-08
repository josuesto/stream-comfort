# Stream Comfort

A Chrome extension that automates repetitive playback controls, with independent skip choices and local preferences. The goal is to support more streaming platforms over time. Version **0.3.2** supports the observed Spanish web players on **Crunchyroll and HBO Max**.

The popup now defaults to **English**, with an **English / Español** language selector. This updates labels, status messages, errors, platform settings, and the episode editor. Your choice is saved on this device. The popup stability fix from 0.3.1 is retained; the user has confirmed the reported flickering stopped.

## Available actions

| Option | Crunchyroll | HBO Max | Default |
| --- | --- | --- | --- |
| Skip intros | Native “Saltar intro” button | Native “Omitir intro” button | On |
| Skip recaps | No recap control in the inspected player | Native “Omitir resumen” button | Preference on; available only on HBO |
| Skip credits | Requires visible credits and Next episode controls | Uses the native next-episode offer during credits | Off |
| Next episode | At the actual video end, if Next episode remains visible | At the actual video end, if the next-episode offer remains visible | Off |
| Skip selected episodes | Up to 100 episode links chosen by you | No permanent Next episode control; scoped separately | Off |

The extension activates recognized, visible playback controls. It never estimates intro boundaries or uses arbitrary content timestamps. Skipping credits may skip post-credit scenes.

## Install or update

Requires Chrome 120 or later.

1. Extract the release ZIP into a folder you can keep.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the **dist** folder containing `manifest.json`.
4. Pin **Stream Comfort** in Chrome’s extensions menu for easy access.
5. Reload streaming pages that were already open before installation.

If already installed from this folder, click **Reload** on its extension card, then reload open streaming pages. The card should show **0.3.2**. Keep the extension installed to preserve its settings. Older preferences default to English without resetting your platform switches, action choices, or selected episodes.

Chrome loads the extracted `dist` directory, not the ZIP itself. Keep that directory in place.

## Use

Open an episode on [Crunchyroll](https://www.crunchyroll.com) or [HBO Max](https://play.hbomax.com), sign in yourself if needed, and open the popup. The heading identifies the current service. Each action has its own toggle; unavailable features have a disabled control and an explanation.

**Enable extension** preserves your choices when turned off and on. **Platforms** enables each service independently; **Back** returns to the current service’s controls. Neither switch turns on episode advancement. Automation requires the global, platform, and action switches to be enabled, without a tab pause or manual hold. Preference changes apply immediately.

Use **Language** near the bottom of any popup panel to choose **English** or **Español**. You may need to scroll inside the popup. The setting persists when you reopen it or restart Chrome, and also works on unsupported pages. Switching languages preserves an open episode-list draft. It changes only the extension’s interface, not the streaming player’s language or its verified locales.

**Pause for this tab** suspends automation until you resume, close the tab, or restart Chrome. This explicit pause persists across navigation and reloads. A manual pause, seek, skip, or HBO countdown cancellation also holds automation for that episode. Click **Resume for this tab** to continue; a new episode releases a manual hold. Volume changes and entering fullscreen do not by themselves hold automation.

**Last action** identifies the last control the extension attempted in this document session. It is not saved viewing history or confirmation that navigation completed.

The service’s own autoplay is independent. Turning off **Next episode** here does not disable Crunchyroll or HBO autoplay. To stop at the end, review the player’s settings too. On HBO, cancelling the credits countdown can let credits finish while native autoplay may still advance at the actual end. [HBO Max help](https://help.hbomax.com/us-en/Answer/Detail/000002541).

## Select Crunchyroll episodes

1. Open the popup on a Crunchyroll episode and click **Choose episodes**.
2. Paste public episode links, one per line, or click **Add current episode**. Up to 100 links are accepted; duplicates are combined.
3. Save the list, then separately enable **Skip selected episodes**. Saving keeps its existing toggle state; emptying the list turns it off.
4. On a listed episode, the extension activates the normal **Next episode** button if visible and enabled. This option does not skip unlisted episodes.

Only exact episode IDs are stored, without URL parameters or history. The extension does not infer season order, identify filler, or guess equivalences between dubs. The service determines where its Next episode button goes. If that control is missing or hidden, the extension waits.

HBO’s episode list remains out of scope: its inspected player has no permanent Next episode button, and its episode drawer loads only part of a season. Selecting the next visible catalog item could go to the wrong content. HBO credits and end-of-video advancement use its observed native offer.

## Compatibility and privacy

- Player evidence covers Crunchyroll in Spanish (Spain) and HBO Max in Spanish (Latin America), in the main document. Other player languages, iframes, and platforms are not advertised as verified. English popup text does not imply English player support.
- Controls may be absent from some episodes. Crunchyroll says Skip Intro does not cover recaps; no recap control was observed in the inspected session. [Crunchyroll help](https://help.crunchyroll.com/article/what-is-the-skip-intro-feature).
- Advancement requires a visible, enabled control. Completion uses the actual media state, never proximity to the duration. Native autoplay may act first.
- Only visible documents are automated. Ambiguous, hidden, and stale controls are rejected. Each advancement consumes one attempt and blocks further actions against that episode. The in-memory ledger retains at most 64 episodes; reloading the document starts a new ledger.
- No ad skipping or changes to DRM, subscriptions, or regional restrictions. HBO’s generic promotional “Saltar” control is ignored.
- The only API permission is **storage**. Content scripts run only on `www.crunchyroll.com` and `play.hbomax.com`. No access to all websites or general browsing history is requested.
- Preferences, language, and selected IDs use `chrome.storage.local`; temporary tab pauses use `chrome.storage.session`. No backend, telemetry, remote sync, or viewing-history collection. IDs you explicitly select remain saved as preferences.
- Not affiliated with the streaming services.

## Source, build, and verification

With Node.js 22.12 or later, run:

```sh
npm ci
npm run check
```

This checks TypeScript, runs tests, and builds the loadable extension in `dist/`. Individual commands are `npm test`, `npm run typecheck`, and `npm run build`.

Shared types, settings, and episode identity live in `src/shared`; automation in `src/core`; service adapters in `src/services`; the worker and content script in `src`; and the popup and typed language catalogs in `src/popup`. New services require their own evidence and minimal permissions.

Version 0.3.2 passes **260 tests across nine suites**. The compiled English/Spanish popup was checked in Chrome using a simulated Chrome API. Earlier sessions inspected real controls on both services and verified manual HBO next-episode navigation. The user confirmed the prior popup flicker fix. These checks do not certify every action in the installed extension: live end-to-end playback checks remain documented separately.

See the [verification report](docs/VERIFICATION.md), [acceptance criteria](docs/RELEASE.md), [manual checklist](docs/MANUAL-TESTS.md), [Chrome architecture](docs/CHROME-ARCHITECTURE.md), and [backlog](docs/BACKLOG.md). Historical verification notes are retained in Spanish.
