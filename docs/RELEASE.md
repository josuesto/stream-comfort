# Version 0.5.0: act on next-episode offers

Next episode now activates a service's contextual next-episode offer as soon as it appears during playback. Previous releases waited for the actual media end unless Skip credits was also enabled. This change follows the user's September 9 clarification of the intended behavior.

## Acceptance criteria

1. With Next episode on and Skip credits off, activate HBO's recognized visible next offer before `video.ended`. Support the already observed countdown and autoplay-off variants without waiting for a countdown or using content timestamps.
2. On Crunchyroll, require the visible native “Saltar créditos” prompt and next control during playback. Ignore its permanent toolbar next button during ordinary content. Preserve the actual-end fallback when a valid next control remains visible.
3. Keep advancement off by default and preserve saved settings. Either credits or next can request the same advancement; both enabled still produce at most one attempt per episode.
4. Preserve all visibility, disabled/ambiguous-control, manual-hold, pause, media readiness, seeking, settings, and navigation checks. A route change cannot authorize clicking stale controls. A repeated/replaced offer cannot produce another advancement.
5. Explain the immediate-offer behavior and potential credit skipping in English and Spanish. Preferences remain configurable from any tab, independently of the current player. Preserve the fixed-size popup and idle-render safeguards.
6. Pass TypeScript checking, the focused regressions and full test suite, and build a loadable MV3 extension. Update installation instructions, verification, the manual checklist, and the project note. Publish source and a compiled prerelease.

## Limitations

This uses existing live-observed selectors and reduced fixtures; no new player variant is claimed. Player-label evidence is Spanish. The Crunchyroll actual-end fallback does not depend on Spanish text, but early advancement requires its verified Spanish credits prompt. Hidden controls, paused/seeking playback, background tabs and manual holds prevent automatic actions. Native autoplay remains independent. Either advancement option can omit post-credit scenes; there is no longer a full-video-end-only setting. Installed verification of the changed behavior remains in the [manual checklist](MANUAL-TESTS.md).
