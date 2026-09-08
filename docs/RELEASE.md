# Version 0.4.1: Crunchyroll recap skipping

The shared Skip recaps preference now activates Crunchyroll's observed native “Saltar resumen” button as well as HBO Max's recap control. Preferences remain configurable from any tab. Recap, intro, credits, and next episode stay independent; existing settings are preserved.

## Acceptance criteria

1. Recognize only the observed Spanish recap control: matching text and accessible name, the existing skip icon, and an unambiguous current player. Require a visible, enabled control with explicit active ARIA state.
2. Respect the saved recap preference independently of intro. Global/platform off, tab pause, manual hold, paused/seeking media, hidden controls, and unsupported locales prevent automation.
3. Attempt a recap at most once per episode, even when its control disappears/reappears. Permit a later intro on the same native button. Discard stale controls after navigation until new media is identified.
4. Explain recap availability in English and Spanish without an HBO-only restriction. An older Crunchyroll content script gets a localized page-reload message.
5. Add a reduced fixture with direct live provenance and focused regression tests. Report manual native-button verification separately from fixture-tested extension automation.
6. Keep the current permissions, local settings schema, popup stability, and safe advancement defaults. Deliver the source and loadable build.

Controls can be missing on individual episodes; unobserved player languages remain unsupported. No guessed recap boundaries or content timestamps are introduced. See [verification](VERIFICATION.md) and [manual checks](MANUAL-TESTS.md).
