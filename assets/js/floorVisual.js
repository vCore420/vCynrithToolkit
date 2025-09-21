// Floor Visualizer DropDown
function renderFloorVisualizer() {
    const tab = document.getElementById('floor-visualizer-tab');
    // Add Floors as they are added to the game
    tab.innerHTML = `
        <h2>Floor Visualizer</h2>
        <p>Select a floor to view all linked definitions:</p>
        <select id="floor-select">
        <option value="0">Floor 1: Verdant Rise</option>
        <option value="1">Floor 2: Stonewake Expanse</option>
        <option value="2">Floor 3: Gloomroot Thicket</option>
        <option value="3">Floor 4: The Shattered Spires</option>
        <option value="4">Floor 5: Umbracourt</option>
        </select>
        <div id="floor-links"></div>
    `;
    document.getElementById('floor-select').onchange = function() {
        showFloorLinks(this.value);
    };
    showFloorLinks(0);
}

// Floor Visulizer Tab
function showFloorLinks(floorIdx) {
    const linksDiv = document.getElementById('floor-links');
    const idx = parseInt(floorIdx);

    // NPCs 
    let npcList = [];
    let npcData = definitions.npcs;
    if (npcData && typeof npcData === "object") {
        npcList = Object.values(npcData).filter(npc =>
            Array.isArray(npc.spawns) &&
            npc.spawns.some(spawn => {
                if (typeof spawn.map === "number") return spawn.map === idx;
                if (!isNaN(spawn.map)) return Number(spawn.map) === idx;
                return false;
            })
        );
    }

    // Enemies 
    let enemyList = [];
    let enemyData = definitions.enemies;
    if (enemyData && typeof enemyData === "object") {
        enemyList = Object.values(enemyData).filter(enemy =>
            Array.isArray(enemy.spawns) &&
            enemy.spawns.some(spawn => {
                if (typeof spawn.map === "number") return spawn.map === idx;
                if (!isNaN(spawn.map)) return Number(spawn.map) === idx;
                return false;
            })
        );
    }

    // Quests 
    let questList = [];
    let questData = definitions.quests;
    if (npcData && questData) {
        let npcQuests = Object.values(npcData)
            .filter(npc => Array.isArray(npc.spawns) && npc.spawns.some(spawn => Number(spawn.map) === Number(floorIdx)))
            .map(npc => npc.questId)
            .filter(Boolean);
        questList = npcQuests.map(qid => questData[qid]).filter(Boolean);
    }

    // Interact Tiles 
    let interactTiles = [];
    let interactData = definitions.interactTiles;
    if (Array.isArray(interactData)) {
        interactTiles = interactData.filter(tile =>
            (typeof tile.map === "number" && tile.map === idx) ||
            (!isNaN(tile.map) && Number(tile.map) === idx)
        );
    }

    // Trigger Tiles 
    let triggerTiles = [];
    let triggerData = definitions.triggerTiles;
    if (Array.isArray(triggerData)) {
        triggerTiles = triggerData.filter(tile =>
            (typeof tile.map === "number" && tile.map === idx) ||
            (!isNaN(tile.map) && Number(tile.map) === idx)
        );
    }

    // Render 
    linksDiv.innerHTML = `
        <h3>Floor ${idx + 1}</h3>
        <h3>NPCs</h3>
        <ul>
        ${npcList.length
            ? npcList.map((npc, i) => `
                <li>
                    <b>${npc.name}</b> (${npc.id})<br>
                    ${npc.questId ? `Quest: <i>${npc.questId}</i>` : ""}
                    ${npc.trader ? `<br>Trader: <i>${npc.trader}</i>` : ""}
                </li>
                ${i < npcList.length - 1 ? '<hr>' : ''}
            `).join("")
            : "<li><i>No NPCs found for this floor.</i></li>"
        }
        </ul>
        <h3>Enemies</h3>
        <ul>
        ${enemyList.length
            ? enemyList.map((enemy, i) => `
                <li>
                    <b>${enemy.name}</b> (${enemy.id})<br>
                    Health: ${enemy.maxHealth}, Attack: ${enemy.attack}, Defense: ${enemy.defense}, Speed: ${enemy.speed}, XP: ${enemy.xpGain}
                </li>
                ${i < enemyList.length - 1 ? '<hr>' : ''}
            `).join("")
            : "<li><i>No enemies found for this floor.</i></li>"
        }
        </ul>
        <h3>Quests</h3>
        <ul>
        ${questList.length
            ? questList.map((quest, i) => `
                <li>
                    <b>${quest.name}</b> (${quest.id})<br>
                    <div>${quest.description}</div>
                    <div><b>Type:</b> ${quest.type}</div>
                    <div><b>Rewards:</b> ${quest.rewards.map(r => r.id ? `${r.amount || 1} ${r.id}` : `${r.xp} XP`).join(", ")}</div>
                </li>
                ${i < questList.length - 1 ? '<hr>' : ''}
            `).join("")
            : "<li><i>No quests found for this floor.</i></li>"
        }
        </ul>
        <h3>Interact Tiles</h3>
        <ul>
        ${interactTiles.length
            ? interactTiles.map((tile, i) => `
                <li>
                    <b>${tile.id}</b> (${tile.x}, ${tile.y})<br>
                    ${tile.notification ? `<div>${tile.notification}</div>` : ""}
                    ${tile.dialogue ? `<div>${tile.dialogue.join("<br>")}</div>` : ""}
                    ${tile.rewards ? `<div><b>Rewards:</b> ${tile.rewards.map(r => `${r.amount || 1} ${r.id}`).join(", ")}</div>` : ""}
                </li>
                ${i < interactTiles.length - 1 ? '<hr>' : ''}
            `).join("")
            : "<li><i>No interact tiles found for this floor.</i></li>"
        }
        </ul>
        <h3>Trigger Tiles</h3>
        <ul>
        ${triggerTiles.length
            ? triggerTiles.map((tile, i) => `
                <li>
                    <b>${tile.id}</b> (${tile.x}, ${tile.y})<br>
                    ${tile.type ? `<div>Type: ${tile.type}</div>` : ""}
                    ${tile.dialogue ? `<div>${tile.dialogue.join("<br>")}</div>` : ""}
                    ${tile.rewards ? `<div><b>Rewards:</b> ${tile.rewards.map(r => `${r.amount || 1} ${r.id}`).join(", ")}</div>` : ""}
                </li>
                ${i < triggerTiles.length - 1 ? '<hr>' : ''}
            `).join("")
            : "<li><i>No trigger tiles found for this floor.</i></li>"
        }
        </ul>
    `;
}

