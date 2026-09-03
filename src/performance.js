(() => {
  const workerUrl = new URL('./src/gif-worker.js', document.baseURI).href;
  const memoryLimit = 512 * 1024 * 1024;

  function estimatedGifBytes() {
    if (!state.frames.length) return 0;
    const size = normalizedSize();
    return size.width * size.height * 4 * Math.max(1, playbackSequence().length);
  }

  async function exportGifInWorker() {
    if (!state.frames.length) return;
    if (typeof Worker === 'undefined') return exportGif();

    const estimated = estimatedGifBytes();
    if (estimated > memoryLimit) {
      toast(`GIF export would need about ${Math.round(estimated / 1024 / 1024)} MB of raw frame memory. Reduce frame count or canvas size first.`, true);
      return;
    }

    const original = el.gif.innerHTML;
    el.gif.disabled = true;
    el.gif.innerHTML = '<span>Preparing…</span><small>Web Worker</small>';

    let worker;
    try {
      const sequence = playbackSequence();
      const frames = [];
      const transfers = [];
      for (let index = 0; index < sequence.length; index += 1) {
        const frameIndex = sequence[index];
        const frame = state.frames[frameIndex];
        const canvas = drawNormalizedFrame(frame);
        const image = get2d(canvas).getImageData(0, 0, canvas.width, canvas.height);
        const buffer = image.data.buffer.slice(0);
        frames.push({
          width: canvas.width,
          height: canvas.height,
          delay: Math.max(20, Math.round((1000 / state.fps) * (frame.hold || 1))),
          data: buffer
        });
        transfers.push(buffer);
        if (index % 8 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      worker = new Worker(workerUrl, { type: 'module' });
      const result = await new Promise((resolve, reject) => {
        worker.addEventListener('message', (event) => {
          if (event.data?.type === 'progress') {
            const percent = Math.round((event.data.value || 0) * 100);
            el.gif.innerHTML = `<span>Encoding ${percent}%</span><small>Web Worker</small>`;
          } else if (event.data?.type === 'done') {
            resolve(event.data.buffer);
          } else if (event.data?.type === 'error') {
            reject(new Error(event.data.message || 'GIF worker failed'));
          }
        });
        worker.addEventListener('error', (event) => reject(event.error || new Error(event.message || 'GIF worker crashed')));
        worker.postMessage({ frames, loop: state.loop }, transfers);
      });

      downloadBlob(new Blob([result], { type: 'image/gif' }), 'sprite-animation.gif');
      toast('GIF exported in background worker');
    } catch (error) {
      console.error(error);
      toast('Worker GIF export failed; retrying on the main thread.', true);
      try { await exportGif(); } catch (fallbackError) { console.error(fallbackError); }
    } finally {
      worker?.terminate();
      el.gif.innerHTML = original;
      el.gif.disabled = !state.frames.length;
    }
  }

  el.gif.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    void exportGifInWorker();
  }, true);

  const exportSection = el.gif.closest('.panel-section');
  const sectionHead = exportSection?.querySelector('.section-head');
  if (sectionHead) {
    const badge = document.createElement('span');
    badge.className = 'section-note';
    badge.textContent = 'GIF: Web Worker';
    badge.title = 'GIF quantization and encoding run outside the UI thread';
    sectionHead.append(badge);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.playing) stopPlayback();
  });

  const observer = new MutationObserver(() => {
    if (!state.frames.length) return;
    const bytes = estimatedGifBytes();
    if (bytes > 256 * 1024 * 1024) {
      el.gif.title = `Large GIF: about ${Math.round(bytes / 1024 / 1024)} MB raw working memory`;
    } else {
      el.gif.removeAttribute('title');
    }
  });
  observer.observe(el.frames, { childList: true });
})();