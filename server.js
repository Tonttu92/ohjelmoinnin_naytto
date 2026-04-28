const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

let db;

// ALUSTA TIETOKANTA
(async () => {
    db = await open({
        filename: './tietokanta.db',
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner TEXT,
            name TEXT,
            desc TEXT,
            cat TEXT,
            price TEXT,
            img TEXT,
            messages TEXT,
            date TEXT
        )
    `);
    console.log("Palvelin ja tietokanta valmis osoitteessa http://localhost:3000");
})();

// API: Hae kaikki ilmoitukset
app.get('/api/items', async (req, res) => {
    try {
        const items = await db.all('SELECT * FROM items ORDER BY id DESC');
        const parsedItems = items.map(i => ({ 
            ...i, 
            messages: JSON.parse(i.messages || '[]') 
        }));
        res.json(parsedItems);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Lisää uusi ilmoitus
app.post('/api/items', async (req, res) => {
    try {
        const { owner, name, desc, cat, price, img, date } = req.body;
        await db.run(
            'INSERT INTO items (owner, name, desc, cat, price, img, messages, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [owner, name, desc, cat, price, img, '[]', date]
        );
        res.status(201).json({ message: "Ilmoitus tallennettu" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Lisää yksityisviesti
app.post('/api/items/:id/messages', async (req, res) => {
    try {
        const { from, txt, to } = req.body;
        const item = await db.get('SELECT messages FROM items WHERE id = ?', [req.params.id]);
        
        if (item) {
            const msgs = JSON.parse(item.messages || '[]');
            msgs.push({ from, txt, to, date: new Date().toISOString() });
            await db.run('UPDATE items SET messages = ? WHERE id = ?', [JSON.stringify(msgs), req.params.id]);
            res.json({ message: "Viesti tallennettu" });
        } else {
            res.status(404).send("Ilmoitusta ei löytynyt");
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Poista ilmoitus
app.delete('/api/items/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM items WHERE id = ?', [req.params.id]);
        res.json({ message: "Ilmoitus poistettu onnistuneesti!" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Palvelin käynnistetty: http://localhost:${PORT}`);
});