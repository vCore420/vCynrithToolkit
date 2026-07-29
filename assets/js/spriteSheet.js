let __ssInitialized = false;
function renderSpriteSheetTab() {
  // Only build once per session so frames/undo history/zoom/pan persist
  // across tab switches (same pattern as every other editor tab).
  if (__ssInitialized) return;
  __ssInitialized = true;

  const tab = document.getElementById('sprite-sheet-tab');
  tab.innerHTML = `
  <h2>Sprite Sheet Creator</h2>
  <div style="display:flex; gap:16px;">
    <div style="width:280px; display:flex; flex-direction:column; gap:12px;">
      <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px;">
        <legend>Layout</legend>
        <label>Preset:<br>
          <select id="ss-preset" style="width:100%;">
            <option value="character">Character (12-frame, 4-direction)</option>
            <option value="worldSprite">World Sprite (rows × cols loop)</option>
            <option value="custom">Custom (flat frame count)</option>
          </select>
        </label>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <label>Frame W:<br><input type="number" id="ss-frame-w" value="96" min="1" max="512" style="width:70px;"></label>
          <label>Frame H:<br><input type="number" id="ss-frame-h" value="96" min="1" max="512" style="width:70px;"></label>
        </div>
        <div id="ss-preset-options" style="margin-top:8px;"></div>
        <button id="ss-apply-layout" type="button" style="margin-top:8px;">Apply Layout</button>
        <div style="color:#9aa4b2; font-size:11px; margin-top:4px;">Changing frame W/H clears existing artwork (pixel data isn't auto-resized). Changing frame count alone keeps existing frames by position.</div>
      </fieldset>

      <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px;">
        <legend>Tools</legend>
        <div id="ss-tool-panel" style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px;">
          <button class="ss-tool-btn" data-tool="pencil" title="Pencil">✏️</button>
          <button class="ss-tool-btn" data-tool="eraser" title="Eraser">🧽</button>
          <button class="ss-tool-btn" data-tool="picker" title="Eyedropper">🧪</button>
          <button class="ss-tool-btn" data-tool="fill" title="Fill">🪣</button>
          <button class="ss-tool-btn" data-tool="rect" title="Rectangle">▭</button>
          <button class="ss-tool-btn" data-tool="line" title="Line">━</button>
          <button class="ss-tool-btn" data-tool="circle" title="Circle">◯</button>
          <button class="ss-tool-btn" data-tool="ellipse" title="Ellipse">◎</button>
        </div>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button id="ss-undo" title="Undo">↶ Undo</button>
          <button id="ss-redo" title="Redo">↷ Redo</button>
        </div>
        <div style="margin-top:8px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <label>Color <input type="color" id="ss-color" value="#ff00aa"/></label>
          <label>Brush <input type="number" id="ss-brush" min="1" max="16" value="1" style="width:50px;"/></label>
        </div>
        <label style="display:flex; gap:6px; align-items:center; margin-top:8px;">
          <input type="checkbox" id="ss-grid" checked/> Grid
        </label>
        <label style="display:flex; gap:6px; align-items:center;">
          <input type="checkbox" id="ss-onion" checked/> Onion Skin (previous frame)
        </label>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button id="ss-zoom-in" title="Zoom In">+</button>
          <button id="ss-zoom-out" title="Zoom Out">-</button>
          <button id="ss-zoom-reset" title="Reset Zoom">Reset</button>
        </div>
      </fieldset>

      <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px;">
        <legend>Frame Assist</legend>
        <div style="color:#9aa4b2; font-size:11px; margin-bottom:6px;">Starting points only — mirrored art usually needs a hand touch-up.</div>
        <div id="ss-assist-buttons" style="display:flex; flex-direction:column; gap:6px;"></div>
      </fieldset>

      <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px;">
        <legend>Import / Export</legend>
        <div style="color:#9aa4b2; font-size:11px; margin-bottom:6px;">Set the layout above to match the source sheet before importing.</div>
        <input type="file" id="ss-import" accept="image/png"/>
        <button id="ss-export" type="button" style="margin-top:8px; width:100%;">Export Sprite Sheet PNG</button>
      </fieldset>
    </div>

    <div style="flex:1; display:flex; flex-direction:column; gap:12px; min-width:0;">
      <div style="position:relative; background:#232634; border:1px solid #35374a; min-height:420px; display:flex; align-items:center; justify-content:center; overflow:auto;">
        <canvas id="ss-canvas" style="image-rendering:pixelated; touch-action:none; cursor:crosshair;"></canvas>
      </div>
      <div>
        <div style="color:#9aa4b2; font-size:12px; margin-bottom:4px;">Frames (click to switch):</div>
        <div id="ss-frame-strip" style="display:flex; gap:6px; flex-wrap:wrap; background:#232634; border:1px solid #35374a; padding:8px; border-radius:6px; min-height:60px;"></div>
      </div>
      <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px;">
        <legend>Animation Preview</legend>
        <div id="ss-preview-controls" style="display:flex; gap:8px; align-items:center;"></div>
        <canvas id="ss-preview-canvas" style="image-rendering:pixelated; background:#181a20; margin-top:8px; border:1px solid #35374a;"></canvas>
      </fieldset>
    </div>
  </div>
  `;

  const canvas = document.getElementById('ss-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const colorEl = document.getElementById('ss-color');
  const brushEl = document.getElementById('ss-brush');
  const gridEl = document.getElementById('ss-grid');
  const onionEl = document.getElementById('ss-onion');
  const dpr = window.devicePixelRatio || 1;

  // --- Layout / frame state ---
  let frameW = 96, frameH = 96;
  let preset = 'character';
  const directions = ['down', 'up', 'left', 'right']; // fixed order matching the game's shared `keys` table
  const framesPerDirection = 3;                        // step-A, neutral/idle, step-B (playback bounces 0,1,2,1)
  let rows = 1, cols = 4, animSpeed = 8;                // world sprite grid
  let customCount = 4;

  let frames = [];        // array of ImageData, one per frame
  let currentFrame = 0;
  let history = {};       // frameIndex -> { undo:[], redo:[] }

  let tool = 'pencil';
  let zoom = 8;
  let offset = { x: 0, y: 0 };
  let isPanning = false, spaceHeld = false;
  let isDrawing = false;
  let lastPt = null;
  let hoverPt = null;
  let shapeStart = null;
  let shapePreview = null;

  let imgCanvas = document.createElement('canvas'); // working view of the CURRENT frame only
  let imgCtx = imgCanvas.getContext('2d');
  let imgData = null; // always === frames[currentFrame]

  function makeBlankFrame(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c.getContext('2d').getImageData(0, 0, w, h);
  }

  function getTotalFrames() {
    if (preset === 'character') return directions.length * framesPerDirection;
    if (preset === 'worldSprite') return rows * cols;
    return customCount;
  }

  function getFrameLabel(i) {
    if (preset === 'character') {
      const dirIdx = Math.floor(i / framesPerDirection);
      const stepIdx = i % framesPerDirection;
      const stepNames = ['Step A', 'Neutral', 'Step B'];
      return `${directions[dirIdx]} — ${stepNames[stepIdx]}`;
    }
    if (preset === 'worldSprite') {
      return `row ${Math.floor(i / cols)}, col ${i % cols}`;
    }
    return `frame ${i}`;
  }

  // --- Tool panel wiring ---
  document.querySelectorAll('.ss-tool-btn').forEach(b => {
    b.onclick = () => {
      tool = b.dataset.tool;
      document.querySelectorAll('.ss-tool-btn').forEach(btn => btn.classList.remove('active'));
      b.classList.add('active');
    };
  });
  document.querySelector('.ss-tool-btn[data-tool="pencil"]').classList.add('active');

  document.getElementById('ss-undo').onclick = () => restoreFrom(getHistory().undo, getHistory().redo);
  document.getElementById('ss-redo').onclick = () => restoreFrom(getHistory().redo, getHistory().undo);

  document.getElementById('ss-zoom-in').onclick = () => { zoom = Math.min(64, zoom + 2); resizeCanvasView(); };
  document.getElementById('ss-zoom-out').onclick = () => { zoom = Math.max(2, zoom - 2); resizeCanvasView(); };
  document.getElementById('ss-zoom-reset').onclick = () => { zoom = 8; offset = { x: 0, y: 0 }; resizeCanvasView(); };

  attachCanvasZoomPan(canvas, {
    getZoom: () => zoom,
    setZoom: (z) => { zoom = z; },
    getOffset: () => offset,
    setOffset: (o) => { offset = o; },
    minZoom: 2,
    maxZoom: 64,
    zoomStep: 2,
    pinchZoomSpeed: 0.12,
    onChange: draw
  });

  gridEl.onchange = () => draw();
  onionEl.onchange = () => draw();

  document.getElementById('ss-preset').onchange = renderPresetOptions;
  document.getElementById('ss-apply-layout').onclick = applyLayout;

  function isTypingTarget(el) {
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    if (isTypingTarget(e.target)) return;
    if (!document.getElementById('sprite-sheet-tab').classList.contains('active')) return;
    if (!spaceHeld) { spaceHeld = true; canvas.style.cursor = 'grab'; }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    spaceHeld = false;
    if (!isPanning) canvas.style.cursor = 'crosshair';
  });
  window.addEventListener('blur', () => {
    spaceHeld = false;
    if (!isPanning) canvas.style.cursor = 'crosshair';
  });

  // --- Undo/redo (per frame, so undo only ever affects the frame you're looking at) ---
  function getHistory() {
    if (!history[currentFrame]) history[currentFrame] = { undo: [], redo: [] };
    return history[currentFrame];
  }
  function pushUndo() {
    if (!imgData) return;
    const h = getHistory();
    h.undo.push(new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height));
    if (h.undo.length > 50) h.undo.shift();
    h.redo.length = 0;
  }
  function restoreFrom(stackFrom, stackTo) {
    if (!stackFrom.length) return;
    stackTo.push(new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height));
    imgData = stackFrom.pop();
    frames[currentFrame] = imgData;
    imgCtx.putImageData(imgData, 0, 0);
    draw();
    renderFrameStrip();
  }

  // --- Frame switching ---
  function switchToFrame(i) {
    if (i < 0 || i >= frames.length) return;
    currentFrame = i;
    imgData = frames[i];
    imgCanvas.width = imgData.width;
    imgCanvas.height = imgData.height;
    imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    imgCtx.putImageData(imgData, 0, 0);
    resizeCanvasView();
    renderFrameStrip();
    renderAssistButtons();
    draw();
  }

  function resizeCanvasView() {
    const w = frameW * zoom, h = frameH * zoom;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    draw();
  }

  // --- Drawing primitives (same approach as the Tile Editor) ---
  function hexToRgba(hex) {
    const v = hex.replace('#', '');
    return [parseInt(v.slice(0,2),16), parseInt(v.slice(2,4),16), parseInt(v.slice(4,6),16), 255];
  }
  function putPixel(x, y, rgba) {
    if (!imgData || x < 0 || y < 0 || x >= imgData.width || y >= imgData.height) return;
    const i = (y * imgData.width + x) * 4;
    imgData.data[i] = rgba[0]; imgData.data[i+1] = rgba[1]; imgData.data[i+2] = rgba[2]; imgData.data[i+3] = rgba[3];
  }
  function drawBrush(pt) {
    const rgba = tool === 'eraser' ? [0,0,0,0] : hexToRgba(colorEl.value);
    const r = Math.max(1, parseInt(brushEl.value, 10) || 1);
    for (let dy = -Math.floor(r/2); dy < Math.ceil(r/2); dy++) {
      for (let dx = -Math.floor(r/2); dx < Math.ceil(r/2); dx++) {
        putPixel(pt.x + dx, pt.y + dy, rgba);
      }
    }
  }
  function line(a, b) {
    let x0=a.x, y0=a.y, x1=b.x, y1=b.y;
    const dx = Math.abs(x1-x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1-y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      drawBrush({x:x0,y:y0});
      if (x0===x1 && y0===y1) break;
      const e2 = 2*err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function drawRect(a, b, rgba) {
    const x0=Math.min(a.x,b.x), x1=Math.max(a.x,b.x), y0=Math.min(a.y,b.y), y1=Math.max(a.y,b.y);
    for (let x=x0; x<=x1; x++) for (let y=y0; y<=y1; y++) putPixel(x,y,rgba);
  }
  function drawCircle(a, b, rgba) {
    const r = Math.max(1, Math.round(Math.hypot(b.x-a.x, b.y-a.y)));
    for (let y=-r; y<=r; y++) for (let x=-r; x<=r; x++) if (x*x+y*y<=r*r) putPixel(a.x+x, a.y+y, rgba);
  }
  function drawEllipse(a, b, rgba) {
    const rx = Math.abs(b.x-a.x), ry = Math.abs(b.y-a.y);
    for (let y=-ry; y<=ry; y++) for (let x=-rx; x<=rx; x++) if (rx&&ry&&(x*x)/(rx*rx)+(y*y)/(ry*ry)<=1) putPixel(a.x+x, a.y+y, rgba);
  }
  function floodFill(seedX, seedY, target, replace) {
    if (!imgData) return;
    const w = imgData.width, h = imgData.height;
    const getAt = (x,y) => { const i=(y*w+x)*4; return [imgData.data[i],imgData.data[i+1],imgData.data[i+2],imgData.data[i+3]]; };
    const eq = (a,b) => a[0]===b[0]&&a[1]===b[1]&&a[2]===b[2]&&a[3]===b[3];
    if (eq(target, replace)) return;
    const q = [[seedX, seedY]];
    while (q.length) {
      const [x,y] = q.pop();
      if (x<0||y<0||x>=w||y>=h) continue;
      if (!eq(getAt(x,y), target)) continue;
      putPixel(x,y,replace);
      q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
  }
  function toImgXY(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: Math.floor((e.clientX - rect.left - offset.x) / zoom), y: Math.floor((e.clientY - rect.top - offset.y) / zoom) };
  }

  // --- Frame-assist: mirror/duplicate helpers ---
  function copyFrameInto(srcIdx, destIdx, mirror) {
    const src = frames[srcIdx];
    if (!src) return;
    const w = src.width, h = src.height;
    const dest = frames[destIdx];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = mirror ? (w - 1 - x) : x;
        const si = (y*w+sx)*4, di = (y*w+x)*4;
        dest.data[di]=src.data[si]; dest.data[di+1]=src.data[si+1]; dest.data[di+2]=src.data[si+2]; dest.data[di+3]=src.data[si+3];
      }
    }
    if (destIdx === currentFrame) { imgData = frames[currentFrame]; imgCtx.putImageData(imgData, 0, 0); }
  }

  function renderAssistButtons() {
    const container = document.getElementById('ss-assist-buttons');
    if (!container) return;
    const buttons = [];

    if (currentFrame > 0) {
      buttons.push({ label: 'Duplicate Previous Frame', action: () => copyFrameInto(currentFrame - 1, currentFrame, false) });
    }

    if (preset === 'character') {
      const dirIdx = Math.floor(currentFrame / framesPerDirection);
      const stepIdx = currentFrame % framesPerDirection;
      const dirBase = dirIdx * framesPerDirection;
      const dirName = directions[dirIdx];

      if (stepIdx === 2) buttons.push({ label: `Mirror Step A → Step B (${dirName})`, action: () => copyFrameInto(dirBase + 0, currentFrame, true) });
      if (stepIdx === 0) buttons.push({ label: `Mirror Step B → Step A (${dirName})`, action: () => copyFrameInto(dirBase + 2, currentFrame, true) });

      if (dirName === 'left' || dirName === 'right') {
        const otherName = dirName === 'left' ? 'right' : 'left';
        const otherDirIdx = directions.indexOf(otherName);
        const otherFrame = otherDirIdx * framesPerDirection + stepIdx;
        buttons.push({ label: `Mirror from ${otherName} (starting point)`, action: () => copyFrameInto(otherFrame, currentFrame, true) });
      }
    }

    container.innerHTML = buttons.map((b, i) => `<button type="button" class="ss-assist-btn" data-idx="${i}">${b.label}</button>`).join('');
    container.querySelectorAll('.ss-assist-btn').forEach(btn => {
      const b = buttons[Number(btn.dataset.idx)];
      btn.onclick = () => { pushUndo(); b.action(); draw(); renderFrameStrip(); };
    });
  }

  // --- Frame strip ---
  function renderFrameStrip() {
    const el = document.getElementById('ss-frame-strip');
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < frames.length; i++) {
      const thumb = document.createElement('canvas');
      thumb.width = 48; thumb.height = 48;
      thumb.style.cssText = `border:2px solid ${i === currentFrame ? '#4a90e2' : '#35374a'}; cursor:pointer; image-rendering:pixelated; background:#181a20; border-radius:4px;`;
      thumb.title = `${i}: ${getFrameLabel(i)}`;
      const tctx = thumb.getContext('2d');
      tctx.imageSmoothingEnabled = false;
      const frame = frames[i];
      if (frame) {
        const tmp = document.createElement('canvas');
        tmp.width = frame.width; tmp.height = frame.height;
        tmp.getContext('2d').putImageData(frame, 0, 0);
        tctx.drawImage(tmp, 0, 0, frame.width, frame.height, 0, 0, 48, 48);
      }
      thumb.onclick = () => switchToFrame(i);
      el.appendChild(thumb);
    }
  }

  // --- Layout / preset controls ---
  function renderPresetOptions() {
    const p = document.getElementById('ss-preset').value;
    const el = document.getElementById('ss-preset-options');
    if (p === 'character') {
      el.innerHTML = `<div style="color:#9aa4b2; font-size:11px;">Fixed layout: Down, Up, Left, Right × 3 frames = 12 total, matching the game's shared walk-cycle convention (playback bounces step-A → neutral → step-B → neutral).</div>`;
    } else if (p === 'worldSprite') {
      el.innerHTML = `
        <div style="display:flex; gap:8px;">
          <label>Rows:<br><input type="number" id="ss-rows" value="${rows}" min="1" max="20" style="width:60px;"></label>
          <label>Cols:<br><input type="number" id="ss-cols" value="${cols}" min="1" max="20" style="width:60px;"></label>
          <label>Anim Speed:<br><input type="number" id="ss-anim-speed" value="${animSpeed}" min="1" max="60" style="width:70px;"></label>
        </div>
        <div style="color:#9aa4b2; font-size:11px; margin-top:4px;">Matches WORLD_SPRITES: rows × cols, read left-to-right, top-to-bottom.</div>`;
    } else {
      el.innerHTML = `<label>Frame Count:<br><input type="number" id="ss-custom-count" value="${customCount}" min="1" max="64" style="width:70px;"></label>`;
    }
  }

  function applyLayout() {
    const newW = Math.max(1, Math.min(512, parseInt(document.getElementById('ss-frame-w').value, 10) || 96));
    const newH = Math.max(1, Math.min(512, parseInt(document.getElementById('ss-frame-h').value, 10) || 96));
    const newPreset = document.getElementById('ss-preset').value;

    let newCount;
    if (newPreset === 'character') {
      newCount = directions.length * framesPerDirection;
    } else if (newPreset === 'worldSprite') {
      rows = Math.max(1, parseInt(document.getElementById('ss-rows')?.value, 10) || 1);
      cols = Math.max(1, parseInt(document.getElementById('ss-cols')?.value, 10) || 1);
      animSpeed = Math.max(1, parseInt(document.getElementById('ss-anim-speed')?.value, 10) || 8);
      newCount = rows * cols;
    } else {
      customCount = Math.max(1, parseInt(document.getElementById('ss-custom-count')?.value, 10) || 4);
      newCount = customCount;
    }

    const dimensionsChanged = (newW !== frameW || newH !== frameH);
    const hasContent = frames.some(f => f && f.data.some(v => v !== 0));

    if (dimensionsChanged && hasContent) {
      const ok = confirm("Changing frame width/height clears all existing frame artwork (pixel data can't be auto-resized safely). Continue?");
      if (!ok) {
        document.getElementById('ss-frame-w').value = frameW;
        document.getElementById('ss-frame-h').value = frameH;
        document.getElementById('ss-preset').value = preset;
        renderPresetOptions();
        return;
      }
    }

    preset = newPreset;
    const oldFrames = frames;
    frameW = newW; frameH = newH;

    const newFrames = [];
    for (let i = 0; i < newCount; i++) {
      newFrames.push((!dimensionsChanged && oldFrames[i]) ? oldFrames[i] : makeBlankFrame(newW, newH));
    }
    frames = newFrames;
    history = {};
    currentFrame = Math.min(currentFrame, frames.length - 1);
    switchToFrame(currentFrame);
    renderPreviewControls();
    Autosave.save(SS_AUTOSAVE_KEY, serializeSSState());
  }

  // --- Animation preview ---
  let previewTimer = null;
  let previewDirection = 'down';

  function renderPreviewControls() {
    const el = document.getElementById('ss-preview-controls');
    if (!el) return;
    if (previewTimer) { clearInterval(previewTimer); previewTimer = null; }
    if (preset === 'character') {
      el.innerHTML = `
        <label>Direction:
          <select id="ss-preview-dir">${directions.map(d => `<option value="${d}" ${d===previewDirection?'selected':''}>${d}</option>`).join('')}</select>
        </label>
        <button id="ss-preview-play" type="button">▶ Play</button>`;
      document.getElementById('ss-preview-dir').onchange = e => { previewDirection = e.target.value; };
    } else {
      el.innerHTML = `<button id="ss-preview-play" type="button">▶ Play</button>`;
    }
    document.getElementById('ss-preview-play').onclick = togglePreviewPlayback;
    drawPreviewFrame(0);
  }

  function togglePreviewPlayback() {
    const btn = document.getElementById('ss-preview-play');
    if (previewTimer) {
      clearInterval(previewTimer);
      previewTimer = null;
      btn.textContent = '▶ Play';
      return;
    }
    btn.textContent = '⏸ Stop';
    let seq, tickMs;
    if (preset === 'character') {
      const dirIdx = directions.indexOf(previewDirection);
      const base = dirIdx * framesPerDirection;
      seq = [0, 1, 2, 1].map(off => base + off); // the game's actual walk-cycle bounce
      tickMs = 125; // matches the engine's real animation tick (player.js)
    } else if (preset === 'worldSprite') {
      seq = Array.from({ length: getTotalFrames() }, (_, i) => i);
      tickMs = Math.max(30, (animSpeed || 8) * 16); // approximation -- exact ms/tick depends on the main game loop, not available here
    } else {
      seq = Array.from({ length: getTotalFrames() }, (_, i) => i);
      tickMs = 150;
    }
    let i = 0;
    drawPreviewFrame(seq[0]);
    previewTimer = setInterval(() => {
      i = (i + 1) % seq.length;
      drawPreviewFrame(seq[i]);
    }, tickMs);
  }

  function drawPreviewFrame(frameIdx) {
    const pcanvas = document.getElementById('ss-preview-canvas');
    if (!pcanvas) return;
    const scale = 3;
    pcanvas.width = frameW * scale;
    pcanvas.height = frameH * scale;
    const pctx = pcanvas.getContext('2d');
    pctx.imageSmoothingEnabled = false;
    pctx.clearRect(0, 0, pcanvas.width, pcanvas.height);
    const frame = frames[frameIdx];
    if (!frame) return;
    const tmp = document.createElement('canvas');
    tmp.width = frame.width; tmp.height = frame.height;
    tmp.getContext('2d').putImageData(frame, 0, 0);
    pctx.drawImage(tmp, 0, 0, frame.width, frame.height, 0, 0, pcanvas.width, pcanvas.height);
  }

  // --- Main draw loop ---
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!imgData) return;
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.imageSmoothingEnabled = false;

    if (onionEl.checked && currentFrame > 0 && frames[currentFrame - 1]) {
      const prev = document.createElement('canvas');
      prev.width = frameW; prev.height = frameH;
      prev.getContext('2d').putImageData(frames[currentFrame - 1], 0, 0);
      ctx.globalAlpha = 0.3;
      ctx.drawImage(prev, 0, 0, frameW, frameH, 0, 0, frameW * zoom, frameH * zoom);
      ctx.globalAlpha = 1;
    }

    ctx.drawImage(imgCanvas, 0, 0, imgCanvas.width, imgCanvas.height, 0, 0, imgCanvas.width * zoom, imgCanvas.height * zoom);

    if (gridEl.checked && zoom >= 6) {
      ctx.strokeStyle = 'rgba(74,144,226,0.35)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= imgData.width; x++) { ctx.beginPath(); ctx.moveTo(x*zoom+0.5, 0); ctx.lineTo(x*zoom+0.5, imgData.height*zoom); ctx.stroke(); }
      for (let y = 0; y <= imgData.height; y++) { ctx.beginPath(); ctx.moveTo(0, y*zoom+0.5); ctx.lineTo(imgData.width*zoom, y*zoom+0.5); ctx.stroke(); }
    }
    ctx.restore();

    if (hoverPt && !isDrawing && !isPanning) {
      const r = Math.max(1, parseInt(brushEl.value, 10) || 1);
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#4a90e2";
      ctx.lineWidth = 2;
      ctx.strokeRect(offset.x + hoverPt.x*zoom - Math.floor(r/2)*zoom, offset.y + hoverPt.y*zoom - Math.floor(r/2)*zoom, r*zoom, r*zoom);
      ctx.restore();
    }
    if (isDrawing && shapeStart && shapePreview) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#4a90e2";
      ctx.lineWidth = 2;
      const a = shapeStart, b = shapePreview;
      if (tool === 'rect') ctx.strokeRect(offset.x+Math.min(a.x,b.x)*zoom, offset.y+Math.min(a.y,b.y)*zoom, (Math.abs(b.x-a.x)+1)*zoom, (Math.abs(b.y-a.y)+1)*zoom);
      if (tool === 'line') { ctx.beginPath(); ctx.moveTo(offset.x+a.x*zoom, offset.y+a.y*zoom); ctx.lineTo(offset.x+b.x*zoom, offset.y+b.y*zoom); ctx.stroke(); }
      if (tool === 'circle') { ctx.beginPath(); ctx.arc(offset.x+a.x*zoom, offset.y+a.y*zoom, Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)*zoom), 0, 2*Math.PI); ctx.stroke(); }
      if (tool === 'ellipse') { ctx.beginPath(); ctx.ellipse(offset.x+a.x*zoom, offset.y+a.y*zoom, Math.abs(b.x-a.x)*zoom, Math.abs(b.y-a.y)*zoom, 0, 0, 2*Math.PI); ctx.stroke(); }
      ctx.restore();
    }
    scheduleSSAutosave();
  }

  // --- Pointer events ---
  canvas.addEventListener('pointerdown', (e) => {
    if (!imgData) return;
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.ctrlKey || e.metaKey || spaceHeld) {
      isPanning = true; canvas.style.cursor = 'grabbing'; lastPt = { x: e.clientX, y: e.clientY }; return;
    }
    pushUndo();
    isDrawing = true;
    const pt = toImgXY(e);
    if (tool === 'picker') {
      const i = (pt.y * imgData.width + pt.x) * 4;
      if (i >= 0 && i < imgData.data.length) {
        const [r,g,b] = [imgData.data[i], imgData.data[i+1], imgData.data[i+2]];
        colorEl.value = `#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}`;
      }
    } else if (tool === 'fill') {
      const i = (pt.y * imgData.width + pt.x) * 4;
      const target = [imgData.data[i], imgData.data[i+1], imgData.data[i+2], imgData.data[i+3]];
      floodFill(pt.x, pt.y, target, hexToRgba(colorEl.value));
    } else if (tool === 'rect' || tool === 'line' || tool === 'circle' || tool === 'ellipse') {
      shapeStart = pt; shapePreview = pt;
    } else {
      lastPt = pt;
      drawBrush(pt);
    }
    imgCtx.putImageData(imgData, 0, 0);
    draw();
  }, { passive: true });

  canvas.addEventListener('pointermove', (e) => {
    if (!imgData) return;
    if (isPanning && lastPt) {
      offset.x += (e.clientX - lastPt.x); offset.y += (e.clientY - lastPt.y);
      lastPt = { x: e.clientX, y: e.clientY };
      draw(); return;
    }
    if (!isDrawing && !isPanning) { hoverPt = toImgXY(e); draw(); }
    if (isDrawing && (tool === 'rect' || tool === 'line' || tool === 'circle' || tool === 'ellipse')) {
      shapePreview = toImgXY(e); draw(); return;
    }
    if (!isDrawing || (tool !== 'pencil' && tool !== 'eraser')) return;
    const pt = toImgXY(e);
    line(lastPt, pt);
    lastPt = pt;
    imgCtx.putImageData(imgData, 0, 0);
    draw();
  }, { passive: true });

  canvas.addEventListener('pointerleave', () => { hoverPt = null; draw(); });

  canvas.addEventListener('pointerup', (e) => {
    if (isDrawing && shapeStart && shapePreview) {
      if (tool === 'rect') drawRect(shapeStart, shapePreview, hexToRgba(colorEl.value));
      if (tool === 'line') line(shapeStart, shapePreview);
      if (tool === 'circle') drawCircle(shapeStart, shapePreview, hexToRgba(colorEl.value));
      if (tool === 'ellipse') drawEllipse(shapeStart, shapePreview, hexToRgba(colorEl.value));
      if (['rect','line','circle','ellipse'].includes(tool)) {
        imgCtx.putImageData(imgData, 0, 0);
        shapeStart = null; shapePreview = null;
        draw();
      }
    }
    renderFrameStrip();
    endStroke();
  }, { passive: true });

  function endStroke() {
    isDrawing = false; isPanning = false; lastPt = null;
    canvas.style.cursor = spaceHeld ? 'grab' : 'crosshair';
  }
  canvas.addEventListener('pointerup', endStroke, { passive: true });
  canvas.addEventListener('pointercancel', endStroke, { passive: true });

  // --- Import / Export ---
  document.getElementById('ss-import').onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const total = getTotalFrames();
      const c = preset === 'worldSprite' ? cols : total;
      const tmp = document.createElement('canvas');
      tmp.width = img.width; tmp.height = img.height;
      const tctx = tmp.getContext('2d');
      tctx.drawImage(img, 0, 0);

      const newFrames = [];
      for (let i = 0; i < total; i++) {
        const col = i % c, row = Math.floor(i / c);
        try {
          newFrames.push(tctx.getImageData(col * frameW, row * frameH, frameW, frameH));
        } catch (err) {
          newFrames.push(makeBlankFrame(frameW, frameH));
        }
      }
      frames = newFrames;
      history = {};
      currentFrame = 0;
      switchToFrame(0);
      URL.revokeObjectURL(url);
      Autosave.save(SS_AUTOSAVE_KEY, serializeSSState());
    };
    img.src = url;
  };

  function drawFrameOnto(sctx, frameData, x, y) {
    if (!frameData) return;
    const tmp = document.createElement('canvas');
    tmp.width = frameData.width; tmp.height = frameData.height;
    tmp.getContext('2d').putImageData(frameData, 0, 0);
    sctx.drawImage(tmp, x, y);
  }

  document.getElementById('ss-export').onclick = () => {
    const total = frames.length;
    const sheet = document.createElement('canvas');
    let sctx;
    if (preset === 'worldSprite') {
      sheet.width = frameW * cols; sheet.height = frameH * rows;
      sctx = sheet.getContext('2d');
      for (let i = 0; i < total; i++) drawFrameOnto(sctx, frames[i], (i % cols) * frameW, Math.floor(i / cols) * frameH);
    } else {
      // character & custom presets: single row, matching the engine's actual sheet layout
      sheet.width = frameW * total; sheet.height = frameH;
      sctx = sheet.getContext('2d');
      for (let i = 0; i < total; i++) drawFrameOnto(sctx, frames[i], i * frameW, 0);
    }
    const a = document.createElement('a');
    a.download = 'sprite_sheet.png';
    a.href = sheet.toDataURL('image/png');
    a.click();
  };

  // --- Autosave ---
  const SS_AUTOSAVE_KEY = 'spriteSheet';

  function frameToDataURL(frameData) {
    const c = document.createElement('canvas');
    c.width = frameData.width; c.height = frameData.height;
    c.getContext('2d').putImageData(frameData, 0, 0);
    return c.toDataURL('image/png');
  }
  async function dataURLToFrame(dataUrl, w, h) {
    const img = await Autosave.dataUrlToImage(dataUrl);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cctx = c.getContext('2d');
    cctx.drawImage(img, 0, 0);
    return cctx.getImageData(0, 0, w, h);
  }

  function serializeSSState() {
    return {
      frameW, frameH, preset, rows, cols, animSpeed, customCount,
      currentFrame, zoom, offset,
      tool, color: colorEl.value, brush: brushEl.value,
      grid: gridEl.checked, onion: onionEl.checked,
      frames: frames.map(f => f ? frameToDataURL(f) : null)
    };
  }

  const scheduleSSAutosave = Autosave.debounce(() => {
    Autosave.save(SS_AUTOSAVE_KEY, serializeSSState());
  }, 1200);

  async function restoreSSAutosave() {
    const saved = await Autosave.load(SS_AUTOSAVE_KEY);
    if (!saved) return;
    try {
      frameW = saved.frameW || 96;
      frameH = saved.frameH || 96;
      preset = saved.preset || 'character';
      rows = saved.rows || 1;
      cols = saved.cols || 4;
      animSpeed = saved.animSpeed || 8;
      customCount = saved.customCount || 4;
      zoom = saved.zoom || 8;
      offset = saved.offset || { x: 0, y: 0 };

      const loaded = [];
      for (const durl of (saved.frames || [])) {
        loaded.push(durl ? await dataURLToFrame(durl, frameW, frameH) : makeBlankFrame(frameW, frameH));
      }
      frames = loaded.length ? loaded : [makeBlankFrame(frameW, frameH)];
      history = {};

      document.getElementById('ss-preset').value = preset;
      document.getElementById('ss-frame-w').value = frameW;
      document.getElementById('ss-frame-h').value = frameH;
      renderPresetOptions();

      if (saved.color) colorEl.value = saved.color;
      if (saved.brush) brushEl.value = saved.brush;
      if (typeof saved.grid === 'boolean') gridEl.checked = saved.grid;
      if (typeof saved.onion === 'boolean') onionEl.checked = saved.onion;
      tool = saved.tool || 'pencil';
      document.querySelectorAll('.ss-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));

      currentFrame = Math.min(saved.currentFrame || 0, frames.length - 1);
      switchToFrame(currentFrame);
      renderPreviewControls();
    } catch (err) {
      console.warn('Sprite Sheet Creator: failed to restore autosave', err);
    }
  }

  // --- Init ---
  renderPresetOptions();
  frames = [makeBlankFrame(frameW, frameH)];
  switchToFrame(0);
  renderPreviewControls();

  restoreSSAutosave();
}
