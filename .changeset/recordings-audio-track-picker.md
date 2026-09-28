---
"@stapel/recordings-react": minor
---

`/upload`: multiple audio tracks are listed, not guessed. `listAudioTracks(file)` returns `[{index, codec, channels, sampleRate, language?, name?, durationSeconds, enabled, remuxable}]` (`null` when the file cannot be listed), `extractAudioTrack(file, { trackIndex })` keeps the chosen one exactly as it is (codec, channel layout and rate unchanged — no client-side downmix), and `prepareUpload(file, { trackIndex })` returns the m4a or, for any reason extraction does not work, the original file whole. `RemuxResult` gains `channels`, `sampleRate` and `trackIndex`.
