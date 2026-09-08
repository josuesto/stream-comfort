# Manual checklist for 0.4.0

Run with the extension installed in Chrome 120+, Crunchyroll's es-es player and HBO's es-419 player. Record service, extension version, visible control, and result. Fixture results do not mark installed playback checks as passed.

- [ ] Reload the extension and streaming pages; confirm version 0.4.0. The popup has a supported-platform notice and one shared set of intro, recap, credits, and next-episode actions in either language.
- [ ] Existing language and platform switches survive the update. Matching old action choices remain; conflicting choices start off. Credits and next episode are off on a fresh install. Older episode lists never cause an early advance.
- [ ] Change Language, close/reopen the popup, and restart Chrome. Verify persistence, Platforms, translated status/errors, keyboard access, and no periodic popup flicker or focus/scroll loss.
- [ ] From a non-streaming page, change all four action choices. Close the popup, then open Crunchyroll and HBO Max. Both use the saved shared choices. Switching pages never swaps the action preferences. Only tab pause depends on a supported player.
- [ ] Disable one platform without changing shared actions. Its playback stays untouched; the other platform still uses those actions. Re-enable it and verify the existing choices apply.
- [ ] Test intro on/off on both services and recap on/off on HBO. Only one attempt per control; ignore HBO's generic promotional Skip button.
- [ ] Enable credits: Crunchyroll advances only with its credits cue and next control visible; HBO uses its native next-episode offer. Repeat with credits off.
- [ ] Enable only Next episode and let the video end naturally. No early credit skip; advance only if the genuine next control is visible and enabled. Repeat with the option off. Check the service's own autoplay separately to distinguish its actions.
- [ ] Pause, seek, or skip manually; on HBO cancel the countdown. Automation holds until explicitly resumed or a new episode starts. Volume and fullscreen alone do not hold automation.
- [ ] Pause the tab from the popup, navigate, and reload the streaming page. The pause persists and is isolated from other tabs. Extension reloads/updates and browser restarts clear Chrome session storage.
- [ ] Change episodes, navigate back/forward, and try fullscreen. No stale control clicks during media replacement, no duplicated advancement, and no automation in background tabs.

The user confirmed the original popup stutter stopped after the 0.3.1 fix. That confirmation does not certify every installed playback scenario above. See [VERIFICATION.md](VERIFICATION.md).
