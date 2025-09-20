// Cynrith Definitions URL 
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/vCore420/Cynrith/main/assets/js/DEFINITIONS/";

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
async function loadAllDefinitions() {
    for (const [key, url] of Object.entries(definitionFiles)) {
        try {
            definitions[key] = await fetchDefinition(url);
            console.log(`[Editor] Loaded ${key} definitions from GitHub`);
            if (key === "npcs") {
                const npcData = definitions.npcs;
                if (npcData && typeof npcData === "object") {
                    Object.values(npcData).forEach(npc => {
                        if (Array.isArray(npc.spawns)) {
                            const floors = npc.spawns
                                .map(spawn => spawn.map)
                                .map(m => isNaN(m) ? m : Number(m))
                                .join(", ");
                            console.log(`NPC: ${npc.name} (${npc.id}) - Floors: ${floors}`);
                        }
                    });
                } else {
                    console.log("No NPC data loaded or NPC data is not an object.");
                }
            }
        } catch (e) {
            console.error(`[Editor] Failed to load ${key}:`, e);
            definitions[key] = {};
        }
    }
    renderFloorVisualizer();
}
  
loadAllDefinitions();

// Tab switching logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.editor-tab').forEach(tab => tab.classList.remove('active'));
        const tabId = btn.dataset.tab + '-tab';
        document.getElementById(tabId).classList.add('active');

        if (tabId === 'floor-visualizer-tab') renderFloorVisualizer();
        if (tabId === 'items-tab') renderItemsTab();
        if (tabId === 'skills-tab') renderSkillsTab();
        if (tabId === 'creator-tab') renderCreatorTab();
        if (tabId === 'tile-maker-tab') renderTileMakerTab();
        if (tabId === 'tile-editor-tab') renderTileEditorTab();
        
    };
});
