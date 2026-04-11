function setupTileMaker() {
    // ---- Utility: Seeded RNG ----
    function mulberry32(a) {
        return function() {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    // ---- Palettes ----
    const palettes = [
        { name: "Pastel", colors: ['#22223B', '#4A4E69', '#9A8C98', '#C9ADA7', '#F2E9E4'] },
        { name: "Neon", colors: ['#1a1a1a', '#333333', '#FF5555', '#50FA7B', '#BD93F9', '#F1FA8C'] },
        { name: "Retro", colors: ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FFA500', '#800080'] },
        { name: "Ocean", colors: ['#013A63', '#1E6091', '#76C893', '#A9D6E5', '#168AAD'] },
        { name: "Fire", colors: ['#FF9900', '#FF3300', '#FF6600', '#FFCC00', '#660000'] }
    ];
    let workingPalettes = palettes.map(p => [...p.colors]);
    let customPalette = [];
    let currentPaletteIndex = 0;

    // ---- Controls UI ----
    document.getElementById('tile-maker-controls').innerHTML = `
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
        <label>Pattern:
            <select id="tile-maker-pattern">
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
            </select>
        </label>
        <label>Density:
            <input type="range" id="tile-maker-density" min="0" max="1" step="0.01" value="0.5">
            <span id="tile-maker-densityValue">0.5</span>
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
        <label>Definition:
            <input type="range" id="tile-maker-definition" min="1" max="16" value="4">
            <span id="tile-maker-definitionValue">4</span>
        </label>
        <label>Clarity:
            <input type="range" id="tile-maker-clarity" min="0" max="4" value="0">
            <span id="tile-maker-clarityValue">0</span>
        </label>
        <button id="tile-maker-generate" type="button" style="margin-top:8px;">Generate</button>
        <button id="tile-maker-download" type="button" style="margin-top:8px;">Download PNG</button>
    `;

    document.getElementById('tile-maker-zoom-controls').innerHTML = `
        <label>Zoom:
            <input type="range" id="tile-maker-zoom" min="1" max="16" value="8">
            <span id="tile-maker-zoomValue">8x</span>
        </label>
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

    function generateTile(opts) {
        ctx.clearRect(0, 0, opts.size, opts.size);
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

                if (draw) {
                    color = opts.palette[Math.floor(rand() * opts.palette.length)];
                } else {
                    color = opts.transparency ? "rgba(0,0,0,0)" : opts.palette[0];
                }

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

    function hashCode(str) {
        let hash = 0, i, chr;
        for (i = 0; i < str.length; i++) {
            chr = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
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
        generateTile(opts);
        updateZoom();
    }

    // ---- Event Listeners ----
    document.getElementById('tile-maker-generate').onclick = initialGenerate;
    document.getElementById('tile-maker-size').onchange = initialGenerate;
    document.getElementById('tile-maker-symmetry').onchange = initialGenerate;
    document.getElementById('tile-maker-pattern').onchange = initialGenerate;
    document.getElementById('tile-maker-density').oninput = () => { updateDensityValue(); initialGenerate(); };
    document.getElementById('tile-maker-transparency').onchange = function() {
        if (this.checked) {
            applyTransparency();
        } else {
            ctx.putImageData(lastImageData, 0, 0);
            updateZoom();
        }
    };
    document.getElementById('tile-maker-border').onchange = function() {
        if (this.checked) {
            applyBorder();
        } else {
            ctx.putImageData(lastImageData, 0, 0);
            updateZoom();
        }
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

    document.getElementById('tile-maker-download').onclick = () => {
        const link = document.createElement('a');
        link.download = 'tile.png';
        link.href = canvas.toDataURL();
        link.click();
    };

    // ---- Start ----
    paletteSelect.value = 0;
    updatePaletteSwatches();
    updateDensityValue();
    initialGenerate();
    updateZoom();
}