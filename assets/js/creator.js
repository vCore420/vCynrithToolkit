// This is a mess and i apologize to the reader but it does do the job for now until i get around to refactoring it


// Creator Tab State
const creatorState = {
    npc: {
        name: "",
        spriteGender: "m",
        spriteNumber: "1",
        mapNumber: 0,
        dialogueDefault: "",
        hasQuest: false,
        wanderArea: null,
        spawn: null,
        // Quest fields
        questId: "",
        questName: "",
        questDescription: "",
        questRedoable: false,
        forcedEncounter: { enabled: false, triggerTiles: [], triggered: false },
        questGiven: "",
        questIncomplete: "",
        questComplete: "",
        questType: "gift",
        questTypeOptions: {},
        questRewards: "",
        questIcon: "", // optional; shown in quest UI when there's no inventory icon to use
        questIdManual: false 
    }
};

let savedNpcs = [];

const enemyCreatorState = {
    enemy: {
        id: "",
        name: "",
        sprite: "assets/img/enemy/enemy_01.png",
        moveSpeed: 1.0,
        distance: 3,
        maxHealth: 20,
        attack: 5,
        defense: 2,
        speed: 1,
        xpGain: 10,
        loot: [],
        mapNumber: 0,
        spawns: []
    }
};

let savedEnemies = [];

let wanderSelectionStep = 0; 
let wanderFirstCorner = null;
let enemySpawnSelectionStep = 0; 
let enemySpawnFirstCorner = null;
let enemyCurrentWanderArea = null;
let forcedEncounterPicking = false; // true while clicking the map adds/removes trigger tiles

const triggerCreatorState = {
    trigger: {
        id: "",
        mapNumber: 0,
        x: null,
        y: null,
        type: "dialogue",
        sound: { enabled: false, file: "", type: "ambient" },
        oneTime: false,
        rewards: []
    }
};
let savedTriggers = [];
let triggerSelectionStep = 0; 

// Interactable tile tool state
const interactCreatorState = {
    tile: {
        id: "",
        mapNumber: 0,
        x: null,
        y: null,
        // visuals
        useSprite: false,
        image: "",                 
        spriteSheet: "",           
        imageW: 0,
        imageH: 0,
        rows: 1,
        cols: 1,
        animSpeed: 6,
        animOnTrigger: false,
        // gameplay
        collision: false,
        zIndex: 0,                 
        notification: "",          
        dialogue: [],
        rewards: [],
        sound: { enabled: false, file: "", type: "trigger" }
    }
};
let savedInteractTiles = [];
let interactSelectionStep = 0; 

// World Sprite tool state
const worldSpriteCreatorState = {
    sprite: {
        id: "",
        imageName: "",        
        imageW: 0,
        imageH: 0,
        rows: 1,
        cols: 1,
        row: 0,               
        animSpeed: 0,         
        zIndex: 0,
        collision: false,
        positions: [],        
        positionMap: ""       
    }
};
let savedWorldSprites = [];
let spriteSelectionStep = 0;

// Item tool state
const itemCreatorState = {
    item: {
        id: "",
        name: "",
        description: "",
        imageName: "",         // base name; if empty uses id
        rarity: "common",
        stackable: true,
        useable: false,
        removeable: true,
        sound: { enabled: false, file: "" }, // base only; .mp3 assumed
        homePlaceable: false,
        homeDef: {
            spriteSheetOverride: "", // full path; blank reuses this item's own `image` field
            imageW: 64,
            imageH: 64,
            rows: 1,
            cols: 1,
            animSpeed: 0,
            zIndex: 0,
            collision: true,
            canStackOnPlaced: false,
            footprintW: 1,
            footprintH: 1
        }
    }
};
let savedItems = [];

// Skill tool state
const skillCreatorState = {
    skill: {
        id: "",
        name: "",
        description: "",
        imageName: "",     // base name; if empty uses id
        pool: "blue",      // blue, red, pink, all
        chance: 1.0,
        maxLevel: 20,
        rarity: "common",  // common, rare, epic, legendary
        buffs: [],         // [{ key, value }]
        drawbacks: []      // [{ key, value }]
    }
};
let savedSkills = [];

// Traders aren't tied to a floor in the actual data (TRADER_DEFINITIONS is a
// flat namespace, grouped by floor only via source comments), so -- like
// items/skills -- savedTraders is NOT reset when switching floors/maps.
const traderCreatorState = {
    trader: {
        id: "",   // e.g. "trader11" -- unique string ID referenced by an NPC's "trader" field
        buy: [],  // [{ id: itemId, price }] -- items the trader sells to the player
        sell: []  // [{ id: itemId, price }] -- items the trader buys from the player
    }
};
let savedTraders = [];

let creatorMapZoom = 1;
let creatorMapOffset = { x: 0, y: 0 };
let creatorMapAssets = {};
let creatorMapImages = {};
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let currentFloorIdx = "";      // value of the creator-map-select dropdown
let currentMapData = null;     // parsed map JSON currently loaded, if any
let currentCreatorTool = null; // which sub-tool panel (npc/enemy/etc) is open

function normalizeIdFromName(name) {
    return (name || "")
        .toLowerCase()
        .replace(/\s*-\s*/g, "_")
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
}

// --- Autosave: persists to IndexedDB so work survives a full page reload,
// not just switching tabs (see autosave.js). Covers the loaded map + its
// assets, every saved NPC/enemy/trigger/interact tile/sprite/item/skill, the
// in-progress draft in each of the 7 sub-tools, and which sub-tool was open.
// Note: `definitions` (the live game data fetched from GitHub on load) is
// intentionally NOT part of this -- it's always re-fetched fresh, and
// savedNpcs/savedEnemies/etc already capture whatever was filtered from it
// plus anything added locally, so nothing is lost by not caching it too. ---
const CREATOR_AUTOSAVE_KEY = 'floorCreator';

function serializeCreatorState() {
    return {
        floorIdx: currentFloorIdx,
        mapData: currentMapData,
        mapAssets: creatorMapAssets,   // already {fileName: dataURL} strings
        mapZoom: creatorMapZoom,
        mapOffset: creatorMapOffset,
        currentTool: currentCreatorTool,

        savedNpcs, savedEnemies, savedTriggers, savedInteractTiles,
        savedWorldSprites, savedItems, savedSkills, savedTraders,

        npcDraft: creatorState.npc,
        enemyDraft: enemyCreatorState.enemy,
        triggerDraft: triggerCreatorState.trigger,
        interactDraft: interactCreatorState.tile,
        spriteDraft: worldSpriteCreatorState.sprite,
        itemDraft: itemCreatorState.item,
        skillDraft: skillCreatorState.skill,
        traderDraft: traderCreatorState.trader
    };
}

const scheduleCreatorAutosave = Autosave.debounce(() => {
    Autosave.save(CREATOR_AUTOSAVE_KEY, serializeCreatorState());
}, 1200);

async function restoreCreatorAutosave() {
    const saved = await Autosave.load(CREATOR_AUTOSAVE_KEY);
    if (!saved) return;
    try {
        currentFloorIdx = saved.floorIdx || "";
        const floorSelect = document.getElementById('creator-map-select');
        if (floorSelect) floorSelect.value = currentFloorIdx;

        savedNpcs = saved.savedNpcs || [];
        savedEnemies = saved.savedEnemies || [];
        savedTriggers = saved.savedTriggers || [];
        savedInteractTiles = saved.savedInteractTiles || [];
        savedWorldSprites = saved.savedWorldSprites || [];
        savedItems = saved.savedItems || [];
        savedSkills = saved.savedSkills || [];
        savedTraders = saved.savedTraders || [];

        if (saved.npcDraft) creatorState.npc = saved.npcDraft;
        if (saved.enemyDraft) enemyCreatorState.enemy = saved.enemyDraft;
        if (saved.triggerDraft) triggerCreatorState.trigger = saved.triggerDraft;
        if (saved.interactDraft) interactCreatorState.tile = saved.interactDraft;
        if (saved.spriteDraft) worldSpriteCreatorState.sprite = saved.spriteDraft;
        if (saved.itemDraft) itemCreatorState.item = saved.itemDraft;
        if (saved.skillDraft) skillCreatorState.skill = saved.skillDraft;
        if (saved.traderDraft) traderCreatorState.trader = saved.traderDraft;

        creatorMapZoom = saved.mapZoom ?? 1;
        creatorMapOffset = saved.mapOffset || { x: 0, y: 0 };

        // showCreatorMap() also rebuilds the tool sidebar (via showToolPanel())
        // and re-derives creatorMapImages from creatorMapAssets, so reusing it
        // here gets us map + assets + tool sidebar restoration for free.
        if (saved.mapData) {
            showCreatorMap(saved.mapData, saved.mapAssets || {});
            renderSavedNpcs();
            renderSavedEnemies();
            renderSavedTriggers();
            renderSavedInteractTiles();
            renderSavedWorldSprites();
        }
        renderSavedItems();
        renderSavedSkills();
        renderSavedTraders();

        if (saved.currentTool) {
            currentCreatorTool = saved.currentTool;
            const sidebar = document.getElementById('creator-tool-sidebar');
            const btn = sidebar && sidebar.querySelector(`.tool-btn[data-tool="${saved.currentTool}"]`);
            if (btn) btn.classList.add('active');
            showToolOptions(saved.currentTool);
        }
    } catch (err) {
        console.warn('Floor Creator: failed to restore autosave', err);
    }
}

// Creator Tab Render
let __creatorInitialized = false;
function renderCreatorTab() {
    // Only build the Floor Creator shell once per session. creatorState,
    // savedNpcs, savedEnemies, etc. already live at module scope so they
    // survive tab switches, but without this guard the upload wizard and
    // map preview canvas would still get torn down and have to be redone.
    if (__creatorInitialized) return;
    __creatorInitialized = true;

    const tab = document.getElementById('creator-tab');
    tab.innerHTML = `
        <h2>Floor Creator</h2>
        <div id="creator-map-load-controls" style="margin-bottom:16px;">
            <label>
                <b>Load Existing Map:</b>
                <select id="creator-map-select">
                    <option value="">-- New Map --</option>
                    <option value="0">Floor 1: Verdant Rise</option>
                    <option value="1">Floor 2: Stonewake Expanse</option>
                    <option value="2">Floor 3: Gloomroot Thicket</option>
                    <option value="3">Floor 4: The Shattered Spires</option>
                    <option value="4">Floor 5: Umbracourt</option>
                    <option value="5">Floor 6: the Waystation Veil</option>
                    <option value="6">Floor 7: The Withering Archipelago</option>
                </select>
            </label>
        </div>
        <div id="map-json-controls" style="margin-bottom:16px;">
            <h3>Step 1: Upload your map JSON file</h3>
            <p>Select your exported map JSON file to begin.</p>
            <input type="file" id="map-json-upload" accept=".json" />
            <div id="map-json-status" style="margin-top:8px; color: #eaeaea;"></div>
        </div>
        <div id="creator-assets-controls" style="margin-top:16px;"></div>
        <div id="creator-tool-options" style="margin-top:16px;"></div>
        <div id="creator-map-container" style="display:flex; width:900px; height:600px; margin:32px auto 0 auto; position:relative;">
            <div id="creator-tool-sidebar" style="width:120px; min-width:100px; background:#232634; border-radius:8px 0 0 8px; box-shadow:0 2px 8px #0003; padding:12px; z-index:2; display:flex; flex-direction:column; gap:8px;">
            </div>
            <div id="creator-map-preview" style="flex:1; position:relative; height:100%;"></div>
        </div>
        <div id="saved-npcs-list" style="margin-top:24px;"></div>
        <div id="npc-download-buttons" style="margin-top:16px;"></div>
        <div id="saved-enemies-list" style="margin-top:24px;"></div>
        <div id="enemy-download-buttons" style="margin-top:16px;"></div>
        <div id="saved-triggers-list" style="margin-top:24px;"></div>
        <div id="trigger-download-buttons" style="margin-top:16px;"></div>
        <div id="saved-interacts-list" style="margin-top:24px;"></div>
        <div id="interact-download-buttons" style="margin-top:16px;"></div>
        <div id="saved-sprites-list" style="margin-top:24px;"></div>
        <div id="sprite-download-buttons" style="margin-top:16px;"></div>
        <div id="saved-items-list" style="margin-top:24px;"></div>
        <div id="item-download-buttons" style="margin-top:16px;"></div>
        <div id="saved-skills-list" style="margin-top:24px;"></div>
        <div id="skill-download-buttons" style="margin-top:16px;"></div>
        <div id="saved-traders-list" style="margin-top:24px;"></div>
        <div id="trader-download-buttons" style="margin-top:16px;"></div>
    `;

    document.getElementById('creator-map-select').onchange = function(e) {
        const idx = e.target.value;
        if (idx !== "") {
            // Prompt for map JSON upload
            const statusDiv = document.getElementById('map-json-status');
            statusDiv.innerHTML = `<span style="color: #2196f3;"><b>Please upload the JSON file for this map.</b></span>`;
            // Listen for file upload
            document.getElementById('map-json-upload').onchange = function(ev) {
                const file = ev.target.files[0];
                if (!file) {
                    statusDiv.innerHTML = `<span style="color: #ff9800;"><b>No file selected.</b></span>`;
                    return;
                }
                const reader = new FileReader();
                reader.onload = function(ev2) {
                    try {
                        const mapData = JSON.parse(ev2.target.result);
                        statusDiv.innerHTML = `<span style="color: #4caf50;"><b>Map loaded successfully!</b></span>`;
                        // Prompt for assets upload as usual
                        promptForAssets(mapData);
                    } catch (err) {
                        statusDiv.innerHTML = `<span style="color: #ff9800;"><b>Error: Invalid map JSON file.</b></span>`;
                    }
                };
                reader.readAsText(file);
            };
        }
    };

    document.getElementById('map-json-upload').onchange = function(e) {
        const file = e.target.files[0];
        const statusDiv = document.getElementById('map-json-status');
        if (!file) {
            statusDiv.innerHTML = `<span style="color: #ff9800;"><b>No file selected.</b></span>`;
            return;
        }
        const reader = new FileReader();
        reader.onload = function(ev) {
            try {
                const mapData = JSON.parse(ev.target.result);
                statusDiv.innerHTML = `<span style="color: #4caf50;"><b>Map loaded successfully!</b></span>`;
                promptForAssets(mapData);
            } catch (err) {
                statusDiv.innerHTML = `<span style="color: #ff9800;"><b>Error: Invalid map JSON file.</b></span>`;
            }
        };
        reader.readAsText(file);
    };

    // Autosave: rather than instrument every one of the dozens of field
    // handlers across all 7 sub-tools individually (high risk of missing
    // one in a file this size), listen for any input/change/click within
    // the whole tab and schedule a debounced save. Cheap and comprehensive.
    tab.addEventListener('input', scheduleCreatorAutosave);
    tab.addEventListener('change', scheduleCreatorAutosave);
    tab.addEventListener('click', scheduleCreatorAutosave);

    restoreCreatorAutosave();
}

function loadExistingMapAndDefinitions(floorIdx, mapData, loadedAssets) {
    currentFloorIdx = String(floorIdx);
    // Load all definitions for this map
    savedNpcs = Object.values(definitions.npcs || {}).filter(npc =>
        Array.isArray(npc.spawns) &&
        npc.spawns.some(spawn => Number(spawn.map) === floorIdx)
    );
    savedEnemies = Object.values(definitions.enemies || {}).filter(enemy =>
        Array.isArray(enemy.spawns) &&
        enemy.spawns.some(spawn => Number(spawn.map) === floorIdx)
    );
    savedTriggers = (definitions.triggerTiles || []).filter(trig =>
        Number(trig.map) === floorIdx
    );
    savedInteractTiles = (definitions.interactTiles || []).filter(tile =>
        Number(tile.map) === floorIdx
    );
    savedWorldSprites = Object.values(definitions.worldSprites || {}).filter(ws =>
        (ws.positions || []).some(p => Number(p.map) === floorIdx)
    );

    // Reset selection steps, offsets, etc
    wanderSelectionStep = 0;
    enemySpawnSelectionStep = 0;
    triggerSelectionStep = 0;
    interactSelectionStep = 0;
    spriteSelectionStep = 0;
    creatorMapOffset = { x: 0, y: 0 };
    creatorMapZoom = 1;

    // Render map and markers
    showCreatorMap(mapData, loadedAssets);
    renderSavedNpcs();
    renderSavedEnemies();
    renderSavedTriggers();
    renderSavedInteractTiles();
    renderSavedWorldSprites();
}

function getWanderTiles(area) {
    if (!area) return [];
    if (Array.isArray(area.tiles)) return area.tiles;
    if (typeof area.x1 === "number" && typeof area.y1 === "number" &&
        typeof area.x2 === "number" && typeof area.y2 === "number") {
        const tiles = [];
        for (let x = area.x1; x <= area.x2; x++) {
            for (let y = area.y1; y <= area.y2; y++) {
                tiles.push({ x, y });
            }
        }
        return tiles;
    }
    return [];
}

