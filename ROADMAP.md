# Sprite Sheet Studio — Roadmap

Sprite Sheet Studio — local-first браузерный редактор для подготовки 2D-спрайтов, frame-анимации, skeletal animation и игровых экспортов.

> **Upload → Slice → Fix → Animate → Rig → Export**

Основной принцип: основной редактор должен работать без аккаунта и backend, а пользовательские изображения не должны покидать браузер.

## Статусы

- ✅ **DONE** — основная рабочая версия функции уже есть.
- 🟡 **PARTIAL** — рабочая база есть, но нужны улучшения.
- ⬜ **TODO** — ещё не реализовано.

---

# Phase 0 — Foundation — 🟡 PARTIAL

✅ Vite + TypeScript.

✅ Vanilla TypeScript / Canvas 2D editor.

✅ GitHub Pages через `main / (root)` и **Deploy from a branch**.

✅ Client-side image processing.

✅ Drag & drop / clipboard import.

✅ IndexedDB storage.

✅ Web Workers для тяжёлых export операций.

✅ Runtime Diagnostics / smoke checks прямо на Pages.

✅ ESLint / Prettier configuration.

✅ `npm run check` для typecheck + lint + format check.

✅ Playwright browser smoke suite и test fixtures.

✅ Playwright projects для Chromium / Firefox / WebKit.

✅ Брендовые assets разложены по `assets/brand` / `assets/icons` и реально используются сайтом.

✅ Lucide Icons подключены как progressive enhancement с текстовым fallback.

🟡 Генератор committed runtime bundle и workflow подготовлены, но GitHub Actions в репозитории пока не запускаются.

⬜ Переключить production Pages с runtime TypeScript stripping на подтверждённый committed bundle.

### Главный архитектурный долг

Текущий Pages runtime полностью автономен от обязательных CDN-зависимостей приложения, но `page-loader.js` всё ещё преобразует `main-v2.ts` в браузере. Генератор bundle уже подготовлен; переключение будет сделано только после появления надёжного способа собирать и проверять committed bundle без риска снова уронить Pages.

---

# Phase 1 — MVP: Sprite Sheet → Animation — ✅ DONE

✅ PNG / WebP import.

✅ Drag & drop / clipboard.

✅ Несколько отдельных кадров.

✅ Natural filename sorting.

✅ Rows / columns / padding / spacing.

✅ Visual slicing grid.

✅ Timeline thumbnails / reorder / duplicate / delete / reverse.

✅ Multi-select / context menu.

✅ Play / Pause / FPS / Loop / Ping-pong / Once.

✅ Pixel-perfect zoom.

✅ Checker / white / black / custom preview background.

✅ GIF / PNG sequence / sprite sheet PNG.

---

# Phase 2 — Smart Slicing — ✅ DONE

✅ Анализ transparent gutters.

✅ Auto Slice для регулярных transparent sheets.

✅ Авто rows / columns + confidence.

✅ Manual correction fallback.

✅ Bounding-box analysis.

✅ Source-cell selection: отдельные grid cells можно включать/исключать кликом по исходному листу.

✅ Connected-component **Object Slice** для листов без прозрачной сетки.

✅ Transparent-background object detection.

✅ Flat-background object detection с настраиваемым tolerance.

✅ Irregular object bounds / кадры разного размера.

✅ Merge gap / minimum object size controls.

---

# Phase 3 — Sprite Cleanup — ✅ DONE

✅ Trim transparent edges всей анимации.

✅ `Trim current` в Smart Tools.

✅ Shared normalized canvas.

✅ Opaque bounds diagnostics.

✅ Feet / bottom-center anchor.

✅ Bounding center.

✅ Center of mass.

✅ Custom per-frame anchor, выбираемый мышью на preview.

✅ Copy custom anchor to all.

✅ Custom-anchor Auto Align.

✅ Custom anchors сохраняются в autosave и `.sss`.

✅ **Before / After split preview** после Trim / Auto Align.

---

# Phase 4 — Animation Editor — ✅ DONE

✅ Per-frame hold.

✅ Массовый hold.

✅ Previous / next onion skin + opacity.

✅ Multi-frame onion stack до нескольких соседних кадров с opacity falloff.

✅ Flip X / Flip Y / Rotate 90°.

✅ Pixel move.

✅ Crop.

✅ Resize canvas.

✅ Nearest-neighbour scaling.

✅ Loop / Ping-pong / Once / Reverse.

✅ Keyboard navigation.

---

# Phase 5 — Project System — ✅ DONE

✅ Несколько frame animation clips.

✅ Custom animation names.

✅ IndexedDB autosave / restore.

✅ Undo / Redo.

✅ `.sss` export / import.

✅ Project naming.

✅ Ctrl/Cmd shortcuts.

✅ Custom frame anchors в project persistence.

