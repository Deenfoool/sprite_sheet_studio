# Sprite Sheet Studio — Roadmap

Sprite Sheet Studio — local-first браузерный редактор для подготовки 2D-спрайтов, frame-анимации, skeletal animation и игровых экспортов.

> **Upload → Slice → Fix → Animate → Rig → Export**

Основной принцип проекта не меняется: базовый редактор должен работать без аккаунта и backend, а пользовательские изображения не должны покидать браузер.

## Статусы

- ✅ **DONE** — основная рабочая версия функции уже есть.
- 🟡 **PARTIAL** — рабочая база есть, но нужны улучшения.
- ⬜ **TODO** — ещё не реализовано.

---

# Phase 0 — Foundation — 🟡 PARTIAL

✅ Vite + TypeScript.

✅ Vanilla TypeScript / Canvas 2D editor.

✅ GitHub Pages через `main / (root)`.

✅ Client-side image processing.

✅ Drag & drop / clipboard import.

✅ IndexedDB storage.

✅ Web Worker для тяжёлого GIF encoding.

⬜ ESLint / Prettier и более строгий CI.

⬜ Разделение большого runtime на нормальный production bundle без runtime TS stripping.

### Следующий архитектурный долг

Текущий Pages runtime специально работает без GitHub Actions и внешних CDN, но для долгосрочного развития нужно убрать runtime-трансформацию `main-v2.ts` и перейти на committed production bundle либо отдельную publish-ветку.

---

# Phase 1 — MVP: Sprite Sheet → Animation — ✅ DONE

## Import

✅ PNG / WebP.

✅ Drag & drop.

✅ Clipboard paste.

✅ Несколько отдельных кадров.

✅ Natural filename sorting.

## Slice

✅ Rows / columns.

✅ Padding / spacing.

✅ Visual grid.

✅ Ручная корректировка сетки.

## Timeline

✅ Frame thumbnails.

✅ Drag reorder.

✅ Delete / duplicate / reverse.

✅ Multi-select.

✅ Context menu.

## Preview

✅ Play / Pause.

✅ FPS.

✅ Loop / Ping-pong / Once.

✅ Pixel-perfect scaling.

✅ Zoom.

✅ Checker / white / black background.

## MVP Export

✅ Animated GIF.

✅ PNG sequence ZIP.

✅ Sprite sheet PNG.

---

# Phase 2 — Smart Slicing — 🟡 PARTIAL

✅ Анализ прозрачных разделителей.

✅ Auto Slice для регулярных transparent sheets.

✅ Автоматическое определение rows / columns.

✅ Confidence результата.

✅ Manual fallback.

✅ Natural sorting отдельных файлов.

✅ Общая нормализация кадров.

🟡 Bounding-box анализ используется в cleanup/diagnostics, но detection ещё можно сделать умнее.

⬜ Продвинутый object/component detection для sheet без прозрачных gutters.

⬜ Детект irregular sheets с разным размером ячеек.

---

# Phase 3 — Sprite Cleanup — 🟡 PARTIAL

## Trim / Normalize

✅ Trim transparent edges для всей анимации.

✅ Shared normalized canvas.

✅ Сохранение исходных opaque pixels без resampling.

✅ Opaque bounds diagnostics.

## Anchor / Auto Align

✅ Feet / bottom-center.

✅ Bounding center.

✅ Alpha-weighted center of mass.

✅ Auto Align всей анимации.

⬜ Пользовательский anchor, который можно поставить мышью.

⬜ Before / after split preview.

⬜ Dedicated `Trim current frame` command.

---

# Phase 4 — Animation Editor — ✅ DONE

✅ Per-frame hold / duration multiplier.

✅ Массовый hold.

✅ Previous / next onion skin.

✅ Onion opacity.

✅ Flip X / Flip Y.

✅ Rotate 90°.

✅ Pixel move.

✅ Crop.

✅ Resize canvas.

