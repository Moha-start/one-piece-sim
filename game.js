console.log("🚀🚀🚀 HELLO FROM GAME.JS! I AM ACTUALLY RUNNING! 🚀🚀🚀");

// =========================================================
// 1. STATE & LOBBY LOGIC
// =========================================================
let selectedDeck = null;
let localPlayerName = ""; 
let isMyTurn = false; // Tracks if it's the local player's turn

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
    const nameInput = document.getElementById('player-name-input');
    localPlayerName = (nameInput && nameInput.value.trim()) || "Player"; 
    
    if(!selectedDeck) return;

    socket.send(JSON.stringify({
        type: "PLAYER_READY",
        name: localPlayerName,
        deck: selectedDeck
    }));

    document.getElementById('deck-selection-panel').style.display = 'none';
    document.getElementById('status-message').innerText = "Waiting for opponent to ready up...";
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
            document.getElementById('status-message').innerText = "Waiting for Player 2 to join...";
            break;

        case "CHOOSE_DECK":
            document.getElementById('status-message').innerText = "Opponent found! Choose your deck.";
            document.getElementById('deck-selection-panel').style.display = 'flex';
            loadDecks();
            break;

        case "GAME_START":
        case "BOARD_UPDATE":
            document.getElementById('lobby-ui').style.display = 'none';
            document.getElementById('game-ui').style.display = 'flex';

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

function openModal(imgSrc, isActionable) {
    const modal = document.getElementById('card-modal');
    const modalImg = document.getElementById('modal-img');
    const actionBtns = document.getElementById('modal-actions-container');

    modalImg.src = getImagePath(imgSrc);
    
    // LOGIC FIX: Safely parse boolean, string 'true', or string 'True' from Python
    const activeTurn = (isMyTurn === true || String(isMyTurn).toLowerCase() === 'true');
    
    // Debug log to show exactly what's happening
    console.log(`[MODAL CLICK] Is it your turn? ${activeTurn} | Is card actionable? ${isActionable}`);
    
    // Only display action buttons if the card is yours AND it's your turn
    actionBtns.style.display = (isActionable && activeTurn) ? 'flex' : 'none';
    
    modal.style.display = 'flex';
}

function closeModal(e) {
    if (e.target.id === 'card-modal') {
        document.getElementById('card-modal').style.display = 'none';
    }
}

function createCardNode(imgSrc, isTapped, statsText = null, isActionable = false, cardId = null) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';
    
    if (cardId !== null && cardId !== undefined) {
        wrapper.dataset.id = cardId;
    }

    wrapper.onclick = () => openModal(imgSrc, isActionable);

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

function renderDon(donArray, playerId, donImg) {
    const costArea = document.querySelector("#" + playerId + " .cost");
    const label = costArea.querySelector('.slot-label');
    costArea.innerHTML = '';
    if(label) costArea.appendChild(label);
    
    if (!donArray) return;

    const tappedDons = donArray.filter(isTapped => isTapped === true);
    const untappedDons = donArray.filter(isTapped => isTapped === false);
    
    [...tappedDons, ...untappedDons].forEach(isTapped => {
        costArea.appendChild(createCardNode(donImg, isTapped, null, false));
    });
}

function renderLife(count, playerId, lifeImg) {
    const lifeArea = document.querySelector("#" + playerId + " .life");
    const label = lifeArea.querySelector('.slot-label');
    lifeArea.innerHTML = '';
    if(label) lifeArea.appendChild(label);

    const safeCount = Number(count) || 0;
    for (let i = 0; i < safeCount; i++) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'life-card-wrapper';
        cardDiv.onclick = () => openModal(lifeImg, false);

        const img = document.createElement('img');
        img.src = getImagePath(lifeImg);
        img.onerror = () => handleImageError(img, lifeImg);

        cardDiv.appendChild(img);
        lifeArea.appendChild(cardDiv);
    }
}

