# Sprite Sheet Studio

**Sprite Sheet Studio** is a local-first browser tool for turning sprite sheets, separate frames and layered 2D character parts into game-ready animation assets.

> Upload → Slice → Align → Animate → Rig → Export

## Current status

The project has moved beyond the original MVP. The browser editor now covers frame animation, local projects, engine-oriented export, bone rigging, skeletal keyframes and two-bone IK.

### Import & slicing

- PNG / WebP import
- Drag & drop and clipboard image paste
- Sprite sheet or multiple separate frames
- Manual rows / columns slicing
- Padding and spacing controls
- Visual slicing grid
- Auto Slice based on transparent separators and grid regularity
- Natural sorting for separate frame files

### Cleanup & frame editor

- Transparent-edge trim
- Auto Align by feet / bottom center, bounding center or alpha-weighted center of mass
- Shared normalized canvas
- Opaque-bounds diagnostics
- Per-frame hold multiplier
- Onion skin with adjustable opacity
- Flip X / Flip Y / Rotate 90°
- Pixel-perfect one-pixel move
- Crop current frame
- Resize canvas
- Nearest-neighbour ×2 / ×3 / ×4 scaling
- Apply current hold to all frames
- Loop / ping-pong / once playback

### Project System

- Multiple named animations in one project
- Suggested animation workflow: `idle`, `walk`, `run`, `attack`, `death`
- Custom animation names
- Undo / Redo
- IndexedDB autosave
- Automatic restore of the last project
- Export project as `.sss`
- Import `.sss`
- Project naming
- Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+S shortcuts

### Export

Frame exports:

- Animated GIF
- Horizontal sprite sheet PNG
- PNG sequence ZIP

Extended / engine exports:

- Atlas PNG + JSON ZIP
- Engine-agnostic animation metadata JSON
- Godot pack with PNG frames and `SpriteFrames` `.tres`
- Phaser atlas PNG + JSON pack
- Unity slicing / animation metadata JSON

All export processing remains client-side.

### Bone Rigging MVP

Open the **Rigging** workspace from the top bar.

- Root bone
- Add / delete bones
- Parent / child hierarchy
- Bone offset
- Bone rotation
- Bone length
- Bone visibility
- Drag bone joints to reposition them
- Drag bone endpoints to rotate and resize bones
- Load multiple transparent PNG / WebP character parts
- Bind a sprite part to a bone
- Part offset and rotation
- Part pivot X / Y
- Z-order
- Opacity
- Visibility
- Export rig JSON

### Skeletal Animation

Inside the Rigging workspace:

- Multiple skeletal animations
- Bone position / rotation / length keyframes
- Sprite position / rotation / opacity / visibility keyframes
- Timeline scrubbing
- Playback
- Per-animation FPS and length
- Looping
- Step interpolation
- Linear interpolation
- Ease in/out interpolation
- Copy / paste poses
- Duplicate animation
- Mirror animation
- Export skeletal animation library JSON

### Inverse Kinematics

- Two-bone IK chains
- Typical chains: shoulder → forearm and thigh → shin
- Draggable IK target
- Bend / pole direction
- Parent-joint min/max rotation constraints
- End-joint min/max rotation constraints
- IK result can be captured as a skeletal keyframe

## Auto Slice limitations

Auto Slice is intentionally conservative. It works best with transparent sprite sheets that have clearly separated frames. Sheets with solid backgrounds, overlapping sprites or highly irregular placement may still require the manual grid.

## GitHub Pages

The repository is prepared for **Deploy from a branch** mode:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/(root)`

The Pages runtime does not require a TypeScript compiler or external module CDN at startup.

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Privacy

Imported sprites are decoded and processed in the browser. Sprite assets are not uploaded to a server by the application.

## Roadmap

See [ROADMAP.md](./ROADMAP.md). The next major area is mesh deformation / skinning, followed by AI-oriented sprite-sheet diagnostics and further professional editor tooling.

## Tech

- Vite
- TypeScript
- Canvas 2D
- IndexedDB
- gifenc
- local ZIP writer
- GitHub Pages

## License

License has not been selected yet.
