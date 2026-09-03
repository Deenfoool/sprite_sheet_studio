# Sprite Sheet Studio — Release Checklist

Use this checklist before tagging a public release.

## Runtime / Pages

- [ ] `src/runtime.bundle.js` is regenerated with `npm run build:runtime`.
- [ ] `index.html` loads the committed runtime bundle, not the legacy runtime TypeScript stripper.
- [ ] GitHub Pages is configured as `Deploy from a branch` → `main` → `/(root)`.
- [ ] Public Pages URL opens without startup errors.
- [ ] `?selftest=1` reports zero failed checks in a supported Chromium browser.

## Static checks

- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] `npm run test:smoke` passes.
- [ ] No generated Playwright reports or `dist/` files are accidentally committed.

## Animator smoke test

- [ ] PNG sprite sheet import.
- [ ] WebP import.
- [ ] Multiple-frame import with natural filename sorting.
- [ ] Manual slicing.
- [ ] Auto Slice.
- [ ] Trim + Auto Align.
- [ ] Custom per-frame anchor alignment.
- [ ] Timeline reorder / duplicate / delete / reverse.
- [ ] Loop / Ping-pong / Once playback.
- [ ] Per-frame hold and onion skin.
- [ ] Undo / Redo.

## Project round-trip

- [ ] Save `.sss`.
- [ ] Reload browser and restore IndexedDB autosave.
- [ ] Load the saved `.sss` into a fresh session.
- [ ] Multiple frame animations survive the round-trip.
- [ ] Custom anchors survive the round-trip.
- [ ] Rig bones and sprite parts survive the round-trip.
- [ ] Skeletal clips and keyframes survive the round-trip.

## Export smoke test

- [ ] GIF.
- [ ] APNG.
- [ ] Sprite sheet PNG.
- [ ] PNG sequence ZIP.
- [ ] Atlas + JSON.
- [ ] Multi-atlas package.
- [ ] Aseprite-compatible atlas.
- [ ] Godot pack / `.tres`.
- [ ] Phaser pack.
- [ ] Unity metadata.

## Rigging / animation

- [ ] Load body-part PNGs.
- [ ] Bone hierarchy editing.
- [ ] Part pivot / z-order / opacity / scale.
- [ ] Skeletal keyframe playback.
- [ ] Step / Linear / Ease interpolation.
- [ ] Two-bone IK target drag.
- [ ] IK min/max constraints.
- [ ] IK rotation locks.
- [ ] Mesh generation / weights / bind pose restore.

## Release metadata

- [ ] Bump `package.json` version.
- [ ] Update README current-status section.
- [ ] Update ROADMAP statuses.
- [ ] Add release notes.
- [ ] Select and add a license before declaring the project generally reusable/open-source.
