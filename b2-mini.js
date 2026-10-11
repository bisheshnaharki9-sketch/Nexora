/* Yo dawg looking at code gotchu H-20 hologram for the Nexora dashboard sidebar.
   Same slot as the old B2. Fresnel shader + scan bar + glow layers. */

(function () {
  const host = document.getElementById('b2-canvas');
  if (!host || typeof THREE === 'undefined') return;

  const W = host.clientWidth;
  const H = host.clientHeight;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  host.appendChild(renderer.domElement);

  const vert = `
    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vP;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vV = normalize(cameraPosition - wp.xyz);
      vP = position;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `;

  const frag = `
    uniform vec3 uCol;
    uniform vec3 uHot;
    uniform float uT;
    uniform float uOp;
    varying vec3 vN;
    varying vec3 vV;
    varying vec3 vP;

    void main() {
      float facing = abs(dot(normalize(vN), normalize(vV)));
      float fres = pow(1.0 - facing, 2.2);

      float lines = sin(vP.y * 38.0 - uT * 3.0);
      lines = smoothstep(0.6, 1.0, lines);

      float bar = fract(vP.y * 0.5 + uT * 0.3);
      bar = smoothstep(0.93, 1.0, bar);

      float a = (fres * 0.8 + lines * 0.2 + 0.08) * uOp;
      a += bar * 0.5 * uOp;

      vec3 c = mix(uCol, uHot, bar * 0.7 + fres * 0.4);
      gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
    }
  `;

  function mat(color, hot, op) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uCol: { value: new THREE.Color(color) },
        uHot: { value: new THREE.Color(hot) },
        uT:   { value: 0 },
        uOp:  { value: op }
      },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }

  const s = new THREE.Shape();
  s.moveTo(0.00,  1.25);
  s.lineTo(0.10,  1.15);
  s.lineTo(0.30,  0.95);
  s.lineTo(0.55,  0.82);
  s.lineTo(0.90,  0.55);
  s.lineTo(1.30,  0.30);
  s.lineTo(1.70,  0.08);
  s.lineTo(2.10, -0.12);
  s.lineTo(2.50, -0.28);
  s.lineTo(2.75, -0.38);
  s.lineTo(2.78, -0.50);
  s.lineTo(2.35, -0.48);
  s.lineTo(2.45, -0.62);
  s.lineTo(1.95, -0.58);
  s.lineTo(2.05, -0.72);
  s.lineTo(1.55, -0.68);
  s.lineTo(1.65, -0.82);
  s.lineTo(1.10, -0.78);
  s.lineTo(1.20, -0.92);
  s.lineTo(0.65, -0.88);
  s.lineTo(0.75, -1.02);
  s.lineTo(0.25, -0.98);
  s.lineTo(0.32, -1.10);
  s.lineTo(0.00, -1.08);
  s.lineTo(-0.32, -1.10);
  s.lineTo(-0.25, -0.98);
  s.lineTo(-0.75, -1.02);
  s.lineTo(-0.65, -0.88);
  s.lineTo(-1.20, -0.92);
  s.lineTo(-1.10, -0.78);
  s.lineTo(-1.65, -0.82);
  s.lineTo(-1.55, -0.68);
  s.lineTo(-2.05, -0.72);
  s.lineTo(-1.95, -0.58);
  s.lineTo(-2.45, -0.62);
  s.lineTo(-2.35, -0.48);
  s.lineTo(-2.78, -0.50);
  s.lineTo(-2.75, -0.38);
  s.lineTo(-2.50, -0.28);
  s.lineTo(-2.10, -0.12);
  s.lineTo(-1.70,  0.08);
  s.lineTo(-1.30,  0.30);
  s.lineTo(-0.90,  0.55);
  s.lineTo(-0.55,  0.82);
  s.lineTo(-0.30,  0.95);
  s.lineTo(-0.10,  1.15);
  s.lineTo(0.00,  1.25);

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1
  });
  geo.rotateX(-Math.PI / 2);
  geo.center();

  const rig = new THREE.Group();
  scene.add(rig);

  const coreMat = mat(0x7fffcb, 0xe8fff4, 0.95);
  rig.add(new THREE.Mesh(geo, coreMat));

  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geo),
    new THREE.LineBasicMaterial({
      color: 0x9fffd8, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending
    })
  );
  wire.scale.setScalar(1.005);
  rig.add(wire);

  const auraMats = [];
  [1.03, 1.07, 1.13].forEach((sc, i) => {
    const m = mat(0x4fd0a0, 0x7fffcb, 0.3 / (i + 1));
    const mesh = new THREE.Mesh(geo, m);
    mesh.scale.setScalar(sc);
    rig.add(mesh);
    auraMats.push(m);
  });

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.0, 0.006, 6, 96),
    new THREE.MeshBasicMaterial({
      color: 0x7fffcb, transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending
    })
  );
  ring.rotation.x = Math.PI / 2;
  rig.add(ring);

  const orbit = { theta: 0.5, phi: 1.15, dist: 6.2, auto: true, speed: 0.25 };

  function setCam() {
    const { theta, phi, dist } = orbit;
    camera.position.set(
      dist * Math.sin(phi) * Math.sin(theta),
      dist * Math.cos(phi),
      dist * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(0, 0, 0);
  }
  setCam();

  let drag = false, lx = 0, ly = 0;

  host.addEventListener('mousedown', (e) => {
    drag = true; orbit.auto = false;
    lx = e.clientX; ly = e.clientY;
    host.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    drag = false;
    host.style.cursor = 'grab';
  });

  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    orbit.theta -= (e.clientX - lx) * 0.008;
    orbit.phi   -= (e.clientY - ly) * 0.008;
    orbit.phi = Math.max(0.25, Math.min(Math.PI - 0.25, orbit.phi));
    lx = e.clientX; ly = e.clientY;
    setCam();
  });

  host.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbit.dist = Math.max(3, Math.min(14, orbit.dist + e.deltaY * 0.005));
    setCam();
  }, { passive: false });

  host.style.cursor = 'grab';

  let t = 0;

  function frame() {
    requestAnimationFrame(frame);
    t += 0.016;

    if (orbit.auto) {
      orbit.theta += orbit.speed * 0.016;
      setCam();
    }

    coreMat.uniforms.uT.value = t;
    auraMats.forEach(m => m.uniforms.uT.value = t);

    rig.position.y = Math.sin(t * 1.5) * 0.04;
    ring.rotation.z += 0.005;

    renderer.render(scene, camera);
  }
  frame();

  window.addEventListener('resize', () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
})();
