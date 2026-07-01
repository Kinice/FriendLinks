/**
 * Raycaster 交互层
 * 替代 3d-force-graph 的 hover/click 事件系统
 */
import * as THREE from "three";
import type { RenderContext } from "./renderer";
import type { GraphNode } from "../../../types/graph";

export type HoverCallback = (node: GraphNode | null) => void;
export type ClickCallback = (node: GraphNode) => void;

export interface InteractionContext {
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  onHover: HoverCallback | null;
  onClick: ClickCallback | null;
  onRightClick: ClickCallback | null;
  hoveredIndex: number | null;
}

export function createInteraction(
  ctx: RenderContext,
  nodes: GraphNode[],
): InteractionContext {
  const ix: InteractionContext = {
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    onHover: null,
    onClick: null,
    onRightClick: null,
    hoveredIndex: null,
  };

  const allInstanced = [ctx.nodes];
  let lastHoveredId: string | null = null;

  function getNodeAtMouse(event: MouseEvent): GraphNode | null {
    const rect = ctx.renderer.domElement.getBoundingClientRect();
    ix.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ix.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    ix.raycaster.setFromCamera(ix.mouse, ctx.camera);

    let closestDist = Infinity;
    let closestIndex = -1;

    for (const mesh of allInstanced) {
      const intersects = ix.raycaster.intersectObject(mesh);
      for (const hit of intersects) {
        if (hit.distance < closestDist && hit.instanceId != null) {
          closestDist = hit.distance;
          closestIndex = hit.instanceId;
        }
      }
    }

    if (closestIndex >= 0 && closestIndex < nodes.length) {
      return nodes[closestIndex];
    }
    return null;
  }

  // ── Mouse move → hover ──
  ctx.renderer.domElement.addEventListener("mousemove", (event: MouseEvent) => {
    const node = getNodeAtMouse(event);
    const newId = node ? node.id : null;

    if (lastHoveredId !== newId) {
      lastHoveredId = newId;
      ix.onHover?.(node);
    }
  });

  // ── Click ──
  ctx.renderer.domElement.addEventListener("click", (event: MouseEvent) => {
    const node = getNodeAtMouse(event);
    if (node) ix.onClick?.(node);
  });

  // ── Right-click ──
  ctx.renderer.domElement.addEventListener("contextmenu", (event: MouseEvent) => {
    event.preventDefault();
    const node = getNodeAtMouse(event);
    if (node) ix.onRightClick?.(node);
  });

  return ix;
}
