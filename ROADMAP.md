# Sprite Sheet Studio — Roadmap

Sprite Sheet Studio — браузерный инструмент для подготовки 2D-спрайтов и sprite sheet-анимаций для игр.

Ключевая идея проекта:

> **Upload → Slice → Align → Animate → Rig → Export**

Первая версия должна работать полностью на клиенте, без обязательного backend: изображения пользователя не покидают браузер, а проект можно размещать на GitHub Pages.

---

## Цели проекта

- Быстро превращать sprite sheet в готовую анимацию.
- Поддерживать загрузку отдельных кадров.
- Исправлять типичные проблемы AI-сгенерированных спрайтов: разные отступы, дрожание, смещение персонажа между кадрами.
- Давать pixel-perfect preview без размытия.
- Экспортировать результат не только в GIF, но и в форматы, удобные для игровых движков.
- В дальнейшем добавить 2D skeletal animation: кости, keyframes, IK и переиспользуемые анимации.
- По возможности сохранять основной workflow полностью client-side.

---

# Phase 0 — Foundation

## Задача

Создать техническую основу статического редактора.

## План

- [ ] Создать приложение на Vite + TypeScript.
- [ ] Выбрать UI-подход: vanilla TS или React.
- [ ] Настроить GitHub Pages deployment.
- [ ] Настроить ESLint / Prettier.
- [ ] Добавить базовую структуру проекта.
- [ ] Добавить Canvas-based workspace.
- [ ] Добавить drag & drop загрузку файлов.
- [ ] Не отправлять пользовательские изображения на сервер.

## Базовая архитектура

```text
src/
  app/
  canvas/
  frames/
  animation/
  rigging/
  export/
  storage/
  ui/
  utils/
```

## Предлагаемый стек

- Vite
- TypeScript
- Canvas 2D для MVP
- Web Workers для тяжёлых операций экспорта
- IndexedDB для сохранения проектов
- GitHub Pages для хостинга

Позже, если понадобится mesh deformation и более сложный рендеринг:

- PixiJS или собственный WebGL renderer

---

# Phase 1 — MVP: Sprite Sheet → Animation

## Импорт

- [ ] Загрузка PNG.
- [ ] Загрузка WebP.
- [ ] Drag & drop.
- [ ] Вставка изображения из clipboard.
- [ ] Загрузка нескольких отдельных PNG-кадров.

## Нарезка sprite sheet

- [ ] Ручное количество строк.
- [ ] Ручное количество колонок.
- [ ] Настройка ширины/высоты кадра.
- [ ] Настройка padding.
- [ ] Настройка spacing.
- [ ] Визуальная сетка поверх sprite sheet.
- [ ] Выбор нужных кадров мышью.

## Timeline

- [ ] Отображение кадров на timeline.
- [ ] Drag & drop изменения порядка кадров.
- [ ] Удаление кадров.
- [ ] Дублирование кадров.
- [ ] Вставка кадров.
- [ ] Reverse frames.

## Preview

- [ ] Play / Pause.
- [ ] FPS.
- [ ] Loop.
- [ ] Ping-pong.
- [ ] Скорость воспроизведения.
- [ ] Pixel-perfect масштабирование.
- [ ] Zoom x1 / x2 / x3 / x4 / x8.
- [ ] Checkerboard background.
- [ ] Белый фон.
- [ ] Чёрный фон.
- [ ] Пользовательский фон preview.

## Экспорт MVP

- [ ] GIF.
- [ ] PNG sequence.
- [ ] Новый sprite sheet PNG.

---

# Phase 2 — Smart Slicing

## Auto Slice

Автоматически находить кадры в sprite sheet.

- [ ] Анализ прозрачных областей.
- [ ] Поиск bounding boxes.
- [ ] Определение повторяющегося размера кадров.
- [ ] Автоматическое определение строк и колонок.
- [ ] Предложение найденной сетки пользователю.
- [ ] Возможность вручную исправить результат.

