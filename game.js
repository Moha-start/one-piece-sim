console.log("🚀🚀🚀 HELLO FROM GAME.JS! I AM ACTUALLY RUNNING! 🚀🚀🚀");
// TODO : modify list of action so it depends on the location and type
// =========================================================
// --- SMART CACHE & GHOST SESSION BUSTER ---
// =========================================================
// We use a synchronous request here to pause the game from loading 
// until we verify the server version matches the saved version.
try {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/version', false); 
    xhr.send();
    
    if (xhr.status === 200) {
        const serverVersion = JSON.parse(xhr.responseText).version;
        const savedVersion = sessionStorage.getItem('serverVersion');
        
        // If versions don't match, you restarted the server! 
        if (savedVersion && savedVersion !== serverVersion) {
            console.log("🔄 Server restart detected! Wiping ghost session...");
            sessionStorage.clear(); // This deletes the stuck simCode!
            sessionStorage.setItem('serverVersion', serverVersion); // Save new code
            window.location.reload(); // Reload cleanly
            throw new Error("Restarting app to clear cache..."); 
        } 
        // If it's a completely new visit, just save the ID
        else if (!savedVersion) {
            sessionStorage.setItem('serverVersion', serverVersion);
        }
    }
} catch(e) {
    console.warn("Version check bypassed.", e);
}


// =========================================================
// --- START OF LOBBY SYSTEM ---
// =========================================================
if (!sessionStorage.getItem('simCode')) {
    const lobbyHTML = `
    <div id="lobby-container" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #1a1a2e; z-index: 99999; display: flex; justify-content: center; align-items: center; color: white; font-family: sans-serif;">
        <style>
            .modal { background: #16213e; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.5); width: 350px; }
            h1 { color: #e94560; font-size: 24px; margin-bottom: 20px;}
            h2 { color: #e94560; font-size: 20px;}
            button { background: #0f3460; color: white; border: 2px solid #e94560; padding: 12px 20px; margin: 10px 0; font-size: 16px; border-radius: 8px; cursor: pointer; width: 100%; transition: 0.3s; }
            button:hover { background: #e94560; }
            input { padding: 12px; font-size: 16px; margin: 10px 0; width: 100%; box-sizing: border-box; border-radius: 8px; border: none; outline: none; }
        </style>
        
        <div id="main-menu" class="modal">
            <h1>One Piece TCG Simulator</h1>
            <button onclick="showStart()">Start Lobby</button>
            <button onclick="showEnter()">Enter Lobby</button>
        </div>

        <div id="start-menu" class="modal" style="display:none;">
            <h2>Start Lobby</h2>
            <button onclick="createCode()">Generate Access Code</button>
            <h3 id="room-code" style="color: #4cd137;"></h3>
            <button id="start-btn" style="display:none;" onclick="joinGame('start')">Enter Match</button>
        </div>

        <div id="enter-menu" class="modal" style="display:none;">
            <h2>Enter Lobby</h2>
            <input type="text" id="guest-code" placeholder="Enter Access Code">
            <button onclick="joinGame('enter')">Join Match</button>
        </div>
    </div>
    `;
    
    const initLobby = () => { document.body.innerHTML = lobbyHTML; };
    if (document.body) { initLobby(); } else { document.addEventListener('DOMContentLoaded', initLobby); }

    let generatedCode = "";
    window.showStart = () => { document.getElementById('main-menu').style.display = 'none'; document.getElementById('start-menu').style.display = 'block'; };
    window.showEnter = () => { document.getElementById('main-menu').style.display = 'none'; document.getElementById('enter-menu').style.display = 'block'; };
    
    window.createCode = () => {
        generatedCode = Math.floor(1000 + Math.random() * 9000).toString();
        document.getElementById('room-code').innerText = "Code: " + generatedCode;
        document.getElementById('start-btn').style.display = 'block';
    };

    window.joinGame = (type) => {
        let code = type === 'start' ? generatedCode : document.getElementById('guest-code').value;
        if (!code) return alert("Please enter the access code.");
        
        const hiddenID = "Player_" + Math.floor(Math.random() * 1000000);
        
        sessionStorage.setItem('simName', hiddenID);
        sessionStorage.setItem('simCode', code);
        window.location.reload(); 
    };
    
    throw new Error("Waiting for lobby setup...");
}

