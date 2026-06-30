// game.js

// =========================================================
// 1. STATE & LOBBY LOGIC
// =========================================================
let selectedDeck = null;
const socket = new WebSocket('ws://localhost:8765');

function loadDecks() {
    console.log("[FRONTEND] Requesting decks from /api/decks...");
    const grid = document.getElementById('deck-grid');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: white; padding: 20px;">Loading decks from server...</div>';

    fetch('/api/decks')
        .then(res => {
            console.log("[FRONTEND] Received response from server. Status:", res.status);
            return res.json();
        })
        .then(data => {
            console.log("[FRONTEND] Parsed JSON data:", data);
            if(data.success && data.decks) {
                populateDeckGrid(data.decks);
            } else {
                console.error("[FRONTEND ERROR] Server returned failure or no decks.");
                grid.innerHTML = '<div style="color: #ff4444; padding: 20px;">Failed to load decks. Check Node terminal.</div>';
            }
        })
        .catch(err => {
            console.error("[FETCH ERROR]:", err);
            grid.innerHTML = `<div style="color: #ff4444; padding: 20px;">Connection Error: ${err.message}</div>`;
        });
}

function populateDeckGrid(decks) {
    console.log(`[FRONTEND] Populating grid with ${decks.length} decks.`);
    const grid = document.getElementById('deck-grid');
    if (!grid) {
        console.error("[DOM ERROR] Element #deck-grid not found.");
        return;
    }
    grid.innerHTML = '';
    
    if (decks.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #ff4444; padding: 20px; border: 2px dashed #ff4444;">0 valid decks found! Make sure leader cards are in the /images folder.</div>';
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
    console.log(`[FRONTEND] User selected deck: ${deckImg}`);
    document.querySelectorAll('.deck-card').forEach(c => c.classList.remove('selected'));
    
    element.classList.add('selected');
    selectedDeck = deckImg;

    const readyBtn = document.getElementById('ready-btn');
    if (readyBtn) readyBtn.disabled = false;
}

function submitPlayerReady() {
    const nameInput = document.getElementById('player-name-input');
    const playerName = (nameInput && nameInput.value.trim()) || "Player";
    
    if(!selectedDeck) {
        console.error("[FRONTEND] Attempted to ready up without a deck.");
        return;
    }

    console.log(`[FRONTEND] Sending PLAYER_READY to Python: ${playerName}, Deck: ${selectedDeck}`);
    socket.send(JSON.stringify({
        type: "PLAYER_READY",
        name: playerName,
        deck: selectedDeck
    }));

    document.getElementById('deck-selection-panel').style.display = 'none';
    document.getElementById('status-message').innerText = "Waiting for opponent to ready up...";
}

// =========================================================
// 2. WEBSOCKET CONNECTION TO PYTHON SERVER
// =========================================================
socket.onopen = function() {
    console.log("[WEBSOCKET] Connected to Python Game Server");
    document.getElementById('status-message').innerText = "Connected. Waiting for Python Server...";
};

socket.onmessage = function(event) {
    const msg = JSON.parse(event.data);
    console.log("[WEBSOCKET] Received message type:", msg.type);
    
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
            console.log("[FRONTEND] GAME_START received. Initializing board.");
            document.getElementById('lobby-ui').style.display = 'none';
            document.getElementById('game-ui').style.display = 'flex';
            buildBoard(msg.data.mainPlayer, msg.data.opponent);
            break;
            
        case "ATTACK_RESOLVED":
            console.log(`Attack! ${msg.data.attacker} -> ${msg.data.target}`);
            break;
    }
};

// =========================================================
// 3. UI RENDERING LOGIC (The Board)
// =========================================================
function getImagePath(imgName) {
    if (!imgName) return '';
    const basePath = imgName.startsWith('/images/') ? imgName : '/images/' + imgName;
    return basePath + "?t=" + new Date().getTime(); 
}

function handleImageError(imgElement, originalSrc) {
    console.error("[FRONTEND ERROR] Failed to load board image: " + originalSrc);
    imgElement.style.opacity = '1';
    imgElement.style.border = '2px solid #ff4444'; 
    imgElement.style.backgroundColor = '#4a0000';
}

function openModal(imgSrc, isActionable) {
    const modal = document.getElementById('card-modal');
    const modalImg = document.getElementById('modal-img');
    const actionBtns = document.getElementById('modal-actions-container');

    modalImg.src = getImagePath(imgSrc);
    actionBtns.style.display = isActionable ? 'flex' : 'none';
    modal.style.display = 'flex';
}