// Items Tab
function renderItemsTab() {
    const tab = document.getElementById('items-tab');
    const items = definitions.items;
    if (!items || typeof items !== "object") {
        tab.innerHTML = "<h2>Items</h2><p>No item data loaded.</p>";
        return;
    }
    tab.innerHTML = `
        <h2>Items</h2>
        <ul>
        ${Object.values(items).map(item => `
            <li style="margin-bottom:1em;">
                <b>${item.name}</b> (${item.id})<br>
                <span>${item.description}</span><br>
                <b>Rarity:</b> ${item.rarity}<br>
                <b>Stackable:</b> ${item.stackable ? "Yes" : "No"}<br>
                <b>Useable:</b> ${item.useable ? "Yes" : "No"}<br>
                <b>Removeable:</b> ${item.removeable ? "Yes" : "No"}<br>
                ${item.sound ? `<b>Sound:</b> ${item.sound}` : ""}
            </li>
        `).join("")}
        </ul>
    `;
}

// Skills Tab
function renderSkillsTab() {
    const tab = document.getElementById('skills-tab');
    const skills = definitions.skills;
    if (!Array.isArray(skills)) {
        tab.innerHTML = "<h2>Skills</h2><p>No skill data loaded.</p>";
        return;
    }
    tab.innerHTML = `
        <h2>Skills</h2>
        <ul>
        ${skills.map(skill => `
            <li style="margin-bottom:1em;">
                <b>${skill.name}</b> (${skill.id})<br>
                <span>${skill.description}</span><br>
                <b>Pool:</b> ${skill.pool}<br>
                <b>Chance:</b> ${skill.chance}<br>
                <b>Max Level:</b> ${skill.maxLevel}<br>
                <b>Rarity:</b> ${skill.rarity}<br>
                <b>Buffs:</b> ${Object.entries(skill.buffs).map(([k, v]) => `${k}: ${v}`).join(", ") || "None"}<br>
                <b>Drawbacks:</b> ${Object.entries(skill.drawbacks).map(([k, v]) => `${k}: ${v}`).join(", ") || "None"}
            </li>
        `).join("")}
        </ul>
    `;
}
