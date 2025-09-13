let lastImageData = null; 
let lastOpts = null;   

// Utility: Seeded RNG
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Preset Palettes 
const palettes = [
  { name: "Pastel", colors: ['#22223B', '#4A4E69', '#9A8C98', '#C9ADA7', '#F2E9E4'] },
  { name: "Neon", colors: ['#1a1a1a', '#333333', '#FF5555', '#50FA7B', '#BD93F9', '#F1FA8C'] },
  { name: "Retro", colors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFA500', '#800080'] },
  { name: "Ocean", colors: ['#013A63', '#1E6091', '#76C893', '#A9D6E5', '#168AAD'] },
  { name: "Fire", colors: ['#FF9900', '#FF3300', '#FF6600', '#FFCC00', '#660000'] }
];

// Each palette is editable (except presets are resettable)
let workingPalettes = palettes.map(p => [...p.colors]);
let customPalette = [];
let currentPaletteIndex = 0; 

const paletteSelect = document.getElementById('palette');
paletteSelect.innerHTML = '';
palettes.forEach((p, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = p.name;
  paletteSelect.appendChild(opt);
});
const customOpt = document.createElement('option');
customOpt.value = 'custom';
customOpt.textContent = 'Custom';
paletteSelect.appendChild(customOpt);

const paletteSwatches = document.getElementById('paletteSwatches');

// Show swatches and allow removing colors
function updatePaletteSwatches() {
  paletteSwatches.innerHTML = '';
  let paletteArr = (currentPaletteIndex === 'custom') ? customPalette : workingPalettes[currentPaletteIndex];
  paletteArr.forEach((color, idx) => {
    const swatch = document.createElement('div');
    swatch.className = 'paletteColor';
    swatch.style.background = color;

    const remove = document.createElement('span');
    remove.className = 'removeColor';
    remove.textContent = '×';
    remove.title = 'Remove color';
    remove.onclick = (e) => {
      e.stopPropagation();
      if (currentPaletteIndex === 'custom') {
        customPalette.splice(idx, 1);
      } else {
        workingPalettes[currentPaletteIndex].splice(idx, 1);
      }
      updatePaletteSwatches();
      initialGenerate();
    };
    swatch.appendChild(remove);

    paletteSwatches.appendChild(swatch);
  });
}

// When palette changes
paletteSelect.onchange = function() {
  if (paletteSelect.value === 'custom') {
    currentPaletteIndex = 'custom';
    // If customPalette is empty, start blank
    if (customPalette.length === 0) customPalette = [];
  } else {
    currentPaletteIndex = parseInt(paletteSelect.value);
    // Reset to original preset if empty
    if (workingPalettes[currentPaletteIndex].length === 0) {
      workingPalettes[currentPaletteIndex] = palettes[currentPaletteIndex].colors.slice();
    }
  }
  updatePaletteSwatches();
  initialGenerate();
};

// Add color to palette
document.getElementById('addColorBtn').onclick = () => {
  const color = document.getElementById('addColor').value;
  let paletteArr = (currentPaletteIndex === 'custom') ? customPalette : workingPalettes[currentPaletteIndex];
  if (!paletteArr.includes(color)) {
    paletteArr.push(color);
    updatePaletteSwatches();
    initialGenerate();
  }
};

// Canvas Setup 
const canvas = document.getElementById('tileCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
ctx.imageSmoothingEnabled = false;

// Ui Controls ----
function getControls() {
  let paletteArr = (currentPaletteIndex === 'custom')
    ? (customPalette.length > 0 ? customPalette : ['#000'])
    : (workingPalettes[currentPaletteIndex].length > 0 ? workingPalettes[currentPaletteIndex] : ['#000']);
  return {
    size: parseInt(document.getElementById('size').value),
    symmetry: document.getElementById('symmetry').value,
    pattern: document.getElementById('pattern').value,
    density: parseFloat(document.getElementById('density').value),
    palette: paletteArr,
    transparency: document.getElementById('transparency').checked,
    border: document.getElementById('border').checked,
    seed: document.getElementById('seed').value || Math.floor(Math.random() * 1e9),
    definition: parseInt(document.getElementById('definition').value),
    clarity: parseInt(document.getElementById('clarity').value)
  };
}

// Tile Generation
function generateTile(opts) {
  ctx.clearRect(0, 0, opts.size, opts.size);

  // Apply blur filter based on clarity value (0 = sharp, >0 = blurry)
  ctx.filter = opts.clarity > 0 ? `blur(${opts.clarity}px)` : 'none';

  const blockSize = opts.definition;
  const blocks = Math.floor(opts.size / blockSize);

  // Border
  if (opts.border) {
    ctx.fillStyle = "#C9ADA7";
    ctx.fillRect(0, 0, opts.size, 1);
    ctx.fillRect(0, opts.size - 1, opts.size, 1);
    ctx.fillRect(0, 0, 1, opts.size);
    ctx.fillRect(opts.size - 1, 0, 1, opts.size);
  }

  // Seeded random
  const rand = mulberry32(hashCode(opts.seed.toString()));

  // Draw blocks instead of pixels
  for (let bx = 0; bx < blocks; bx++) {
    for (let by = 0; by < blocks; by++) {
      let x = bx * blockSize;
      let y = by * blockSize;

      // Border block logic
      if (opts.border && (bx === 0 || bx === blocks - 1 || by === 0 || by === blocks - 1)) continue;

      // Pattern logic
      let draw = false;
      let color = null;
      switch (opts.pattern) {
        case "random":
          draw = rand() < opts.density;
          break;
        case "checker":
          draw = ((bx + by) % 2 === 0);
          break;
        case "stripes":
          draw = (bx % 2 === 0);
          break;
        case "hstripes":
          draw = (by % 2 === 0);
          break;
        case "gradient":
          draw = rand() < (bx / blocks);
          break;
        case "border":
          draw = (bx === 0 || bx === blocks - 1 || by === 0 || by === blocks - 1);
          break;
        case "circle":
          let cx = blocks / 2;
          let cy = blocks / 2;
          let r = blocks / 2.5;
          draw = ((bx - cx) ** 2 + (by - cy) ** 2 < r * r);
          break;
          case "diagonal":
            draw = ((bx + by) % 4 === 0);
            break;
          case "cross":
            draw = (bx === Math.floor(blocks / 2) || by === Math.floor(blocks / 2));
            break;
          case "diamond":
            let dx = Math.abs(bx - blocks / 2);
            let dy = Math.abs(by - blocks / 2);
            draw = (dx + dy < blocks / 2);
            break;
          case "spiral":
            let angle = Math.atan2(by - blocks / 2, bx - blocks / 2);
            let radius = Math.sqrt((bx - blocks / 2) ** 2 + (by - blocks / 2) ** 2);
            draw = Math.abs((angle * blocks / Math.PI + radius) % 6) < 2;
            break;
          case "dots":
            draw = ((bx % 3 === 0) && (by % 3 === 0));
            break;
      }

      // Choose color
      if (draw) {
        color = opts.palette[Math.floor(rand() * opts.palette.length)];
      } else {
        // If transparency is off, fill with background color
        color = opts.transparency ? "rgba(0,0,0,0)" : opts.palette[0];
      }

      // Symmetry logic (same as before)
      if (opts.symmetry === "vertical") {
        if (bx < blocks / 2) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, blockSize, blockSize);
          ctx.fillRect(opts.size - blockSize - x, y, blockSize, blockSize);
        }
      } else if (opts.symmetry === "horizontal") {
        if (by < blocks / 2) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, blockSize, blockSize);
          ctx.fillRect(x, opts.size - blockSize - y, blockSize, blockSize);
        }
      } else if (opts.symmetry === "radial") {
        if (bx < blocks / 2 && by < blocks / 2) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, blockSize, blockSize);
          ctx.fillRect(opts.size - blockSize - x, y, blockSize, blockSize);
          ctx.fillRect(x, opts.size - blockSize - y, blockSize, blockSize);
          ctx.fillRect(opts.size - blockSize - x, opts.size - blockSize - y, blockSize, blockSize);
        }
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, blockSize, blockSize);
      }
    }
  }
  ctx.filter = 'none';
  lastImageData = ctx.getImageData(0, 0, opts.size, opts.size);
  lastOpts = { ...opts };
}


