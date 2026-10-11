/* Squad roster. Original operators, geometric insignia drawn in SVG. */
(function () {
  const ROSTER = [
    { callsign:'REAPER',  role:'ASSAULT',  status:'ACTIVE', color:'#8a3a28',
      bio:'Breacher. Close quarters.' },
    { callsign:'KESTREL', role:'RECON',    status:'ACTIVE', color:'#3a6a58',
      bio:'Long range. Eyes on target.' },
    { callsign:'TALON',   role:'MARKSMAN', status:'STANDBY', color:'#7a6230',
      bio:'Precision. No second shot.' },
    { callsign:'GRIFFIN', role:'SUPPORT',  status:'ACTIVE', color:'#5a7a68',
      bio:'Heavy weapons. Suppression.' },
    { callsign:'VYPER',   role:'EWAR',     status:'ACTIVE', color:'#5a4a78',
      bio:'Signals. Jamming. Ghost in the wire.' },
    { callsign:'ATLAS',   role:'MEDIC',    status:'WOUNDED', color:'#7a3a48',
      bio:'Keeps the squad breathing.' }
  ];
  // each insignia is a set of SVG path 'd' strings, drawn programmatically
  const PATCHES = {
    REAPER:  ['M50 10 L90 40 L75 85 L50 95 L25 85 L10 40 Z',
              'M50 30 L65 55 L50 80 L35 55 Z'],
    KESTREL: ['M50 15 L85 50 L50 85 L15 50 Z',
              'M50 25 L70 50 L50 75 L30 50 Z',
              'M50 10 L50 25'],
    TALON:   ['M50 10 L60 40 L90 50 L60 60 L50 90 L40 60 L10 50 L40 40 Z'],
    GRIFFIN: ['M50 10 L80 25 L80 60 L50 90 L20 60 L20 25 Z',
              'M35 45 L65 45'],
    VYPER:   ['M50 10 C70 30 70 50 50 80 C30 50 30 30 50 10 Z',
              'M50 30 L50 70'],
    ATLAS:   ['M50 10 L85 30 L85 60 L50 90 L15 60 L15 30 Z',
              'M50 35 L50 65',
              'M35 50 L65 50']
  };

  function patch(name, color) {
    const paths = window.PATCHES[name] || window.PATCHES.REAPER;
    let svg = '<svg viewBox="0 0 100 100" width="48" height="48">';
    // outer ring
    svg += '<circle cx="50" cy="50" r="46" fill="none" stroke="' +
           color + '" stroke-width="0.5" opacity="0.35"/>';
    svg += '<circle cx="50" cy="50" r="43" fill="none" stroke="' +
           color + '" stroke-width="0.3" opacity="0.2" stroke-dasharray="2,3"/>';
    // paths
    for (let i = 0; i < paths.length; i++) {
      const w = i === 0 ? 2.2 : 1.2;
      const op = i === 0 ? 0.95 : 0.65;
      svg += '<path d="' + paths[i] + '" fill="none" stroke="' + color +
             '" stroke-width="' + w + '" opacity="' + op +
             '" stroke-linejoin="miter" stroke-linecap="square"/>';
    }
    svg += '</svg>';
    return svg;
  }
  function build() {
    const host = document.getElementById('squad');
    if (!host) return;
    host.replaceChildren();

    for (const op of ROSTER) {
      const card = document.createElement('div');
      card.className = 'op';
      card.innerHTML =
        '<div class="op-patch">' + patch(op.callsign, op.color) + '</div>' +
        '<div class="op-info">' +
          '<div class="op-call" style="color:' + op.color + '">' + op.callsign + '</div>' +
          '<div class="op-role">' + op.role + '</div>' +
          '<div class="op-bio">' + op.bio + '</div>' +
        '</div>' +
        '<div class="op-status" data-s="' + op.status + '">' + op.status + '</div>';
      host.appendChild(card);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
