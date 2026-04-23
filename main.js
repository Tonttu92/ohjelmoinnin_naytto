// --- KIRPPIS APP v3.0 (Fullstack Edition) ---
const API_URL = 'http://localhost:3000/api';

const App = {
    // Tila (State)
    data: {
        users: JSON.parse(localStorage.getItem('k_users')) || {}, // Käyttäjätunnukset säilyvät selaimessa (yksinkertaisuuden vuoksi)
        items: [], // Ilmoitukset haetaan palvelimelta
        currentUser: sessionStorage.getItem('k_user') || null,
        activeFilter: 'kaikki',
        searchTerm: ''
    },

    // Alustus
    async init() {
        if (this.data.currentUser) {
            this.showApp();
            await this.lataaPalvelimelta();
        }
        this.tarkistaHinta();
    },

    // --- PALVELINYHTEYDET (API CALLS) ---
    async lataaPalvelimelta() {
        this.setLoading(true);
        try {
            const response = await fetch(`${API_URL}/items`);
            if (!response.ok) throw new Error("Haku epäonnistui");
            this.data.items = await response.json();
            this.renderList(document.getElementById('listan-otsikko')?.innerText.includes('Omat') ? 'omat' : 'kaikki');
        } catch (e) {
            this.notify("Virhe ladattaessa ilmoituksia: " + e.message, "error");
        } finally {
            this.setLoading(false);
        }
    },

    // --- AUTENTIKAATIO ---
    handleAuth() {
        const u = document.getElementById('username').value.trim();
        const p = document.getElementById('password').value.trim();

        if (u.length < 3) return this.notify("Tunnus liian lyhyt!", "error");

        if (!this.data.users[u]) {
            this.data.users[u] = p;
            localStorage.setItem('k_users', JSON.stringify(this.data.users));
            this.notify("Tunnus luotu!", "success");
        } else if (this.data.users[u] !== p) {
            return this.notify("Väärä salasana!", "error");
        }

        this.data.currentUser = u;
        sessionStorage.setItem('k_user', u);
        this.showApp();
        this.lataaPalvelimelta();
    },

    logout() {
        sessionStorage.removeItem('k_user');
        location.reload();
    },

    // --- ILMOITUSTEN HALLINTA ---
    async lisaaIlmoitus() {
        const nimi = document.getElementById('p-nimi').value.trim();
        const kuvaus = document.getElementById('p-kuvaus').value.trim();
        const kategoria = document.getElementById('p-kategoria').value;
        const hinta = document.getElementById('p-hinta').value;
        const kuvaInput = document.getElementById('p-kuva');

        if (!nimi || !kuvaus) return this.notify("Täytä pakolliset kentät!", "error");

        this.setLoading(true);

        let imgBase64 = null;
        if (kuvaInput.files.length > 0) {
            imgBase64 = await this.fileToBase64(kuvaInput.files[0]);
        }

        const uusiIlmoitus = {
            owner: this.data.currentUser,
            name: nimi,
            desc: kuvaus,
            cat: kategoria,
            price: (kategoria === "Myydään" || kategoria === "Vuokrataan") ? hinta : null,
            img: imgBase64,
            messages: [],
            date: new Date().toLocaleDateString('fi-FI')
        };

        try {
            const response = await fetch(`${API_URL}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(uusiIlmoitus)
            });

            if (response.ok) {
                // Tyhjennetään lomake
                document.getElementById('p-nimi').value = '';
                document.getElementById('p-kuvaus').value = '';
                document.getElementById('p-hinta').value = '';
                document.getElementById('p-kuva').value = '';
                await this.lataaPalvelimelta();
                this.notify("Ilmoitus julkaistu!", "success");
            }
        } catch (e) {
            this.notify("Tallennus epäonnistui", "error");
        } finally {
            this.setLoading(false);
        }
    },

    async poista(id) {
        if (!confirm("Haluatko varmasti poistaa ilmoituksen?")) return;
        
        try {
            const response = await fetch(`${API_URL}/items/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await this.lataaPalvelimelta();
                this.notify("Poistettu!", "success");
            }
        } catch (e) {
            this.notify("Poisto epäonnistui", "error");
        }
    },

    async lahetaViesti(id) {
        const inp = document.getElementById(`in-${id}`);
        const teksti = inp.value.trim();
        if (!teksti) return;

        const viesti = { from: this.data.currentUser, txt: teksti };

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
        } catch (e) {
            this.notify("Viestin lähetys epäonnistui", "error");
        }
    },

    // --- UI RENDERÖINTI ---
    renderList(moodi) {
        const container = document.getElementById('tuotelista');
        const otsikko = document.getElementById('listan-otsikko');
        container.innerHTML = '';

        let naytettavat = (moodi === 'omat') ? this.data.items.filter(i => i.owner === this.data.currentUser) : this.data.items;
        otsikko.innerText = (moodi === 'omat') ? "Omat ilmoituksesi" : "Tuoreimmat ilmoitukset";

        if (this.data.activeFilter !== 'kaikki') naytettavat = naytettavat.filter(i => i.cat === this.data.activeFilter);
        if (this.data.searchTerm) {
            naytettavat = naytettavat.filter(i => 
                i.name.toLowerCase().includes(this.data.searchTerm) || 
                i.desc.toLowerCase().includes(this.data.searchTerm)
            );
        }

        if (naytettavat.length === 0) {
            container.innerHTML = `<div class="text-center py-12 text-slate-400 bg-white rounded-2xl border-2 border-dashed">Ei ilmoituksia 😕</div>`;
            return;
        }

        const varit = { 'Myydään': 'emerald', 'Ostetaan': 'blue', 'Annetaan': 'amber', 'Vaihdetaan': 'purple', 'Vuokrataan': 'orange' };

        naytettavat.forEach(item => {
            const vari = varit[item.cat] || 'slate';
            const card = document.createElement('div');
            card.className = "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all";
            card.innerHTML = `
                ${item.img ? `<img src="${item.img}" class="w-full h-48 object-cover">` : ''}
                <div class="p-5">
                    <div class="flex justify-between items-start mb-2">
                        <span class="bg-${vari}-100 text-${vari}-700 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wider">${item.cat}</span>
                        <span class="text-slate-400 text-xs">${item.date || 'Tänään'}</span>
                    </div>
                    <h3 class="text-xl font-bold text-slate-800">${item.name}</h3>
                    <p class="text-slate-600 my-2 text-sm">${item.desc}</p>
                    ${item.price ? `<div class="text-2xl font-black text-emerald-600 mb-4">${item.price} €</div>` : '<div class="h-4"></div>'}
                    
                    <div class="border-t pt-4">
                        <small class="text-slate-400 block mb-2 font-medium">Myyjä: ${item.owner}</small>
                        <div class="space-y-2 mb-4">
                            ${item.messages.map(m => `<div class="text-xs bg-slate-50 p-2 rounded-lg"><b>${m.from}:</b> ${m.txt}</div>`).join('')}
                        </div>
                        <div class="flex gap-2">
                            <input type="text" id="in-${item.id}" placeholder="Kysy myyjältä..." class="flex-1 p-2 text-sm bg-slate-50 border rounded-lg outline-none">
                            <button onclick="App.lahetaViesti(${item.id})" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Lähetä</button>
                        </div>
                        ${item.owner === this.data.currentUser ? `
                            <button onclick="App.poista(${item.id})" class="mt-4 w-full text-red-500 text-xs font-bold py-2 border border-red-500/10 rounded-lg hover:bg-red-50 transition">Poista ilmoitus</button>
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
        this.renderList(document.getElementById('listan-otsikko').innerText.includes('Omat') ? 'omat' : 'kaikki');
    },

    showApp() {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('main-section').classList.remove('hidden');
        document.getElementById('user-display').innerText = this.data.currentUser;
    },

    tarkistaHinta() {
        const k = document.getElementById('p-kategoria').value;
        document.getElementById('hinta-container').style.display = (k === 'Myydään' || k === 'Vuokrataan') ? 'block' : 'none';
    },

    fileToBase64(file) {
        return new Promise(res => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.readAsDataURL(file);
        });
    },

    setLoading(s) { document.getElementById('loading-indicator')?.classList.toggle('hidden', !s); },
    notify(txt) { alert(txt); },
    naytaSivu(m) { this.renderList(m); }
};

App.init();