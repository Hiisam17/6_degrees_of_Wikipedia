// src/bfs.js
import { getLinks } from "./wiki.js";

/**
 * findPathBFS(start, target, maxDepth)
 * - level-by-level BFS to guarantee shortest path by edges
 * - returns array of titles or null
 */
export async function findPathFilteredByPerson(start, target, maxDepth = 4) {
  if (start === target) return [start];
  const visited = new Set([start]);
  let queue = [[start]];
  let depth = 0;

  while (queue.length > 0 && depth <= maxDepth) {
    const nextQueue = [];
    // collect neighbors for entire layer first (to batch)
    const layerNeighborsMap = {}; // pathIndex -> neighbors array
    const allNeighbors = new Set();
    for (const path of queue) {
      const last = path[path.length - 1];
      let neighbors = [];
      try {
        neighbors = await getLinks(last);
      } catch (err) {
        continue;
      }
      layerNeighborsMap[last] = neighbors;
      for (const nb of neighbors) allNeighbors.add(nb);
    }
    // batch check which neighbors are person
    const allNeighborsArr = Array.from(allNeighbors);
    const personMap = await titlesArePerson(allNeighborsArr); // title -> bool

    for (const path of queue) {
      const last = path[path.length - 1];
      const neighbors = layerNeighborsMap[last] || [];
      for (const nb of neighbors) {
        if (visited.has(nb)) continue;
        if (!personMap[nb]) continue; // skip non-person
        const newPath = [...path, nb];
        if (nb === target) return newPath;
        visited.add(nb);
        nextQueue.push(newPath);
      }
    }
    queue = nextQueue;
    depth++;
  }
  return null;
}
