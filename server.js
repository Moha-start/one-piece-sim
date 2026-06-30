// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

app.use(express.json()); 

// Serve the current directory (for index.html and game.js)
app.use(express.static(__dirname));

// Set up the single images path
const imagesPath = path.join(__dirname, 'images');
app.use('/images', express.static(imagesPath));

// API Route: Send the list of available decks to the frontend
app.get('/api/decks', (req, res) => {
    console.log("[SERVER API] Frontend requested the deck list...");
    
    try {
        const allFiles = fs.readdirSync(imagesPath);
        console.log(`[SERVER API] Successfully read 'images' folder. Found ${allFiles.length} total files.`);
        
        // This regex specifically finds files exactly matching ST-01.png to ST-30.png or ST01-001.png
        let stLeaders = allFiles.filter(file => file.match(/^ST-\d{2}\.png$/i));
        stLeaders.sort();
        
        console.log(`[SERVER API] Filtered down to ${stLeaders.length} valid deck images.`);
        res.json({ success: true, decks: stLeaders });
        
    } catch (err) {
        console.error("[SERVER ERROR] Could not read 'images' directory.", err);
        res.json({ success: false, decks: [], error: err.message });
    }
});

// API Route: Receive Deck Choice
app.post('/api/select-deck', (req, res) => {
    const chosenDeck = req.body.deck;
    
    console.log('\n==========================================');
    console.log(`✅ [DECK SELECTED]: ${chosenDeck}`);
    console.log('==========================================\n');

    res.json({ success: true, deck: chosenDeck });
});

// Route: Simulator
app.get('/play', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`[SYSTEM] Server running on http://localhost:${PORT}`);
});