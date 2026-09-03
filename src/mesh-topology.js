let meshTopologyInitialized = false;

function initMeshTopology() {
  if (meshTopologyInitialized) return true;
  const meshApi = globalThis.__SSSMesh;
  const rigApi = globalThis.__SSSRig;
  const meshPanel = document.querySelector('.mesh-panel');
  const inspector = document.querySelector('.rig-inspector');
  if (!meshApi?.state || !rigApi?.state || !(meshPanel instanceof HTMLElement) || !(inspector instanceof HTMLElement)) return false;
  meshTopologyInitialized = true;

  const mesh = meshApi.state;
  mesh.selectedVertexIndex ??= 0;

  const panel = document.createElement('section');
  panel.className = 'rig-section mesh-topology-panel';
  panel.innerHTML = `
    <div class="rig-section-head">
      <span class="rig-section-title">Topology & weights</span>
      <span class="rig-mode-badge">ADVANCED</span>
    </div>

    <div class="mesh-topology-stats" data-mesh-topology-stats>No mesh generated.</div>

    <div class="rig-field">
      <label>Vertex inspector</label>
      <div class="mesh-topology-index-row">
        <input id="meshVertexIndex" type="number" min="0" value="0" />
        <button class="btn" id="meshVertexPrev" title="Previous vertex">Prev</button>
        <button class="btn" id="meshVertexNext" title="Next vertex">Next</button>
      </div>
    </div>

    <div class="mesh-vertex-fields">
      <label><span>U</span><input id="meshVertexU" type="number" step="0.1" /></label>
      <label><span>V</span><input id="meshVertexV" type="number" step="0.1" /></label>
      <label><span>Offset X</span><input id="meshVertexOffsetX" type="number" step="0.1" /></label>
      <label><span>Offset Y</span><input id="meshVertexOffsetY" type="number" step="0.1" /></label>
    </div>

    <div class="rig-field">
      <label>Selected bone weight</label>
      <div class="mesh-weight-editor">
        <select id="meshVertexBone"></select>
        <input id="meshVertexWeight" type="number" min="0" max="1" step="0.01" value="1" />
      </div>
      <div class="mesh-actions compact">
        <button class="btn" id="meshSetWeight">Set weight</button>
        <button class="btn" id="meshRemoveWeight">Remove</button>
        <button class="btn" id="meshNormalizeVertex">Normalize vertex</button>
      </div>
      <div class="mesh-weight-readout" data-mesh-weight-readout>No weights.</div>
    </div>

    <div class="rig-field">
      <label>Topology</label>
      <button class="btn green" id="meshDelaunay" style="width:100%">Delaunay retriangulate</button>
      <div class="mesh-triangle-editor">
        <input id="meshTriangleA" type="number" min="0" placeholder="A" />
        <input id="meshTriangleB" type="number" min="0" placeholder="B" />
        <input id="meshTriangleC" type="number" min="0" placeholder="C" />
      </div>
      <div class="mesh-actions compact">
        <button class="btn" id="meshAddTriangle">Add triangle</button>
        <button class="btn" id="meshRemoveTriangle">Remove selected</button>
      </div>
      <select id="meshTriangleSelect" class="mesh-triangle-list"></select>
    </div>

    <div class="rig-field">
      <label>Weight cleanup</label>
      <div class="mesh-weight-cleanup">
        <label><span>Max influences</span><select id="meshMaxInfluences"><option value="2">2</option><option value="4" selected>4</option><option value="8">8</option></select></label>
        <label><span>Min weight</span><input id="meshMinWeight" type="number" min="0" max="1" step="0.01" value="0.02" /></label>
      </div>
      <div class="mesh-actions compact">
        <button class="btn" id="meshNormalizeAll">Normalize all</button>
        <button class="btn" id="meshPruneWeights">Prune + normalize</button>
      </div>
    </div>
  `;
  meshPanel.insertAdjacentElement('afterend', panel);

  const stats = panel.querySelector('[data-mesh-topology-stats]');
  const indexInput = panel.querySelector('#meshVertexIndex');
  const prevBtn = panel.querySelector('#meshVertexPrev');
  const nextBtn = panel.querySelector('#meshVertexNext');
  const uInput = panel.querySelector('#meshVertexU');
  const vInput = panel.querySelector('#meshVertexV');
  const offsetXInput = panel.querySelector('#meshVertexOffsetX');
  const offsetYInput = panel.querySelector('#meshVertexOffsetY');
  const boneSelect = panel.querySelector('#meshVertexBone');
  const weightInput = panel.querySelector('#meshVertexWeight');
  const setWeightBtn = panel.querySelector('#meshSetWeight');
  const removeWeightBtn = panel.querySelector('#meshRemoveWeight');
  const normalizeVertexBtn = panel.querySelector('#meshNormalizeVertex');
  const weightReadout = panel.querySelector('[data-mesh-weight-readout]');
  const delaunayBtn = panel.querySelector('#meshDelaunay');
  const triA = panel.querySelector('#meshTriangleA');
  const triB = panel.querySelector('#meshTriangleB');
  const triC = panel.querySelector('#meshTriangleC');
  const addTriangleBtn = panel.querySelector('#meshAddTriangle');
  const removeTriangleBtn = panel.querySelector('#meshRemoveTriangle');
  const triangleSelect = panel.querySelector('#meshTriangleSelect');
  const maxInfluencesSelect = panel.querySelector('#meshMaxInfluences');
  const minWeightInput = panel.querySelector('#meshMinWeight');
  const normalizeAllBtn = panel.querySelector('#meshNormalizeAll');
  const pruneBtn = panel.querySelector('#meshPruneWeights');

  const statusNode = () => document.querySelector('#meshStatus');

  function setStatus(text, active = true) {
    const node = statusNode();
    if (!(node instanceof HTMLElement)) return;
    node.textContent = text;
    node.classList.toggle('active', active);
  }

  function selectedVertex() {
    if (!mesh.vertices.length) return null;
    mesh.selectedVertexIndex = Math.max(0, Math.min(mesh.vertices.length - 1, Number(mesh.selectedVertexIndex) || 0));
    return mesh.vertices[mesh.selectedVertexIndex] || null;
  }

  function normalizeWeights(weights) {
    const entries = Object.entries(weights || {}).filter(([, value]) => Number(value) > 0.000001);
    const total = entries.reduce((sum, [, value]) => sum + Number(value), 0);
    if (total <= 0) return {};
    return Object.fromEntries(entries.map(([id, value]) => [id, Number(value) / total]));
  }

  function pruneWeights(weights, maxInfluences, minWeight) {
    const entries = Object.entries(weights || {})
      .map(([id, value]) => [id, Number(value)])
      .filter(([, value]) => Number.isFinite(value) && value >= minWeight)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxInfluences);
    return normalizeWeights(Object.fromEntries(entries));
  }

  function populateBones() {
    const current = boneSelect.value;
    boneSelect.innerHTML = '';
    rigApi.state.bones.forEach((bone) => {
      const option = document.createElement('option');
      option.value = bone.id;
      option.textContent = bone.name;
      boneSelect.append(option);
    });
    if (rigApi.state.bones.some((bone) => bone.id === current)) boneSelect.value = current;
    else if (mesh.selectedBoneId && rigApi.state.bones.some((bone) => bone.id === mesh.selectedBoneId)) boneSelect.value = mesh.selectedBoneId;
  }

  function triangleKey(triangle) {
    return [...triangle].sort((a, b) => a - b).join(':');
  }

  function refreshTriangleList() {
    const selectedKey = triangleSelect.value;
    triangleSelect.innerHTML = '';
    mesh.triangles.forEach((triangle, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `#${index} · ${triangle[0]}, ${triangle[1]}, ${triangle[2]}`;
      option.dataset.key = triangleKey(triangle);
      triangleSelect.append(option);
    });
    if (selectedKey && Number(selectedKey) < mesh.triangles.length) triangleSelect.value = selectedKey;
  }

  function renderVertexInspector() {
    populateBones();
    const vertex = selectedVertex();
    const hasVertex = Boolean(vertex);
    [indexInput, prevBtn, nextBtn, uInput, vInput, offsetXInput, offsetYInput, boneSelect, weightInput, setWeightBtn, removeWeightBtn, normalizeVertexBtn].forEach((control) => {
      if ('disabled' in control) control.disabled = !hasVertex;
    });

    if (!vertex) {
      indexInput.value = '0';
      uInput.value = '';
      vInput.value = '';
      offsetXInput.value = '';
      offsetYInput.value = '';
      weightReadout.textContent = 'No weights.';
      return;
    }

    indexInput.max = String(Math.max(0, mesh.vertices.length - 1));
    indexInput.value = String(mesh.selectedVertexIndex);
    uInput.value = String(Math.round(Number(vertex.u || 0) * 100) / 100);
    vInput.value = String(Math.round(Number(vertex.v || 0) * 100) / 100);
    offsetXInput.value = String(Math.round(Number(vertex.offsetX || 0) * 100) / 100);
    offsetYInput.value = String(Math.round(Number(vertex.offsetY || 0) * 100) / 100);

    const selectedBone = boneSelect.value;
    weightInput.value = String(Math.round(Number(vertex.weights?.[selectedBone] || 0) * 1000) / 1000);
    const names = new Map(rigApi.state.bones.map((bone) => [bone.id, bone.name]));
    const entries = Object.entries(vertex.weights || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
    weightReadout.textContent = entries.length
      ? entries.map(([id, value]) => `${names.get(id) || id}: ${(Number(value) * 100).toFixed(1)}%`).join(' · ')
      : 'No weights.';
  }

  function render() {
    stats.textContent = mesh.vertices.length
      ? `${mesh.vertices.length} vertices · ${mesh.triangles.length} triangles · vertex #${Math.min(mesh.selectedVertexIndex || 0, mesh.vertices.length - 1)}`
      : 'No mesh generated.';
    refreshTriangleList();
    renderVertexInspector();
  }

  function updateSelectedVertex() {
    const vertex = selectedVertex();
    if (!vertex) return;
    vertex.u = Number(uInput.value) || 0;
    vertex.v = Number(vInput.value) || 0;
    vertex.offsetX = Number(offsetXInput.value) || 0;
    vertex.offsetY = Number(offsetYInput.value) || 0;
    rigApi.draw();
    render();
  }

  function selectVertex(index) {
    if (!mesh.vertices.length) return;
    mesh.selectedVertexIndex = Math.max(0, Math.min(mesh.vertices.length - 1, Number(index) || 0));
    // The existing mesh renderer already highlights draggingVertex with a larger point.
    // Reuse it as a lightweight persistent selection indicator when not dragging.
    if (mesh.mode !== 'move' || mesh.draggingVertex < 0) mesh.draggingVertex = mesh.selectedVertexIndex;
    rigApi.draw();
    render();
  }

  function circumcircle(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-9) return null;
    const aa = a.x * a.x + a.y * a.y;
    const bb = b.x * b.x + b.y * b.y;
    const cc = c.x * c.x + c.y * c.y;
    const x = (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d;
    const y = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d;
    return { x, y, r2: (x - a.x) ** 2 + (y - a.y) ** 2 };
  }

  function delaunay(points) {
    if (points.length < 3) return [];
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const work = [
      ...points,
      { x: cx - span * 20, y: cy - span * 20 },
      { x: cx, y: cy + span * 20 },
      { x: cx + span * 20, y: cy - span * 20 }
    ];
    const superA = points.length;
    const superB = points.length + 1;
    const superC = points.length + 2;
    let triangles = [[superA, superB, superC]];

    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = work[pointIndex];
      const bad = [];
      triangles.forEach((triangle, index) => {
        const circle = circumcircle(work[triangle[0]], work[triangle[1]], work[triangle[2]]);
        if (!circle) return;
        const distance2 = (point.x - circle.x) ** 2 + (point.y - circle.y) ** 2;
        if (distance2 <= circle.r2 + 1e-7) bad.push(index);
      });

      const edgeCounts = new Map();
      bad.forEach((triangleIndex) => {
        const [a, b, c] = triangles[triangleIndex];
        [[a, b], [b, c], [c, a]].forEach(([u, v]) => {
          const key = u < v ? `${u}:${v}` : `${v}:${u}`;
          const existing = edgeCounts.get(key);
          if (existing) existing.count += 1;
          else edgeCounts.set(key, { edge: [u, v], count: 1 });
        });
      });

      const badSet = new Set(bad);
      triangles = triangles.filter((_, index) => !badSet.has(index));
      edgeCounts.forEach(({ edge, count }) => {
        if (count === 1) triangles.push([edge[0], edge[1], pointIndex]);
      });
    }

    return triangles
      .filter((triangle) => triangle.every((index) => index < points.length))
      .filter(([a, b, c]) => Math.abs((points[b].x - points[a].x) * (points[c].y - points[a].y) - (points[b].y - points[a].y) * (points[c].x - points[a].x)) > 1e-7);
  }

  function retriangulate() {
    if (mesh.vertices.length < 3) return setStatus('Generate a mesh with at least 3 vertices first.', false);
    const points = mesh.vertices.map((vertex) => ({
      x: Number(vertex.u || 0) + Number(vertex.offsetX || 0),
      y: Number(vertex.v || 0) + Number(vertex.offsetY || 0)
    }));
    const triangles = delaunay(points);
    if (!triangles.length) return setStatus('Delaunay could not produce a valid topology.', false);
    mesh.triangles = triangles;
    rigApi.draw();
    render();
    setStatus(`Delaunay topology generated: ${triangles.length} triangles.`, true);
  }

  function addTriangle() {
    const triangle = [Number(triA.value), Number(triB.value), Number(triC.value)].map((value) => Math.trunc(value));
    if (triangle.some((value) => !Number.isInteger(value) || value < 0 || value >= mesh.vertices.length)) {
      return setStatus(`Triangle indices must be between 0 and ${Math.max(0, mesh.vertices.length - 1)}.`, false);
    }
    if (new Set(triangle).size !== 3) return setStatus('Triangle needs three different vertices.', false);
    const key = triangleKey(triangle);
    if (mesh.triangles.some((item) => triangleKey(item) === key)) return setStatus('That triangle already exists.', false);
    mesh.triangles.push(triangle);
    rigApi.draw();
    render();
    triangleSelect.value = String(mesh.triangles.length - 1);
    setStatus(`Triangle ${triangle.join(', ')} added.`, true);
  }

  function removeSelectedTriangle() {
    const index = Number(triangleSelect.value);
    if (!Number.isInteger(index) || index < 0 || index >= mesh.triangles.length) return;
    const [removed] = mesh.triangles.splice(index, 1);
    rigApi.draw();
    render();
    setStatus(`Triangle ${removed.join(', ')} removed.`, true);
  }

  indexInput.addEventListener('change', () => selectVertex(indexInput.value));
  prevBtn.addEventListener('click', () => selectVertex((mesh.selectedVertexIndex || 0) - 1));
  nextBtn.addEventListener('click', () => selectVertex((mesh.selectedVertexIndex || 0) + 1));
  [uInput, vInput, offsetXInput, offsetYInput].forEach((input) => input.addEventListener('change', updateSelectedVertex));
  boneSelect.addEventListener('change', renderVertexInspector);

  setWeightBtn.addEventListener('click', () => {
    const vertex = selectedVertex();
    if (!vertex || !boneSelect.value) return;
    const value = Math.max(0, Math.min(1, Number(weightInput.value) || 0));
    vertex.weights ||= {};
    if (value <= 0) delete vertex.weights[boneSelect.value];
    else vertex.weights[boneSelect.value] = value;
    vertex.weights = normalizeWeights(vertex.weights);
    rigApi.draw();
    render();
    setStatus(`Vertex #${mesh.selectedVertexIndex} weights updated.`, true);
  });

  removeWeightBtn.addEventListener('click', () => {
    const vertex = selectedVertex();
    if (!vertex?.weights || !boneSelect.value) return;
    delete vertex.weights[boneSelect.value];
    vertex.weights = normalizeWeights(vertex.weights);
    rigApi.draw();
    render();
  });

  normalizeVertexBtn.addEventListener('click', () => {
    const vertex = selectedVertex();
    if (!vertex) return;
    vertex.weights = normalizeWeights(vertex.weights || {});
    rigApi.draw();
    render();
    setStatus(`Vertex #${mesh.selectedVertexIndex} normalized.`, true);
  });

  delaunayBtn.addEventListener('click', retriangulate);
  addTriangleBtn.addEventListener('click', addTriangle);
  removeTriangleBtn.addEventListener('click', removeSelectedTriangle);

  normalizeAllBtn.addEventListener('click', () => {
    mesh.vertices.forEach((vertex) => { vertex.weights = normalizeWeights(vertex.weights || {}); });
    rigApi.draw();
    render();
    setStatus(`Normalized weights on ${mesh.vertices.length} vertices.`, true);
  });

  pruneBtn.addEventListener('click', () => {
    const maxInfluences = Math.max(1, Number(maxInfluencesSelect.value) || 4);
    const minWeight = Math.max(0, Math.min(1, Number(minWeightInput.value) || 0));
    mesh.vertices.forEach((vertex) => { vertex.weights = pruneWeights(vertex.weights || {}, maxInfluences, minWeight); });
    rigApi.draw();
    render();
    setStatus(`Pruned weights to ≤${maxInfluences} influences and normalized all vertices.`, true);
  });

  // Mesh generation and rig changes happen outside this extension. Refresh lazily when the panel changes.
  const observer = new MutationObserver(() => render());
  observer.observe(meshPanel, { childList: true, subtree: true });
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target) return;
    if (['meshGenerate', 'meshAutoWeight', 'meshBind'].includes(target.id) || target.closest('.rig-overlay')) {
      setTimeout(render, 0);
    }
  });

  globalThis.__SSSMeshTopology = {
    retriangulate,
    normalizeAll() {
      mesh.vertices.forEach((vertex) => { vertex.weights = normalizeWeights(vertex.weights || {}); });
      rigApi.draw();
      render();
    },
    prune(maxInfluences = 4, minWeight = 0.02) {
      mesh.vertices.forEach((vertex) => { vertex.weights = pruneWeights(vertex.weights || {}, maxInfluences, minWeight); });
      rigApi.draw();
      render();
    },
    selectVertex
  };

  render();
  return true;
}

if (!initMeshTopology()) {
  const timer = window.setInterval(() => {
    if (!initMeshTopology()) return;
    window.clearInterval(timer);
  }, 100);
  window.setTimeout(() => window.clearInterval(timer), 15000);
}