function setLeader(leaderData, playerId) {
    const leaderArea = document.querySelector("#" + playerId + " .leader");
    const label = leaderArea.querySelector('.slot-label');
    leaderArea.innerHTML = '';
    if(label) leaderArea.appendChild(label);

    if (leaderData && leaderData.img && leaderData.img !== "") {
        const stats = "PWR: " + leaderData.power;
        const isActionable = (playerId === 'main'); // NEW: Only your leader is actionable
        leaderArea.appendChild(createCardNode(leaderData.img, leaderData.is_tapped, stats, isActionable, leaderData.id));
    }
}

function setStage(stageData, playerId) {
    const stageArea = document.querySelector("#" + playerId + " .stage");
    const label = stageArea.querySelector('.slot-label');
    stageArea.innerHTML = '';
    if(label) stageArea.appendChild(label);

    let imagePath = typeof stageData === 'string' ? stageData : (stageData?.img || "");
    let stageId = typeof stageData === 'object' ? stageData?.id : null;

    if (imagePath && imagePath !== "") {
        const isActionable = (playerId === 'main'); // NEW: Only your stage is actionable
        stageArea.appendChild(createCardNode(imagePath, false, null, isActionable, stageId));
    }
}

function setCharacterArea(charactersData, playerId) {
    const charArea = document.querySelector("#" + playerId + " .character");
    const label = charArea.querySelector('.slot-label');
    charArea.innerHTML = '';
    if(label) charArea.appendChild(label);

    if (!charactersData) return;

    charactersData.forEach(char => {
        if(char.location === 'character') {
            const stats = "C:" + char.cost + " | P:" + char.power + " | DONx" + char.nb_don;
            const isActionable = (playerId === 'main'); // NEW: Only your characters are actionable
            charArea.appendChild(createCardNode(char.img, char.is_tapped, stats, isActionable, char.id));
        }
    });
}

function setDeck(playerId, deckImg) {
    const deckArea = document.querySelector("#" + playerId + " .deck");
    const label = deckArea.querySelector('.slot-label');
    deckArea.innerHTML = '';
    if(label) deckArea.appendChild(label);

    const img = document.createElement('img');
    img.src = getImagePath(deckImg);
    img.onerror = () => handleImageError(img, deckImg);
    img.onclick = () => openModal(deckImg, false);
    deckArea.appendChild(img);
}

function setHand(handData, playerId, isOpponent, cardBackImg) {
    const handArea = document.querySelector("#" + playerId + "-hand");
    const label = handArea.querySelector('.slot-label');
    handArea.innerHTML = '';
    if(label) handArea.appendChild(label);

    if (!handData) return;

    handData.forEach(card => {
        if (isOpponent) {
            handArea.appendChild(createCardNode(cardBackImg, false, null, false, card.id));
        } else {
            const stats = "C:" + card.cost + " | P:" + card.power + " | DONx" + card.nb_don;
            handArea.appendChild(createCardNode(card.img, card.is_tapped, stats, true, card.id));
        }
    });
}

function buildBoard(mainData, oppData) {
    const mainNameEl = document.getElementById('main-name');
    const oppNameEl = document.getElementById('opp-name');

    // FIX: Parse Python's bool/string robustly
    isMyTurn = (mainData.is_active === true || String(mainData.is_active).toLowerCase() === 'true');
    console.log(`[BOARD RENDER] Is it my turn?`, isMyTurn);

    // Display Names & Turn Highlighting
    mainNameEl.innerText = mainData.name || "Main Player";
    oppNameEl.innerText = oppData.name || "Opponent";

    const isMainActive = (mainData.is_active === true || String(mainData.is_active).toLowerCase() === 'true');
    const isOppActive = (oppData.is_active === true || String(oppData.is_active).toLowerCase() === 'true');

    mainNameEl.style.color = isMainActive ? "#FFD700" : "#FFFFFF";
    mainNameEl.style.fontWeight = isMainActive ? "bold" : "normal";
    oppNameEl.style.color = isOppActive ? "#FFD700" : "#FFFFFF";
    oppNameEl.style.fontWeight = isOppActive ? "bold" : "normal";

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