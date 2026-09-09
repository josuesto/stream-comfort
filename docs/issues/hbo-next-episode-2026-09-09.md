# HBO next-episode report — September 9, 2026

Status: requested behavior corrected in 0.5.0 and fixture-tested; installed confirmation pending.

The user reported that Next episode was enabled but HBO's next-episode button was not activated as expected the previous night. The report does not yet identify the loaded extension version, whether the video finished completely, the Skip credits setting, or tab-pause/manual-hold state.

## Initial investigation (before the clarification)

- The 0.4.1 adapter classified HBO's offer as credits until the real `video.ended` state became true. Enabling Next episode alone deliberately left the offer untouched during credits.
- Manual pause, seeking, native skip, and countdown cancellation place the current episode on hold. Starting playback again does not clear that hold; explicit Resume for this tab or a new episode does. This is a possible usability issue, not a confirmed diagnosis of the reported failure.
- In a fresh Spanish HBO session, the existing countdown and autoplay-off button labels and hierarchy were observed again. The real video reached `ended: true` while the recognized next offer was still present after cancelling the countdown. The service subsequently navigated to the next episode. Native autoplay was not isolated, and the inspection used manual seeking/cancellation, so this does not verify an extension-caused advance.
- The HBO adapter (69), HBO content (20), and shared engine (45) suites were rerun unchanged: all 134 tests passed. Their existing synthetic media-end cases cannot establish that the user's installed session worked.

## User clarification and correction

The user clarified: “next episode should skip when the next episode button appears, similar to how it skips intros/openings”. This explicitly requests earlier advancement and replaces the previous end-only interpretation.

In 0.5.0, the recognized HBO next offer is a Next episode candidate as soon as it is visible. The engine no longer requires `video.ended` for a contextual offer during playback. Next episode alone works with Skip credits off; both options still share one advancement attempt. English and Spanish help text explain that an enabled Next episode can skip credits. Saved preferences are preserved, and advancement still defaults off.

The same meaning applies to Crunchyroll using its already observed credits prompt plus native next control. Its permanent toolbar next button alone is not a contextual offer and remains ignored until a credits cue or real media end. No selectors or content timestamps were invented for this correction.

All 275 tests pass. Focused content regressions cover HBO's countdown and autoplay-off offers appearing before media end with only Next episode enabled, repeated offers, native cancellation, actual-end fallback, and new-episode navigation.

## Installed confirmation still needed

1. Reload the extension to 0.5.0 and refresh the streaming page.
2. Enable global/HBO and Next episode, with Skip credits off. Clear any tab pause/manual hold explicitly.
3. Let the native offer appear during active playback; verify one immediate extension-caused advance, accounting for HBO's own autoplay.
4. Repeat with native autoplay off, fullscreen, and a later episode. Cancelling the native countdown should still hold automation.
5. If a visible offer is missed, record loaded version, settings, hold state and the native control variant before changing detection.

The clarified behavior is implemented and fixture-tested. This does not prove the exact cause of the previous night's session or verify the updated installed extension. Close the installed-check portion only after the live correction is confirmed.
