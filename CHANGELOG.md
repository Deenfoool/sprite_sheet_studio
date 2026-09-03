# Changelog

All notable changes to Sprite Sheet Studio will be documented in this file.

The project follows semantic-versioning intent while it is pre-1.0: minor versions may still contain breaking editor/runtime changes until a stable `1.0.0` release.

## [Unreleased]

### Added

- Accessibility runtime with skip link, live region, focus-visible treatment and reduced-motion support.
- Cross-browser Playwright projects for Chromium, Firefox and WebKit.
- Browser support / capability documentation.
- **Multiple simultaneous IK chains** with separate targets, enable states, bend settings, constraints and joint locks.
- Multi-chain IK persistence in local rig extras and full `.sss` projects.
- Smoke coverage for multi-chain IK and IK project persistence.

### Changed

- Browser smoke tests now treat Animated WebP as a capability-dependent feature.
- Runtime diagnostics include accessibility, easing-persistence and WebP capability checks.
- Rigging roadmap now treats one global IK target as legacy behavior; the editor uses a chain manager instead.

### Pending

- Replace the Pages runtime TypeScript stripping path with a verified committed production bundle.
- Execute and record the full three-engine browser matrix for a release candidate.
- Add dedicated IK pole targets and stretch/unreachable-target modes.
- License decision before stable public release.

## [0.4.0-dev.1] - 2026-09-03

### Added

#### Smart slicing and cleanup

- Transparent-gutter Auto Slice with confidence feedback.
- Connected-component **Object Slice** for irregular sheets.
- Flat-background object detection with tolerance controls.
- Source grid cell include/exclude workflow.
- Trim transparent pixels for all frames and current frame.
- Auto Align by feet, center, center of mass and custom anchors.
- Custom per-frame anchor picking and persistence.
- Before / After cleanup split preview.

#### Animation editor

- Per-frame hold durations.
- Onion skin and multi-frame onion stack.
- Pixel movement, crop, resize canvas and nearest-neighbour scaling.
- Flip X/Y and 90° rotation.
- Loop, Ping-pong and Once playback.
- Multi-select, context menu, guides, snapping and fullscreen editing.

#### Project system

- Multiple named frame-animation clips.
- Undo / Redo.
- IndexedDB autosave and restore.
- `.sss` project import/export.
- Full-project persistence for custom anchors, rig assets and skeletal animation data.

#### Export

- Animated GIF.
- APNG.
- Animated WebP using local RIFF/ANIM/ANMF muxing.
- PNG sequence ZIP.
- Sprite sheet PNG.
- Atlas PNG + JSON.
- Paged Multi-atlas export.
- Aseprite-compatible atlas JSON with `frameTags`.
- Godot `SpriteFrames.tres` export.
- Phaser atlas/animation metadata.
- Unity metadata and Unity package ZIP with editor importer script.

#### Rigging and skeletal animation

- Bone hierarchy and sprite-part attachment workspace.
- Position, rotation, length and visibility controls.
- Part pivot, scale, Z-order and opacity.
- Skeletal keyframes and multiple clips.
- Step, Linear, Ease In/Out and editable cubic-bezier interpolation.
- Two-bone IK with constraints and independent joint rotation locks.
- Grid mesh deformation, automatic weights and weight-painting MVP.

#### Performance and release tooling

- GIF Web Worker encoding.
- APNG Web Worker encoding with fallback.
- Export progress and memory guards.
- Compact timeline thumbnails.
- Runtime Diagnostics and `?selftest=1`.
- Playwright smoke suite with real sprite fixtures.
- ESLint / Prettier configuration.
- `npm run check` quality command.
- Committed runtime bundle generator and workflow scaffolding.

### Known technical debt

- The published Pages fallback still performs local runtime transformation of `main-v2.ts`.
- Track-oriented skeletal property lanes are not implemented yet.
- Dedicated IK pole targets / stretch behavior are not implemented yet.
- Mesh editing remains an MVP Canvas-oriented workflow.