// Hash for Seeded RNG 
function hashCode(str) {
  let hash = 0, i, chr;
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
}

// UI Handlers 
function updateDensityValue() {
  document.getElementById('densityValue').textContent = document.getElementById('density').value;
}

function updateZoom() {
  const zoom = parseInt(document.getElementById('zoom').value);
  document.getElementById('zoomValue').textContent = `${zoom}x`;
  canvas.style.width = (canvas.width * zoom) + "px";
  canvas.style.height = (canvas.height * zoom) + "px";
  canvas.style.imageRendering = 'pixelated'; 
  ctx.imageSmoothingEnabled = false;        
}

function applyTransparency() {
  if (!lastImageData || !lastOpts) return;
  const imageData = ctx.createImageData(lastImageData);
  imageData.data.set(lastImageData.data);

  const bgColor = hexToRgb(lastOpts.palette[0]);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    if (r === bgColor.r && g === bgColor.g && b === bgColor.b) {
      imageData.data[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  updateZoom();
}

function applyBorder() {
  if (!lastImageData || !lastOpts) return;
  const imageData = ctx.createImageData(lastImageData);
  imageData.data.set(lastImageData.data);

  const size = lastOpts.size;
  const borderColor = { r: 201, g: 173, b: 167, a: 255 }; 
  for (let x = 0; x < size; x++) {
    setPixel(imageData, x, 0, borderColor);
    setPixel(imageData, x, size - 1, borderColor);
  }
  for (let y = 0; y < size; y++) {
    setPixel(imageData, 0, y, borderColor);
    setPixel(imageData, size - 1, y, borderColor);
  }
  ctx.putImageData(imageData, 0, 0);
  updateZoom();
}

// Helper to set a pixel in ImageData
function setPixel(imageData, x, y, color) {
  const idx = (y * imageData.width + x) * 4;
  imageData.data[idx] = color.r;
  imageData.data[idx + 1] = color.g;
  imageData.data[idx + 2] = color.b;
  imageData.data[idx + 3] = color.a;
}

// Helper to convert hex to rgb
function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// Initial Setup 
function initialGenerate() {
  const opts = getControls();
  const blocks = Math.floor(opts.size / opts.definition);
  const adjustedSize = blocks * opts.definition;
  canvas.width = adjustedSize;
  canvas.height = adjustedSize;
  opts.size = adjustedSize; 
  generateTile(opts);
  updateZoom();
}

// Event Listeners 
document.getElementById('generate').onclick = initialGenerate;
document.getElementById('size').onchange = initialGenerate;
document.getElementById('symmetry').onchange = initialGenerate;
document.getElementById('pattern').onchange = initialGenerate;
document.getElementById('density').oninput = () => { updateDensityValue(); initialGenerate(); };
document.getElementById('transparency').onchange = function() {
  if (this.checked) {
    applyTransparency();
  } else {
    ctx.putImageData(lastImageData, 0, 0);
    updateZoom();
  }
};
document.getElementById('border').onchange = function() {
  if (this.checked) {
    applyBorder();
  } else {
    ctx.putImageData(lastImageData, 0, 0);
    updateZoom();
  }
};
document.getElementById('seed').oninput = initialGenerate;
document.getElementById('zoom').oninput = updateZoom;
document.getElementById('randomSeed').onclick = () => {
  document.getElementById('seed').value = Math.floor(Math.random() * 1e9);
  initialGenerate();
};
document.getElementById('definition').oninput = function() {
  document.getElementById('definitionValue').textContent = this.value;
  initialGenerate();
};
document.getElementById('clarity').oninput = function() {
  document.getElementById('clarityValue').textContent = this.value;
  initialGenerate();
};

document.getElementById('download').onclick = () => {
  const link = document.createElement('a');
  link.download = 'tile.png';
  link.href = canvas.toDataURL();
  link.click();
};

// Persistent Settings 
function saveSettings() {
  const opts = getControls();
  localStorage.setItem('vTileGenSettings', JSON.stringify({
    palette: paletteSelect.value,
    customPalette,
    size: opts.size,
    symmetry: opts.symmetry,
    pattern: opts.pattern,
    density: opts.density,
    definition: opts.definition,
    clarity: opts.clarity,
    transparency: opts.transparency,
    border: opts.border,
    seed: document.getElementById('seed').value,
    zoom: document.getElementById('zoom').value
  }));
}

function loadSettings() {
  const data = localStorage.getItem('vTileGenSettings');
  if (!data) return;
  try {
    const s = JSON.parse(data);
    paletteSelect.value = s.palette ?? 0;
    currentPaletteIndex = paletteSelect.value === 'custom' ? 'custom' : parseInt(paletteSelect.value);
    customPalette = Array.isArray(s.customPalette) ? s.customPalette : [];
    document.getElementById('size').value = s.size ?? 32;
    document.getElementById('symmetry').value = s.symmetry ?? 'vertical';
    document.getElementById('pattern').value = s.pattern ?? 'random';
    document.getElementById('density').value = s.density ?? 0.7;
    document.getElementById('definition').value = s.definition ?? 1;
    document.getElementById('clarity').value = s.clarity ?? 0;
    document.getElementById('transparency').checked = !!s.transparency;
    document.getElementById('border').checked = !!s.border;
    document.getElementById('seed').value = s.seed ?? '';
    document.getElementById('zoom').value = s.zoom ?? 8;
  } catch (e) {}
}

// Save settings on any change
[
  'palette','size','symmetry','pattern','density','definition','clarity',
  'transparency','border','seed','zoom'
].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', saveSettings);
    el.addEventListener('input', saveSettings);
  }
});
document.getElementById('addColorBtn').addEventListener('click', saveSettings);


// On Load
loadSettings();
paletteSelect.value = paletteSelect.value ?? 0;
currentMode = 0;
initialGenerate();
updatePaletteSwatches();
updateDensityValue();
updateZoom();