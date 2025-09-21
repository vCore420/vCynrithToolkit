function renderMapCreatorTab() {
    const tab = document.getElementById('map-creator-tab');
    tab.innerHTML = `
      <h2>Map Creator</h2>
      <div id="map-creator-layout">
        <div id="mc-left">
          <div id="mc-tools">
            <button data-tool="pencil" title="Pencil">✏️</button>
            <button data-tool="eraser" title="Eraser">🧽</button>
            <button data-tool="move" title="Move">🖐️</button>
            <button data-tool="rect" title="Rect">▭</button>
            <button data-tool="picker" title="Picker">🧪</button>
          </div>
  
          <div>
            <label><b>Tileset Images (PNG)</b></label>
            <input type="file" id="mc-tileset-input" accept="image/png" multiple />
          </div>
  
          <div id="mc-palette"></div>
  
          <div id="mc-asset-props">
            <div><b>Selected Tile Properties</b></div>
            <label>File: <span id="mc-prop-name">—</span></label>
            <label>Frames <input type="number" id="mc-prop-frames" min="0" max="64" value="0" /></label>
            <label>
              <input type="checkbox" id="mc-prop-collision" />
              Collision
            </label>
          </div>
  
          <div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <b>Layers</b>
              <span>
                <button id="mc-add-layer">Add</button>
                <button id="mc-del-layer">Del</button>
              </span>
            </div>
            <div id="mc-layers" style="display:flex; flex-direction:column; gap:6px; margin-top:6px;"></div>
          </div>

          <div style="margin-top:32px; display:flex; flex-direction:column; gap:8px;">
            <button id="mc-set-spawn">Set Spawn Point</button>
            <button id="mc-set-teleport">Set Teleport Point</button>
            <label>
            XP Required to Leave:
            <input type="number" id="mc-xp-required" min="0" value="0" style="width:90px;">
            </label>
            <button id="mc-clear-spawn-teleport">Clear Spawn/Teleport</button>
          </div>
  
          <div>
            <button id="mc-download-json">Download JSON</button>
          </div>
        </div>
  
        <div id="mc-right">
            <div id="mc-topbar-wrap">
                <div id="mc-topbar">
                    <label>Map W <input type="number" id="mc-width" min="1" max="256" value="32" style="width:70px;"></label>
                    <label>Map H <input type="number" id="mc-height" min="1" max="256" value="32" style="width:70px;"></label>
                    <label>Tile W <input type="number" id="mc-tw" min="8" max="256" value="64" style="width:70px;"></label>
                    <label>Tile H <input type="number" id="mc-th" min="8" max="256" value="64" style="width:70px;"></label>
                    <button id="mc-apply-size">Apply</button>
                    <label><input type="checkbox" id="mc-grid" checked> Grid</label>
                    <button id="mc-zoom-in">+</button>
                    <button id="mc-zoom-out">-</button>
                    <button id="mc-zoom-reset">Reset</button>
                </div>
            </div>
          <div id="mc-canvas-wrap">
            <canvas id="mc-canvas"></canvas>
          </div>
        </div>
      </div>
    `;
  
    // State
    const state = {
        width: Number(document.getElementById('mc-width').value) || 32,
        height: Number(document.getElementById('mc-height').value) || 32,
        tw: Number(document.getElementById('mc-tw').value) || 64,
        th: Number(document.getElementById('mc-th').value) || 64,
        zoom: 1,
        grid: true,
        assets: [], // {file_name, collision:0|1, frames:Number, img:Image}
        selectedAsset: -1,
        layers: [], // {name, visible, data: Uint32Array(width*height)}
        currentLayer: 0,
        tool: 'pencil',
        dragging: false,
        rectStart: null,
        offset: { x: 0, y: 0 }, // panning if needed later
        dpr: window.devicePixelRatio || 1,
    };
  
    // Canvas setup
    const canvas = document.getElementById('mc-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
    let isDraggingMap = false;
    let dragStart = { x: 0, y: 0 };
    let hoverTile = null;

    // Helpers
    function idx(x, y) { return y * state.width + x; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function setSize(w, h, tw, th) {
      state.width = w; state.height = h; state.tw = tw; state.th = th;
      state.layers.forEach(l => {
        const newData = new Uint32Array(w * h);
        const minW = Math.min(w, l._w || w);
        const minH = Math.min(h, l._h || h);
        for (let y=0; y<minH; y++) {
          for (let x=0; x<minW; x++) {
            newData[idx(x,y)] = l.data[y*(l._w||w) + x] || 0;
          }
        }
        l.data = newData;
        l._w = w; l._h = h;
      });
      resizeCanvas();
      draw();
      renderLayersUI();
    }
    function resizeCanvas() {
        // Fixed size for canvas
        const size = 650;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        canvas.width = Math.floor(size * state.dpr);
        canvas.height = Math.floor(size * state.dpr);
        ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    }
    function drawGrid() {
        if (!state.grid) return;
        ctx.save();
        // No need to translate/scale again, already done in draw()
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        for (let x = 0; x <= state.width; x++) {
          const gx = x * state.tw + 0.5;
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, state.height * state.th);
          ctx.stroke();
        }
        for (let y = 0; y <= state.height; y++) {
          const gy = y * state.th + 0.5;
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(state.width * state.tw, gy);
          ctx.stroke();
        }
        ctx.restore();
    }
    function draw() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      
        ctx.save();
        ctx.translate(state.offset.x, state.offset.y);
        ctx.scale(state.zoom, state.zoom);
      
        // Draw map layers
        for (let li = 0; li < state.layers.length; li++) {
          const layer = state.layers[li];
          if (!layer.visible) continue;
          for (let y = 0; y < state.height; y++) {
            for (let x = 0; x < state.width; x++) {
              const gid = layer.data[idx(x, y)] | 0;
              if (gid <= 0) continue;
              const asset = state.assets[gid - 1];
              if (!asset || !asset.img) continue;
              ctx.drawImage(asset.img, 0, 0, state.tw, state.th, x * state.tw, y * state.th, state.tw, state.th);
            }
          }
        }
      
        // Draw grid
        drawGrid();

        // Draw spawn marker
        if (state.spawn) {
            ctx.save();
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = "#00ff00";
            ctx.lineWidth = 3;
            const centerX = state.spawn.x * state.tw + state.tw / 2;
            const centerY = state.spawn.y * state.th + state.th / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, state.tw / 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }
        
        // Draw teleport marker
        if (state.teleport) {
            ctx.save();
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = "#a259ff";
            ctx.lineWidth = 3;
            const centerX = state.teleport.x * state.tw + state.tw / 2;
            const centerY = state.teleport.y * state.th + state.th / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, state.tw / 3, 0, 2 * Math.PI);
            ctx.stroke();
            // Draw XP label
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#a259ff";
            ctx.font = "bold 16px sans-serif";
            ctx.fillText(`XP: ${state.teleport.xpRequired || 0}`, centerX - state.tw / 2, centerY - state.th / 2 - 6);
            ctx.restore();
        }

        if (hoverTile) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = "#4a90e2";
            ctx.lineWidth = 2;
            ctx.strokeRect(
              hoverTile.tx * state.tw,
              hoverTile.ty * state.th,
              state.tw,
              state.th
            );
            ctx.restore();
          }
        ctx.restore();
    }
    function screenToTile(mx, my) {
        const rect = canvas.getBoundingClientRect();
        // Scale mouse coordinates to match internal canvas pixels
        const mouseX = ((mx - rect.left) * state.dpr - state.offset.x) / state.zoom;
        const mouseY = ((my - rect.top) * state.dpr - state.offset.y) / state.zoom;
        const tx = Math.floor(mouseX / state.tw);
        const ty = Math.floor(mouseY / state.th);
        if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return null;
        return { tx, ty };
    }
    function paintAt(tx, ty, gid) {
      const L = state.layers[state.currentLayer];
      if (!L) return;
      L.data[idx(tx,ty)] = gid;
    }
    function drawRect(x1,y1,x2,y2,gid) {
      const L = state.layers[state.currentLayer];
      if (!L) return;
      const minx = Math.min(x1,x2), maxx = Math.max(x1,x2);
      const miny = Math.min(y1,y2), maxy = Math.max(y1,y2);
      for (let y=miny; y<=maxy; y++) {
        for (let x=minx; x<=maxx; x++) {
          L.data[idx(x,y)] = gid;
        }
      }
    }
  
    // Init default map
    function addLayer(name) {
      const L = {
        name: name || `Layer ${state.layers.length+1}`,
        visible: true,
        data: new Uint32Array(state.width * state.height),
        _w: state.width,
        _h: state.height
      };
      state.layers.push(L);
      state.currentLayer = state.layers.length - 1;
      renderLayersUI();
      draw();
    }
    addLayer('Layer 1');
    resizeCanvas();
    draw();
  
    // UI: Tools
    document.querySelectorAll('#mc-tools button').forEach(btn => {
      btn.onclick = () => {
        state.tool = btn.dataset.tool;
        document.querySelectorAll('#mc-tools button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });
    document.querySelector('#mc-tools button[data-tool="pencil"]').classList.add('active');
  
    // UI: Palette
    const paletteDiv = document.getElementById('mc-palette');
    function refreshPalette() {
      paletteDiv.innerHTML = state.assets.map((a, i) => `
        <div class="mc-pal-item ${i===state.selectedAsset?'selected':''}" data-i="${i}" title="${a.file_name}">
          <canvas data-thumb="${i}" width="44" height="44"></canvas>
        </div>
      `).join('');
      // draw thumbs
      paletteDiv.querySelectorAll('canvas[data-thumb]').forEach(cv => {
        const i = Number(cv.dataset.thumb);
        const img = state.assets[i]?.img;
        if (!img) return;
        const c = cv.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.clearRect(0,0,cv.width,cv.height);
        // fit tile size into 44x44
        const scale = Math.min(cv.width/state.tw, cv.height/state.th);
        const dw = Math.floor(state.tw*scale);
        const dh = Math.floor(state.th*scale);
        const dx = Math.floor((cv.width - dw)/2);
        const dy = Math.floor((cv.height - dh)/2);
        c.drawImage(img, 0, 0, state.tw, state.th, dx, dy, dw, dh);
      });
      paletteDiv.querySelectorAll('.mc-pal-item').forEach(el => {
        el.onclick = () => {
          state.selectedAsset = Number(el.dataset.i);
          refreshPalette();
          renderAssetProps();
        };
      });
    }
  
    // UI: Selected asset props
    function renderAssetProps() {
      const a = state.assets[state.selectedAsset];
      document.getElementById('mc-prop-name').textContent = a ? a.file_name : '—';
      const framesEl = document.getElementById('mc-prop-frames');
      const collEl = document.getElementById('mc-prop-collision');
      framesEl.value = a ? (a.frames || 0) : 0;
      collEl.checked = a ? !!a.collision : false;
    }
    document.getElementById('mc-prop-frames').oninput = (e) => {
      const a = state.assets[state.selectedAsset]; if (!a) return;
      a.frames = clamp(parseInt(e.target.value||'0',10), 0, 64);
    };
    document.getElementById('mc-prop-collision').onchange = (e) => {
      const a = state.assets[state.selectedAsset]; if (!a) return;
      a.collision = e.target.checked ? 1 : 0;
    };
  
    // Load tilesets
    document.getElementById('mc-tileset-input').onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      for (const file of files) {
        const file_name = file.name.replace(/\.png$/i,'');
        const url = URL.createObjectURL(file);
        const img = new Image();
        await new Promise(res => { img.onload = res; img.src = url; });
        // Assume each PNG is a single tile sprite (with optional horizontal frames)
        state.assets.push({ file_name, collision: 0, frames: 0, img });
      }
      if (state.selectedAsset < 0 && state.assets.length) state.selectedAsset = 0;
      refreshPalette();
      renderAssetProps();
      draw();
    };
  
    // Layers UI
    function renderLayersUI() {
      const div = document.getElementById('mc-layers');
      div.innerHTML = state.layers.map((L, i) => `
        <div class="mc-layer-row" data-i="${i}">
          <input type="checkbox" class="mc-layer-vis" ${L.visible?'checked':''} title="Visible"/>
          <input type="text" class="mc-layer-name" value="${L.name}"/>
          <button class="mc-layer-up">▲</button>
          <button class="mc-layer-down">▼</button>
          <button class="mc-layer-sel" ${state.currentLayer===i?'style="background:#4a90e2"':''}>Use</button>
        </div>
      `).join('');
      div.querySelectorAll('.mc-layer-vis').forEach(el => el.onchange = (e) => {
        const i = Number(el.closest('.mc-layer-row').dataset.i);
        state.layers[i].visible = e.target.checked;
        draw();
      });
      div.querySelectorAll('.mc-layer-name').forEach(el => el.oninput = (e) => {
        const i = Number(el.closest('.mc-layer-row').dataset.i);
        state.layers[i].name = e.target.value;
      });
      div.querySelectorAll('.mc-layer-up').forEach(el => el.onclick = () => {
        const i = Number(el.closest('.mc-layer-row').dataset.i);
        if (i<=0) return;
        [state.layers[i-1], state.layers[i]] = [state.layers[i], state.layers[i-1]];
        state.currentLayer = i-1 === state.currentLayer ? i : (i === state.currentLayer ? i-1 : state.currentLayer);
        renderLayersUI(); draw();
      });
      div.querySelectorAll('.mc-layer-down').forEach(el => el.onclick = () => {
        const i = Number(el.closest('.mc-layer-row').dataset.i);
        if (i>=state.layers.length-1) return;
        [state.layers[i+1], state.layers[i]] = [state.layers[i], state.layers[i+1]];
        state.currentLayer = i+1 === state.currentLayer ? i : (i === state.currentLayer ? i+1 : state.currentLayer);
        renderLayersUI(); draw();
      });
      div.querySelectorAll('.mc-layer-sel').forEach(el => el.onclick = () => {
        state.currentLayer = Number(el.closest('.mc-layer-row').dataset.i);
        renderLayersUI();
      });
    }
    renderLayersUI();
  
    document.getElementById('mc-add-layer').onclick = () => addLayer();
    document.getElementById('mc-del-layer').onclick = () => {
      if (state.layers.length<=1) return;
      state.layers.splice(state.currentLayer,1);
      state.currentLayer = Math.max(0, state.currentLayer-1);
      renderLayersUI(); draw();
    };
  
    document.getElementById('mc-set-spawn').onclick = () => {
        settingSpawn = true;
        settingTeleport = false;
    };
    
    document.getElementById('mc-set-teleport').onclick = () => {
        settingTeleport = true;
        settingSpawn = false;
    };

    document.getElementById('mc-xp-required').oninput = (e) => {
        state.xpRequired = parseInt(e.target.value, 10) || 0;
        if (state.teleport) state.teleport.xpRequired = state.xpRequired;
        draw();
    };

    document.getElementById('mc-clear-spawn-teleport').onclick = () => {
        state.spawn = null;
        state.teleport = null;
        draw();
    };

    // Canvas interactions
    function currentGid() {
      return state.selectedAsset >= 0 ? (state.selectedAsset + 1) : 0;
    }
    function handlePaint(e, phase) {
      const pos = screenToTile(e.clientX, e.clientY);
      if (!pos) return;
      const gid = currentGid();
      switch (state.tool) {
        case 'pencil':
          paintAt(pos.tx, pos.ty, gid);
          break;
        case 'eraser':
          paintAt(pos.tx, pos.ty, 0);
          break;
        case 'rect':
          if (phase === 'down') state.rectStart = pos;
          if (phase === 'move' && state.dragging && state.rectStart) {
          }
          if (phase === 'up' && state.rectStart) {
            drawRect(state.rectStart.tx, state.rectStart.ty, pos.tx, pos.ty, gid);
            state.rectStart = null;
          }
          break;
        case 'picker': {
          const L = state.layers[state.currentLayer];
          const gidHere = L ? L.data[idx(pos.tx,pos.ty)] : 0;
          if (gidHere > 0) {
            state.selectedAsset = gidHere - 1;
            refreshPalette();
            renderAssetProps();
          }
          break;
        }
      }
      draw();
    }
    canvas.addEventListener('mousedown', (e) => {
        if (settingSpawn) {
            const pos = screenToTile(e.clientX, e.clientY);
            if (pos) {
              state.spawn = { x: pos.tx, y: pos.ty };
              settingSpawn = false;
              draw();
            }
            return;
        }
        if (settingTeleport) {
            const pos = screenToTile(e.clientX, e.clientY);
            if (pos) {
              state.teleport = { x: pos.tx, y: pos.ty, xpRequired: state.xpRequired };
              settingTeleport = false;
              draw();
            }
            return;
        }
        if (state.tool === 'move') {
          isDraggingMap = true;
          dragStart.x = e.clientX - state.offset.x;
          dragStart.y = e.clientY - state.offset.y;
        } else {
          state.dragging = true;
          handlePaint(e, 'down');
        }
      });
      canvas.addEventListener('mousemove', (e) => {
        if (isDraggingMap && state.tool === 'move') {
          state.offset.x = e.clientX - dragStart.x;
          state.offset.y = e.clientY - dragStart.y;
          draw();
        } else if (state.dragging) {
          handlePaint(e, 'move');
        } else {
          hoverTile = screenToTile(e.clientX, e.clientY);
          draw();
        }
      });
      canvas.addEventListener('mouseleave', () => {
        hoverTile = null;
        draw();
      });
      window.addEventListener('mouseup', (e) => {
        if (isDraggingMap) {
          isDraggingMap = false;
        }
        if (state.dragging) {
          state.dragging = false;
          handlePaint(e, 'up');
        }
      });
      canvas.addEventListener('touchstart', function(e) {
        if (state.tool === 'move' && e.touches.length === 1) {
          isDraggingMap = true;
          dragStart.x = e.touches[0].clientX - state.offset.x;
          dragStart.y = e.touches[0].clientY - state.offset.y;
        }
      }, { passive: false });
      
      canvas.addEventListener('touchmove', function(e) {
        if (state.tool === 'move' && isDraggingMap && e.touches.length === 1) {
          state.offset.x = e.touches[0].clientX - dragStart.x;
          state.offset.y = e.touches[0].clientY - dragStart.y;
          draw();
        }
      }, { passive: false });
      
      canvas.addEventListener('touchend', function(e) {
        if (isDraggingMap) {
          isDraggingMap = false;
        }
      }, { passive: false });
  
    // Topbar controls
    document.getElementById('mc-apply-size').onclick = () => {
      const w = clamp(parseInt(document.getElementById('mc-width').value || '1', 10), 1, 256);
      const h = clamp(parseInt(document.getElementById('mc-height').value || '1', 10), 1, 256);
      const tw = clamp(parseInt(document.getElementById('mc-tw').value || '8', 10), 8, 256);
      const th = clamp(parseInt(document.getElementById('mc-th').value || '8', 10), 8, 256);
      setSize(w,h,tw,th);
      refreshPalette();
    };
    document.getElementById('mc-grid').onchange = (e) => { state.grid = e.target.checked; draw(); };
    document.getElementById('mc-zoom-in').onclick = () => {
        state.zoom = Math.min(8, state.zoom * 1.25);
        draw();
    };
    document.getElementById('mc-zoom-out').onclick = () => {
        state.zoom = Math.max(0.05, state.zoom / 1.25);
        draw();
    };
    document.getElementById('mc-zoom-reset').onclick = () => {
        state.zoom = 1;
        state.offset.x = 0;
        state.offset.y = 0;
        draw();
    };
  
    function formatLayerData(data, width) {
        let out = '';
        const rows = Math.ceil(data.length / width);
        for (let y = 0; y < rows; y++) {
            const row = data.slice(y * width, (y + 1) * width).join(', ');
            out += '    ' + row;
            if (y < rows - 1) out += ',\n';
            else out += '\n';
        }
        return out;
    }
    
    // Download JSON compatible with game engine
    document.getElementById('mc-download-json').onclick = () => {
        const json = buildMapJson();
    
        // Build JSON string in the correct order
        let output = '{\n';
        output += `  "compressionlevel": ${json.compressionlevel},\n`;
        output += `  "height": ${json.height},\n`;
        output += `  "infinite": ${json.infinite},\n`;
    
        // Spawn and teleport FIRST, if present
        if (json.spawn)
            output += `  "spawn": { "x": ${json.spawn.x}, "y": ${json.spawn.y} },\n`;
        if (json.teleport)
            output += `  "teleport": { "x": ${json.teleport.x}, "y": ${json.teleport.y}, "xpRequired": ${json.teleport.xpRequired} },\n`;
    
        // Assets
        output += `  "assets": [\n`;
        json.assets.forEach((a, i) => {
            let assetStr = `    ${JSON.stringify(a)}`;
            if (i < json.assets.length - 1) assetStr += ',\n';
            else assetStr += '\n';
            output += assetStr;
        });
        output += '  ],\n';
    
        // Layers
        output += `  "layers": [\n`;
        json.layers.forEach((layer, i) => {
            output += '    {\n';
            output += '      "data": [\n' + layer.data + '      ],\n';
            output += `      "height": ${layer.height},\n`;
            output += `      "id": ${layer.id},\n`;
            output += `      "name": ${JSON.stringify(layer.name)},\n`;
            output += `      "opacity": ${layer.opacity},\n`;
            output += `      "type": ${JSON.stringify(layer.type)},\n`;
            output += `      "visible": ${layer.visible},\n`;
            output += `      "width": ${layer.width},\n`;
            output += `      "x": ${layer.x},\n`;
            output += `      "y": ${layer.y}\n`;
            output += '    }';
            if (i < json.layers.length - 1) output += ',\n';
            else output += '\n';
        });
        output += '  ],\n';
    
        // The rest
        output += `  "nextlayerid": ${json.nextlayerid},\n`;
        output += `  "nextobjectid": ${json.nextobjectid},\n`;
        output += `  "orientation": ${JSON.stringify(json.orientation)},\n`;
        output += `  "renderorder": ${JSON.stringify(json.renderorder)},\n`;
        output += `  "tiledversion": ${JSON.stringify(json.tiledversion)},\n`;
        output += `  "tileheight": ${json.tileheight},\n`;
    
        // Tilesets
        output += `  "tilesets": [\n`;
        json.tilesets.forEach((ts, i) => {
            output += `    ${JSON.stringify(ts)}`;
            if (i < json.tilesets.length - 1) output += ',\n';
            else output += '\n';
        });
        output += '  ],\n';
    
        output += `  "tilewidth": ${json.tilewidth},\n`;
        output += `  "type": ${JSON.stringify(json.type)},\n`;
        output += `  "version": ${JSON.stringify(json.version)},\n`;
        output += `  "width": ${json.width}\n`;
        output += '}\n';
    
        const blob = new Blob([output], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'map.json';
        a.click();
    };
  
    function buildMapJson() {
      // Build assets and tilesets
      const assets = state.assets.map(a => ({
        file_name: a.file_name,
        collision: a.collision ? 1 : 0,
        frames: a.frames || 0
      }));
      const tilesets = state.assets.map((a, i) => ({
        firstgid: i + 1,
        source: `${a.file_name}.tsx`
      }));
      // Layers 
      const layers = state.layers.map((L, i) => ({
        data: formatLayerData(Array.from(L.data), state.width),
        height: state.height,
        id: i + 1,
        name: L.name || `Tile Layer ${i+1}`,
        opacity: 1,
        type: 'tilelayer',
        visible: !!L.visible,
        width: state.width,
        x: 0,
        y: 0
      }));
      const out = {
        compressionlevel: -1,
        height: state.height,
        infinite: false,
        assets,
        layers,
        nextlayerid: layers.length + 1,
        nextobjectid: 1,
        orientation: 'orthogonal',
        renderorder: 'right-down',
        tiledversion: '1.11.2',
        tileheight: state.th,
        tilesets,
        tilewidth: state.tw,
        type: 'map',
        version: '1.10',
        width: state.width
      };
      if (state.spawn) out.spawn = { x: state.spawn.x, y: state.spawn.y };
      if (state.teleport) out.teleport = { x: state.teleport.x, y: state.teleport.y, xpRequired: state.teleport.xpRequired || 0 };
      return out;
    }
  }
  window.renderMapCreatorTab = renderMapCreatorTab;

  //spawn, teleport and xp required options