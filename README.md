# Sprite Sheet Studio

**Sprite Sheet Studio** is a local-first browser editor for turning sprite sheets, separate frames and layered 2D character parts into game-ready animation assets.

> **Upload → Slice → Fix → Animate → Rig → Export**

The project combines sprite slicing, cleanup, frame animation, local projects, game-engine exports, 2D rigging, skeletal keyframes, IK and mesh deformation in one static browser application.

## Highlights

- Fully client-side workflow — imported images stay in the browser.
- GitHub Pages compatible through **Deploy from a branch**.
- Regular grid slicing and irregular **Object Slice**.
- Smart cleanup for imperfect / AI-generated sprite sheets.
- Multi-animation projects with IndexedDB autosave.
- Full `.sss` project files including frame animations, rig assets and skeletal animation data.
- GIF / APNG / Animated WebP / atlas exports.
- Godot / Phaser / Unity-oriented exports.
- Bone rigging, skeletal animation, IK and mesh deformation MVP.
- Built-in runtime diagnostics and Playwright smoke tests.

---

## Import & slicing

- PNG / WebP import.
- Drag & drop.
- Clipboard paste.
- One sprite sheet or multiple separate frames.
- Natural filename sorting (`idle_01.png`, `idle_02.png`, ...).
- Manual rows / columns.
- Padding and spacing controls.
- Visual slicing grid.
- **Auto Slice** using transparent separators and grid regularity.
- Confidence feedback with manual fallback.
- Click individual source cells to include / exclude them from the timeline.
- **Object Slice** connected-component detection for irregular sheets:
  - transparent or flat backgrounds;
  - background tolerance;
  - minimum object size;
  - merge gap;
  - differently sized object bounds.

## Cleanup & alignment

- Trim transparent borders for the full animation.
- `Trim current` for one frame.
- Shared normalized canvas.
- Opaque-bounds diagnostics.
- Auto Align by:
  - feet / bottom center;
  - bounding-box center;
  - alpha-weighted center of mass;
  - custom per-frame anchors picked directly on the preview.
- Custom anchors can be copied to all frames and survive autosave / `.sss` round trips.
- **Before / After split preview** for cleanup operations.

## Frame animation editor

- Pixel-perfect preview.
- FPS control.
- Loop / Ping-pong / Once.
- Per-frame hold multiplier.
- Onion skin with adjustable opacity.
- **Multi-frame onion stack** with depth and opacity falloff.
- Timeline drag-to-reorder.
- Multi-select frames.
- Context menu.
- Duplicate / delete / reverse.
- Flip X / Flip Y.
- Rotate 90°.
- Pixel move.
- Crop current frame.
- Resize canvas.
- Nearest-neighbour ×2 / ×3 / ×4 scaling.
- Checkerboard / white / black / custom preview backgrounds.
- Rulers and guides.
- Snap to guides.
- Fullscreen workspace.

---

## Project System

A project can contain multiple named frame animations, for example:

```text
idle
walk
run
attack
death
```

Features:

- Multiple animation clips.
- Project and animation naming.
- Undo / Redo.
- IndexedDB autosave and restore.
- Export / import `.sss`.
- Custom frame anchors persist.
- Rig bones and body-part images persist.
- Skeletal animation clips and keyframes persist.
- Skeletal easing / Bezier settings persist.
- Keyboard shortcuts:
  - `Ctrl/Cmd + Z` — Undo;
  - `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` — Redo;
  - `Ctrl/Cmd + S` — export `.sss`.

---

## AI Sprite Sheet Fixer

The current fixer performs its base cleanup **locally without an AI API**.

It can:

- integrate Auto Slice;
- remove a safely detected flat background;
- use Object Slice as a local segmentation fallback;
- normalize canvases;
- Auto Align frames;
- detect suspicious character-size changes;
- flag abrupt silhouette changes;
- warn about poor loops;
- suggest Ping-pong when it is likely to loop better.

Optional generative repair / inpainting remains a future feature.

---

## Export

### Frame / animation formats

- Animated GIF.
- APNG.
- **Animated WebP**.
- Horizontal sprite sheet PNG.
- PNG sequence ZIP.

### Atlas / metadata

- Atlas PNG + JSON ZIP.
- Paged **Multi-atlas** for large projects with one JSON manifest.
- Engine-agnostic metadata JSON.
- Aseprite-compatible atlas JSON with `frameTags`.

### Godot

- PNG frames grouped by animation.
- Generated `SpriteFrames` `.tres`.
- FPS / loop / frame-hold data.

### Phaser

