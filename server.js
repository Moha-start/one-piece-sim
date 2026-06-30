// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

// Allows Express to understand JSON data sent from the browser
app.use(express.json()); 

// ==========================================
// SERVER-SIDE DIRECTORY PATHS
// ==========================================
const imagesPath = path.join(__dirname, 'images');
const starterDecksPath = path.join(__dirname, 'starter_deck_images_raw');

// Serve the static files from their respective folders
app.use('/images', express.static(imagesPath));
app.use('/starter_deck_images_raw', express.static(starterDecksPath));

// Catch missing game images and log an error
app.use('/images', (req, res) => {
    console.error(`[SERVER ERROR] Game image NOT FOUND on disk: ${path.join(imagesPath, req.url)}`);
    res.status(404).send('Not found');
});

// ==========================================
// ROUTE: DECK SELECTION (/choose-deck)
// ==========================================
app.get('/choose-deck', (req, res) => {
    let stLeaders = [];
    
    try {
        // Read the new starter_deck_images_raw folder
        const allFiles = fs.readdirSync(starterDecksPath);
        
        // Filter out ONLY the Leader cards for the Starter Decks (ST-01.png to ST-30.png)
        stLeaders = allFiles.filter(file => file.match(/^ST-\d{2}\.png$/));
        
        // Sort them alphabetically so ST-01 comes before ST-02, etc.
        stLeaders.sort();
    } catch (err) {
        console.error("[SERVER ERROR] Could not read starter_deck_images_raw directory.", err);
    }

    // Generate the HTML for the selection screen
    let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Choose Your Deck</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                background-color: #121212;
                color: #ffffff;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 40px;
            }
            h1 {
                margin-bottom: 30px;
                color: #b32d2e;
                border-bottom: 2px solid #b32d2e;
                padding-bottom: 10px;
            }
            .grid-container {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 25px;
                width: 100%;
                max-width: 1200px;
            }
            .deck-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
                background-color: #1e1e1e;
                padding: 10px;
                border-radius: 8px;
                border: 1px solid #333;
            }
            .deck-card:hover {
                transform: translateY(-8px);
                box-shadow: 0 12px 24px rgba(0,0,0,0.8);
                border-color: #b32d2e;
            }
            .deck-card img {
                width: 120px;
                height: 168px;
                object-fit: cover;
                border-radius: 4px;
                box-shadow: 2px 4px 8px rgba(0,0,0,0.6);
                background-color: #333;
            }
            .deck-name {
                margin-top: 12px;
                font-size: 14px;
                font-weight: bold;
                color: #ddd;
            }
            /* Toast notification */
            #toast {
                visibility: hidden;
                min-width: 250px;
                background-color: #333;
                color: #fff;
                text-align: center;
                border-radius: 4px;
                padding: 16px;
                position: fixed;
                z-index: 1;
                bottom: 30px;
                font-size: 17px;
                border: 1px solid #4CAF50;
            }
            #toast.show {
                visibility: visible;
                animation: fadein 0.5s, fadeout 0.5s 2.5s;
            }
            @keyframes fadein {
                from {bottom: 0; opacity: 0;}
                to {bottom: 30px; opacity: 1;}
            }
            @keyframes fadeout {
                from {bottom: 30px; opacity: 1;}
                to {bottom: 0; opacity: 0;}
            }
        </style>
    </head>
    <body>
        <h1>Select Your Starter Deck</h1>
        
        <div class="grid-container">
    `;

    // Loop through the found leaders and inject them into the HTML
    // Updated image path to match the new static folder route
    stLeaders.forEach(deckImg => {
        const deckName = deckImg.split('.')[0]; // Turns "ST-01.png" into "ST-01"
        htmlContent += `
            <div class="deck-card" onclick="selectDeck('` + deckImg + `')">
                <img src="/starter_deck_images_raw/` + deckImg + `" alt="` + deckName + `">
                <div class="deck-name">` + deckName + `</div>
            </div>
        `;
    });

    htmlContent += `
        </div>
        <div id="toast">Deck chosen! Check terminal.</div>

        <script>
            function selectDeck(imgName) {
                // Sends the chosen image name to the server
                fetch('/api/select-deck', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deck: imgName })
                })
                .then(response => response.json())
                .then(data => {
                    // Show confirmation popup
                    const toast = document.getElementById("toast");
                    toast.innerText = "Chosen: " + imgName + " (Logged to Terminal)";
                    toast.className = "show";
                    setTimeout(function(){ toast.className = toast.className.replace("show", ""); }, 3000);
                })
                .catch(error => console.error('Error:', error));
            }
        </script>
    </body>
    </html>
    `;

    res.send(htmlContent);
});

// ==========================================
// API ROUTE: RECEIVE DECK CHOICE
// ==========================================
app.post('/api/select-deck', (req, res) => {
    const chosenDeck = req.body.deck;
    
    console.log('\n==========================================');
    console.log(`✅ [DECK SELECTED]: ${chosenDeck}`);
    console.log('==========================================\n');

    res.json({ success: true, deck: chosenDeck });
});

// ==========================================
// ONE PIECE SIMULATOR ROUTE (/play)
// ==========================================
app.get('/play', (req, res) => {

    // ==========================================
    // DATA INJECTION ZONE
    // ==========================================
    const opponent = {
        name: "Roronoa Zoro (Opponent)",
        donImg: "DON.png",
        cardBackImg: "normal.png",
        leader: { img: "ST08-001.png", is_tapped: false, power: 5000 },
        stageImg: "",
        lifeCount: 3,
        donCards: [false, false, true, true, false, false, false],
        characters: [
            { location: "character", img: "ST08-003.png", is_tapped: true, cost: 9, power: 10000, nb_don: 0 },
            { location: "character", img: "ST08-008.png", is_tapped: false, cost: 2, power: 3000, nb_don: 1 },
            { location: "character", img: "ST08-011.png", is_tapped: true, cost: 3, power: 4000, nb_don: 2 },
            { location: "character", img: "ST08-008.png", is_tapped: false, cost: 2, power: 3000, nb_don: 1 },
            { location: "character", img: "ST08-011.png", is_tapped: true, cost: 3, power: 4000, nb_don: 2 }
        ],
        hand: [
            { location: "hand", img: "ST08-004.png", is_tapped: false, cost: 5, power: 6000, nb_don: 0 },
            { location: "hand", img: "ST08-005.png", is_tapped: false, cost: 4, power: 5000, nb_don: 0 },
            { location: "hand", img: "ST08-006.png", is_tapped: false, cost: 3, power: 4000, nb_don: 0 },
            { location: "hand", img: "ST08-007.png", is_tapped: false, cost: 2, power: 3000, nb_don: 0 }
        ]
    };

    const mainPlayer = {
        name: "Monkey D. Luffy (You)",
        donImg: "DON.png",
        cardBackImg: "normal.png",
        leader: { img: "ST01-001.png", is_tapped: true, power: 5000 },
        stageImg: "OP01-033.png", 
        lifeCount: 5,
        donCards: [false, true, false, false],
        characters: [
            { location: "character", img: "ST01-012.png", is_tapped: false, cost: 3, power: 5000, nb_don: 1 },
            { location: "character", img: "ST01-013.png", is_tapped: true, cost: 4, power: 6000, nb_don: 0 }
        ],
        hand: [
            { location: "hand", img: "ST01-014.png", is_tapped: false, cost: 2, power: 3000, nb_don: 0 },
            { location: "hand", img: "ST01-015.png", is_tapped: false, cost: 1, power: 2000, nb_don: 0 },
            { location: "hand", img: "ST01-016.png", is_tapped: false, cost: 5, power: 6000, nb_don: 0 },
            { location: "hand", img: "ST01-017.png", is_tapped: false, cost: 2, power: 3000, nb_don: 0 }
        ]
    };

    // ==========================================

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>One Piece Card Game Simulator</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            
            body {
                background-color: #121212;
                color: #ffffff;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                width: 100vw;
                height: 100vh;
                overflow: hidden; 
                display: flex;
                flex-direction: row;
                justify-content: space-between;
                align-items: stretch;
            }

            /* --- SIDEBAR HANDS --- */
            .hand-board {
                width: 18vw; 
                min-width: 150px;
                background-color: #1a1a1a;
                padding: 40px 15px 20px 15px;
                display: flex;
                flex-direction: row;
                flex-wrap: wrap;
                align-content: flex-start;
                justify-content: center;
                gap: 15px;
                position: relative;
                overflow-y: auto; 
            }
            .hand-board.main-bg { border-right: 2px dashed #444; }
            .hand-board.opponent-bg { border-left: 2px dashed #4a1e1f; background-color: #221818; }

            .hand-board .slot-label {
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 14px;
                background: #000;
                padding: 2px 10px;
                border-radius: 4px;
                border: 1px solid #444;
            }

            /* --- CENTER BATTLEFIELD --- */
            .center-boards {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: 3vh; 
                padding: 10px;
            }

            .player-board {
                position: relative;
                display: grid;
                /* DEFAULT LAYOUT (Main Player) */
                grid-template-areas:
                    "life character character leader stage"
                    "life trash cost cost deck";
                grid-template-columns: 85px 100px 420px 85px 85px; 
                grid-template-rows: 125px 125px; 
                gap: 12px;
                padding: 25px;
                background-color: #1e1e1e;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.6);
                border: 1px solid #333;
            }

            /* INVERTED LAYOUT (Opponent) */
            .opponent-board {
                grid-template-areas:
                    "deck cost cost trash life"
                    "stage leader character character life";
                grid-template-columns: 85px 85px 420px 100px 85px; 
                background-color: #221818; 
                border: 1px solid #4a1e1f;
            }

            .name-tag {
                position: absolute;
                top: -15px;
                left: 20px;
                background: #b32d2e;
                padding: 4px 15px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 13px;
                z-index: 10;
                box-shadow: 0 4px 8px rgba(0,0,0,0.5);
            }
            
            .opponent-board .name-tag {
                left: auto;
                right: 20px;
            }

            .slot {
                border: 2px dashed #444;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0, 0, 0, 0.5);
                position: relative;
                color: rgba(255, 255, 255, 0.15);
                font-size: 10px;
                font-weight: bold;
                text-transform: uppercase;
            }

            .slot-label {
                position: absolute;
                z-index: 0;
                pointer-events: none;
            }

            .card-wrapper {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 2;
                cursor: pointer;
                transition: transform 0.1s;
                min-width: 65px; 
            }
            
            .card-wrapper:hover {
                transform: scale(1.05);
            }

            /* --- BOARD CARD SIZING --- */
            .card-img-container {
                position: relative;
                width: 65px;  
                height: 91px; 
                flex-shrink: 0; 
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s;
            }

            /* --- HAND CARD SIZING --- */
            .hand-board .card-wrapper {
                min-width: 85px; 
            }
            .hand-board .card-img-container {
                width: 85px;
                height: 119px;
            }

            .card-img-container.tapped img {
                transform: rotate(90deg) scale(0.70);
            }

            .card-img-container img {
                width: 100%;
                height: 100%;
                object-fit: cover; 
                border-radius: 4px;
                box-shadow: 2px 4px 8px rgba(0,0,0,0.6);
                transition: transform 0.2s ease-in-out;
                background-color: #333; 
            }

            .card-stats {
                margin-top: 4px;
                font-size: 9px; 
                background: #000;
                color: #fff;
                padding: 2px 5px;
                border-radius: 3px;
                border: 1px solid #555;
                white-space: nowrap;
                z-index: 5;
            }

            .life { grid-area: life; flex-direction: column; }
            
            .character { 
                grid-area: character; 
                flex-direction: row; 
                gap: 8px; 
                flex-wrap: nowrap; 
                justify-content: center; 
            }
            
            .leader { grid-area: leader; }
            .stage { grid-area: stage; }
            .trash { grid-area: trash; }
            .cost { grid-area: cost; flex-direction: row; flex-wrap: nowrap; justify-content: center; }
            .deck { grid-area: deck; }

            .life-card-wrapper {
                width: 65px;
                height: 91px;
                margin-top: -70px; 
                z-index: 2;
                cursor: pointer;
                transition: transform 0.1s;
            }
            .life-card-wrapper:hover { transform: translateY(-5px); }
            .life-card-wrapper:first-child { margin-top: 0; }
            .life-card-wrapper img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 4px;
                box-shadow: -2px 2px 6px rgba(0,0,0,0.6);
                transform: rotate(90deg) scale(0.85);
            }

            .cost .card-wrapper { margin-left: -45px; }
            .cost .card-wrapper:first-of-type { margin-left: 0; }
            
            .deck img, .stage img {
                width: 65px;
                height: 91px;
                object-fit: cover;
                border-radius: 4px;
                background-color: #333;
                cursor: pointer;
            }
            .deck img:hover { transform: scale(1.05); }

            /* ==========================================
               MODAL (ZOOM VIEW) STYLES
               ========================================== */
            .modal-overlay {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0, 0, 0, 0.85);
                display: none; 
                justify-content: center;
                align-items: center;
                z-index: 9999;
                backdrop-filter: blur(5px);
            }
            .modal-content {
                display: flex;
                flex-direction: row;
                align-items: center;
                gap: 40px;
            }
            .modal-img-container img {
                height: 70vh; 
                border-radius: 12px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            }
            .modal-actions {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            .modal-actions button {
                padding: 12px 24px;
                background-color: #333;
                color: white;
                border: 1px solid #555;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.2s;
            }
            .modal-actions button:hover {
                background-color: #b32d2e;
                border-color: #ff4444;
            }
        </style>
    </head>
    <body>

        <div id="main-hand" class="hand-board main-bg">
            <span class="slot-label">Your Hand</span>
        </div>

        <div class="center-boards">
            <div id="opponent" class="player-board opponent-board">
                <div class="name-tag">\${opponent.name}</div>
                <div class="slot life"><span class="slot-label">Life</span></div>
                <div class="slot character"><span class="slot-label">Character Area</span></div>
                <div class="slot leader"><span class="slot-label">Leader</span></div>
                <div class="slot stage"><span class="slot-label">Stage</span></div>
                <div class="slot trash"><span class="slot-label">Trash</span></div>
                <div class="slot cost"><span class="slot-label">Cost Area</span></div>
                <div class="slot deck"><span class="slot-label">Deck</span></div>
            </div>

            <div id="main" class="player-board main-bg">
                <div class="name-tag">\${mainPlayer.name}</div>
                <div class="slot life"><span class="slot-label">Life</span></div>
                <div class="slot character"><span class="slot-label">Character Area</span></div>
                <div class="slot leader"><span class="slot-label">Leader</span></div>
                <div class="slot stage"><span class="slot-label">Stage</span></div>
                <div class="slot trash"><span class="slot-label">Trash</span></div>
                <div class="slot cost"><span class="slot-label">Cost Area</span></div>
                <div class="slot deck"><span class="slot-label">Deck</span></div>
            </div>
        </div>

        <div id="opponent-hand" class="hand-board opponent-bg">
            <span class="slot-label">Opponent Hand</span>
        </div>

        <div id="card-modal" class="modal-overlay" onclick="closeModal(event)">
            <div class="modal-content">
                <div class="modal-img-container">
                    <img id="modal-img" src="" alt="Expanded Card">
                </div>
                <div id="modal-actions-container" class="modal-actions">
                    <button>Rest / Set Active</button>
                    <button>Attach DON!!</button>
                    <button>Send to Trash</button>
                    <button>Return to Hand</button>
                </div>
            </div>
        </div>

        <script>
            function getImagePath(imgName) {
                if (!imgName) return '';
                const basePath = imgName.startsWith('/images/') ? imgName : '/images/' + imgName;
                return basePath + "?t=" + new Date().getTime(); 
            }

            function handleImageError(imgElement, originalSrc) {
                console.error("[FRONTEND ERROR] Failed to load image: " + originalSrc);
                imgElement.style.opacity = '1';
                imgElement.style.border = '2px solid #ff4444'; 
                imgElement.style.backgroundColor = '#4a0000';
            }

            // --- MODAL LOGIC ---
            function openModal(imgSrc, isActionable) {
                const modal = document.getElementById('card-modal');
                const modalImg = document.getElementById('modal-img');
                const actionBtns = document.getElementById('modal-actions-container');

                modalImg.src = getImagePath(imgSrc);

                if (isActionable) {
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
                const sortedDons = [...tappedDons, ...untappedDons];
                
                sortedDons.forEach(isTapped => {
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

            window.onload = () => {
                const mainData = ${JSON.stringify(mainPlayer)};
                const oppData = ${JSON.stringify(opponent)};

                // Main Player Setup
                setLeader(mainData.leader, 'main');
                setStage(mainData.stageImg, 'main');
                setDeck('main', mainData.cardBackImg);
                renderDon(mainData.donCards, 'main', mainData.donImg);
                renderLife(mainData.lifeCount, 'main', mainData.cardBackImg);
                setCharacterArea(mainData.characters, 'main');
                setHand(mainData.hand, 'main', false, mainData.cardBackImg);

                // Opponent Setup
                setLeader(oppData.leader, 'opponent');
                setStage(oppData.stageImg, 'opponent');
                setDeck('opponent', oppData.cardBackImg);
                renderDon(oppData.donCards, 'opponent', oppData.donImg);
                renderLife(oppData.lifeCount, 'opponent', oppData.cardBackImg);
                setCharacterArea(oppData.characters, 'opponent');
                setHand(oppData.hand, 'opponent', true, oppData.cardBackImg);
            };
        </script>
    </body>
    </html>
    `;

    res.send(htmlContent);
});

// ==========================================
// CATCH-ALL STATIC FILE SERVER
// ==========================================
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`[SYSTEM] Server running on http://localhost:${PORT}`);
    console.log(`[SYSTEM] Access the game simulator at http://localhost:${PORT}/play`);
    console.log(`[SYSTEM] Access the deck chooser at http://localhost:${PORT}/choose-deck`);
});