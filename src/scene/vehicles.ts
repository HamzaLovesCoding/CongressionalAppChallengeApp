import { Mesh, MeshBuilder, TransformNode, VertexData } from './babylon';
import type { Scene, ShadowGenerator } from './babylon';
import { box } from './geometry';
import { material } from './materials';
import type { Palette } from './materials';
import { contactShade } from './lighting';

function shell(scene: Scene, name: string, rings: number[][]) {
  const positions = rings.flatMap(([y, w, back, front]) => [-w, y, back, w, y, back, w, y, front, -w, y, front]);
  const indices: number[] = [0, 2, 1, 0, 3, 2];
  for (let r = 0; r < rings.length - 1; r++) for (let j = 0; j < 4; j++) {
    const a = r * 4 + j, b = r * 4 + (j + 1) % 4, c = b + 4, d = a + 4;
    indices.push(a, b, c, a, c, d);
  }
  const top = (rings.length - 1) * 4;
  indices.push(top, top + 1, top + 2, top, top + 2, top + 3);
  const mesh = new Mesh(name, scene);
  const vertexData = new VertexData();
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.uvs = new Array(positions.length / 3 * 2).fill(0);
  vertexData.applyToMesh(mesh);
  mesh.convertToFlatShadedMesh();
  return mesh;
}

export function createVehicle(scene: Scene, p: Palette, shadows: ShadowGenerator, name: string, color: string) {
  const root = new TransformNode(name, scene);
  const body = new TransformNode(`${name} suspension`, scene);
  body.parent = root;
  contactShade(scene, `${name} ground contact`, 1.6, 3.6, [0, .035, 0], root);
  const paint = material(scene, `${name} satin paint`, color, .035);
  const rubber = material(scene, `${name} tires`, '#253338');
  const glass = material(scene, `${name} tinted glazing`, '#35575f');
  glass.specularColor.set(.4, .5, .5);
  const headlamp = material(scene, `${name} headlamp`, '#f6eed5', .4);
  const tail = material(scene, `${name} tail lamp`, '#d85e4c', .35);
  const hull = shell(scene, `${name} sculpted body`, [[.34, .82, -1.96, 1.96], [.57, .96, -2.05, 2.1], [.96, .9, -1.87, 1.97], [1.06, .79, -1.6, 1.61]]);
  hull.material = paint;
  hull.parent = body;
  const cabin = new TransformNode(`${name} cabin`, scene);
  cabin.parent = body;
  const window = shell(scene, `${name} wraparound windows`, [[1.04, .78, -1.37, .87], [1.7, .64, -.94, .19]]);
  window.material = glass;
  window.parent = cabin;
  box(scene, 'floating painted roof', [1.32, .1, 1.2], [0, 1.71, -.38], paint, cabin);
  box(scene, 'left B pillar', [.045, .55, .12], [-.724, 1.34, -.51], paint, cabin);
  box(scene, 'right B pillar', [.045, .55, .12], [.724, 1.34, -.51], paint, cabin);
  box(scene, 'hood inset', [1.48, .025, .85], [0, 1.055, 1.26], paint, body);
  box(scene, 'front grille', [.91, .14, .04], [0, .64, 2.105], p.dark, body);
  box(scene, 'front bumper', [1.71, .12, .06], [0, .42, 2.09], p.metal, body);
  box(scene, 'rear bumper', [1.7, .1, .06], [0, .43, -2.04], p.dark, body);
  for (const side of [-1, 1]) {
    box(scene, 'headlight', [.42, .18, .08], [side * .63, .82, 2.055], headlamp, body);
    box(scene, 'rear light', [.48, .16, .065], [side * .59, .84, -1.94], tail, body);
    box(scene, 'door handle', [.04, .05, .21], [side * .912, 1.0, -.57], p.metal, body);
    box(scene, 'side mirror', [.23, .16, .28], [side * 1.01, 1.2, .38], paint, cabin);
  }
  const wheelAxles: TransformNode[] = [];
  for (const x of [-.91, .91]) for (const z of [-1.29, 1.31]) {
    const axle = new TransformNode('wheel axle', scene);
    axle.position.set(x, .4, z);
    axle.parent = root;
    wheelAxles.push(axle);
    const wheel = MeshBuilder.CreateCylinder('twelve sided tire', { diameter: .74, height: .23, tessellation: 12 }, scene);
    wheel.rotation.z = Math.PI / 2;
    wheel.material = rubber;
    wheel.parent = axle;
    const hub = MeshBuilder.CreateCylinder('wheel hub', { diameter: .39, height: .245, tessellation: 8 }, scene);
    hub.parent = wheel;
    hub.material = p.metal;
  }
  // Parts are merged per material so each car costs a handful of draw calls.
  for (const parent of [body, cabin]) {
    const grouped = new Map<number, Mesh[]>();
    for (const child of parent.getChildren()) if (child instanceof Mesh && child.material) {
      const group = grouped.get(child.material.uniqueId) ?? [];
      group.push(child);
      grouped.set(child.material.uniqueId, group);
    }
    for (const group of grouped.values()) {
      const merged = Mesh.MergeMeshes(group, true, true);
      if (merged) { merged.parent = parent; shadows.addShadowCaster(merged); }
    }
  }
  return {
    root, body,
    update(time: number, moving: boolean, braking = false) {
      body.position.y = moving ? Math.sin(time * 8.5) * .009 : 0;
      body.rotation.x = braking ? -.022 : 0;
      if (moving) for (const axle of wheelAxles) axle.rotation.x = -time * 9;
    },
  };
}
export type Vehicle = ReturnType<typeof createVehicle>;

export function createAmbientTraffic(scene: Scene, p: Palette, shadows: ShadowGenerator) {
  const incoming = createVehicle(scene, p, shadows, 'sage hatchback', '#b3c4a1');
  incoming.root.position.set(-1.85, 0, 22);
  incoming.root.rotation.y = Math.PI;
  const distant = createVehicle(scene, p, shadows, 'ivory commuter', '#e7dfc8');
  distant.root.position.set(1.85, 0, 38);
  for (const [x, z, color] of [[4.95, -24, '#ddd4c2'], [-4.95, 29, '#b3bfc6'], [4.95, 47, '#a86a54'], [-4.95, -49, '#6f9390']] as const) {
    const parked = createVehicle(scene, p, shadows, 'parked car', color);
    parked.root.position.set(x, 0, z);
    if (x < 0) parked.root.rotation.y = Math.PI;
  }
  return {
    update(worldTime: number) {
      incoming.root.position.z = 27 - worldTime * 7.4;
      distant.root.position.z = 29 + worldTime * 8.6;
      incoming.update(worldTime, true);
      distant.update(worldTime, true);
    },
    animationCount: 2,
  };
}
