import { Color3, MeshBuilder, StandardMaterial } from './babylon';
import type { Scene } from './babylon';
import { box } from './geometry';
import { material } from './materials';
import { CAR_FRONT, DECISION_Z, STOP_LINE_Z } from '../scenario/scenario';
import type { Scenario } from '../scenario/scenario';

function translucent(scene: Scene, name: string, hex: string, alpha: number) {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(hex);
  mat.emissiveColor = Color3.FromHexString(hex).scale(0.55);
  mat.alpha = alpha;
  return mat;
}

export function createReplayAnnotations(scene: Scene) {
  const cyan = material(scene, 'replay player turquoise', '#2fb6bd', 0.7);
  const coral = material(scene, 'replay crossing coral', '#ff8b52', 0.6);
  const amber = material(scene, 'replay stop line amber', '#ffcf5c', 0.75);
  const from = DECISION_Z + CAR_FRONT;
  // Laid end to end the two strips fill the whole gap to the stop line, so the
  // stopping distance and the room left over read as one measurement.
  const needed = box(scene, 'recorded travel distance', [2.9, 0.03, 1],
    [1.85, 0.055, from], translucent(scene, 'braking distance', '#25a7ad', 0.6));
  const spare = box(scene, 'room to spare', [2.9, 0.03, 1],
    [1.85, 0.055, from], translucent(scene, 'spare room', '#ffc95e', 0.62));
  const line = box(scene, 'highlighted stop line', [4.3, 0.07, 0.52], [2, 0.075, STOP_LINE_Z], amber);
  const start = box(scene, 'decision position', [3.5, 0.05, 0.2], [1.85, 0.065, from], cyan);
  const finish = box(scene, 'braking distance marker', [3.5, 0.05, 0.2], [1.85, 0.065, from], cyan);
  const playerRing = MeshBuilder.CreateTorus('player highlight', { diameter: 5.2, thickness: 0.12, tessellation: 40 }, scene);
  playerRing.material = cyan;
  const crossRing = MeshBuilder.CreateTorus('cross traffic highlight', { diameter: 5.2, thickness: 0.12, tessellation: 40 }, scene);
  crossRing.material = coral;
  const meshes = [needed, spare, line, start, finish, playerRing, crossRing];
  meshes.forEach(mesh => mesh.setEnabled(false));
  return {
    update(visible: boolean, scenario: Scenario) {
      meshes.forEach(mesh => mesh.setEnabled(visible));
      const distance = scenario.stoppingDistance ?? scenario.travelledDistance;
      const end = from + distance;
      const room = Math.max(0, STOP_LINE_Z - end);
      needed.scaling.z = Math.max(.001, distance);
      needed.position.z = from + distance / 2;
      spare.scaling.z = Math.max(.001, room);
      spare.position.z = end + room / 2;
      needed.setEnabled(visible && distance > 0);
      spare.setEnabled(visible && scenario.safeStop && room > 0);
      finish.position.z = end;
      finish.setEnabled(visible && scenario.stoppingDistance !== null);
      playerRing.position.set(1.85, 0.16, scenario.playerZ);
      crossRing.position.set(scenario.crossX, 0.16, 1.85);
    },
    snapshot: () => ({ endZ: needed.position.z + needed.scaling.z / 2, finishVisible: finish.isEnabled(), spareVisible: spare.isEnabled() }),
  };
}
