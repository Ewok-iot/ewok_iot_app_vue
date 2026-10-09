# Ewok · sito di presentazione

Pagina statica (HTML, CSS e JS, senza build) che presenta Ewok ai possibili clienti, con la mappa delle aree servite.

- `index.html`: contenuti della pagina
- `assets/styles.css`, `assets/app.js`: stile e logica (la mappa Leaflet si carica solo quando si arriva alla sezione)
- `assets/vendor/leaflet/`: Leaflet 1.9.4 incluso nel sito
- `data/areas.json`: **le aree mostrate sulla mappa** (mai la posizione precisa delle stazioni)

## Aggiornare la mappa

Modificare `data/areas.json`. Campi: `name` (es. provincia o vallata), `region`, `lat`/`lng` (centro indicativo
dell'area, 1-2 decimali), `radiusKm`, `units` (numero di stazioni), `status` (`active`, `testing`, `planned`), `note`.
La mappa non permette di zoomare oltre il livello di dettaglio di un'area.

## Da completare

Cercare `TODO` in `index.html`: email di contatto. Verificare le aree in `data/areas.json`.

## Provare in locale e pubblicare

```bash
python3 -m http.server 8080   # poi aprire http://localhost:8080
```

Su Netlify basta collegare la repo: `netlify.toml` pubblica la cartella principale, senza comando di build.
