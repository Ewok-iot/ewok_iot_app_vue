// Ewok - pagina di presentazione.
// La mappa (Leaflet) si carica solo quando la sezione sta per entrare nello schermo.
// La mappa mostra aree geografiche, mai la posizione precisa delle stazioni.

const AREAS_URL = 'data/areas.json';
const LEAFLET_BASE = 'assets/vendor/leaflet/';

const STATUS = {
  active:  { label: 'Operativa', color: '#b4c98e' },
  testing: { label: 'In prova',  color: '#d9a441' },
  planned: { label: 'In arrivo', color: '#7d905e' },
};

document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- Curve di livello nell'hero ---------- */
function drawContours () {
  const canvas = document.querySelector('.hero__contours');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, rect.width, rect.height);

  // Rilievi: somma di colline gaussiane, disegnate come anelli concentrici deformati
  const hills = [
    { x: .78, y: .38, r: .34 },
    { x: .95, y: .85, r: .26 },
    { x: .55, y: 1.05, r: .22 },
  ];
  const W = rect.width, H = rect.height, S = Math.max(W, H);
  ctx.lineWidth = 1;
  hills.forEach((h, hi) => {
    const cx = h.x * W, cy = h.y * H;
    for (let k = 1; k <= 14; k++) {
      const base = (k / 14) * h.r * S;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 90) {
        const wob = 1 + 0.09 * Math.sin(3 * a + hi + k * 0.35) + 0.05 * Math.sin(5 * a - k * 0.5 + hi * 2);
        const px = cx + Math.cos(a) * base * wob * 1.25;
        const py = cy + Math.sin(a) * base * wob * 0.85;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.strokeStyle = k % 5 === 0 ? 'rgba(63,92,53,.45)' : 'rgba(63,92,53,.18)';
      ctx.stroke();
    }
  });
}
drawContours();
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(drawContours, 150); });

/* ---------- Aree e mappa ---------- */
const dataPromise = fetch(AREAS_URL, { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : {}))
  .catch(() => ({}));
const areasPromise = dataPromise
  .then(d => (Array.isArray(d.areas) ? d.areas : []).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lng)));

function esc (s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const statusOf = a => (STATUS[a.status] ? a.status : 'planned');
const unitsLabel = n => `${n} ${n === 1 ? 'stazione' : 'stazioni'}`;

Promise.all([dataPromise, areasPromise]).then(([d, areas]) => {
  const set = (k, v) => { const el = document.querySelector(`[data-stat="${k}"]`); if (el) el.textContent = v; };
  set('areas', areas.length);
  set('units', areas.reduce((s, a) => s + (Number(a.units) || 0), 0) + (Number(d.unassignedUnits) || 0));
});

function loadLeaflet () {
  if (window.L) return Promise.resolve(window.L);
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = LEAFLET_BASE + 'leaflet.css';
  document.head.appendChild(css);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LEAFLET_BASE + 'leaflet.js';
    s.onload = () => resolve(window.L);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

function addBaseLayer (L, map) {
  // Satellite: Sentinel-2 cloudless 2016 di EOX (CC BY 4.0, utilizzabile anche commercialmente)
  const satellite = L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg', {
    maxZoom: 11,
    className: 'tiles-sat',
    attribution: '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Copernicus Sentinel data 2016)',
  });
  const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 11,
    className: 'tiles-map',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
  satellite.addTo(map);
  L.control.layers({ Satellite: satellite, Mappa: street }, null, { position: 'topright', collapsed: false }).addTo(map);
}

async function initMap () {
  const mapEl = document.getElementById('map');
  let L;
  try {
    L = await loadLeaflet();
  } catch {
    mapEl.innerHTML = '<p class="map-msg">La mappa non si è caricata. Ricarica la pagina per riprovare.</p>';
    return;
  }
  const areas = await areasPromise;
  mapEl.innerHTML = '';

  // Zoom massimo limitato: la mappa mostra aree, non punti precisi
  const map = L.map(mapEl, { scrollWheelZoom: false, maxZoom: 11, minZoom: 6, zoomSnap: 0.25 }).setView([45.7, 12.35], 9);
  addBaseLayer(L, map);
  map.on('click', () => map.scrollWheelZoom.enable());
  map.on('mouseout', () => map.scrollWheelZoom.disable());

  const list = document.getElementById('area-list');
  const shapes = [];

  areas.forEach(a => {
    const st = statusOf(a);
    const color = STATUS[st].color;
    const units = Number(a.units) || 0;
    const radius = (Number(a.radiusKm) || 6) * 1000;
    const popup = `<strong>${esc(a.name)}</strong><span>${esc(a.region || '')}${a.region ? ' · ' : ''}${unitsLabel(units)} · ${STATUS[st].label}</span>` +
      (a.note ? `<br><span>${esc(a.note)}</span>` : '');

    // alone esterno + area + centro pulsante con etichetta fissa
    L.circle([a.lat, a.lng], { radius: radius * 1.6, stroke: false, fillColor: color, fillOpacity: 0.12, interactive: false }).addTo(map);
    const area = L.circle([a.lat, a.lng], { radius, color, weight: 1.5, dashArray: '4 4', fillColor: color, fillOpacity: 0.22 })
      .addTo(map).bindPopup(popup);
    const pin = L.marker([a.lat, a.lng], {
      icon: L.divIcon({ className: 'area-pin', html: `<span style="--c:${color}"></span>`, iconSize: [16, 16], iconAnchor: [8, 8] }),
      keyboard: false,
    }).addTo(map).bindPopup(popup);
    pin.bindTooltip(`${esc(a.name)} <b>${units}</b>`, { permanent: true, direction: a.label === 'left' ? 'left' : 'right', offset: [a.label === 'left' ? -12 : 12, 0], className: 'area-label' });
    shapes.push(area);

    const li = document.createElement('li');
    li.innerHTML = `<button type="button"><strong><i class="dot" style="background:${color}"></i>${esc(a.name)}</strong>
      <small>${esc(a.region || '')}${a.region ? ' · ' : ''}${unitsLabel(units)} · ${STATUS[st].label}</small></button>`;
    li.querySelector('button').addEventListener('click', () => {
      map.flyToBounds(area.getBounds().pad(1.5), { duration: 0.8 });
      area.openPopup();
    });
    list.appendChild(li);
  });

  if (shapes.length) {
    map.fitBounds(L.featureGroup(shapes).getBounds().pad(0.35), { maxZoom: 10 });
  } else {
    list.innerHTML = '<li class="legend">Le prime aree saranno visibili a breve.</li>';
  }
}

const netSection = document.getElementById('rete');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); initMap(); }
  }, { rootMargin: '400px' });
  io.observe(netSection);
} else {
  initMap();
}
