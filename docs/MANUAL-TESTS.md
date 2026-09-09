# Manual checklist for 0.5.0

Run with the extension installed in Chrome 120+, Crunchyroll's es-es player and HBO's es-419 player. Record service, extension version, visible control, and result. Fixture results do not mark installed playback checks as passed.

- [ ] Reload the extension and streaming pages; confirm version 0.5.0. The popup has a supported-platform notice and one shared set of intro, recap, credits, and next-episode actions in either language.
- [ ] Existing language and platform switches survive the update. Existing action choices remain; migration from pre-0.4.0 settings keeps a conflicting action off. Credits and next episode are off on a fresh install. Older episode lists never cause an early advance.
- [ ] Change Language, close/reopen the popup, and restart Chrome. Verify persistence, Platforms, translated status/errors, keyboard access, and no periodic popup flicker or focus/scroll loss.
- [ ] From a non-streaming page, change all four action choices. Close the popup, then open Crunchyroll and HBO Max. Both use the saved shared choices. Switching pages never swaps the action preferences. Only tab pause depends on a supported player.
- [ ] Disable one platform without changing shared actions. Its playback stays untouched; the other platform still uses those actions. Re-enable it and verify the existing choices apply.
- [ ] Test intro and recap independently on both services. On Crunchyroll, use an episode that offers “Saltar resumen”: recap off leaves it untouched; recap on activates it once. A later “Saltar intro” prompt still follows its own preference. Ignore HBO's generic promotional Skip button.
- [ ] Enable credits: Crunchyroll advances only with its credits cue and next control visible; HBO uses its native next-episode offer. Repeat with credits off.
- [ ] Enable only Next episode (Skip credits off). With playback active and no manual hold, HBO advances once as its native next-episode offer appears, before the video ends. Test its countdown and autoplay-off offers separately. The extension does not wait for either countdown or a remaining-time threshold.
- [ ] On Crunchyroll, showing the ordinary playback toolbar must not skip the episode. Next episode advances when “Saltar créditos” and the next button are both visible. Without the prompt, test the actual-end fallback with a visible next button.
- [ ] With both advancement switches on, repeated or replaced offers still advance once. With both off, the extension does not advance. Turning credits off does not veto an enabled Next episode. Both options can omit post-credit scenes. Check native autoplay independently to distinguish its actions.
- [ ] Pause, seek, or skip manually; on HBO cancel the countdown. Automation holds until explicitly resumed or a new episode starts. Volume and fullscreen alone do not hold automation.
- [ ] Pause the tab from the popup, navigate, and reload the streaming page. The pause persists and is isolated from other tabs. Extension reloads/updates and browser restarts clear Chrome session storage.
- [ ] Change episodes, navigate back/forward, and try fullscreen. No stale control clicks during media replacement, no duplicated advancement, and no automation in background tabs.

The user confirmed the original popup stutter stopped after the 0.3.1 fix. That confirmation does not certify every installed playback scenario above. See [VERIFICATION.md](VERIFICATION.md).
