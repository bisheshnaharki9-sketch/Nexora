/* radar.js — rotating radar overlay for the map

   What it does:
   - Draws three dashed range rings around a center point
   - Rotates a green sweep fan inside the rings
   - Spawns red contact blips that fade after 8 seconds
   - Click the map to move the radar center

   How the sweep works:
   The sweep angle starts at 0 and increases by 3 degrees every frame.
   When it hits 360 it wraps back to 0. For each frame we redraw a
   polygon from the center out to the range edge, spanning about 14
   degrees of arc. That's the visible fan.

   How contacts are placed:
   bearingPoint() uses the great-circle formula so distances are
   accurate on a sphere, not flat. Each fake contact gets a random
   bearing (0-360) and a random distance inside the range.

   Why some things are the way they are:
   - The range is fixed at 500km for now. window.radar.setRange()
     can change it at runtime from the console.
   - window.radar exposes setCenter/setRange/arm so other scripts
     can control the radar without touching internal variables. Radar overlay for the Nexora map.
   Rotating sweep line + range rings + contact blips.
   Set the radar center by clicking the map while armed. */

(function () {
  const map = window.map;
  if (!map || typeof L === 'undefined') {
    console.warn('radar.js: map not found');
    return;
  }

  const radar = {
    center: L.latLng(35.0, 30.0),
    rangeKm: 500,
    armed: true,
    angle: 0,
    group: L.layerGroup().addTo(map),
    rings: [],
    sweep: null,
    centerMarker: null,
    contacts: []
  };

  /* ---- static rings ---- */

  function drawRings() {
    radar.rings.forEach(r => radar.group.removeLayer(r));
    radar.rings = [];

    for (let i = 1; i <= 3; i++) {
      const r = L.circle(radar.center, {
        radius: (radar.rangeKm / 3) * i * 1000,
        color: '#4fd0a0',
        weight: 1,
        opacity: 0.25,
        fill: false,
        dashArray: '4,6',
        interactive: false
      }).addTo(radar.group);
      radar.rings.push(r);
    }

    if (radar.centerMarker) radar.group.removeLayer(radar.centerMarker);
    radar.centerMarker = L.circleMarker(radar.center, {
      radius: 4,
      color: '#7fffcb',
      fillColor: '#7fffcb',
      fillOpacity: 1,
      weight: 1,
      interactive: false
    }).addTo(radar.group);
  }

  /* ---- sweep line: a rotating polyline from center outward ---- */

  function bearingPoint(center, bearingDeg, distKm) {
    const R = 6371;
    const lat1 = center.lat * Math.PI / 180;
    const lon1 = center.lng * Math.PI / 180;
    const brg = bearingDeg * Math.PI / 180;
    const d = distKm / R;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(brg)
    );
    const lon2 = lon1 + Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

    return L.latLng(lat2 * 180 / Math.PI, lon2 * 180 / Math.PI);
  }

  function drawSweep() {
    if (radar.sweep) radar.group.removeLayer(radar.sweep);

    const pts = [radar.center];
    // draw the sweep as a fan so it reads as a thick band, not a hairline
    for (let i = 0; i <= 12; i++) {
      const b = radar.angle + i * 1.2;
      pts.push(bearingPoint(radar.center, b, radar.rangeKm));
    }
    pts.push(radar.center);

    radar.sweep = L.polygon(pts, {
      color: '#7fffcb',
      weight: 1,
      opacity: 0.55,
      fillColor: '#7fffcb',
      fillOpacity: 0.06,
      interactive: false
    }).addTo(radar.group);
  }

  /* ---- contact blips (fake, placeholder until you add real data) ---- */

  function spawnContact() {
    // random bearing + distance inside the range
    const b = Math.random() * 360;
    const d = 30 + Math.random() * (radar.rangeKm - 50);
    const pos = bearingPoint(radar.center, b, d);

    const c = L.circleMarker(pos, {
      radius: 3,
      color: '#c04a30',
      fillColor: '#c04a30',
      fillOpacity: 0.9,
      weight: 1
    }).addTo(radar.group);

    // contacts fade out after 8s — that's how real radar echo works
    setTimeout(() => {
      radar.group.removeLayer(c);
    }, 8000);
  }

  /* ---- click map to move the radar center ---- */

  map.on('click', (e) => {
    if (!radar.armed) return;
    radar.center = e.latlng;
    drawRings();
    drawSweep();
  });

  /* ---- animation loop ---- */

  function step() {
    radar.angle = (radar.angle + 3) % 360;
    drawSweep();

    // occasionally drop a new contact
    if (Math.random() > 0.85) spawnContact();

    requestAnimationFrame(step);
  }

  /* ---- boot ---- */

  drawRings();
  drawSweep();
  step();

  // expose controls
  window.radar = {
    setCenter: (lat, lon) => {
      radar.center = L.latLng(lat, lon);
      drawRings();
      drawSweep();
    },
    setRange: (km) => {
      radar.rangeKm = km;
      drawRings();
    },
    arm: (on) => { radar.armed = !!on; }
  };

  console.log('radar online');
})();
