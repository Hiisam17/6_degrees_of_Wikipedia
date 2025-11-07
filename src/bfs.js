// src/bfs.js
import { getLinks } from "./wiki.js";

/**
 * findPathBFS(start, target, maxDepth)
 * - level-by-level BFS to guarantee shortest path by edges
 * - returns array of titles or null
 */
export async function findPathBFS(start, target, maxDepth = 4) {
  if (!start || !target) return null;
  if (start === target) return [start];

  const visited = new Set([start]);
  let queue = [[start]]; // each element is a path array
  let depth = 0;
  let nodesExplored = 0;
  let apiCalls = 0;

  while (queue.length > 0 && depth <= maxDepth) {
    const nextQueue = [];
    for (const path of queue) {
      const last = path[path.length - 1];
      nodesExplored++;
      let neighbors = [];
      try {
        neighbors = await getLinks(last);
        apiCalls++;
      } catch (err) {
        console.warn(`getLinks failed for ${last}: ${err.message}`);
        continue; // skip this node
      }

      for (const nb of neighbors) {
        if (visited.has(nb)) continue;
        const newPath = [...path, nb];
        if (nb === target) {
          return { path: newPath, stats: { nodesExplored, apiCalls, depth } };
        }
        visited.add(nb);
        nextQueue.push(newPath);
      }
    }
    queue = nextQueue;
    depth++;
  }
  return { path: null, stats: { nodesExplored, apiCalls, depth } };
}
