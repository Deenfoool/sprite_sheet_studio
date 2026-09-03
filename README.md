# Sprite Sheet Studio

**Sprite Sheet Studio** is a local-first browser editor for turning sprite sheets, separate frames and layered 2D character parts into game-ready animation assets.

> **Upload → Slice → Fix → Animate → Rig → Export**

The project has moved far beyond the original GIF-converter MVP. It now combines frame animation, sprite cleanup, local projects, engine exports, 2D rigging, skeletal keyframes, IK and mesh deformation in one static browser application.

## Highlights

- Fully client-side workflow — sprite images are not uploaded to an application server.
- Works on GitHub Pages using **Deploy from a branch**.
- Sprite-sheet and separate-frame workflows.
- Smart cleanup for AI-generated sprite sheets.
- Multi-animation projects with autosave.
- Game-engine-oriented export.
- Bone rigging, skeletal animation, IK and basic mesh skinning.
- Built-in runtime diagnostics for release smoke checks.

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

## Cleanup & alignment

- Trim transparent borders.
- Shared normalized canvas.
- Opaque-bounds diagnostics.
- Auto Align by:
  - feet / bottom center;
  - bounding-box center;
  - alpha-weighted center of mass;
  - **custom per-frame anchor points** picked directly on the preview.
- Custom anchors can be copied to all frames and are persisted in project autosave / `.sss` files.

## Frame animation editor

- Pixel-perfect animation preview.
- FPS control.
- Loop / Ping-pong / Once.
- Per-frame hold multiplier.
- Onion skin with adjustable opacity.
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
- Checkerboard / white / black preview backgrounds.
- **Custom preview background color** with a color picker.
- Rulers and guides.
- Snap to guides.
- Fullscreen workspace.

---

## Project System

A single project can contain multiple named animations such as:

```text
idle
walk
run
attack
death
custom-animation
```

Features:

- Multiple animation clips.
- Custom animation names.
- Project naming.
- Undo / Redo.
- IndexedDB autosave.
- Automatic restore of the last local project.
- Export project as `.sss`.
- Import `.sss`.
- Custom frame anchors survive autosave and `.sss` round trips.
- Keyboard shortcuts:
  - `Ctrl/Cmd + Z` — Undo;
  - `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` — Redo;
  - `Ctrl/Cmd + S` — export `.sss`.

---

## AI Sprite Sheet Fixer

The current fixer intentionally performs its basic work **locally without an AI API**.

It can:

- integrate Auto Slice;
- remove a safely detected flat background;
- normalize canvases;
- Auto Align frames;
- detect suspicious character-size changes;
- flag abrupt silhouette changes;
- warn about a poor animation loop;
- suggest Ping-pong when it is likely to loop better.

This is especially useful for sprite sheets produced by generative image models where the subject shifts slightly between frames.

---

## Export

### Frame / animation formats

- Animated GIF.
- **APNG**.
- Horizontal sprite sheet PNG.
- PNG sequence ZIP.

### Atlas / metadata

- Atlas PNG + JSON ZIP.
- **Paged Multi-atlas** for large projects, with one JSON manifest mapping every frame to its atlas page.
- Engine-agnostic animation metadata JSON.
- **Aseprite-compatible atlas JSON with `frameTags`**.

### Godot

- PNG frames grouped by animation.
- Generated `SpriteFrames` `.tres`.
- FPS / loop / frame-hold data.

### Phaser

- Atlas PNG + JSON.
- Named animation/frame metadata.
- FPS / repeat / ping-pong information.

### Unity

- Sprite slicing / animation metadata helper JSON.

All exports are produced in the browser.

---

## Bone Rigging

Open the **Rigging** workspace from the top bar.

### Skeleton

- Root bone.
- Add / delete bones.
- Parent / child hierarchy.
- Bone offset / pivot.
- Rotation.
- Bone length.
- Visibility.
- Mouse repositioning and endpoint manipulation.

### Sprite parts

