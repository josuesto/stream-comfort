# Verification report 0.4.1

Date: September 8, 2026.

## Scope and live evidence

Crunchyroll recap detection now recognizes the native Spanish “Saltar resumen” control. It reuses the observed intro icon and player hierarchy but is classified by exact visible text and accessible name. Existing visibility, enabled-state, media, episode, preference, and manual-interaction checks still apply. No permission or storage-schema change is needed.

The actual recap control was inspected in an authenticated Chrome session on the Spanish web player. Both its visible (`aria-hidden="false"`, tabindex 0, opacity 1) and hidden (`aria-hidden="true"`, tabindex -1, opacity 0) states were observed. Its label remained mounted while hidden. Revealing the native controls allowed a manual click by accessible name; playback moved from approximately 1:21 to 1:56 in the same episode. This verifies the native control and its behavior, not an automated click by the new installed extension. No video, account data, content identifiers, or source URLs are included in the reduced fixture.

The [official help article](https://help.crunchyroll.com/article/what-is-the-skip-intro-feature), checked the same day, still says the skip feature does not cover recaps. Actual observed controls take precedence for this integration. We do not claim every episode or player variant provides one. See [fixture provenance](../fixtures/README.md).

## Automated verification

TypeScript, the MV3 build, and 267 tests across nine suites pass.

| Suite | Tests | Coverage |
| --- | ---: | --- |
| Settings | 17 | Shared defaults, conservative migration, language and platform preferences |
| Episode identity | 8 | Watch routes and invalid/unrelated URLs |
| Worker | 21 | Serialized settings, migration, validation and tab pause |
| Crunchyroll | 30 | Native recap fixture, text/label agreement, hidden/disabled/ambiguous controls, menus, locales, intro/credits/end |
| HBO Max | 69 | Intro/recap, next offer, locale, menus and hidden controls |
| Engine | 45 | Shared choices, platform isolation, duplicate/stale controls, navigation and manual holds |
| Popup | 37 | Shared choices from any tab, recap availability, localized stale-adapter message, languages and idle stability |
| Crunchyroll content | 20 | Recap preference off/on, duplicate prevention, later intro on the same control, new media after navigation, manual recap hold, existing settings/events |
| HBO content | 20 | Shared preferences, intro/recap, credits/end, cancellation and navigation |

Recap automation is exercised through the actual content script, adapter and engine with jsdom fixtures and mocked Chrome storage/messages. Native media state is simulated. Both popup languages retain the idle-mutation regression checks.

## Remaining installed checks

The new automatic recap click has not yet been verified in the user's installed build. Reload the extension and open streaming pages once after this update. Then test recap off/on, normal and fullscreen playback, and episode navigation. A manual pause or seek puts automation on hold; use Resume for this tab or start another episode before expecting an automatic action. The [manual checklist](MANUAL-TESTS.md) keeps these checks explicit.

The [0.4.0 report](history/VERIFICATION-0.4.0.md) records the earlier compiled popup Chrome preview, shared-settings migration and previous live evidence. No new full installed-playback certification is claimed for either service.

## Follow-up: September 9

The user reported HBO not advancing with Next episode enabled. All 134 existing HBO/engine tests passed again, and the recognized native next offers were observed in a fresh live session, including alongside an actual ended video. The failure has not been isolated; no fix or successful extension-caused advance is claimed. Track the missing reproduction conditions and manual-hold/credits distinction in the [open issue](issues/hbo-next-episode-2026-09-09.md).
