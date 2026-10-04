import { Color3, MeshBuilder, TransformNode, Vector3 } from './babylon';
import type { Mesh } from './babylon';
import type { Scene, StandardMaterial } from './babylon';
import { box, pole } from './geometry';
import { material, signMaterial } from './materials';
import type { Palette } from './materials';

export type SignalPhase = 'green' | 'yellow' | 'red';

export function createSignals(scene: Scene, p: Palette) {
  const sets: { lamps: StandardMaterial[]; axis: 'ns' | 'ew'; halo: Mesh; haloMat: StandardMaterial }[] = [];
  for (const [x, z, angle, axis] of [[1.85, 10.8, 0, 'ns'], [-1.85, -10.8, Math.PI, 'ns'], [10.8, -1.85, Math.PI / 2, 'ew'], [-10.8, 1.85, -Math.PI / 2, 'ew']] as const) {
    const root = new TransformNode('signal assembly', scene);
    root.position.set(x, 0, z);
    root.rotation.y = angle;
    pole(scene, 'signal standard', new Vector3(4.9, .2, 0), new Vector3(4.9, 7.5, 0), .11, p.dark, root);
    pole(scene, 'signal mast arm', new Vector3(4.9, 7.5, 0), new Vector3(-.1, 7.5, 0), .09, p.dark, root);
    box(scene, 'signal backplate', [1.28, 3.02, .1], [0, 5.9, .12], p.dark, root);
    box(scene, 'signal yellow rim', [1.13, 2.86, .12], [0, 5.9, .05], p.yellow, root);
    box(scene, 'signal housing', [.93, 2.64, .42], [0, 5.9, -.14], p.dark, root);
    const lamps: StandardMaterial[] = [];
    for (let i = 0; i < 3; i++) {
      const mat = material(scene, `signal ${axis} lamp ${i}`, '#1d332f');
      const lens = MeshBuilder.CreateCylinder('signal lens', { diameter: .58, height: .04, tessellation: 16 }, scene);
      lens.rotation.x = Math.PI / 2;
      lens.parent = root;
      lens.position.set(0, 6.69 - i * .79, -.375);
      lens.material = mat;
      box(scene, 'lamp visor', [.72, .09, .4], [0, 7.04 - i * .79, -.42], p.dark, root);
      lamps.push(mat);
    }
    // One soft disc rides to whichever lamp is lit: the signal then stays legible
    // from the far end of the approach, where a bare lens is only a few pixels wide.
    const halo = MeshBuilder.CreateDisc('signal halo', { radius: .55, tessellation: 20 }, scene);
    halo.parent = root;
    halo.position.set(0, 6.69, -.42);
    halo.rotation.y = Math.PI;
    const haloMat = material(scene, `signal ${axis} halo`, '#ffffff', 1);
    haloMat.alpha = .34;
    haloMat.disableLighting = true;
    halo.material = haloMat;
    const street = MeshBuilder.CreatePlane('street name sign', { width: 2.6, height: .59 }, scene);
    street.parent = root;
    street.position.set(3.05, 7.15, -.12);
    street.material = signMaterial(scene, `street ${axis}`, axis === 'ns' ? 'CEDAR AVE' : 'MAPLE ST');
    sets.push({ lamps, axis, halo, haloMat });
  }
  let previous = '';
  return {
    update(phase: SignalPhase, crossGreen: boolean) {
      const next = `${phase}-${crossGreen}`;
      if (next === previous) return;
      previous = next;
      for (const set of sets) {
        const active = set.axis === 'ns' ? ['red', 'yellow', 'green'].indexOf(phase) : crossGreen ? 2 : 0;
        set.lamps.forEach((mat, i) => {
          const color = Color3.FromHexString(i === active ? ['#ff6552', '#ffd45b', '#9cf197'][i] : '#20332f');
          mat.diffuseColor = color;
          mat.emissiveColor = color.scale(i === active ? 1 : .04);
        });
        set.halo.position.y = 6.69 - active * .79;
        set.haloMat.emissiveColor = Color3.FromHexString(['#ff6552', '#ffd45b', '#9cf197'][active]);
      }
    },
  };
}
