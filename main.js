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
            
            // Selvitetään kumpi sivu on auki otsikon perusteella
            const otsikkoElem = document.getElementById('listan-otsikko');
            const moodi = (otsikkoElem && otsikkoElem.innerText.includes('Omat')) ? 'omat' : 'kaikki';
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

    // --- ILMOITUSTEN HALLINTA ---
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
                document.getElementById('p-nimi').value = '';
                document.getElementById('p-kuvaus').value = '';
                document.getElementById('p-hinta').value = '';
                document.getElementById('p-kuva').value = '';
                await this.lataaPalvelimelta();
            }
        } catch (e) {
            alert("Tallennus epäonnistui");
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
            }
        } catch (e) {
            alert("Poisto epäonnistui");
        }
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
        } catch (e) {
            alert("Viestin lähetys epäonnistui");
        }
    },

    // --- UI RENDERÖINTI ---
    renderList(moodi) {
        const container = document.getElementById('tuotelista');
        const otsikko = document.getElementById('listan-otsikko');
        if (!container || !otsikko) return;

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
            
            // YKSITYISVIESTIEN SUODATUS
            const viestitHtml = item.messages
                .filter(m => m.from === this.data.currentUser || item.owner === this.data.currentUser || !m.to)
                .map(m => `
                    <div class="text-[11px] p-2 rounded-lg mb-1 ${m.from === this.data.currentUser ? 'bg-blue-50 ml-4 border-l-2 border-blue-400' : 'bg-slate-50 mr-4'}">
                        <b class="text-slate-700">${m.from}:</b> ${m.txt}
                        <span class="block opacity-40 text-[9px] mt-1">🔒 Yksityinen</span>
                    </div>
                `).join('');

            const card = document.createElement('div');
            card.className = "bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden";
            card.innerHTML = `
                ${item.img ? `<img src="${item.img}" class="w-full h-48 object-cover">` : ''}
                <div class="p-5">
                    <span class="bg-${vari}-100 text-${vari}-700 text-[10px] font-bold px-2 py-1 rounded uppercase">${item.cat}</span>
                    <h3 class="text-lg font-bold mt-2">${item.name} ${item.price ? `<span class="text-emerald-600 ml-2">${item.price}€</span>` : ''}</h3>
                    <p class="text-slate-500 text-sm my-2">${item.desc}</p>
                    <div class="border-t mt-4 pt-4">
                        <small class="text-slate-400 block mb-2 font-medium">Myyjä: ${item.owner}</small>
                        <div class="space-y-1 mb-4">${viestitHtml}</div>
                        <div class="flex gap-2">
                            <input type="text" id="in-${item.id}" placeholder="Kysy myyjältä..." class="flex-1 p-2 text-xs bg-slate-50 border rounded-lg outline-none">
                            <button onclick="App.lahetaViesti(${item.id})" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold">Lähetä</button>
                        </div>
                        ${item.owner === this.data.currentUser ? `
                            <button onclick="App.poista(${item.id})" class="mt-4 w-full text-red-500 text-[10px] font-bold py-2 border border-red-100 rounded-lg hover:bg-red-50 transition">Poista ilmoitus</button>
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
        const moodi = document.getElementById('listan-otsikko')?.innerText.includes('Omat') ? 'omat' : 'kaikki';
        this.renderList(moodi);
    },

    showApp() {
        const auth = document.getElementById('auth-section');
        const main = document.getElementById('main-section');
        if (auth) auth.classList.add('hidden');
        if (main) main.classList.remove('hidden');
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
