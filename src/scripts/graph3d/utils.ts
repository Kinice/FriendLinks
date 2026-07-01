// 调色板与颜色工具（从 graph/utils.ts 移植）

import * as THREE from "three";

export const PALETTE = [
  "#E69F00",
  "#56B4E9",
  "#009E73",
  "#0072B2",
  "#D55E00",
  "#CC79A7",
  "#8C564B",
  "#E377C2",
  "#7F7F7F",
  "#17BECF",
  "#4E79A7",
  "#B1C94E",
];

/**
 * 将字符串哈希为 PALETTE 索引
 */
export function hashToIndex(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % PALETTE.length;
}

/**
 * 节点度数 → 3D 节点尺寸
 */
export function degreeToSize(d: number, maxDegree: number) {
  const MIN = 2;
  const MAX = 10;
  if (!d || d <= 1) return MIN;
  const norm = Math.sqrt(d) / Math.sqrt(Math.max(1, maxDegree));
  return MIN + Math.min(1, norm) * (MAX - MIN);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const bigint = parseInt(h, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export function rgbToHex(r: number, g: number, b: number) {
  const hr = (1 << 24) + (r << 16) + (g << 8) + b;
  return "#" + hr.toString(16).slice(1);
}

/**
 * 按百分比调亮/调暗 hex 颜色
 */
export function adjustHex(hex: string, percent: number) {
  const [r, g, b] = hexToRgb(hex);
  const amt = Math.round(255 * (percent / 100));
  const nr = Math.max(0, Math.min(255, r + amt));
  const ng = Math.max(0, Math.min(255, g + amt));
  const nb = Math.max(0, Math.min(255, b + amt));
  return rgbToHex(nr, ng, nb);
}

/**
 * 根据基础色生成 emissive 发光色
 * 将颜色调亮并增加饱和度，用于 Three.js MeshStandardMaterial.emissive
 */
export function getEmissiveColor(baseHex: string, intensity: number): string {
  // intensity: 0-1，越高越亮
  const [r, g, b] = hexToRgb(baseHex);
  // 调亮：向白色混合
  const blend = Math.min(1, intensity * 0.8);
  const er = Math.round(r + (255 - r) * blend);
  const eg = Math.round(g + (255 - g) * blend);
  const eb = Math.round(b + (255 - b) * blend);
  return rgbToHex(er, eg, eb);
}

// ─── Canvas Sprite 文字标签 ─────────────────────────────────────────────────

/**
 * 用 Canvas 2D 渲染文字，生成 THREE.Sprite
 * 纯系统字体，零外部依赖，自动 billboarding
 */
export function createTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontSize = 48;

  ctx.font = `${fontSize}px sans-serif`;
  const m = ctx.measureText(text);
  const pw = 12;
  const ph = 6;
  canvas.width = Math.max(2, Math.ceil(m.width + pw * 2));
  canvas.height = Math.max(2, Math.ceil(fontSize * 1.3 + ph * 2));

  ctx.fillStyle = "#ffffff";
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(mat);
  const h = 10; // world-unit height
  sprite.scale.set(h * (canvas.width / canvas.height), h, 1);
  sprite.renderOrder = 999;

  return sprite;
}
