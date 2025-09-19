// --- Creator Tab State ---
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
        npcForced: false,
        triggerTiles: "",
        questGiven: "",
        questIncomplete: "",
        questComplete: "",
        questType: "gift",
        questTypeOptions: {},
        questRewards: ""
    }
};

let savedNpcs = [];

// --- Creator Tab Render ---
function renderCreatorTab() {
    const tab = document.getElementById('creator-tab');
    tab.innerHTML = `
        <h2>Floor Creator</h2>
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
    `;

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
}

// --- Asset Prompt ---
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
                    showCreatorMap(mapData, loadedAssets);
                };
                reader.readAsDataURL(file);
            }
        });

        setTimeout(() => {
            if (Object.keys(loadedAssets).length === 0) {
                statusDiv.innerHTML = `<span style="color: #ff9800;"><b>No required assets found in selected folder.</b></span>`;
                showCreatorMap(mapData, {}); // fallback: no assets
            }
        }, 500);
    };
}

// --- Tool Panel ---
function showToolPanel() {
    const sidebar = document.getElementById('creator-tool-sidebar');
    sidebar.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px;">
            <button class="tool-btn active" data-tool="npc">NPC Creator</button>
            <button class="tool-btn" data-tool="enemy">Enemy Creator</button>
            <button class="tool-btn" data-tool="trigger">Trigger Tile Creator</button>
            <button class="tool-btn" data-tool="interact">Interactable Tile Creator</button>
            <button class="tool-btn" data-tool="sprite">World Sprite Creator</button>
            <button class="tool-btn" data-tool="item">Item Creator</button>
            <button class="tool-btn" data-tool="skill">Skill Creator</button>
        </div>
    `;
    sidebar.querySelectorAll('.tool-btn').forEach(btn => {
        btn.onclick = function() {
            sidebar.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showToolOptions(btn.dataset.tool);
        };
    });
    showToolOptions("npc");
}

// --- Tool Options (State Driven) ---
function showToolOptions(tool) {
    const optionsDiv = document.getElementById('creator-tool-options');
    if (tool !== 'npc') {
        optionsDiv.innerHTML = `<h3>${tool.charAt(0).toUpperCase() + tool.slice(1)} Tool</h3>
            <div>Tool options and inputs will appear here.</div>`;
        return;
    }
    const npc = creatorState.npc;
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
                    <input type="checkbox" id="npc-forced" ${npc.npcForced ? "checked" : ""}/> Forced encounter
                </label>
                <div id="npc-forced-section" style="display:${npc.npcForced ? "flex" : "none"}; margin-top:8px;">
                    <label>Trigger Tiles (comma separated, e.g. 44,46 45,46):<br>
                        <input type="text" id="npc-trigger-tiles" value="${npc.triggerTiles}" style="width:100%;" placeholder="x,y x,y ..." />
                    </label>
                </div>
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

    // Attach listeners for all inputs
    attachCreatorListeners();
    updateCreatorPreview();
}

// --- Quest Type Options Renderer ---
function renderQuestTypeOptions(npc) {
    switch (npc.questType) {
        case "itemCollect":
        case "gift":
            return `<label>Required Items (one per line, format: id,amount):<br>
                <textarea id="quest-required-items" rows="2" style="width:100%;" placeholder="e.g. dewleaf,3">${npc.questTypeOptions.requiredItems || ""}</textarea>
            </label>`;
        case "enemyDefeat":
            return `<label>Enemy ID:<br>
                <input type="text" id="quest-enemy-id" value="${npc.questTypeOptions.enemyId || ""}" style="width:100%;" placeholder="e.g. slime_01" /></label>
                <label>Required Amount:<br>
                <input type="number" id="quest-enemy-amount" min="1" value="${npc.questTypeOptions.requiredAmount || 1}" style="width:80px;" /></label>`;
        case "statBuild":
            return `<label>Stat Key:<br>
                <input type="text" id="quest-stat-key" value="${npc.questTypeOptions.stat || ""}" style="width:100%;" placeholder="e.g. maxHealth" /></label>
                <label>Required Amount:<br>
                <input type="number" id="quest-stat-amount" min="1" value="${npc.questTypeOptions.requiredAmount || 1}" style="width:80px;" /></label>`;
        case "interactTiles":
            return `<label>Interact Tile IDs (comma separated):<br>
                <input type="text" id="quest-interact-ids" value="${npc.questTypeOptions.interactTileIds || ""}" style="width:100%;" placeholder="e.g. statue_f3_1,statue_f3_2" /></label>
                <label>Required Amount:<br>
                <input type="number" id="quest-interact-amount" min="1" value="${npc.questTypeOptions.requiredAmount || 1}" style="width:80px;" /></label>`;
        default:
            return "";
    }
}

// Add these variables at the top of your file:
let wanderSelectionStep = 0; // 0 = not selecting, 1 = first corner, 2 = second corner, 3 = spawn
let wanderFirstCorner = null;

// --- Attach Listeners ---
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

    // Quest fields (if present)
    if (npc.hasQuest) {
        document.getElementById('quest-id').oninput = e => { npc.questId = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-name').oninput = e => { npc.questName = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-description').oninput = e => { npc.questDescription = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-redoable').onchange = e => { npc.questRedoable = e.target.checked; updateCreatorPreview(); };
        document.getElementById('npc-forced').onchange = e => { npc.npcForced = e.target.checked; showToolOptions("npc"); };
        if (npc.npcForced) {
            document.getElementById('npc-trigger-tiles').oninput = e => { npc.triggerTiles = e.target.value; updateCreatorPreview(); };
        }
        document.getElementById('quest-given-dialogue').oninput = e => { npc.questGiven = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-incomplete-dialogue').oninput = e => { npc.questIncomplete = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-complete-dialogue').oninput = e => { npc.questComplete = e.target.value; updateCreatorPreview(); };
        document.getElementById('quest-type').onchange = e => { npc.questType = e.target.value; showToolOptions("npc"); };

        renderRewardsList();
        attachRewardListeners();

        // Quest type options
        switch (npc.questType) {
            case "itemCollect":
            case "gift":
                document.getElementById('quest-required-items').oninput = e => { npc.questTypeOptions.requiredItems = e.target.value; updateCreatorPreview(); };
                break;
            case "enemyDefeat":
                document.getElementById('quest-enemy-id').oninput = e => { npc.questTypeOptions.enemyId = e.target.value; updateCreatorPreview(); };
                document.getElementById('quest-enemy-amount').oninput = e => { npc.questTypeOptions.requiredAmount = e.target.value; updateCreatorPreview(); };
                break;
            case "statBuild":
                document.getElementById('quest-stat-key').oninput = e => { npc.questTypeOptions.stat = e.target.value; updateCreatorPreview(); };
                document.getElementById('quest-stat-amount').oninput = e => { npc.questTypeOptions.requiredAmount = e.target.value; updateCreatorPreview(); };
                break;
            case "interactTiles":
                document.getElementById('quest-interact-ids').oninput = e => { npc.questTypeOptions.interactTileIds = e.target.value; updateCreatorPreview(); };
                document.getElementById('quest-interact-amount').oninput = e => { npc.questTypeOptions.requiredAmount = e.target.value; updateCreatorPreview(); };
                break;
        }
    }
    document.getElementById('confirm-npc-btn').onclick = () => {
        // Deep clone current NPC
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
        npcForced: false,
        triggerTiles: "",
        questGiven: "",
        questIncomplete: "",
        questComplete: "",
        questType: "gift",
        questTypeOptions: {},
        questRewards: ""
    };
    showToolOptions("npc");
}

function renderSavedNpcs() {
    const listDiv = document.getElementById('saved-npcs-list');
    if (!listDiv) return;
    if (savedNpcs.length === 0) {
        listDiv.innerHTML = "<b>No NPCs saved yet.</b>";
        return;
    }
    listDiv.innerHTML = savedNpcs.map((npc, idx) => `
        <div class="saved-npc-row" style="background:#232634; border-radius:6px; padding:8px; margin-bottom:8px; display:flex; align-items:center; gap:12px;">
            <span style="font-weight:bold;">${npc.name || "(Unnamed NPC)"}</span>
            <button type="button" class="edit-npc-btn" data-idx="${idx}">Edit</button>
            <button type="button" class="delete-npc-btn" data-idx="${idx}">Delete</button>
        </div>
    `).join("");
    // Attach listeners
    listDiv.querySelectorAll('.edit-npc-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = Number(btn.dataset.idx);
            creatorState.npc = JSON.parse(JSON.stringify(savedNpcs[idx]));
            showToolOptions("npc");
            updateCreatorPreview();
            updateWanderPrompt();
            renderNpcDownloadButtons();
        };
    });
    listDiv.querySelectorAll('.delete-npc-btn').forEach(btn => {
        btn.onclick = () => {
            const idx = Number(btn.dataset.idx);
            savedNpcs.splice(idx, 1);
            renderSavedNpcs();
            renderNpcDownloadButtons();
        };
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
    listDiv.innerHTML = rewards.map((r, i) => `
        <div class="reward-row" data-idx="${i}" style="display:flex; gap:8px; align-items:center; margin-bottom:4px;">
            <input type="text" class="reward-name" value="${r.id || Object.keys(r)[0] || ''}" placeholder="Reward name (id/xp/attack...)" style="width:120px;">
            <input type="number" class="reward-amount" value="${r.amount || r[Object.keys(r)[0]] || 1}" min="1" style="width:60px;">
            <button type="button" class="remove-reward-btn">Remove</button>
        </div>
    `).join("");
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
                    // If stat reward (xp, attack, etc), format as { xp: 50 }
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
                <input type="text" class="reward-name" placeholder="Reward name (id/xp/attack...)" style="width:120px;">
                <input type="number" class="reward-amount" value="1" min="1" style="width:60px;">
                <button type="button" class="remove-reward-btn">Remove</button>
            `;
            list.appendChild(newRow);
            attachRewardListeners();
        };
    }
}

