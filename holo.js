/* =========================================================
   NEXORA // volumetric hologram
   B-2 / H-20 flying wing rendered with a custom fresnel shader.
   Every visual effect is real shader code, not CSS tricks.
   ========================================================= */

const canvas   = document.getElementById('holo');
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);

/* ---------------------------------------------------------
   MAIN GROUP
   --------------------------------------------------------- */

const rig = new THREE.Group();
scene.add(rig);

/* ---------------------------------------------------------
   FRESNEL SHADER
   This is the secret. Edge-on faces glow brighter than faces
   looking straight at you. Applied to every hologram layer.
   --------------------------------------------------------- */

const vertShader = `
  varying vec3 vNormalW;
  varying vec3 vViewDirW;
  varying vec3 vLocalPos;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vNormalW  = normalize(mat3(modelMatrix) * normal);
    vViewDirW = normalize(cameraPosition - worldPos.xyz);
    vLocalPos = position;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragShader = `
  uniform vec3  uColor;
  uniform vec3  uHot;
  uniform float uTime;
  uniform float uOpacity;
  uniform float uScanDensity;
  uniform float uScanSpeed;
  uniform float uGlitch;

  varying vec3 vNormalW;
  varying vec3 vViewDirW;
  varying vec3 vLocalPos;

  // cheap hash for glitch jitter
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // 1. FRESNEL - the core hologram look
    float facing  = abs(dot(normalize(vNormalW), normalize(vViewDirW)));
    float fresnel = pow(1.0 - facing, 2.2);

    // 2. SCANLINES - horizontal striping in local Y
    float lines = sin(vLocalPos.y * uScanDensity - uTime * uScanSpeed);
    lines = smoothstep(0.65, 1.0, lines);

    // 3. SCAN BAR - a bright band sliding upward repeatedly
    float band = fract(vLocalPos.y * 0.4 + uTime * 0.35);
    band = smoothstep(0.94, 1.0, band);

    // 4. HORIZONTAL GLITCH - occasional displacement strips
    float g = step(0.98, hash(vec2(floor(vLocalPos.y * 40.0), floor(uTime * 8.0))));
    g *= uGlitch;

    // 5. COMPOSE
    float base   = fresnel * 0.75;
    float detail = lines * 0.25;
    float pulse  = 0.10 + 0.06 * sin(uTime * 2.0);

    float alpha = (base + detail + pulse) * uOpacity;
    alpha += band * 0.6 * uOpacity;
    alpha += g * 0.4;

    vec3 col = mix(uColor, uHot, band * 0.8 + fresnel * 0.4);
    col += g * uHot * 0.5;

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`;

/* ---------------------------------------------------------
   B-2 / H-20 GEOMETRY
   Flying wing with cranked-kite leading edge and sawtooth
   trailing edge. Built from an extruded 2D outline.
   --------------------------------------------------------- */

function buildWingOutline() {
  const s = new THREE.Shape();

  // nose at (0, +2.6), right half going clockwise
  s.moveTo(0.00, 2.60);
  s.lineTo(0.10, 2.30);
  s.lineTo(0.30, 2.00);
  s.lineTo(0.55, 1.75);  // crank point of the leading edge
  s.lineTo(0.90, 1.55);
  s.lineTo(1.50, 1.15);
  s.lineTo(2.20, 0.55);
  s.lineTo(2.60, 0.10);
  s.lineTo(2.55, -0.15); // wingtip
  s.lineTo(2.30, -0.25); // sawtooth out
  s.lineTo(2.40, -0.45); // sawtooth in
  s.lineTo(2.05, -0.35); // sawtooth out
  s.lineTo(2.15, -0.55); // sawtooth in
  s.lineTo(1.75, -0.45); // sawtooth out
  s.lineTo(1.85, -0.65); // sawtooth in
  s.lineTo(1.40, -0.55); // sawtooth out
  s.lineTo(1.50, -0.75); // sawtooth in
  s.lineTo(1.00, -0.65);
  s.lineTo(0.60, -0.80);
  s.lineTo(0.25, -0.90);
  s.lineTo(0.00, -0.95);

  // mirror for left half
  s.lineTo(-0.25, -0.90);
  s.lineTo(-0.60, -0.80);
  s.lineTo(-1.00, -0.65);
  s.lineTo(-1.50, -0.75);
  s.lineTo(-1.40, -0.55);
  s.lineTo(-1.85, -0.65);
  s.lineTo(-1.75, -0.45);
  s.lineTo(-2.15, -0.55);
  s.lineTo(-2.05, -0.35);
  s.lineTo(-2.40, -0.45);
  s.lineTo(-2.30, -0.25);
  s.lineTo(-2.55, -0.15);
  s.lineTo(-2.60, 0.10);
  s.lineTo(-2.20, 0.55);
  s.lineTo(-1.50, 1.15);
  s.lineTo(-0.90, 1.55);
  s.lineTo(-0.55, 1.75);
  s.lineTo(-0.30, 2.00);
  s.lineTo(-0.10, 2.30);
  s.lineTo(0.00, 2.60);

  return s;
}

const outline = buildWingOutline();

const baseGeo = new THREE.ExtrudeGeometry(outline, {
  depth: 0.18,
  bevelEnabled: true,
  bevelThickness: 0.04,
  bevelSize: 0.04,
  bevelSegments: 2,
  curveSegments: 4
});

baseGeo.rotateX(-Math.PI / 2);
baseGeo.center();

// wireframe version - half the triangles, sharper look
const wireGeo = new THREE.WireframeGeometry(baseGeo);

/* ---------------------------------------------------------
   CREATE THE LAYER STACK
   Four visual layers, from core to aura.
   --------------------------------------------------------- */

const uTimeAll = { value: 0 };

function makeFresnelMat(color, hot, opacity, density, speed) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor:       { value: new THREE.Color(color) },
      uHot:         { value: new THREE.Color(hot)   },
      uTime:        uTimeAll,
      uOpacity:     { value: opacity },
      uScanDensity: { value: density },
      uScanSpeed:   { value: speed   },
      uGlitch:      { value: 0.0     }
    },
    vertexShader:   vertShader,
    fragmentShader: fragShader,
    transparent:    true,
    depthWrite:     false,
    blending:       THREE.AdditiveBlending,
    side:           THREE.DoubleSide
  });
}

// layer 1 - core shell, brightest
const coreMat = makeFresnelMat(0x7fffcb, 0xe8fff4, 0.95, 42.0, 3.2);
const core = new THREE.Mesh(baseGeo, coreMat);
rig.add(core);

// layer 2 - wireframe cage, slightly larger
const wireMat = new THREE.LineBasicMaterial({
  color: 0x9fffd8,
  transparent: true,
  opacity: 0.35,
  blending: THREE.AdditiveBlending
});
const wire = new THREE.LineSegments(wireGeo, wireMat);
wire.scale.setScalar(1.004);
rig.add(wire);

// layers 3-5 - glow aura, growing outward
const auraScales = [1.02, 1.05, 1.10, 1.18];
const auraMats   = [];
for (let i = 0; i < auraScales.length; i++) {
  const op = 0.35 / (i + 1);
  const m = makeFresnelMat(0x4fd0a0, 0x7fffcb, op, 24.0, 1.8);
  const mesh = new THREE.Mesh(baseGeo, m);
  mesh.scale.setScalar(auraScales[i]);
  rig.add(mesh);
  auraMats.push(m);
}

/* ---------------------------------------------------------
   HUD ROTATION RINGS
   Two thin torus rings around the model that spin at
   different speeds. Classic sci-fi hologram garnish.
   --------------------------------------------------------- */

const ringMat = new THREE.MeshBasicMaterial({
  color: 0x7fffcb,
  transparent: true,
  opacity: 0.28,
  blending: THREE.AdditiveBlending
});

const ring1 = new THREE.Mesh(
  new THREE.TorusGeometry(3.6, 0.008, 8, 128),
  ringMat
);
ring1.rotation.x = Math.PI / 2;
rig.add(ring1);

const ring2 = new THREE.Mesh(
  new THREE.TorusGeometry(4.1, 0.006, 8, 128),
  ringMat.clone()
);
ring2.material.opacity = 0.18;
ring2.rotation.x = Math.PI / 2;
ring2.rotation.z = 0.6;
rig.add(ring2);

// tick marks around ring1
const tickGeo = new THREE.BufferGeometry();
const ticks = [];
const tickCount = 72;
for (let i = 0; i < tickCount; i++) {
  const a = (i / tickCount) * Math.PI * 2;
  const r = 3.62;
  const len = (i % 6 === 0) ? 0.14 : 0.06;
  ticks.push(
    Math.cos(a) * r, 0, Math.sin(a) * r,
    Math.cos(a) * (r + len), 0, Math.sin(a) * (r + len)
  );
}
tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
const tickLines = new THREE.LineSegments(tickGeo, ringMat.clone());
tickLines.material.opacity = 0.5;
rig.add(tickLines);

/* ---------------------------------------------------------
   PARTICLE FIELD
   Dust drifting in a sphere around the model. Adds depth.
   --------------------------------------------------------- */

const partCount = 320;
const partGeo = new THREE.BufferGeometry();
const partPos = new Float32Array(partCount * 3);
const partVel = new Float32Array(partCount * 3);

for (let i = 0; i < partCount; i++) {
  const r = 4 + Math.random() * 6;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);

  partPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
  partPos[i * 3 + 1] = r * Math.cos(phi);
  partPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

  partVel[i * 3]     = (Math.random() - 0.5) * 0.02;
  partVel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
  partVel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
}

partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));

const partMat = new THREE.PointsMaterial({
  color: 0x9fffd8,
  size: 0.03,
  transparent: true,
  opacity: 0.55,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  sizeAttenuation: true
});

const particles = new THREE.Points(partGeo, partMat);
scene.add(particles);

/* ---------------------------------------------------------
   GRID FLOOR (subtle, below the model)
   --------------------------------------------------------- */

const grid = new THREE.GridHelper(30, 40, 0x1e4a3a, 0x0e2a20);
grid.position.y = -3.2;
grid.material.transparent = true;
grid.material.opacity = 0.35;
grid.material.blending = THREE.AdditiveBlending;
scene.add(grid);

/* ---------------------------------------------------------
   CAMERA ORBIT CONTROLS (drag + scroll + keys)
   --------------------------------------------------------- */

const orbit = {
  theta: 0.5,
  phi: 1.15,
  dist: 9.5,
  target: new THREE.Vector3(0, 0, 0),
  autoSpin: true,
  autoSpeed: 0.12
};

function applyCamera() {
  const { theta, phi, dist, target } = orbit;
  camera.position.x = target.x + dist * Math.sin(phi) * Math.sin(theta);
  camera.position.y = target.y + dist * Math.cos(phi);
  camera.position.z = target.z + dist * Math.sin(phi) * Math.cos(theta);
  camera.lookAt(target);
}

let dragging = false;
let lastX = 0, lastY = 0;
let paused = false;

canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  orbit.autoSpin = false;
  lastX = e.clientX;
  lastY = e.clientY;
  document.body.classList.add('dragging');
});

window.addEventListener('mouseup', () => {
  dragging = false;
  document.body.classList.remove('dragging');
});

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;

  orbit.theta -= dx * 0.006;
  orbit.phi   -= dy * 0.006;
  orbit.phi = Math.max(0.25, Math.min(Math.PI - 0.25, orbit.phi));
  applyCamera();
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  orbit.dist += e.deltaY * 0.006;
  orbit.dist = Math.max(4.5, Math.min(22, orbit.dist));
  applyCamera();
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    paused = !paused;
    document.getElementById('v-scan').textContent = paused ? 'PAUSED' : 'VOLUMETRIC';
  }
  if (e.code === 'KeyR') {
    orbit.autoSpin = true;
    orbit.theta = 0.5;
    orbit.phi = 1.15;
    orbit.dist = 9.5;
    applyCamera();
  }
});

/* ---------------------------------------------------------
   RENDER LOOP
   --------------------------------------------------------- */

const clock = new THREE.Clock();
let frames = 0;
let fpsTimer = 0;

function frame() {
  requestAnimationFrame(frame);

  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.getElapsedTime();

  if (!paused) {
    uTimeAll.value = t;

    // auto spin when user isn't dragging
    if (orbit.autoSpin) {
      orbit.theta += orbit.autoSpeed * dt;
      applyCamera();
    }

    // rotate rings at different speeds
    ring1.rotation.z += dt * 0.15;
    ring2.rotation.z -= dt * 0.10;
    tickLines.rotation.y += dt * 0.20;

    // particle drift
    const pos = partGeo.attributes.position.array;
    for (let i = 0; i < partCount; i++) {
      pos[i * 3]     += partVel[i * 3]     * dt * 30;
      pos[i * 3 + 1] += partVel[i * 3 + 1] * dt * 30;
      pos[i * 3 + 2] += partVel[i * 3 + 2] * dt * 30;

      // recycle when too far
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      const d = Math.sqrt(x*x + y*y + z*z);
      if (d > 10) {
        pos[i * 3]     *= 0.3;
        pos[i * 3 + 1] *= 0.3;
        pos[i * 3 + 2] *= 0.3;
      }
    }
    partGeo.attributes.position.needsUpdate = true;

    // periodic glitch spike
    const glitchAmt = (Math.sin(t * 0.7) > 0.96) ? 1.0 : 0.0;
    coreMat.uniforms.uGlitch.value = glitchAmt;

    // slow bob
    rig.position.y = Math.sin(t * 0.6) * 0.08;
  }

  // HUD updates
  frames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    document.getElementById('v-fps').textContent =
      Math.round(frames / fpsTimer) + ' FPS';
    frames = 0;
    fpsTimer = 0;
  }

  const rotDeg = ((orbit.theta * 180 / Math.PI) % 360 + 360) % 360;
  document.getElementById('v-rot').textContent =
    rotDeg.toFixed(1) + '\u00B0';

  renderer.render(scene, camera);
}

/* ---------------------------------------------------------
   RESIZE + BOOT
   --------------------------------------------------------- */

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

applyCamera();
frame();
