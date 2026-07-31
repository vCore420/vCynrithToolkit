function setupTileMaker() {
    // ---- Seeded, position-based noise ----
    // Unlike a sequential RNG stream, hash2D's output only depends on
    // (seed, x, y) -- meaning sampling at x=0 and x=blocks (i.e. where the
    // *next* tile over would start) can be made to return the identical
    // value, which is what actually makes seamless tiling possible. Every
    // pattern below samples through this (or valueNoise2D, built on top of
    // it) instead of a plain rand() stream.
    function hashCode(str) {
        let hash = 0, i, chr;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
    }

    function hash2D(seed, x, y) {
        let h = seed | 0;
        h = Math.imul(h ^ Math.imul(x | 0, 0x27d4eb2d), 0x9e3779b1);
        h = Math.imul(h ^ Math.imul(y | 0, 0x165667b1), 0x85ebca6b);
        h ^= h >>> 15;
        h = Math.imul(h, 0xc2b2ae35);
        h ^= h >>> 13;
        return ((h >>> 0) % 1000000) / 1000000;
    }

    // Smoothed, wrapped value noise: samples a coarser grid (spacing =
    // `scale` blocks) and bilinearly interpolates between grid points, with
    // grid coordinates wrapped modulo the tile's block count so the pattern
    // repeats cleanly at the edges. Bigger `scale` = larger, smoother blobs
    // (good for grass/dirt clumps); smaller = finer grain (stone/sand).
    function valueNoise2D(seed, x, y, scale, blocks) {
        const gx = x / scale, gy = y / scale;
        const gridSize = Math.max(1, Math.ceil(blocks / scale));
        const x0 = Math.floor(gx), y0 = Math.floor(gy);
        const sx = gx - x0, sy = gy - y0;
        const wrap = v => ((v % gridSize) + gridSize) % gridSize;
        const h00 = hash2D(seed, wrap(x0), wrap(y0));
        const h10 = hash2D(seed, wrap(x0 + 1), wrap(y0));
        const h01 = hash2D(seed, wrap(x0), wrap(y0 + 1));
        const h11 = hash2D(seed, wrap(x0 + 1), wrap(y0 + 1));
        const smooth = t => t * t * (3 - 2 * t);
        const sxs = smooth(sx), sys = smooth(sy);
        const top = h00 + (h10 - h00) * sxs;
        const bottom = h01 + (h11 - h01) * sxs;
        return top + (bottom - top) * sys;
    }

    // Picks a noise grid scale that's always an EXACT fraction of `blocks`
    // (i.e. blocks/scale is always a whole number), which is what makes
    // valueNoise2D's wrapping mathematically exact regardless of how "ugly"
    // blocks is (including small or prime counts). A naive Math.max(2, ...)
    // clamp would silently break seamlessness for those cases instead.
    function seamlessScale(blocks, preferredDivisor) {
        let divisor = preferredDivisor;
        while (divisor > 1 && blocks / divisor < 2) divisor--;
        return blocks / divisor;
    }

    // 4x4 ordered (Bayer) dither matrix, normalized to 0..1. Used to jitter
    // the threshold between two adjacent palette shades per-pixel instead of
    // a hard cutoff -- the classic pixel-art dithered-gradient look.
    const BAYER_4X4 = [
        [0, 8, 2, 10],
        [12, 4, 14, 6],
        [3, 11, 1, 9],
        [15, 7, 13, 5]
    ].map(row => row.map(v => (v + 0.5) / 16));

    // Maps a 0..1 noise value onto a palette (treated as a shade ramp, darkest
    // first). Without dithering, rounds to the nearest shade band; with it,
    // uses the Bayer matrix to decide whether to bump to the next band up.
    function shadeFromNoise(noiseVal, palette, bx, by, dither) {
        const n = palette.length;
        if (n === 1) return palette[0];
        const scaled = Math.min(0.999999, Math.max(0, noiseVal)) * (n - 1);
        const lo = Math.floor(scaled);
        const hi = Math.min(n - 1, lo + 1);
        const frac = scaled - lo;
        if (!dither) return palette[Math.round(scaled)];
        const threshold = BAYER_4X4[by % 4][bx % 4];
        return frac > threshold ? palette[hi] : palette[lo];
    }

    // ---- Palettes ----
    const palettes = [
        { name: "Pastel", colors: ['#22223B', '#4A4E69', '#9A8C98', '#C9ADA7', '#F2E9E4'] },
        { name: "Neon", colors: ['#1a1a1a', '#333333', '#FF5555', '#50FA7B', '#BD93F9', '#F1FA8C'] },
        { name: "Retro", colors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFA500', '#800080'] },
        { name: "Ocean", colors: ['#013A63', '#1E6091', '#76C893', '#A9D6E5', '#168AAD'] },
        { name: "Fire", colors: ['#FF9900', '#FF3300', '#FF6600', '#FFCC00', '#660000'] },
        { name: "Grass", colors: ['#1a2e1a', '#2d4a2d', '#4a7a3a', '#6b9c4f', '#8fc767'] },
        { name: "Dirt", colors: ['#2b1a0f', '#4a2f1a', '#6b4423', '#8a5a2f', '#a67b4d'] },
        { name: "Stone", colors: ['#2a2a2e', '#45454a', '#63636b', '#84848c', '#a8a8b0'] },
        { name: "Sand", colors: ['#5c4a2e', '#8a6d3f', '#c2a05e', '#dbc086', '#f0dfae'] },
        { name: "Water", colors: ['#0d2b45', '#164863', '#1e6b8c', '#3d94b0', '#7cc4d4'] },
        { name: "Wood", colors: ['#2e1a0f', '#4a2f1c', '#6b4726', '#8f6338', '#b0824f'] },
        { name: "Brick", colors: ['#2e1210', '#5c1f1a', '#8a2f24', '#a8452f', '#c46a45'] },
        { name: "Snow", colors: ['#c8d4dc', '#dce4e8', '#eef3f5', '#f8fafb', '#ffffff'] }
    ];
    let workingPalettes = palettes.map(p => [...p.colors]);
    let customPalette = [];
    let currentPaletteIndex = 0;

    // ---- Material Presets ----
    // One-click starting points for real textures -- sets palette + pattern +
    // grain/clarity/dither to something sensible, which can still be hand-
    // tuned afterward. `definition` here is deliberately small (fine grain),
    // since coarse pixel-art world tiles usually want per-pixel-ish variation
    // rather than big blocky cells.
    const materialPresets = {
        grass: { paletteName: "Grass", pattern: "organic", density: 0.5, definition: 1, clarity: 0, dither: false },
        dirt: { paletteName: "Dirt", pattern: "organic", density: 0.45, definition: 1, clarity: 0, dither: true },
        stone: { paletteName: "Stone", pattern: "speckle", density: 0.35, definition: 1, clarity: 0, dither: true },
        sand: { paletteName: "Sand", pattern: "organic", density: 0.4, definition: 1, clarity: 0, dither: false },
        water: { paletteName: "Water", pattern: "organic", density: 0.5, definition: 2, clarity: 1, dither: false },
        wood: { paletteName: "Wood", pattern: "woodgrain", density: 0.5, definition: 1, clarity: 0, dither: false },
        brick: { paletteName: "Brick", pattern: "brick", density: 0.5, definition: 2, clarity: 0, dither: false },
        snow: { paletteName: "Snow", pattern: "speckle", density: 0.15, definition: 1, clarity: 0, dither: false }
    };

    // ---- Controls UI ----
    document.getElementById('tile-maker-controls').innerHTML = `
        <label>Material Preset:
            <select id="tile-maker-material">
                <option value="">-- none (manual) --</option>
                <option value="grass">Grass</option>
                <option value="dirt">Dirt</option>
                <option value="stone">Stone</option>
                <option value="sand">Sand</option>
                <option value="water">Water</option>
                <option value="wood">Wood</option>
                <option value="brick">Brick</option>
                <option value="snow">Snow</option>
            </select>
        </label>
        <div style="color:#9aa4b2; font-size:11px; margin:4px 0 8px;">Presets set palette/pattern/grain as a starting point -- everything below is still fully adjustable after.</div>
        <label>Palette Preset:
            <select id="tile-maker-palette"></select>
        </label>
        <label>Add to Palette:
            <input type="color" id="tile-maker-addColor" value="#FF5555">
            <button id="tile-maker-addColorBtn" type="button">Add</button>
        </label>
        <div id="tile-maker-paletteSwatches" style="display:flex; gap:4px; margin-bottom:8px;"></div>
        <label>Size:
            <select id="tile-maker-size">
                <option value="8">8x8</option>
                <option value="16">16x16</option>
                <option value="24">24x24</option>
                <option value="32" selected>32x32</option>
                <option value="48">48x48</option>
                <option value="64">64x64</option>
            </select>
        </label>
        <label>Symmetry:
            <select id="tile-maker-symmetry">
                <option value="none">None</option>
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
                <option value="radial">Radial</option>
            </select>
        </label>
        <div style="color:#9aa4b2; font-size:11px;">Symmetry is usually for decorative/icon tiles -- leave as None for organic world textures.</div>
        <label>Pattern:
            <select id="tile-maker-pattern">
                <optgroup label="World Texture">
                    <option value="organic">Organic (grass/dirt/sand)</option>
                    <option value="speckle">Speckle (stone/snow/grain)</option>
                    <option value="brick">Brick</option>
                    <option value="woodgrain">Wood Grain</option>
                </optgroup>
                <optgroup label="Geometric / Decorative">
                    <option value="random">Random</option>
                    <option value="checker">Checker</option>
                    <option value="stripes">Stripes</option>
                    <option value="hstripes">Horizontal Stripes</option>
                    <option value="gradient">Gradient</option>
                    <option value="border">Border</option>
                    <option value="circle">Circle</option>
                    <option value="diagonal">Diagonal</option>
                    <option value="cross">Cross</option>
                    <option value="diamond">Diamond</option>
                    <option value="spiral">Spiral</option>
                    <option value="dots">Dots</option>
                </optgroup>
            </select>
        </label>
        <label>Density:
            <input type="range" id="tile-maker-density" min="0" max="1" step="0.01" value="0.5">
            <span id="tile-maker-densityValue">0.5</span>
        </label>
        <label>
            <input type="checkbox" id="tile-maker-dither"> Dithering (textured shade transitions)
        </label>
        <label>
            <input type="checkbox" id="tile-maker-transparency"> Transparency
        </label>
        <label>
            <input type="checkbox" id="tile-maker-border"> Border
        </label>
        <label>Seed:
            <input type="text" id="tile-maker-seed" value="${Math.floor(Math.random() * 1e9)}" style="width:100px;">
            <button id="tile-maker-randomSeed" type="button">Random</button>
        </label>
        <label>Block Size (lower = finer detail):
            <input type="range" id="tile-maker-definition" min="1" max="16" value="4">
            <span id="tile-maker-definitionValue">4</span>
        </label>
        <label>Clarity (blur -- keep low for seamless edges):
            <input type="range" id="tile-maker-clarity" min="0" max="4" value="0">
            <span id="tile-maker-clarityValue">0</span>
        </label>
        <button id="tile-maker-generate" type="button" style="margin-top:8px;">Generate</button>
        <button id="tile-maker-download" type="button" style="margin-top:8px;">Download PNG</button>
        <button id="tile-maker-variants-btn" type="button" style="margin-top:8px;">Generate Variants</button>
        <div id="tile-maker-variants" style="display:flex; gap:8px; margin-top:8px; flex-wrap:wrap;"></div>
    `;

    document.getElementById('tile-maker-zoom-controls').innerHTML = `
        <label>Zoom:
            <input type="range" id="tile-maker-zoom" min="1" max="16" value="8">
            <span id="tile-maker-zoomValue">8x</span>
        </label>
        <div style="margin-top:12px;">
            <div style="color:#9aa4b2; font-size:12px; margin-bottom:4px;">Tiled Preview (3x3) -- check for seams here:</div>
            <canvas id="tile-maker-tiled-preview" style="image-rendering:pixelated; border:1px solid #35374a; background:#181a20;"></canvas>
        </div>
    `;

    // ---- Palette Select ----
    const paletteSelect = document.getElementById('tile-maker-palette');
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

    const paletteSwatches = document.getElementById('tile-maker-paletteSwatches');
    function updatePaletteSwatches() {
        paletteSwatches.innerHTML = '';
        let paletteArr = (currentPaletteIndex === 'custom') ? customPalette : workingPalettes[currentPaletteIndex];
        paletteArr.forEach((color, idx) => {
            const swatch = document.createElement('div');
            swatch.className = 'paletteColor';
            swatch.style.background = color;
            swatch.style.width = '24px';
            swatch.style.height = '24px';
            swatch.style.borderRadius = '4px';
            swatch.style.position = 'relative';
            swatch.style.cursor = 'pointer';

            const remove = document.createElement('span');
            remove.className = 'removeColor';
            remove.textContent = '×';
            remove.title = 'Remove color';
            remove.style.position = 'absolute';
            remove.style.right = '2px';
            remove.style.top = '2px';
            remove.style.color = '#fff';
            remove.style.background = '#000a';
            remove.style.borderRadius = '50%';
            remove.style.fontSize = '14px';
            remove.style.width = '16px';
            remove.style.height = '16px';
            remove.style.textAlign = 'center';
            remove.style.lineHeight = '16px';
            remove.style.cursor = 'pointer';

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

    paletteSelect.onchange = function() {
        if (paletteSelect.value === 'custom') {
            currentPaletteIndex = 'custom';
            if (customPalette.length === 0) customPalette = [];
        } else {
            currentPaletteIndex = parseInt(paletteSelect.value);
            if (workingPalettes[currentPaletteIndex].length === 0) {
                workingPalettes[currentPaletteIndex] = palettes[currentPaletteIndex].colors.slice();
            }
        }
        updatePaletteSwatches();
        initialGenerate();
    };

    document.getElementById('tile-maker-addColorBtn').onclick = () => {
        const color = document.getElementById('tile-maker-addColor').value;
        let paletteArr = (currentPaletteIndex === 'custom') ? customPalette : workingPalettes[currentPaletteIndex];
        if (!paletteArr.includes(color)) {
            paletteArr.push(color);
            updatePaletteSwatches();
            initialGenerate();
        }
    };

    function applyMaterialPreset(key) {
        const preset = materialPresets[key];
        if (!preset) return;
        const paletteIdx = palettes.findIndex(p => p.name === preset.paletteName);
        if (paletteIdx >= 0) {
            currentPaletteIndex = paletteIdx;
            workingPalettes[paletteIdx] = palettes[paletteIdx].colors.slice();
            paletteSelect.value = paletteIdx;
        }
        document.getElementById('tile-maker-pattern').value = preset.pattern;
        document.getElementById('tile-maker-density').value = preset.density;
        document.getElementById('tile-maker-definition').value = preset.definition;
        document.getElementById('tile-maker-definitionValue').textContent = preset.definition;
        document.getElementById('tile-maker-clarity').value = preset.clarity;
        document.getElementById('tile-maker-clarityValue').textContent = preset.clarity;
        document.getElementById('tile-maker-dither').checked = !!preset.dither;
        updatePaletteSwatches();
        updateDensityValue();
        initialGenerate();
    }

    // ---- Canvas Setup ----
    const canvas = document.getElementById('tile-maker-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;

    // ---- Controls ----
    function getControls() {
        let paletteArr = (currentPaletteIndex === 'custom')
            ? (customPalette.length > 0 ? customPalette : ['#000'])
            : (workingPalettes[currentPaletteIndex].length > 0 ? workingPalettes[currentPaletteIndex] : ['#000']);
        return {
            size: parseInt(document.getElementById('tile-maker-size').value),
            symmetry: document.getElementById('tile-maker-symmetry').value,
            pattern: document.getElementById('tile-maker-pattern').value,
            density: parseFloat(document.getElementById('tile-maker-density').value),
            palette: paletteArr,
            dither: document.getElementById('tile-maker-dither').checked,
            transparency: document.getElementById('tile-maker-transparency').checked,
            border: document.getElementById('tile-maker-border').checked,
            seed: document.getElementById('tile-maker-seed').value || Math.floor(Math.random() * 1e9),
            definition: parseInt(document.getElementById('tile-maker-definition').value),
            clarity: parseInt(document.getElementById('tile-maker-clarity').value)
        };
    }

    // ---- Tile Generation ----
    let lastImageData = null;
    let lastOpts = null;

    // Renders into `targetCtx` (not always the main on-screen canvas -- variant
    // generation reuses this against offscreen canvases with a different seed).
    function generateTile(targetCtx, opts) {
        targetCtx.clearRect(0, 0, opts.size, opts.size);
        targetCtx.filter = opts.clarity > 0 ? `blur(${opts.clarity}px)` : 'none';
        const blockSize = opts.definition;
        const blocks = Math.floor(opts.size / blockSize);
        const seedNum = hashCode(opts.seed.toString());
        const palette = opts.palette;

        for (let bx = 0; bx < blocks; bx++) {
            for (let by = 0; by < blocks; by++) {
                let x = bx * blockSize;
                let y = by * blockSize;

                if (opts.border && (bx === 0 || bx === blocks - 1 || by === 0 || by === blocks - 1)) continue;

                let draw = false;
                let color = null;

                switch (opts.pattern) {
                    case "organic": {
                        const scale = seamlessScale(blocks, 6);
                        const n = valueNoise2D(seedNum, bx, by, scale, blocks);
                        color = shadeFromNoise(n, palette, bx, by, opts.dither);
                        draw = true;
                        break;
                    }
                    case "speckle": {
                        draw = true;
                        const speck = hash2D(seedNum, bx, by);
                        if (palette.length > 1 && speck < opts.density * 0.3) {
                            const accentIdx = 1 + Math.floor(hash2D(seedNum + 1, bx, by) * (palette.length - 1));
                            color = palette[Math.min(palette.length - 1, accentIdx)];
                        } else {
                            color = palette[0];
                        }
                        break;
                    }
                    case "brick": {
                        const brickH = Math.max(2, opts.definition >= 2 ? 2 : 3);
                        const brickW = Math.max(4, brickH * 2);
                        const rowIdx = Math.floor(by / brickH);
                        const rowOffset = (rowIdx % 2) * Math.floor(brickW / 2);
                        const withinRow = ((by % brickH) + brickH) % brickH;
                        const brickX = ((bx + rowOffset) % brickW + brickW) % brickW;
                        const isMortar = (withinRow === brickH - 1) || (brickX === brickW - 1);
                        draw = true;
                        if (isMortar) {
                            color = palette[0];
                        } else {
                            const shadeIdx = 1 + Math.floor(hash2D(seedNum, Math.floor((bx + rowOffset) / brickW), rowIdx) * Math.max(1, palette.length - 1));
                            color = palette[Math.min(palette.length - 1, shadeIdx)];
                        }
                        break;
                    }
                    case "woodgrain": {
                        const bandNoise = valueNoise2D(seedNum, 0, by, seamlessScale(blocks, 8), blocks);
                        const grain = (hash2D(seedNum, bx, by) - 0.5) * 0.25;
                        const combined = Math.min(0.999, Math.max(0, bandNoise + grain));
                        color = shadeFromNoise(combined, palette, bx, by, opts.dither);
                        draw = true;
                        break;
                    }
                    case "random":
                        draw = hash2D(seedNum, bx, by) < opts.density;
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
                        draw = hash2D(seedNum, bx, by) < (bx / blocks);
                        break;
                    case "border":
                        draw = (bx === 0 || bx === blocks - 1 || by === 0 || by === blocks - 1);
                        break;
                    case "circle": {
                        let cx = blocks / 2;
                        let cy = blocks / 2;
                        let r = blocks / 2.5;
                        draw = ((bx - cx) ** 2 + (by - cy) ** 2 < r * r);
                        break;
                    }
                    case "diagonal":
                        draw = ((bx + by) % 4 === 0);
                        break;
                    case "cross":
                        draw = (bx === Math.floor(blocks / 2) || by === Math.floor(blocks / 2));
                        break;
                    case "diamond": {
                        let dx = Math.abs(bx - blocks / 2);
                        let dy = Math.abs(by - blocks / 2);
                        draw = (dx + dy < blocks / 2);
                        break;
                    }
                    case "spiral": {
                        let angle = Math.atan2(by - blocks / 2, bx - blocks / 2);
                        let radius = Math.sqrt((bx - blocks / 2) ** 2 + (by - blocks / 2) ** 2);
                        draw = Math.abs((angle * blocks / Math.PI + radius) % 6) < 2;
                        break;
                    }
                    case "dots":
                        draw = ((bx % 3 === 0) && (by % 3 === 0));
                        break;
                }

                // The world-texture patterns (organic/speckle/brick/woodgrain)
                // set their own `color` above and always draw -- everything
                // else keeps the original draw/no-draw + random-shade behavior.
                if (color === null) {
                    if (draw) {
                        const shadeIdx = Math.floor(hash2D(seedNum + 2, bx, by) * palette.length);
                        color = palette[Math.min(palette.length - 1, shadeIdx)];
                    } else {
                        color = opts.transparency ? "rgba(0,0,0,0)" : palette[0];
                    }
                }

                if (opts.symmetry === "vertical") {
                    if (bx < blocks / 2) {
                        targetCtx.fillStyle = color;
                        targetCtx.fillRect(x, y, blockSize, blockSize);
                        targetCtx.fillRect(opts.size - blockSize - x, y, blockSize, blockSize);
                    }
                } else if (opts.symmetry === "horizontal") {
                    if (by < blocks / 2) {
                        targetCtx.fillStyle = color;
                        targetCtx.fillRect(x, y, blockSize, blockSize);
                        targetCtx.fillRect(x, opts.size - blockSize - y, blockSize, blockSize);
                    }
                } else if (opts.symmetry === "radial") {
                    if (bx < blocks / 2 && by < blocks / 2) {
                        targetCtx.fillStyle = color;
                        targetCtx.fillRect(x, y, blockSize, blockSize);
                        targetCtx.fillRect(opts.size - blockSize - x, y, blockSize, blockSize);
                        targetCtx.fillRect(x, opts.size - blockSize - y, blockSize, blockSize);
                        targetCtx.fillRect(opts.size - blockSize - x, opts.size - blockSize - y, blockSize, blockSize);
                    }
                } else {
                    targetCtx.fillStyle = color;
                    targetCtx.fillRect(x, y, blockSize, blockSize);
                }
            }
        }
        targetCtx.filter = 'none';
        if (targetCtx === ctx) {
            lastImageData = ctx.getImageData(0, 0, opts.size, opts.size);
            lastOpts = { ...opts };
        }
    }

    function updateDensityValue() {
        document.getElementById('tile-maker-densityValue').textContent = document.getElementById('tile-maker-density').value;
    }

    function updateZoom() {
        const zoom = parseInt(document.getElementById('tile-maker-zoom').value);
        document.getElementById('tile-maker-zoomValue').textContent = `${zoom}x`;
        canvas.style.width = (canvas.width * zoom) + "px";
        canvas.style.height = (canvas.height * zoom) + "px";
        canvas.style.imageRendering = 'pixelated';
        ctx.imageSmoothingEnabled = false;
    }

    function updateTiledPreview() {
        const previewCanvas = document.getElementById('tile-maker-tiled-preview');
        if (!previewCanvas || !lastImageData) return;
        const tileSize = lastImageData.width;
        const reps = 3;
        const displaySize = 240; // fixed on-screen size regardless of tile resolution
        previewCanvas.width = tileSize * reps;
        previewCanvas.height = tileSize * reps;
        previewCanvas.style.width = displaySize + 'px';
        previewCanvas.style.height = displaySize + 'px';
        const pctx = previewCanvas.getContext('2d');
        pctx.imageSmoothingEnabled = false;
        const tmp = document.createElement('canvas');
        tmp.width = tileSize; tmp.height = tileSize;
        tmp.getContext('2d').putImageData(lastImageData, 0, 0);
        for (let ty = 0; ty < reps; ty++) {
            for (let tx = 0; tx < reps; tx++) {
                pctx.drawImage(tmp, tx * tileSize, ty * tileSize);
            }
        }
    }

    function generateVariants() {
        const variantsDiv = document.getElementById('tile-maker-variants');
        if (!variantsDiv) return;
        variantsDiv.innerHTML = '';
        const opts = getControls();
        const baseSeedNum = hashCode(opts.seed.toString());
        for (let i = 1; i <= 4; i++) {
            const variantOpts = { ...opts, seed: (baseSeedNum + i * 7919).toString() };
            const vCanvas = document.createElement('canvas');
            vCanvas.width = opts.size;
            vCanvas.height = opts.size;
            const vCtx = vCanvas.getContext('2d');
            vCtx.imageSmoothingEnabled = false;
            generateTile(vCtx, variantOpts);

            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:4px;';

            const displayCanvas = document.createElement('canvas');
            displayCanvas.width = opts.size;
            displayCanvas.height = opts.size;
            displayCanvas.style.cssText = 'width:64px; height:64px; image-rendering:pixelated; border:1px solid #35374a; cursor:pointer;';
            displayCanvas.getContext('2d').drawImage(vCanvas, 0, 0);
            displayCanvas.title = 'Click to make this the main tile';
            displayCanvas.onclick = () => {
                document.getElementById('tile-maker-seed').value = variantOpts.seed;
                initialGenerate();
            };

            const dlBtn = document.createElement('button');
            dlBtn.type = 'button';
            dlBtn.textContent = 'Download';
            dlBtn.style.fontSize = '11px';
            dlBtn.onclick = () => {
                const link = document.createElement('a');
                link.download = `tile_variant_${i}.png`;
                link.href = vCanvas.toDataURL();
                link.click();
            };

            wrapper.appendChild(displayCanvas);
            wrapper.appendChild(dlBtn);
            variantsDiv.appendChild(wrapper);
        }
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

    function setPixel(imageData, x, y, color) {
        const idx = (y * imageData.width + x) * 4;
        imageData.data[idx] = color.r;
        imageData.data[idx + 1] = color.g;
        imageData.data[idx + 2] = color.b;
        imageData.data[idx + 3] = color.a;
    }

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

    function initialGenerate() {
        const opts = getControls();
        canvas.width = opts.size;
        canvas.height = opts.size;
        generateTile(ctx, opts);
        updateZoom();
        updateTiledPreview();
        scheduleAutosave();
    }

    // --- Autosave: persists to IndexedDB so work survives a full page
    // reload, not just switching tabs (see autosave.js). The generator is a
    // deterministic function of its settings + seed, so we only need to
    // persist the control values and palettes, not the image itself. ---
    const AUTOSAVE_KEY = 'tileGenerator';

    function serializeState() {
        return {
            workingPalettes: workingPalettes.map(p => [...p]),
            customPalette: [...customPalette],
            currentPaletteIndex,
            material: document.getElementById('tile-maker-material').value,
            size: document.getElementById('tile-maker-size').value,
            symmetry: document.getElementById('tile-maker-symmetry').value,
            pattern: document.getElementById('tile-maker-pattern').value,
            density: document.getElementById('tile-maker-density').value,
            dither: document.getElementById('tile-maker-dither').checked,
            transparency: document.getElementById('tile-maker-transparency').checked,
            border: document.getElementById('tile-maker-border').checked,
            seed: document.getElementById('tile-maker-seed').value,
            definition: document.getElementById('tile-maker-definition').value,
            clarity: document.getElementById('tile-maker-clarity').value,
            zoom: document.getElementById('tile-maker-zoom').value
        };
    }

    const scheduleAutosave = Autosave.debounce(() => {
        Autosave.save(AUTOSAVE_KEY, serializeState());
    }, 1200);

    async function restoreAutosave() {
        const saved = await Autosave.load(AUTOSAVE_KEY);
        if (!saved) return;
        try {
            if (saved.workingPalettes) workingPalettes = saved.workingPalettes.map(p => [...p]);
            if (saved.customPalette) customPalette = [...saved.customPalette];
            currentPaletteIndex = saved.currentPaletteIndex ?? 0;

            paletteSelect.value = currentPaletteIndex;
            document.getElementById('tile-maker-material').value = saved.material ?? '';
            document.getElementById('tile-maker-size').value = saved.size ?? 32;
            document.getElementById('tile-maker-symmetry').value = saved.symmetry ?? 'none';
            document.getElementById('tile-maker-pattern').value = saved.pattern ?? 'organic';
            document.getElementById('tile-maker-density').value = saved.density ?? 0.5;
            document.getElementById('tile-maker-dither').checked = !!saved.dither;
            document.getElementById('tile-maker-transparency').checked = !!saved.transparency;
            document.getElementById('tile-maker-border').checked = !!saved.border;
            document.getElementById('tile-maker-seed').value = saved.seed ?? Math.floor(Math.random() * 1e9);
            document.getElementById('tile-maker-definition').value = saved.definition ?? 4;
            document.getElementById('tile-maker-definitionValue').textContent = saved.definition ?? 4;
            document.getElementById('tile-maker-clarity').value = saved.clarity ?? 0;
            document.getElementById('tile-maker-clarityValue').textContent = saved.clarity ?? 0;
            document.getElementById('tile-maker-zoom').value = saved.zoom ?? 8;

            updatePaletteSwatches();
            updateDensityValue();
            initialGenerate();
            if (document.getElementById('tile-maker-transparency').checked) applyTransparency();
            if (document.getElementById('tile-maker-border').checked) applyBorder();
            updateZoom();
            updateTiledPreview();
        } catch (err) {
            console.warn('Tile Generator: failed to restore autosave', err);
        }
    }

    // ---- Event Listeners ----
    document.getElementById('tile-maker-material').onchange = function() {
        if (this.value) applyMaterialPreset(this.value);
    };
    document.getElementById('tile-maker-generate').onclick = initialGenerate;
    document.getElementById('tile-maker-size').onchange = initialGenerate;
    document.getElementById('tile-maker-symmetry').onchange = initialGenerate;
    document.getElementById('tile-maker-pattern').onchange = initialGenerate;
    document.getElementById('tile-maker-density').oninput = () => { updateDensityValue(); initialGenerate(); };
    document.getElementById('tile-maker-dither').onchange = initialGenerate;
    document.getElementById('tile-maker-transparency').onchange = function() {
        if (this.checked) {
            applyTransparency();
        } else {
            ctx.putImageData(lastImageData, 0, 0);
            updateZoom();
        }
        updateTiledPreview();
        scheduleAutosave();
    };
    document.getElementById('tile-maker-border').onchange = function() {
        if (this.checked) {
            applyBorder();
        } else {
            ctx.putImageData(lastImageData, 0, 0);
            updateZoom();
        }
        updateTiledPreview();
        scheduleAutosave();
    };
    document.getElementById('tile-maker-seed').oninput = initialGenerate;
    document.getElementById('tile-maker-zoom').oninput = updateZoom;
    document.getElementById('tile-maker-randomSeed').onclick = () => {
        document.getElementById('tile-maker-seed').value = Math.floor(Math.random() * 1e9);
        initialGenerate();
    };
    document.getElementById('tile-maker-definition').oninput = function() {
        document.getElementById('tile-maker-definitionValue').textContent = this.value;
        initialGenerate();
    };
    document.getElementById('tile-maker-clarity').oninput = function() {
        document.getElementById('tile-maker-clarityValue').textContent = this.value;
        initialGenerate();
    };
    document.getElementById('tile-maker-variants-btn').onclick = generateVariants;

    document.getElementById('tile-maker-download').onclick = () => {
        const link = document.createElement('a');
        link.download = 'tile.png';
        link.href = canvas.toDataURL();
        link.click();
    };

    // ---- Start ----
    paletteSelect.value = 5; // default to the Grass palette to start
    currentPaletteIndex = 5;
    document.getElementById('tile-maker-pattern').value = 'organic';
    document.getElementById('tile-maker-definition').value = 1;
    document.getElementById('tile-maker-definitionValue').textContent = '1';
    updatePaletteSwatches();
    updateDensityValue();
    initialGenerate();
    updateZoom();

    // Restore any previously autosaved settings now that setup is complete.
    restoreAutosave();
}
