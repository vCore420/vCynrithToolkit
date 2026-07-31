// Floor Visualizer Tab
function renderFloorVisualizer() {
    const tab = document.getElementById('floor-visualizer-tab');
    const floors = getKnownFloorIndices(); // auto-detected from live data -- see main.js

    tab.innerHTML = `
        <h2>Floor Visualizer</h2>
        <p>Select a floor to view everything linked to it. Floors are detected automatically from whatever NPCs, enemies, and tiles currently reference them -- nothing to update here as Cynrith grows.</p>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:12px;">
            <select id="floor-select">
                ${floors.length
                    ? floors.map(idx => `<option value="${idx}">${getFloorLabel(idx)}</option>`).join("")
                    : `<option value="">No floors detected yet</option>`
                }
            </select>
            <input type="text" id="floor-search" placeholder="Filter this floor by name/id..." style="flex:1; min-width:200px;">
        </div>
        <div id="floor-links"></div>
    `;

    document.getElementById('floor-select').onchange = function() {
        showFloorLinks(this.value, document.getElementById('floor-search').value);
    };
    document.getElementById('floor-search').oninput = function() {
        showFloorLinks(document.getElementById('floor-select').value, this.value);
    };

    if (floors.length) {
        showFloorLinks(floors[0]);
    } else {
        document.getElementById('floor-links').innerHTML =
            "<p><i>No floor data loaded yet -- once NPCs, enemies, or tiles reference a floor, it'll appear here automatically.</i></p>";
    }
}

function matchesSearch(text, term) {
    if (!term) return true;
    return (text || "").toString().toLowerCase().includes(term.toLowerCase());
}