function closeModal(e) {
    if (e.target.id === 'card-modal') {
        document.getElementById('card-modal').style.display = 'none';
    }
}

function createCardNode(imgSrc, isTapped, statsText = null, isActionable = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';
    wrapper.onclick = () => openModal(imgSrc, isActionable);

    const imgContainer = document.createElement('div');
    imgContainer.className = 'card-img-container';
    if (isTapped) imgContainer.classList.add('tapped');

    const img = document.createElement('img');
    const fullPath = getImagePath(imgSrc);
    img.src = fullPath; 
    img.onerror = () => handleImageError(img, fullPath);

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

    for (let i = 0; i < count; i++) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'life-card-wrapper';
        cardDiv.onclick = () => openModal(lifeImg, false);

        const img = document.createElement('img');
        const fullPath = getImagePath(lifeImg);
        img.src = fullPath;
        img.onerror = () => handleImageError(img, fullPath);

        cardDiv.appendChild(img);
        lifeArea.appendChild(cardDiv);
    }
}

function setLeader(leaderData, playerId) {
    const leaderArea = document.querySelector("#" + playerId + " .leader");
    const label = leaderArea.querySelector('.slot-label');
    leaderArea.innerHTML = '';
    if(label) leaderArea.appendChild(label);

    if (leaderData && leaderData.img) {
        const stats = "PWR: " + leaderData.power;
        leaderArea.appendChild(createCardNode(leaderData.img, leaderData.is_tapped, stats, true));
    }
}

function setStage(imagePath, playerId) {
    const stageArea = document.querySelector("#" + playerId + " .stage");
    const label = stageArea.querySelector('.slot-label');
    stageArea.innerHTML = '';
    if(label) stageArea.appendChild(label);

    if (imagePath) {
        stageArea.appendChild(createCardNode(imagePath, false, null, true));
    }
}

function setCharacterArea(charactersData, playerId) {
    const charArea = document.querySelector("#" + playerId + " .character");
    const label = charArea.querySelector('.slot-label');
    charArea.innerHTML = '';
    if(label) charArea.appendChild(label);

    charactersData.forEach(char => {
        if(char.location === 'character') {
            const stats = "C:" + char.cost + " | P:" + char.power + " | DONx" + char.nb_don;
            charArea.appendChild(createCardNode(char.img, char.is_tapped, stats, true));
        }
    });
}

function setDeck(playerId, deckImg) {
    const deckArea = document.querySelector("#" + playerId + " .deck");
    const label = deckArea.querySelector('.slot-label');
    deckArea.innerHTML = '';
    if(label) deckArea.appendChild(label);

    const img = document.createElement('img');
    const fullPath = getImagePath(deckImg);
    img.src = fullPath;
    img.onerror = () => handleImageError(img, fullPath);
    img.onclick = () => openModal(deckImg, false);
    deckArea.appendChild(img);
}

function setHand(handData, playerId, isOpponent, cardBackImg) {
    const handArea = document.querySelector("#" + playerId + "-hand");
    const label = handArea.querySelector('.slot-label');
    handArea.innerHTML = '';
    if(label) handArea.appendChild(label);

    handData.forEach(card => {
        if (isOpponent) {
            handArea.appendChild(createCardNode(cardBackImg, false, null, false));
        } else {
            const stats = "C:" + card.cost + " | P:" + card.power + " | DONx" + card.nb_don;
            handArea.appendChild(createCardNode(card.img, card.is_tapped, stats, true));
        }
    });
}

function buildBoard(mainData, oppData) {
    document.getElementById('main-name').innerText = mainData.name;
    document.getElementById('opp-name').innerText = oppData.name;

    setLeader(mainData.leader, 'main');
    setStage(mainData.stageImg, 'main');
    setDeck('main', mainData.cardBackImg);
    renderDon(mainData.donCards, 'main', mainData.donImg);
    renderLife(mainData.lifeCount, 'main', mainData.cardBackImg);
    setCharacterArea(mainData.characters, 'main');
    setHand(mainData.hand, 'main', false, mainData.cardBackImg);

    setLeader(oppData.leader, 'opponent');
    setStage(oppData.stageImg, 'opponent');
    setDeck('opponent', oppData.cardBackImg);
    renderDon(oppData.donCards, 'opponent', oppData.donImg);
    renderLife(oppData.lifeCount, 'opponent', oppData.cardBackImg);
    setCharacterArea(oppData.characters, 'opponent');
    setHand(oppData.hand, 'opponent', true, oppData.cardBackImg);
}