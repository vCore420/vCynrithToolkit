// Cynrith Definitions URL 
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/vCore420/Cynrith/main/assets/js/DEFINITIONS/";
const MAP_JS_URL = "https://raw.githubusercontent.com/vCore420/Cynrith/main/assets/js/map/map.js";

const definitionFiles = {
    items: GITHUB_RAW_BASE + "items.js",
    skills: GITHUB_RAW_BASE + "skills.js",
    quests: GITHUB_RAW_BASE + "quests.js",
    traders: GITHUB_RAW_BASE + "traders.js",
    npcs: GITHUB_RAW_BASE + "charactersData.js",
    interactTiles: GITHUB_RAW_BASE + "interactTiles.js",
    triggerTiles: GITHUB_RAW_BASE + "triggerTiles.js"
};

const definitions = {};

// Fetches FLOOR_NAMES and NAMED_MAP_INFO straight from the actual game
// engine (assets/js/map/map.js) rather than keeping a separate list in the
// toolkit -- this is the real, authoritative source, so it can never drift
// out of sync the way two hand-maintained copies did before.
async function fetchFloorNames() {
    try {
        const res = await fetch(MAP_JS_URL);
        const text = await res.text();

        const namesMatch = text.match(/const\s+FLOOR_NAMES\s*=\s*(\[[\s\S]*?^\]);/m);
        definitions.floorNames = namesMatch ? eval(namesMatch[1]) : [];

        const namedMapMatch = text.match(/const\s+NAMED_MAP_INFO\s*=\s*({[\s\S]*?^\});/m);
        definitions.namedMapInfo = namedMapMatch ? eval('(' + namedMapMatch[1] + ')') : {};
        return true;
    } catch (e) {
        console.error('[Editor] Failed to load floor names from map.js:', e);
        definitions.floorNames = definitions.floorNames || [];
        definitions.namedMapInfo = definitions.namedMapInfo || {};
        return false;
    }
}

// A "map key" is either a plain floor number (0, 1, 2...) or a special
// string id like "castle0" or "title1" -- real NPC spawn data actually uses
// both (e.g. `{ map: "castle0", ... }` right alongside `{ map: 0, ... }`),
// so anything that only handled numbers would silently drop real content.
function isNumericMapKey(key) {
    return key !== "" && key !== null && !isNaN(Number(key));
}

function getFloorLabel(key) {
    if (isNumericMapKey(key)) {
        const idx = Number(key);
        const name = (definitions.floorNames || [])[idx];
        return name ? `Floor ${idx + 1}: ${name}` : `Floor ${idx + 1}`;
    }
    const info = (definitions.namedMapInfo || {})[key];
    if (info && info.name) {
        const parent = (info.floor !== undefined && isNumericMapKey(info.floor)) ? ` (${getFloorLabel(info.floor)})` : "";
        return `${info.name}${parent}`;
    }
    return String(key); // unrecognized special map (e.g. a new "titleN") -- show the raw id rather than hide it
}

// Scans every fetched category for map references (NPC & enemy spawns,
// interact & trigger tile positions) and returns the set that actually has
// something on it -- numeric floors sorted first, then named maps
// alphabetically. This is what makes floor/map detection automatic, no list
// to maintain as Cynrith grows.
function getKnownMapKeys() {
    const found = new Set();

    function scanSpawns(obj) {
        if (!obj || typeof obj !== "object") return;
        Object.values(obj).forEach(entry => {
            if (entry && Array.isArray(entry.spawns)) {
                entry.spawns.forEach(s => {
                    if (s && s.map !== undefined && s.map !== null && s.map !== "") found.add(s.map);
                });
            }
        });
    }
    scanSpawns(definitions.npcs);
    scanSpawns(definitions.enemies);

    function scanMapField(arr) {
        if (!Array.isArray(arr)) return;
        arr.forEach(entry => {
            if (entry && entry.map !== undefined && entry.map !== null && entry.map !== "") found.add(entry.map);
        });
    }
    scanMapField(definitions.interactTiles);
    scanMapField(definitions.triggerTiles);

    const all = Array.from(found);
    const numeric = all.filter(isNumericMapKey).map(Number).sort((a, b) => a - b);
    const named = all.filter(k => !isNumericMapKey(k)).sort();
    return [...numeric, ...named];
}

// Same detected numeric floors, plus a few "room to grow" slots beyond the
// highest known one -- Floor Creator needs to let you start building on a
// brand new floor that has zero NPCs/enemies/tiles yet, which detection
// alone would never surface (there's nothing there yet to find). Named maps
// (castle0, title1, etc) are deliberately NOT included here: Floor Creator's
// loading pipeline forces selections through Number(), so a string key would
// silently match nothing rather than erroring -- worse than not offering it.
// The read-only Floor Visualizer is where those belong (getKnownMapKeys()).
function getFloorOptionsForCreator() {
    const known = getKnownMapKeys().filter(isNumericMapKey).map(Number);
    const maxKnown = known.length ? known[known.length - 1] : -1;
    const extras = [maxKnown + 1, maxKnown + 2, maxKnown + 3];
    return Array.from(new Set([...known, ...extras])).sort((a, b) => a - b);
}