✅ Rig body-part images в полном `.sss`.

✅ Skeletal animation library в полном `.sss`.

✅ Skeletal easing / cubic-bezier settings в полном `.sss`.

✅ Multi-chain IK targets / constraints / pole targets / stretch settings в полном `.sss`.

---

# Phase 6 — Extended Export — ✅ DONE

## Formats

✅ GIF.

✅ APNG.

✅ **Animated WebP** с локальным RIFF/ANIM/ANMF muxer.

✅ Sprite sheet PNG.

✅ PNG sequence ZIP.

✅ Atlas PNG + JSON.

✅ Paged Multi-atlas PNG + manifest JSON.

✅ Generic metadata JSON.

✅ Aseprite-compatible atlas JSON + `frameTags`.

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

✅ **Unity package ZIP** с atlas, metadata и `Editor/SpriteSheetStudioImporter.cs`.

---

# Phase 7 — Bone Rigging MVP — ✅ DONE

✅ Root / add / delete bones.

✅ Parent-child hierarchy.

✅ Offset / pivot / rotation / length / visibility.

✅ Mouse joint / endpoint manipulation.

✅ Import transparent sprite parts.

✅ Bind part to bone.

✅ Part pivot / offset / rotation.

✅ Part Scale X / Scale Y.

✅ Z-order / opacity / visibility.

✅ Rig JSON export.

---

# Phase 8 — Skeletal Animation — ✅ DONE

✅ Multiple skeletal animations.

✅ Bone position / rotation / length keyframes.

✅ Sprite position / rotation / scale X/Y / opacity / visibility keyframes.

✅ Timeline scrub / playback.

✅ FPS / clip length / loop.

✅ Step / Linear / Smooth Ease.

✅ Ease In / Ease Out presets.

✅ **Cubic Bezier interpolation** с editable `x1/y1/x2/y2`.

✅ Curve preview editor.

✅ Easing settings persist in `.sss`.

✅ Copy / paste pose.

✅ Duplicate / mirror animation.

✅ Skeletal animation library export.

✅ **Track-oriented timeline** с отдельными bone / sprite-part property lanes.

✅ Change-aware key markers: lane показывает key только если соответствующее свойство реально изменилось.

✅ Track filter: bones / parts / selected entity.

✅ Timeline zoom, ruler, playhead и click-to-scrub по property markers.

---

# Phase 9 — Inverse Kinematics — ✅ MVP DONE

✅ Two-bone IK.

✅ Arm / leg chains.

✅ Draggable targets.

✅ Bend direction.

✅ Min / max constraints.

✅ Independent Lock Rotation для parent/end joint.

✅ **Multiple simultaneous IK chains** с отдельными targets и active-chain manager.

✅ Каждая IK chain может быть отдельно включена/выключена.

✅ **Dedicated pole target** для каждой цепи.

✅ Pole target можно тянуть на canvas; bend direction определяется относительно pole.

✅ **Stretch mode** для недостижимых targets.

✅ Rest lengths и настраиваемый maximum stretch.

✅ Advanced IK сохраняется в `.sss` и local extras autosave.

✅ IK pose можно сохранить keyframe.

🟡 На будущее можно добавить приоритеты/solver ordering для цепей, которые изменяют общие родительские bones.

---

# Phase 10 — Mesh Deformation — 🟡 PARTIAL

✅ Grid mesh.

✅ Vertices / triangles.

✅ Auto bone weights.

✅ Weight painting MVP.

✅ Bone-driven deformation.

✅ Mesh preview.

✅ Restore bind pose.

✅ **Delaunay retriangulation** для текущих vertices.

✅ Manual triangle add / remove.

✅ Vertex inspector: UV + local offsets.

✅ Per-vertex bone-weight editing.

✅ Normalize selected vertex / normalize all.

✅ Influence pruning по minimum weight и max influences.

✅ Smoke coverage topology + weight normalization.

⬜ WebGL/PixiJS renderer для больших mesh.

⬜ Mesh topology/weights persistence внутри полного `.sss`.

---

# Phase 11 — AI Sprite Sheet Fixer — ✅ LOCAL MVP DONE

Базовый fixer работает локально без AI API.

✅ Auto Slice integration.

✅ Flat-background cleanup при безопасном определении цвета.

✅ Normalize canvas / Auto Align.

✅ Size-change diagnostics.

✅ Silhouette-change diagnostics.

✅ Bad-loop warning.

✅ Ping-pong suggestion.

✅ Object Slice может использоваться как локальный segmentation fallback.

✅ **Duplicate frame detection** через комбинированный visual/silhouette similarity score.

✅ **Broken-frame suspects**: empty, severe size outlier, isolated jump и extreme occupancy change.

✅ **Similarity heatmap** для всей animation sequence.

✅ Heatmap показывает pair similarity и позволяет выбрать кадр кликом.