function showFloorLinks(floorIdx, searchTerm = "") {
    const linksDiv = document.getElementById('floor-links');
    if (floorIdx === "" || floorIdx === undefined) {
        linksDiv.innerHTML = "";
        return;
    }
    const idx = parseInt(floorIdx);
    const term = (searchTerm || "").trim();

    function onThisFloor(spawns) {
        return Array.isArray(spawns) && spawns.some(spawn => Number(spawn.map) === idx);
    }

    // NPCs
    let npcList = [];
    const npcData = definitions.npcs;
    if (npcData && typeof npcData === "object") {
        npcList = Object.values(npcData).filter(npc =>
            onThisFloor(npc.spawns) && (matchesSearch(npc.name, term) || matchesSearch(npc.id, term))
        );
    }

    // Enemies
    let enemyList = [];
    const enemyData = definitions.enemies;
    if (enemyData && typeof enemyData === "object") {
        enemyList = Object.values(enemyData).filter(enemy =>
            onThisFloor(enemy.spawns) && (matchesSearch(enemy.name, term) || matchesSearch(enemy.id, term))
        );
    }

    // Quests (via the NPCs on this floor -- quests aren't floor-tagged themselves)
    let questList = [];
    const questData = definitions.quests;
    if (npcData && questData) {
        const npcQuestIds = Object.values(npcData)
            .filter(npc => onThisFloor(npc.spawns))
            .map(npc => npc.questId)
            .filter(Boolean);
        questList = npcQuestIds.map(qid => questData[qid]).filter(Boolean)
            .filter(q => matchesSearch(q.name, term) || matchesSearch(q.id, term));
    }

    // Traders (via the NPCs on this floor -- traders aren't floor-tagged themselves)
    let traderList = [];
    const traderData = definitions.traders;
    if (npcData && traderData) {
        const npcTraderIds = Array.from(new Set(
            Object.values(npcData)
                .filter(npc => onThisFloor(npc.spawns) && npc.trader)
                .map(npc => npc.trader)
        ));
        traderList = npcTraderIds
            .map(tid => ({ id: tid, ...traderData[tid] }))
            .filter(t => t.buy || t.sell)
            .filter(t => matchesSearch(t.id, term));
    }

    // Interact Tiles
    let interactTiles = [];
    const interactData = definitions.interactTiles;
    if (Array.isArray(interactData)) {
        interactTiles = interactData.filter(tile =>
            Number(tile.map) === idx && (matchesSearch(tile.id, term))
        );
    }

    // Trigger Tiles
    let triggerTiles = [];
    const triggerData = definitions.triggerTiles;
    if (Array.isArray(triggerData)) {
        triggerTiles = triggerData.filter(tile =>
            Number(tile.map) === idx && (matchesSearch(tile.id, term))
        );
    }

    function rewardsLine(rewards) {
        if (!rewards || !rewards.length) return "";
        const parts = rewards.map(r => {
            if (r.id) return `${r.amount || 1} ${r.id}`;
            const keys = Object.keys(r);
            return keys.map(k => `${r[k]} ${k}`).join(", ");
        });
        return `<div><b>Rewards:</b> ${parts.join(", ")}</div>`;
    }

    function soundLine(sound) {
        if (!sound || !sound.enabled || !sound.file) return "";
        return `<div><b>Sound:</b> ${sound.file} (${sound.type || "default"})</div>`;
    }

    linksDiv.innerHTML = `
        <h3>${getFloorLabel(idx)}</h3>

        <h3>NPCs <span style="color:#9aa4b2; font-weight:normal;">(${npcList.length})</span></h3>
        <ul>
        ${npcList.length
            ? npcList.map((npc, i) => `
                <li>
                    <b>${npc.name}</b> (${npc.id})<br>
                    ${npc.questId ? `Quest: <i>${npc.questId}</i><br>` : ""}
                    ${npc.trader ? `Trader: <i>${npc.trader}</i><br>` : ""}
                    ${npc.forcedEncounter && npc.forcedEncounter.enabled
                        ? `<span style="color:#e74c3c;">⚔ Forced Encounter</span> (${(npc.forcedEncounter.triggerTiles || []).length} trigger tile${(npc.forcedEncounter.triggerTiles || []).length === 1 ? "" : "s"})`
                        : ""}
                </li>
                ${i < npcList.length - 1 ? '<hr>' : ''}
            `).join("")
            : `<li><i>No NPCs found${term ? " matching your filter" : " for this floor"}.</i></li>`
        }
        </ul>

        <h3>Enemies <span style="color:#9aa4b2; font-weight:normal;">(${enemyList.length})</span></h3>
        <ul>
        ${enemyList.length
            ? enemyList.map((enemy, i) => `
                <li>
                    <b>${enemy.name}</b> (${enemy.id})<br>
                    Health: ${enemy.maxHealth}, Attack: ${enemy.attack}, Defense: ${enemy.defense}, Speed: ${enemy.speed}, XP: ${enemy.xpGain}
                    ${Array.isArray(enemy.loot) && enemy.loot.length
                        ? `<div><b>Loot:</b> ${enemy.loot.map(l => `${l.item} (${l.chance}%, x${Array.isArray(l.amount) ? l.amount.join('-') : l.amount})`).join(", ")}</div>`
                        : ""}
                </li>
                ${i < enemyList.length - 1 ? '<hr>' : ''}
            `).join("")
            : `<li><i>No enemies found${term ? " matching your filter" : " for this floor"}.</i></li>`
        }
        </ul>

        <h3>Quests <span style="color:#9aa4b2; font-weight:normal;">(${questList.length})</span></h3>
        <ul>
        ${questList.length
            ? questList.map((quest, i) => `
                <li>
                    <b>${quest.name}</b> (${quest.id})<br>
                    <div>${quest.description || ""}</div>
                    <div><b>Type:</b> ${quest.type}</div>
                    ${rewardsLine(quest.rewards)}
                </li>
                ${i < questList.length - 1 ? '<hr>' : ''}
            `).join("")
            : `<li><i>No quests found${term ? " matching your filter" : " for this floor"}.</i></li>`
        }
        </ul>

        <h3>Traders <span style="color:#9aa4b2; font-weight:normal;">(${traderList.length})</span></h3>
        <ul>
        ${traderList.length
            ? traderList.map((trader, i) => `
                <li>
                    <b>${trader.id}</b><br>
                    ${trader.buy && trader.buy.length ? `<div><b>Sells to player:</b> ${trader.buy.map(b => `${b.id} (${b.price}g)`).join(", ")}</div>` : ""}
                    ${trader.sell && trader.sell.length ? `<div><b>Buys from player:</b> ${trader.sell.map(s => `${s.id} (${s.price}g)`).join(", ")}</div>` : ""}
                </li>
                ${i < traderList.length - 1 ? '<hr>' : ''}
            `).join("")
            : `<li><i>No traders found${term ? " matching your filter" : " for this floor"}.</i></li>`
        }
        </ul>

        <h3>Interact Tiles <span style="color:#9aa4b2; font-weight:normal;">(${interactTiles.length})</span></h3>
        <ul>
        ${interactTiles.length
            ? interactTiles.map((tile, i) => `
                <li>
                    <b>${tile.id}</b> (${tile.x}, ${tile.y})<br>
                    ${tile.notification ? `<div>${tile.notification}</div>` : ""}
                    ${tile.dialogue ? `<div>${tile.dialogue.join("<br>")}</div>` : ""}
                    ${rewardsLine(tile.rewards)}
                    ${soundLine(tile.sound)}
                </li>
                ${i < interactTiles.length - 1 ? '<hr>' : ''}
            `).join("")
            : `<li><i>No interact tiles found${term ? " matching your filter" : " for this floor"}.</i></li>`
        }
        </ul>

        <h3>Trigger Tiles <span style="color:#9aa4b2; font-weight:normal;">(${triggerTiles.length})</span></h3>
        <ul>
        ${triggerTiles.length
            ? triggerTiles.map((tile, i) => `
                <li>
                    <b>${tile.id}</b> (${tile.x}, ${tile.y})<br>
                    ${tile.type ? `<div>Type: ${tile.type}</div>` : ""}
                    ${tile.dialogue ? `<div>${tile.dialogue.join("<br>")}</div>` : ""}
                    ${rewardsLine(tile.rewards)}
                    ${soundLine(tile.sound)}
                    ${tile.oneTime ? `<div style="color:#f1c40f;">One-time only</div>` : ""}
                </li>
                ${i < triggerTiles.length - 1 ? '<hr>' : ''}
            `).join("")
            : `<li><i>No trigger tiles found${term ? " matching your filter" : " for this floor"}.</i></li>`
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
        <input type="text" id="items-search" placeholder="Filter by name/id..." style="width:100%; margin-bottom:12px;">
        <ul id="items-list"></ul>
    `;
    function render(term) {
        const list = Object.values(items).filter(item => matchesSearch(item.name, term) || matchesSearch(item.id, term));
        document.getElementById('items-list').innerHTML = list.map(item => `
            <li style="margin-bottom:1em;">
                <b>${item.name}</b> (${item.id})<br>
                <span>${item.description || ""}</span><br>
                <b>Rarity:</b> ${item.rarity}<br>
                <b>Stackable:</b> ${item.stackable ? "Yes" : "No"}<br>
                <b>Useable:</b> ${item.useable ? "Yes" : "No"}<br>
                ${item.useable ? `<b>Consume on Use:</b> ${item.consumeOnUse ? "Yes" : "No"}<br>` : ""}
                <b>Removeable:</b> ${item.removeable ? "Yes" : "No"}<br>
                ${item.sound ? `<b>Sound:</b> ${item.sound}<br>` : ""}
                ${item.homePlaceable ? `<span style="color:#4caf50;">🏠 Home Placeable</span>` : ""}
            </li>
        `).join("") || "<li><i>No items match your filter.</i></li>";
    }
    document.getElementById('items-search').oninput = e => render(e.target.value);
    render("");
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
        <input type="text" id="skills-search" placeholder="Filter by name/id..." style="width:100%; margin-bottom:12px;">
        <ul id="skills-list"></ul>
    `;
    function render(term) {
        const list = skills.filter(skill => matchesSearch(skill.name, term) || matchesSearch(skill.id, term));
        document.getElementById('skills-list').innerHTML = list.map(skill => `
            <li style="margin-bottom:1em;">
                <b>${skill.name}</b> (${skill.id})<br>
                <span>${skill.description || ""}</span><br>
                <b>Pool:</b> ${skill.pool}<br>
                <b>Chance:</b> ${skill.chance}<br>
                <b>Max Level:</b> ${skill.maxLevel}<br>
                <b>Rarity:</b> ${skill.rarity}<br>
                <b>Buffs:</b> ${Object.entries(skill.buffs || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "None"}<br>
                <b>Drawbacks:</b> ${Object.entries(skill.drawbacks || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "None"}
            </li>
        `).join("") || "<li><i>No skills match your filter.</i></li>";
    }
    document.getElementById('skills-search').oninput = e => render(e.target.value);
    render("");
}
