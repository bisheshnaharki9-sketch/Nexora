const canvas = document.getElementById('b2');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth/innerHeight, 0.1, 100);
camera.position.set(0, 3.2, 3.6);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

scene.add(new THREE.AmbientLight(0x7fffcb, 0.4));
const key = new THREE.DirectionalLight(0x7fffcb, 0.9);
key.position.set(2, 4, 3);
scene.add(key);

const shape = new THREE.Shape();
shape.moveTo(0, 1.0);
shape.lineTo(0.15, 0.7);
shape.lineTo(1.0, -0.3);
shape.lineTo(0.55, -0.25);
shape.lineTo(0.7, -0.45);
shape.lineTo(0.35, -0.35);
shape.lineTo(0.4, -0.55);
shape.lineTo(0, -0.5);
shape.lineTo(-0.4, -0.55);
shape.lineTo(-0.35, -0.35);
shape.lineTo(-0.7, -0.45);
shape.lineTo(-0.55, -0.25);
shape.lineTo(-1.0, -0.3);
shape.lineTo(-0.15, 0.7);
shape.lineTo(0, 1.0);

const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
geo.rotateX(-Math.PI / 2);
geo.center();

const mat = new THREE.MeshBasicMaterial({
  color: 0x7fffcb, wireframe: true, transparent: true, opacity: 0.55
});

const b2 = new THREE.Mesh(geo, mat);
scene.add(b2);

const glow = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({
  color: 0x4fd0a0, transparent: true, opacity: 0.08
}));
scene.add(glow);

let t = 0;
function frame() {
  t += 0.01;
  b2.rotation.y = t;
  glow.rotation.y = t;
  b2.position.y = Math.sin(t * 2) * 0.05;
  glow.position.y = b2.position.y;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
