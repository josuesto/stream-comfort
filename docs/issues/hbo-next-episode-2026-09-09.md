# HBO next-episode report — September 9, 2026

Status: open; cause not yet reproduced.

The user reported that Next episode was enabled but HBO's next-episode button was not activated as expected the previous night. The report does not yet identify the loaded extension version, whether the video finished completely, the Skip credits setting, or tab-pause/manual-hold state.

## Findings

- The current adapter classifies HBO's offer as credits until the real `video.ended` state becomes true. Enabling Next episode alone deliberately leaves the offer untouched during credits.
- Manual pause, seeking, native skip, and countdown cancellation place the current episode on hold. Starting playback again does not clear that hold; explicit Resume for this tab or a new episode does. This is a possible usability issue, not a confirmed diagnosis of the reported failure.
- In a fresh Spanish HBO session, the existing countdown and autoplay-off button labels and hierarchy were observed again. The real video reached `ended: true` while the recognized next offer was still present after cancelling the countdown. The service subsequently navigated to the next episode. Native autoplay was not isolated, and the inspection used manual seeking/cancellation, so this does not verify an extension-caused advance.
- The HBO adapter (69), HBO content (20), and shared engine (45) suites were rerun unchanged: all 134 tests passed. Their existing synthetic media-end cases cannot establish that the user's installed session worked.

## Reproduction still needed

1. Record the loaded extension version and refresh the streaming tab after any update.
2. Confirm global/HBO enable, action preferences, and This tab pause/manual-hold status.
3. Distinguish an expected early credits advance from an actual-end advance. Do not silently make Next episode skip credits.
4. Reproduce with only the intended advancement option enabled. Account for HBO's own autoplay and any manual seek used to reach the test state.
5. Capture any changed native control before changing selectors. If detection matches, examine actual media state, hold state, and event ordering.
6. Verify the correction in the installed extension before closing this report.

No implementation change or fix is claimed from this investigation alone.
