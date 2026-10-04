import { Color3, FreeCamera, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from './babylon';
import type { Engine, Scene } from './babylon';
import { material } from './materials';
import type { Palette } from './materials';
import type { Vehicle } from './vehicles';

export type CameraMode = 'driver' | 'overhead';

// Cabin trim is authored in screen units: x and y run -1..1 across the frame on a
// plane a little way ahead of the eye, so one layout frames correctly at any aspect.
const TRIM_PLANE = 1.12;
// The bonnet edge is pinned to this screen height and the eye height is solved from
// it, and the pitch puts the horizon here, so portrait and landscape compose alike.
const HOOD_SCREEN_Y = -0.46;
const HORIZON_SCREEN_Y = 0.1;
const HOOD_TOP = 1.06;
const HOOD_NOSE = 1.75;
const LOOK_AHEAD = 35;

function unlit(scene: Scene, name: string, hex: string) {
  // The cabin sits in its own shade, so flat colour keeps it a calm frame around the road.
  const mat = new StandardMaterial(name, scene);
  mat.disableLighting = true;
  mat.diffuseColor = Color3.Black();
  mat.emissiveColor = Color3.FromHexString(hex);
  return mat;
}

export function createCameras(scene: Scene, engine: Engine, player: Vehicle, p: Palette, paint: string) {
  const camera = new FreeCamera('cinematic camera', new Vector3(1.85, 1.46, -79.84), scene);
  camera.minZ = 0.04;
  camera.maxZ = 210;
  camera.inputs.clear();
  camera.inertia = 0;
  scene.activeCamera = camera;

  const interior = new TransformNode('cabin interior', scene);
  interior.parent = camera;

  // The player's own bodywork is hidden from this seat. The bonnet beyond the
  // windscreen is drawn here instead, in metres, so sunlight still falls across it.
  const bonnet = new TransformNode('bonnet', scene);
  bonnet.parent = interior;
  // Three lengthwise tones and a pair of shut lines give the panel a crown instead
  // of reading as one flat slab of colour across the bottom of the frame.
  // Seen from behind the windscreen the bonnet sits in its own light, so it is mixed
  // darker than the body colour rather than glaring back at the driver.
  const shade = (amount: number) => Color3.FromHexString(paint).scale(amount).toHexString();
  const bodyPaint = material(scene, 'bonnet paint', shade(0.72), 0.04);
  const crownPaint = material(scene, 'bonnet crown', shade(1), 0.06);
  const shadePaint = material(scene, 'bonnet shade', shade(0.3), 0);
  for (const [name, size, at, mat] of [
    ['bonnet panel', [1.78, 0.46, 0.94], [0, -0.235, 1.28], bodyPaint],
    ['bonnet crown', [0.62, 0.018, 0.9], [0, 0.008, 1.27], crownPaint],
    ['left shut line', [0.055, 0.026, 0.9], [-0.44, 0.012, 1.27], shadePaint],
    ['right shut line', [0.055, 0.026, 0.9], [0.44, 0.012, 1.27], shadePaint],
    ['left wing crest', [0.34, 0.03, 0.92], [-0.7, 0.015, 1.28], crownPaint],
    ['right wing crest', [0.34, 0.03, 0.92], [0.7, 0.015, 1.28], crownPaint],
    ['bonnet nose', [1.74, 0.22, 0.1], [0, -0.13, 1.79], p.dark],
    ['windscreen cowl', [1.9, 0.12, 0.26], [0, -0.04, 0.72], p.dark],
  ] as const) {
    const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.position.set(at[0], at[1], at[2]);
    mesh.material = mat;
    mesh.receiveShadows = false;
    mesh.parent = bonnet;
  }

  const trim = new TransformNode('cabin trim', scene);
  trim.parent = interior;
  const shellMat = unlit(scene, 'cabin trim shade', '#24393b');
  const faceMat = unlit(scene, 'dashboard face', '#17282b');
  const rimMat = unlit(scene, 'dashboard rim light', '#5f8376');
  const glassMat = unlit(scene, 'mirror glass', '#a5c0c1');
  function panel(name: string, mat: StandardMaterial, x: number, y: number, width: number, height: number, depth: number, plane: number) {
    // Width and height arrive in screen units; only depth is a real thickness.
    const mesh = MeshBuilder.CreateBox(name, { width: width * plane, height: height * plane, depth }, scene);
    mesh.position.set(x * plane, y * plane, plane);
    mesh.material = mat;
    mesh.receiveShadows = false;
    mesh.parent = trim;
    return mesh;
  }
  panel('dashboard face', faceMat, 0, -1.41, 2.6, 1.34, 0.04, 0.62);
  panel('dashboard cowl', shellMat, 0, -0.8, 2.6, 0.12, 0.05, 0.62);
  panel('dashboard rim light', rimMat, 0, -0.7425, 2.6, 0.01, 0.05, 0.615);
  panel('instrument binnacle', shellMat, 0, -0.718, 0.68, 0.06, 0.07, 0.58);
  panel('windscreen header', shellMat, 0, 1.6, 2.6, 1.3, 0.05, 1);
  panel('header trim light', rimMat, 0, 0.9445, 2.6, 0.01, 0.05, 0.995);
  const steering = MeshBuilder.CreateTorus('steering wheel', { diameter: 0.88 * 0.5, thickness: 0.05 * 0.5, tessellation: 28 }, scene);
  steering.position.set(0, -1.07 * 0.5, 0.5);
  steering.rotation.x = 0.35;
  steering.material = shellMat;
  steering.parent = trim;
  for (const side of [-1, 1]) {
    const pillar = panel('windscreen pillar', shellMat, side * 0.985, 0.2, 0.11, 1.5, 0.06, 1);
    pillar.rotation.z = side * 0.08;
    panel('mirror arm', shellMat, side * 0.74, -0.33, 0.1, 0.018, 0.04, 0.95);
    panel('door mirror shell', shellMat, side * 0.845, -0.335, 0.13, 0.1, 0.05, 0.95);
    panel('door mirror glass', glassMat, side * 0.845, -0.332, 0.105, 0.072, 0.012, 0.938);
  }
  panel('rear view mirror', shellMat, 0.4, 0.862, 0.24, 0.07, 0.05, 0.92);
  panel('rear view glass', glassMat, 0.4, 0.862, 0.216, 0.05, 0.012, 0.91);

  let mode: CameraMode = 'driver';
  let target = new Vector3(1.85, 1.4, -48);
  let transition = 1;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show = (driving: boolean) => {
    interior.setEnabled(driving);
    player.body.setEnabled(!driving);
  };
  return {
    camera,
    get mode() { return mode; },
    setMode(next: CameraMode) {
      if (mode === next) return;
      mode = next;
      transition = reducedMotion ? 1 : 0;
      show(mode === 'driver');
    },
    update(dt: number, playerZ: number, time: number, moving: boolean) {
      const aspect = engine.getRenderWidth() / engine.getRenderHeight();
      const portrait = aspect < 0.9;
      const driving = mode === 'driver';
      const fov = driving ? (portrait ? 1.04 : 0.86) : portrait ? 0.95 : 0.98;
      camera.fov = fov;
      const vtan = Math.tan(fov / 2);
      transition = Math.min(1, transition + dt * 1.4);
      const blend = transition >= 1 ? 1 : 1 - Math.exp(-dt * 5);
      const bob = moving && !reducedMotion ? Math.sin(time * 7.2) * 0.005 : 0;
      // The bonnet rides with the camera, so its screen height follows from the eye alone.
      const eye = HOOD_TOP - HOOD_SCREEN_Y * HOOD_NOSE * vtan;
      trim.scaling.set(vtan * aspect * TRIM_PLANE, vtan * TRIM_PLANE, TRIM_PLANE);
      bonnet.position.y = HOOD_TOP - eye;
      const position = driving
        ? new Vector3(player.root.position.x, eye + bob, playerZ + 0.16)
        : portrait ? new Vector3(28, 44, -52) : new Vector3(26, 34, -40);
      const look = driving
        ? new Vector3(player.root.position.x, eye - LOOK_AHEAD * HORIZON_SCREEN_Y * vtan, playerZ + LOOK_AHEAD)
        : portrait ? new Vector3(3, 0, -18) : new Vector3(3, 0, -13);
      camera.position = Vector3.Lerp(camera.position, position, blend);
      target = Vector3.Lerp(target, look, blend);
      camera.setTarget(target);
      show(driving && transition > 0.8);
    },
  };
}