Пример:

```text
Загружено изображение

Найдено: 4 кадра
Размер: 32 × 48 px
Предполагаемая сетка: 4 × 1
```

## Работа с отдельными файлами

- [ ] Автоматическая сортировка `idle_01.png`, `idle_02.png`, ...
- [ ] Natural filename sorting.
- [ ] Общая нормализация размера кадров.

---

# Phase 3 — Sprite Cleanup

Это одна из ключевых функций Sprite Sheet Studio.

## Trim

- [ ] Автоматически обрезать прозрачные края.
- [ ] Trim одного кадра.
- [ ] Trim всей анимации.
- [ ] Общий canvas после trim.

## Normalize

- [ ] Привести все кадры к одинаковому размеру.
- [ ] Центрировать по bounding box.
- [ ] Не менять исходные пиксели спрайта.

## Anchor Point

- [ ] Anchor по центру.
- [ ] Anchor по ногам.
- [ ] Anchor по нижнему центру.
- [ ] Пользовательский anchor.
- [ ] Единый anchor для всех кадров.

## Auto Align

Автоматически устранять "прыгание" персонажа между кадрами.

- [ ] Align по нижнему краю opaque pixels.
- [ ] Align по центру opaque pixels.
- [ ] Align по центру массы.
- [ ] Align относительно выбранного anchor.
- [ ] Preview до/после.

Особенно важно для AI-generated sprite sheets, где персонаж часто немного смещается между кадрами.

---

# Phase 4 — Animation Editor

## Frame timing

- [ ] Индивидуальная длительность каждого кадра.
- [ ] Массовое изменение duration.
- [ ] Hold frame.
- [ ] Duplicate duration.

## Onion Skin

- [ ] Previous frame.
- [ ] Next frame.
- [ ] Несколько соседних кадров.
- [ ] Настройка opacity.

## Transform tools

- [ ] Flip X.
- [ ] Flip Y.
- [ ] Rotate 90°.
- [ ] Pixel-perfect move.
- [ ] Crop.
- [ ] Resize canvas.
- [ ] Nearest-neighbour scaling.

## Animation presets

- [ ] Loop.
- [ ] Ping-pong.
- [ ] Once.
- [ ] Reverse.

---

# Phase 5 — Project System

## Локальные проекты

- [ ] Создание проекта.
- [ ] Несколько animations внутри проекта.
- [ ] `idle`.
- [ ] `walk`.
- [ ] `run`.
- [ ] `attack`.
- [ ] `death`.
- [ ] Пользовательские animation names.

## Хранение

- [ ] IndexedDB.
- [ ] Autosave.
- [ ] Export project file.
- [ ] Import project file.

Пример project schema:

```json
{
  "version": 1,
  "name": "hooded-man",
  "animations": {
    "idle": {},
    "walk": {},
    "attack": {}
  }
}
```

---

# Phase 6 — Extended Export

## Форматы

- [ ] Animated WebP.
- [ ] APNG.
- [ ] Sprite atlas PNG.
- [ ] JSON metadata.
- [ ] ZIP с PNG sequence.

## Game engine export

### Godot

- [ ] SpriteFrames-compatible data.
- [ ] Animation metadata.
- [ ] Экспорт кадров по папкам.
- [ ] Генерация `.tres` при технической возможности.

Пример:

```text
hooded-man/
  idle/
    idle_01.png
    idle_02.png
    idle_03.png
    idle_04.png
  walk/
  animation.json
```

### Unity

- [ ] Sprite slicing metadata.
- [ ] Animation frame metadata.

### Phaser

- [ ] Atlas JSON.
- [ ] Frame names.

### Generic

- [ ] Aseprite-compatible JSON, где формат это позволяет.

---

# Phase 7 — Bone Rigging MVP

На этом этапе Sprite Sheet Studio становится не только frame animator, но и простым 2D rigging tool.

