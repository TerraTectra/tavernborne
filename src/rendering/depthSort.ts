export type DepthSortable = {
  id: string;
  y: number;
  depthOffset?: number;
};

export function sortBySceneDepth<T extends DepthSortable>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftDepth = left.y + (left.depthOffset ?? 0);
    const rightDepth = right.y + (right.depthOffset ?? 0);
    return leftDepth === rightDepth ? left.id.localeCompare(right.id) : leftDepth - rightDepth;
  });
}