// Asset Prompt
function promptForAssets(mapData) {
    const controlsDiv = document.getElementById('creator-assets-controls');
    const assetNames = mapData.assets.map(a => a.file_name + ".png");
    controlsDiv.innerHTML = `
        <h3>Step 2: Select your map's asset folder</h3>
        <p>Please select the folder containing your map's PNG assets.<br>
        The editor will automatically check for required files after upload.</p>
        <input type="file" id="map-assets-upload" webkitdirectory directory multiple accept="image/png" />
        <div id="asset-upload-status" style="margin-top:8px; color: #eaeaea;"></div>
    `;

    document.getElementById('map-assets-upload').onchange = function(e) {
        const files = Array.from(e.target.files);
        const statusDiv = document.getElementById('asset-upload-status');
        let loadedAssets = {};
        let missingAssets = assetNames.slice();
        let loadedCount = 0;
        files.forEach(file => {
            const fileName = file.name.split('/').pop();
            if (assetNames.includes(fileName)) {
                const reader = new FileReader();
                reader.onload = function(ev) {
                    loadedAssets[fileName] = ev.target.result;
                    missingAssets.splice(missingAssets.indexOf(fileName), 1);
                    loadedCount++;
                    if (loadedCount === assetNames.length) {
                        statusDiv.innerHTML = `<span style="color: #4caf50;"><b>All required assets loaded!</b></span>`;
                    } else if (missingAssets.length > 0) {
                        statusDiv.innerHTML = `<span style="color: #ff9800;"><b>Missing assets:</b> ${missingAssets.join(", ")}</span>`;
                    }
                    const floorIdx = document.getElementById('creator-map-select').value;
                    if (floorIdx !== "") {
                        loadExistingMapAndDefinitions(Number(floorIdx), mapData, loadedAssets);
                    } else {
                        // New Map: clear save lists and just show the map
                        currentFloorIdx = "";
                        savedNpcs = [];
                        savedEnemies = [];
                        savedTriggers = [];
                        savedInteractTiles = [];
                        savedWorldSprites = [];
                        showCreatorMap(mapData, loadedAssets);
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    
        setTimeout(() => {
            if (Object.keys(loadedAssets).length === 0) {
                statusDiv.innerHTML = `<span style="color: #ff9800;"><b>No required assets found in selected folder.</b></span>`;
                const floorIdx = document.getElementById('creator-map-select').value;
                if (floorIdx !== "") {
                    loadExistingMapAndDefinitions(Number(floorIdx), mapData, {});
                } else {
                    // New Map: clear save lists and just show the map
                    currentFloorIdx = "";
                    savedNpcs = [];
                    savedEnemies = [];
                    savedTriggers = [];
                    savedInteractTiles = [];
                    savedWorldSprites = [];
                    showCreatorMap(mapData, {});
                }
            }
        }, 500);
    };
}

// Tool Panel 
function showToolPanel() {
    const sidebar = document.getElementById('creator-tool-sidebar');
    sidebar.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
            <button class="tool-btn" data-tool="npc">NPC Creator</button>
            <button class="tool-btn" data-tool="enemy">Enemy Creator</button>
            <button class="tool-btn" data-tool="trigger">Trigger Tile Creator</button>
            <button class="tool-btn" data-tool="interact">Interactable Tile Creator</button>
            <button class="tool-btn" data-tool="sprite">World Sprite Creator</button>
            <button class="tool-btn" data-tool="item">Item Creator</button>
            <button class="tool-btn" data-tool="skill">Skill Creator</button>
            <button class="tool-btn" data-tool="trader">Trader Creator</button>
            <button class="tool-btn" data-tool="check">🔍 Consistency Check</button>
        </div>
    `;
    sidebar.querySelectorAll('.tool-btn').forEach(btn => {
        btn.onclick = function() {
            sidebar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCreatorTool = btn.dataset.tool;
            showToolOptions(btn.dataset.tool);
        };
    });
}

// Tool Options
function showToolOptions(tool) {
    const optionsDiv = document.getElementById('creator-tool-options');
    if (tool === 'npc') {
        const npc = creatorState.npc;
        // Defensive backfill: NPCs saved/autosaved before forcedEncounter existed
        // (or using the old flat npcForced/triggerTiles string) would otherwise
        // crash here.
        if (!npc.forcedEncounter || typeof npc.forcedEncounter !== 'object' || !Array.isArray(npc.forcedEncounter.triggerTiles)) {
            npc.forcedEncounter = { enabled: !!npc.npcForced, triggerTiles: [], triggered: false };
        }
        optionsDiv.innerHTML = `
            <h3>NPC Creator</h3>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:520px;">
                <label>
                    Character Name:<br>
                    <input type="text" id="npc-name" value="${npc.name}" placeholder="e.g. Mira the Gatherer" style="width:100%;" />
                </label>
                <label>
                    Sprite:<br>
                    <select id="npc-sprite-gender">
                        <option value="m" ${npc.spriteGender === "m" ? "selected" : ""}>Male</option>
                        <option value="f" ${npc.spriteGender === "f" ? "selected" : ""}>Female</option>
                    </select>
                    <select id="npc-sprite-number">
                        ${Array.from({length:9}, (_,i) => `<option value="${i+1}" ${npc.spriteNumber == (i+1) ? "selected" : ""}>${i+1}</option>`).join("")}
                    </select>
                </label>
                <label>
                    Map Number:<br>
                    <input type="number" id="npc-map-number" min="0" max="99" value="${npc.mapNumber}" style="width:80px;" />
                </label>
                <label>
                    Default Dialogue:<br>
                    <textarea id="npc-dialogue-default" rows="3" style="width:100%;" placeholder="One line per dialogue">${npc.dialogueDefault}</textarea>
                </label>
                <button id="npc-set-wander-btn" style="margin-top:8px;">Set Wander Area & Spawn</button>
                <div id="npc-wander-preview" style="margin-top:8px;"></div>
                <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px; margin-top:4px;">
                    <legend>Forced Encounter</legend>
                    <div style="color:#9aa4b2; font-size:11px; margin-bottom:6px;">Independent of quests -- an NPC can force an encounter without giving a quest at all.</div>
                    <label style="display:flex; gap:8px; align-items:center;">
                        <input type="checkbox" id="npc-forced-enabled" ${npc.forcedEncounter.enabled ? "checked" : ""}/> Enabled
                    </label>
                    <div id="npc-forced-section" style="display:${npc.forcedEncounter.enabled ? "flex" : "none"}; flex-direction:column; gap:8px; margin-top:8px;">
                        <button id="npc-set-trigger-tiles-btn" type="button">${forcedEncounterPicking ? "Done Picking (click tiles on map)" : "Pick Trigger Tiles on Map"}</button>
                        <div id="npc-forced-preview" style="color:#9aa4b2; font-size:12px;">${npc.forcedEncounter.triggerTiles.length} tile(s) selected.</div>
                        <button id="npc-clear-trigger-tiles-btn" type="button">Clear Trigger Tiles</button>
                    </div>
                </fieldset>
                <label style="margin-top:8px;">
                    <input type="checkbox" id="npc-has-quest" ${npc.hasQuest ? "checked" : ""}/> This NPC gives a quest
                </label>
                ${npc.hasQuest ? `
                <div id="npc-quest-section" style="margin-top:12px; background:none; border-radius:8px; padding:12px; display:flex; flex-direction:column;">
                    <h4>Quest Data</h4>
                    <label>
                        Quest ID:<br>
                        <input type="text" id="quest-id" value="${npc.questId}" style="width:100%;" placeholder="e.g. mira_gatherer" />
                    </label>
                    <label>
                        Quest Name:<br>
                        <input type="text" id="quest-name" value="${npc.questName}" style="width:100%;" placeholder="e.g. Dewleaf Gathering" />
                    </label>
                    <label>
                        Quest Description:<br>
                        <textarea id="quest-description" rows="2" style="width:100%;" placeholder="Quest description">${npc.questDescription}</textarea>
                    </label>
                    <label>
                        <input type="checkbox" id="quest-redoable" ${npc.questRedoable ? "checked" : ""}/> Quest is redoable
                    </label>
                    <label>
                        Quest Given Dialogue:<br>
                        <textarea id="quest-given-dialogue" rows="2" style="width:100%;" placeholder="One line per dialogue">${npc.questGiven}</textarea>
                    </label>
                    <label>
                        Quest Incomplete Dialogue:<br>
                        <textarea id="quest-incomplete-dialogue" rows="2" style="width:100%;" placeholder="One line per dialogue">${npc.questIncomplete}</textarea>
                    </label>
                    <label>
                        Quest Complete Dialogue:<br>
                        <textarea id="quest-complete-dialogue" rows="2" style="width:100%;" placeholder="One line per dialogue">${npc.questComplete}</textarea>
                    </label>
                    <label>
                        Quest Type:<br>
                        <select id="quest-type">
                            <option value="gift" ${npc.questType === "gift" ? "selected" : ""}>Gift</option>
                            <option value="itemCollect" ${npc.questType === "itemCollect" ? "selected" : ""}>Item Collect</option>
                            <option value="enemyDefeat" ${npc.questType === "enemyDefeat" ? "selected" : ""}>Enemy Defeat</option>
                            <option value="statBuild" ${npc.questType === "statBuild" ? "selected" : ""}>Stat Build</option>
                            <option value="interactTiles" ${npc.questType === "interactTiles" ? "selected" : ""}>Interact Tiles</option>
                        </select>
                    </label>
                    <div id="quest-type-options" style="margin-top:8px;">
                        ${renderQuestTypeOptions(npc)}
                    </div>
                    <label>
                        Rewards:<br>
                        <div id="quest-rewards-list" style="margin-bottom:8px;"></div>
                        <button id="add-reward-btn" type="button" style="margin-top:4px;">Add Reward</button>
                    </label>
                    <label style="margin-top:8px;">
                        Quest Icon (optional -- shown in quest UI when there's no inventory icon to use):<br>
                        <input type="text" id="quest-icon" value="${npc.questIcon || ""}" style="width:100%;" placeholder="e.g. statue_01" />
                    </label>
                </div>
                ` : ""}
                <button id="confirm-npc-btn" style="margin-top:16px;">Confirm NPC</button>
                <h4>NPC Definition Preview</h4>
                <pre id="npc-def-preview" style="background:#181a20; color:#eaeaea; padding:12px; border-radius:6px; font-size:0.95em;"></pre>
                <div id="quest-def-preview-container" style="margin-top:12px;">
                    <h4>Quest Definition Preview</h4>
                    <pre id="quest-def-preview" style="background:#181a20; color:#eaeaea; padding:12px; border-radius:6px; font-size:0.95em;"></pre>
                </div>
            </div>
        `;
        attachCreatorListeners();
        updateCreatorPreview();
    } else if (tool === 'enemy') {
        const enemy = enemyCreatorState.enemy;
        optionsDiv.innerHTML = `
            <h3>Enemy Creator</h3>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:520px;">
                <label>
                    Name:<br>
                    <input type="text" id="enemy-name" value="${enemy.name}" placeholder="e.g. Displaced Shadow" style="width:100%;" />
                </label>
                <label>
                    Sprite Name:<br>
                    <input type="text" id="enemy-sprite-name" value="${enemy.spriteName || ""}" placeholder="e.g. displaced_shadow" style="width:100%;" />
                </label>
                <label>
                    Move Speed:<br>
                    <input type="number" id="enemy-moveSpeed" value="${enemy.moveSpeed}" step="0.1" min="0" style="width:80px;" />
                </label>
                <label>
                    Hostile Distance:<br>
                    <input type="number" id="enemy-distance" value="${enemy.distance}" step="0.1" min="0" style="width:80px;" />
                </label>
                <label>
                    Max Health:<br>
                    <input type="number" id="enemy-maxHealth" value="${enemy.maxHealth}" min="1" style="width:80px;" />
                </label>
                <label>
                    Attack:<br>
                    <input type="number" id="enemy-attack" value="${enemy.attack}" min="0" style="width:80px;" />
                </label>
                <label>
                    Defense:<br>
                    <input type="number" id="enemy-defense" value="${enemy.defense}" min="0" style="width:80px;" />
                </label>
                <label>
                    Attack Speed:<br>
                    <input type="number" id="enemy-speed" value="${enemy.speed}" step="0.1" min="0" style="width:80px;" />
                </label>
                <label>
                    XP Gain:<br>
                    <input type="number" id="enemy-xpGain" value="${enemy.xpGain}" min="0" style="width:80px;" />
                </label>
                <label>
                    Loot Drops:<br>
                    <div id="enemy-loot-list" style="margin-bottom:8px;"></div>
                    <button id="add-enemy-loot-btn" type="button" style="margin-top:4px;">Add Loot</button>
                </label>
                <label>
                    Map Number:<br>
                    <input type="number" id="enemy-map-number" min="0" max="99" value="${enemy.mapNumber ?? 0}" style="width:80px;" />
                </label>
                <button id="enemy-set-spawn-btn" style="margin-top:8px;">Add Spawn Location</button>
                <div id="enemy-spawn-preview" style="margin-top:8px;"></div>
                <button id="confirm-enemy-btn" style="margin-top:16px;">Confirm Enemy</button>
                <h4>Enemy Definition Preview</h4>
                <pre id="enemy-def-preview" style="background:#181a20; color:#eaeaea; padding:12px; border-radius:6px; font-size:0.95em;"></pre>
            </div>
        `;
        attachEnemyCreatorListeners();
        updateEnemyCreatorPreview();
    } else if (tool === 'trigger') {
        const t = triggerCreatorState.trigger;
        optionsDiv.innerHTML = `
            <h3>Trigger Tile Creator</h3>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:520px;">
                <label>ID:<br>
                    <input type="text" id="trigger-id" value="${t.id}" style="width:100%;" placeholder="e.g. echo_f3_1" />
                </label>
                <label>Map Number:<br>
                    <input type="number" id="trigger-map-number" min="0" max="99" value="${t.mapNumber}" style="width:80px;" />
                </label>
                <label>Type:<br>
                    <select id="trigger-type">
                        <option value="dialogue" ${t.type === "dialogue" ? "selected" : ""}>dialogue</option>
                        <option value="warp" ${t.type === "warp" ? "selected" : ""}>warp</option>
                        <option value="frameChange" ${t.type === "frameChange" ? "selected" : ""}>frameChange</option>
                    </select>
                </label>
                <div style="display:flex; gap:12px; align-items:center;">
                    <button id="trigger-set-location-btn" type="button">Set Trigger Tile</button>
                    <div id="trigger-location-preview" style="flex:1; color:#eaeaea;"></div>
                </div>
                <label>
                    <input type="checkbox" id="trigger-onetime" ${t.oneTime ? "checked" : ""} />
                    One Time (can't be triggered multiple times)
                </label>
                <fieldset style="border:none; padding:8px;">
                    <legend>Sound</legend>
                    <label style="display:flex; gap:8px; align-items:center;">
                        <input type="checkbox" id="trigger-sound-enabled" ${t.sound.enabled ? "checked" : ""} /> Enabled
                    </label>
                    <div id="trigger-sound-fields" style="display:${t.sound.enabled ? "block" : "none"};">
                        <label>File Name:<br>
                            <input type="text" id="trigger-sound-file" value="${t.sound.file}" style="width:100%;" placeholder="e.g. echo" />
                        </label>
                        <label>Type:<br>
                            <select id="trigger-sound-type">
                                <option value="ambient" ${t.sound.type === "ambient" ? "selected" : ""}>ambient</option>
                                <option value="loop" ${t.sound.type === "loop" ? "selected" : ""}>loop</option>
                                <option value="trigger" ${t.sound.type === "trigger" ? "selected" : ""}>trigger</option>
                            </select>
                        </label>
                    </div>
                </fieldset>
                <label>
                    Dialogue (one line per entry):<br>
                    <textarea id="trigger-dialogue" rows="3" style="width:100%;" placeholder="e.g. A Echo Flickers: 'Not all who climb return.'">${t.dialogue ? t.dialogue.join('\n') : ''}</textarea>
                </label>
                <label>
                    Rewards:<br>
                    <div id="trigger-rewards-list" style="margin-bottom:8px;"></div>
                    <button id="add-trigger-reward-btn" type="button" style="margin-top:4px;">Add Reward</button>
                </label>
                <button id="confirm-trigger-btn" style="margin-top:16px;">Confirm Trigger</button>
                <h4>Trigger Definition Preview</h4>
                <pre id="trigger-def-preview" style="background:#181a20; color:#eaeaea; padding:12px; border-radius:6px; font-size:0.95em;"></pre>
            </div>
        `;
        attachTriggerCreatorListeners();
        renderTriggerRewardsList();
        attachTriggerRewardListeners();
        updateTriggerCreatorPreview();
    } else if (tool === 'interact') {
        const t = interactCreatorState.tile;
        optionsDiv.innerHTML = `
            <h3>Interactable Tile Creator</h3>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:620px;">
                <label>ID:<br>
                    <input type="text" id="inter-id" value="${t.id}" style="width:100%;" placeholder="e.g. hidden_buff_1" />
                </label>
                <label>Map Number:<br>
                    <input type="number" id="inter-map-number" min="0" max="99" value="${t.mapNumber}" style="width:80px;" />
                </label>
                <div style="display:flex; gap:12px; align-items:center;">
                    <button id="inter-set-location-btn" type="button">Set Tile Location</button>
                    <div id="inter-location-preview" style="flex:1; color:#eaeaea;"></div>
                </div>

                <fieldset style="border:none; padding:8px;">
                    <legend>Visual</legend>
                    <label style="display:flex; gap:8px; align-items:center;">
                        <input type="checkbox" id="inter-use-sprite" ${t.useSprite ? "checked" : ""} />
                        Use Sprite Sheet (animated)
                    </label>
                    <div id="inter-static-fields" style="display:${t.useSprite ? "none" : "block"};">
                        <label>Image Path:<br>
                            <input type="text" id="inter-image" value="${t.image}" style="width:100%;" placeholder="e.g. assets/img/tile/rock-3.png" />
                        </label>
                    </div>
                    <div id="inter-sprite-fields" style="display:${t.useSprite ? "block" : "none"};">
                        <label>Sprite Sheet Path:<br>
                            <input type="text" id="inter-spriteSheet" value="${t.spriteSheet}" style="width:100%;" placeholder="e.g. assets/img/worldSprites/statue_01.png" />
                        </label>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <label>Image W:<br><input type="number" id="inter-imageW" value="${t.imageW}" min="0" style="width:80px;"></label>
                            <label>Image H:<br><input type="number" id="inter-imageH" value="${t.imageH}" min="0" style="width:80px;"></label>
                            <label>Rows:<br><input type="number" id="inter-rows" value="${t.rows}" min="1" style="width:80px;"></label>
                            <label>Cols:<br><input type="number" id="inter-cols" value="${t.cols}" min="1" style="width:80px;"></label>
                            <label>Anim Speed:<br><input type="number" id="inter-animSpeed" value="${t.animSpeed}" min="1" style="width:80px;"></label>
                        </div>
                        <label style="display:flex; gap:8px; align-items:center;">
                            <input type="checkbox" id="inter-animOnTrigger" ${t.animOnTrigger ? "checked" : ""} />
                            Animate on trigger only
                        </label>
                    </div>
                </fieldset>

                <fieldset style="border:none; padding:8px;">
                    <legend>Gameplay</legend>
                    <label style="display:flex; gap:8px; align-items:center;">
                        <input type="checkbox" id="inter-collision" ${t.collision ? "checked" : ""} /> Collision
                    </label>
                    <label>Z-Index:<br>
                        <select id="inter-zIndex" style="width:100px;">
                            <option value="0" ${t.zIndex === 0 ? "selected" : ""}>0 (below player)</option>
                            <option value="1" ${t.zIndex === 1 ? "selected" : ""}>1 (above player)</option>
                        </select>
                    </label>
                    <br><label>Notification Text:<br>
                        <input type="text" id="inter-notification" value="${t.notification}" style="width:100%;" placeholder="e.g. Press A to examine this Humming Rock." />
                    </label>
                </fieldset>

                <fieldset style="border:none; padding:8px;">
                    <legend>Sound</legend>
                    <label style="display:flex; gap:8px; align-items:center;">
                        <input type="checkbox" id="inter-sound-enabled" ${t.sound.enabled ? "checked" : ""} /> Enabled
                    </label>
                    <div id="inter-sound-fields" style="display:${t.sound.enabled ? "block" : "none"};">
                        <label>File Name (base):<br>
                            <input type="text" id="inter-sound-file" value="${t.sound.file}" style="width:100%;" placeholder="e.g. glitching_statue" />
                        </label>
                        <label>Type:<br>
                            <select id="inter-sound-type" style="width:160px;">
                                <option value="ambient" ${t.sound.type === "ambient" ? "selected" : ""}>ambient</option>
                                <option value="loop" ${t.sound.type === "loop" ? "selected" : ""}>loop</option>
                                <option value="trigger" ${t.sound.type === "trigger" ? "selected" : ""}>trigger</option>
                            </select>
                        </label>
                    </div>
                </fieldset>

                <label>
                    Dialogue (one line per entry):<br>
                    <textarea id="inter-dialogue" rows="3" style="width:100%;" placeholder="e.g. You feel a strange energy coming from this rock.">${t.dialogue ? t.dialogue.join('\n') : ''}</textarea>
                </label>

                <label>
                    Rewards:<br>
                    <div id="inter-rewards-list" style="margin-bottom:8px;"></div>
                    <button id="add-inter-reward-btn" type="button" style="margin-top:4px;">Add Reward</button>
                </label>

                <button id="confirm-interact-btn" style="margin-top:16px;">Confirm Interactable Tile</button>
                <h4>Interactable Tile Definition Preview</h4>
                <pre id="inter-def-preview" style="background:#181a20; color:#eaeaea; padding:12px; border-radius:6px; font-size:0.95em;"></pre>
            </div>
        `;
        attachInteractCreatorListeners();
        renderInteractRewardsList();
        attachInteractRewardListeners();
        updateInteractCreatorPreview();
    } else if (tool === 'sprite') {
        const s = worldSpriteCreatorState.sprite;
        optionsDiv.innerHTML = `
            <h3>World Sprite Creator</h3>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:620px;">
                <label>ID:<br>
                    <input type="text" id="ws-id" value="${s.id}" style="width:100%;" placeholder="e.g. deer_statue" />
                </label>
                <label>Image Name (base, assumes assets/img/worldSprites/.png):<br>
                    <input type="text" id="ws-image-name" value="${s.imageName}" style="width:100%;" placeholder="e.g. deer_statue" />
                </label>

                <fieldset style="border:none; padding:8px;">
                    <legend>Sprite Sheet Data</legend>
                    <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <label>Image W:<br><input type="number" id="ws-imageW" value="${s.imageW}" min="0" style="width:90px;"></label>
                        <label>Image H:<br><input type="number" id="ws-imageH" value="${s.imageH}" min="0" style="width:90px;"></label>
                        <label>Rows:<br><input type="number" id="ws-rows" value="${s.rows}" min="1" style="width:90px;"></label>
                        <label>Cols:<br><input type="number" id="ws-cols" value="${s.cols}" min="1" style="width:90px;"></label>
                        <label>Row (optional):<br><input type="number" id="ws-row" value="${s.row}" min="0" style="width:90px;"></label>
                        <label>Anim Speed:<br><input type="number" id="ws-animSpeed" value="${s.animSpeed}" min="0" style="width:90px;"></label>
                        <label>Z-Index:<br>
                            <select id="ws-zIndex" style="width:110px;">
                                <option value="0" ${s.zIndex === 0 ? "selected" : ""}>0 (below player)</option>
                                <option value="1" ${s.zIndex === 1 ? "selected" : ""}>1 (above player)</option>
                            </select>
                        </label>
                    </div>
                    <label style="display:flex; gap:8px; align-items:center; margin-top:6px;">
                        <input type="checkbox" id="ws-collision" ${s.collision ? "checked" : ""} />
                        Collision
                    </label>
                </fieldset>

                <fieldset style="border:none; padding:8px;">
                    <legend>Positions</legend>
                    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                        <label>Map:<br>
                            <input type="text" id="ws-position-map" value="${s.positionMap}" style="width:140px;" placeholder='e.g. 1 or "title0"' />
                        </label>
                        <button id="ws-add-position-btn" type="button">Add Position</button>
                        <div id="ws-position-prompt" style="color:#eaeaea;"></div>
                    </div>
                    <div id="ws-positions-list" style="margin-top:8px;"></div>
                </fieldset>

                <button id="ws-confirm-btn" style="margin-top:16px;">Confirm World Sprite</button>
                <h4>World Sprite Definition Preview</h4>
                <pre id="ws-def-preview" style="background:#181a20; color:#eaeaea; padding:12px; border-radius:6px; font-size:0.95em;"></pre>
            </div>
        `;
        attachWorldSpriteCreatorListeners();
        renderWorldSpritePositionsList();
        updateWorldSpritePreview();
    } else if (tool === 'item') {
        const it = itemCreatorState.item;
        // Defensive backfill: items saved/autosaved before homePlaceable/homeDef
        // existed (or even before `sound` existed) would otherwise crash here.
        if (!it.sound) it.sound = { enabled: false, file: "" };
        if (typeof it.homePlaceable !== 'boolean') it.homePlaceable = false;
        if (!it.homeDef) {
            it.homeDef = {
                spriteSheetOverride: "", imageW: 64, imageH: 64, rows: 1, cols: 1,
                animSpeed: 0, zIndex: 0, collision: true, canStackOnPlaced: false,
                footprintW: 1, footprintH: 1
            };
        }
        optionsDiv.innerHTML = `
            <h3>Item Creator</h3>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:620px;">
                <label>Name:<br>
                    <input type="text" id="item-name" value="${it.name}" style="width:100%;" placeholder="e.g. Health Buff - Small" />
                </label>
                <div style="color:#9aa4b2; font-size:12px;">ID will be generated: lowercased, spaces and ' - ' to '_'</div>
                <label>Description:<br>
                    <textarea id="item-description" rows="2" style="width:100%;" placeholder="Describe the item">${it.description}</textarea>
                </label>
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <label>Rarity:<br>
                        <select id="item-rarity" style="width:140px;">
                            ${["common","rare","epic","legendary"].map(r => `<option value="${r}" ${it.rarity===r?"selected":""}>${r}</option>`).join("")}
                        </select>
                    </label>
                    <label style="display:flex; gap:8px; align-items:center; margin-top:20px;">
                        <input type="checkbox" id="item-stackable" ${it.stackable?"checked":""}/> Stackable
                    </label>
                    <label style="display:flex; gap:8px; align-items:center; margin-top:20px;">
                        <input type="checkbox" id="item-useable" ${it.useable?"checked":""}/> Useable
                    </label>
                    <label style="display:flex; gap:8px; align-items:center; margin-top:20px;">
                        <input type="checkbox" id="item-removeable" ${it.removeable?"checked":""}/> Removeable
                    </label>
                </div>
                <fieldset style="border:none; padding:8px;">
                    <legend>Media</legend>
                    <label>Image Name (base, assumes assets/img/items/.png):<br>
                        <input type="text" id="item-image-name" value="${it.imageName}" style="width:100%;" placeholder="leave blank to use id" />
                    </label>
                    <div style="display:flex; gap:12px; align-items:center;">
                        <label style="display:flex; gap:8px; align-items:center;">
                            <input type="checkbox" id="item-sound-enabled" ${it.sound.enabled?"checked":""}/> Sound on use
                        </label>
                        <label>File Name (base):<br>
                            <input type="text" id="item-sound-file" value="${it.sound.file}" style="width:200px;" placeholder="e.g. health" />
                        </label>
                    </div>
                </fieldset>
                <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px;">
                    <legend>Home Plot</legend>
                    <label style="display:flex; gap:8px; align-items:center;">
                        <input type="checkbox" id="item-home-placeable" ${it.homePlaceable?"checked":""}/> Home Placeable
                    </label>
                    <div id="item-homedef-fields" style="display:${it.homePlaceable ? 'flex' : 'none'}; flex-direction:column; gap:8px; margin-top:8px;">
                        <label>Home Sprite Sheet Override (full path, leave blank to reuse this item's Image above):<br>
                            <input type="text" id="item-home-sprite" value="${it.homeDef.spriteSheetOverride}" style="width:100%;" placeholder="e.g. assets/img/tile/chair_1.png" />
                        </label>
                        <div style="display:flex; gap:12px; flex-wrap:wrap;">
                            <label>Image W:<br><input type="number" id="item-home-w" value="${it.homeDef.imageW}" min="1" style="width:80px;"></label>
                            <label>Image H:<br><input type="number" id="item-home-h" value="${it.homeDef.imageH}" min="1" style="width:80px;"></label>
                            <label>Rows:<br><input type="number" id="item-home-rows" value="${it.homeDef.rows}" min="1" style="width:70px;"></label>
                            <label>Cols:<br><input type="number" id="item-home-cols" value="${it.homeDef.cols}" min="1" style="width:70px;"></label>
                            <label>Anim Speed:<br><input type="number" id="item-home-animspeed" value="${it.homeDef.animSpeed}" min="0" style="width:80px;"></label>
                            <label>Z-Index:<br><input type="number" id="item-home-zindex" value="${it.homeDef.zIndex}" style="width:70px;"></label>
                            <label>Footprint W:<br><input type="number" id="item-home-footprint-w" value="${it.homeDef.footprintW}" min="1" style="width:80px;"></label>
                            <label>Footprint H:<br><input type="number" id="item-home-footprint-h" value="${it.homeDef.footprintH}" min="1" style="width:80px;"></label>
                        </div>
                        <div style="display:flex; gap:16px;">
                            <label style="display:flex; gap:8px; align-items:center;">
                                <input type="checkbox" id="item-home-collision" ${it.homeDef.collision?"checked":""}/> Collision
                            </label>
                            <label style="display:flex; gap:8px; align-items:center;">
                                <input type="checkbox" id="item-home-stack" ${it.homeDef.canStackOnPlaced?"checked":""}/> Can Stack On Placed
                            </label>
                        </div>
                    </div>
                </fieldset>
                <button id="confirm-item-btn" style="margin-top:16px;">Confirm Item</button>
                <h4>Item Definition Preview</h4>
                <pre id="item-def-preview" style="background:#181a20; color:#eaeaea; padding:12px; border-radius:6px; font-size:0.95em;"></pre>
            </div>
        `;
        attachItemCreatorListeners();
        updateItemPreview();
    } else if (tool === 'skill') {
        const s = skillCreatorState.skill;
        optionsDiv.innerHTML = `
            <h3>Skill Creator</h3>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:720px;">
                <label>Name:<br>
                    <input type="text" id="skill-name" value="${s.name}" style="width:100%;" placeholder="e.g. Verdant Focus" />
                </label>
                <div style="color:#9aa4b2; font-size:12px;">ID will be generated: lowercased, spaces and ' - ' to '_'</div>
                <label>Description:<br>
                    <textarea id="skill-description" rows="2" style="width:100%;">${s.description}</textarea>
                </label>
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <label>Pool:<br>
                        <select id="skill-pool" style="width:120px;">
                            ${["blue","red","pink","all"].map(p => `<option value="${p}" ${s.pool===p?"selected":""}>${p}</option>`).join("")}
                        </select>
                    </label>
                    <label>Chance:<br>
                        <input type="number" id="skill-chance" value="${s.chance}" step="0.1" min="0" style="width:100px;" />
                    </label>
                    <label>Max Level:<br>
                        <input type="number" id="skill-maxLevel" value="${s.maxLevel}" min="1" style="width:100px;" />
                    </label>
                    <label>Rarity:<br>
                        <select id="skill-rarity" style="width:140px;">
                            ${["common","rare","epic","legendary"].map(r => `<option value="${r}" ${s.rarity===r?"selected":""}>${r}</option>`).join("")}
                        </select>
                    </label>
                </div>
                <label>Image Name (base, assumes assets/img/skills/.png):<br>
                    <input type="text" id="skill-image-name" value="${s.imageName}" style="width:100%;" placeholder="leave blank to use id" />
                </label>
                <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px;">
                    <legend>Buffs</legend>
                    <div id="skill-buffs-list" style="margin-bottom:8px;"></div>
                    <button id="add-skill-buff-btn" type="button">Add Buff</button>
                </fieldset>
                <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px;">
                    <legend>Drawbacks</legend>
                    <div id="skill-drawbacks-list" style="margin-bottom:8px;"></div>
                    <button id="add-skill-drawback-btn" type="button">Add Drawback</button>
                </fieldset>
                <button id="confirm-skill-btn" style="margin-top:16px;">Confirm Skill</button>
                <h4>Skill Definition Preview</h4>
                <pre id="skill-def-preview" style="background:#181a20; color:#eaeaea; padding:12px; border-radius:6px; font-size:0.95em;"></pre>
            </div>
        `;
        renderSkillStatsList('buffs');
        renderSkillStatsList('drawbacks');
        attachSkillCreatorListeners();
        updateSkillPreview();
    } else if (tool === 'trader') {
        const t = traderCreatorState.trader;
        optionsDiv.innerHTML = `
            <h3>Trader Creator</h3>
            <div style="display:flex; flex-direction:column; gap:12px; max-width:620px;">
                <label>Trader ID:<br>
                    <input type="text" id="trader-id" value="${t.id}" style="width:200px;" placeholder="e.g. trader11" />
                </label>
                <div style="color:#9aa4b2; font-size:12px;">Unique ID, referenced by an NPC's "trader" field.</div>
                <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px;">
                    <legend>Sells To Player (buy)</legend>
                    <div id="trader-buy-list" style="margin-bottom:8px;"></div>
                    <button id="add-trader-buy-btn" type="button">Add Item</button>
                </fieldset>
                <fieldset style="border:1px solid #35374a; border-radius:6px; padding:8px;">
                    <legend>Buys From Player (sell)</legend>
                    <div id="trader-sell-list" style="margin-bottom:8px;"></div>
                    <button id="add-trader-sell-btn" type="button">Add Item</button>
                </fieldset>
                <button id="confirm-trader-btn" style="margin-top:16px;">Confirm Trader</button>
                <h4>Trader Definition Preview</h4>
                <pre id="trader-def-preview" style="background:#181a20; color:#eaeaea; padding:12px; border-radius:6px; font-size:0.95em;"></pre>
            </div>
        `;
        renderTraderList('buy');
        renderTraderList('sell');
        attachTraderCreatorListeners();
        updateTraderPreview();
    } else if (tool === 'check') {
        optionsDiv.innerHTML = `
            <h3>Consistency Check</h3>
            <div style="color:#9aa4b2; font-size:12px; margin-bottom:12px;">
                Scans everything saved this session for dangling references (IDs that
                don't exist), duplicate IDs that would silently overwrite each other on
                export, and obviously incomplete entries. This only checks cross-references
                between saved entities -- it can't verify that image/sound files actually
                exist on disk.
            </div>
            <button id="run-check-btn" type="button">Re-run Check</button>
            <div id="check-results" style="margin-top:16px;"></div>
        `;
        document.getElementById('run-check-btn').onclick = renderCheckResults;
        renderCheckResults();
    } else {
        optionsDiv.innerHTML = `<h3>${tool.charAt(0).toUpperCase() + tool.slice(1)} Tool</h3>
            <div>Tool options and inputs will appear here.</div>`;
    }
}

// Quest Type Options Renderer 
function renderQuestTypeOptions(npc) {
    switch (npc.questType) {
        case "itemCollect": {
            const itemOptions = getKnownItemOptions();
            const currentId = npc.questTypeOptions.itemId || "";
            const isKnown = itemOptions.some(([id]) => id === currentId);
            return `<label>Item:<br>
                <select id="quest-item-id" style="width:100%;">
                    <option value="">-- select item --</option>
                    ${itemOptions.map(([id, name]) => `<option value="${id}" ${currentId === id ? "selected" : ""}>${id}${name && name !== id ? " — " + name : ""}</option>`).join("")}
                    ${currentId && !isKnown ? `<option value="${currentId}" selected>${currentId} (not in catalog)</option>` : ""}
                </select></label>
                <label>Required Amount:<br>
                <input type="number" id="quest-item-amount" min="1" value="${npc.questTypeOptions.requiredAmount || 1}" style="width:80px;" /></label>`;
        }
        case "gift":
            return `<div style="color:#9aa4b2; font-size:11px;">Gifts hand over an item without requiring anything back -- just set the reward below.</div>`;
        case "enemyDefeat": {
            const enemyOptions = getKnownEnemyOptions();
            const currentId = npc.questTypeOptions.enemyId || "";
            const isKnown = enemyOptions.some(([id]) => id === currentId);
            return `<label>Enemy:<br>
                <select id="quest-enemy-id" style="width:100%;">
                    <option value="">-- select enemy --</option>
                    ${enemyOptions.map(([id, name]) => `<option value="${id}" ${currentId === id ? "selected" : ""}>${id}${name && name !== id ? " — " + name : ""}</option>`).join("")}
                    ${currentId && !isKnown ? `<option value="${currentId}" selected>${currentId} (not in catalog)</option>` : ""}
                </select></label>
                <label>Required Amount:<br>
                <input type="number" id="quest-enemy-amount" min="1" value="${npc.questTypeOptions.requiredAmount || 1}" style="width:80px;" /></label>`;
        }
        case "statBuild":
            return `<label>Stat Key:<br>
                <input type="text" id="quest-stat-key" value="${npc.questTypeOptions.stat || ""}" style="width:100%;" placeholder="e.g. maxHealth" /></label>
                <label>Required Amount:<br>
                <input type="number" id="quest-stat-amount" min="1" value="${npc.questTypeOptions.requiredAmount || 1}" style="width:80px;" /></label>`;
        case "interactTiles": {
            const knownTiles = getKnownInteractTileIds();
            const selected = new Set(Array.isArray(npc.questTypeOptions.interactTileIds) ? npc.questTypeOptions.interactTileIds : []);
            return `<label>Interact Tiles:</label>
                <div id="quest-interact-tile-checks" style="max-height:140px; overflow-y:auto; background:#181a20; border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:4px;">
                    ${knownTiles.length ? knownTiles.map(id => `
                        <label style="display:flex; gap:8px; align-items:center; font-weight:normal;">
                            <input type="checkbox" class="quest-interact-tile-check" value="${id}" ${selected.has(id) ? "checked" : ""}/> ${id}
                        </label>`).join("") : `<div style="color:#9aa4b2; font-size:12px;">No interactable tiles saved yet -- create some in the Interactable Tile Creator first.</div>`}
                </div>
                <label>Required Amount:<br>
                <input type="number" id="quest-interact-amount" min="1" value="${npc.questTypeOptions.requiredAmount || 1}" style="width:80px;" /></label>`;
        }
        default:
            return "";
    }
}


// Attach Listeners
function attachCreatorListeners() {
    const npc = creatorState.npc;
    // NPC fields
    document.getElementById('npc-name').oninput = e => { npc.name = e.target.value; updateCreatorPreview(); };
    document.getElementById('npc-sprite-gender').onchange = e => { npc.spriteGender = e.target.value; updateCreatorPreview(); };
    document.getElementById('npc-sprite-number').onchange = e => { npc.spriteNumber = e.target.value; updateCreatorPreview(); };
    document.getElementById('npc-map-number').oninput = e => { npc.mapNumber = e.target.value; updateCreatorPreview(); };
    document.getElementById('npc-dialogue-default').oninput = e => { npc.dialogueDefault = e.target.value; updateCreatorPreview(); };
    document.getElementById('npc-has-quest').onchange = e => { npc.hasQuest = e.target.checked; showToolOptions("npc"); };

    // Wander/spawn logic
    document.getElementById('npc-set-wander-btn').onclick = function() {
        wanderSelectionStep = 1;
        wanderFirstCorner = null;
        updateWanderPrompt();
    };

    // Forced Encounter -- independent of quest state
    document.getElementById('npc-forced-enabled').onchange = e => {
        npc.forcedEncounter.enabled = e.target.checked;
        if (!npc.forcedEncounter.enabled) forcedEncounterPicking = false;
        showToolOptions("npc");
        updateCreatorPreview();
    };
    if (npc.forcedEncounter.enabled) {
        document.getElementById('npc-set-trigger-tiles-btn').onclick = () => {
            forcedEncounterPicking = !forcedEncounterPicking;
            showToolOptions("npc");
        };
        document.getElementById('npc-clear-trigger-tiles-btn').onclick = () => {
            npc.forcedEncounter.triggerTiles = [];
            updateForcedEncounterPrompt();
            updateCreatorPreview();
            if (typeof drawMap === "function") drawMap();
        };
    }

    // Quest fields 
    if (npc.hasQuest) {
        document.getElementById('quest-id').oninput = e => { npc.questId = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-name').oninput = e => {
            npc.questName = e.target.value;
            npc.questId = normalizeIdFromName(npc.questName);           // auto from name
            const qidEl = document.getElementById('quest-id');          // reflect in the box
            if (qidEl) qidEl.value = npc.questId;
            updateCreatorPreview();
        };
        document.getElementById('quest-description').oninput = e => { npc.questDescription = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-redoable').onchange = e => { npc.questRedoable = e.target.checked; updateCreatorPreview(); };
        document.getElementById('quest-given-dialogue').oninput = e => { npc.questGiven = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-incomplete-dialogue').oninput = e => { npc.questIncomplete = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-complete-dialogue').oninput = e => { npc.questComplete = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-type').onchange = e => { npc.questType = e.target.value; showToolOptions("npc"); };
        document.getElementById('quest-icon').oninput = e => { npc.questIcon = e.target.value.trim(); updateCreatorPreview(); };

        renderRewardsList();
        attachRewardListeners();

        // Quest type options
        switch (npc.questType) {
            case "itemCollect":
                document.getElementById('quest-item-id').onchange = e => { npc.questTypeOptions.itemId = e.target.value; updateCreatorPreview(); };
                document.getElementById('quest-item-amount').oninput = e => { npc.questTypeOptions.requiredAmount = e.target.value; updateCreatorPreview(); };
                break;
            case "gift":
                break;
            case "enemyDefeat":
                document.getElementById('quest-enemy-id').onchange = e => { npc.questTypeOptions.enemyId = e.target.value; updateCreatorPreview(); };
                document.getElementById('quest-enemy-amount').oninput = e => { npc.questTypeOptions.requiredAmount = e.target.value; updateCreatorPreview(); };
                break;
            case "statBuild":
                document.getElementById('quest-stat-key').oninput = e => { npc.questTypeOptions.stat = e.target.value; updateCreatorPreview(); };
                document.getElementById('quest-stat-amount').oninput = e => { npc.questTypeOptions.requiredAmount = e.target.value; updateCreatorPreview(); };
                break;
            case "interactTiles":
                document.querySelectorAll('.quest-interact-tile-check').forEach(cb => {
                    cb.onchange = () => {
                        npc.questTypeOptions.interactTileIds = Array.from(document.querySelectorAll('.quest-interact-tile-check:checked')).map(c => c.value);
                        updateCreatorPreview();
                    };
                });
                document.getElementById('quest-interact-amount').oninput = e => { npc.questTypeOptions.requiredAmount = e.target.value; updateCreatorPreview(); };
                break;
        }
    }
    document.getElementById('confirm-npc-btn').onclick = () => {
        const npcCopy = JSON.parse(JSON.stringify(creatorState.npc));
        savedNpcs.push(npcCopy);
        renderSavedNpcs();
        renderNpcDownloadButtons();
        clearNpcInputs();
        updateCreatorPreview();
        updateWanderPrompt();
    };
}

function clearNpcInputs() {
    creatorState.npc = {
        name: "",
        spriteGender: "m",
        spriteNumber: "1",
        mapNumber: 0,
        dialogueDefault: "",
        hasQuest: false,
        wanderArea: null,
        spawn: null,
        questId: "",
        questName: "",
        questDescription: "",
        questRedoable: false,
        forcedEncounter: { enabled: false, triggerTiles: [], triggered: false },
        questGiven: "",
        questIncomplete: "",
        questComplete: "",
        questType: "gift",
        questTypeOptions: {},
        questRewards: "",
        questIcon: ""
    };
    showToolOptions("npc");
}

function renderSavedNpcs() {
    renderSavedList({
        listElId: 'saved-npcs-list',
        getItems: () => savedNpcs,
        rowClass: 'saved-npc-row',
        editBtnClass: 'edit-npc-btn',
        deleteBtnClass: 'delete-npc-btn',
        emptyMessage: 'No NPCs saved yet.',
        label: npc => npc.name || "(Unnamed NPC)",
        toolKey: 'npc',
        setDraft: item => { creatorState.npc = item; },
        onEdit: () => {
            updateCreatorPreview();
            updateWanderPrompt();
            renderNpcDownloadButtons();
        },
        onDelete: () => {
            renderNpcDownloadButtons();
            if (typeof drawMap === "function") drawMap();
        }
    });
}

function renderRewardsList() {
    const npc = creatorState.npc;
    let rewards = [];
    try {
        rewards = JSON.parse(npc.questRewards || "[]");
    } catch (e) {
        rewards = [];
    }
    const listDiv = document.getElementById('quest-rewards-list');
    if (!listDiv) return;
    const statKeys = ["xp", "attack", "defence", "maxHealth", "attackSpeed"];
    const knownItemIds = getKnownItemOptions().map(([id]) => id);
    const datalistOptions = [...statKeys, ...knownItemIds].map(v => `<option value="${v}">`).join("");
    listDiv.innerHTML = rewards.map((r, i) => `
        <div class="reward-row" data-idx="${i}" style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
            <input type="text" class="reward-name" list="quest-reward-datalist" value="${r.id || Object.keys(r)[0] || ''}" placeholder="Reward name (id/xp/attack...)" style="width:160px;">
            <input type="number" class="reward-amount" value="${r.amount || r[Object.keys(r)[0]] || 1}" min="1" style="width:60px;">
            <button type="button" class="remove-reward-btn">Remove</button>
        </div>
    `).join("") + `<datalist id="quest-reward-datalist">${datalistOptions}</datalist>`;
}

function attachRewardListeners() {
    const list = document.getElementById('quest-rewards-list');
    if (!list) return;
    list.querySelectorAll('.reward-name, .reward-amount').forEach(input => {
        input.oninput = () => {
            const rewards = [];
            list.querySelectorAll('.reward-row').forEach(row => {
                const name = row.querySelector('.reward-name').value.trim();
                const amount = Number(row.querySelector('.reward-amount').value) || 1;
                if (name) {
                    if (["xp", "attack", "defence", "maxHealth", "attackSpeed"].includes(name)) {
                        rewards.push({ [name]: amount });
                    } else {
                        rewards.push({ id: name, amount });
                    }
                }
            });
            creatorState.npc.questRewards = JSON.stringify(rewards);
            updateCreatorPreview();
        };
    });
    list.querySelectorAll('.remove-reward-btn').forEach(btn => {
        btn.onclick = () => {
            btn.parentElement.remove();
            // Trigger input event to update preview
            list.querySelector('.reward-name')?.dispatchEvent(new Event('input'));
        };
    });
    const addBtn = document.getElementById('add-reward-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            const newRow = document.createElement('div');
            newRow.className = 'reward-row';
            newRow.style = "display:flex; gap:8px; align-items:center; margin-bottom:4px;";
            newRow.innerHTML = `
                <input type="text" class="reward-name" list="quest-reward-datalist" placeholder="Reward name (id/xp/attack...)" style="width:160px;">
                <input type="number" class="reward-amount" value="1" min="1" style="width:60px;">
                <button type="button" class="remove-reward-btn">Remove</button>
            `;
            list.appendChild(newRow);
            attachRewardListeners();
        };
    }
}

// Preview Renderer 
function updateCreatorPreview() {
    const npc = creatorState.npc;

    // Format wanderArea for preview 
    let wanderAreaPreview = undefined;
    if (npc.wanderArea && typeof npc.wanderArea.x1 === "number") {
        wanderAreaPreview = {
            x1: npc.wanderArea.x1,
            y1: npc.wanderArea.y1,
            x2: npc.wanderArea.x2,
            y2: npc.wanderArea.y2
        };
    }

    // Format spawns array for preview 
    let spawnsPreview = "";
    if (npc.spawn && wanderAreaPreview) {
        const mapVal = isNaN(npc.mapNumber) ? `"${npc.mapNumber}"` : npc.mapNumber;
        spawnsPreview = `[ { map: ${mapVal}, x: ${npc.spawn.x}, y: ${npc.spawn.y}, wanderArea: { x1: ${wanderAreaPreview.x1}, y1: ${wanderAreaPreview.y1}, x2: ${wanderAreaPreview.x2}, y2: ${wanderAreaPreview.y2} } } ]`;
    } else {
        spawnsPreview = "[]";
    }

    // Dialogue sections
    function formatDialogueSection(key, arr) {
        if (!arr || !arr.length) return "";
        return `\n    ${key}: [\n${arr.map(line => `      "${line}"`).join(",\n")}\n    ]`;
    }
    const dialogueDefault = npc.dialogueDefault.split('\n').filter(l => l.trim());
    const dialogueQuestGiven = npc.questGiven.split('\n').filter(l => l.trim());
    const dialogueQuestIncomplete = npc.questIncomplete.split('\n').filter(l => l.trim());
    const dialogueQuestComplete = npc.questComplete.split('\n').filter(l => l.trim());

    let dialoguePreview = `default: [\n${dialogueDefault.map(line => `      "${line}"`).join(",\n")}\n    ]`;
    if (dialogueQuestGiven.length) dialoguePreview += formatDialogueSection("questGiven", dialogueQuestGiven);
    if (dialogueQuestIncomplete.length) dialoguePreview += formatDialogueSection("questIncomplete", dialogueQuestIncomplete);
    if (dialogueQuestComplete.length) dialoguePreview += formatDialogueSection("questComplete", dialogueQuestComplete);

    // Forced Encounter
    let forcedEncounterPreview = "";
    if (npc.forcedEncounter && npc.forcedEncounter.enabled) {
        const triggers = npc.forcedEncounter.triggerTiles.map(t => `      { x: ${t.x}, y: ${t.y} }`).join(",\n");
        forcedEncounterPreview = `
  forcedEncounter: {
    enabled: true,
    triggerTiles: [
${triggers}
    ],
    triggered: false
  },`;
    }

    // NPC definition preview 
    let preview =
`{
  id: "${npc.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}",
  name: "${npc.name}",
  sprite: "assets/img/npc/npc_${npc.spriteGender}_${npc.spriteNumber}.png",
  interactive: true,
  spawns: ${spawnsPreview},
  dialogue: {
    ${dialoguePreview}
  }${npc.hasQuest ? `,
  questId: "${npc.questId || npc.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}",
  questRedo: ${!!npc.questRedoable}` : ""}
${forcedEncounterPreview ? forcedEncounterPreview : ""}
}`;

    document.getElementById('npc-def-preview').textContent = preview;

    // Quest Definition Preview
    if (npc.hasQuest) {
        let questTypeObj = {};
        switch (npc.questType) {
            case "itemCollect": {
                const id = (npc.questTypeOptions.itemId || "").trim();
                const amt = Number(npc.questTypeOptions.requiredAmount) || 1;
                questTypeObj.requiredItems = id ? [{ id, amount: amt }] : [];
                break;
            }
            case "gift": {
                questTypeObj.requiredItems = []; // real quests.js always includes this empty array for gift quests
                break;
            }
            case "enemyDefeat":
                questTypeObj.enemyId = npc.questTypeOptions.enemyId || "";
                questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
                break;
            case "statBuild":
                questTypeObj.stat = npc.questTypeOptions.stat || "";
                questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
                break;
            case "interactTiles": {
                const rawIds = npc.questTypeOptions.interactTileIds;
                questTypeObj.interactTileIds = Array.isArray(rawIds) ? rawIds : (rawIds || "").split(',').map(s => s.trim()).filter(Boolean);
                questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
                break;
            }
        }
        let rewards = [];
        try {
            rewards = JSON.parse(npc.questRewards || "[]");
        } catch (e) {
            rewards = [];
        }

        // Manual formatting for quest definition
        let questPreview =
`{
  id: "${npc.questId || npc.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}",
  name: "${npc.questName || npc.name}",
  description: "${npc.questDescription || ""}",
  type: "${npc.questType}",${
    questTypeObj.requiredItems ? `\n  requiredItems: [${questTypeObj.requiredItems.map(i => ` { id: "${i.id}", amount: ${i.amount} }`).join(",")} ],` : ""
  }${
    questTypeObj.enemyId ? `\n  enemyId: "${questTypeObj.enemyId}",` : ""
  }${
    questTypeObj.requiredAmount ? `\n  requiredAmount: ${questTypeObj.requiredAmount},` : ""
  }${
    questTypeObj.stat ? `\n  stat: "${questTypeObj.stat}",` : ""
  }${
    questTypeObj.interactTileIds ? `\n  interactTileIds: [${questTypeObj.interactTileIds.map(id => `"${id}"`).join(", ")}],` : ""
  }
  rewards: [${rewards.map(r => {
    if (r.id) return `{ id: "${r.id}", amount: ${r.amount || 1} }`;
    let keys = Object.keys(r).filter(k => k !== "id" && k !== "amount");
    return keys.map(k => `{ ${k}: ${r[k]} }`).join(", ");
  }).join(", ")}],${
    npc.questIcon ? `\n  icon: "${npc.questIcon}",` : ""
  }
  redoable: ${!!npc.questRedoable}
}`;

        document.getElementById('quest-def-preview').textContent = questPreview;
    } else {
        document.getElementById('quest-def-preview').textContent = "";
    }
}

function updateWanderPrompt() {
    const previewDiv = document.getElementById('npc-wander-preview');
    if (!previewDiv) return;
    switch (wanderSelectionStep) {
        case 1:
            previewDiv.textContent = "Step 1: Click the TOP-LEFT tile for the wander area.";
            break;
        case 2:
            previewDiv.textContent = "Step 2: Click the BOTTOM-RIGHT tile for the wander area.";
            break;
        case 3:
            previewDiv.textContent = "Step 3: Click a tile INSIDE the wander area for the spawn location.";
            break;
        default:
            if (creatorState.npc.wanderArea && creatorState.npc.spawn)
                previewDiv.textContent = "Wander area and spawn set!";
            else
                previewDiv.textContent = "";
    }
}

function updateForcedEncounterPrompt() {
    const previewDiv = document.getElementById('npc-forced-preview');
    if (!previewDiv) return;
    const count = creatorState.npc.forcedEncounter.triggerTiles.length;
    previewDiv.textContent = forcedEncounterPicking
        ? `${count} tile(s) selected. Click tiles on the map to add/remove them.`
        : `${count} tile(s) selected.`;
}

// Map Engine for Preview Map 
function showCreatorMap(mapData, loadedAssets = {}) {
    currentMapData = mapData;
    creatorMapAssets = loadedAssets;
    creatorMapImages = {};

    // Preload images
    const assetKeys = Object.keys(creatorMapAssets);
    let imagesToLoad = assetKeys.length;
    if (imagesToLoad === 0) {
        drawMap();
    } else {
        assetKeys.forEach(key => {
            const img = new Image();
            img.onload = function() {
                creatorMapImages[key] = img;
                imagesToLoad--;
                if (imagesToLoad === 0) drawMap();
            };
            img.src = creatorMapAssets[key];
        });
    }

    // Setup map preview canvas
    const previewDiv = document.getElementById('creator-map-preview');
    previewDiv.innerHTML = `<canvas id="creator-map-canvas"></canvas>`;
    const canvas = document.getElementById('creator-map-canvas');
    const ctx = canvas.getContext('2d');

    // Add tooltip overlay
    const tooltip = document.createElement('div');
    tooltip.id = 'creator-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.background = 'rgba(0,0,0,0.85)';
    tooltip.style.border = '1px solid #4a90e2';
    tooltip.style.borderRadius = '4px';
    tooltip.style.padding = '6px 8px';
    tooltip.style.fontSize = '12px';
    tooltip.style.color = '#eaeaea';
    tooltip.style.whiteSpace = 'pre-line';
    tooltip.style.zIndex = '5';
    tooltip.style.display = 'none';
    previewDiv.appendChild(tooltip);

    function showTooltip(text, clientX, clientY) {
        if (!text) return hideTooltip();
        const rect = previewDiv.getBoundingClientRect();
        tooltip.textContent = text;
        tooltip.style.left = `${clientX - rect.left + 12}px`;
        tooltip.style.top = `${clientY - rect.top + 12}px`;
        tooltip.style.display = 'block';
    }
    function hideTooltip() {
        tooltip.style.display = 'none';
    }

    // Fixed container size
    const containerWidth = previewDiv.offsetWidth || 900;
    const containerHeight = previewDiv.offsetHeight || 600;

    // Map pixel size
    const tileSize = mapData.tilewidth || 32;
    const width = mapData.width || (mapData.layout ? mapData.layout[0].length : 50);
    const height = mapData.height || (mapData.layout ? mapData.layout.length : 50);

    // Tiled map support for Cynrith maps
    function buildGidToAssetIndexMap(mapData) {
        const gidMap = [];
        const tilesets = mapData.tilesets || [];
        const assets = mapData.assets || [];
        for (let i = 0; i < tilesets.length; i++) {
            const ts = tilesets[i];
            const firstgid = ts.firstgid;
            let assetName = ts.source ? ts.source.replace('.tsx', '') : '';
            let idx = assets.findIndex(a => a.file_name === assetName);
            if (idx === -1) continue;
            const nextFirstgid = (i + 1 < tilesets.length) ? tilesets[i + 1].firstgid : firstgid + 1;
            for (let gid = firstgid; gid < nextFirstgid; gid++) {
                gidMap[gid] = idx;
            }
        }
        return gidMap;
    }

    // Prepare layers and GID map
    let layers = [];
    let gidMap = [];
    if (mapData.layers && mapData.layers.length) {
        gidMap = buildGidToAssetIndexMap(mapData);
        layers = mapData.layers.map(layer => {
            let arr = [];
            for (let y = 0; y < layer.height; y++) {
                arr[y] = [];
                for (let x = 0; x < layer.width; x++) {
                    arr[y][x] = layer.data[y * layer.width + x];
                }
            }
            return arr;
        });
    } else if (mapData.layout) {
        layers = [mapData.layout];
    }   

    // Center map initially
    const mapPixelWidth = width * tileSize * creatorMapZoom;
    const mapPixelHeight = height * tileSize * creatorMapZoom;
    creatorMapOffset.x = (containerWidth - mapPixelWidth) / 2;
    creatorMapOffset.y = (containerHeight - mapPixelHeight) / 2;

    function resizeCanvas() {
        canvas.width = containerWidth;
        canvas.height = containerHeight;
        drawMap();
    }

    function drawMap() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(creatorMapOffset.x, creatorMapOffset.y);
        ctx.scale(creatorMapZoom, creatorMapZoom);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Draw all layers from bottom to top
                let tileDrawn = false;
                for (let l = 0; l < layers.length; l++) {
                    let layer = layers[l];
                    let gid = layer[y][x];
                    if (gid > 0 && gidMap[gid] !== undefined) {
                        let assetIdx = gidMap[gid];
                        let assetDef = mapData.assets[assetIdx];
                        let assetKey = assetDef ? assetDef.file_name + ".png" : null;
                        if (assetDef && creatorMapImages[assetKey]) {
                            ctx.drawImage(creatorMapImages[assetKey], x * tileSize, y * tileSize, tileSize, tileSize);
                            tileDrawn = true;
                        }
                    }
                }
                if (!tileDrawn) {
                    ctx.fillStyle = "#232634";
                    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                }
                // Draw grid
                ctx.strokeStyle = "#4a90e2";
                ctx.lineWidth = 1;
                ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
            }
        }
        // Highlight first tile after step 1 selection
        if (wanderSelectionStep === 2 && wanderFirstCorner) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#ffd700";
            ctx.fillRect(wanderFirstCorner.x * tileSize, wanderFirstCorner.y * tileSize, tileSize, tileSize);
            ctx.restore();
        }

        // Wander Area Highlight
        const npc = creatorState.npc;
        if (npc.wanderArea && npc.wanderArea.tiles && Array.isArray(npc.wanderArea.tiles)) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "#ffd700";
            npc.wanderArea.tiles.forEach(({x, y}) => {
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            });
            ctx.restore();
        }

        // Spawn Location Marker
        if (npc.spawn && typeof npc.spawn.x === "number" && typeof npc.spawn.y === "number") {
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = "#00ff00";
            ctx.lineWidth = 3;
            const centerX = npc.spawn.x * tileSize + tileSize / 2;
            const centerY = npc.spawn.y * tileSize + tileSize / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, tileSize / 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }
        // Forced Encounter trigger tiles (current draft) -- distinct red so they
        // don't get confused with the gold wander area or green spawn marker.
        if (npc.forcedEncounter && npc.forcedEncounter.enabled && npc.forcedEncounter.triggerTiles.length) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#e74c3c";
            ctx.strokeStyle = "#e74c3c";
            ctx.lineWidth = 2;
            npc.forcedEncounter.triggerTiles.forEach(({x, y}) => {
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
            });
            ctx.restore();
        }
        savedNpcs.forEach(npc => {
            // Highlight wander area
            const tiles = getWanderTiles(npc.wanderArea);
            if (tiles.length) {
                ctx.save();
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = "#ffd700";
                tiles.forEach(({x, y}) => {
                    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                });
                ctx.restore();
            }
            // Spawn marker
            if (npc.spawn && typeof npc.spawn.x === "number" && typeof npc.spawn.y === "number") {
                ctx.save();
                ctx.globalAlpha = 0.85;
                ctx.strokeStyle = "#00ff00";
                ctx.lineWidth = 3;
                const centerX = npc.spawn.x * tileSize + tileSize / 2;
                const centerY = npc.spawn.y * tileSize + tileSize / 2;
                ctx.beginPath();
                ctx.arc(centerX, centerY, tileSize / 3, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
            }
            if (Array.isArray(npc.spawns)) {
                npc.spawns.forEach(spawn => {
                    const tiles = getWanderTiles(spawn.wanderArea);
                    if (tiles.length) {
                        ctx.save();
                        ctx.globalAlpha = 0.25;
                        ctx.fillStyle = "#ffd700";
                        tiles.forEach(({x, y}) => {
                            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                        });
                        ctx.restore();
                    }
                    if (typeof spawn.x === "number" && typeof spawn.y === "number") {
                        ctx.save();
                        ctx.globalAlpha = 0.85;
                        ctx.strokeStyle = "#00ff00";
                        ctx.lineWidth = 3;
                        const centerX = spawn.x * tileSize + tileSize / 2;
                        const centerY = spawn.y * tileSize + tileSize / 2;
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, tileSize / 3, 0, 2 * Math.PI);
                        ctx.stroke();
                        ctx.restore();
                    }
                });
            }
            if (npc.forcedEncounter && npc.forcedEncounter.enabled && Array.isArray(npc.forcedEncounter.triggerTiles) && npc.forcedEncounter.triggerTiles.length) {
                ctx.save();
                ctx.globalAlpha = 0.35;
                ctx.fillStyle = "#e74c3c";
                ctx.strokeStyle = "#e74c3c";
                ctx.lineWidth = 2;
                npc.forcedEncounter.triggerTiles.forEach(({x, y}) => {
                    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                    ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
                });
                ctx.restore();
            }
        });
        // Highlight enemy selection area during selection
        if (enemySpawnSelectionStep === 2 && enemySpawnFirstCorner) {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#ff4444";
            ctx.fillRect(enemySpawnFirstCorner.x * tileSize, enemySpawnFirstCorner.y * tileSize, tileSize, tileSize);
            ctx.restore();
        }
        if (enemyCurrentWanderArea && enemyCurrentWanderArea.tiles) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "#ff4444";
            enemyCurrentWanderArea.tiles.forEach(({x, y}) => {
                ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
            });
            ctx.restore();
        }
        enemyCreatorState.enemy.spawns.forEach(spawn => {
            if (spawn.wanderArea && spawn.wanderArea.tiles) {
                ctx.save();
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = "#ff4444";
                spawn.wanderArea.tiles.forEach(({x, y}) => {
                    ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                });
                ctx.restore();
            }
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = "#ff4444";
            ctx.lineWidth = 3;
            const centerX = spawn.x * tileSize + tileSize / 2;
            const centerY = spawn.y * tileSize + tileSize / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, tileSize / 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        });
        savedEnemies.forEach(enemy => {
            if (Array.isArray(enemy.spawns)) {
                enemy.spawns.forEach(spawn => {
                    const tiles = getWanderTiles(spawn.wanderArea);
                    if (tiles.length) {
                        ctx.save();
                        ctx.globalAlpha = 0.25;
                        ctx.fillStyle = "#ff4444";
                        tiles.forEach(({x, y}) => {
                            ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
                        });
                        ctx.restore();
                    }
                    // Spawn marker
                    if (typeof spawn.x === "number" && typeof spawn.y === "number") {
                        ctx.save();
                        ctx.globalAlpha = 0.85;
                        ctx.strokeStyle = "#ff4444";
                        ctx.lineWidth = 3;
                        const centerX = spawn.x * tileSize + tileSize / 2;
                        const centerY = spawn.y * tileSize + tileSize / 2;
                        ctx.beginPath();
                        ctx.arc(centerX, centerY, tileSize / 3, 0, 2 * Math.PI);
                        ctx.stroke();
                        ctx.restore();
                    }
                });
            }
        });
        // Highlight current trigger selection
        if (typeof triggerCreatorState.trigger.x === "number" && typeof triggerCreatorState.trigger.y === "number") {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#a259ff";
            ctx.fillRect(triggerCreatorState.trigger.x * tileSize, triggerCreatorState.trigger.y * tileSize, tileSize, tileSize);
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = "#a259ff";
            ctx.lineWidth = 3;
            const centerX = triggerCreatorState.trigger.x * tileSize + tileSize / 2;
            const centerY = triggerCreatorState.trigger.y * tileSize + tileSize / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, tileSize / 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }
        // Draw all saved triggers
        savedTriggers.forEach(trig => {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#a259ff";
            ctx.fillRect(trig.x * tileSize, trig.y * tileSize, tileSize, tileSize);
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = "#a259ff";
            ctx.lineWidth = 3;
            const centerX = trig.x * tileSize + tileSize / 2;
            const centerY = trig.y * tileSize + tileSize / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, tileSize / 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        });
        // Highlight current interactable selection
        if (typeof interactCreatorState.tile.x === "number" && typeof interactCreatorState.tile.y === "number") {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#00e5ff";
            ctx.fillRect(interactCreatorState.tile.x * tileSize, interactCreatorState.tile.y * tileSize, tileSize, tileSize);
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = "#00e5ff";
            ctx.lineWidth = 3;
            const centerX = interactCreatorState.tile.x * tileSize + tileSize / 2;
            const centerY = interactCreatorState.tile.y * tileSize + tileSize / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, tileSize / 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        }
        // Draw all saved interactable tiles
        savedInteractTiles.forEach(it => {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#00e5ff";
            ctx.fillRect(it.x * tileSize, it.y * tileSize, tileSize, tileSize);
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = 0.85;
            ctx.strokeStyle = "#00e5ff";
            ctx.lineWidth = 3;
            const centerX = it.x * tileSize + tileSize / 2;
            const centerY = it.y * tileSize + tileSize / 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, tileSize / 3, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
        });
        (worldSpriteCreatorState.sprite.positions || []).forEach(p => {
            if (p.map !== undefined) {
                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = "#ffa500";
                ctx.fillRect(p.x * tileSize, p.y * tileSize, tileSize, tileSize);
                ctx.restore();
                ctx.save();
                ctx.globalAlpha = 0.85;
                ctx.strokeStyle = "#ffa500";
                ctx.lineWidth = 3;
                const cx = p.x * tileSize + tileSize / 2;
                const cy = p.y * tileSize + tileSize / 2;
                ctx.beginPath();
                ctx.arc(cx, cy, tileSize / 3, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
            }
        });
        // Draw saved world sprite positions
        savedWorldSprites.forEach(ws => {
            (ws.positions || []).forEach(p => {
                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = "#ffa500";
                ctx.fillRect(p.x * tileSize, p.y * tileSize, tileSize, tileSize);
                ctx.restore();
                ctx.save();
                ctx.globalAlpha = 0.85;
                ctx.strokeStyle = "#ffa500";
                ctx.lineWidth = 3;
                const cx = p.x * tileSize + tileSize / 2;
                const cy = p.y * tileSize + tileSize / 2;
                ctx.beginPath();
                ctx.arc(cx, cy, tileSize / 3, 0, 2 * Math.PI);
                ctx.stroke();
                ctx.restore();
            });
        });
        ctx.restore();
    }

    // Helper: get tile under mouse
    function getTileFromMouse(e) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - creatorMapOffset.x) / creatorMapZoom;
        const mouseY = (e.clientY - rect.top - creatorMapOffset.y) / creatorMapZoom;
        const tSize = mapData.tilewidth || 32;
        return {
            x: Math.floor(mouseX / tSize),
            y: Math.floor(mouseY / tSize)
        };
    }

    // Helper: collect hover info for a tile
    function getHoverInfoForTile(tx, ty) {
        const lines = [];

        // Current NPC spawn
        if (creatorState.npc?.spawn && creatorState.npc.spawn.x === tx && creatorState.npc.spawn.y === ty) {
            lines.push(`NPC: ${creatorState.npc.name || '(Unnamed)'} (${tx},${ty})`);
        }
        // Saved NPC spawns
        savedNpcs.forEach(n => {
            if (n.spawn && n.spawn.x === tx && n.spawn.y === ty) {
                lines.push(`NPC (saved): ${n.name || '(Unnamed)'} [map ${n.mapNumber}]`);
            }
        });

        // Current enemy spawns
        (enemyCreatorState.enemy?.spawns || []).forEach(s => {
            if (s.x === tx && s.y === ty) {
                const nm = enemyCreatorState.enemy.name || enemyCreatorState.enemy.id || '(Unnamed Enemy)';
                lines.push(`Enemy: ${nm} (${tx},${ty})`);
            }
        });
        // Saved enemy spawns
        savedEnemies.forEach(en => {
            (en.spawns || []).forEach(s => {
                if (s.x === tx && s.y === ty) {
                    lines.push(`Enemy (saved): ${en.name || en.id || '(Unnamed)'} [map ${s.map}]`);
                }
            });
        });

        // Current trigger
        const tcur = triggerCreatorState.trigger;
        if (typeof tcur?.x === 'number' && tcur.x === tx && tcur.y === ty) {
            lines.push(`Trigger: ${tcur.id || '(unnamed)'} • ${tcur.type}`);
        }
        // Saved triggers
        savedTriggers.forEach(tr => {
            if (tr.x === tx && tr.y === ty) {
                lines.push(`Trigger (saved): ${tr.id || '(unnamed)'} • ${tr.type}`);
            }
        });

        // Current interactable
        const icur = interactCreatorState.tile;
        if (typeof icur?.x === 'number' && icur.x === tx && icur.y === ty) {
            lines.push(`Interactable: ${icur.id || '(unnamed)'}${icur.notification ? `\n"${icur.notification}"` : ''}`);
        }
        // Saved interactables
        savedInteractTiles.forEach(it => {
            if (it.x === tx && it.y === ty) {
                lines.push(`Interactable (saved): ${it.id || '(unnamed)'}${it.notification ? `\n"${it.notification}"` : ''}`);
            }
        });

        // Current world sprite positions
        (worldSpriteCreatorState.sprite?.positions || []).forEach(p => {
            if (p.x === tx && p.y === ty) {
                lines.push(`World Sprite: ${worldSpriteCreatorState.sprite.id || '(unnamed)'} (${tx},${ty})`);
            }
        });
        // Saved world sprite positions
        savedWorldSprites.forEach(ws => {
            (ws.positions || []).forEach(p => {
                if (p.x === tx && p.y === ty) {
                    lines.push(`World Sprite (saved): ${ws.id || '(unnamed)'} (${tx},${ty})`);
                }
            });
        });

        return lines;
    }

    // Tooltip handler on mouse move (skip while dragging)
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) { hideTooltip(); return; }
        const { x: tx, y: ty } = getTileFromMouse(e);
        // Outside map bounds
        if (tx < 0 || ty < 0 || tx >= (mapData.width || width) || ty >= (mapData.height || height)) {
            hideTooltip();
            return;
        }
        const lines = getHoverInfoForTile(tx, ty);
        if (lines.length) {
            showTooltip(lines.join('\n'), e.clientX, e.clientY);
        } else {
            hideTooltip();
        }
    });

    canvas.addEventListener('mouseleave', () => hideTooltip());
    canvas.addEventListener('mousedown', () => hideTooltip());
    canvas.addEventListener('touchstart', () => hideTooltip(), { passive: true });

    // Touch drag support
    let lastTouch = null;
    let lastTouchDist = null;

    canvas.addEventListener('touchstart', function(e) {
        if (e.touches.length === 1 || e.touches.length === 2) {
            e.preventDefault(); // Prevent page scroll
        }
        if (e.touches.length === 1) {
            isDragging = true;
            const touch = e.touches[0];
            lastTouch = { x: touch.clientX, y: touch.clientY };
            dragStart.x = touch.clientX - creatorMapOffset.x;
            dragStart.y = touch.clientY - creatorMapOffset.y;
            canvas.style.cursor = "grabbing";
        } else if (e.touches.length === 2) {
            lastTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: false });
    
    canvas.addEventListener('touchmove', function(e) {
        if (e.touches.length === 1 || e.touches.length === 2) {
            e.preventDefault(); // Prevent page scroll
        }
        if (e.touches.length === 1 && isDragging) {
            const touch = e.touches[0];
            creatorMapOffset.x = touch.clientX - dragStart.x;
            creatorMapOffset.y = touch.clientY - dragStart.y;
            drawMap();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (lastTouchDist) {
                let zoomChange = (dist - lastTouchDist) * 0.005;
                let oldZoom = creatorMapZoom;
                creatorMapZoom = Math.max(0.1, Math.min(3, creatorMapZoom + zoomChange));
                const rect = canvas.getBoundingClientRect();
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                creatorMapOffset.x = midX - ((midX - creatorMapOffset.x) * (creatorMapZoom / oldZoom));
                creatorMapOffset.y = midY - ((midY - creatorMapOffset.y) * (creatorMapZoom / oldZoom));
                drawMap();
            }
            lastTouchDist = dist;
        }
    }, { passive: false });
    
    canvas.addEventListener('touchend', function(e) {
        e.preventDefault(); // Prevent page scroll
        isDragging = false;
        lastTouch = null;
        lastTouchDist = null;
        canvas.style.cursor = "grab";
    }, { passive: false });

    // Dragging logic
    canvas.onmousedown = function(e) {
        isDragging = true;
        dragStart.x = e.clientX - creatorMapOffset.x;
        dragStart.y = e.clientY - creatorMapOffset.y;
        canvas.style.cursor = "grabbing";
    };
    window.onmouseup = function() {
        isDragging = false;
        canvas.style.cursor = "grab";
    };
    window.onmousemove = function(e) {
        if (isDragging) {
            creatorMapOffset.x = e.clientX - dragStart.x;
            creatorMapOffset.y = e.clientY - dragStart.y;
            drawMap();
        }
    };

    // Zoom centered on mouse
    canvas.onwheel = function(e) {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const zoomStep = 0.1;
        let oldZoom = creatorMapZoom;
        if (e.deltaY < 0) {
            creatorMapZoom = Math.min(creatorMapZoom + zoomStep, 3);
        } else {
            creatorMapZoom = Math.max(creatorMapZoom - zoomStep, 0.1);
        }
        creatorMapOffset.x = mouseX - ((mouseX - creatorMapOffset.x) * (creatorMapZoom / oldZoom));
        creatorMapOffset.y = mouseY - ((mouseY - creatorMapOffset.y) * (creatorMapZoom / oldZoom));
        drawMap();
    };

    canvas.onclick = function(e) {
        // Get tile coordinates
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - creatorMapOffset.x) / creatorMapZoom;
        const mouseY = (e.clientY - rect.top - creatorMapOffset.y) / creatorMapZoom;
        const tileSize = mapData.tilewidth || 32;
        const x = Math.floor(mouseX / tileSize);
        const y = Math.floor(mouseY / tileSize);
    
        // NPC Wander/Spawn Selection
        if (wanderSelectionStep !== 0) {
            if (wanderSelectionStep === 1) {
                wanderFirstCorner = { x, y };
                wanderSelectionStep = 2;
                updateWanderPrompt();
                drawMap();
            } else if (wanderSelectionStep === 2) {
                const x1 = Math.min(wanderFirstCorner.x, x);
                const y1 = Math.min(wanderFirstCorner.y, y);
                const x2 = Math.max(wanderFirstCorner.x, x);
                const y2 = Math.max(wanderFirstCorner.y, y);
                const tiles = [];
                for (let tx = x1; tx <= x2; tx++) {
                    for (let ty = y1; ty <= y2; ty++) {
                        tiles.push({ x: tx, y: ty });
                    }
                }
                creatorState.npc.wanderArea = { x1, y1, x2, y2, tiles };
                wanderSelectionStep = 3;
                updateCreatorPreview();
                updateWanderPrompt();
                drawMap();
            } else if (wanderSelectionStep === 3) {
                const area = creatorState.npc.wanderArea;
                if (
                    area &&
                    x >= area.x1 && x <= area.x2 &&
                    y >= area.y1 && y <= area.y2
                ) {
                    creatorState.npc.spawn = { x, y };
                    wanderSelectionStep = 0;
                    updateCreatorPreview();
                    updateWanderPrompt();
                    drawMap();
                } else {
                    const previewDiv = document.getElementById('npc-wander-preview');
                    if (previewDiv) previewDiv.textContent = "Spawn must be inside the wander area. Try again.";
                }
            }
        }

        // Forced Encounter trigger-tile picking: each click toggles a tile in/out
        // of the set, since the real tiles are an arbitrary shape, not a rectangle.
        if (forcedEncounterPicking) {
            const tiles = creatorState.npc.forcedEncounter.triggerTiles;
            const idx = tiles.findIndex(t => t.x === x && t.y === y);
            if (idx >= 0) tiles.splice(idx, 1);
            else tiles.push({ x, y });
            updateForcedEncounterPrompt();
            updateCreatorPreview();
            drawMap();
        }
    
        // Enemy Spawn Selection
        if (enemySpawnSelectionStep !== 0) {
            if (enemySpawnSelectionStep === 1) {
                enemySpawnFirstCorner = { x, y };
                enemySpawnSelectionStep = 2;
                updateEnemySpawnPrompt();
                drawMap();
            } else if (enemySpawnSelectionStep === 2) {
                const x1 = Math.min(enemySpawnFirstCorner.x, x);
                const y1 = Math.min(enemySpawnFirstCorner.y, y);
                const x2 = Math.max(enemySpawnFirstCorner.x, x);
                const y2 = Math.max(enemySpawnFirstCorner.y, y);
                const tiles = [];
                for (let tx = x1; tx <= x2; tx++) {
                    for (let ty = y1; ty <= y2; ty++) {
                        tiles.push({ x: tx, y: ty });
                    }
                }
                enemyCurrentWanderArea = { x1, y1, x2, y2, tiles };
                enemySpawnSelectionStep = 3;
                updateEnemySpawnPrompt();
                drawMap();
            } else if (enemySpawnSelectionStep === 3) {
                const area = enemyCurrentWanderArea;
                if (
                    area &&
                    x >= area.x1 && x <= area.x2 &&
                    y >= area.y1 && y <= area.y2
                ) {
                    enemyCreatorState.enemy.spawns.push({
                        map: enemyCreatorState.enemy.mapNumber,
                        x, y,
                        wanderArea: {
                            x1: area.x1,
                            y1: area.y1,
                            x2: area.x2,
                            y2: area.y2,
                            tiles: area.tiles 
                        }
                    });
                    enemySpawnSelectionStep = 0;
                    enemySpawnFirstCorner = null;
                    enemyCurrentWanderArea = null;
                    updateEnemySpawnPrompt();
                    updateEnemyCreatorPreview();
                    drawMap();
                } else {
                    const previewDiv = document.getElementById('enemy-spawn-preview');
                    if (previewDiv) previewDiv.textContent = "Spawn must be inside the wander area. Try again.";
                }
            }
        }

        // Trigger tile selection
        if (triggerSelectionStep === 1) {
            triggerCreatorState.trigger.x = x;
            triggerCreatorState.trigger.y = y;
            triggerSelectionStep = 0;
            updateTriggerPrompt();
            updateTriggerCreatorPreview();
            if (typeof drawMap === "function") drawMap();
        }

        // Interactable tile selection
        if (interactSelectionStep === 1) {
            interactCreatorState.tile.x = x;
            interactCreatorState.tile.y = y;
            interactSelectionStep = 0;
            updateInteractPrompt();
            updateInteractCreatorPreview();
            if (typeof drawMap === "function") drawMap();
        }

        // World Sprite position selection
        if (spriteSelectionStep === 1) {
            const mapInput = worldSpriteCreatorState.sprite.positionMap;
            const mapVal = (mapInput !== "" && !isNaN(Number(mapInput))) ? Number(mapInput) : (mapInput || 0);
            worldSpriteCreatorState.sprite.positions.push({ map: mapVal, x, y });
            spriteSelectionStep = 0;
            renderWorldSpritePositionsList();
            updateWorldSpritePositionPrompt();
            updateWorldSpritePreview();
            if (typeof drawMap === "function") drawMap();
        }
    };
    resizeCanvas();
    showToolPanel();
    scheduleCreatorAutosave();
}

function renderNpcDownloadButtons() {
    renderDownloadButtons('npc-download-buttons', [
        {
            id: 'download-npc-defs', label: 'Download NPC Definitions', filename: 'npc_definitions.js',
            buildCode: () => savedNpcs.map(npc => getNpcDefinitionCode(npc)).join("\n\n")
        },
        {
            id: 'download-quest-defs', label: 'Download Quest Definitions', filename: 'quest_definitions.js',
            buildCode: () => savedNpcs.filter(npc => npc.hasQuest).map(npc => getQuestDefinitionCode(npc)).join("\n\n")
        }
    ]);
}

function downloadTextFile(filename, text) {
    const blob = new Blob([text], {type: "text/plain"});
    const link = document.createElement("a");
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
}

// Generic renderer for a "saved X" list panel (saved NPCs, enemies,
// triggers, interact tiles, world sprites, items, skills all use this same
// shape: a list of rows with Edit/Delete buttons). Replaces 7 near-identical
// implementations that had started to drift -- e.g. NPC's delete handler
// used to also re-render the Enemy list by copy-paste mistake, which this
// consolidation fixes by construction (each tool only declares its own
// onEdit/onDelete side effects).
function renderSavedList(config) {
    const {
        listElId, rowClass, editBtnClass, deleteBtnClass, emptyMessage,
        label, toolKey, setDraft, onEdit, onDelete,
        getItems // () => current array; a getter (not a captured reference) so
                 // this always respects the *current* value of the outer
                 // savedX variable, matching the original code's behavior of
                 // reading that module-level variable live at click-time.
    } = config;

    const listDiv = document.getElementById(listElId);
    if (!listDiv) return;

    const items = getItems();
    if (!items.length) {
        listDiv.innerHTML = `<b>${emptyMessage}</b>`;
        return;
    }

    listDiv.innerHTML = items.map((item, idx) => `
        <div class="${rowClass}" style="background:#232634; border-radius:6px; padding:8px; margin-bottom:8px; display:flex; align-items:center; gap:12px;">
            <span style="font-weight:bold;">${label(item)}</span>
            <button type="button" class="${editBtnClass}" data-idx="${idx}">Edit</button>
            <button type="button" class="${deleteBtnClass}" data-idx="${idx}">Delete</button>
        </div>
    `).join("");

    listDiv.querySelectorAll(`.${editBtnClass}`).forEach(btn => {
        btn.onclick = () => {
            const idx = Number(btn.dataset.idx);
            setDraft(JSON.parse(JSON.stringify(getItems()[idx])));
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            const sideBtn = document.querySelector(`.tool-btn[data-tool="${toolKey}"]`);
            if (sideBtn) sideBtn.classList.add('active');
            currentCreatorTool = toolKey; // keep autosave's "which panel is open" in sync
            showToolOptions(toolKey);
            if (onEdit) onEdit();
        };
    });

    listDiv.querySelectorAll(`.${deleteBtnClass}`).forEach(btn => {
        btn.onclick = () => {
            const idx = Number(btn.dataset.idx);
            getItems().splice(idx, 1);
            renderSavedList(config);
            if (onDelete) onDelete();
        };
    });
}

// Generic renderer for a "download definitions" button panel. Most tools
// have exactly one button; NPC has two (NPC defs + Quest defs).
function renderDownloadButtons(containerId, buttons) {
    const btnDiv = document.getElementById(containerId);
    if (!btnDiv) return;
    btnDiv.innerHTML = buttons.map(b => `<button id="${b.id}" type="button">${b.label}</button>`).join('\n        ');
    buttons.forEach(b => {
        document.getElementById(b.id).onclick = () => {
            downloadTextFile(b.filename, b.buildCode());
        };
    });
}

function getNpcDefinitionCode(npc) {
    // Format wanderArea 
    let wanderAreaPreview = undefined;
    if (npc.wanderArea && typeof npc.wanderArea.x1 === "number") {
        wanderAreaPreview = {
            x1: npc.wanderArea.x1,
            y1: npc.wanderArea.y1,
            x2: npc.wanderArea.x2,
            y2: npc.wanderArea.y2
        };
    }
    let spawnsPreview = "";
    if (npc.spawn && wanderAreaPreview) {
        const mapVal = isNaN(npc.mapNumber) ? `"${npc.mapNumber}"` : npc.mapNumber;
        spawnsPreview = `[ { map: ${mapVal}, x: ${npc.spawn.x}, y: ${npc.spawn.y}, wanderArea: { x1: ${wanderAreaPreview.x1}, y1: ${wanderAreaPreview.y1}, x2: ${wanderAreaPreview.x2}, y2: ${wanderAreaPreview.y2} } } ]`;
    } else {
        spawnsPreview = "[]";
    }
    function formatDialogueSection(key, arr) {
        if (!arr || !arr.length) return "";
        return `  ${key}: [\n${arr.map(line => `    "${line}"`).join(",\n")}\n  ]`;
    }
    const dialogueDefault = npc.dialogueDefault.split('\n').filter(l => l.trim());
    const dialogueQuestGiven = npc.questGiven.split('\n').filter(l => l.trim());
    const dialogueQuestIncomplete = npc.questIncomplete.split('\n').filter(l => l.trim());
    const dialogueQuestComplete = npc.questComplete.split('\n').filter(l => l.trim());

    // Build dialogue object with commas
    let dialogueSections = [];
    if (dialogueDefault.length) dialogueSections.push(formatDialogueSection("default", dialogueDefault));
    if (dialogueQuestGiven.length) dialogueSections.push(formatDialogueSection("questGiven", dialogueQuestGiven));
    if (dialogueQuestIncomplete.length) dialogueSections.push(formatDialogueSection("questIncomplete", dialogueQuestIncomplete));
    if (dialogueQuestComplete.length) dialogueSections.push(formatDialogueSection("questComplete", dialogueQuestComplete));
    let dialoguePreview = dialogueSections.join(",\n");

    // Forced Encounter
    let forcedEncounterPreview = "";
    let feEnabled = false;
    let feTiles = [];
    if (npc.forcedEncounter && typeof npc.forcedEncounter === 'object' && Array.isArray(npc.forcedEncounter.triggerTiles)) {
        feEnabled = !!npc.forcedEncounter.enabled;
        feTiles = npc.forcedEncounter.triggerTiles;
    } else if (npc.npcForced && npc.triggerTiles) {
        // Backward-compat: NPCs saved before this update used a flat
        // "x,y x,y" string instead of a real forcedEncounter object.
        feEnabled = true;
        feTiles = npc.triggerTiles.split(' ').map(pair => {
            const [x, y] = pair.split(',').map(Number);
            return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
        }).filter(Boolean);
    }
    if (feEnabled) {
        const triggers = feTiles.map(t => `      { x: ${t.x}, y: ${t.y} }`).join(",\n");
        forcedEncounterPreview = 
`  forcedEncounter: {
    enabled: true,
    triggerTiles: [
${triggers}
    ],
    triggered: false
  },`;
    }

    // Compose the full NPC definition with the ID as the object key
    return `${npc.id || npc.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}: {
  id: "${npc.id || npc.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}",
  name: "${npc.name}",
  sprite: "assets/img/npc/npc_${npc.spriteGender}_${npc.spriteNumber}.png",
  interactive: true,
  spawns: ${spawnsPreview},
  dialogue: {
${dialoguePreview}
  },
  questId: "${npc.questId || npc.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}",
  questRedo: ${!!npc.questRedoable},
${forcedEncounterPreview}
},`;
}

function getQuestDefinitionCode(npc) {
    let questTypeObj = {};
    switch (npc.questType) {
        case "itemCollect": {
            const id = (npc.questTypeOptions.itemId || "").trim();
            const amt = Number(npc.questTypeOptions.requiredAmount) || 1;
            questTypeObj.requiredItems = id ? [{ id, amount: amt }] : [];
            break;
        }
        case "gift": {
            questTypeObj.requiredItems = []; // real quests.js always includes this empty array for gift quests
            break;
        }
        case "enemyDefeat":
            questTypeObj.enemyId = npc.questTypeOptions.enemyId || "";
            questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
            break;
        case "statBuild":
            questTypeObj.stat = npc.questTypeOptions.stat || "";
            questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
            break;
        case "interactTiles": {
            const rawIds = npc.questTypeOptions.interactTileIds;
            questTypeObj.interactTileIds = Array.isArray(rawIds) ? rawIds : (rawIds || "").split(',').map(s => s.trim()).filter(Boolean);
            questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
            break;
        }
    }
    let rewards = [];
    try {
        rewards = JSON.parse(npc.questRewards || "[]");
    } catch (e) {
        rewards = [];
    }
    // Compose the full quest definition with the ID as the object key
    return `${npc.questId || npc.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}: {
    id: "${npc.questId || npc.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}",
    name: "${npc.questName || npc.name}",
    description: "${npc.questDescription || ""}",
    type: "${npc.questType}",${
        questTypeObj.requiredItems ? `\n    requiredItems: [${questTypeObj.requiredItems.map(i => ` { id: "${i.id}", amount: ${i.amount} }`).join(",")} ],` : ""
    }${
        questTypeObj.enemyId ? `\n    enemyId: "${questTypeObj.enemyId}",` : ""
    }${
        questTypeObj.requiredAmount ? `\n    requiredAmount: ${questTypeObj.requiredAmount},` : ""
    }${
        questTypeObj.stat ? `\n    stat: "${questTypeObj.stat}",` : ""
    }${
        questTypeObj.interactTileIds ? `\n    interactTileIds: [${questTypeObj.interactTileIds.map(id => `"${id}"`).join(", ")}],` : ""
    }
    rewards: [${rewards.map(r => {
        if (r.id) return `{ id: "${r.id}", amount: ${r.amount || 1} }`;
        let keys = Object.keys(r).filter(k => k !== "id" && k !== "amount");
        return keys.map(k => `{ ${k}: ${r[k]} }`).join(", ");
    }).join(", ")}],${
        npc.questIcon ? `\n    icon: "${npc.questIcon}",` : ""
    }
    redoable: ${!!npc.questRedoable}
},`;
}

let __tileMakerInitialized = false;
function renderTileMakerTab() {
    // Only build the Tile Generator once per session so the palette,
    // generated tile, and settings don't reset when switching tabs.
    if (__tileMakerInitialized) return;
    __tileMakerInitialized = true;

    const tab = document.getElementById('tile-maker-tab');
    tab.innerHTML = `
        <h2>Tile Generator</h2>
        <div id="tile-maker-layout" style="display:flex; gap:32px;">
            <div id="tile-maker-left-panel" style="width:340px;">
                <div id="tile-maker-controls"></div>
            </div>
            <div id="tile-maker-right-panel" style="flex:1;">
                <div id="tile-maker-zoom-controls"></div>
                <canvas id="tile-maker-canvas" width="32" height="32" style="border:4px solid #35374a; background:#232634; image-rendering:pixelated;"></canvas>
            </div>
        </div>
    `;
    setupTileMaker();
}

// Enemy tool
function renderEnemyLootList() {
    const loot = enemyCreatorState.enemy.loot || [];
    const listDiv = document.getElementById('enemy-loot-list');
    if (!listDiv) return;
    listDiv.innerHTML = loot.map((l, i) => `
        <div class="loot-row" data-idx="${i}" style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
            <input type="text" class="loot-item" value="${l.item || ''}" placeholder="Item ID" style="width:120px;">
            <input type="number" class="loot-chance" value="${l.chance || 100}" min="1" max="100" style="width:60px;" placeholder="Chance">
            <input type="text" class="loot-amount" value="${Array.isArray(l.amount) ? l.amount.join(',') : l.amount}" placeholder="Amount (e.g. 1,2)" style="width:60px;">
            <button type="button" class="remove-loot-btn">Remove</button>
        </div>
    `).join("");
}
function attachEnemyLootListeners() {
    const list = document.getElementById('enemy-loot-list');
    if (!list) return;
    list.querySelectorAll('.loot-item, .loot-chance, .loot-amount').forEach(input => {
        input.oninput = () => {
            const loot = [];
            list.querySelectorAll('.loot-row').forEach(row => {
                const item = row.querySelector('.loot-item').value.trim();
                const chance = Number(row.querySelector('.loot-chance').value) || 100;
                const amountStr = row.querySelector('.loot-amount').value.trim();
                let amount = amountStr.includes(',') ? amountStr.split(',').map(Number) : [Number(amountStr) || 1];
                if (item) loot.push({ item, chance, amount });
            });
            enemyCreatorState.enemy.loot = loot;
            updateEnemyCreatorPreview();
        };
    });
    list.querySelectorAll('.remove-loot-btn').forEach(btn => {
        btn.onclick = () => {
            btn.parentElement.remove();
            list.querySelector('.loot-item')?.dispatchEvent(new Event('input'));
        };
    });
    const addBtn = document.getElementById('add-enemy-loot-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            const newRow = document.createElement('div');
            newRow.className = 'loot-row';
            newRow.style = "display:flex; gap:8px; align-items:center; margin-bottom:4px;";
            newRow.innerHTML = `
                <input type="text" class="loot-item" placeholder="Item ID" style="width:120px;">
                <input type="number" class="loot-chance" value="100" min="1" max="100" style="width:60px;" placeholder="Chance">
                <input type="text" class="loot-amount" value="1" style="width:60px;" placeholder="Amount (e.g. 1,2)">
                <button type="button" class="remove-loot-btn">Remove</button>
            `;
            list.appendChild(newRow);
            attachEnemyLootListeners();
        };
    }
}

function attachEnemyCreatorListeners() {
    const enemy = enemyCreatorState.enemy;
    document.getElementById('enemy-name').oninput = e => {
        enemy.name = e.target.value;
        enemy.id = e.target.value
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
        updateEnemyCreatorPreview();
    };
    document.getElementById('enemy-sprite-name').oninput = e => {
        enemy.spriteName = e.target.value;
        updateEnemyCreatorPreview();
    };
    document.getElementById('enemy-moveSpeed').oninput = e => { enemy.moveSpeed = parseFloat(e.target.value); updateEnemyCreatorPreview(); };
    document.getElementById('enemy-distance').oninput = e => { enemy.distance = parseFloat(e.target.value); updateEnemyCreatorPreview(); };
    document.getElementById('enemy-maxHealth').oninput = e => { enemy.maxHealth = parseInt(e.target.value); updateEnemyCreatorPreview(); };
    document.getElementById('enemy-attack').oninput = e => { enemy.attack = parseInt(e.target.value); updateEnemyCreatorPreview(); };
    document.getElementById('enemy-defense').oninput = e => { enemy.defense = parseInt(e.target.value); updateEnemyCreatorPreview(); };
    document.getElementById('enemy-speed').oninput = e => { enemy.speed = parseFloat(e.target.value); updateEnemyCreatorPreview(); };
    document.getElementById('enemy-xpGain').oninput = e => { enemy.xpGain = parseInt(e.target.value); updateEnemyCreatorPreview(); };
    renderEnemyLootList();
    attachEnemyLootListeners();
    document.getElementById('enemy-map-number').oninput = e => {
        enemy.mapNumber = parseInt(e.target.value) || 0;
        updateEnemyCreatorPreview();
    };
    document.getElementById('enemy-set-spawn-btn').onclick = function() {
        enemySpawnSelectionStep = 1;
        enemySpawnFirstCorner = null;
        enemyCurrentWanderArea = null;
        updateEnemySpawnPrompt();
    };

    document.getElementById('confirm-enemy-btn').onclick = () => {
        const enemyCopy = JSON.parse(JSON.stringify(enemyCreatorState.enemy));
        savedEnemies.push(enemyCopy);
        renderSavedEnemies();
        renderEnemyDownloadButtons();
        clearEnemyInputs();
        updateEnemyCreatorPreview();
    };
}

function updateEnemySpawnPrompt() {
    const previewDiv = document.getElementById('enemy-spawn-preview');
    if (!previewDiv) return;
    switch (enemySpawnSelectionStep) {
        case 1:
            previewDiv.textContent = "Step 1: Click the TOP-LEFT tile for the enemy's wander area.";
            break;
        case 2:
            previewDiv.textContent = "Step 2: Click the BOTTOM-RIGHT tile for the wander area.";
            break;
        case 3:
            previewDiv.textContent = "Step 3: Click a tile INSIDE the wander area for the spawn location.";
            break;
        default:
            previewDiv.textContent = "";
    }
}

function renderSavedEnemies() {
    renderSavedList({
        listElId: 'saved-enemies-list',
        getItems: () => savedEnemies,
        rowClass: 'saved-enemy-row',
        editBtnClass: 'edit-enemy-btn',
        deleteBtnClass: 'delete-enemy-btn',
        emptyMessage: 'No enemies saved yet.',
        label: enemy => enemy.name || "(Unnamed Enemy)",
        toolKey: 'enemy',
        setDraft: item => { enemyCreatorState.enemy = item; },
        onEdit: () => {
            updateEnemyCreatorPreview();
            renderEnemyDownloadButtons();
        },
        onDelete: () => {
            renderEnemyDownloadButtons();
            if (typeof drawMap === "function") drawMap();
        }
    });
}

function renderEnemyDownloadButtons() {
    renderDownloadButtons('enemy-download-buttons', [
        {
            id: 'download-enemy-defs', label: 'Download Enemy Definitions', filename: 'enemy_definitions.js',
            buildCode: () => savedEnemies.map(enemy => getEnemyDefinitionCode(enemy)).join("\n\n")
        }
    ]);
}

function getEnemyDefinitionCode(enemy) {
    return `${enemy.id}: {
    id: "${enemy.id}",
    name: "${enemy.name}",
    sprite: "assets/img/enemy/${enemy.spriteName}.png",
    moveSpeed: ${enemy.moveSpeed},
    distance: ${enemy.distance},
    maxHealth: ${enemy.maxHealth},
    attack: ${enemy.attack},
    defense: ${enemy.defense},
    speed: ${enemy.speed},
    xpGain: ${enemy.xpGain},
    loot: [
${(enemy.loot || []).map(l => `        { item: "${l.item}", chance: ${l.chance}, amount: [${Array.isArray(l.amount) ? l.amount.join(', ') : l.amount}] }`).join(",\n")}
    ],
    spawns: [
${(enemy.spawns || []).map(s => `        { map: ${typeof s.map === "string" ? `"${s.map}"` : s.map}, x: ${s.x}, y: ${s.y}, wanderArea: { x1: ${s.wanderArea.x1}, y1: ${s.wanderArea.y1}, x2: ${s.wanderArea.x2}, y2: ${s.wanderArea.y2} } }`).join(",\n")}
    ]
},`;
}

function clearEnemyInputs() {
    enemyCreatorState.enemy = {
        id: "",
        name: "",
        spriteName: "",
        moveSpeed: 1.0,
        distance: 3,
        maxHealth: 20,
        attack: 5,
        defense: 2,
        speed: 1,
        xpGain: 10,
        loot: [],
        mapNumber: 0,
        spawns: []
    };
    showToolOptions("enemy");
}

function updateEnemyCreatorPreview() {
    document.getElementById('enemy-def-preview').textContent = getEnemyDefinitionCode(enemyCreatorState.enemy);
}

function attachTriggerCreatorListeners() {
    const t = triggerCreatorState.trigger;
    document.getElementById('trigger-id').oninput = e => { t.id = e.target.value.trim(); updateTriggerCreatorPreview(); };
    document.getElementById('trigger-map-number').oninput = e => { t.mapNumber = parseInt(e.target.value) || 0; updateTriggerCreatorPreview(); };
    document.getElementById('trigger-type').onchange = e => { t.type = e.target.value; updateTriggerCreatorPreview(); };
    document.getElementById('trigger-onetime').onchange = e => { t.oneTime = e.target.checked; updateTriggerCreatorPreview(); };
    document.getElementById('trigger-sound-enabled').onchange = e => {
        t.sound.enabled = e.target.checked;
        document.getElementById('trigger-sound-fields').style.display = e.target.checked ? "block" : "none";
        updateTriggerCreatorPreview();
    };
    document.getElementById('trigger-sound-file').oninput = e => { t.sound.file = e.target.value.trim(); updateTriggerCreatorPreview(); };
    document.getElementById('trigger-sound-type').onchange = e => { t.sound.type = e.target.value; updateTriggerCreatorPreview(); };
    document.getElementById('trigger-dialogue').oninput = e => {
        t.dialogue = e.target.value.split('\n').map(line => line.trim()).filter(Boolean);
        updateTriggerCreatorPreview();
    };
    document.getElementById('trigger-set-location-btn').onclick = () => {
        triggerSelectionStep = 1;
        updateTriggerPrompt();
    };
    document.getElementById('confirm-trigger-btn').onclick = () => {
        if (typeof t.x !== "number" || typeof t.y !== "number") {
            updateTriggerPrompt("Please set a trigger tile on the map first.");
            return;
        }
        savedTriggers.push(JSON.parse(JSON.stringify(t)));
        renderSavedTriggers();
        renderTriggerDownloadButtons();
        clearTriggerInputs();
        updateTriggerCreatorPreview();
        updateTriggerPrompt();
        if (typeof drawMap === "function") drawMap();
    };
}

function clearTriggerInputs() {
    triggerCreatorState.trigger = {
        id: "",
        mapNumber: 0,
        x: null,
        y: null,
        type: "dialogue",
        sound: { enabled: false, file: "", type: "ambient" },
        dialogue: [],
        oneTime: false,
        rewards: []
    };
    showToolOptions("trigger");
}

function updateTriggerPrompt(text) {
    const el = document.getElementById('trigger-location-preview');
    if (!el) return;
    if (text) { el.textContent = text; return; }
    el.textContent = triggerSelectionStep === 1
        ? "Click/tap a tile on the map to set trigger location."
        : (typeof triggerCreatorState.trigger.x === "number"
            ? `Location set: (${triggerCreatorState.trigger.x}, ${triggerCreatorState.trigger.y})`
            : "");
}

function renderTriggerRewardsList() {
    const rewards = triggerCreatorState.trigger.rewards || [];
    const listDiv = document.getElementById('trigger-rewards-list');
    if (!listDiv) return;
    listDiv.innerHTML = rewards.map((r, i) => `
        <div class="trigger-reward-row" data-idx="${i}" style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
            <input type="text" class="trigger-reward-id" value="${r.id || ''}" placeholder="Item ID" style="width:160px;">
            <input type="number" class="trigger-reward-amount" value="${r.amount || 1}" min="1" style="width:60px;">
            <button type="button" class="remove-trigger-reward-btn">Remove</button>
        </div>
    `).join("");
}

function attachTriggerRewardListeners() {
    const list = document.getElementById('trigger-rewards-list');
    if (!list) return;
    list.querySelectorAll('.trigger-reward-id, .trigger-reward-amount').forEach(input => {
        input.oninput = () => {
            const rewards = [];
            list.querySelectorAll('.trigger-reward-row').forEach(row => {
                const id = row.querySelector('.trigger-reward-id').value.trim();
                const amount = Number(row.querySelector('.trigger-reward-amount').value) || 1;
                if (id) rewards.push({ id, amount });
            });
            triggerCreatorState.trigger.rewards = rewards;
            updateTriggerCreatorPreview();
        };
    });
    list.querySelectorAll('.remove-trigger-reward-btn').forEach(btn => {
        btn.onclick = () => {
            btn.parentElement.remove();
            list.querySelector('.trigger-reward-id')?.dispatchEvent(new Event('input'));
        };
    });
    const addBtn = document.getElementById('add-trigger-reward-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            const newRow = document.createElement('div');
            newRow.className = 'trigger-reward-row';
            newRow.style = "display:flex; gap:8px; align-items:center; margin-bottom:4px;";
            newRow.innerHTML = `
                <input type="text" class="trigger-reward-id" placeholder="Item ID" style="width:160px;">
                <input type="number" class="trigger-reward-amount" value="1" min="1" style="width:60px;">
                <button type="button" class="remove-trigger-reward-btn">Remove</button>
            `;
            list.appendChild(newRow);
            attachTriggerRewardListeners();
        };
    }
}

function renderSavedTriggers() {
    renderSavedList({
        listElId: 'saved-triggers-list',
        getItems: () => savedTriggers,
        rowClass: 'saved-trigger-row',
        editBtnClass: 'edit-trigger-btn',
        deleteBtnClass: 'delete-trigger-btn',
        emptyMessage: 'No trigger tiles saved yet.',
        label: trig => trig.id || "(Unnamed Trigger)",
        toolKey: 'trigger',
        setDraft: item => { triggerCreatorState.trigger = item; },
        onEdit: () => {
            updateTriggerCreatorPreview();
            renderTriggerDownloadButtons();
        },
        onDelete: () => {
            renderTriggerDownloadButtons();
            if (typeof drawMap === "function") drawMap();
        }
    });
}

function renderTriggerDownloadButtons() {
    renderDownloadButtons('trigger-download-buttons', [
        {
            id: 'download-trigger-defs', label: 'Download Trigger Tile Definitions', filename: 'trigger_definitions.js',
            buildCode: () => savedTriggers.map(trig => getTriggerDefinitionCode(trig)).join("\n\n")
        }
    ]);
}

function getTriggerDefinitionCode(trig) {
    let rewardsStr = trig.rewards && trig.rewards.length
        ? `,\n    rewards: [${trig.rewards.map(r => `{ id: "${r.id}", amount: ${r.amount} }`).join(", ")}]`
        : "";
    let soundStr = trig.sound && trig.sound.enabled && trig.sound.file
        ? `,\n    sound: { enabled: true, file: "${trig.sound.file}.mp3", type: "${trig.sound.type}" }`
        : "";
    let dialogueStr = trig.dialogue && trig.dialogue.length
        ? `,\n    dialogue: [\n${trig.dialogue.map(line => `        "${line}"`).join(",\n")}\n    ]`
        : "";
    return `${trig.id}: {
    id: "${trig.id}",
    map: ${trig.mapNumber},
    x: ${trig.x},
    y: ${trig.y},
    type: "${trig.type}"${dialogueStr}${soundStr}${rewardsStr}${trig.oneTime ? ",\n    oneTime: true" : ""}
},`;
}

function updateTriggerCreatorPreview() {
    const t = triggerCreatorState.trigger;
    let rewardsStr = t.rewards && t.rewards.length
        ? `\n  rewards: [${t.rewards.map(r => `{ id: "${r.id}", amount: ${r.amount} }`).join(", ")}],`
        : "";
    let soundStr = t.sound && t.sound.enabled && t.sound.file
        ? `\n  sound: { enabled: true, file: "${t.sound.file}.mp3", type: "${t.sound.type}" },`
        : "";
    let oneTimeStr = t.oneTime ? `\n  oneTime: true,` : "";
    let dialogueStr = t.dialogue && t.dialogue.length
        ? `\n  dialogue: [\n${t.dialogue.map(line => `    "${line}"`).join(",\n")}\n  ],`
        : "";
    let preview =
`{
  id: "${t.id}",
  map: ${t.mapNumber},
  x: ${t.x},
  y: ${t.y},
  type: "${t.type}",${dialogueStr}${soundStr}${rewardsStr}${oneTimeStr}
}`;
    const previewEl = document.getElementById('trigger-def-preview');
    if (previewEl) previewEl.textContent = preview;
}


function attachInteractCreatorListeners() {
    const t = interactCreatorState.tile;

    const useSpriteEl = document.getElementById('inter-use-sprite');
    const staticFields = document.getElementById('inter-static-fields');
    const spriteFields = document.getElementById('inter-sprite-fields');
    const sndEnabledEl = document.getElementById('inter-sound-enabled');
    const sndFields = document.getElementById('inter-sound-fields');

    document.getElementById('inter-id').oninput = e => { t.id = e.target.value.trim(); updateInteractCreatorPreview(); };
    document.getElementById('inter-map-number').oninput = e => { t.mapNumber = parseInt(e.target.value) || 0; updateInteractCreatorPreview(); };
    document.getElementById('inter-set-location-btn').onclick = () => { interactSelectionStep = 1; updateInteractPrompt(); };

    useSpriteEl.onchange = e => {
        t.useSprite = e.target.checked;
        staticFields.style.display = t.useSprite ? "none" : "block";
        spriteFields.style.display = t.useSprite ? "block" : "none";
        updateInteractCreatorPreview();
    };

    // Visual fields
    document.getElementById('inter-image').oninput = e => { t.image = e.target.value.trim(); updateInteractCreatorPreview(); };
    document.getElementById('inter-spriteSheet').oninput = e => { t.spriteSheet = e.target.value.trim(); updateInteractCreatorPreview(); };
    document.getElementById('inter-imageW').oninput = e => { t.imageW = parseInt(e.target.value) || 0; updateInteractCreatorPreview(); };
    document.getElementById('inter-imageH').oninput = e => { t.imageH = parseInt(e.target.value) || 0; updateInteractCreatorPreview(); };
    document.getElementById('inter-rows').oninput = e => { t.rows = parseInt(e.target.value) || 1; updateInteractCreatorPreview(); };
    document.getElementById('inter-cols').oninput = e => { t.cols = parseInt(e.target.value) || 1; updateInteractCreatorPreview(); };
    document.getElementById('inter-animSpeed').oninput = e => { t.animSpeed = parseInt(e.target.value) || 1; updateInteractCreatorPreview(); };
    document.getElementById('inter-animOnTrigger').onchange = e => { t.animOnTrigger = e.target.checked; updateInteractCreatorPreview(); };

    // Gameplay
    document.getElementById('inter-collision').onchange = e => { t.collision = e.target.checked; updateInteractCreatorPreview(); };
    document.getElementById('inter-zIndex').onchange = e => { t.zIndex = parseInt(e.target.value) || 0; updateInteractCreatorPreview(); };
    document.getElementById('inter-notification').oninput = e => { t.notification = e.target.value; updateInteractCreatorPreview(); };

    // Sound
    sndEnabledEl.onchange = e => {
        t.sound.enabled = e.target.checked;
        sndFields.style.display = e.target.checked ? "block" : "none";
        updateInteractCreatorPreview();
    };
    document.getElementById('inter-sound-file').oninput = e => { t.sound.file = e.target.value.trim(); updateInteractCreatorPreview(); };
    document.getElementById('inter-sound-type').onchange = e => { t.sound.type = e.target.value; updateInteractCreatorPreview(); };

    // Dialogue
    document.getElementById('inter-dialogue').oninput = e => {
        t.dialogue = e.target.value.split('\n').map(s => s.trim()).filter(Boolean);
        updateInteractCreatorPreview();
    };

    // Confirm
    document.getElementById('confirm-interact-btn').onclick = () => {
        if (typeof t.x !== "number" || typeof t.y !== "number") {
            updateInteractPrompt("Please set the tile location on the map first.");
            return;
        }
        savedInteractTiles.push(JSON.parse(JSON.stringify(t)));
        renderSavedInteractTiles();
        renderInteractDownloadButtons();
        clearInteractInputs();
        updateInteractCreatorPreview();
        updateInteractPrompt();
        if (typeof drawMap === "function") drawMap();
    };
}

function updateInteractPrompt(text) {
    const el = document.getElementById('inter-location-preview');
    if (!el) return;
    if (text) { el.textContent = text; return; }
    el.textContent = interactSelectionStep === 1
        ? "Click/tap a tile on the map to set this interactable's location."
        : (typeof interactCreatorState.tile.x === "number"
            ? `Location set: (${interactCreatorState.tile.x}, ${interactCreatorState.tile.y})`
            : "");
}

function renderInteractRewardsList() {
    const rewards = interactCreatorState.tile.rewards || [];
    const listDiv = document.getElementById('inter-rewards-list');
    if (!listDiv) return;
    listDiv.innerHTML = rewards.map((r, i) => `
        <div class="inter-reward-row" data-idx="${i}" style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
            <input type="text" class="inter-reward-id" value="${r.id || ''}" placeholder="Item ID" style="width:160px;">
            <input type="number" class="inter-reward-amount" value="${r.amount || 1}" min="1" style="width:60px;">
            <button type="button" class="remove-inter-reward-btn">Remove</button>
        </div>
    `).join("");
}

function attachInteractRewardListeners() {
    const list = document.getElementById('inter-rewards-list');
    if (!list) return;
    const update = () => {
        const rewards = [];
        list.querySelectorAll('.inter-reward-row').forEach(row => {
            const id = row.querySelector('.inter-reward-id').value.trim();
            const amount = Number(row.querySelector('.inter-reward-amount').value) || 1;
            if (id) rewards.push({ id, amount });
        });
        interactCreatorState.tile.rewards = rewards;
        updateInteractCreatorPreview();
    };
    list.querySelectorAll('.inter-reward-id, .inter-reward-amount').forEach(inp => inp.oninput = update);
    list.querySelectorAll('.remove-inter-reward-btn').forEach(btn => {
        btn.onclick = () => { btn.parentElement.remove(); update(); };
    });
    const addBtn = document.getElementById('add-inter-reward-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            const newRow = document.createElement('div');
            newRow.className = 'inter-reward-row';
            newRow.style = "display:flex; gap:8px; align-items:center; margin-bottom:4px;";
            newRow.innerHTML = `
                <input type="text" class="inter-reward-id" placeholder="Item ID" style="width:160px;">
                <input type="number" class="inter-reward-amount" value="1" min="1" style="width:60px;">
                <button type="button" class="remove-inter-reward-btn">Remove</button>
            `;
            list.appendChild(newRow);
            attachInteractRewardListeners();
        };
    }
}

function renderSavedInteractTiles() {
    renderSavedList({
        listElId: 'saved-interacts-list',
        getItems: () => savedInteractTiles,
        rowClass: 'saved-inter-row',
        editBtnClass: 'edit-inter-btn',
        deleteBtnClass: 'delete-inter-btn',
        emptyMessage: 'No interactable tiles saved yet.',
        label: it => it.id || "(Unnamed Interactable)",
        toolKey: 'interact',
        setDraft: item => { interactCreatorState.tile = item; },
        onEdit: () => {
            updateInteractCreatorPreview();
            renderInteractDownloadButtons();
        },
        onDelete: () => {
            renderInteractDownloadButtons();
            if (typeof drawMap === "function") drawMap();
        }
    });
}

function renderInteractDownloadButtons() {
    renderDownloadButtons('interact-download-buttons', [
        {
            id: 'download-interact-defs', label: 'Download Interactable Tile Definitions', filename: 'interact_definitions.js',
            buildCode: () => savedInteractTiles.map(t => getInteractDefinitionCode(t)).join("\n\n")
        }
    ]);
}

function getInteractDefinitionCode(t) {
    const baseFields = [
        `id: "${t.id}"`,
        `map: ${t.mapNumber}`,
        `x: ${t.x}`,
        `y: ${t.y}`
    ];
    let visual = "";
    if (t.useSprite) {
        visual = `,
    spriteSheet: "${t.spriteSheet}",
    imageW: ${t.imageW},
    imageH: ${t.imageH},
    rows: ${t.rows},
    cols: ${t.cols},
    animOnTrigger: ${!!t.animOnTrigger},
    animSpeed: ${t.animSpeed}`;
    } else if (t.image) {
        visual = `,
    image: "${t.image}"`;
    }
    let gameplay = `,
    collision: ${!!t.collision},
    zIndex: ${t.zIndex}${t.notification ? `,\n    notification: "${t.notification.replace(/"/g, '\\"')}"` : ""}`;

    let dialogueStr = t.dialogue && t.dialogue.length
        ? `,\n    dialogue: [\n${t.dialogue.map(line => `        "${line.replace(/"/g, '\\"')}"`).join(",\n")}\n    ]`
        : "";

    let rewardsStr = t.rewards && t.rewards.length
        ? `,\n    rewards: [${t.rewards.map(r => `{ id: "${r.id}", amount: ${r.amount} }`).join(", ")}]`
        : "";

    let soundStr = (t.sound && t.sound.enabled && t.sound.file)
        ? `,\n    sound: { enabled: true, file: "${t.sound.file}.mp3", type: "${t.sound.type}" }`
        : "";

    return `${t.id}: {
    ${baseFields.join(",\n    ")}${visual}${gameplay}${dialogueStr}${rewardsStr}${soundStr}
},`;
}

function updateInteractCreatorPreview() {
    const t = interactCreatorState.tile;
    let visual = "";
    if (t.useSprite) {
        visual = `\n  spriteSheet: "${t.spriteSheet}",\n  imageW: ${t.imageW},\n  imageH: ${t.imageH},\n  rows: ${t.rows},\n  cols: ${t.cols},\n  animOnTrigger: ${!!t.animOnTrigger},\n  animSpeed: ${t.animSpeed},`;
    } else if (t.image) {
        visual = `\n  image: "${t.image}",`;
    }
    let gameplay = `\n  collision: ${!!t.collision},\n  zIndex: ${t.zIndex}${t.notification ? `,\n  notification: "${t.notification.replace(/"/g, '\\"')}",` : ","}`;
    let dialogueStr = t.dialogue && t.dialogue.length ? `\n  dialogue: [\n${t.dialogue.map(d => `    "${d.replace(/"/g, '\\"')}"`).join(",\n")}\n  ],` : "";
    let rewardsStr = t.rewards && t.rewards.length ? `\n  rewards: [${t.rewards.map(r => `{ id: "${r.id}", amount: ${r.amount} }`).join(", ")}],` : "";
    let soundStr = (t.sound && t.sound.enabled && t.sound.file) ? `\n  sound: { enabled: true, file: "${t.sound.file}.mp3", type: "${t.sound.type}" },` : "";
    const preview =
`{
  id: "${t.id}",
  map: ${t.mapNumber},
  x: ${t.x},
  y: ${t.y},${visual}${gameplay}${dialogueStr}${rewardsStr}${soundStr}
}`;
    const el = document.getElementById('inter-def-preview');
    if (el) el.textContent = preview;
}

function clearInteractInputs() {
    interactCreatorState.tile = {
        id: "",
        mapNumber: 0,
        x: null,
        y: null,
        useSprite: false,
        image: "",
        spriteSheet: "",
        imageW: 0,
        imageH: 0,
        rows: 1,
        cols: 1,
        animSpeed: 6,
        animOnTrigger: false,
        collision: false,
        zIndex: 0,
        notification: "",
        dialogue: [],
        rewards: [],
        sound: { enabled: false, file: "", type: "trigger" }
    };
    showToolOptions("interact");
}


function attachWorldSpriteCreatorListeners() {
    const s = worldSpriteCreatorState.sprite;
    document.getElementById('ws-id').oninput = e => { s.id = e.target.value.trim(); updateWorldSpritePreview(); };
    document.getElementById('ws-image-name').oninput = e => { s.imageName = e.target.value.trim(); updateWorldSpritePreview(); };
    document.getElementById('ws-imageW').oninput = e => { s.imageW = parseInt(e.target.value) || 0; updateWorldSpritePreview(); };
    document.getElementById('ws-imageH').oninput = e => { s.imageH = parseInt(e.target.value) || 0; updateWorldSpritePreview(); };
    document.getElementById('ws-rows').oninput = e => { s.rows = parseInt(e.target.value) || 1; updateWorldSpritePreview(); };
    document.getElementById('ws-cols').oninput = e => { s.cols = parseInt(e.target.value) || 1; updateWorldSpritePreview(); };
    document.getElementById('ws-row').oninput = e => { s.row = parseInt(e.target.value) || 0; updateWorldSpritePreview(); };
    document.getElementById('ws-animSpeed').oninput = e => { s.animSpeed = parseInt(e.target.value) || 0; updateWorldSpritePreview(); };
    document.getElementById('ws-zIndex').onchange = e => { s.zIndex = parseInt(e.target.value) || 0; updateWorldSpritePreview(); };
    document.getElementById('ws-collision').onchange = e => { s.collision = e.target.checked; updateWorldSpritePreview(); };
    document.getElementById('ws-position-map').oninput = e => { s.positionMap = e.target.value; };

    document.getElementById('ws-add-position-btn').onclick = () => {
        spriteSelectionStep = 1;
        updateWorldSpritePositionPrompt();
    };

    document.getElementById('ws-confirm-btn').onclick = () => {
        if (!s.id) return;
        if (!s.imageName) return;
        const copy = JSON.parse(JSON.stringify(s));
        savedWorldSprites.push(copy);
        renderSavedWorldSprites();
        renderSpriteDownloadButtons();
        clearWorldSpriteInputs();
        updateWorldSpritePreview();
        if (typeof drawMap === "function") drawMap();
    };
}

function updateWorldSpritePositionPrompt(text) {
    const el = document.getElementById('ws-position-prompt');
    if (!el) return;
    if (text) { el.textContent = text; return; }
    el.textContent = spriteSelectionStep === 1
        ? "Click/tap a tile on the map to add a position."
        : "";
}

function renderWorldSpritePositionsList() {
    const s = worldSpriteCreatorState.sprite;
    const list = document.getElementById('ws-positions-list');
    if (!list) return;
    if (!s.positions.length) {
        list.innerHTML = "<i>No positions added yet.</i>";
        return;
    }
    list.innerHTML = s.positions.map((p, i) => `
        <div class="ws-pos-row" data-idx="${i}" style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
            <span>[map: ${typeof p.map === "string" ? p.map : p.map}, x: ${p.x}, y: ${p.y}]</span>
            <button type="button" class="ws-pos-remove">Remove</button>
        </div>
    `).join("");
    list.querySelectorAll('.ws-pos-remove').forEach(btn => {
        btn.onclick = () => {
            const idx = Number(btn.parentElement.dataset.idx);
            worldSpriteCreatorState.sprite.positions.splice(idx, 1);
            renderWorldSpritePositionsList();
            updateWorldSpritePreview();
            if (typeof drawMap === "function") drawMap();
        };
    });
}

function updateWorldSpritePreview() {
    const s = worldSpriteCreatorState.sprite;
    const spriteSheetPath = s.imageName ? `assets/img/worldSprites/${s.imageName}.png` : "";
    const positionsStr = (s.positions || []).map(p => 
        `    { map: ${typeof p.map === "string" ? `"${p.map}"` : p.map}, x: ${p.x}, y: ${p.y} }`
    ).join(",\n");
    const rowStr = s.row ? `\n  row: ${s.row},` : "";
    const preview =
`{
  id: "${s.id}",
  positions: [
${positionsStr}
  ],
  spriteSheet: "${spriteSheetPath}",
  imageW: ${s.imageW},
  imageH: ${s.imageH},
  rows: ${s.rows},
  cols: ${s.cols},${rowStr}
  animSpeed: ${s.animSpeed},
  zIndex: ${s.zIndex},
  collision: ${!!s.collision}
}`;
    const el = document.getElementById('ws-def-preview');
    if (el) el.textContent = preview;
}

function clearWorldSpriteInputs() {
    worldSpriteCreatorState.sprite = {
        id: "",
        imageName: "",
        imageW: 0,
        imageH: 0,
        rows: 1,
        cols: 1,
        row: 0,
        animSpeed: 0,
        zIndex: 0,
        collision: false,
        positions: [],
        positionMap: ""
    };
    showToolOptions("sprite");
}

function renderSavedWorldSprites() {
    renderSavedList({
        listElId: 'saved-sprites-list',
        getItems: () => savedWorldSprites,
        rowClass: 'saved-ws-row',
        editBtnClass: 'edit-ws-btn',
        deleteBtnClass: 'delete-ws-btn',
        emptyMessage: 'No world sprites saved yet.',
        label: ws => ws.id || "(Unnamed World Sprite)",
        toolKey: 'sprite',
        setDraft: item => { worldSpriteCreatorState.sprite = item; },
        onEdit: () => {
            updateWorldSpritePreview();
            renderSpriteDownloadButtons();
        },
        onDelete: () => {
            renderSpriteDownloadButtons();
            if (typeof drawMap === "function") drawMap();
        }
    });
}

function renderSpriteDownloadButtons() {
    renderDownloadButtons('sprite-download-buttons', [
        {
            id: 'download-ws-defs', label: 'Download World Sprite Definitions', filename: 'world_sprite_definitions.js',
            buildCode: () => savedWorldSprites.map(ws => getWorldSpriteDefinitionCode(ws)).join("\n\n")
        }
    ]);
}

function getWorldSpriteDefinitionCode(ws) {
    const spriteSheetPath = ws.imageName ? `assets/img/worldSprites/${ws.imageName}.png` : "";
    const positionsStr = (ws.positions || []).map(p =>
        `        { map: ${typeof p.map === "string" ? `"${p.map}"` : p.map}, x: ${p.x}, y: ${p.y} }`
    ).join(",\n");
    const rowStr = ws.row ? `\n    row: ${ws.row},` : "";
    return `${ws.id}: {
    id: "${ws.id}",
    positions: [
${positionsStr}
    ],
    spriteSheet: "${spriteSheetPath}",
    imageW: ${ws.imageW},
    imageH: ${ws.imageH},
    rows: ${ws.rows},
    cols: ${ws.cols},${rowStr}
    animSpeed: ${ws.animSpeed},
    zIndex: ${ws.zIndex},
    collision: ${!!ws.collision}
},`;
}

function attachItemCreatorListeners() {
    const it = itemCreatorState.item;
    const nameEl = document.getElementById('item-name');
    const descEl = document.getElementById('item-description');
    const rarEl = document.getElementById('item-rarity');
    const stkEl = document.getElementById('item-stackable');
    const useEl = document.getElementById('item-useable');
    const remEl = document.getElementById('item-removeable');
    const imgEl = document.getElementById('item-image-name');
    const sndEn = document.getElementById('item-sound-enabled');
    const sndFile = document.getElementById('item-sound-file');

    nameEl.oninput = e => {
        it.name = e.target.value;
        it.id = normalizeIdFromName(it.name);
        updateItemPreview();
    };
    descEl.oninput = e => { it.description = e.target.value; updateItemPreview(); };
    rarEl.onchange = e => { it.rarity = e.target.value; updateItemPreview(); };
    stkEl.onchange = e => { it.stackable = e.target.checked; updateItemPreview(); };
    useEl.onchange = e => { it.useable = e.target.checked; updateItemPreview(); };
    remEl.onchange = e => { it.removeable = e.target.checked; updateItemPreview(); };
    imgEl.oninput = e => { it.imageName = e.target.value.trim(); updateItemPreview(); };
    sndEn.onchange = e => { it.sound.enabled = e.target.checked; updateItemPreview(); };
    sndFile.oninput = e => { it.sound.file = e.target.value.trim(); updateItemPreview(); };

    const homeEn = document.getElementById('item-home-placeable');
    const homeFieldsEl = document.getElementById('item-homedef-fields');
    homeEn.onchange = e => {
        it.homePlaceable = e.target.checked;
        homeFieldsEl.style.display = it.homePlaceable ? 'flex' : 'none';
        updateItemPreview();
    };
    document.getElementById('item-home-sprite').oninput = e => { it.homeDef.spriteSheetOverride = e.target.value.trim(); updateItemPreview(); };
    document.getElementById('item-home-w').oninput = e => { it.homeDef.imageW = parseInt(e.target.value, 10) || 0; updateItemPreview(); };
    document.getElementById('item-home-h').oninput = e => { it.homeDef.imageH = parseInt(e.target.value, 10) || 0; updateItemPreview(); };
    document.getElementById('item-home-rows').oninput = e => { it.homeDef.rows = parseInt(e.target.value, 10) || 1; updateItemPreview(); };
    document.getElementById('item-home-cols').oninput = e => { it.homeDef.cols = parseInt(e.target.value, 10) || 1; updateItemPreview(); };
    document.getElementById('item-home-animspeed').oninput = e => { it.homeDef.animSpeed = parseInt(e.target.value, 10) || 0; updateItemPreview(); };
    document.getElementById('item-home-zindex').oninput = e => { it.homeDef.zIndex = parseInt(e.target.value, 10) || 0; updateItemPreview(); };
    document.getElementById('item-home-footprint-w').oninput = e => { it.homeDef.footprintW = parseInt(e.target.value, 10) || 1; updateItemPreview(); };
    document.getElementById('item-home-footprint-h').oninput = e => { it.homeDef.footprintH = parseInt(e.target.value, 10) || 1; updateItemPreview(); };
    document.getElementById('item-home-collision').onchange = e => { it.homeDef.collision = e.target.checked; updateItemPreview(); };
    document.getElementById('item-home-stack').onchange = e => { it.homeDef.canStackOnPlaced = e.target.checked; updateItemPreview(); };

    document.getElementById('confirm-item-btn').onclick = () => {
        const copy = JSON.parse(JSON.stringify(itemCreatorState.item));
        savedItems.push(copy);
        renderSavedItems();
        renderItemDownloadButtons();
        clearItemInputs();
        updateItemPreview();
    };
}

// Shared by updateItemPreview() and getItemDefinitionCode() so the homePlaceable/homeDef
// block is generated identically in both places, just at different indent depths.
function buildHomeDefCode(it, indent, defaultImagePath) {
    if (!it.homePlaceable) return "";
    const spriteSheet = it.homeDef.spriteSheetOverride || defaultImagePath;
    return `,
${indent}homePlaceable: true,
${indent}homeDef: {
${indent}    spriteSheet: "${spriteSheet}",
${indent}    imageW: ${it.homeDef.imageW},
${indent}    imageH: ${it.homeDef.imageH},
${indent}    rows: ${it.homeDef.rows},
${indent}    cols: ${it.homeDef.cols},
${indent}    animSpeed: ${it.homeDef.animSpeed},
${indent}    zIndex: ${it.homeDef.zIndex},
${indent}    collision: ${!!it.homeDef.collision},
${indent}    canStackOnPlaced: ${!!it.homeDef.canStackOnPlaced},
${indent}    footprintW: ${it.homeDef.footprintW},
${indent}    footprintH: ${it.homeDef.footprintH}
${indent}}`;
}

function updateItemPreview() {
    const it = itemCreatorState.item;
    const imageBase = it.imageName || it.id;
    const imagePath = `assets/img/items/${imageBase}.png`;
    const soundStr = (it.sound.enabled && it.sound.file) ? `,\n  sound: '${it.sound.file}.mp3'` : "";
    const homeStr = buildHomeDefCode(it, "  ", imagePath);
    const preview =
`{
  id: "${it.id}",
  name: "${it.name}",
  description: "${(it.description || "").replace(/"/g, '\\"')}",
  image: "${imagePath}",
  rarity: "${it.rarity}",
  stackable: ${!!it.stackable},
  useable: ${!!it.useable},
  removeable: ${!!it.removeable}${soundStr}${homeStr}
}`;
    const el = document.getElementById('item-def-preview');
    if (el) el.textContent = preview;
}

function getItemDefinitionCode(it) {
    const imageBase = it.imageName || it.id;
    const imagePath = `assets/img/items/${imageBase}.png`;
    const soundStr = (it.sound && it.sound.enabled && it.sound.file) ? `,\n    sound: '${it.sound.file}.mp3'` : "";
    const homeStr = buildHomeDefCode(it, "    ", imagePath);
    return `${it.id}: {
    id: "${it.id}",
    name: "${it.name}",
    description: "${(it.description || "").replace(/"/g, '\\"')}",
    image: "${imagePath}",
    rarity: "${it.rarity}",
    stackable: ${!!it.stackable},
    useable: ${!!it.useable},
    removeable: ${!!it.removeable}${soundStr}${homeStr}
},`;
}

function clearItemInputs() {
    itemCreatorState.item = {
        id: "",
        name: "",
        description: "",
        imageName: "",
        rarity: "common",
        stackable: true,
        useable: false,
        removeable: true,
        sound: { enabled: false, file: "" },
        homePlaceable: false,
        homeDef: {
            spriteSheetOverride: "",
            imageW: 64,
            imageH: 64,
            rows: 1,
            cols: 1,
            animSpeed: 0,
            zIndex: 0,
            collision: true,
            canStackOnPlaced: false,
            footprintW: 1,
            footprintH: 1
        }
    };
    showToolOptions("item");
}

function renderSavedItems() {
    renderSavedList({
        listElId: 'saved-items-list',
        getItems: () => savedItems,
        rowClass: 'saved-item-row',
        editBtnClass: 'edit-item-btn',
        deleteBtnClass: 'delete-item-btn',
        emptyMessage: 'No items saved yet.',
        label: it => `${it.name || "(Unnamed Item)"} <span style="opacity:0.7;">(${it.id})</span>`,
        toolKey: 'item',
        setDraft: item => { itemCreatorState.item = item; },
        onEdit: () => {
            updateItemPreview();
            renderItemDownloadButtons();
        },
        onDelete: () => {
            renderItemDownloadButtons();
        }
    });
}

function renderItemDownloadButtons() {
    renderDownloadButtons('item-download-buttons', [
        {
            id: 'download-item-defs', label: 'Download Item Definitions', filename: 'item_definitions.js',
            buildCode: () => savedItems.map(it => getItemDefinitionCode(it)).join("\n\n")
        }
    ]);
}

function renderSkillStatsList(kind) { // kind: 'buffs' | 'drawbacks'
    const s = skillCreatorState.skill;
    const listDiv = document.getElementById(kind === 'buffs' ? 'skill-buffs-list' : 'skill-drawbacks-list');
    if (!listDiv) return;
    const arr = s[kind] || [];
    listDiv.innerHTML = arr.map((kv, i) => `
        <div class="skill-${kind}-row" data-idx="${i}" style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
            <input type="text" class="skill-${kind}-key" value="${kv.key || ''}" placeholder="stat key (e.g. attack, defence, speed)" style="width:220px;">
            <input type="number" class="skill-${kind}-value" value="${kv.value ?? 0}" step="1" style="width:100px;">
            <button type="button" class="remove-skill-${kind}-btn">Remove</button>
        </div>
    `).join("");

    // Attach listeners
    const sync = () => {
        const newArr = [];
        listDiv.querySelectorAll(`.skill-${kind}-row`).forEach(row => {
            const key = row.querySelector(`.skill-${kind}-key`).value.trim();
            const value = Number(row.querySelector(`.skill-${kind}-value`).value);
            if (key) newArr.push({ key, value });
        });
        s[kind] = newArr;
        updateSkillPreview();
    };
    listDiv.querySelectorAll(`.skill-${kind}-key, .skill-${kind}-value`).forEach(inp => inp.oninput = sync);
    listDiv.querySelectorAll(`.remove-skill-${kind}-btn`).forEach(btn => {
        btn.onclick = () => { btn.parentElement.remove(); sync(); };
    });

    const addBtnId = kind === 'buffs' ? 'add-skill-buff-btn' : 'add-skill-drawback-btn';
    const addBtn = document.getElementById(addBtnId);
    if (addBtn) {
        addBtn.onclick = () => {
            s[kind].push({ key: "", value: 0 });
            renderSkillStatsList(kind);
            updateSkillPreview();
        };
    }
}

function attachSkillCreatorListeners() {
    const s = skillCreatorState.skill;
    document.getElementById('skill-name').oninput = e => {
        s.name = e.target.value;
        s.id = normalizeIdFromName(s.name);
        updateSkillPreview();
    };
    document.getElementById('skill-description').oninput = e => { s.description = e.target.value; updateSkillPreview(); };
    document.getElementById('skill-pool').onchange = e => { s.pool = e.target.value; updateSkillPreview(); };
    document.getElementById('skill-chance').oninput = e => { s.chance = parseFloat(e.target.value) || 0; updateSkillPreview(); };
    document.getElementById('skill-maxLevel').oninput = e => { s.maxLevel = parseInt(e.target.value) || 1; updateSkillPreview(); };
    document.getElementById('skill-rarity').onchange = e => { s.rarity = e.target.value; updateSkillPreview(); };
    document.getElementById('skill-image-name').oninput = e => { s.imageName = e.target.value.trim(); updateSkillPreview(); };

    document.getElementById('confirm-skill-btn').onclick = () => {
        const copy = JSON.parse(JSON.stringify(skillCreatorState.skill));
        savedSkills.push(copy);
        renderSavedSkills();
        renderSkillDownloadButtons();
        clearSkillInputs();
        updateSkillPreview();
    };
}

function updateSkillPreview() {
    const s = skillCreatorState.skill;
    const imageBase = s.imageName || s.id;
    const buffsObjStr = (s.buffs || []).map(kv => `    ${kv.key}: ${kv.value}`).join(",\n");
    const drawObjStr = (s.drawbacks || []).map(kv => `    ${kv.key}: ${kv.value}`).join(",\n");
    const preview =
`{
  id: "${s.id}",
  name: "${s.name}",
  img: "assets/img/skills/${imageBase}.png",
  description: "${(s.description || "").replace(/"/g, '\\"')}",
  pool: "${s.pool}",
  chance: ${s.chance},
  buffs: {
${buffsObjStr}
  },
  drawbacks: {
${drawObjStr}
  },
  maxLevel: ${s.maxLevel},
  rarity: "${s.rarity}"
}`;
    const el = document.getElementById('skill-def-preview');
    if (el) el.textContent = preview;
}

function getSkillDefinitionCode(s) {
    const imageBase = s.imageName || s.id;
    const buffsObjStr = (s.buffs || []).map(kv => `        ${kv.key}: ${kv.value}`).join(",\n");
    const drawObjStr = (s.drawbacks || []).map(kv => `        ${kv.key}: ${kv.value}`).join(",\n");
    return `${s.id}: {
    id: "${s.id}",
    name: "${s.name}",
    img: "assets/img/skills/${imageBase}.png",
    description: "${(s.description || "").replace(/"/g, '\\"')}",
    pool: "${s.pool}",
    chance: ${s.chance},
    buffs: {
${buffsObjStr}
    },
    drawbacks: {
${drawObjStr}
    },
    maxLevel: ${s.maxLevel},
    rarity: "${s.rarity}"
},`;
}

function clearSkillInputs() {
    skillCreatorState.skill = {
        id: "",
        name: "",
        description: "",
        imageName: "",
        pool: "blue",
        chance: 1.0,
        maxLevel: 20,
        rarity: "common",
        buffs: [],
        drawbacks: []
    };
    showToolOptions("skill");
}

// Combines the live item catalog (fetched from GitHub into `definitions.items`)
// with any items created locally this session (`savedItems`), so the Trader
// Creator's item pickers cover both without needing item IDs typed by hand.
function getKnownItemOptions() {
    const map = {};
    Object.values(definitions.items || {}).forEach(it => { if (it && it.id) map[it.id] = it.name || it.id; });
    savedItems.forEach(it => { if (it && it.id) map[it.id] = it.name || it.id; });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}

// Same idea, for enemyDefeat-type quests: main.js actually does parse ENEMY_TYPES
// out of charactersData.js into definitions.enemies (it lives in the same file
// as NPC_DEFINITIONS), combined with any enemies saved locally this session.
function getKnownEnemyOptions() {
    const map = {};
    Object.values(definitions.enemies || {}).forEach(en => { if (en && en.id) map[en.id] = en.name || en.id; });
    savedEnemies.forEach(en => { if (en && en.id) map[en.id] = en.name || en.id; });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
}

// Same idea, for interactTiles-type quests: combines the live interact tile
// catalog with anything saved locally this session.
function getKnownInteractTileIds() {
    const set = new Set();
    (definitions.interactTiles || []).forEach(t => { if (t && t.id) set.add(t.id); });
    savedInteractTiles.forEach(t => { if (t && t.id) set.add(t.id); });
    return Array.from(set).sort();
}

// --- Consistency Checker ---
// Scans everything saved this session for dangling cross-references (an ID
// that's typed/stored somewhere but doesn't actually exist), duplicate IDs
// within a category (which would silently overwrite each other when pasted
// into the real *_DEFINITIONS object), and obviously incomplete entries.
// Deliberately does NOT try to verify that image/sound file paths actually
// exist on disk -- that's out of reach from the browser.
function runConsistencyCheck() {
    const issues = [];
    const add = (severity, category, label, message) => issues.push({ severity, category, label, message });

    const knownItemIds = new Set(getKnownItemOptions().map(([id]) => id));
    const knownEnemyIds = new Set(getKnownEnemyOptions().map(([id]) => id));
    const knownInteractTileIds = new Set(getKnownInteractTileIds());
    const knownTraderIds = new Set([
        ...Object.keys(definitions.traders || {}),
        ...savedTraders.map(t => t.id).filter(Boolean)
    ]);

    function checkRewards(rewards, category, label) {
        (rewards || []).forEach(r => {
            if (r && r.id && !knownItemIds.has(r.id)) {
                add('error', category, label, `Reward references unknown item "${r.id}"`);
            }
        });
    }

    function checkDuplicateIds(ids, category) {
        const counts = new Map();
        ids.forEach(id => { if (id) counts.set(id, (counts.get(id) || 0) + 1); });
        counts.forEach((count, id) => {
            if (count > 1) add('error', category, id, `Duplicate ID "${id}" used ${count} times -- later ones will silently overwrite earlier ones on export`);
        });
    }

    // ---- NPCs ----
    const npcIds = [];
    savedNpcs.forEach(npc => {
        const label = npc.name || "(unnamed NPC)";
        npcIds.push(npc.id || normalizeIdFromName(npc.name || ""));
        if (!npc.name) add('error', 'NPC', label, 'Missing name');
        if (npc.trader && !knownTraderIds.has(npc.trader)) {
            add('error', 'NPC', label, `References unknown trader "${npc.trader}"`);
        }
        if (npc.forcedEncounter && npc.forcedEncounter.enabled && (!npc.forcedEncounter.triggerTiles || !npc.forcedEncounter.triggerTiles.length)) {
            add('warning', 'NPC', label, 'Forced Encounter is enabled but has no trigger tiles selected');
        }
        if (npc.hasQuest) {
            const qLabel = `${label}'s quest`;
            if (!npc.questName) add('warning', 'NPC', qLabel, 'Quest has no name');
            let rewards = [];
            try { rewards = JSON.parse(npc.questRewards || "[]"); } catch (e) { /* ignore */ }
            if (!rewards.length) add('warning', 'NPC', qLabel, 'Quest has no rewards at all');
            checkRewards(rewards, 'NPC', qLabel);

            const qOpts = npc.questTypeOptions || {};
            if (npc.questType === 'itemCollect') {
                if (!qOpts.itemId) add('error', 'NPC', qLabel, 'Item Collect quest has no item selected');
                else if (!knownItemIds.has(qOpts.itemId)) add('error', 'NPC', qLabel, `References unknown item "${qOpts.itemId}"`);
            } else if (npc.questType === 'enemyDefeat') {
                if (!qOpts.enemyId) add('error', 'NPC', qLabel, 'Enemy Defeat quest has no enemy selected');
                else if (!knownEnemyIds.has(qOpts.enemyId)) add('error', 'NPC', qLabel, `References unknown enemy "${qOpts.enemyId}"`);
            } else if (npc.questType === 'interactTiles') {
                const tileIds = Array.isArray(qOpts.interactTileIds) ? qOpts.interactTileIds : [];
                if (!tileIds.length) add('error', 'NPC', qLabel, 'Interact Tiles quest has no tiles selected');
                tileIds.forEach(id => {
                    if (!knownInteractTileIds.has(id)) add('error', 'NPC', qLabel, `References unknown interact tile "${id}"`);
                });
            }
        }
    });
    checkDuplicateIds(npcIds, 'NPC');

    // ---- Enemies ----
    const enemyIds = [];
    savedEnemies.forEach(en => {
        const label = en.name || en.id || "(unnamed enemy)";
        enemyIds.push(en.id);
        if (!en.id) add('error', 'Enemy', label, 'Missing ID');
        (en.loot || []).forEach(l => {
            if (l.item && !knownItemIds.has(l.item)) add('error', 'Enemy', label, `Loot references unknown item "${l.item}"`);
        });
    });
    checkDuplicateIds(enemyIds, 'Enemy');

    // ---- Trigger Tiles ----
    const triggerIds = [];
    savedTriggers.forEach(t => {
        const label = t.id || "(unnamed trigger tile)";
        triggerIds.push(t.id);
        if (!t.id) add('error', 'Trigger Tile', label, 'Missing ID');
        checkRewards(t.rewards, 'Trigger Tile', label);
    });
    checkDuplicateIds(triggerIds, 'Trigger Tile');

    // ---- Interactable Tiles ----
    const interactIds = [];
    savedInteractTiles.forEach(t => {
        const label = t.id || "(unnamed interactable)";
        interactIds.push(t.id);
        if (!t.id) add('error', 'Interactable Tile', label, 'Missing ID');
        checkRewards(t.rewards, 'Interactable Tile', label);
    });
    checkDuplicateIds(interactIds, 'Interactable Tile');

    // ---- World Sprites ----
    const spriteIds = [];
    savedWorldSprites.forEach(s => {
        const label = s.id || "(unnamed world sprite)";
        spriteIds.push(s.id);
        if (!s.id) add('error', 'World Sprite', label, 'Missing ID');
    });
    checkDuplicateIds(spriteIds, 'World Sprite');

    // ---- Items ----
    const itemIds = [];
    savedItems.forEach(it => {
        const label = it.name || it.id || "(unnamed item)";
        itemIds.push(it.id);
        if (!it.id) add('error', 'Item', label, 'Missing ID');
        if (it.homePlaceable && (!it.homeDef || !it.homeDef.imageW || !it.homeDef.imageH)) {
            add('warning', 'Item', label, 'Home Placeable is enabled but image width/height look incomplete');
        }
    });
    checkDuplicateIds(itemIds, 'Item');

    // ---- Skills ----
    const skillIds = [];
    savedSkills.forEach(sk => {
        const label = sk.name || sk.id || "(unnamed skill)";
        skillIds.push(sk.id);
        if (!sk.id) add('error', 'Skill', label, 'Missing ID');
    });
    checkDuplicateIds(skillIds, 'Skill');

    // ---- Traders ----
    const traderIdsList = [];
    savedTraders.forEach(t => {
        const label = t.id || "(unnamed trader)";
        traderIdsList.push(t.id);
        if (!t.id) add('error', 'Trader', label, 'Missing ID');
        (t.buy || []).forEach(b => { if (b.id && !knownItemIds.has(b.id)) add('error', 'Trader', label, `Buy list references unknown item "${b.id}"`); });
        (t.sell || []).forEach(s => { if (s.id && !knownItemIds.has(s.id)) add('error', 'Trader', label, `Sell list references unknown item "${s.id}"`); });
    });
    checkDuplicateIds(traderIdsList, 'Trader');

    return issues;
}