// --- Preview Renderer ---
function updateCreatorPreview() {
    const npc = creatorState.npc;

    // Format wanderArea for preview (only corners, not tiles)
    let wanderAreaPreview = undefined;
    if (npc.wanderArea && typeof npc.wanderArea.x1 === "number") {
        wanderAreaPreview = {
            x1: npc.wanderArea.x1,
            y1: npc.wanderArea.y1,
            x2: npc.wanderArea.x2,
            y2: npc.wanderArea.y2
        };
    }

    // Format spawns array for preview (manual formatting, one line, no quotes on keys)
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
    if (npc.npcForced && npc.triggerTiles) {
        const triggers = npc.triggerTiles.split(' ').map(pair => {
            const [x, y] = pair.split(',').map(Number);
            return (!isNaN(x) && !isNaN(y)) ? `      { x: ${x}, y: ${y} }` : null;
        }).filter(Boolean).join(",\n");
        forcedEncounterPreview = `
  forcedEncounter: {
    enabled: true,
    triggerTiles: [
${triggers}
    ],
    triggered: false
  },`;
    }

    // NPC definition preview (manual formatting for spawns and keys)
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

    // --- Quest Definition Preview ---
    if (npc.hasQuest) {
        let questTypeObj = {};
        switch (npc.questType) {
            case "itemCollect":
            case "gift":
                questTypeObj.requiredItems = (npc.questTypeOptions.requiredItems || "").split('\n').map(line => {
                    const [id, amount] = line.split(',').map(s => s.trim());
                    return id ? { id, amount: Number(amount) || 1 } : null;
                }).filter(Boolean);
                break;
            case "enemyDefeat":
                questTypeObj.enemyId = npc.questTypeOptions.enemyId || "";
                questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
                break;
            case "statBuild":
                questTypeObj.stat = npc.questTypeOptions.stat || "";
                questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
                break;
            case "interactTiles":
                questTypeObj.interactTileIds = (npc.questTypeOptions.interactTileIds || "").split(',').map(s => s.trim()).filter(Boolean);
                questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
                break;
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
  }).join(", ")}],
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

