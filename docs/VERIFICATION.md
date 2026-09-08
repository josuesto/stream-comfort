# Verification report 0.3.3

Date: September 7, 2026.

## Scope and result

Removed Skip selected episodes from the popup, both translation catalogs, settings schema, worker request handling, adapters, and automation engine. Removed the episode-list editor and its unused helpers. The four remaining actions are intro, recap, credits, and next episode. Credits and next episode remain off by default.

Existing version-1 settings normalize without retired lists or their toggle. A serialized settings read removes those fields from local storage once; normal preference writes also discard them. Remaining action choices, language, and platform preferences are preserved. The migration does not edit tab-pause storage; Chrome itself clears session storage on an extension reload/update.

## Automated verification

`npm run check` passes TypeScript, 253 tests across nine suites, and the MV3 build. No permissions or playback selectors were added.

| Suite | Tests | Coverage |
| --- | ---: | --- |
| Settings | 23 | Defaults, language, platform/action isolation, legacy-list removal |
| Episode identity | 8 | Observed watch routes and malformed/unrelated URLs |
| Worker | 21 | Sender validation, serialized writes, migration, local language and tab pause |
| Crunchyroll | 19 | Native controls, credits/end signals, visibility and identity |
| HBO Max | 69 | Intro/recap, native next offer, locale, menus and hidden controls |
| Engine | 44 | Duplicate prevention, stale controls, manual hold, navigation and retired-data rejection |
| Popup | 34 | Four-action UI, both languages, settings, platforms, pause, errors and idle stability |
| Crunchyroll content | 15 | Initialization, events, manual interaction and SPA navigation |
| HBO content | 20 | Intro/recap, credits/end, countdown cancellation and preferences |

New regressions prove that old enabled episode-list preferences cannot cause an early advance; the remaining Next episode action still requires its own toggle and the actual video end. Worker migration removes legacy fields once while retaining unrelated settings. Both language variants expose only the four remaining actions. Tests for the retired feature were removed; the lower total does not represent failing tests.

## Browser and live evidence

The compiled popup was checked in a local Chrome page using a simulated Chrome API for both services and both UI languages. The selected-episode row and editor are absent; Platforms and Language remain usable. Document bounds remain 350 × 600 with no horizontal overflow. Both idle-popup tests continue to record zero DOM mutations over ten seconds and preserve focus and scroll.

This checks the compiled UI and fixture-backed logic, not a fresh end-to-end run of the installed extension on a streaming service. Earlier live player observations, manual next-episode checks, and the user's confirmation that popup stuttering stopped are retained in the [historical report](history/VERIFICATION-through-0.3.2.md). Its episode-list descriptions apply only to older versions.

Installed playback checks for natural endings, fullscreen, and complete pause/navigation behavior remain on the [manual checklist](MANUAL-TESTS.md). Reload the extension and open streaming pages to replace old running code. No new streaming-player locales or platforms are claimed as verified.
