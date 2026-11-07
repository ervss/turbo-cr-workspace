# Turbo.cr Workspace (Samostatná verzia) — Tipy, triky a novinky

Tento návod a prehľad funkcií je určený pre používateľov **Turbo.cr Workspace (Standalone Edition v2.2.0)** od **[ervss](https://github.com/ervss)**.

---

## 🆕 Čo je nové vo verzii 2.2.0?

1. **🖥️ Širokouhlý režim okna (86 % až 96 % šírky obrazovky):**
   - Pôvodné okno galérie malo pevný strop `1620px`, čo na veľkých 2K (2560×1440) a 4K monitoroch nechávalo po bokoch prázdne pásy.
   - Od verzie `2.2.0` sa Spoločný Album (Merged Gallery) aj Quick Peek automaticky roztiahnu na **86 % šírky prehliadača (`86vw`)** a v pravom hornom rohu pribudlo tlačidlo **`↔ Wide`**, ktorým okno jedným klikom roztiahneš až na **96 % šírky obrazovky (`96vw`)**!
   - Zároveň bola odstránená aj 390px rezerva napravo na hlavnej stránke `/library`, takže aj základná mriežka albumov teraz využíva plnú šírku okna.

2. **🖼️ Skutočný pomer strán 16:9 a oprava orezávania kariet:**
   - Odstránený obmedzovač `max-height: 180px`, ktorý na širokých monitoroch splošťoval náhľady do úzkych pásikov a orezával vrch a spodok fotiek. Každý náhľad má teraz čistý, neorezaný **pomer strán 16:9**.
   - Opravené stláčanie riadkov v CSS Grid (`grid-auto-rows: max-content`), vďaka čomu už spodná lišta karty s tlačidlami **`▶ Play`**, **`📋 Link`** a **`↗`** nikdy nezmizne a neoreže sa ani pri stovkách videí.

3. **▦ Nové rozloženie `5x3` (5 stĺpcov) + inteligentné predvolené zobrazenie:**
   - Pre veľké monitory pribudol režim **`▦ 5x3` (5 stĺpcov)** popri `▤ 4x3`, `⊞ 3x2`, `☷ 2x2` a `☰ List`. Na širokých obrazovkách sa automaticky predvolí `4x3`.

4. **🎛️ Triedenie, filter podľa zdrojového albumu a štítky kvality na každom videu:**
   - Priamo v hornej lište Spoločného Albumu môžeš videá zoradiť podľa **najdlhšieho/najkratšieho trvania**, **najväčšej veľkosti (MB)**, **najvyššieho bitrate (kvality)**, **názvu A–Z** alebo **názvu albumu**.
   - V Spoločnom Albume pribudol rozbaľovací filter **`📁 All Albums`**, ktorým si môžeš kedykoľvek vyfiltrovať videá len z konkrétneho vybraného albumu.
   - Každé video má v pravom hornom rohu náhľadu vlastný štítok kvality (`4K UHD`, `1080p`, `720p`, `SD`).
   - Kliknutím priamo na plochu náhľadu (mimo tlačidla Play) pohodlne označíš alebo odznačíš kartu videa (vrátane podpory `Shift + Klik`).

---

## Čo pribudlo vo verzii 2.1.0?

1. **📂 Funkcia "Spoločný Album / Galéria" (Merged Gallery):**
   - Na stránke `/library` si zaškrtni ľubovoľné albumy (napr. 5, 10 alebo všetkých 15 na stránke pomocou tlačidiel `TOP 20` alebo `Visible`).
   - V plávajúcom paneli sa ti aktivuje veľké gradientové tlačidlo **`📂 Spoločný Album / Merged Gallery (X)`**.
   - Po kliknutí skript automaticky overí a dočíta metadáta z vybraných albumov a **otvorí všetky ich videá spojené v jednej spoločnej galérii / Quick Peek okne**!
   - Každé video má priamo na karte označenie albumu (napr. `📁 ModelPOV: Kelly Vet`), z ktorého pochádza.
   - Vyhľadávacie pole v spoločnom albume dokáže filtrovať nielen podľa názvu videa, ale aj podľa názvu albumu.
   - Z tohto spoločného albumu môžeš vybrané videá spustiť priamo vo viacnásobnom okne **`📺 Split-Screen`**, vyexportovať spoločný **`.M3U` playlist** pre VLC/MPV, alebo stiahnuť **`.JSON`**.

2. **🎯 Oprava selektora v ľavom hornom rohu náhľadu:**
   - Selektor (štvorček s fajkou `[✔]`) v ľavom hornom rohu náhľadu každej karty bol kompletne prepracovaný.
   - Teraz spoľahlivo funguje **označovanie aj odznačovanie (deselect)** jedným kliknutím priamo na štvorček alebo jeho obal.
   - Vybrané karty majú smaragdovozelený svietiaci indikátor a modrý obrys celej karty.
   - Podporovaný je aj rýchly výber rozsahu kariet pomocou klávesy <kbd>Shift</kbd> + kliknutie na selektor.

3. **⌨️ Univerzálne zatváranie cez klávesu Escape:**
   - Klávesa <kbd>Esc</kbd> teraz okamžite zatvorí otvorené okná (Spoločný album, Quick Peek, Split-Screen, Históriu) aj vtedy, keď máš kurzor aktívny vo vyhľadávacom poli.

---

## 🚀 Čo bolo upravené a odstránené oproti pôvodnému rozšíreniu?

Pôvodný skript v rozšírení Nexus Gallery vyžadoval bežiaci lokálny Nexus backend na porte `127.0.0.1:8001` a komunikáciu cez `chrome.runtime.sendMessage` ("Do Testera", "Importovať do Nexusu"). Pre bežného človeka bez tohto dashboardu by tieto tlačidlá hlásili chyby a zlyhávali.

V tejto **samostatnej verzii (v2.0.0)**:
1. **100% samostatný chod:** Všetky funkcie bežia priamo v prehliadači cez Tampermonkey alebo Violentmonkey. Žiadny lokálny server, Python backend ani Chrome extension runtime nie sú potrebné.
2. **Nahradenie starých tlačidiel moderným exportom:**
   - **📋 Copy Links / Copy Watch URLs:** Skopíruje odkazy `https://turbo.cr/v/...` označených albumov alebo videí priamo do schránky.
   - **🔗 Direct Streams / Copy Direct Streams:** Priamo komunikuje s oficiálnym Turbo podpisovacím endpointom `/api/sign?v=<id>` a extrahuje skutočné priame streamy z CDN (`.mp4`), pripravené na vloženie do JDownloader 2, IDM alebo `yt-dlp`.
   - **🎵 Export .M3U:** Vygeneruje plnohodnotný playlist `.m3u8` s názvami a dĺžkami skladieb, ktorý stačí otvoriť v prehrávačoch ako **VLC**, **MPV**, **IINA** alebo **PotPlayer** a videá sa streamujú priamo z CDN bez sťahovania na disk!
   - **📄 Export JSON:** Uloží kompletné štruktúrované metadáta o albumoch a videách do `.json` súboru.
3. **Vstavaný Multi-Video Split-Screen prehrávač:**
   - Nemusíš inštalovať žiadne externé aplikácie. Označ 1 až 12 videí a klikni na **📺 Split-Screen**. Otvorí sa cinema stena, kde bežia videá súčasne, s funkciou **Audio Solo pri prejdení myšou** (prejdeš kurzorom na dlaždicu a jej zvuk sa automaticky zapne, ostatné sa stíšia).
4. **Záloha Vaultu cez JSON (Export / Import):**
   - V okne **📜 História** môžeš celý svoj zoznam preskenovaných albumov exportovať ako `.json` zálohu na disk a neskôr kedykoľvek obnoviť na inom PC alebo v inom prehliadači pomocou **📂 Import Vault**.
5. **Enrichment na stránkach jednotlivých albumov (`/a/<id>`):**
   - V samostatnom albume skript prečíta inline blok `const FILES` z HTML kódu stránky, takže okamžite pozná skutočné trvania videí a ostré náhľady.
6. **Rozšírený výber cez Shift+Click:**
   - Ako na stránke knižnice `/library`, tak aj v okne Quick Peek a v galérii albumu môžeš držať <kbd>Shift</kbd> a označiť celú sériu kariet naraz.

---

## 💡 Praktické tipy a triky

### 1. Pozeranie celých albumov vo VLC bez sťahovania
Označ albumy, ktoré ťa zaujímajú (alebo cez Quick Peek konkrétne videá), klikni na **🎵 .M3U** a stiahnutý súbor `.m3u8` potiahni do VLC alebo MPV. Prehrávač ti otvorí playlist a videá môžeš plynule preskakovať ako pesničky.

### 2. Dávkové sťahovanie cez JDownloader 2
Označ albumy alebo videá a klikni na **🔗 Direct Streams**. Skript v reálnom čase vyrieši podpísané CDN odkazy a vloží ich do schránky. Ak máš zapnutý JDownloader 2 s LinkGrabberom, okamžite ti naskáču súbory pripravené na maximálnu rýchlosť sťahovania.

### 3. Hľadanie podľa skutočnej kvality (dátového toku)
Často je video pomenované ako "1080p", ale má mizerný bitrate a je rozmazané. Skript počíta reálny dátový tok (Mbps) zo vzťahu veľkosti a dĺžky:
- 💎 **4K UHD:** ≥ 12.0 Mbps
- ⭐ **1080p FHD:** ≥ 3.5 Mbps
- ⚡ **720p HD:** ≥ 1.6 Mbps
- 📁 **480p SD:** štandardná/nižšia kvalita

Na paneli stačí vo filtri **Kvalita** zvoliť napríklad `💎 4K UHD` alebo `⭐ 1080p+` a okamžite vidíš len skutočne ostré albumy.

### 4. Rýchly náhľad (`👁️ Quick Peek`) bez otvárania kariet
Kliknutím na oko (`👁️`) na karte albumu sa ti otvorí rýchly náhľad. Tlačidlami `▦ 3x2`, `▤ 4x3`, `☷ 2x2` alebo `☰ Zoznam` si prepneš rozloženie podľa veľkosti monitora. Môžeš tu priamo filtrovať videá v albume, púšťať ich alebo posielať do Split-Screenu.

### 5. Klávesové skratky
- Stlač <kbd>/</kbd> pre okamžité zameranie vyhľadávacieho poľa.
- Stlač <kbd>Shift</kbd> + <kbd>A</kbd> pre označenie všetkých zobrazených položiek.
- Stlač <kbd>Shift</kbd> + <kbd>C</kbd> pre zrušenie výberu.
- Stlač <kbd>S</kbd> pre spustenie alebo pozastavenie automatického skenovania.
- Stlač <kbd>N</kbd> pre načítanie ďalšej strany knižnice.
- Stlač <kbd>?</kbd> kedykoľvek pre otvorenie okna nápovedy so všetkými skratkami.
- Stlač <kbd>Esc</kbd> pre zatvorenie akéhokoľvek otvoreného okna.
- V prehrávači videí stlač <kbd>Alt</kbd> + <kbd>←</kbd> alebo <kbd>Alt</kbd> + <kbd>→</kbd> pre skok na predchádzajúce/nasledujúce video.

---

## 📄 Licencia
Vydané pod licenciou MIT od **[ervss](https://github.com/ervss)**.