// ---------------------------------------------------------
// WebSocket Interception
// ---------------------------------------------------------
const simName = sessionStorage.getItem('simName');
const simCode = sessionStorage.getItem('simCode');

window.addEventListener('DOMContentLoaded', () => {
    const leaveBtn = document.createElement('button');
    leaveBtn.innerText = "Leave Lobby (" + simCode + ")";
    leaveBtn.style.cssText = "position:fixed; bottom:20px; right:20px; z-index:99999; background:#e94560; color:white; border:2px solid #fff; padding:10px 15px; border-radius:8px; cursor:pointer; font-weight:bold; box-shadow: 0 4px 6px rgba(0,0,0,0.3);";
    leaveBtn.onclick = () => {
        sessionStorage.clear();
        window.location.reload();
    };
    document.body.appendChild(leaveBtn);
});

const originalWebSocket = window.WebSocket;
window.WebSocket = function(url, protocols) {
    const ws = new originalWebSocket(url, protocols);
    
    ws.addEventListener('open', function() {
        ws.send(JSON.stringify({ type: "CONNECT_LOBBY", code: simCode }));
    });

    const originalSend = ws.send;
    ws.send = function(data) {
        try {
            let parsed = JSON.parse(data);
            parsed.code = simCode; 
            if (parsed.type === 'PLAYER_READY') {
                parsed.name = simName; 
            }
            originalSend.call(this, JSON.stringify(parsed));
        } catch(e) {
            originalSend.call(this, data);
        }
    };
    return ws;
};

// =========================================================
// --- END OF LOBBY SYSTEM ---
// =========================================================


// =========================================================
// 1. STATE & LOBBY LOGIC
// =========================================================
let selectedDeck = null;
let localPlayerName = sessionStorage.getItem('simName'); 
let isMyTurn = false; 

const socket = new WebSocket(`wss://ws.mohamed-server.online`);

function loadDecks() {
    console.log("[FRONTEND] Requesting decks from /api/decks...");
    const grid = document.getElementById('deck-grid');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: white; padding: 20px;">Loading decks from server...</div>';

    fetch('/api/decks')
        .then(res => res.json())
        .then(data => {
            if(data.success && data.decks) {
                populateDeckGrid(data.decks);
            } else {
                grid.innerHTML = '<div style="color: #ff4444; padding: 20px;">Failed to load decks. Check Node terminal.</div>';
            }
        })
        .catch(err => {
            console.error("[FETCH ERROR]:", err);
            grid.innerHTML = `<div style="color: #ff4444; padding: 20px;">Connection Error: ${err.message}</div>`;
        });
}

function populateDeckGrid(decks) {
    const grid = document.getElementById('deck-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (decks.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ff4444; padding: 20px;">No decks found!</div>';
        return;
    }
    
    decks.forEach(deckImg => {
        const deckName = deckImg.split('.')[0]; 
        const cardDiv = document.createElement('div');
        cardDiv.className = 'deck-card';
        cardDiv.onclick = () => selectDeck(cardDiv, deckImg);
        
        cardDiv.innerHTML = `
            <img src="/images/${deckImg}" alt="${deckName}">
            <div class="deck-name">${deckName}</div>
        `;
        grid.appendChild(cardDiv);
    });
}

function selectDeck(element, deckImg) {
    document.querySelectorAll('.deck-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');
    selectedDeck = deckImg;
    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) readyBtn.disabled = false;
}

function submitPlayerReady() {
    localPlayerName = sessionStorage.getItem('simName');
    
    if(!selectedDeck) return;

    socket.send(JSON.stringify({
        type: "PLAYER_READY",
        name: localPlayerName,
        deck: selectedDeck
    }));

    const deckPanel = document.getElementById('deck-selection-panel');
    if (deckPanel) deckPanel.style.display = 'none';
    
    const statusMsg = document.getElementById('status-message');
    if (statusMsg) statusMsg.innerText = "Waiting for opponent to ready up...";
}

// =========================================================
// 2. WEBSOCKET CONNECTION
// =========================================================
socket.onopen = function() {
    const statusMsg = document.getElementById('status-message');
    if (statusMsg) statusMsg.innerText = "Connected. Waiting for Python Server...";
};