// Map Engine for Preview Map 
let creatorMapZoom = 1;
let creatorMapOffset = { x: 0, y: 0 };
let creatorMapAssets = {};
let creatorMapImages = {};
let isDragging = false;
let dragStart = { x: 0, y: 0 };

function showCreatorMap(mapData, loadedAssets = {}) {
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

        // --- Wander Area Highlight ---
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

        // --- Spawn Location Marker ---
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
        ctx.restore();
        savedNpcs.forEach(npc => {
            // Highlight wander area
            if (npc.wanderArea && npc.wanderArea.tiles) {
                ctx.save();
                ctx.globalAlpha = 0.25;
                ctx.fillStyle = "#ffd700";
                npc.wanderArea.tiles.forEach(({x, y}) => {
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
        });
    }

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
        // Only handle if we're in selection mode
        if (wanderSelectionStep === 0) return;
    
        // Get tile coordinates
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - creatorMapOffset.x) / creatorMapZoom;
        const mouseY = (e.clientY - rect.top - creatorMapOffset.y) / creatorMapZoom;
        const tileSize = mapData.tilewidth || 32;
        const x = Math.floor(mouseX / tileSize);
        const y = Math.floor(mouseY / tileSize);
    
        if (wanderSelectionStep === 1) {
            wanderFirstCorner = { x, y };
            wanderSelectionStep = 2;
            updateWanderPrompt();
            drawMap();
        }  else if (wanderSelectionStep === 2) {
            // Calculate corners
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
    };

    resizeCanvas();

    // Render sidebar and tool options using your global functions
    showToolPanel();
}

function renderNpcDownloadButtons() {
    const btnDiv = document.getElementById('npc-download-buttons');
    if (!btnDiv) return;
    btnDiv.innerHTML = `
        <button id="download-npc-defs" type="button">Download NPC Definitions</button>
        <button id="download-quest-defs" type="button">Download Quest Definitions</button>
    `;
    document.getElementById('download-npc-defs').onclick = () => {
        const code = savedNpcs.map(npc => getNpcDefinitionCode(npc)).join("\n\n");
        downloadTextFile("npc_definitions.js", code);
    };
    document.getElementById('download-quest-defs').onclick = () => {
        const code = savedNpcs.filter(npc => npc.hasQuest).map(npc => getQuestDefinitionCode(npc)).join("\n\n");
        downloadTextFile("quest_definitions.js", code);
    };
}

function downloadTextFile(filename, text) {
    const blob = new Blob([text], {type: "text/plain"});
    const link = document.createElement("a");
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
}

function getNpcDefinitionCode(npc) {
    // Format wanderArea for preview (only corners, not tiles)
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
    if (npc.npcForced && npc.triggerTiles) {
        const triggers = npc.triggerTiles.split(' ').map(pair => {
            const [x, y] = pair.split(',').map(Number);
            return (!isNaN(x) && !isNaN(y)) ? `      { x: ${x}, y: ${y} }` : null;
        }).filter(Boolean).join(",\n");
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
        case "itemCollect":
        case "gift":
            questTypeObj.requiredItems = (npc.questTypeOptions.requiredItems || "").split('\n').map(line => {
                const [id, amount] = line.split(',').map(s => s.trim());
                return id ? { id, amount: Number(amount) || 1 } : null;
            }).filter(Boolean);
            break;
        case "enemyDefeat":
            questTypeObj.enemyId = npc.questTypeOptions.enemyId || "";
            questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
            break;
        case "statBuild":
            questTypeObj.stat = npc.questTypeOptions.stat || "";
            questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
            break;
        case "interactTiles":
            questTypeObj.interactTileIds = (npc.questTypeOptions.interactTileIds || "").split(',').map(s => s.trim()).filter(Boolean);
            questTypeObj.requiredAmount = Number(npc.questTypeOptions.requiredAmount) || 1;
            break;
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
    }).join(", ")}],
    redoable: ${!!npc.questRedoable}
},`;
}

function renderTileMakerTab() {
    const tab = document.getElementById('tile-maker-tab');
    tab.innerHTML = `
        <h2>Tile Maker</h2>
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
    // Now call a function to initialize the generator controls and logic
    setupTileMaker();
}