⬜ Optional generative repair / inpainting через AI API.

---

# Phase 12 — UX / Professional Tools — 🟡 PARTIAL

✅ Undo / Redo.

✅ Keyboard shortcuts.

✅ Multi-select frames.

✅ Context menu.

✅ Snap to guides.

✅ Rulers / guides.

✅ **Named Guide Manager** с unlimited X/Y guides, visibility и local persistence.

✅ Fullscreen workspace.

✅ Dark responsive desktop-first UI.

✅ Custom preview background picker.

✅ Source sheet cell selection.

✅ Before / After cleanup comparison.

✅ **Command Palette (`Ctrl/Cmd + K`)** с fuzzy search и контекстными командами.

✅ **Custom Shortcut Editor** с local persistence и user-defined bindings.

✅ Focus-visible treatment.

✅ Skip-to-workspace link.

✅ Live region для toast/status announcements.

✅ Canvas/dialog semantics.

✅ `prefers-reduced-motion` support.

⬜ Better touch/tablet editing.

---

# Phase 13 — Performance — 🟡 PARTIAL

✅ GIF encoding в Web Worker.

✅ APNG encoding/compression в Web Worker с fallback.

✅ Export progress.

✅ UI не блокируется основным GIF/APNG encode этапом.

✅ Raw memory guards.

✅ Single-atlas dimension/pixel guard.

✅ Paged Multi-atlas вместо отказа для больших проектов.

✅ Compact timeline thumbnail canvases.

✅ Playback pause при hidden tab.

✅ Object URL cleanup.

🟡 Animated WebP работает; muxing пока выполняется в main thread.

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

# Phase 15 — Release Engineering — 🟡 IN PROGRESS

✅ Встроенный Diagnostics dialog.

✅ `?selftest=1` для быстрого smoke check опубликованного Pages.

✅ Canvas / IndexedDB / Worker / CompressionStream / WebP capability checks.

✅ Проверки local GIF / ZIP runtime.

✅ Проверки worker/export/runtime assets.

✅ Export diagnostics report JSON.

✅ ESLint / Prettier configuration.

✅ `npm run check`.

✅ Automated Playwright browser smoke suite.

✅ Test sprite fixtures.

✅ Smoke-тесты загрузки, slicing, Object Slice, cell selection, cleanup comparison, exports, `.sss`, rigging, advanced IK, AI diagnostics, accessibility и self-test.

✅ Дополнительные smoke suites: branding/assets, mesh topology, skeletal tracks, Command Palette, Named Guides, Custom Shortcuts.

✅ Playwright targets: Chromium / Firefox / WebKit.

✅ `BROWSER_SUPPORT.md` с capability matrix и release rule.

✅ Accessibility runtime и smoke coverage.

✅ `CHANGELOG.md`.

✅ Release checklist.

🟡 Committed production bundle generator/workflow подготовлен, но Actions в репозитории по-прежнему не запускаются (на свежем commit workflow runs = 0).

⬜ Перевести Pages на committed production bundle без runtime TS stripping.

⬜ Реально выполнить и зафиксировать полный three-engine browser pass для release candidate.

⬜ Выбрать license.

⬜ Release tags.

---

# Ближайший порядок работ

## Release 0.4 — Stabilization

1. Перевести Pages на проверенный committed production bundle без runtime TypeScript stripping.
2. Реально выполнить Chromium / Firefox / WebKit suite на release candidate.
3. Дополнительно пройти keyboard/contrast audit на живом Pages.
4. Выбрать license перед публичным стабильным релизом.
5. Создать release tag после успешного browser pass.

## Release 0.5 — Rigging polish

1. Mesh topology/weights persistence внутри `.sss`.
2. Better rig/game-engine skeletal export.
3. IK solver priorities для shared parent chains.
4. WebGL/PixiJS mesh renderer для тяжёлых mesh.
5. Дальнейшая polish pass skeletal/rig workflow.

## Release 0.6 — Editor polish / performance

1. Better touch/tablet editing.
2. Lazy decoding больших sprite sheets.
3. Progressive preview для очень больших источников.
4. Общий RAM budget manager.
5. Animated WebP worker/muxing optimization.

## Release 1.0

Цель первого стабильного релиза:

- sprite sheet / frame / Object Slice workflow;
- cleanup / Auto Align / custom anchors;
- local AI-style diagnostics / duplicate and broken-frame detection;
- animation editor;
- local full-project `.sss` persistence;
- GIF / APNG / WebP / PNG / atlas / multi-atlas exports;
- Godot / Phaser / Unity package exports;
- rigging + skeletal property tracks + advanced multi-chain IK + mesh editor;
- professional keyboard UX: Command Palette + custom shortcuts;
- stable GitHub Pages build;
- documented and actually verified browser support;
- no mandatory backend.
