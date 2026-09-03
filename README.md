# Gestore Asta Fantacalcio 2026/27

Lega a 11 partecipanti, 1000 crediti, rosa 3-8-8-6, modulo 4-5-1.
Modificatore di difesa (portiere + migliori 3 difensori), modificatore di
centrocampo (somma dei voti puri), capitano a soglia, switch automatico.

Nessuna dipendenza npm: gira con il solo Node 20+.

## Deploy su Railway

1. Metti questa cartella in un repository Git e fai push.
2. Su Railway: **New Project → Deploy from GitHub repo** e scegli il repo.
   Nixpacks riconosce Node da solo, `npm start` avvia il server.
3. **Settings → Networking → Generate Domain** per ottenere l'indirizzo pubblico.
4. **Variables**, aggiungi:
   - `AUTH_TOKEN` — una parola a tua scelta. Senza questa il sito e' pubblico.
5. **Storage → Add Volume**, mount path `/data`. Il server rileva da solo il
   volume su `/data` e ci scrive lo stato (nessuna variabile da impostare);
   senza volume lo stato si perde a ogni nuovo deploy (durante la serata non
   succede, ma meglio metterlo). Per forzare un percorso diverso c'e' comunque
   la variabile `DATA_DIR`.

Poi apri `https://TUO-DOMINIO.up.railway.app/?k=LA_TUA_CHIAVE` una volta:
la chiave finisce in un cookie che dura un anno, e da li' in poi basta
l'indirizzo normale. Fallo su telefono e su PC e i due restano allineati.

## Come funziona il salvataggio

Il client cerca i backend in quest'ordine:

1. **server** — se la pagina arriva da http/https e `api/ping` risponde.
   Lo stato sta su disco lato server, quindi telefono e PC vedono la stessa asta.
2. **window.storage** — quando la pagina gira come artifact di Claude.
3. **localStorage** → **IndexedDB** → **indirizzo della pagina**, in
   ordine, per l'uso da file locale.

Il pulsante **Sincronizza** ricarica lo stato dal server: usalo se hai
comprato dal PC e vuoi allineare il telefono.

## In locale

    npm start        # poi http://localhost:3000

## Endpoint

- `GET /health` — per l'healthcheck di Railway, non richiede chiave
- `GET /api/state` — stato corrente
- `PUT /api/state` — salva lo stato (scrittura atomica)