socket.onerror = function(error) {
    const statusMsg = document.getElementById('status-message');
    if (statusMsg) {
        statusMsg.style.color = "#ff4444"; 
        statusMsg.innerText = "Connection Error! Cannot reach Python Game Server. Check browser console (F12).";
    }
};

socket.onmessage = function(event) {
    const msg = JSON.parse(event.data);
    
    switch(msg.type) {
        case "WAITING":
            const statusMsg = document.getElementById('status-message');
            if (statusMsg) statusMsg.innerText = "Waiting for Player 2 to join...";
            break;

        case "CHOOSE_DECK":
            const msgEl = document.getElementById('status-message');
            if (msgEl) msgEl.innerText = "Opponent found! Choose your deck.";
            
            const deckPanel = document.getElementById('deck-selection-panel');
            if (deckPanel) deckPanel.style.display = 'flex';
            
            const oldNameInput = document.getElementById('player-name-input');
            if (oldNameInput) oldNameInput.style.display = 'none';

            loadDecks();
            break;

        case "PLAY_CARD_RESPANSE":
            // Extract card_id from the broadcast payload
            let playedCardId = null;
            const payloadData = msg.data || msg; 
            
            for (let key in payloadData) {
                if (key !== "type" && payloadData[key] === "OK") {
                    playedCardId = key;
                    break;
                }
            }

            if (playedCardId) {
                const cardElement = document.querySelector(`.card-wrapper[data-id='${playedCardId}']`);
                const characterArea = document.querySelector('#main .character');

                if (cardElement && characterArea) {
                    // Physically move the DOM element to the character area
                    characterArea.appendChild(cardElement);
                    
                    // Update the onclick handler so the modal reflects its new location
                    const imgNode = cardElement.querySelector('img');
                    if (imgNode) {
                        let rawSrc = imgNode.getAttribute('src').split('?')[0]; // strip cache buster
                        if (rawSrc.startsWith(window.location.origin)) {
                            rawSrc = rawSrc.replace(window.location.origin, '');
                        }
                        cardElement.onclick = () => openModal(rawSrc, true, 'character', 'character', playedCardId);
                    }
                    console.log(`[FRONTEND] Card ${playedCardId} successfully moved to character area.`);
                }
            }
            break;

        case "GAME_START":
        case "BOARD_UPDATE":
            const lobbyUI = document.getElementById('lobby-ui');
            if (lobbyUI) lobbyUI.style.display = 'none';
            
            const gameUI = document.getElementById('game-ui');
            if (gameUI) gameUI.style.display = 'flex';
            
            const sMsg = document.getElementById('status-message');
            if (sMsg) sMsg.style.display = 'none';

            try {
                const playerData = msg.data || msg.payload || msg.players || (Array.isArray(msg) ? msg : null);
                if (!playerData || !Array.isArray(playerData)) throw new Error("Could not find the player array from Python.");

                let mainPlayer = playerData.find(p => p.name === localPlayerName);
                let opponent = playerData.find(p => p.name !== localPlayerName);

                if (!mainPlayer || !opponent) {
                    console.warn("[FRONTEND] Name mismatch! Defaulting to Player 1 as Main.");
                    mainPlayer = playerData[0];
                    opponent = playerData[1];
                }

                buildBoard(mainPlayer, opponent);

            } catch (error) {
                console.error("[FRONTEND CRASH]", error);
            }
            break;
    }
};

// =========================================================
// 3. UI RENDERING LOGIC
// =========================================================
function getImagePath(imgName) {
    if (!imgName) return '';
    const basePath = imgName.startsWith('/images/') ? imgName : '/images/' + imgName;
    return basePath + "?t=" + new Date().getTime(); 
}

