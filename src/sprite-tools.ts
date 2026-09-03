export type Bounds = { x: number; y: number; width: number; height: number };
export type AnchorMode = 'bottom-center' | 'center' | 'center-mass';
export type GridSuggestion = {
  rows: number;
  cols: number;
  confidence: number;
  xRuns: Bounds[];
  yRuns: Bounds[];
};

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function opaqueBounds(canvas: HTMLCanvasElement, alphaThreshold = 8): Bounds | null {
  const ctx = get2d(canvas);
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha < alphaThreshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function trimTransparent(canvas: HTMLCanvasElement, padding = 0, alphaThreshold = 8): HTMLCanvasElement {
  const bounds = opaqueBounds(canvas, alphaThreshold);
  if (!bounds) return cloneCanvas(canvas);

  const left = Math.max(0, bounds.x - padding);
  const top = Math.max(0, bounds.y - padding);
  const right = Math.min(canvas.width, bounds.x + bounds.width + padding);
  const bottom = Math.min(canvas.height, bounds.y + bounds.height + padding);
  const out = document.createElement('canvas');
  out.width = Math.max(1, right - left);
  out.height = Math.max(1, bottom - top);
  get2d(out).drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

export function cloneCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  get2d(out).drawImage(canvas, 0, 0);
  return out;
}

function alphaCenterOfMass(canvas: HTMLCanvasElement, alphaThreshold = 8): { x: number; y: number } {
  const ctx = get2d(canvas);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let total = 0;
  let sx = 0;
  let sy = 0;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha < alphaThreshold) continue;
      const weight = alpha / 255;
      total += weight;
      sx += (x + 0.5) * weight;
      sy += (y + 0.5) * weight;
    }
  }

  return total > 0 ? { x: sx / total, y: sy / total } : { x: canvas.width / 2, y: canvas.height / 2 };
}

function anchorPoint(canvas: HTMLCanvasElement, mode: AnchorMode): { x: number; y: number } {
  if (mode === 'center') return { x: canvas.width / 2, y: canvas.height / 2 };
  if (mode === 'center-mass') return alphaCenterOfMass(canvas);
  const bounds = opaqueBounds(canvas);
  if (!bounds) return { x: canvas.width / 2, y: canvas.height };
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height
  };
}

export function alignCanvases(canvases: HTMLCanvasElement[], mode: AnchorMode): HTMLCanvasElement[] {
  if (!canvases.length) return [];

  const anchors = canvases.map((canvas) => anchorPoint(canvas, mode));
  const leftExtent = Math.ceil(Math.max(...canvases.map((canvas, i) => anchors[i].x)));
  const rightExtent = Math.ceil(Math.max(...canvases.map((canvas, i) => canvas.width - anchors[i].x)));
  const topExtent = Math.ceil(Math.max(...canvases.map((canvas, i) => anchors[i].y)));
  const bottomExtent = Math.ceil(Math.max(...canvases.map((canvas, i) => canvas.height - anchors[i].y)));
  const width = Math.max(1, leftExtent + rightExtent);
  const height = Math.max(1, topExtent + bottomExtent);

  return canvases.map((canvas, i) => {
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const x = Math.round(leftExtent - anchors[i].x);
    const y = Math.round(topExtent - anchors[i].y);
    get2d(out).drawImage(canvas, x, y);
    return out;
  });
}

function findRuns(values: Uint8Array, bridgeGap: number): Array<{ start: number; end: number }> {
  const raw: Array<{ start: number; end: number }> = [];
  let start = -1;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      raw.push({ start, end: i - 1 });
      start = -1;
    }
  }
  if (start >= 0) raw.push({ start, end: values.length - 1 });
  if (raw.length < 2 || bridgeGap <= 0) return raw;

  const merged = [raw[0]];
  for (let i = 1; i < raw.length; i += 1) {
    const prev = merged[merged.length - 1];
    const current = raw[i];
    if (current.start - prev.end - 1 <= bridgeGap) prev.end = current.end;
    else merged.push(current);
  }
  return merged;
}

function regularity(runs: Array<{ start: number; end: number }>): number {
  if (runs.length <= 1) return 0.5;
  const centers = runs.map((r) => (r.start + r.end) / 2);
  const diffs = centers.slice(1).map((center, i) => center - centers[i]);
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  if (mean <= 0) return 0;
  const variance = diffs.reduce((sum, d) => sum + (d - mean) ** 2, 0) / diffs.length;
  const cv = Math.sqrt(variance / diffs.length) / mean;
  return Math.max(0, Math.min(1, 1 - cv * 2.5));
}

export function suggestTransparentGrid(source: CanvasImageSource, width: number, height: number, alphaThreshold = 8): GridSuggestion | null {
  if (width < 2 || height < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = get2d(canvas);
  ctx.drawImage(source, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const cols = new Uint8Array(width);
  const rows = new Uint8Array(height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] >= alphaThreshold) {
        cols[x] = 1;
        rows[y] = 1;
      }
    }
  }

  const bridgeX = Math.max(1, Math.floor(width / 512));
  const bridgeY = Math.max(1, Math.floor(height / 512));
  const xRaw = findRuns(cols, bridgeX);
  const yRaw = findRuns(rows, bridgeY);

  const maxCells = 64;
  if (xRaw.length > maxCells || yRaw.length > maxCells) return null;
  if (xRaw.length <= 1 && yRaw.length <= 1) return null;

  const xReg = regularity(xRaw);
  const yReg = regularity(yRaw);
  const usefulX = xRaw.length > 1 && xReg >= 0.35;
  const usefulY = yRaw.length > 1 && yReg >= 0.35;
  if (!usefulX && !usefulY) return null;

  const inferredCols = usefulX ? xRaw.length : 1;
  const inferredRows = usefulY ? yRaw.length : 1;
  const confidenceParts = [usefulX ? xReg : 0.65, usefulY ? yReg : 0.65];
  const confidence = confidenceParts.reduce((a, b) => a + b, 0) / confidenceParts.length;

  return {
    rows: inferredRows,
    cols: inferredCols,
    confidence,
    xRuns: xRaw.map((run) => ({ x: run.start, y: 0, width: run.end - run.start + 1, height })),
    yRuns: yRaw.map((run) => ({ x: 0, y: run.start, width, height: run.end - run.start + 1 }))
  };
}
