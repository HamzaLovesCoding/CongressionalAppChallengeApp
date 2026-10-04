import { Color3, DynamicTexture, StandardMaterial } from './babylon';
import type { Scene } from './babylon';

export function material(scene: Scene, name: string, hex: string, emission = 0) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(hex);
  result.specularColor = new Color3(0.07, 0.07, 0.07);
  result.emissiveColor = result.diffuseColor.scale(emission);
  return result;
}

export function palette(scene: Scene) {
  return {
    grass: material(scene, 'sage meadow', '#8dae77'),
    grassLight: material(scene, 'garden lawns', '#9fbd86'),
    asphalt: material(scene, 'blue slate asphalt', '#54626b'),
    curb: material(scene, 'warm concrete', '#dadbd0'),
    sidewalk: material(scene, 'limestone sidewalk', '#ece7d9'),
    marking: material(scene, 'warm white road paint', '#fcf5df'),
    yellow: material(scene, 'center line ochre', '#f8cc58'),
    dark: material(scene, 'powder coated charcoal', '#263d40'),
    trunk: material(scene, 'tree bark', '#927557'),
    leaf: material(scene, 'leaf green', '#638a65'),
    leafLight: material(scene, 'sunlit leaves', '#88a96b'),
    glass: material(scene, 'blue grey glass', '#7ea6ab'),
    cream: material(scene, 'ivory plaster', '#eee5d1'),
    peach: material(scene, 'terracotta plaster', '#d8a78c'),
    teal: material(scene, 'soft sage plaster', '#94b3a8'),
    roof: material(scene, 'warm charcoal roofing', '#657270'),
    white: material(scene, 'porcelain', '#f4f0de'),
    metal: material(scene, 'brushed street metal', '#91a29c'),
  };
}
export type Palette = ReturnType<typeof palette>;

export function signMaterial(scene: Scene, name: string, text: string, bg = '#315e57', fg = '#ffffff') {
  const texture = new DynamicTexture(name, { width: 512, height: 128 }, scene, false);
  const ctx = texture.getContext();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.font = '600 54px Arial';
  ctx.fillStyle = fg;
  ctx.fillText(text, (512 - ctx.measureText(text).width) / 2, 84);
  texture.update();
  const mat = material(scene, name, '#ffffff', 0.15);
  mat.diffuseTexture = texture;
  mat.backFaceCulling = false;
  return mat;
}