function handleImageError(imgElement, originalSrc) {
    imgElement.style.opacity = '1';
    imgElement.style.border = '2px solid #ff4444'; 
    imgElement.style.backgroundColor = '#4a0000';
}
function handleCardAction(actionName, cardId) {
    // 1. Close the modal so it gets out of the way
    document.getElementById('card-modal').style.display = 'none';

    // 2. Send the action and the card ID to your Python backend
    socket.send(JSON.stringify({
        type: "CARD_ACTION",
        action: actionName,
        card_id: cardId,
        player_name: localPlayerName 
    }));

    console.log(`Sent action: ${actionName} for card: ${cardId}`);
}
function openModal(imgSrc, isActionable, location = null, type = null, cardId = null) {
    const modal = document.getElementById('card-modal');
    const modalImg = document.getElementById('modal-img');
    const actionBtns = document.getElementById('modal-actions-container');

    modalImg.src = getImagePath(imgSrc);
    
    const activeTurn = (isMyTurn === true || String(isMyTurn).toLowerCase() === 'true');
    console.log(`[MODAL CLICK] Is it your turn? ${activeTurn} | Is card actionable? ${isActionable} | Location: ${location} | Type: ${type}`);
    
    // Clear out current buttons so we can dynamically add based on location AND type
    actionBtns.innerHTML = '';
    
    if (isActionable && activeTurn) {
        
        // --- EASILY MODIFIABLE ACTION BUTTONS START ---
        
        // 1. If the card is physically in your HAND
        if (location === 'hand') {
            // FIX: Safely convert the type to a string so arrays don't crash the script!
            let lowerType = String(type || '').toLowerCase();
            
            // FIX: Use .includes() so it catches 'character' even if it's inside a list
            if (lowerType.includes('character')) {
                actionBtns.innerHTML += `<button onclick="handleCardAction('PLAY_CHARACTER', '${cardId}')">Play Character</button>`;
            } else if (lowerType.includes('event')) {
                actionBtns.innerHTML += `<button onclick="handleCardAction('USE_EVENT', '${cardId}')">Use Event</button>`;
            } else if (lowerType.includes('stage')) {
                actionBtns.innerHTML += `<button onclick="handleCardAction('PLAY_STAGE', '${cardId}')">Play Stage</button>`;
            } else {
                actionBtns.innerHTML += `<button onclick="handleCardAction('PLAY_CARD', '${cardId}')">Play Card</button>`;
            }
            actionBtns.innerHTML += `<button onclick="handleCardAction('TRASH_CARD', '${cardId}')">Trash</button>`;
        }
        
        // 2. If the card is physically on the BOARD in the CHARACTER AREA
        else if (location === 'character') {
            actionBtns.innerHTML += `<button onclick="handleCardAction('TOGGLE_REST', '${cardId}')">Rest / Set Active</button>`;
            actionBtns.innerHTML += `<button onclick="handleCardAction('ATTACK', '${cardId}')">Attack</button>`;
        } 
        
        // 3. If the card is physically in the LEADER AREA
        else if (location === 'leader') {
            actionBtns.innerHTML += `<button onclick="handleCardAction('TOGGLE_REST', '${cardId}')">Rest / Set Active</button>`;
            actionBtns.innerHTML += `<button onclick="handleCardAction('ATTACK', '${cardId}')">Attack</button>`;
        } 
        
        // 4. If the card is physically in the COST AREA (DON deck)
        else if (location === 'cost') {
            actionBtns.innerHTML += `<button onclick="handleCardAction('ATTACH_DON', '${cardId}')">Attach DON!!</button>`;
        }
        
        // 5. If the card is physically in the STAGE AREA
        else if (location === 'stage') {
            actionBtns.innerHTML += `<button onclick="handleCardAction('USE_STAGE_EFFECT', '${cardId}')">Use Effect</button>`;
        }
        
        // Fallback
        else {
            actionBtns.innerHTML += `<button>Default Action</button>`;
        }
        
        // --- EASILY MODIFIABLE ACTION BUTTONS END ---
        
        actionBtns.style.display = 'flex';
    } else {
        actionBtns.style.display = 'none';
    }
    
    modal.style.display = 'flex';
}

function closeModal(e) {
    if (e.target.id === 'card-modal') {
        document.getElementById('card-modal').style.display = 'none';
    }
}

