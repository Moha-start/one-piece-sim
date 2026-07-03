// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

// =========================================================
// 1. GENERATE RANDOM ID FOR THIS SPECIFIC SERVER RUN
// =========================================================
const SERVER_RUN_ID = Math.random().toString(36).substring(2, 15);

// =========================================================
// 2. FORCE BROWSER TO NEVER CACHE FILES AGAIN
// =========================================================
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.json()); 

// Serve the current directory
app.use(express.static(__dirname));

// Serve images
const imagesPath = path.join(__dirname, 'images');
app.use('/images', express.static(imagesPath));

// =========================================================
// 3. NEW API: SEND SERVER ID TO FRONTEND
// =========================================================
app.get('/api/version', (req, res) => {
    res.json({ version: SERVER_RUN_ID });
});

// API Route: Send the list of available decks
app.get('/api/decks', (req, res) => {
    try {
        const allFiles = fs.readdirSync(imagesPath);
        let stLeaders = allFiles.filter(file => file.match(/^ST-\d{2}\.png$/i));
        stLeaders.sort();
        res.json({ success: true, decks: stLeaders });
    } catch (err) {
        res.json({ success: false, decks: [], error: err.message });
    }
});

// API Route: Receive Deck Choice
app.post('/api/select-deck', (req, res) => {
    res.json({ success: true, deck: req.body.deck });
});

// Route: Simulator
app.get('/play', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`[SYSTEM] Server running on http://localhost:${PORT}`);
    console.log(`[SYSTEM] Current Server Run ID: ${SERVER_RUN_ID}`);
});