# Manual checklist for 0.3.3

Run with the extension installed in Chrome 120+, Crunchyroll's es-es player and HBO's es-419 player. Record service, extension version, visible control, and result. Fixture results do not mark installed playback checks as passed.

- [ ] Reload the extension and streaming pages; confirm version 0.3.3. The popup has only intro, recap, credits, and next-episode actions. No episode-list row or editor remains in either English or Spanish.
- [ ] Existing language and action/platform preferences survive the update. Credits and next episode are off on a fresh install. Older episode lists never cause an early advance.
- [ ] Change Language, close/reopen the popup, and restart Chrome. Verify persistence, Platforms, translated status/errors, keyboard access, and no periodic popup flicker or focus/scroll loss.
- [ ] Outside a supported episode, the popup explains the limitation and still offers global, platform, and language controls.
- [ ] Test intro on/off on both services and recap on/off on HBO. Only one attempt per control; ignore HBO's generic promotional Skip button.
- [ ] Enable credits: Crunchyroll advances only with its credits cue and next control visible; HBO uses its native next-episode offer. Repeat with credits off.
- [ ] Enable only Next episode and let the video end naturally. No early credit skip; advance only if the genuine next control is visible and enabled. Repeat with the option off. Check the service's own autoplay separately to distinguish its actions.
- [ ] Pause, seek, or skip manually; on HBO cancel the countdown. Automation holds until explicitly resumed or a new episode starts. Volume and fullscreen alone do not hold automation.
- [ ] Pause the tab from the popup, navigate, and reload the streaming page. The pause persists and is isolated from other tabs. Extension reloads/updates and browser restarts clear Chrome session storage.
- [ ] Change episodes, navigate back/forward, and try fullscreen. No stale control clicks during media replacement, no duplicated advancement, and no automation in background tabs.

The user confirmed the original popup stutter stopped after the 0.3.1 fix. That confirmation does not certify every installed playback scenario above. See [VERIFICATION.md](VERIFICATION.md).
