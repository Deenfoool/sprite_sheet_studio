# Sprite Sheet Studio — Roadmap

Sprite Sheet Studio — local-first браузерный редактор для подготовки 2D-спрайтов, frame-анимации, skeletal animation и игровых экспортов.

> **Upload → Slice → Fix → Animate → Rig → Export**

Основной принцип: основной редактор должен работать без аккаунта и backend, а пользовательские изображения не должны покидать браузер.

## Статусы

- ✅ **DONE** — основная рабочая версия уже есть.
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

✅ Web Workers для тяжёлых export операций.

✅ Runtime Diagnostics / smoke checks прямо на Pages.

⬜ ESLint / Prettier и более строгий CI.

⬜ Нормальный committed production bundle без runtime TypeScript stripping.

### Главный архитектурный долг

Pages сейчас полностью автономен от CDN, но `page-loader.js` всё ещё преобразует `main-v2.ts` в браузере. Перед стабильным 1.0 это нужно заменить обычным production bundle, сохранив **Deploy from a branch**.

---

# Phase 1 — MVP: Sprite Sheet → Animation — ✅ DONE

✅ PNG / WebP.

✅ Drag & drop / clipboard.

✅ Несколько отдельных кадров.

✅ Natural filename sorting.

✅ Rows / columns / padding / spacing.

✅ Visual slicing grid.

✅ Timeline thumbnails / reorder / duplicate / delete / reverse.

✅ Multi-select / context menu.

✅ Play / Pause / FPS / Loop / Ping-pong / Once.

✅ Pixel-perfect zoom.

✅ Checker / white / black / **custom color preview background**.

✅ GIF / PNG sequence / sprite sheet PNG.

---

# Phase 2 — Smart Slicing — 🟡 PARTIAL

✅ Анализ прозрачных gutters.

✅ Auto Slice для регулярных transparent sheets.

✅ Авто rows / columns + confidence.

✅ Manual correction fallback.

✅ Natural sorting и frame normalization.

🟡 Bounding-box анализ уже используется в cleanup и diagnostics.

⬜ Connected-component/object detection для sheet без прозрачных разделителей.

⬜ Irregular cells с разным размером кадров.

---

# Phase 3 — Sprite Cleanup — 🟡 PARTIAL

✅ Trim transparent edges всей анимации.

✅ Shared normalized canvas.

✅ Opaque bounds diagnostics.

✅ Feet / bottom-center anchor.

✅ Bounding center.

✅ Center of mass.

✅ **Custom per-frame anchor**, выбираемый мышью на preview.

✅ Copy custom anchor to all.

✅ Custom-anchor Auto Align.

✅ Custom anchors сохраняются в autosave и `.sss`.

⬜ Before / after split preview.

⬜ Отдельная команда `Trim current frame` в Smart Tools (crop current уже есть в Advanced Tools).

---

# Phase 4 — Animation Editor — ✅ DONE

✅ Per-frame hold.

✅ Массовый hold.

✅ Previous / next onion skin + opacity.

✅ Flip X / Flip Y / Rotate 90°.

✅ Pixel move.

✅ Crop.

✅ Resize canvas.

✅ Nearest-neighbour scaling.

✅ Loop / Ping-pong / Once / Reverse.

✅ Keyboard navigation.

🟡 Multi-frame onion stack можно добавить позже.

---

# Phase 5 — Project System — ✅ DONE

✅ Несколько animation clips.

✅ Custom animation names.

✅ IndexedDB autosave / restore.

✅ Undo / Redo.

✅ `.sss` export / import.

✅ Project naming.

✅ Ctrl/Cmd shortcuts.

✅ Custom frame anchors входят в project persistence.

---

# Phase 6 — Extended Export — 🟡 PARTIAL

## Formats

✅ GIF.

✅ APNG.

✅ Sprite sheet PNG.

✅ PNG sequence ZIP.

✅ Atlas PNG + JSON.

✅ **Paged Multi-atlas PNG + manifest JSON** для больших проектов.

✅ Generic metadata JSON.

✅ Aseprite-compatible atlas JSON + `frameTags`.

⬜ Animated WebP.

## Engines

### Godot

✅ PNG frames по animations.

✅ `SpriteFrames` `.tres`.

✅ FPS / loop / hold metadata.

### Phaser

✅ Atlas PNG + JSON.

✅ Animation / frame names.

✅ FPS / repeat / ping-pong metadata.

### Unity

✅ Slicing / animation metadata helper JSON.

⬜ Генерируемый Unity Editor importer script/package.

---

# Phase 7 — Bone Rigging MVP — ✅ DONE

✅ Root / add / delete bones.

✅ Parent-child hierarchy.

✅ Offset / pivot / rotation / length / visibility.

✅ Mouse joint / endpoint manipulation.

✅ Import transparent sprite parts.

✅ Bind part to bone.

✅ Part pivot / offset / rotation.

✅ **Part Scale X / Scale Y**.

✅ Z-order / opacity / visibility.

✅ Rig JSON export.

---

# Phase 8 — Skeletal Animation — 🟡 PARTIAL

✅ Multiple skeletal animations.

✅ Bone position / rotation / length keyframes.

✅ Sprite position / rotation / **scale X/Y** / opacity / visibility keyframes.

