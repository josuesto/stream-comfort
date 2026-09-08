# Version 0.4.0: configure once, use on enabled platforms

The popup offers one shared set of intro, recap, credits, and next-episode preferences. Configure them from any tab before starting playback. A static notice says Currently supports Crunchyroll and HBO Max. Platforms controls where automation runs; it no longer selects an independent action profile.

## Acceptance criteria

1. All four action switches can be edited without a supported page, episode, tab ID, or status response. Save locally and retain choices through reopening and navigation.
2. Both service engines use the same saved choices when playback starts later, and receive updates without a page reload. No popup must remain open.
3. Preserve global, language, and platform switches. Combine older action profiles conservatively: false on either platform wins, missing fields use previous defaults, matching choices remain. Do not enable new episode advancement implicitly.
4. Keep current-tab pause, manual hold, and capability status separate from editable preferences. Unavailable controls never trigger actions merely because the shared preference is on.
5. Retain native-control evidence, duplicate/stale-control prevention, and separate credits versus actual-video-end advancement. No retired episode-list automation returns.
6. Keep English/Spanish text, keyboard access, fixed popup bounds, and no DOM writes for unchanged status polls.
7. Deliver source, a loadable MV3 build, focused tests, and honest fixture/preview/live evidence distinctions.

Automated and preview results are in [VERIFICATION.md](VERIFICATION.md). Supported player variants remain the observed Spanish web players. Crunchyroll has no observed recap button. Native service autoplay remains independent; credits can skip post-credit scenes. No ad, DRM, subscription, or access-control changes are implemented.