✅ Nearest-neighbour scaling.

✅ Loop / Ping-pong / Once / Reverse.

✅ Keyboard navigation.

🟡 Onion skin пока ограничен ближайшими соседями; multi-frame onion stack можно улучшить позже.

---

# Phase 5 — Project System — ✅ DONE

✅ Несколько animation clips в одном проекте.

✅ `idle / walk / run / attack / death` и любые custom names.

✅ IndexedDB.

✅ Autosave.

✅ Automatic restore.

✅ Undo / Redo.

✅ `.sss` project export.

✅ `.sss` project import.

✅ Project naming.

✅ Ctrl/Cmd shortcuts.

---

# Phase 6 — Extended Export — 🟡 PARTIAL

## Formats

✅ GIF.

✅ APNG.

✅ Sprite sheet PNG.

✅ PNG sequence ZIP.

✅ Atlas PNG + JSON.

✅ Generic animation metadata JSON.

✅ Aseprite-compatible atlas JSON + `frameTags`.

⬜ Animated WebP.

## Engines

### Godot

✅ PNG frames grouped by animation.

✅ `SpriteFrames` compatible `.tres`.

✅ FPS / loop / frame hold metadata.

### Phaser

✅ Atlas PNG + JSON.

✅ Animation names / frame names.

✅ FPS / repeat / ping-pong metadata.

### Unity

✅ Slicing / animation metadata helper JSON.

🟡 Unity package/importer editor script ещё не генерируется автоматически.

### Generic

✅ Engine-agnostic JSON.

✅ Aseprite-compatible JSON.

---

# Phase 7 — Bone Rigging MVP — ✅ DONE

✅ Root bone.

✅ Add / delete bones.

✅ Parent / child hierarchy.

✅ Bone offset / pivot.

✅ Rotation.

✅ Bone length.

✅ Visibility.

✅ Mouse reposition / endpoint manipulation.

✅ Import transparent character parts.

✅ Bind sprite part to bone.

✅ Part pivot / offset / rotation.

✅ Z-order.

✅ Opacity / visibility.

✅ Rig JSON export.

---

# Phase 8 — Skeletal Animation — 🟡 PARTIAL

✅ Multiple skeletal animations.

✅ Bone position / rotation keyframes.

✅ Bone length keyframes.

✅ Sprite position / rotation / opacity / visibility keyframes.

✅ Timeline scrub / playback.

✅ FPS / clip length / loop.

✅ Step interpolation.

✅ Linear interpolation.

✅ Ease in/out interpolation.

✅ Copy / paste pose.

✅ Duplicate animation.

✅ Mirror animation.

✅ Skeletal animation library export.

⬜ Полноценные independent X/Y scale keyframes для каждой bone/part.

⬜ Curve editor / Bezier easing.

---

# Phase 9 — Inverse Kinematics — 🟡 PARTIAL

✅ Two-bone IK.

✅ Arm and leg chains.

✅ Draggable IK target.

✅ Bend / pole direction.

✅ Parent and end-joint min/max rotation constraints.

✅ IK pose можно сохранить keyframe.

⬜ Explicit lock-rotation toggle.

⬜ Multiple simultaneous IK chains.

⬜ Advanced pole target object.

⬜ Better unreachable-target handling / stretch modes.

---

# Phase 10 — Mesh Deformation — 🟡 PARTIAL

✅ Grid mesh over sprite.

✅ Vertices / triangles.

✅ Auto bone weights.

✅ Weight painting MVP.

✅ Bone-driven skinning.

✅ Mesh preview.

✅ Restore bind pose.

🟡 Сейчас это browser Canvas-oriented MVP.

⬜ WebGL/PixiJS renderer для больших mesh.

⬜ Better triangulation.

⬜ Multi-bone weight normalization UI.

⬜ Mesh topology editing tools.

---

# Phase 11 — AI Sprite Sheet Fixer — ✅ MVP DONE

