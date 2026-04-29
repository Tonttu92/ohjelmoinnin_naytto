const API_URL = 'http://localhost:3000/api';

const App = {
    // Tila (State)
    data: {
        users: JSON.parse(localStorage.getItem('k_users')) || {}, 
        items: [], 
        currentUser: sessionStorage.getItem('k_user') || null,
        activeFilter: 'kaikki',
        searchTerm: ''
    },

    // Alustus
    async init() {
        console.log("App alustetaan...");
       this.data.items = [
           {
               id: 1, 
               owner: "Jari",
                name: "Polkupyörä myynnissä",
                desc: "Hyväkuntoinen maastopyörä, vähän käytetty.",
                cat: "Myydään",
                price: 120,
                img: null,
                date: "27.4.2026",
                messages: []
            },
            {
               id: 2,
               owner: "Laura",
               name: "Sohva annetaan",
               desc: "Siisti sohva, nouto tänään.",
               cat: "Annetaan",
               price: null,
               img: null,
               date: "27.4.2026",
               messages: []
               },
              {
               id: 3,
               owner: "Mikko",
               name: "PlayStation 5 myynnissä",
               desc: "Hyväkuntoinen PS5, mukaan yksi ohjain ja pelejä. Toimii moitteettomasti.",
               cat: "Myydään",
               price: 450,
               img: null,
               date: "27.4.2026",
               messages: []
             },
             {
               id: 4,
               owner: "Antti",
               name: "Ostetaan pelituoli",
               desc: "Etsin hyväkuntoista pelituolia. Hinta noin 30–80€ kunnosta riippuen.",
               cat: "Ostetaan",
               price: "30–80",
               img: null,
               date: "27.4.2026",
               messages: []
              }
            ];

        if (this.data.currentUser) {
            this.showApp();
            this.renderList('kaikki');
           
        }
        this.tarkistaHinta();
    },

    // --- PALVELINYHTEYDET ---
    async lataaPalvelimelta() {
        this.setLoading(true);
        try {
            const response = await fetch(`${API_URL}/items`);
            if (!response.ok) throw new Error("Haku epäonnistui");
            this.data.items = await response.json();
            
            // Selvitetään mikä sivu on auki
            const otsikkoElem = document.getElementById('listan-otsikko');
            let moodi = 'kaikki';
            if (otsikkoElem) {
                if (otsikkoElem.innerText.includes('Omat ilmoituksesi')) moodi = 'omat';
                if (otsikkoElem.innerText.includes('Omat keskustelusi')) moodi = 'viestit';
            }
            this.renderList(moodi);
        } catch (e) {
            console.error("Virhe ladattaessa ilmoituksia:", e);
        } finally {
            this.setLoading(false);
        }
    },

    // --- AUTENTIKAATIO ---
    handleAuth() {
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value.trim();

        if (u.length < 3) return alert("Tunnus liian lyhyt!");

        if (!this.data.users[u]) {
            this.data.users[u] = p;
            localStorage.setItem('k_users', JSON.stringify(this.data.users));
            alert("Tunnus luotu!");
        } else if (this.data.users[u] !== p) {
            return alert("Väärä salasana!");
        }

        this.data.currentUser = u;
        sessionStorage.setItem('k_user', u);
        this.showApp();
        this.renderList('kaikki');
    },

    logout() {
        sessionStorage.removeItem('k_user');
        location.reload();
    },

    // --- ILMOITUSTEN JA VIESTIEN HALLINTA ---
    async lisaaIlmoitus() {
        const nimi = document.getElementById('p-nimi').value.trim();
        const kuvaus = document.getElementById('p-kuvaus').value.trim();
        const kategoria = document.getElementById('p-kategoria').value;
        const hinta = document.getElementById('p-hinta').value;
        const kuvaInput = document.getElementById('p-kuva');

        if (!nimi || !kuvaus) return alert("Täytä pakolliset kentät!");

        this.setLoading(true);
        let imgBase64 = null;
        if (kuvaInput.files && kuvaInput.files.length > 0) {
            imgBase64 = await this.fileToBase64(kuvaInput.files[0]);
        }

        const uusiIlmoitus = {
            owner: this.data.currentUser,
            name: nimi,
            desc: kuvaus,
            cat: kategoria,
            price: (kategoria === "Myydään" || kategoria === "Vuokrataan") ? hinta : null,
            img: imgBase64,
            date: new Date().toLocaleDateString('fi-FI')
        };

        try {
            const response = await fetch(`${API_URL}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(uusiIlmoitus)
            });
            if (response.ok) {
                this.tyhjennaLomake();
                await this.lataaPalvelimelta();
            }
        } catch (e) { alert("Tallennus epäonnistui"); }
        this.setLoading(false);
    },

    async lahetaViesti(id) {
        const inp = document.getElementById(`in-${id}`);
        const teksti = inp.value.trim();
        if (!teksti) return;

        const item = this.data.items.find(i => i.id === id);
        const viesti = { 
            from: this.data.currentUser, 
            txt: teksti,
            to: item.owner 
        };

        try {
            const response = await fetch(`${API_URL}/items/${id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(viesti)
            });
            if (response.ok) {
                inp.value = '';
                await this.lataaPalvelimelta();
            }
        } catch (e) { alert("Viestin lähetys epäonnistui"); }
    },

    async vastaa(itemId, vastapuoli) {
        const teksti = prompt(`Vastaa käyttäjälle ${vastapuoli}:`);
        if (!teksti) return;

        const viesti = { 
            from: this.data.currentUser, 
            txt: teksti,
            to: vastapuoli 
        };

        try {
            const response = await fetch(`${API_URL}/items/${itemId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(viesti)
            });
            if (response.ok) await this.lataaPalvelimelta();
        } catch (e) { alert("Vastaus epäonnistui"); }
    },

    async poista(id) {
        if (!confirm("Haluatko varmasti poistaa ilmoituksen?")) return;
        try {
            const response = await fetch(`${API_URL}/items/${id}`, { method: 'DELETE' });
            if (response.ok) await this.lataaPalvelimelta();
        } catch (e) { alert("Poisto epäonnistui"); }
    },

    // --- UI RENDERÖINTI ---
    renderList(moodi) {
        const container = document.getElementById('tuotelista');
        const otsikko = document.getElementById('listan-otsikko');
        if (!container || !otsikko) return;

        container.innerHTML = '';
        let naytettavat = this.data.items;

        if (moodi === 'omat') {
            naytettavat = this.data.items.filter(i => i.owner === this.data.currentUser);
            otsikko.innerText = "Omat ilmoituksesi";
        } else if (moodi === 'viestit') {
            naytettavat = this.data.items.filter(i => 
                i.owner === this.data.currentUser || 
                i.messages.some(m => m.from === this.data.currentUser || m.to === this.data.currentUser)
            );
            otsikko.innerText = "Omat keskustelusi";
        } else {
            otsikko.innerText = "Tuoreimmat ilmoitukset";
        }

        // Suodatus haku- ja kategoriakenttien mukaan
        if (this.data.activeFilter !== 'kaikki') {
            naytettavat = naytettavat.filter(i => i.cat === this.data.activeFilter);
        }
        if (this.data.searchTerm) {
            naytettavat = naytettavat.filter(i => 
                i.name.toLowerCase().includes(this.data.searchTerm) || 
                i.desc.toLowerCase().includes(this.data.searchTerm)
            );
        }

        if (naytettavat.length === 0) {
            container.innerHTML = `<div class="bg-white p-10 text-center rounded-2xl border-2 border-dashed text-slate-400">Ei ilmoituksia 😕</div>`;
            return;
        }

        naytettavat.forEach(item => {
            const omatViestit = item.messages.filter(m => 
                m.from === this.data.currentUser || m.to === this.data.currentUser || item.owner === this.data.currentUser
            );

            const viestitHtml = omatViestit.map(m => `
                <div class="p-3 rounded-xl mb-2 ${m.from === this.data.currentUser ? 'bg-blue-50 border-l-4 border-blue-400 ml-4' : 'bg-slate-100 mr-4'}">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] font-bold uppercase tracking-wide ${m.from === this.data.currentUser ? 'text-blue-600' : 'text-slate-500'}">
                            ${m.from} -> ${m.to || 'Myyjä'}
                        </span>
                        ${(item.owner === this.data.currentUser && m.from !== this.data.currentUser) ? 
                            `<button onclick="App.vastaa(${item.id}, '${m.from}')" class="text-[9px] bg-white border px-2 py-1 rounded shadow-sm hover:bg-blue-600 hover:text-white transition">Vastaa</button>` : ''}
                    </div>
                    <p class="text-sm">${m.txt}</p>
                </div>
            `).join('');

            const card = document.createElement('div');
            card.className = "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6";
            card.innerHTML = `
                ${item.img ? `<img src="${item.img}" class="w-full h-48 object-cover">` : ''}
                <div class="p-5">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 uppercase">${item.cat}</span>
                            <h3 class="text-xl font-bold mt-2">${item.name} ${item.price ? `<span class="text-emerald-600 ml-1">${item.price}€</span>` : ''}</h3>
                        </div>
                        <small class="text-slate-400 font-medium">Myyjä: ${item.owner}</small>
                    </div>
                    <p class="text-slate-500 text-sm mt-3">${item.desc}</p>
                    
                    <div class="mt-6 pt-6 border-t border-slate-100">
                        <h4 class="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Keskustelu</h4>
                        <div class="space-y-1">${viestitHtml || '<p class="text-xs text-slate-300 italic">Ei viestejä vielä.</p>'}</div>
                        
                        <div class="flex gap-2 mt-4">
                            <input type="text" id="in-${item.id}" placeholder="Kirjoita viesti..." class="flex-1 p-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
                            <button onclick="App.lahetaViesti(${item.id})" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-100">Lähetä</button>
                        </div>

                        ${item.owner === this.data.currentUser ? `
                            <button onclick="App.poista(${item.id})" class="mt-4 w-full text-red-500 text-[10px] font-bold py-2 border border-red-50 rounded-xl hover:bg-red-50 transition">Poista ilmoitus</button>
                        ` : ''}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    },

    // --- APUFUNKTIOT ---
    suodata() {
        this.data.activeFilter = document.getElementById('suodatin-kategoria').value;
        this.data.searchTerm = document.getElementById('haku-kentta').value.toLowerCase().trim();
        const otsikko = document.getElementById('listan-otsikko')?.innerText || '';
        let moodi = 'kaikki';
        if (otsikko.includes('Omat ilmoituksesi')) moodi = 'omat';
        if (otsikko.includes('Omat keskustelusi')) moodi = 'viestit';
        this.renderList(moodi);
    },

    showApp() {
        document.getElementById('auth-section')?.classList.add('hidden');
        document.getElementById('main-section')?.classList.remove('hidden');
        const display = document.getElementById('user-display');
        if (display) display.innerText = this.data.currentUser;
    },

    tarkistaHinta() {
        const kElem = document.getElementById('p-kategoria');
        const hContainer = document.getElementById('hinta-container');
        if (kElem && hContainer) {
            hContainer.style.display = (kElem.value === 'Myydään' || kElem.value === 'Vuokrataan') ? 'block' : 'none';
        }
    },

    tyhjennaLomake() {
        ['p-nimi', 'p-kuvaus', 'p-hinta', 'p-kuva'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    },

    fileToBase64(file) {
        return new Promise(res => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.readAsDataURL(file);
        });
    },

    setLoading(s) { 
        const loader = document.getElementById('loading-indicator');
        if (loader) loader.classList.toggle('hidden', !s); 
    },

    naytaSivu(m) { this.renderList(m); }
};

// Käynnistys
App.init();