// Fetch and parse definitions
async function fetchDefinition(url) {
    const res = await fetch(url);
    const text = await res.text();

    if (url.includes("charactersData.js")) {
        // NPCs 
        const npcMatch = text.match(/const\s+NPC_DEFINITIONS\s*=\s*({[\s\S]*?^\});/m);
        if (npcMatch && npcMatch[1]) {
            try {
                var npcs = eval('(' + npcMatch[1] + ')');
            } catch (e) {
                console.error("Failed to eval NPC_DEFINITIONS:", e);
                var npcs = {};
            }
        } else {
            console.error("Could not extract NPC_DEFINITIONS object from file.");
            var npcs = {};
        }

        // Enemies
        const enemyMatch = text.match(/const\s+ENEMY_TYPES\s*=\s*({[\s\S]*?^\});/m);
        if (enemyMatch && enemyMatch[1]) {
            try {
                definitions.enemies = eval('(' + enemyMatch[1] + ')');
            } catch (e) {
                console.error("Failed to eval ENEMY_TYPES:", e);
                definitions.enemies = {};
            }
        } else {
            definitions.enemies = {};
        }

        return npcs;
    }

    // Quests
    if (url.includes("quests.js")) {
        const questMatch = text.match(/const\s+QUEST_DEFINITIONS\s*=\s*({[\s\S]*?^\});/m);
        if (questMatch && questMatch[1]) {
            try {
                return eval('(' + questMatch[1] + ')');
            } catch (e) {
                console.error("Failed to eval QUEST_DEFINITIONS:", e);
                return {};
            }
        } else {
            console.error("Could not extract QUEST_DEFINITIONS object from file.");
            return {};
        }
    }

    // Interact Tiles
    if (url.includes("interactTiles.js")) {
        const match = text.match(/const\s+INTERACTABLE_TILES\s*=\s*(\[[\s\S]*?^\]);/m);
        if (match && match[1]) {
            try {
                return eval(match[1]);
            } catch (e) {
                console.error("Failed to eval INTERACTABLE_TILES:", e);
                return [];
            }
        } else {
            console.error("Could not extract INTERACTABLE_TILES array from file.");
            return [];
        }
    }

    // Trigger Tiles
    if (url.includes("triggerTiles.js")) {
        const match = text.match(/const\s+TRIGGER_TILES\s*=\s*(\[[\s\S]*?^\]);/m);
        if (match && match[1]) {
            try {
                return eval(match[1]);
            } catch (e) {
                console.error("Failed to eval TRIGGER_TILES:", e);
                return [];
            }
        } else {
            console.error("Could not extract TRIGGER_TILES array from file.");
            return [];
        }
    }

    // Items 
    if (url.includes("items.js")) {
        const match = text.match(/const\s+ITEM_DEFINITIONS\s*=\s*({[\s\S]*?^\});/m);
        if (match && match[1]) {
            try {
                return eval('(' + match[1] + ')');
            } catch (e) {
                console.error("Failed to eval ITEM_DEFINITIONS:", e);
                return {};
            }
        } else {
            console.error("Could not extract ITEM_DEFINITIONS object from file.");
            return {};
        }
    }

    // Skills
    if (url.includes("skills.js")) {
        const match = text.match(/const\s+Skills\s*=\s*(\[[\s\S]*?^\]);/m);
        if (match && match[1]) {
            try {
                return eval(match[1]);
            } catch (e) {
                console.error("Failed to eval Skills:", e);
                return [];
            }
        } else {
            console.error("Could not extract Skills array from file.");
            return [];
        }
    }

    window.exports = {};
    eval(text);
    if (window.exports.npcs) return window.exports.npcs;
    return window.exports;
}
  
// Load all definitions
let liveDataFailures = [];

function updateLiveDataWarning() {
    const el = document.getElementById('live-data-warning');
    if (!el) return;
    if (liveDataFailures.length) {
        el.style.display = 'block';
        el.textContent = `⚠ Couldn't load: ${liveDataFailures.join(', ')}. Related dropdowns/lists may be incomplete -- try Refresh Live Data again in a moment.`;
    } else {
        el.style.display = 'none';
        el.textContent = '';
    }
}

