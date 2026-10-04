import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3, VertexData } from './babylon';
import type { DirectionalLight, Scene, TransformNode } from './babylon';

export function createSky(scene: Scene) {
  const sky = MeshBuilder.CreateSphere('gradient morning sky', { diameter: 390, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
  const material = new StandardMaterial('sky vertex gradient', scene);
  material.disableLighting = true;
  material.emissiveColor = Color3.White();
  material.diffuseColor = Color3.White();
  material.linkEmissiveWithDiffuse = true;
  material.fogEnabled = false;
  sky.material = material;
  sky.infiniteDistance = true;
  sky.isPickable = false;
  sky.alwaysSelectAsActiveMesh = true;
  const positions = sky.getVerticesData('position')!;
  const colors: number[] = [];
  const horizon = Color3.FromHexString('#d6e5df');
  const zenith = Color3.FromHexString('#75a9c5');
  for (let i = 0; i < positions.length; i += 3) {
    const blend = Math.pow(Math.max(0, positions[i + 1] / 195), .65);
    const color = Color3.Lerp(horizon, zenith, blend);
    colors.push(color.r, color.g, color.b, 1);
  }
  sky.setVerticesData('color', colors);
}

// A feathered footprint grounds objects without another render target or texture.
export function contactShade(scene: Scene, name: string, width: number, depth: number, position: [number, number, number], parent?: TransformNode) {
  let material = scene.getMaterialByName('soft contact shade');
  if (!material) {
    const shade = new StandardMaterial('soft contact shade', scene);
    shade.disableLighting = true;
    shade.emissiveColor = Color3.FromHexString('#243d37');
    shade.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
    shade.disableDepthWrite = true;
    shade.backFaceCulling = false;
    material = shade;
  }
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  const fade = .45;
  data.positions = [
    -width / 2, 0, -depth / 2, width / 2, 0, -depth / 2, width / 2, 0, depth / 2, -width / 2, 0, depth / 2,
    -width / 2 - fade, 0, -depth / 2 - fade, width / 2 + fade, 0, -depth / 2 - fade,
    width / 2 + fade, 0, depth / 2 + fade, -width / 2 - fade, 0, depth / 2 + fade,
  ];
  data.indices = [0, 2, 1, 0, 3, 2];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    data.indices.push(i, i + 4, j + 4, i, j + 4, j);
  }
  data.normals = Array.from({ length: 8 }, () => [0, 1, 0]).flat();
  data.colors = Array.from({ length: 8 }, (_, i) => [1, 1, 1, i < 4 ? .2 : 0]).flat();
  data.applyToMesh(mesh);
  mesh.hasVertexAlpha = true;
  mesh.material = material;
  mesh.position.set(...position);
  mesh.parent = parent ?? null;
  mesh.isPickable = false;
  return mesh;
}

export function focusShadows(sun: DirectionalLight) {
  // Keep the same 1024 map, concentrating its texels on the teaching area.
  const span = 90;
  sun.shadowFrustumSize = span;
  const forward = sun.direction.normalizeToNew();
  const right = Vector3.Cross(Vector3.Up(), forward).normalize();
  const up = Vector3.Cross(forward, right).normalize();
  const texel = span / 1024;
  return (overhead: boolean, playerZ: number) => {
    const target = new Vector3(0, 0, overhead ? -18 : playerZ + 22);
    // Snap in light space to keep stationary kerbs from shimmering as the car moves.
    const x = Vector3.Dot(target, right), y = Vector3.Dot(target, up);
    target.addInPlace(right.scale(Math.round(x / texel) * texel - x));
    target.addInPlace(up.scale(Math.round(y / texel) * texel - y));
    sun.position.copyFrom(target.subtract(forward.scale(80)));
  };
}
