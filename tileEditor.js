function renderTileEditorTab() {
  const tab = document.getElementById('tile-editor-tab'); // reuse the Tile Maker tab, or add a new tab if you prefer
  tab.innerHTML = `
  <h2>Tile Editor (PNG)</h2>
  <div style="display:flex; gap:16px;">
    <div style="width:64px;">
      <div id="te-tool-panel" style="display:flex; flex-direction:column; gap:8px;">
        <button class="te-tool-btn" data-tool="pencil" title="Pencil"><span>✏️</span></button>
        <button class="te-tool-btn" data-tool="eraser" title="Eraser"><span>🧽</span></button>
        <button class="te-tool-btn" data-tool="picker" title="Eyedropper"><span>🎨</span></button>
        <button class="te-tool-btn" data-tool="fill" title="Fill"><span>🪣</span></button>
      </div>
      <div style="margin-top:16px;">
        <button id="te-undo" title="Undo">⏪</button>
        <button id="te-redo" title="Redo">⏩</button>
      </div>
    </div>
    <div style="flex:1; display:flex; flex-direction:column;">
      <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">
        <input type="file" id="te-file" accept="image/png" />
        <label>Color <input type="color" id="te-color" value="#ff00aa"/></label>
        <label>Brush <input type="number" id="te-brush" min="1" max="16" value="1" /></label>
        <button id="te-export">Export PNG</button>
        <label style="display:flex; gap:6px; align-items:center;">
          <input type="checkbox" id="te-grid" checked /> Grid
        </label>
        <button id="te-zoom-in" title="Zoom In">+</button>
        <button id="te-zoom-out" title="Zoom Out">-</button>
        <button id="te-zoom-reset" title="Reset Zoom">Reset</button>
      </div>
      <div style="flex:1; position:relative; background:#232634; border:1px solid #35374a;">
        <canvas id="te-canvas" style="image-rendering: pixelated; touch-action: none; cursor: crosshair;"></canvas>
      </div>
    </div>
  </div>
`;

const canvas = document.getElementById('te-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const colorEl = document.getElementById('te-color');
const brushEl = document.getElementById('te-brush');
const gridEl = document.getElementById('te-grid');

document.querySelectorAll('.te-tool-btn').forEach(b => {
    b.onclick = () => {
      setTool(b.dataset.tool);
      document.querySelectorAll('.te-tool-btn').forEach(btn => btn.classList.remove('active'));
      b.classList.add('active');
    };
});
// Set default active tool
document.querySelector('.te-tool-btn[data-tool="pencil"]').classList.add('active');

document.getElementById('te-undo').onclick = () => restoreFrom(undo, redo);
document.getElementById('te-redo').onclick = () => restoreFrom(redo, undo);

document.getElementById('te-zoom-in').onclick = () => {
    zoom = Math.min(64, zoom + 2);
    resizeCanvasView();
};
document.getElementById('te-zoom-out').onclick = () => {
    zoom = Math.max(2, zoom - 2);
    resizeCanvasView();
};
document.getElementById('te-zoom-reset').onclick = () => {
    zoom = 16;
    offset = { x: 0, y: 0 };
    resizeCanvasView();
};

document.getElementById('te-grid').onchange = () => draw();

// State
let imgCanvas = document.createElement('canvas'); // backing store
let imgCtx = imgCanvas.getContext('2d');
let imgData = null; // ImageData of backing store
let tool = 'pencil';
let zoom = 16; // pixels per image pixel
let offset = { x: 0, y: 0 };
let isPanning = false;
let isDrawing = false;
let lastPt = null;
let hoverPt = null;
const undo = [];
const redo = [];
const dpr = window.devicePixelRatio || 1;

// Helpers
function setTool(t) { tool = t; }
  function pushUndo() {
    if (!imgData) return;
    undo.push(new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height));
    if (undo.length > 50) undo.shift();
    redo.length = 0;
}

  function restoreFrom(stackFrom, stackTo) {
    if (!stackFrom.length) return;
    stackTo.push(new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height));
    imgData = stackFrom.pop();
    imgCtx.putImageData(imgData, 0, 0);
    draw();
}

  function resizeCanvasView() {
    const w = (imgData?.width || 32) * zoom;
    const h = (imgData?.height || 32) * zoom;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);

    // Resize the parent container to fit the canvas exactly
    const container = canvas.parentElement;
    if (container) {
        container.style.width = `${w}px`;
        container.style.height = `${h}px`;
        container.style.minWidth = `${w}px`;
        container.style.minHeight = `${h}px`;
        container.style.maxWidth = `${w}px`;
        container.style.maxHeight = `${h}px`;
    }
    draw();
}