// Fetches everything fresh from GitHub and updates `definitions` in place.
// Used both for the initial page load and for the "Refresh Live Data"
// button, so the toolkit's dropdowns/catalogs can be brought up to date
// mid-session without a full page reload.
async function refreshLiveData() {
    const btn = document.getElementById('refresh-data-btn');
    const originalText = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = '🔄 Refreshing...'; }

    liveDataFailures = [];
    for (const [key, url] of Object.entries(definitionFiles)) {
        try {
            definitions[key] = await fetchDefinition(url);
            console.log(`[Editor] Loaded ${key} definitions from GitHub`);
        } catch (e) {
            console.error(`[Editor] Failed to load ${key}:`, e);
            definitions[key] = definitions[key] || {}; // keep whatever we had before rather than wiping it on a refresh failure
            liveDataFailures.push(key);
        }
    }
    const floorNamesOk = await fetchFloorNames();
    if (!floorNamesOk) liveDataFailures.push('floor names');

    updateLiveDataWarning();

    // Refresh whichever tabs are currently showing live data, so an update
    // is visible right away instead of only on next navigation.
    const fvTab = document.getElementById('floor-visualizer-tab');
    if (fvTab && fvTab.classList.contains('active')) renderFloorVisualizer();
    const itemsTab = document.getElementById('items-tab');
    if (itemsTab && itemsTab.classList.contains('active')) renderItemsTab();
    const skillsTab = document.getElementById('skills-tab');
    if (skillsTab && skillsTab.classList.contains('active')) renderSkillsTab();

    if (btn) { btn.disabled = false; btn.textContent = originalText; }
}

async function loadAllDefinitions() {
    await refreshLiveData();
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}
  
loadAllDefinitions();

document.getElementById('refresh-data-btn').onclick = refreshLiveData;

// Tab switching logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.editor-tab').forEach(tab => tab.classList.remove('active'));
        const tabId = btn.dataset.tab + '-tab';
        document.getElementById(tabId).classList.add('active');

        const mainPanel = document.getElementById('main-panel');
        if (mainPanel) mainPanel.scrollTop = 0;

        
        if (tabId === 'floor-visualizer-tab') renderFloorVisualizer();
        if (tabId === 'items-tab') renderItemsTab();
        if (tabId === 'skills-tab') renderSkillsTab();
        if (tabId === 'creator-tab') renderCreatorTab();
        if (tabId === 'tile-maker-tab') renderTileMakerTab();
        if (tabId === 'tile-editor-tab') renderTileEditorTab();
        if (tabId === 'sprite-sheet-tab') renderSpriteSheetTab();
        if (tabId === 'map-creator-tab') renderMapCreatorTab();
    };
});

// --- Project Backup ---
// Everything the toolkit saves lives only in this browser's IndexedDB (see
// autosave.js). This bundles all of it -- Map Creator, Tile Editor, Tile
// Generator, Sprite Sheet Creator, and Floor Creator, including in-progress
// drafts -- into one downloadable file, and can restore from one, so a
// session isn't trapped in a single browser.
const PROJECT_AUTOSAVE_KEYS = ['mapCreator', 'tileEditor', 'tileGenerator', 'spriteSheet', 'floorCreator'];

async function exportProjectBackup() {
    const bundle = { app: 'vCynrithToolkit', version: 1, exportedAt: new Date().toISOString(), data: {} };
    for (const key of PROJECT_AUTOSAVE_KEYS) {
        try {
            bundle.data[key] = await Autosave.load(key);
        } catch (e) {
            console.warn(`Backup: failed to read "${key}"`, e);
            bundle.data[key] = null;
        }
    }
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.download = `cynrith_toolkit_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.href = URL.createObjectURL(blob);
    a.click();
}

async function importProjectBackup(file) {
    let bundle;
    try {
        bundle = JSON.parse(await file.text());
    } catch (e) {
        alert("Could not read this file -- it doesn't look like valid JSON.");
        return;
    }
    if (!bundle || typeof bundle.data !== 'object' || bundle.app !== 'vCynrithToolkit') {
        alert("This doesn't look like a Cynrith Toolkit backup file.");
        return;
    }
    const ok = confirm(
        "Import this backup? This REPLACES everything currently saved in Map Creator, " +
        "Tile Editor, Tile Generator, Sprite Sheet Creator, and Floor Creator with what's " +
        "in the backup file (exported " + (bundle.exportedAt || "unknown date") + "). " +
        "The page will reload afterward.\n\nThis can't be undone -- export a fresh backup of " +
        "your current work first if you want to keep it too."
    );
    if (!ok) return;

    for (const key of PROJECT_AUTOSAVE_KEYS) {
        if (bundle.data[key] !== undefined && bundle.data[key] !== null) {
            try {
                await Autosave.save(key, bundle.data[key]);
            } catch (e) {
                console.warn(`Backup: failed to restore "${key}"`, e);
            }
        }
    }
    location.reload();
}

document.getElementById('export-backup-btn').onclick = exportProjectBackup;
document.getElementById('import-backup-btn').onclick = () => document.getElementById('import-backup-input').click();
document.getElementById('import-backup-input').onchange = (e) => {
    const file = e.target.files[0];
    if (file) importProjectBackup(file);
    e.target.value = ''; // allow re-selecting the same file to re-trigger onchange
};