✅ Timeline scrub / playback.

✅ FPS / clip length / loop.

✅ Step / Linear / Ease interpolation.

✅ Copy / paste pose.

✅ Duplicate / mirror animation.

✅ Skeletal animation library export.

⬜ Curve editor / Bezier easing.

⬜ Track-oriented timeline с отдельными bone/property lanes.

---

# Phase 9 — Inverse Kinematics — 🟡 PARTIAL

✅ Two-bone IK.

✅ Arm / leg chains.

✅ Draggable target.

✅ Bend direction.

✅ Min / max constraints.

✅ **Independent Lock Rotation** для parent/end joint.

✅ IK pose можно сохранить keyframe.

⬜ Multiple simultaneous IK chains.

⬜ Dedicated pole-target object.

⬜ Stretch mode / advanced unreachable-target behavior.

---

# Phase 10 — Mesh Deformation — 🟡 PARTIAL

✅ Grid mesh.

✅ Vertices / triangles.

✅ Auto bone weights.

✅ Weight painting MVP.

✅ Bone-driven deformation.

✅ Mesh preview.

✅ Restore bind pose.

⬜ WebGL/PixiJS renderer для больших mesh.

⬜ Better triangulation / topology editing.

⬜ Multi-bone weight normalization UI.

---

# Phase 11 — AI Sprite Sheet Fixer — ✅ MVP DONE

Базовый fixer работает полностью локально без AI API.

✅ Auto Slice integration.

✅ Flat-background cleanup при безопасном определении цвета.

✅ Normalize canvas / Auto Align.

✅ Size-change diagnostics.

✅ Silhouette-change diagnostics.

✅ Bad-loop warning.

✅ Ping-pong suggestion.

⬜ Optional generative repair / inpainting через AI API.

⬜ Similarity heatmap.

⬜ Broken / duplicate frame detection.

---

# Phase 12 — UX / Professional Tools — 🟡 PARTIAL

✅ Undo / Redo.

✅ Keyboard shortcuts.

✅ Multi-select frames.

✅ Context menu.

✅ Snap to guides.

✅ Rulers / guides.

✅ Fullscreen workspace.

✅ Dark responsive desktop-first UI.

✅ Custom preview background picker.

⬜ Named guide manager.

⬜ Custom shortcut editor.

⬜ Command palette.

⬜ Better touch/tablet editing.

---

# Phase 13 — Performance — 🟡 PARTIAL

✅ GIF encoding в Web Worker.

✅ **APNG encoding/compression в Web Worker** с fallback.

✅ Export progress.

✅ UI не блокируется основным GIF/APNG encode этапом.

✅ Raw memory guards.

✅ Single-atlas dimension/pixel guard.

✅ **Paged Multi-atlas** вместо отказа для больших проектов.

✅ Compact timeline thumbnail canvases.

✅ Playback pause при hidden tab.

✅ Object URL cleanup.

⬜ Animated WebP worker после появления стабильного encoder.

⬜ Lazy decoding очень больших sprite sheets.

⬜ Progressive preview для огромных изображений.

⬜ Общий RAM budget manager.

---

# Phase 14 — Optional Cloud Features — ⬜ TODO

Backend остаётся необязательным.

⬜ Accounts.

⬜ Cloud save.

⬜ Cross-device sync.

⬜ Shared projects.

⬜ Team collaboration.

⬜ Version history.

> Основной Sprite Sheet Studio должен оставаться полноценным без регистрации и без сервера.

---

# Phase 15 — Release Engineering — 🟡 STARTED

✅ Встроенный **Diagnostics** dialog.

✅ `?selftest=1` для быстрого smoke check опубликованного Pages.

✅ Проверки Canvas / IndexedDB / Worker / CompressionStream.

✅ Проверки local GIF / ZIP runtime.

✅ Проверки наличия worker/export assets.

✅ Export diagnostics report JSON.

⬜ Убрать runtime TypeScript stripping.

⬜ Настроить lint / formatting.

⬜ Automated browser smoke tests.

⬜ Test sprite fixtures.

⬜ Browser compatibility matrix.

⬜ Accessibility pass.

⬜ License.

⬜ Semantic versioning / CHANGELOG.

⬜ Release tags.

---

# Ближайший порядок работ

## Release 0.4 — Stabilization

1. Убрать runtime TypeScript stripping и сделать стабильный committed production bundle для `Deploy from a branch`.
2. Добавить automated browser smoke tests поверх уже существующего Diagnostics/selftest.
3. Добавить test sprite fixtures.
4. Сделать browser compatibility pass.
5. Добавить license/versioning/changelog.

## Release 0.5 — Rigging polish

1. Curve editor.
2. Multiple IK chains.
3. Better mesh editor.
4. Rig + skeletal library persistence внутри `.sss`.
5. Better rig/game-engine export.

## Release 1.0

Цель первого стабильного релиза:

- sprite sheet / frame workflow;
- cleanup / Auto Align / custom anchors;
- animation editor;
- local projects;
- GIF / APNG / PNG / atlas / multi-atlas exports;
- Godot / Phaser / Unity metadata;
- basic rigging + skeletal animation + IK + mesh MVP;
- stable GitHub Pages build;
- documented browser support;
- no mandatory backend.
