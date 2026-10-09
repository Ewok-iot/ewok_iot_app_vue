// Ewok - pagina di presentazione.
// La mappa (Leaflet) si carica solo quando la sezione sta per entrare nello schermo.
// La mappa mostra aree geografiche, mai la posizione precisa delle stazioni.

const AREAS_URL = 'data/areas.json';
const LEAFLET_BASE = 'assets/vendor/leaflet/';

const STATUS = {
  active:  { label: 'Operativa', color: '#9fd68a' },
  testing: { label: 'In prova',  color: '#e2b44b' },
  planned: { label: 'In arrivo', color: '#b3a1ff' },
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
      ctx.strokeStyle = k % 5 === 0 ? 'rgba(159,214,138,.55)' : 'rgba(159,214,138,.22)';
      ctx.stroke();
    }
  });
}
drawContours();
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(drawContours, 150); });

/* ---------- Filtro dei sensori ---------- */
document.querySelectorAll('.filter .chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter .chip').forEach(b => b.classList.toggle('is-on', b === btn));
    const f = btn.dataset.filter;
    document.querySelectorAll('.sensors tbody tr').forEach(tr => {
      tr.hidden = f !== 'all' && !tr.dataset.cat.split(' ').includes(f);
    });
  });
});

/* ---------- Aree e mappa ---------- */
const areasPromise = fetch(AREAS_URL, { cache: 'no-cache' })
  .then(r => (r.ok ? r.json() : { areas: [] }))
  .then(d => (Array.isArray(d.areas) ? d.areas : []).filter(a => Number.isFinite(a.lat) && Number.isFinite(a.lng)))
  .catch(() => []);

function esc (s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const statusOf = a => (STATUS[a.status] ? a.status : 'planned');
const unitsLabel = n => `${n} ${n === 1 ? 'stazione' : 'stazioni'}`;

areasPromise.then(areas => {
  const set = (k, v) => { const el = document.querySelector(`[data-stat="${k}"]`); if (el) el.textContent = v; };
  set('areas', areas.length);
  set('units', areas.reduce((s, a) => s + (Number(a.units) || 0), 0));
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
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 12,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
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
  const map = L.map(mapEl, { scrollWheelZoom: false, maxZoom: 10, minZoom: 5 }).setView([45.9, 12.2], 7);
  addBaseLayer(L, map);
  map.on('click', () => map.scrollWheelZoom.enable());
  map.on('mouseout', () => map.scrollWheelZoom.disable());

  const list = document.getElementById('area-list');
  const shapes = [];

  areas.forEach(a => {
    const st = statusOf(a);
    const color = STATUS[st].color;
    const units = Number(a.units) || 0;
    const circle = L.circle([a.lat, a.lng], {
      radius: (Number(a.radiusKm) || 15) * 1000,
      color, weight: 1.5, fillColor: color, fillOpacity: 0.18,
    }).addTo(map).bindPopup(
      `<strong>${esc(a.name)}</strong><span>${esc(a.region || '')}${a.region ? ' · ' : ''}${unitsLabel(units)} · ${STATUS[st].label}</span>` +
      (a.note ? `<br><span>${esc(a.note)}</span>` : ''),
    );
    shapes.push(circle);

    const li = document.createElement('li');
    li.innerHTML = `<button type="button"><strong><i class="dot" style="background:${color}"></i>${esc(a.name)}</strong>
      <small>${esc(a.region || '')}${a.region ? ' · ' : ''}${unitsLabel(units)} · ${STATUS[st].label}</small></button>`;
    li.querySelector('button').addEventListener('click', () => {
      map.flyToBounds(circle.getBounds().pad(1.5), { duration: 0.8 });
      circle.openPopup();
    });
    list.appendChild(li);
  });

  if (shapes.length) {
    map.fitBounds(L.featureGroup(shapes).getBounds().pad(1.2), { maxZoom: 8 });
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