function createCardNode(imgSrc, isTapped, statsText = null, isActionable = false, cardId = null, location = null, type = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';
    
    if (cardId !== null && cardId !== undefined) {
        wrapper.dataset.id = cardId;
    }

    wrapper.onclick = () => openModal(imgSrc, isActionable, location, type, cardId);

    const imgContainer = document.createElement('div');
    imgContainer.className = 'card-img-container';
    if (isTapped) imgContainer.classList.add('tapped');

    const img = document.createElement('img');
    img.src = getImagePath(imgSrc); 
    img.onerror = () => handleImageError(img, imgSrc);

    imgContainer.appendChild(img);
    wrapper.appendChild(imgContainer);

    if (statsText) {
        const stats = document.createElement('div');
        stats.className = 'card-stats';
        stats.innerHTML = statsText;
        wrapper.appendChild(stats);
    }
    return wrapper;
}

// CHANGED: renderDon now expects [X, Y, Z] format directly 
function renderDon(donArray, playerId, donImg) {
    const costArea = document.querySelector("#" + playerId + " .cost");
    if (!costArea) return;
    const label = costArea.querySelector('.slot-label');
    costArea.innerHTML = '';
    if(label) costArea.appendChild(label);
    
    // Ensure array is properly structured [X, Y, Z]
    if (!Array.isArray(donArray) || donArray.length !== 3) return;

    const usableX = donArray[0];
    const tappedY = donArray[1];
    const deckZ = donArray[2];

    // Render X usable cards (forced horizontal as requested)
    for (let i = 0; i < usableX; i++) {
        const card = createCardNode(donImg, false, null, false, null, 'cost', 'don');
        const imgContainer = card.querySelector('.card-img-container');
        if (imgContainer) imgContainer.style.transform = 'rotate(90deg)';
        card.style.margin = '10px 15px'; // Spacing fix for rotation
        costArea.appendChild(card);
    }

    // Render Y tapped cards (forced vertical as requested)
    for (let i = 0; i < tappedY; i++) {
        const card = createCardNode(donImg, true, null, false, null, 'cost', 'don');
        const imgContainer = card.querySelector('.card-img-container');
        if (imgContainer) imgContainer.style.transform = 'rotate(0deg)';
        costArea.appendChild(card);
    }

    // Render Z deck (show exactly 1 card if Z > 0)
    //if (deckZ > 0) {
    //    const deckCard = createCardNode(donImg, false, `Deck: ${deckZ}`, false, null, 'cost', 'don');
    //    costArea.appendChild(deckCard);
    //}
}

function renderLife(count, playerId, lifeImg) {
    const lifeArea = document.querySelector("#" + playerId + " .life");
    if (!lifeArea) return;
    const label = lifeArea.querySelector('.slot-label');
    lifeArea.innerHTML = '';
    if(label) lifeArea.appendChild(label);

    const safeCount = Number(count) || 0;
    for (let i = 0; i < safeCount; i++) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'life-card-wrapper';
        // Location = 'life', Type = 'card' (or life)
        cardDiv.onclick = () => openModal(lifeImg, false, 'life', 'card');

        const img = document.createElement('img');
        img.src = getImagePath(lifeImg);
        img.onerror = () => handleImageError(img, lifeImg);

        cardDiv.appendChild(img);
        lifeArea.appendChild(cardDiv);
    }
}

function setLeader(leaderData, playerId) {
    const leaderArea = document.querySelector("#" + playerId + " .leader");
    if (!leaderArea) return;
    const label = leaderArea.querySelector('.slot-label');
    leaderArea.innerHTML = '';
    if(label) leaderArea.appendChild(label);

    if (leaderData && leaderData.img && leaderData.img !== "") {
        const stats = "PWR: " + leaderData.power;
        const isActionable = (playerId === 'main'); 
        // Location = 'leader', Type = 'leader'
        leaderArea.appendChild(createCardNode(leaderData.img, leaderData.is_tapped, stats, isActionable, leaderData.id, 'leader', 'leader'));
    }
}

function setStage(stageData, playerId) {
    const stageArea = document.querySelector("#" + playerId + " .stage");
    if (!stageArea) return;
    const label = stageArea.querySelector('.slot-label');
    stageArea.innerHTML = '';
    if(label) stageArea.appendChild(label);

    let imagePath = typeof stageData === 'string' ? stageData : (stageData?.img || "");
    let stageId = typeof stageData === 'object' ? stageData?.id : null;

    if (imagePath && imagePath !== "") {
        const isActionable = (playerId === 'main');
        // Location = 'stage', Type = 'stage'
        stageArea.appendChild(createCardNode(imagePath, false, null, isActionable, stageId, 'stage', 'stage'));
    }
}

