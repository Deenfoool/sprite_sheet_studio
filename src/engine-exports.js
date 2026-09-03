(() => {
  const projectApi = globalThis.__SSSProject;
  if (!projectApi) return;

  function textBytes(value) {
    return new TextEncoder().encode(value);
  }

  function safeName(value) {
    return String(value || 'animation').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'animation';
  }

  function cloneFrameToCell(frame, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const x = Math.floor((width - frame.canvas.width) / 2);
    const y = height - frame.canvas.height;
    get2d(canvas).drawImage(frame.canvas, x, y);
    return canvas;
  }

  function collectProjectFrames(runtime) {
    const entries = [];
    runtime.animations.forEach(([animationName, animation]) => {
      animation.frames.forEach((frame, index) => {
        entries.push({ animationName, animation, frame, index });
      });
    });
    return entries;
  }

  function projectCellSize(runtime) {
    let width = 1;
    let height = 1;
    runtime.animations.forEach(([, animation]) => {
      animation.frames.forEach((frame) => {
        width = Math.max(width, frame.canvas.width);
        height = Math.max(height, frame.canvas.height);
      });
    });
    return { width, height };
  }

  function buildAtlas(runtime) {
    const entries = collectProjectFrames(runtime);
    const cell = projectCellSize(runtime);
    const cols = Math.max(1, Math.ceil(Math.sqrt(entries.length || 1)));
    const rows = Math.max(1, Math.ceil((entries.length || 1) / cols));
    const canvas = document.createElement('canvas');
    canvas.width = cell.width * cols;
    canvas.height = cell.height * rows;
    const ctx = get2d(canvas);
    const frames = {};

    entries.forEach((entry, flatIndex) => {
      const col = flatIndex % cols;
      const row = Math.floor(flatIndex / cols);
      const x = col * cell.width;
      const y = row * cell.height;
      const normalized = cloneFrameToCell(entry.frame, cell.width, cell.height);
      ctx.drawImage(normalized, x, y);
      const key = `${safeName(entry.animationName)}/${String(entry.index + 1).padStart(3, '0')}`;
      frames[key] = {
        frame: { x, y, w: cell.width, h: cell.height },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: cell.width, h: cell.height },
        sourceSize: { w: cell.width, h: cell.height },
        duration: Math.round((1000 / (entry.animation.fps || 8)) * (entry.frame.hold || 1)),
        animation: entry.animationName,
        index: entry.index
      };
    });

    return { canvas, frames, cell, cols, rows };
  }

  async function exportAtlasPackage() {
    const runtime = projectApi.runtime();
    const atlas = buildAtlas(runtime);
    const png = await canvasToBlob(atlas.canvas);
    const metadata = {
      frames: atlas.frames,
      meta: {
        app: 'Sprite Sheet Studio',
        version: 1,
        image: 'atlas.png',
        size: { w: atlas.canvas.width, h: atlas.canvas.height },
        scale: '1',
        project: runtime.name,
        activeAnimation: runtime.activeAnimation
      }
    };
    const files = {
      'atlas.png': new Uint8Array(await png.arrayBuffer()),
      'atlas.json': textBytes(JSON.stringify(metadata, null, 2))
    };
    downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), `${safeName(runtime.name)}-atlas.zip`);
    toast('Atlas PNG + JSON exported');
  }

  function genericMetadata(runtime) {
    const result = {
      version: 1,
      app: 'Sprite Sheet Studio',
      project: runtime.name,
      activeAnimation: runtime.activeAnimation,
      animations: {}
    };
    runtime.animations.forEach(([name, animation]) => {
      result.animations[name] = {
        fps: animation.fps,
        loop: animation.loop,
        pingPong: animation.pingPong,
        frames: animation.frames.map((frame, index) => ({
          index,
          name: frame.name,
          width: frame.canvas.width,
          height: frame.canvas.height,
          hold: frame.hold || 1,
          durationMs: Math.round((1000 / (animation.fps || 8)) * (frame.hold || 1))
        }))
      };
    });
    return result;
  }

  function exportMetadata() {
    const runtime = projectApi.runtime();
    const blob = new Blob([JSON.stringify(genericMetadata(runtime), null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${safeName(runtime.name)}-animations.json`);
    toast('Animation metadata exported');
  }

  function tresEscape(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  async function exportGodot() {
    const runtime = projectApi.runtime();
    const files = {};
    const resources = [];
    const animationsOut = [];
    let resourceIndex = 1;

    for (const [animationName, animation] of runtime.animations) {
      const frameRefs = [];
      for (let index = 0; index < animation.frames.length; index += 1) {
        const frame = animation.frames[index];
        const folderName = safeName(animationName);
        const fileName = `${folderName}_${String(index + 1).padStart(3, '0')}.png`;
        const path = `sprite_sheet_studio/sprites/${folderName}/${fileName}`;
        const blob = await canvasToBlob(frame.canvas);
        files[path] = new Uint8Array(await blob.arrayBuffer());
        const id = `${resourceIndex}_${folderName}_${index + 1}`;
        resources.push(`[ext_resource type="Texture2D" path="res://${path}" id="${id}"]`);
        frameRefs.push(`{
"duration": ${Math.max(1, frame.hold || 1).toFixed(1)},
"texture": ExtResource("${id}")
}`);
        resourceIndex += 1;
      }

      animationsOut.push(`{
"frames": [${frameRefs.join(',\n')}],
"loop": ${animation.loop ? 'true' : 'false'},
"name": &"${tresEscape(animationName)}",
"speed": ${Math.max(1, animation.fps || 8).toFixed(1)}
}`);
    }

    const tres = `[gd_resource type="SpriteFrames" load_steps=${Math.max(1, resourceIndex)} format=3]\n\n${resources.join('\n')}\n\n[resource]\nanimations = [${animationsOut.join(',\n')}]\n`;
    files['sprite_sheet_studio/animations.tres'] = textBytes(tres);
    files['sprite_sheet_studio/README.txt'] = textBytes('Copy the sprite_sheet_studio folder into your Godot project. Load animations.tres as a SpriteFrames resource in AnimatedSprite2D.\n');
    downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), `${safeName(runtime.name)}-godot.zip`);
    toast('Godot SpriteFrames pack exported');
  }

  async function exportPhaser() {
    const runtime = projectApi.runtime();
    const atlas = buildAtlas(runtime);
    const png = await canvasToBlob(atlas.canvas);
    const phaserJson = {
      frames: {},
      meta: {
        app: 'Sprite Sheet Studio',
        version: '1.0',
        image: 'atlas.png',
        format: 'RGBA8888',
        size: { w: atlas.canvas.width, h: atlas.canvas.height },
        scale: '1'
      },
      animations: {}
    };

    Object.entries(atlas.frames).forEach(([key, value]) => {
      phaserJson.frames[key] = {
        frame: value.frame,
        rotated: false,
        trimmed: false,
        spriteSourceSize: value.spriteSourceSize,
        sourceSize: value.sourceSize
      };
    });

    runtime.animations.forEach(([name, animation]) => {
      phaserJson.animations[name] = {
        frames: animation.frames.map((_, index) => `${safeName(name)}/${String(index + 1).padStart(3, '0')}`),
        frameRate: animation.fps,
        repeat: animation.loop ? -1 : 0,
        pingPong: Boolean(animation.pingPong),
        holds: animation.frames.map((frame) => frame.hold || 1)
      };
    });

    const files = {
      'atlas.png': new Uint8Array(await png.arrayBuffer()),
      'atlas.json': textBytes(JSON.stringify(phaserJson, null, 2)),
      'README.txt': textBytes("Phaser: this.load.atlas('character', 'atlas.png', 'atlas.json');\nAnimation metadata is available in atlas.json -> animations.\n")
    };
    downloadBlob(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), `${safeName(runtime.name)}-phaser.zip`);
    toast('Phaser atlas pack exported');
  }

  function exportUnityMetadata() {
    const runtime = projectApi.runtime();
    const atlas = buildAtlas(runtime);
    const data = {
      generator: 'Sprite Sheet Studio',
      project: runtime.name,
      atlas: {
        width: atlas.canvas.width,
        height: atlas.canvas.height,
        cellWidth: atlas.cell.width,
        cellHeight: atlas.cell.height,
        columns: atlas.cols,
        rows: atlas.rows
      },
      sprites: Object.entries(atlas.frames).map(([name, value]) => ({
        name,
        rect: { x: value.frame.x, y: atlas.canvas.height - value.frame.y - value.frame.h, width: value.frame.w, height: value.frame.h },
        pivot: { x: 0.5, y: 0 },
        durationMs: value.duration
      })),
      animations: genericMetadata(runtime).animations,
      note: 'Metadata helper for Unity Editor tooling; Unity does not import this JSON automatically.'
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${safeName(runtime.name)}-unity-metadata.json`);
    toast('Unity metadata exported');
  }

  const exportGrid = el.gif.closest('.panel-section').querySelector('.export-grid');
  const divider = document.createElement('div');
  divider.style.cssText = 'height:1px;background:#1d2a3e;margin:3px 0';

  function exportButton(title, subtitle, handler, className = '') {
    const button = document.createElement('button');
    button.className = `btn export-btn ${className}`.trim();
    button.innerHTML = `<span>${title}</span><small>${subtitle}</small>`;
    button.addEventListener('click', () => Promise.resolve(handler()).catch((error) => {
      console.error(error);
      toast(`${title} export failed.`, true);
    }));
    return button;
  }

  exportGrid.append(
    divider,
    exportButton('Atlas + JSON', 'all animations · ZIP', exportAtlasPackage, 'green'),
    exportButton('Godot pack', 'SpriteFrames .tres + PNG', exportGodot),
    exportButton('Phaser pack', 'atlas PNG + JSON', exportPhaser),
    exportButton('Unity metadata', 'atlas slicing helper', exportUnityMetadata),
    exportButton('Metadata JSON', 'engine-agnostic', exportMetadata)
  );
})();