## Требование к ассету

Основной сценарий — персонаж разбит на отдельные части:

```text
head
body
upper_arm_left
forearm_left
hand_left
upper_arm_right
forearm_right
hand_right
thigh_left
shin_left
foot_left
thigh_right
shin_right
foot_right
```

## Skeleton

- [ ] Создание root bone.
- [ ] Добавление костей.
- [ ] Parent / child hierarchy.
- [ ] Перемещение pivot.
- [ ] Rotation.
- [ ] Bone length.
- [ ] Bone visibility.

Пример:

```text
Root
└── Pelvis
    ├── Spine
    │   ├── Head
    │   ├── LeftArm
    │   │   └── LeftForearm
    │   │       └── LeftHand
    │   └── RightArm
    ├── LeftThigh
    │   └── LeftShin
    │       └── LeftFoot
    └── RightThigh
        └── RightShin
            └── RightFoot
```

## Sprite attachment

- [ ] Привязка sprite part к bone.
- [ ] Pivot каждого sprite part.
- [ ] Z-order частей тела.
- [ ] Opacity.
- [ ] Visibility.

---

# Phase 8 — Skeletal Animation

## Keyframes

- [ ] Bone rotation keyframes.
- [ ] Position keyframes.
- [ ] Scale keyframes.
- [ ] Sprite visibility keyframes.
- [ ] Timeline для skeletal animation.

## Interpolation

- [ ] Step.
- [ ] Linear.
- [ ] Ease in/out.

## Animation library

Один rig должен позволять создавать несколько animations:

```text
idle
walk
run
jump
attack
hurt
death
```

- [ ] Duplicate animation.
- [ ] Mirror animation.
- [ ] Copy/paste keyframes.
- [ ] Animation looping.

---

# Phase 9 — Inverse Kinematics

## IK

- [ ] Two-bone IK.
- [ ] Рука: shoulder → elbow → hand.
- [ ] Нога: thigh → knee → foot.
- [ ] IK target.
- [ ] Pole target / bend direction.

Пользователь должен иметь возможность тянуть кисть мышкой, а плечо и локоть автоматически перестраиваются.

## Constraints

- [ ] Min rotation.
- [ ] Max rotation.
- [ ] Lock rotation.
- [ ] Joint direction.
- [ ] Prevent unnatural bending.

---

# Phase 10 — Mesh Deformation

Не является обязательным для ранних версий.

Позволит работать не только с персонажем, разбитым на части, но и деформировать цельные изображения.

- [ ] Generate mesh over sprite.
- [ ] Mesh vertices.
- [ ] Bone weights.
- [ ] Weight painting.
- [ ] Bone deformation.
- [ ] Mesh preview.
- [ ] Restore bind pose.

Для этой части, вероятно, потребуется WebGL/PixiJS.

---

# Phase 11 — AI Sprite Sheet Fixer

Цель — исправление проблем sprite sheets, созданных генеративными моделями.

## Возможные функции

- [ ] Автоматическое нахождение кадров.
- [ ] Поиск и удаление лишнего фона.
- [ ] Normalize canvas.
- [ ] Auto Align.
- [ ] Поиск кадров с отличающимися размерами персонажа.
- [ ] Детектирование подозрительно сильно изменившегося силуэта.
- [ ] Предупреждение о плохой loop-анимации.
- [ ] Предложение ping-pong sequence.

Важно: базовые исправления должны выполняться локально и без AI API, если это возможно.

---

# Phase 12 — UX / Professional Tools

- [ ] Undo / Redo.
- [ ] Keyboard shortcuts.
- [ ] Multi-select frames.
- [ ] Context menu.
- [ ] Snap to pixel.
- [ ] Snap to guides.
- [ ] Rulers.
- [ ] Guides.
- [ ] Fullscreen workspace.
- [ ] Dark theme.
- [ ] Responsive UI.
- [ ] Desktop-friendly layout.