function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!imgData) return;
    // draw image scaled
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(imgCanvas, 0, 0, imgCanvas.width, imgCanvas.height, 0, 0, imgCanvas.width * zoom, imgCanvas.height * zoom);
    // grid
    if (gridEl.checked && zoom >= 6) {
      ctx.strokeStyle = 'rgba(74,144,226,0.35)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= imgData.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * zoom + 0.5, 0);
        ctx.lineTo(x * zoom + 0.5, imgData.height * zoom);
        ctx.stroke();
      }
      for (let y = 0; y <= imgData.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * zoom + 0.5);
        ctx.lineTo(imgData.width * zoom, y * zoom + 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Brush highlight
    if (hoverPt && !isDrawing && !isPanning) {
        const r = Math.max(1, parseInt(brushEl.value, 10) || 1);
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = "#4a90e2";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(
        offset.x + hoverPt.x * zoom - Math.floor(r/2) * zoom,
        offset.y + hoverPt.y * zoom - Math.floor(r/2) * zoom,
        r * zoom,
        r * zoom
        );
        ctx.stroke();
        ctx.restore();
    }
}

  function toImgXY(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left - offset.x) / zoom;
    const cy = (e.clientY - rect.top - offset.y) / zoom;
    return { x: Math.floor(cx), y: Math.floor(cy) };
}

  function putPixel(x, y, rgba) {
    if (!imgData) return;
    if (x < 0 || y < 0 || x >= imgData.width || y >= imgData.height) return;
    const i = (y * imgData.width + x) * 4;
    imgData.data[i + 0] = rgba[0];
    imgData.data[i + 1] = rgba[1];
    imgData.data[i + 2] = rgba[2];
    imgData.data[i + 3] = rgba[3];
}

  function hexToRgba(hex) {
    const v = hex.replace('#', '');
    const r = parseInt(v.slice(0,2), 16);
    const g = parseInt(v.slice(2,4), 16);
    const b = parseInt(v.slice(4,6), 16);
    return [r,g,b,255];
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

function floodFill(seedX, seedY, target, replace) {
    if (!imgData) return;
    const w = imgData.width, h = imgData.height;
    const getAt = (x,y) => {
      const i = (y*w + x)*4; return [imgData.data[i], imgData.data[i+1], imgData.data[i+2], imgData.data[i+3]];
    };
    const eq = (a,b) => a[0]===b[0] && a[1]===b[1] && a[2]===b[2] && a[3]===b[3];
    if (eq(target, replace)) return;
    const q = [[seedX, seedY]];
    while (q.length) {
      const [x,y] = q.pop();
      if (x<0||y<0||x>=w||y>=h) continue;
      if (!eq(getAt(x,y), target)) continue;
      putPixel(x,y, replace);
      q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
}

// Import/export
document.getElementById('te-file').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgCanvas.width = img.width;
      imgCanvas.height = img.height;
      imgCtx.clearRect(0,0,img.width,img.height);
      imgCtx.drawImage(img, 0, 0);
      imgData = imgCtx.getImageData(0, 0, img.width, img.height);
      undo.length = 0; redo.length = 0;
      offset = { x: 0, y: 0 }; zoom = Math.max(8, Math.floor(512 / Math.max(img.width, img.height)));
      resizeCanvasView();
      draw();
      URL.revokeObjectURL(url);
    };
    img.src = url;
};

document.getElementById('te-export').onclick = () => {
    if (!imgData) return;
    imgCtx.putImageData(imgData, 0, 0);
    const a = document.createElement('a');
    a.download = 'tile.png';
    a.href = imgCanvas.toDataURL('image/png');
    a.click();
};

// Pointer events
canvas.addEventListener('pointerdown', (e) => {
    if (!imgData) return;
    canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.ctrlKey || e.metaKey || e.spaceKey) {
      isPanning = true;
      lastPt = { x: e.clientX, y: e.clientY };
      return;
    }
    pushUndo();
    isDrawing = true;
    const pt = toImgXY(e);
    if (tool === 'picker') {
      const i = (pt.y * imgData.width + pt.x) * 4;
      const r = imgData.data[i], g = imgData.data[i+1], b = imgData.data[i+2];
      colorEl.value = `#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}`;
      isDrawing = false;
    } else if (tool === 'fill') {
      const i = (pt.y * imgData.width + pt.x) * 4;
      const tgt = [imgData.data[i], imgData.data[i+1], imgData.data[i+2], imgData.data[i+3]];
      floodFill(pt.x, pt.y, tgt, hexToRgba(colorEl.value));
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
      offset.x += (e.clientX - lastPt.x);
      offset.y += (e.clientY - lastPt.y);
      lastPt = { x: e.clientX, y: e.clientY };
      draw();
      return;
    }
    if (!isDrawing && !isPanning) {
      hoverPt = toImgXY(e);
      draw();
    }
    if (!isDrawing || (tool !== 'pencil' && tool !== 'eraser')) return;
    const pt = toImgXY(e);
    line(lastPt, pt);
    lastPt = pt;
    imgCtx.putImageData(imgData, 0, 0);
    draw();
}, { passive: true });
  
canvas.addEventListener('pointerleave', () => {
    hoverPt = null;
    draw();
});

function endStroke(e) { isDrawing = false; isPanning = false; lastPt = null; }
  canvas.addEventListener('pointerup', endStroke, { passive: true });
  canvas.addEventListener('pointercancel', endStroke, { passive: true });

  // Init blank 32x32 if no import
  imgCanvas.width = 32; imgCanvas.height = 32;
  imgCtx.clearRect(0,0,32,32);
  imgData = imgCtx.getImageData(0, 0, 32, 32);
  resizeCanvasView();
  draw();
}