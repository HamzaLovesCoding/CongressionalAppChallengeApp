import { Mesh, MeshBuilder, TransformNode, Vector3 } from './babylon';
import type { Scene, ShadowGenerator } from './babylon';
import { box, pole } from './geometry';
import { signMaterial } from './materials';
import type { Palette } from './materials';
import { contactShade } from './lighting';

export function createScenery(scene: Scene, p: Palette, shadows: ShadowGenerator) {
  const firstMesh = scene.meshes.length;
  const movingLeaves: TransformNode[] = [];
  box(scene, 'meadow', [260, 0.2, 260], [0, -0.22, 0], p.grass);
  box(scene, 'north south road', [12.4, 0.12, 240], [0, -0.08, 0], p.asphalt);
  box(scene, 'east west road', [240, 0.12, 12.4], [0, -0.07, 0], p.asphalt);

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(scene, 'raised neighborhood block', [109, 0.25, 109], [sx * 62, 0.01, sz * 62], p.curb);
    box(scene, 'sidewalk block', [108.6, 0.12, 108.6], [sx * 62, 0.19, sz * 62], p.sidewalk);
    box(scene, 'garden block', [103.5, 0.1, 103.5], [sx * 64.5, 0.28, sz * 64.5], p.grassLight);
    for (let k = 12; k < 83; k += 4.2) {
      box(scene, 'sidewalk joint', [0.028, 0.012, 2.5], [sx * k, 0.26, sz * 8.55], p.curb);
      box(scene, 'sidewalk joint', [2.5, 0.012, 0.028], [sx * 8.55, 0.26, sz * k], p.curb);
    }
  }

  for (const side of [-1, 1]) {
    for (let t = 13; t < 117; t += 6.5) {
      for (const offset of [-0.13, 0.13]) {
        box(scene, 'double center paint', [0.085, 0.018, 4.1], [offset, 0.009, t * side], p.yellow);
        box(scene, 'double center paint', [4.1, 0.018, 0.085], [t * side, 0.01, offset], p.yellow);
      }
    }
    for (const edge of [-4.05, 4.05]) {
      box(scene, 'road edge', [0.09, 0.018, 107], [edge, 0.008, side * 65], p.marking);
      box(scene, 'road edge', [107, 0.018, 0.09], [side * 65, 0.008, edge], p.marking);
    }
    for (let x = -4.8; x <= 4.9; x += 1.15) {
      box(scene, 'zebra crossing', [0.68, 0.025, 2.25], [x, 0.016, side * 8.1], p.marking);
      box(scene, 'zebra crossing', [2.25, 0.025, 0.68], [side * 8.1, 0.016, x], p.marking);
    }
    box(scene, 'stop line', [3.7, 0.025, 0.36], [-side * 2, 0.02, side * 10.6], p.marking);
    box(scene, 'stop line', [0.36, 0.025, 3.7], [side * 10.6, 0.02, side * 2], p.marking);
  }

  function tree(x: number, z: number, scale = 1) {
    const root = new TransformNode('wind in canopy', scene);
    root.position.set(x, 4.3 * scale, z);
    movingLeaves.push(root);
    pole(scene, 'tapered tree trunk', new Vector3(x, .3, z), new Vector3(x, 4.4 * scale, z), .21 * scale, p.trunk);
    for (let k = 0; k < 3; k++) {
      const leaf = MeshBuilder.CreateIcoSphere('faceted crown', { radius: (2.05 - k * .16) * scale, subdivisions: 1, flat: true }, scene);
      leaf.parent = root;
      leaf.position.set((k - 1) * 1.15 * scale, k === 1 ? .9 * scale : 0, k === 2 ? .65 * scale : 0);
      leaf.scaling.y = 1.12;
      leaf.material = k === 1 ? p.leafLight : p.leaf;
      shadows.addShadowCaster(leaf);
    }
    box(scene, 'tree bed', [2.8, .12, 2.8], [x, .32, z], p.grass);
    contactShade(scene, 'trunk contact', .7 * scale, .7 * scale, [x, .389, z]);
  }

  function building(x: number, z: number, w: number, d: number, h: number, color: keyof Palette, title?: string) {
    const body = box(scene, 'plaster building', [w, h, d], [x, h / 2 + .3, z], p[color]);
    shadows.addShadowCaster(body);
    contactShade(scene, 'building contact', w + .25, d + .25, [x, .338, z]);
    box(scene, 'foundation', [w + .2, .38, d + .2], [x, .43, z], p.cream);
    box(scene, 'roof cap', [w + .55, .36, d + .55], [x, h + .48, z], p.roof);
    box(scene, 'upper roof trim', [w + .62, .16, d + .62], [x, h + .27, z], p.white);
    const front = z > 0 ? -1 : 1;
    for (let offset = -w / 2 + 1.2; offset < w / 2 - .7; offset += 2.3) {
      for (let level = 0; level < Math.floor(h / 2.7); level++) {
        box(scene, 'window sill', [1.65, .12, .28], [x + offset, 1.1 + level * 2.65, z + front * (d / 2 + .1)], p.white);
        box(scene, 'window frame', [1.55, 1.8, .11], [x + offset, 2.05 + level * 2.65, z + front * (d / 2 + .05)], p.white);
        box(scene, 'window glass', [1.28, 1.55, .12], [x + offset, 2.05 + level * 2.65, z + front * (d / 2 + .08)], p.glass);
        box(scene, 'window mullion', [.055, 1.58, .13], [x + offset, 2.05 + level * 2.65, z + front * (d / 2 + .1)], p.cream);
      }
    }
    for (let offset = -d / 2 + 1.5; offset < d / 2 - .5; offset += 2.7) {
      const inner = x > 0 ? -1 : 1;
      box(scene, 'side window', [.12, 1.6, 1.3], [x + inner * (w / 2 + .03), 2.4, z + offset], p.glass);
    }
    if (title) {
      const sign = MeshBuilder.CreatePlane('local storefront lettering', { width: w * .75, height: .9 }, scene);
      sign.position.set(x, 3.45, z + front * (d / 2 + .13));
      if (front > 0) sign.rotation.y = Math.PI;
      sign.material = signMaterial(scene, title, title, color === 'peach' ? '#a85b43' : '#416e63');
      const canopy = box(scene, 'storefront awning', [w - .5, .17, 1.5], [x, 2.85, z + front * (d / 2 + .65)], p[color === 'peach' ? 'cream' : 'teal']);
      canopy.rotation.x = front * .1;
      shadows.addShadowCaster(canopy);
    }
  }

  building(-19, 19, 12, 12, 6.4, 'cream', 'CEDAR & CO.');
  building(19, 20, 13, 13, 7.9, 'peach', 'THE CORNER');
  building(-22, -23, 15, 13, 5.8, 'teal', 'FIELD NOTES');
  building(23, -23, 14, 12, 6.3, 'cream', 'DAILY GOODS');
  for (const side of [-1, 1]) for (let n = 0; n < 4; n++) {
    building(side * (18 + n % 2 * 3), 44 + n * 19, 11, 10, 5 + n % 2 * 2, n % 2 ? 'teal' : 'cream');
    building(side * (45 + n * 19), 19, 10, 11, 5.6, n % 2 ? 'cream' : 'peach');
    building(side * 19, -46 - n * 20, 11, 11, 5.4, n % 2 ? 'peach' : 'teal');
  }
  for (const side of [-1, 1]) {
    for (const z of [-65, -42, -13, 12, 33, 55, 79]) tree(side * (z === -13 || z === 12 ? 12 : 10.5), z, z === 12 ? 1.1 : .85);
    for (const x of [34, 56, 78]) tree(x * side, -11.5, .9);
    for (const z of [-53, -19, 17, 48, 80]) {
      const x = side * 6.9;
      pole(scene, 'streetlight pole', new Vector3(x, .3, z), new Vector3(x, 6.7, z), .075, p.dark);
      pole(scene, 'streetlight arm', new Vector3(x, 6.7, z), new Vector3(x - side * 1.7, 7, z), .065, p.dark);
      box(scene, 'streetlight head', [.65, .14, 1.05], [x - side * 1.7, 7, z], p.dark);
      box(scene, 'streetlight lens', [.52, .025, .85], [x - side * 1.7, 6.92, z], p.white);
    }
  }
  // Several long, low garden hedges keep the blocks grounded at street level.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(scene, 'garden hedge', [8, .8, 1.2], [sx * 20, .75, sz * 11.5], p.leaf);
    box(scene, 'garden hedge', [1.2, .8, 7], [sx * 11.8, .75, sz * 21], p.leaf);
  }

  const speedSign = MeshBuilder.CreatePlane('20 mph neighborhood sign', { width: .85, height: 1.05 }, scene);
  speedSign.position.set(6.8, 2.4, -31);
  speedSign.material = signMaterial(scene, 'speed sign', '20', '#f1f0e3', '#273e3e');
  pole(scene, 'sign post', new Vector3(6.8, .3, -31), new Vector3(6.8, 2.95, -31), .05, p.metal);

  // Merge immobile meshes by material: detailed scenery stays inexpensive to draw.
  const groups = new Map<string, Mesh[]>();
  for (const mesh of scene.meshes.slice(firstMesh)) {
    if (!(mesh instanceof Mesh) || mesh.parent || !mesh.material) continue;
    const key = mesh.material.uniqueId.toString();
    const group = groups.get(key) ?? [];
    group.push(mesh);
    groups.set(key, group);
  }
  for (const meshes of groups.values()) {
    if (meshes.length < 2) { meshes[0]?.freezeWorldMatrix(); continue; }
    const castsShadow = meshes.some(mesh => shadows.getShadowMap()?.renderList?.includes(mesh));
    const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
    if (merged) {
      merged.name = `neighborhood / ${merged.material?.name}`;
      merged.receiveShadows = true;
      if (meshes.some(mesh => mesh.hasVertexAlpha)) merged.hasVertexAlpha = true;
      merged.freezeWorldMatrix();
      if (castsShadow) shadows.addShadowCaster(merged);
    }
  }
  return {
    update(time: number) {
      movingLeaves.forEach((leaves, index) => { leaves.rotation.z = Math.sin(time * .85 + index * 1.9) * .012; });
    },
    animationCount: movingLeaves.length,
  };
}
