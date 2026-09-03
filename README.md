# Sprite Sheet Studio

**Sprite Sheet Studio** is a local-first browser tool for turning sprite sheets and separate sprite frames into game-ready animations.

> Upload → Slice → Animate → Export

## Current MVP

- PNG / WebP import
- Drag & drop and clipboard image paste
- Import a sprite sheet or multiple separate frames
- Manual rows / columns slicing
- Padding and spacing controls
- Visual slicing grid
- Pixel-perfect animation preview
- FPS control
- Loop and ping-pong playback
- Timeline frame selection and drag-to-reorder
- Duplicate, delete and reverse frame tools
- GIF export
- Horizontal sprite sheet PNG export
- PNG sequence ZIP export
- Fully client-side image processing
- Responsive dark editor UI

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

See [ROADMAP.md](./ROADMAP.md) for Auto Slice, Auto Align, anchor points, animation editing, engine exports, bone rigging, IK, mesh deformation and more.

## Tech

- Vite
- TypeScript
- Canvas 2D
- gifenc
- fflate
- GitHub Pages

## License

License has not been selected yet.
