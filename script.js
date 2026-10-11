/* Nexora - dashboard. Fake unit data, real Leaflet map. */

const $ = (id) => document.getElementById(id);

const map = L.map('map', {
  center: [25, 15],
  zoom: 3,
  worldCopyJump: true,
  preferCanvas: true
});

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 18
}).addTo(map);

window.map = map;

const units = [
  { tag: 'ALPHA-1',   role: 'INFANTRY', state: 'OK' },
  { tag: 'BRAVO-2',   role: 'RECON',    state: 'WARN' },
  { tag: 'CHARLIE-3', role: 'ARMOR',    state: 'OK' },
  { tag: 'DELTA-4',   role: 'MEDIC',    state: 'ALERT' },
  { tag: 'ECHO-5',    role: 'SUPPORT',  state: 'OK' }
];

const feed = [
  'Perimeter sensors recalibrated.',
  'BRAVO-2 reports intermittent comms.',
  'DELTA-4 requesting support.',
  'Comms check passed. Channels secure.'
];

function node(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function drawUnits() {
  const box = $('units');
  if (!box) return;
  box.replaceChildren();
  for (const u of units) {
    const row = node('div', 'unit');
    row.append(node('span', null, u.tag + ' - ' + u.role));
    row.append(node('span', 'state-' + u.state, u.state));
    box.append(row);
  }
  if ($('statUnits')) $('statUnits').textContent = String(units.length);
}

function drawAlerts() {
  const box = $('alerts');
  if (!box) return;
  box.replaceChildren();
  feed.forEach((line, i) => {
    const hot = i === 0 && /request|intermittent/i.test(line);
    box.append(node('li', hot ? 'hot' : null, line));
  });
}

function tick() {
  if ($('clock')) {
    $('clock').textContent =
      new Date().toLocaleTimeString('en-GB', { hour12: false });
  }
}

function shuffle() {
  const pick = units[Math.floor(Math.random() * units.length)];
  const states = ['OK', 'OK', 'WARN', 'ALERT'];
  pick.state = states[Math.floor(Math.random() * states.length)];
  drawUnits();
  if ($('statThreat')) {
    const lv = ['LOW', 'LOW', 'MODERATE', 'ELEVATED'];
    $('statThreat').textContent = lv[Math.floor(Math.random() * lv.length)];
  }
}

drawUnits();
drawAlerts();
tick();
setInterval(tick, 1000);
setInterval(shuffle, 6000);

setTimeout(() => {
  if ($('link')) $('link').textContent = 'LINK: ACTIVE';
}, 1200);

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18 }).addTo(map);
