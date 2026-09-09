# Verification report 0.5.0

Date: September 9, 2026.

## Result and scope

Next episode now acts on a contextual native offer during playback instead of waiting for `video.ended`. HBO's recognized up-next offer becomes a next candidate immediately. Crunchyroll uses its observed credits prompt together with its native next button, retaining a real-media-end fallback. Its permanently available toolbar next button alone cannot trigger an early advance.

No selectors, permissions, settings schema, or timing thresholds were added. The two advancement options retain their own preferences and share one consumed advancement per episode. Both remain off on a fresh install. English and Spanish popup descriptions explain the new behavior.

## Automated verification

`npm run check` passes: TypeScript, all **275 tests across nine suites**, and the Chrome MV3 build.

| Suite | Tests | Coverage |
| --- | ---: | --- |
| Settings | 17 | Shared defaults, conservative legacy migration, language and platform choices |
| Episode identity | 8 | Watch routes and invalid/unrelated URLs |
| Worker | 21 | Serialized settings, migration, validation and tab pause |
| Crunchyroll adapter | 30 | Exact observed labels, recap, credits cue, permanent-toolbar guard, actual-end fallback, unsafe controls and locales |
| HBO adapter | 69 | Immediate native offers, countdown/autoplay-off variants, intro/recap, menus, locales and unsafe controls |
| Engine | 47 | Ready offers during playback, paused media, actual-end fallback, shared advancement ledger, manual holds and stale navigation |
| Popup | 39 | Both languages, immediate-offer explanation, independent settings from any tab, zero idle DOM mutations |
| Crunchyroll content | 21 | Credits cue appearing with Next on and credits off, hidden cues, replaced controls, recap settings and navigation |
| HBO content | 23 | Hidden-to-visible offers with Next on and credits off, countdown/autoplay-off variants, repeated offers, cancellation, new episode, synchronous end handling |

Content tests run the actual adapter, engine, scheduler and content script against reduced jsdom fixtures with mocked Chrome APIs and simulated media properties. They establish the requested behavior and safeguards in those states, not the success of real DRM playback or installed automatic clicks.

The compiled 0.5.0 popup was opened in Chrome using a local preview with simulated extension APIs. The English description was visually checked; switching to Spanish showed the translated immediate-offer description. DOM layout checks retained a 350×600 popup document with no horizontal body overflow. This is a popup preview, not the installed toolbar popup or a live player test.

## Live evidence and limits

The Spanish native controls were inspected before their selectors were implemented. The HBO offer was observed again on September 9, both during playback and alongside a real `ended: true` video after cancelling a countdown. Its labels and hierarchy matched the existing countdown and autoplay-off fixtures. Native autoplay was not isolated in that session, so the observed navigation is not attributed to the extension.

Crunchyroll's native credits prompt and persistent toolbar next button were observed on September 7; its recap button was inspected and manually activated on September 8. The new behavior reuses this evidence, without inventing another end-card selector. See [Crunchyroll provenance](../fixtures/README.md), [HBO provenance](../fixtures/hbomax/README.md), and the [historical 0.4.1 report](history/VERIFICATION-0.4.1.md).

The 0.5.0 automatic-offer behavior has **not been verified in the installed extension on a live streaming service**. The existing unpacked folder contains the updated build, but Chrome and already-open service pages must reload it. The user's previous popup-flicker confirmation and earlier compiled popup preview do not certify this playback change.

## Remaining installed checks

Reload the extension card and streaming page. With global/platform on, Next episode on, Skip credits off, and no tab pause/manual hold, let HBO's offer appear and verify one immediate advance. Test native autoplay on/off separately. On Crunchyroll, ordinary toolbar visibility must not skip the episode; the visible credits prompt plus next control should trigger one advance. Test fullscreen, pause/resume, and successive episodes using the [manual checklist](MANUAL-TESTS.md).

The [HBO report](issues/hbo-next-episode-2026-09-09.md) now records the explicit behavior correction and fixture results. Installed confirmation remains pending; the earlier session's exact failure is not retroactively diagnosed.
