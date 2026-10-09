// Ewok - pagina di presentazione.
// La mappa (Leaflet) viene caricata solo quando la sezione sta per entrare nello schermo,
// così il primo caricamento della pagina resta leggero.

const UNITS_URL = 'data/units.json';
// Una unit "active" è considerata raggiungibile se ha dato segni di vita negli ultimi 10 minuti
// (stessa regola della console LCARS). Se lastSeen manca, vale lo stato dichiarato.
const ACTIVE_WINDOW_MS = 10 * 60 * 1000;

const STATUS = {
  active:  { label: 'Attiva',            color: '#4ade80' },
  testing: { label: 'In test',           color: '#ff9c33' },
  planned: { label: 'In arrivo',         color: '#7aa7ff' },
  offline: { label: 'Non raggiungibile', color: '#f87171' },
};

document.getElementById('year').textContent = new Date().getFullYear();

const unitsPromise = fetch(UNITS_URL, { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : { units: [] }))
  .then(d => (Array.isArray(d.units) ? d.units : []).filter(u => Number.isFinite(u.lat) && Number.isFinite(u.lng)))
  .catch(() => []);

function effectiveStatus (u) {
  if (u.status === 'active' && u.lastSeen) {
    const seen = Date.parse(u.lastSeen);
    if (Number.isFinite(seen) && Date.now() - seen > ACTIVE_WINDOW_MS) return 'offline';
  }
  return STATUS[u.status] ? u.status : 'planned';
}

function esc (s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// KPI "unit attive" nell'hero
unitsPromise.then(units => {
  const el = document.querySelector('[data-kpi="active"]');
  if (el) el.textContent = units.filter(u => effectiveStatus(u) === 'active').length;
});

function loadLeaflet () {
  const base = 'assets/vendor/leaflet/';
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = base + 'leaflet.css';
  document.head.appendChild(css);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = base + 'leaflet.js';
    s.onload = () => resolve(window.L);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function popupHtml (u, st) {
  const sensors = Array.isArray(u.sensors) && u.sensors.length ? u.sensors.join(', ') : '–';
  return `<h4>${esc(u.name || u.id)}</h4>
    <p><strong style="color:${STATUS[st].color}">● ${STATUS[st].label}</strong></p>
    ${u.place ? `<p>${esc(u.place)}</p>` : ''}
    ${u.power ? `<p>Alimentazione: ${esc(u.power)}</p>` : ''}
    <p>Sensori: ${esc(sensors)}</p>`;
}

async function initMap () {
  const mapEl = document.getElementById('map');
  let L;
  try {
    [L] = await Promise.all([loadLeaflet(), unitsPromise]);
  } catch {
    mapEl.innerHTML = '<p class="map-placeholder">Impossibile caricare la mappa. Controlla la connessione.</p>';
    return;
  }
  const units = await unitsPromise;
  mapEl.innerHTML = '';

  const map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true }).setView([45.9, 12.3], 8);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
  // Zoom con la rotellina solo dopo un clic sulla mappa, per non bloccare lo scroll della pagina
  map.on('click', () => map.scrollWheelZoom.enable());
  map.on('mouseout', () => map.scrollWheelZoom.disable());

  const list = document.getElementById('unit-list');
  const markers = [];

  units.forEach(u => {
    const st = effectiveStatus(u);
    const icon = L.divIcon({
      className: '',
      html: `<div class="unit-marker unit-marker--${st}" style="width:18px;height:18px;background:${STATUS[st].color}"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });
    const m = L.marker([u.lat, u.lng], { icon, title: u.name || u.id }).addTo(map).bindPopup(popupHtml(u, st));
    markers.push(m);

    const li = document.createElement('li');
    li.innerHTML = `<button type="button"><span style="color:${STATUS[st].color}">●</span> <strong>${esc(u.name || u.id)}</strong>
      <small>${esc(STATUS[st].label)}${u.place ? ' · ' + esc(u.place) : ''}</small></button>`;
    li.querySelector('button').addEventListener('click', () => {
      mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      map.flyTo([u.lat, u.lng], 13, { duration: 0.8 });
      m.openPopup();
    });
    list.appendChild(li);
  });

  if (markers.length) {
    map.fitBounds(L.featureGroup(markers).getBounds().pad(0.3), { maxZoom: 12 });
  } else {
    list.innerHTML = '<li class="muted">Le prime unit saranno visibili a breve.</li>';
  }
}

const mapSection = document.getElementById('mappa');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) {
      io.disconnect();
      initMap();
    }
  }, { rootMargin: '400px' });
  io.observe(mapSection);
} else {
  initMap();
}
