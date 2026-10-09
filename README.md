# Ewok · sito di presentazione

Pagina statica (HTML, CSS e JS, senza build) che presenta Ewok ai possibili clienti, con la mappa delle unit.

- `index.html`: contenuti della pagina
- `assets/styles.css`, `assets/app.js`: stile e logica (la mappa Leaflet si carica solo quando si arriva alla sezione)
- `assets/vendor/leaflet/`: Leaflet 1.9.4 incluso nel sito
- `data/units.json`: **le unit mostrate sulla mappa** (posizione, stato, sensori)

## Aggiornare la mappa

Modificare `data/units.json`. Campi: `id`, `name`, `place`, `lat`, `lng`, `status` (`active`, `testing`, `planned`),
`power`, `sensors`, `lastSeen` (ISO 8601, opzionale: una unit `active` senza segni di vita da più di 10 minuti appare
come non raggiungibile, come in LCARS).

## Da completare

Cercare `TODO` in `index.html`: ruolo e bio del team, email di contatto. Le unit in `data/units.json` sono esempi.

## Provare in locale e pubblicare

```bash
python3 -m http.server 8080   # poi aprire http://localhost:8080
```

Su Netlify basta collegare la repo: `netlify.toml` pubblica la cartella principale, senza comando di build.
