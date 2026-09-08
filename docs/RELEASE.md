# Version 0.3.3: four playback actions

This release removes the selected-episode list and its automation at the user's request. The popup offers independent intro, recap, credits, and next-episode switches, plus global enable, Platforms, temporary tab pause, and English/Spanish language selection.

## Acceptance criteria

1. No selected-episode toggle, list editor, list-writing request, or early advancement based on saved episode IDs remains. Legacy fields are ignored by automation and removed on a settings read or write.
2. Preserve existing language, platform preferences, and the four remaining action choices. Intro/recap default on; credits/next episode default off.
3. Activate only recognized, visible, enabled controls belonging to the current player and episode. Credits requires the service's explicit offer; next episode requires actual video completion.
4. Prevent duplicate attempts and actions on stale controls after navigation. Manual interaction and tab pauses retain priority.
5. Keep English/Spanish controls, translated unsupported explanations, keyboard access, and stable popup bounds. Unchanged status polls must not rewrite the DOM.
6. Deliver source, a loadable MV3 build, focused regression tests, and verification notes that distinguish fixtures from live service checks.

These criteria are covered by automated tests and the compiled popup preview. Outstanding installed playback checks are listed separately in [VERIFICATION.md](VERIFICATION.md).

## Service limitations

Player evidence remains limited to the observed Spanish web players on Crunchyroll and HBO Max. The popup's language does not expand native player locale support. Crunchyroll did not expose a recap button. Both platforms require their native controls to be present; no arbitrary timestamps or episode sequence guesses are used.

Credits may skip post-credit scenes. Native service autoplay remains independently configurable. No ad skipping, DRM changes, or access-control changes are implemented. See the [README](../README.md) and [historical evidence](history/VERIFICATION-through-0.3.2.md) for details and primary sources.
