(() => {
  const projectApi = globalThis.__SSSProject;
  if (!projectApi) return;

  function safeName(value) {
    return String(value || 'sprite-project').trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'sprite-project';
  }

  async function exportAsepriteAtlas() {
    const runtime = projectApi.runtime();
    const entries = [];
    let cellWidth = 1;
    let cellHeight = 1;

    runtime.animations.forEach(([animationName, animation]) => {
      animation.frames.forEach((frame, index) => {
        entries.push({ animationName, animation, frame, index });
        cellWidth = Math.max(cellWidth, frame.canvas.width);
        cellHeight = Math.max(cellHeight, frame.canvas.height);
      });
    });

    if (!entries.length) return toast('The project has no frames to export.', true);
    const cols = Math.max(1, Math.ceil(Math.sqrt(entries.length)));
    const rows = Math.ceil(entries.length / cols);
    if (cellWidth * cols > 16384 || cellHeight * rows > 16384) {
      return toast('Aseprite atlas would exceed 16384 px in one dimension. Reduce the project or frame size.', true);
    }

    const canvas = document.createElement('canvas');
    canvas.width = cellWidth * cols;
    canvas.height = cellHeight * rows;
    const ctx = get2d(canvas);
    const frames = {};
    const frameTags = [];
    let flatIndex = 0;

    runtime.animations.forEach(([animationName, animation]) => {
      const from = flatIndex;
      animation.frames.forEach((frame, index) => {
        const col = flatIndex % cols;
        const row = Math.floor(flatIndex / cols);
        const x = col * cellWidth;
        const y = row * cellHeight;
        const ox = x + Math.floor((cellWidth - frame.canvas.width) / 2);
        const oy = y + cellHeight - frame.canvas.height;
        ctx.drawImage(frame.canvas, ox, oy);
        const key = `${safeName(animationName)}_${String(index + 1).padStart(3, '0')}.png`;
        frames[key] = {
          frame: { x, y, w: cellWidth, h: cellHeight },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: cellWidth, h: cellHeight },
          sourceSize: { w: cellWidth, h: cellHeight },
          duration: Math.round((1000 / Math.max(1, animation.fps || 8)) * Math.max(1, frame.hold || 1))
        };
        flatIndex += 1;
      });
      const to = flatIndex - 1;
      if (to >= from) {
        frameTags.push({
          name: animationName,
          from,
          to,
          direction: animation.pingPong ? 'pingpong' : animation.loop ? 'forward' : 'forward',
          color: '#00000000'
        });
      }
    });

    const json = {
      frames,
      meta: {
        app: 'Sprite Sheet Studio',
        version: '1.0',
        image: 'aseprite-atlas.png',
        format: 'RGBA8888',
        size: { w: canvas.width, h: canvas.height },
        scale: '1',
        frameTags,
        layers: [],
        slices: []
      }
    };

    const png = await canvasToBlob(canvas);
    const files = {
      'aseprite-atlas.png': new Uint8Array(await png.arrayBuffer()),
      'aseprite-atlas.json': new TextEncoder().encode(JSON.stringify(json, null, 2)),
      'README.txt': new TextEncoder().encode('Aseprite-compatible sprite-sheet JSON with frameTags. Import behavior may vary by engine/tool; the JSON follows the common Aseprite sheet schema.\n')
    };
    downloadBlob(new Blob([zipSync(files)], { type: 'application/zip' }), `${safeName(runtime.name)}-aseprite-atlas.zip`);
    toast('Aseprite-compatible atlas exported');
  }

  const exportGrid = el.gif.closest('.panel-section')?.querySelector('.export-grid');
  if (!exportGrid) return;
  const button = document.createElement('button');
  button.className = 'btn export-btn';
  button.innerHTML = '<span>Aseprite atlas</span><small>PNG + frameTags JSON</small>';
  button.addEventListener('click', () => void exportAsepriteAtlas());
  exportGrid.append(button);
})();