function renderCheckResults() {
    const resultsDiv = document.getElementById('check-results');
    if (!resultsDiv) return;

    const issues = runConsistencyCheck();
    const totalEntries = savedNpcs.length + savedEnemies.length + savedTriggers.length +
        savedInteractTiles.length + savedWorldSprites.length + savedItems.length +
        savedSkills.length + savedTraders.length;

    if (!issues.length) {
        resultsDiv.innerHTML = `<div style="color:#4caf50; font-weight:bold;">✅ No issues found across ${totalEntries} saved entries.</div>`;
        return;
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    const grouped = {};
    issues.forEach(i => { (grouped[i.category] = grouped[i.category] || []).push(i); });

    resultsDiv.innerHTML = `
        <div style="margin-bottom:16px; font-size:1.05em;">
            ${errorCount ? `<span style="color:#e74c3c; font-weight:bold;">${errorCount} error${errorCount === 1 ? '' : 's'}</span>` : ''}
            ${errorCount && warningCount ? ' &nbsp;&middot;&nbsp; ' : ''}
            ${warningCount ? `<span style="color:#f1c40f; font-weight:bold;">${warningCount} warning${warningCount === 1 ? '' : 's'}</span>` : ''}
        </div>
        ${Object.entries(grouped).map(([category, catIssues]) => `
            <h4 style="margin-bottom:6px;">${category}</h4>
            ${catIssues.map(i => `
                <div style="background:#232634; border-left:4px solid ${i.severity === 'error' ? '#e74c3c' : '#f1c40f'}; border-radius:4px; padding:8px 12px; margin-bottom:6px;">
                    <b>${i.label}</b><br>
                    <span style="color:${i.severity === 'error' ? '#e74c3c' : '#f1c40f'};">${i.severity === 'error' ? 'Error' : 'Warning'}:</span> ${i.message}
                </div>
            `).join("")}
        `).join("")}
    `;
}

// Suggests the next free "traderN" id by looking at both the live trader
// catalog and anything saved locally this session -- just a convenience
// starting point, the ID field stays fully editable.
function suggestNextTraderId() {
    const ids = [
        ...Object.keys(definitions.traders || {}),
        ...savedTraders.map(t => t.id)
    ];
    let maxN = 0;
    ids.forEach(id => {
        const m = /^trader(\d+)$/.exec(id || "");
        if (m) maxN = Math.max(maxN, Number(m[1]));
    });
    return `trader${maxN + 1}`;
}

// Renders one of the two trader item lists (kind: 'buy' | 'sell'). Modeled
// on renderSkillStatsList's add/remove-row pattern, but with a <select> of
// known item IDs instead of a free-text key, so entries are far less likely
// to reference an item that doesn't actually exist.
function renderTraderList(kind) {
    const t = traderCreatorState.trader;
    const listDiv = document.getElementById(kind === 'buy' ? 'trader-buy-list' : 'trader-sell-list');
    if (!listDiv) return;
    const arr = t[kind] || [];
    const itemOptions = getKnownItemOptions();

    listDiv.innerHTML = arr.map((row, i) => {
        const knownIds = itemOptions.map(([id]) => id);
        const extraOption = (row.id && !knownIds.includes(row.id))
            ? `<option value="${row.id}" selected>${row.id} (not in catalog)</option>` : "";
        return `
        <div class="trader-${kind}-row" data-idx="${i}" style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
            <select class="trader-${kind}-id" style="width:280px;">
                <option value="">-- select item --</option>
                ${itemOptions.map(([id, name]) => `<option value="${id}" ${row.id === id ? "selected" : ""}>${id}${name && name !== id ? " — " + name : ""}</option>`).join("")}
                ${extraOption}
            </select>
            <input type="number" class="trader-${kind}-price" value="${row.price ?? 0}" min="0" step="1" style="width:100px;" placeholder="price">
            <button type="button" class="remove-trader-${kind}-btn">Remove</button>
        </div>`;
    }).join("");

    const sync = () => {
        const newArr = [];
        listDiv.querySelectorAll(`.trader-${kind}-row`).forEach(row => {
            const id = row.querySelector(`.trader-${kind}-id`).value;
            const price = Number(row.querySelector(`.trader-${kind}-price`).value) || 0;
            if (id) newArr.push({ id, price });
        });
        t[kind] = newArr;
        updateTraderPreview();
    };
    listDiv.querySelectorAll(`.trader-${kind}-id`).forEach(sel => sel.onchange = sync);
    listDiv.querySelectorAll(`.trader-${kind}-price`).forEach(inp => inp.oninput = sync);
    listDiv.querySelectorAll(`.remove-trader-${kind}-btn`).forEach(btn => {
        btn.onclick = () => { btn.parentElement.remove(); sync(); };
    });

    const addBtn = document.getElementById(kind === 'buy' ? 'add-trader-buy-btn' : 'add-trader-sell-btn');
    if (addBtn) {
        addBtn.onclick = () => {
            t[kind].push({ id: "", price: 0 });
            renderTraderList(kind);
            updateTraderPreview();
        };
    }
}

function attachTraderCreatorListeners() {
    const t = traderCreatorState.trader;
    document.getElementById('trader-id').oninput = e => {
        t.id = e.target.value.trim();
        updateTraderPreview();
    };

    document.getElementById('confirm-trader-btn').onclick = () => {
        if (!t.id) { alert('Please enter a Trader ID.'); return; }
        const copy = JSON.parse(JSON.stringify(t));
        savedTraders.push(copy);
        renderSavedTraders();
        renderTraderDownloadButtons();
        clearTraderInputs();
        updateTraderPreview();
    };
}

function updateTraderPreview() {
    const t = traderCreatorState.trader;
    const buyStr = (t.buy || []).map(b => `    { id: "${b.id}", price: ${b.price} }`).join(",\n");
    const sellStr = (t.sell || []).map(s => `    { id: "${s.id}", price: ${s.price} }`).join(",\n");
    const preview =
`{
  buy: [
${buyStr}
  ],
  sell: [
${sellStr}
  ]
}`;
    const previewEl = document.getElementById('trader-def-preview');
    if (previewEl) previewEl.textContent = preview;
}

// Matches traders.js's exact formatting: 4-space indent, 8-space indent for
// each {id, price} entry, trailing comma so entries can be joined directly.
function getTraderDefinitionCode(t) {
    const buyStr = (t.buy || []).map(b => `        { id: "${b.id}", price: ${b.price} }`).join(",\n");
    const sellStr = (t.sell || []).map(s => `        { id: "${s.id}", price: ${s.price} }`).join(",\n");
    return `${t.id}: {
    buy: [
${buyStr}
    ],
    sell: [
${sellStr}
    ]
},`;
}

function clearTraderInputs() {
    traderCreatorState.trader = {
        id: suggestNextTraderId(),
        buy: [],
        sell: []
    };
    showToolOptions("trader");
}

function renderSavedTraders() {
    renderSavedList({
        listElId: 'saved-traders-list',
        getItems: () => savedTraders,
        rowClass: 'saved-trader-row',
        editBtnClass: 'edit-trader-btn',
        deleteBtnClass: 'delete-trader-btn',
        emptyMessage: 'No traders saved yet.',
        label: t => `${t.id} <span style="opacity:0.7;">(${(t.buy || []).length} buy / ${(t.sell || []).length} sell)</span>`,
        toolKey: 'trader',
        setDraft: item => { traderCreatorState.trader = item; },
        onEdit: () => {
            renderTraderList('buy');
            renderTraderList('sell');
            renderTraderDownloadButtons();
        },
        onDelete: () => {
            renderTraderDownloadButtons();
        }
    });
}

function renderTraderDownloadButtons() {
    renderDownloadButtons('trader-download-buttons', [
        {
            id: 'download-trader-defs', label: 'Download Trader Definitions', filename: 'trader_definitions.js',
            buildCode: () => savedTraders.map(t => getTraderDefinitionCode(t)).join("\n\n")
        }
    ]);
}

function renderSavedSkills() {
    renderSavedList({
        listElId: 'saved-skills-list',
        getItems: () => savedSkills,
        rowClass: 'saved-skill-row',
        editBtnClass: 'edit-skill-btn',
        deleteBtnClass: 'delete-skill-btn',
        emptyMessage: 'No skills saved yet.',
        label: sk => `${sk.name || "(Unnamed Skill)"} <span style="opacity:0.7;">(${sk.id})</span>`,
        toolKey: 'skill',
        setDraft: item => { skillCreatorState.skill = item; },
        onEdit: () => {
            updateSkillPreview();
            renderSkillDownloadButtons();
        },
        onDelete: () => {
            renderSkillDownloadButtons();
        }
    });
}

function renderSkillDownloadButtons() {
    renderDownloadButtons('skill-download-buttons', [
        {
            id: 'download-skill-defs', label: 'Download Skill Definitions', filename: 'skill_definitions.js',
            buildCode: () => savedSkills.map(sk => getSkillDefinitionCode(sk)).join("\n\n")
        }
    ]);
}