- Load transparent PNG / WebP character parts.
- Bind a sprite part to a bone.
- Part pivot X / Y.
- Offset and rotation.
- **Scale X / Scale Y**.
- Z-order.
- Opacity.
- Visibility.
- Rig JSON export.

---

## Skeletal Animation

- Multiple skeletal animation clips.
- Bone position / rotation / length keyframes.
- Sprite position / rotation / **scale** / opacity / visibility keyframes.
- Timeline scrubbing and playback.
- Per-animation FPS and clip length.
- Looping.
- Step interpolation.
- Linear interpolation.
- Ease in/out interpolation.
- Copy / paste pose.
- Duplicate animation.
- Mirror animation.
- Skeletal animation library JSON export.

---

## Inverse Kinematics

- Two-bone IK.
- Arm and leg chains.
- Draggable IK target.
- Bend / pole direction.
- Parent-joint min/max rotation constraints.
- End-joint min/max rotation constraints.
- **Independent rotation lock** for the parent or end joint.
- IK result can be captured as a skeletal keyframe.

---

## Mesh Deformation MVP

- Grid mesh over a sprite.
- Vertices / triangles.
- Automatic bone weights.
- Weight painting.
- Bone-driven skinning.
- Mesh preview.
- Restore bind pose.

This is still an MVP and currently uses the browser-oriented rendering path. A more advanced WebGL/PixiJS implementation is planned for larger meshes.

---

## Performance

- GIF quantization / encoding runs in a **Web Worker**.
- APNG compression / encoding runs in a **Web Worker** with a main-thread fallback.
- GIF / APNG progress indicators.
- Raw export-memory guards.
- Single-atlas dimension / pixel guard.
- **Paged Multi-atlas** instead of forcing huge projects into one unsafe browser canvas.
- Timeline thumbnail backing canvases are compacted instead of retaining full-size frame canvases.
- Playback pauses when the browser tab is hidden.
- Generated Object URLs are cleaned up.

---

## Diagnostics / smoke checks

The top bar contains a **Diagnostics** button. It checks the major runtime dependencies used by the branch-deployed site:

- Canvas 2D;
- `createImageBitmap`;
- IndexedDB;
- Web Workers;
- `CompressionStream` for APNG;
- Project / Rig / IK runtime bridges;
- local ZIP writer;
- local GIF encoder;
- GIF and APNG worker assets;
- Pages loader and important export modules.

A JSON report can be exported from the diagnostics dialog.

For a quick Pages smoke check, open the site with:

```text
?selftest=1
```

The diagnostics panel will open automatically after the editor starts.

---

## Auto Slice limitations

Auto Slice is intentionally conservative. It works best when frames are separated by transparent gutters.

A sheet with a solid background, overlapping sprites, highly irregular placement or different cell sizes may still need manual grid settings. The AI Fixer can remove some simple flat backgrounds before slicing, but it is not a general segmentation model.

---

## GitHub Pages

The repository is prepared for **Deploy from a branch**:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/(root)`

The Pages runtime does not require a TypeScript compiler or third-party module CDN at startup.

Current public path:

```text
https://deenfoool.github.io/sprite_sheet_studio/
```

---

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The long-term release plan is to replace the current branch-runtime source transformation with a committed production bundle while keeping GitHub Pages in branch-deploy mode.

---

## Privacy

Imported sprites are decoded and processed in the browser. The application does not require an account or backend for its main editor workflow.

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the live `DONE / PARTIAL / TODO` status of every phase.

Current focus:

1. release stabilization and browser smoke testing;
2. removing runtime TypeScript stripping from the Pages path;
3. rigging / mesh polish;
4. remaining performance work;
5. release engineering and versioning.

---

## Tech

- Vite.
- TypeScript.
- Canvas 2D.
- IndexedDB.
- Web Workers.
- `gifenc` bundled locally for Pages.
- Local ZIP writer.
- GitHub Pages.

## License

License has not been selected yet.
