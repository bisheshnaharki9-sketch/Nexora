/* Live mouse coordinate readout on the map. */
(function () {
  const map = window.map;
  if (!map) return;

  const box = document.createElement('div');
  box.id = 'coords';
  box.textContent = 'LAT --.---  LON --.---';
  document.querySelector('.map').appendChild(box);

  const cross = document.createElement('div');
  cross.id = 'center-cross';
  document.querySelector('.map').appendChild(cross);

  map.on('mousemove', (e) => {
    const lat = e.latlng.lat.toFixed(3);
    const lon = e.latlng.lng.toFixed(3);
    box.textContent = 'LAT ' + lat + '  LON ' + lon;
  });
})();