- Atlas PNG + JSON.
- Named animation/frame metadata.
- FPS / repeat / ping-pong information.

### Unity

- Sprite slicing / animation metadata JSON.
- **Unity package ZIP** with:
  - atlas PNG;
  - metadata JSON;
  - `Editor/SpriteSheetStudioImporter.cs`.

All exports are produced in the browser.

---

## Bone Rigging

Open **Rigging** from the top bar.

### Skeleton

- Root bone.
- Add / delete bones.
- Parent / child hierarchy.
- Bone offset / pivot.
- Rotation and length.
- Visibility.
- Mouse repositioning and endpoint manipulation.

### Sprite parts

- Load transparent PNG / WebP body parts.
- Bind a part to a bone.
- Pivot X / Y.
- Offset and rotation.
- Scale X / Scale Y.
- Z-order.
- Opacity.
- Visibility.
- Rig JSON export.

---

## Skeletal Animation

- Multiple skeletal animation clips.
- Bone position / rotation / length keyframes.
- Sprite position / rotation / scale / opacity / visibility keyframes.
- Timeline scrubbing and playback.
- Per-animation FPS and clip length.
- Looping.
- Step / Linear / Smooth Ease.
- Ease In / Ease Out presets.
- **Editable cubic-bezier interpolation** with `x1/y1/x2/y2` and curve preview.
- Copy / paste pose.
- Duplicate / mirror animation.
- Skeletal animation JSON export.

A track-oriented bone/property timeline is still planned.

---

## Inverse Kinematics

- Two-bone IK.
- Arm and leg chains.
- Draggable IK target.
- Bend / pole direction.
- Parent/end joint min/max rotation constraints.
- Independent rotation lock for either joint.
- IK pose can be captured as a skeletal keyframe.

Multiple simultaneous IK chains and dedicated pole-target objects are planned next.

---

## Mesh Deformation MVP

- Grid mesh over a sprite.
- Vertices / triangles.
- Automatic bone weights.
- Weight painting.
- Bone-driven skinning.
- Mesh preview.
- Restore bind pose.

The current implementation is an MVP. A more advanced WebGL/PixiJS path is planned for larger meshes and richer topology editing.

---

## Performance

- GIF quantization / encoding runs in a Web Worker.
- APNG compression / encoding runs in a Web Worker with fallback.
- Export progress indicators.
- Raw export-memory guards.
- Single-atlas dimension / pixel guard.
- Paged Multi-atlas for large projects.
- Compact timeline thumbnail backing canvases.
- Playback pauses when the browser tab is hidden.
- Generated Object URLs are cleaned up.

Animated WebP is available; its final muxing step currently runs on the main thread.

---

## Diagnostics and smoke tests

The top bar contains a **Diagnostics** button. It checks major runtime dependencies and feature modules, including:

- Canvas 2D;
- `createImageBitmap`;
- IndexedDB;
- Web Workers;
- `CompressionStream`;
- Project / Rig / Skeletal / IK bridges;
- local ZIP and GIF runtimes;
- export workers and modules;
- Object Slice;
- source-cell selection;
- cleanup comparison;
- onion stack;
- Animated WebP and Unity package exporters.

A JSON report can be exported from the dialog.

Quick Pages smoke check:

```text
?selftest=1
```

The repository also contains a Playwright smoke suite with real sprite fixtures.

---

## GitHub Pages

The repository is currently configured for:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/(root)`

Public path:

```text
https://deenfoool.github.io/sprite_sheet_studio/
```

The current Pages fallback does not depend on an external TypeScript compiler or third-party runtime CDN. It still performs local runtime source transformation; a committed production bundle generator has already been prepared, but the switch is intentionally postponed until bundle generation can be reliably executed and verified.

---

## Run locally

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run check
```

Browser smoke tests:

```bash
npm run test:install
npm run test:smoke
```

Production build:

```bash
npm run build
```

---

## Privacy

Imported sprites are decoded and processed in the browser. The main editor requires no account or backend.

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the live `DONE / PARTIAL / TODO` status.

Current focus:

1. release stabilization and committed Pages bundle;
2. cross-browser / accessibility pass;
3. track-oriented skeletal timeline and multi-chain IK;
4. mesh editor polish;
5. release versioning / changelog / license decision.

---

## Tech

- Vite.
- TypeScript.
- Canvas 2D.
- IndexedDB.
- Web Workers.
- `gifenc` bundled locally for Pages.
- Local ZIP writer.
- Playwright.
- ESLint / Prettier.
- GitHub Pages.

## License

A license has not been selected yet.