function setCharacterArea(charactersData, playerId) {
    const charArea = document.querySelector("#" + playerId + " .character");
    if (!charArea) return;
    const label = charArea.querySelector('.slot-label');
    charArea.innerHTML = '';
    if(label) charArea.appendChild(label);

    if (!charactersData) return;

    charactersData.forEach(char => {
        let loc = char.location || 'character';
        let typ = char.type || 'character';
        
        if(loc === 'character') {
            const stats = "C:" + char.cost + " | P:" + char.power + " | DONx" + char.nb_don;
            const isActionable = (playerId === 'main'); 
            // Ensures both location and type are explicitly passed along
            charArea.appendChild(createCardNode(char.img, char.is_tapped, stats, isActionable, char.id, loc, typ));
        }
    });
}

function setDeck(playerId, deckImg) {
    const deckArea = document.querySelector("#" + playerId + " .deck");
    if (!deckArea) return;
    const label = deckArea.querySelector('.slot-label');
    deckArea.innerHTML = '';
    if(label) deckArea.appendChild(label);

    const img = document.createElement('img');
    img.src = getImagePath(deckImg);
    img.onerror = () => handleImageError(img, deckImg);
    
    // Location = 'deck', Type = 'card'
    img.onclick = () => openModal(deckImg, false, 'deck', 'card');
    deckArea.appendChild(img);
}

function setHand(handData, playerId, isOpponent, cardBackImg) {
    const handArea = document.querySelector("#" + playerId + "-hand");
    if (!handArea) return;
    const label = handArea.querySelector('.slot-label');
    handArea.innerHTML = '';
    if(label) handArea.appendChild(label);

    if (!handData) return;

    handData.forEach(card => {
        let loc = card.location || 'hand';
        let typ = card.type || 'card';
        
        if (isOpponent) {
            handArea.appendChild(createCardNode(cardBackImg, false, null, false, card.id, loc, typ));
        } else {
            const stats = "C:" + card.cost + " | P:" + card.power + " | DONx" + card.nb_don;
            handArea.appendChild(createCardNode(card.img, card.is_tapped, stats, true, card.id, loc, typ));
        }
    });
}

function buildBoard(mainData, oppData) {
    const mainNameEl = document.getElementById('main-name');
    const oppNameEl = document.getElementById('opp-name');

    isMyTurn = (mainData.is_active === true || String(mainData.is_active).toLowerCase() === 'true');
    console.log(`[BOARD RENDER] Is it my turn?`, isMyTurn);

    if (mainNameEl) mainNameEl.innerText = "You";
    if (oppNameEl) oppNameEl.innerText = "Opponent";

    const isMainActive = (mainData.is_active === true || String(mainData.is_active).toLowerCase() === 'true');
    const isOppActive = (oppData.is_active === true || String(oppData.is_active).toLowerCase() === 'true');

    if (mainNameEl) {
        mainNameEl.style.color = isMainActive ? "#FFD700" : "#FFFFFF";
        mainNameEl.style.fontWeight = isMainActive ? "bold" : "normal";
    }
    if (oppNameEl) {
        oppNameEl.style.color = isOppActive ? "#FFD700" : "#FFFFFF";
        oppNameEl.style.fontWeight = isOppActive ? "bold" : "normal";
    }

    // Build Main Player Side
    setLeader(mainData.leader, 'main');
    setStage(mainData.stageImg, 'main');
    setDeck('main', mainData.cardBackImg);
    renderDon(mainData.donCards, 'main', mainData.donImg);
    renderLife(mainData.lifeCount, 'main', mainData.cardBackImg);
    setCharacterArea(mainData.characters, 'main');
    setHand(mainData.hand, 'main', false, mainData.cardBackImg);

    // Build Opponent Side
    setLeader(oppData.leader, 'opponent');
    setStage(oppData.stageImg, 'opponent');
    setDeck('opponent', oppData.cardBackImg);
    renderDon(oppData.donCards, 'opponent', oppData.donImg);
    renderLife(oppData.lifeCount, 'opponent', oppData.cardBackImg);
    setCharacterArea(oppData.characters, 'opponent');
    setHand(oppData.hand, 'opponent', true, oppData.cardBackImg);
}