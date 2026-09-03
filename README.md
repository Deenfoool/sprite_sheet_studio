# Sprite Sheet Studio

**Sprite Sheet Studio** is a local-first browser tool for turning sprite sheets and separate sprite frames into game-ready animations.

> Upload → Slice → Align → Animate → Export

## Current MVP

### Import & slicing

- PNG / WebP import
- Drag & drop and clipboard image paste
- Import a sprite sheet or multiple separate frames
- Manual rows / columns slicing
- Padding and spacing controls
- Visual slicing grid
- **Auto Slice** based on transparent separators and grid regularity

### Cleanup & alignment

- Transparent-edge trimming for the whole animation
- Auto Align with three anchor modes:
  - feet / bottom center
  - bounding-box center
  - alpha-weighted center of mass
- Automatic normalization to a shared canvas without cropping
- Opaque-bounds and transparency diagnostics

### Animation editor

- Pixel-perfect animation preview
- FPS control
- Loop and ping-pong playback
- **Per-frame hold multiplier** for longer or shorter poses
- **Onion skin** for previous / next frame with adjustable opacity
- Fit-to-preview control
- Timeline frame selection and drag-to-reorder
- Duplicate, delete and reverse frame tools
- Flip X / Flip Y / Rotate 90° for the current frame
- Keyboard navigation
- Per-frame hold duration is respected by live playback and GIF export

### Export

- Animated GIF
- Horizontal sprite sheet PNG
- PNG sequence ZIP
- Fully client-side image processing

## Auto Slice limitations

The current Auto Slice is intentionally conservative. It looks for transparent separator regions and regular spacing between sprite groups. It works best with sprite sheets that have a transparent background and clearly separated frames.

If a sheet has a solid background, overlapping frames, highly irregular placement, or no transparent gutters, use the manual grid controls. Future versions will add more advanced frame detection.

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

Imported images are decoded and processed in the browser. Sprite assets are not uploaded to a server by the application.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for advanced slicing, project files, engine exports, bone rigging, IK, mesh deformation and more.

## Tech

- Vite
- TypeScript
- Canvas 2D
- gifenc
- fflate
- GitHub Pages

## License

License has not been selected yet.