Все базовые функции работают локально, без AI API.

✅ Auto Slice integration.

✅ Background cleanup для безопасно определяемого однотонного фона.

✅ Normalize canvas.

✅ Auto Align.

✅ Detection резких изменений размера персонажа.

✅ Silhouette-change diagnostics.

✅ Loop-quality warning.

✅ Ping-pong suggestion.

⬜ Optional generative repair / inpainting через AI API.

⬜ Frame similarity heatmap.

⬜ Automatic duplicate / broken-frame detection.

---

# Phase 12 — UX / Professional Tools — 🟡 PARTIAL

✅ Undo / Redo.

✅ Keyboard shortcuts.

✅ Multi-select frames.

✅ Context menu.

✅ Pixel-oriented transforms.

✅ Snap to guides.

✅ Rulers.

✅ Guides.

✅ Fullscreen workspace.

✅ Dark UI.

✅ Responsive layout.

✅ Desktop-first workspace.

⬜ Named guides / guide manager.

⬜ Custom shortcut editor.

⬜ Command palette.

⬜ Better touch/tablet editing.

---

# Phase 13 — Performance — 🟡 PARTIAL

✅ GIF quantization / encoding в Web Worker.

✅ Export progress.

✅ UI остаётся доступным во время worker encoding.

✅ Ограничение raw-memory для GIF.

✅ Atlas dimension / pixel guard.

✅ Timeline thumbnail backing canvases уменьшаются до реального thumbnail size.

✅ Playback останавливается, когда вкладка скрыта.

✅ Object URL cleanup для generated downloads/runtime blobs.

⬜ Worker для APNG.

⬜ Worker для Animated WebP после появления WebP encoder.

⬜ Lazy decoding очень больших sprite sheets.

⬜ Paged / multi-atlas export вместо отказа для огромного atlas.

⬜ Progressive preview для огромных изображений.

⬜ Более строгий общий RAM budget manager.

---

# Phase 14 — Optional Cloud Features — ⬜ TODO

Backend остаётся **необязательным**.

⬜ Accounts.

⬜ Cloud save.

⬜ Cross-device sync.

⬜ Shared projects.

⬜ Team collaboration.

⬜ Version history.

Принцип:

> Основной Sprite Sheet Studio должен оставаться полноценным без регистрации и без сервера.

---

# Phase 15 — Release Engineering — ⬜ TODO

Этого блока не было в первоначальном roadmap, но он нужен перед публичным релизом.

⬜ Нормальный production build для branch-based Pages без runtime TypeScript stripping.

⬜ Automated smoke tests.

⬜ Test sprite fixtures.

⬜ Browser compatibility matrix.

⬜ Error boundary / diagnostics export.

⬜ Performance benchmark fixtures.

⬜ Accessibility pass.

⬜ License.

⬜ Versioning / changelog.

⬜ Release tags.

---

# Ближайший порядок работ

## Release 0.4 — Stabilization

1. Убрать runtime TypeScript stripping и сделать стабильный production bundle для `Deploy from a branch`.
2. Добавить smoke tests для загрузки, playback и каждого export.
3. Сделать multi-atlas export для больших проектов.
4. Добавить custom anchor.
5. Довести IK constraints.
6. Добавить Animated WebP, если browser-side encoder будет достаточно надёжным.

## Release 0.5 — Rigging polish

1. Scale keyframes.
2. Curve editor.
3. Multiple IK chains.
4. Better mesh editor.
5. Rig/project integration в `.sss`.

## Release 1.0

Цель первого стабильного релиза:

- sprite sheet / frame workflow;
- cleanup / Auto Align;
- animation editor;
- local projects;
- GIF / APNG / PNG / atlas exports;
- Godot / Phaser / Unity metadata;
- basic rigging + skeletal animation + IK;
- stable GitHub Pages build;
- no mandatory backend;
- documented limits and tested browser support.
