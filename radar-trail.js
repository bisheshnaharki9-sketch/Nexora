/* Adds a fading trail behind the radar sweep. */
(function () {
  if (!window.radar) return;

  const map = window.map;
  const trails = [];
  const TRAIL_LEN = 14;

  function bearingPoint(center, bearingDeg, distKm) {
    const R = 6371;
    const lat1 = center.lat * Math.PI / 180;
    const lon1 = center.lng * Math.PI / 180;
    const brg = bearingDeg * Math.PI / 180;
    const d = distKm / R;
    const lat2 = Math.asin(Math.sin(lat1)*Math.cos(d) + Math.cos(lat1)*Math.sin(d)*Math.cos(brg));
    const lon2 = lon1 + Math.atan2(Math.sin(brg)*Math.sin(d)*Math.cos(lat1), Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
    return L.latLng(lat2*180/Math.PI, lon2*180/Math.PI);
  }

  let angle = 0;
  function step() {
    angle = (angle + 3) % 360;
    const center = L.latLng(35, 30);

    const line = L.polyline(
      [center, bearingPoint(center, angle, 500)],
      { color:'#7fffcb', weight:2, opacity:0.9, interactive:false }
    ).addTo(map);

    trails.push({ line, born: Date.now() });

    while (trails.length > TRAIL_LEN) {
      map.removeLayer(trails.shift().line);
    }

    for (let i = 0; i < trails.length; i++) {
      const age = (Date.now() - trails[i].born) / 1500;
      trails[i].line.setStyle({ opacity: Math.max(0, 0.9 - age) });
    }

    requestAnimationFrame(step);
  }
  step();
})();
