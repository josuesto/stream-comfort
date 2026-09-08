# Verification report 0.4.0

Date: September 8, 2026.

## Scope

The popup now edits one shared action set from any page. A streaming tab, supported status response, or active episode is not required. The heading stays Playback preferences, and a separate notice names the currently supported platforms. Current-tab status, capability limitations, and temporary pause live below the action choices. Only tab pause depends on a supported player.

The engine reads the same four action preferences on both services and still checks the service-specific capability, real control, visibility, episode identity, manual hold, and platform switch. No selector, permission, timestamp rule, or supported player locale was added.

## Migration

Settings schema 2 stores `actions` once. Known schema-1 preferences migrate on read/write; content scripts also normalize old data during bootstrap. Language, global enable, and platform switches are retained. An old false on either platform wins when combining an action, including disabled platforms. Missing old fields use previous defaults, so missing advancement choices remain off. Matching opt-ins survive. Retired list fields and service overrides are discarded. Unknown schemas fail closed.

Worker writes remain serialized. Old per-service action messages are rejected so a stale popup cannot accidentally make a global change. Temporary tab-pause storage is not edited by migration; Chrome clears it when the extension reloads or updates.

## Automated verification

TypeScript, the MV3 build, and 249 tests across nine suites pass.

| Suite | Tests | Coverage |
| --- | ---: | --- |
| Settings | 17 | Shared defaults, conservative legacy migration, invalid/inherited values, local language and independent platform switches |
| Episode identity | 8 | Observed watch routes and invalid/unrelated URLs |
| Worker | 21 | Migration persistence, no-service action writes, stale message rejection, serialized settings, sender validation, pause |
| Crunchyroll | 19 | Native controls, credits/end signals, visibility and identity |
| HBO Max | 69 | Intro/recap, next offer, locale, menus and hidden controls |
| Engine | 45 | One shared action set on both services, platform isolation, duplicates, stale controls, navigation and manual holds |
| Popup | 34 | Configure from unrelated pages or with no tab, shared choices through navigation/reopen, languages, errors, tab limitations and idle stability |
| Crunchyroll content | 16 | Saved choices before playback, entering a player later, settings changes without reload, events and navigation |
| HBO content | 20 | Shared preferences loaded before playback, later edits, intro/recap, credits/end, native cancellation and navigation |

Both language variants still produce zero idle DOM mutations over ten seconds while preserving focus and scroll. Obsolete per-service-setting tests were replaced with shared-setting and migration tests; the smaller total reflects the new model.

## Chrome preview

The actual compiled popup was exercised on a local Chrome page with a simulated Chrome API. Starting with no supported player, intro was switched off and next episode on. A newly opened Crunchyroll preview retained those choices and allowed every toggle, while explaining its unavailable recap control. Spanish was selected and HBO disabled through Platforms; a newly opened HBO preview retained the same action choices and reported its separate disabled platform state. The header consistently described shared preferences and supported platforms.

The checked document retained 350 × 600 bounds, with body clientWidth and scrollWidth both 335. This validates compiled presentation and preference flow in a preview; fixture tests validate playback wiring. It is not a new live streaming-service or native-toolbar end-to-end certification.

Earlier live controls, manual navigation, and the user's confirmation that popup stuttering stopped are retained in the [0.3.3 report](history/VERIFICATION-0.3.3.md) and its linked history. The [manual checklist](MANUAL-TESTS.md) identifies remaining installed checks, particularly natural endings and fullscreen. Reload the extension and refresh streaming pages once after updating; ordinary preference changes then apply without reloads.