## Предлагаемая компоновка

```text
┌──────────────────────────────────────────────────────┐
│ Sprite Sheet Studio                     Export ▼     │
├──────────────────┬───────────────────────────────────┤
│ Assets / Frames  │                                   │
│                  │             Preview               │
│ Sprite Sheet     │                                   │
│ Animations       │                                   │
│ Skeleton         │                                   │
├──────────────────┴───────────────────────────────────┤
│ Timeline                                             │
│ [01] [02] [03] [04] [05] ...                        │
├──────────────────────────────────────────────────────┤
│ FPS 8   Loop ✓   Ping-Pong ☐   Scale 4×             │
└──────────────────────────────────────────────────────┘
```

---

# Phase 13 — Performance

- [ ] Web Workers для GIF/APNG/WebP export.
- [ ] Не блокировать UI во время экспорта.
- [ ] Lazy decoding больших sprite sheets.
- [ ] Object URL lifecycle management.
- [ ] Ограничение RAM usage.
- [ ] Работа с большими sprite atlases.
- [ ] Progressive preview.

---

# Phase 14 — Optional Cloud Features

Эта часть требует backend и не должна быть обязательной для основного редактора.

- [ ] Аккаунты.
- [ ] Cloud save.
- [ ] Синхронизация проектов между устройствами.
- [ ] Shared projects.
- [ ] Team collaboration.
- [ ] Version history.

Принцип:

> Основной редактор должен оставаться работоспособным без регистрации и без сервера.

---

# Рекомендуемый порядок реализации

## Release 0.1 — MVP

- Upload sprite sheet
- Manual slice
- Timeline
- Preview
- FPS
- Loop
- Ping-pong
- GIF export
- PNG sequence
- Sprite sheet export

## Release 0.2 — Smart Sprite Tools

- Auto Slice
- Trim
- Normalize
- Anchor point
- Auto Align
- Pixel-perfect preview

## Release 0.3 — Animation Editor

- Per-frame duration
- Onion skin
- Transform tools
- Multiple animations
- Project save/load

## Release 0.4 — Game Export

- WebP
- APNG
- Atlas JSON
- Godot export
- Unity metadata
- Phaser export

## Release 0.5 — Rigging

- Sprite parts
- Bones
- Parent hierarchy
- Pivots
- Bone attachments

## Release 0.6 — Skeletal Animation

- Bone keyframes
- Timeline
- Interpolation
- Animation library

## Release 0.7 — IK

- Two-bone IK
- Joint constraints
- Hand/foot targets

## Release 0.8 — Advanced Rigging

- Mesh deformation
- Bone weights
- More advanced constraints

## Release 1.0

Sprite Sheet Studio становится полноценным браузерным инструментом:

> **Sprite Sheet Editor + Animation Studio + Lightweight 2D Rigging Tool**

---

# Что НЕ нужно делать в первой версии

Чтобы проект не разросся до аналога Spine до появления рабочего продукта, в MVP не входят:

- аккаунты;
- backend;
- collaborative editing;
- mesh deformation;
- IK;
- AI API;
- сложный skeletal rigging;
- полноценный pixel-art editor.

Сначала необходимо сделать максимально качественный workflow:

> **Upload → Slice → Preview → Export**

После него:

> **Trim → Align → Animate → Game Export**

И только затем:

> **Rig → Keyframes → IK → Mesh Deformation**

---

# Product Positioning

Не позиционировать проект только как конвертер sprite sheet в GIF.

Более сильная формулировка:

> **Turn sprite sheets into game-ready animations.**

или:

> **Prepare, fix, animate and export 2D sprites directly in your browser.**

Главное преимущество первой версии:

- работает в браузере;
- не требует установки;
- не требует аккаунта;
- изображения остаются на устройстве;
- ориентирован именно на game-dev workflow.
