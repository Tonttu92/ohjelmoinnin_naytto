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

    // Luodaan taulu ilmoituksille, jos sitä ei ole
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
    console.log("Tietokanta valmis!");
})();

// --- API REITIT ---

// Hae kaikki
app.get('/api/items', async (req, res) => {
    const items = await db.all('SELECT * FROM items ORDER BY id DESC');
    // Muutetaan viestit takaisin tekstistä listaksi
    const parsedItems = items.map(i => ({ ...i, messages: JSON.parse(i.messages || '[]') }));
    res.json(parsedItems);
});

// Lisää uusi
app.post('/api/items', async (req, res) => {
    const { owner, name, desc, cat, price, img, date } = req.body;
    await db.run(
        'INSERT INTO items (owner, name, desc, cat, price, img, messages, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [owner, name, desc, cat, price, img, '[]', date]
    );
    res.status(201).json({ message: "Tallennettu tietokantaan!" });
});

// Lisää viesti
app.post('/api/items/:id/messages', async (req, res) => {
    const item = await db.get('SELECT messages FROM items WHERE id = ?', [req.params.id]);
    if (item) {
        const msgs = JSON.parse(item.messages || '[]');
        msgs.push(req.body);
        await db.run('UPDATE items SET messages = ? WHERE id = ?', [JSON.stringify(msgs), req.params.id]);
        res.json({ message: "Viesti tallennettu" });
    } else {
        res.status(404).send("Ei löytynyt");
    }
});

// Poista
app.delete('/api/items/:id', async (req, res) => {
    await db.run('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.json({ message: "Poistettu tietokannasta" });
});

app.listen(PORT, () => console.log(`Palvelin ja tietokanta pyörii: http://localhost:${PORT}`));