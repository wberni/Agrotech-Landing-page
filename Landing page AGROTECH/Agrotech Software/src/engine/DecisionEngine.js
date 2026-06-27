import { CONFIG } from '../config.js';

// ============================================================
// DECISION ENGINE — heurístico de ruteo basado en scoring
//
//   score = (travelTime + expectedQueueTime) * costFactor + congestionPenalty
//
// Más bajo = mejor. No es ML: es una función de costo explícita y
// fácil de calibrar, pero ya no decide solo por distancia/tiempo:
// también pesa cuánto cuesta económicamente cada alternativa.
// ============================================================

export function isNodeOperating(node, opHour) {
  if (!node.closedWindows || node.closedWindows.length === 0) return true;
  return !node.closedWindows.some(([start, end]) => opHour >= start && opHour < end);
}

export function scoreRoute(route, node, opHour) {
  const travelTime = route.baseTime * route.riskFactor;
  const expectedQueueTime = node.queue.length * CONFIG.AVG_PROCESS_TIME_SEC / (node.processingRate || 1);
  const pct = node.capacity === Infinity ? 0 : node.load / node.capacity;
  const congestionPenalty = pct * CONFIG.CONGESTION_PENALTY_WEIGHT;
  const closedPenalty = isNodeOperating(node, opHour) ? 0 : 500; // fuertemente desincentivado, no imposible
  return (travelTime + expectedQueueTime) * 1.0 + congestionPenalty + closedPenalty;
}

// Elige el mejor destino entre las rutas candidatas según el scoring.
// nodesById: función que resuelve un nodeId -> objeto nodo.
export function pickBestDestination(routes, nodesById, opHour) {
  let best = null;
  let bestScore = Infinity;
  for (const route of routes) {
    const node = nodesById(route.to);
    const s = scoreRoute(route, node, opHour);
    if (s < bestScore) {
      bestScore = s;
      best = { route, node, score: s };
    }
  }
  return best;
}

// Identifica los nodos "hotspot": los que más están penalizando
// económicamente a la red en la ventana reciente (saturación + costo acumulado).
export function findHotspots(nodes, topN = 2) {
  return [...nodes]
    .filter(n => n.type !== 'origin')
    .sort((a, b) => (b.costContribution + (b.saturated ? 1000 : 0)) - (a.costContribution + (a.saturated ? 1000 : 0)))
    .slice(0, topN)
    .filter(n => n.saturated || n.risk || n.costContribution > 0);
}
