import { MeshBuilder, Vector3 } from './babylon';
import type { Material, Scene, TransformNode } from './babylon';

export function box(scene: Scene, name: string, size: [number, number, number], position: [number, number, number], mat: Material, parent?: TransformNode) {
  const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(...position);
  mesh.material = mat;
  mesh.receiveShadows = true;
  if (parent) mesh.parent = parent;
  return mesh;
}

export function pole(scene: Scene, name: string, start: Vector3, end: Vector3, radius: number, mat: Material, parent?: TransformNode) {
  const mesh = MeshBuilder.CreateCylinder(name, { height: Vector3.Distance(start, end), diameter: radius * 2, tessellation: 8 }, scene);
  mesh.position = start.add(end).scale(0.5);
  mesh.setDirection(end.subtract(start), Math.PI / 2);
  mesh.material = mat;
  if (parent) mesh.parent = parent;
  return mesh;
}
