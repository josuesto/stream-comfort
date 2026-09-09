# Backlog

The goal is broader streaming-service coverage through dependable integrations. Crunchyroll and HBO Max are the services currently available for live testing.

| Priority | Work | Required evidence |
| --- | --- | --- |
| 1 | Resolve the [HBO next-episode report](issues/hbo-next-episode-2026-09-09.md) | Reproduce installed settings, credits-versus-end expectation, manual hold, and actual native control state |
| 2 | Finish installed playback checks for the current release | Natural ending, fullscreen, pause and navigation on both real players |
| 3 | Additional player languages and variants | Observe each variant and capture representative fixtures before enabling its controls |
| 4 | Additional streaming platforms | Test access, real playback controls, minimal permissions, one dependable integration at a time |

Shared playback preferences configurable from any tab are implemented in 0.4.0. Crunchyroll native recap detection is implemented in 0.4.1 from a directly observed control; installed automation remains part of the playback checklist.

The selected-episode list was removed in 0.3.3 at the user's request and is no longer planned. Estimated timestamps, automated filler classification, ad/DRM changes, and remote viewing-data sync remain out of scope.
