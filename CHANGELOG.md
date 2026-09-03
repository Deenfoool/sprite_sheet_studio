# Changelog

All notable changes to Sprite Sheet Studio will be documented in this file.

The project follows semantic-versioning intent while it is pre-1.0: minor versions may still contain breaking editor/runtime changes until a stable `1.0.0` release.

## [Unreleased]

### Added

- Accessibility runtime with skip link, live region, focus-visible treatment and reduced-motion support.
- Cross-browser Playwright projects for Chromium, Firefox and WebKit.
- Browser support / capability documentation.
- **Multiple simultaneous IK chains** with separate targets, enable states, bend settings, constraints and joint locks.
- Dedicated draggable IK pole targets.
- IK stretch / unreachable-target mode with rest lengths and configurable maximum stretch.
- Multi-chain IK persistence in local rig extras and full `.sss` projects.
- AI Fixer duplicate-frame detection, broken-frame suspects and similarity heatmap.
- **Track-oriented skeletal timeline** with bone/part property lanes, change-aware key markers, filters, zoom and click-to-scrub.
- **Advanced mesh topology editor** with Delaunay retriangulation, manual triangle editing and vertex inspector.
- Mesh influence pruning and multi-bone weight normalization UI.
- Mesh topology / weights / bind-pose persistence inside full `.sss` projects and IndexedDB rig extras.
- **Command Palette (`Ctrl/Cmd + K`)** with fuzzy search and context-aware commands.
- **Named Guide Manager** with unlimited persistent X/Y guides.
- **Custom Shortcut Editor** with user-defined local keyboard bindings.
- Organized brand assets under `assets/brand` and app icons under `assets/icons`.
- Lucide icons as progressive enhancement with text fallback.
- Smoke coverage for branding, advanced IK, AI Fixer, mesh topology/persistence, skeletal tracks, Command Palette, Named Guides and Custom Shortcuts.

### Changed

- Browser smoke tests treat Animated WebP as a capability-dependent feature.
- Runtime diagnostics now cover accessibility, easing persistence, advanced IK, AI Fixer, skeletal tracks, mesh topology/persistence, professional UX modules and brand assets.
- Rigging uses a multi-chain IK manager instead of one global IK target.
- Full `.sss` extras format advanced to version 3 to include mesh data.
- Repository root no longer contains loose logo/favicon files; assets are grouped by purpose.

### Pending

- Replace the Pages runtime TypeScript stripping path with a verified committed production bundle.
- Execute and record the full Chromium / Firefox / WebKit browser matrix for a release candidate.
- Add better rig/game-engine skeletal export.
- Add WebGL/PixiJS rendering for heavy meshes.
- Add better touch/tablet editing.
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
- WebGL/PixiJS mesh rendering is not implemented yet.
- GitHub Actions are not currently producing workflow runs in this repository.
