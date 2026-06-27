import { CONFIG } from '../config.js';

// ============================================================
// MODEL — definición de entidades del mundo logístico
// ============================================================

// Silueta REAL de Argentina, trazada a partir del mapa oficial provisto
// (contorno continental + Tierra del Fuego), en coordenadas normalizadas
// de "espacio de forma": x en [0, ARG_SHAPE.w], y en [0, ARG_SHAPE.h],
// conservando la proporción real ancho/alto del país (ARG_SHAPE.w/h).
// El renderer ajusta ("contain") esta forma dentro del canvas sin
// deformarla, así el país nunca se ve estirado ni aplastado.
export const ARG_SHAPE = { w: 0.4651, h: 1.0 };

export const KM_PER_SHAPE_UNIT = 3700;

export const ARG_OUTLINE_MAIN = [
  [0.1176,0.0],[0.0891,0.0258],[0.093,0.0388],[0.084,0.0698],[0.0581,0.0814],[0.0543,0.1421],[0.0646,0.1537],[0.0607,0.1628],[0.0465,0.1654],[0.0233,0.2274],[0.0284,0.2545],[0.0194,0.2636],[0.0129,0.2984],[0.0207,0.3023],[0.0233,0.3243],[0.031,0.3307],[0.0284,0.3463],[0.0362,0.3501],[0.0375,0.3747],[0.0245,0.4031],[0.0284,0.4289],[0.0116,0.4574],[0.022,0.5103],[0.0129,0.5168],[0.0026,0.5749],[0.0142,0.6124],[0.0052,0.6176],[0.0052,0.646],[0.0155,0.6486],[0.0194,0.6835],[0.0323,0.6886],[0.0155,0.6964],[0.0297,0.708],[0.022,0.7196],[0.0245,0.7661],[0.0155,0.7739],[0.0129,0.8191],[0.0,0.8333],[0.0,0.8553],[0.0103,0.8773],[0.022,0.876],[0.031,0.9121],[0.0685,0.9109],[0.1034,0.9238],[0.0866,0.8682],[0.1008,0.8514],[0.1137,0.8514],[0.115,0.8191],[0.1473,0.7894],[0.1525,0.77],[0.1473,0.7545],[0.1331,0.7571],[0.1137,0.7403],[0.1111,0.7248],[0.1253,0.7016],[0.1408,0.6938],[0.1525,0.6977],[0.1563,0.6525],[0.168,0.6382],[0.1886,0.6331],[0.1938,0.6227],[0.1899,0.6072],[0.1796,0.6085],[0.1835,0.615],[0.177,0.6176],[0.1615,0.6072],[0.1563,0.5736],[0.1641,0.5659],[0.1654,0.5724],[0.1912,0.5801],[0.2209,0.5736],[0.2183,0.5517],[0.2274,0.5336],[0.2222,0.509],[0.2532,0.5155],[0.3346,0.4948],[0.3346,0.4832],[0.3579,0.4548],[0.3566,0.4393],[0.3424,0.4315],[0.3527,0.4121],[0.3437,0.3992],[0.3191,0.3876],[0.3359,0.2649],[0.3527,0.2442],[0.3695,0.2377],[0.3708,0.2287],[0.4096,0.1899],[0.4574,0.1641],[0.4638,0.1395],[0.4561,0.1111],[0.438,0.1137],[0.4328,0.146],[0.4121,0.1563],[0.4083,0.168],[0.3941,0.1641],[0.3876,0.1731],[0.3346,0.1654],[0.3295,0.1602],[0.3398,0.1537],[0.3398,0.1395],[0.3579,0.1124],[0.354,0.0982],[0.3282,0.0917],[0.2997,0.0711],[0.2661,0.0633],[0.2119,0.0078],[0.177,0.0065],[0.1641,0.022],[0.1576,0.0078],[0.1279,0.009]
];

export const ARG_OUTLINE_TDF = [
  [0.1021,0.9315],[0.1059,0.9935],[0.1176,0.9974],[0.1525,0.9948],[0.1615,0.9987],[0.1576,0.9961],[0.1654,0.9897],[0.1641,0.9858],[0.146,0.9858],[0.137,0.9755],[0.1279,0.9729],[0.1137,0.9574],[0.1085,0.9341]
];

// Mantenido por compatibilidad (alias del contorno continental).
export const ARG_OUTLINE = ARG_OUTLINE_MAIN;

// Definiciones base de nodos. Coordenadas en "espacio de forma" SIN
// ensanchar (mismo sistema que ARG_OUTLINE_MAIN/ARG_SHAPE_RAW), calculadas
// a partir de la ubicación geográfica real de cada localidad/provincia y
// verificadas para caer dentro del contorno continental real del país.
//
// A diferencia de la versión anterior (puertos casi todos amontonados en
// el cordón Rosario–San Lorenzo–Buenos Aires), los nodos ahora cubren las
// 6 macro-regiones del país (NOA, NEA, Centro, Cuyo, Pampeana, Patagonia),
// igual que en el mapa de referencia. Se agregan más campos de origen
// ("más campos") y dos campos nuevos de datos por nodo: `province` y
// `region`, usados en el tooltip y en la tabla de nodos.
//
// closedWindows: rangos de "hora operativa" (0-24) en los que el nodo
// NO acepta camiones nuevos (cierre programado).
export const NODE_DEFS = [
  // ---------- CAMPOS DE ORIGEN (uno por provincia productiva, repartidos
  // por las 6 regiones — antes estaban casi todos amontonados en la
  // Pampa húmeda) ----------
  { id:'origin-1', name:'Campo Chaco',            type:'origin', region:'NEA',       province:'Chaco',            x:0.3050,y:0.1550, capacity:Infinity },
  { id:'origin-4', name:'Campo Salta',            type:'origin', region:'NOA',       province:'Salta',            x:0.1949,y:0.0757, capacity:Infinity },
  { id:'origin-10',name:'Campo Jujuy',            type:'origin', region:'NOA',       province:'Jujuy',            x:0.1650,y:0.0250, capacity:Infinity },
  { id:'origin-11',name:'Campo Tucumán',          type:'origin', region:'NOA',       province:'Tucumán',          x:0.2050,y:0.1350, capacity:Infinity },
  { id:'origin-12',name:'Campo Catamarca',        type:'origin', region:'NOA',       province:'Catamarca',        x:0.1450,y:0.1450, capacity:Infinity },
  { id:'origin-2', name:'Campo Córdoba',          type:'origin', region:'Centro',    province:'Córdoba',          x:0.1610,y:0.2912, capacity:Infinity },
  { id:'origin-3', name:'Campo Buenos Aires',     type:'origin', region:'Pampeana',  province:'Buenos Aires',     x:0.2239,y:0.4698, capacity:Infinity },
  { id:'origin-5', name:'Campo Río Negro',        type:'origin', region:'Patagonia', province:'Río Negro',        x:0.0853,y:0.5963, capacity:Infinity },
  { id:'origin-6', name:'Campo Entre Ríos',       type:'origin', region:'Centro',    province:'Entre Ríos',       x:0.2900,y:0.2900, capacity:Infinity },
  { id:'origin-7', name:'Campo Misiones',         type:'origin', region:'NEA',       province:'Misiones',         x:0.4000,y:0.1750, capacity:Infinity },
  { id:'origin-8', name:'Campo La Pampa',         type:'origin', region:'Pampeana',  province:'La Pampa',         x:0.1332,y:0.4450, capacity:Infinity },
  { id:'origin-9', name:'Campo San Luis',         type:'origin', region:'Cuyo',      province:'San Luis',         x:0.0940,y:0.3390, capacity:Infinity },
  { id:'origin-13',name:'Campo Corrientes',       type:'origin', region:'NEA',       province:'Corrientes',       x:0.3650,y:0.2250, capacity:Infinity },
  { id:'origin-14',name:'Campo La Rioja',         type:'origin', region:'Centro',    province:'La Rioja',         x:0.1150,y:0.2050, capacity:Infinity },
  { id:'origin-15',name:'Campo San Juan',         type:'origin', region:'Cuyo',      province:'San Juan',         x:0.0650,y:0.2650, capacity:Infinity },
  { id:'origin-16',name:'Campo Mendoza',          type:'origin', region:'Cuyo',      province:'Mendoza',          x:0.0580,y:0.3750, capacity:Infinity },
  { id:'origin-17',name:'Campo Neuquén',          type:'origin', region:'Patagonia', province:'Neuquén',          x:0.0600,y:0.5150, capacity:Infinity },
  { id:'origin-18',name:'Campo Chubut',           type:'origin', region:'Patagonia', province:'Chubut',           x:0.1000,y:0.6850, capacity:Infinity },

  // ---------- ACOPIOS (centros de almacenamiento/procesamiento; antes
  // confinados a la Pampa húmeda, ahora también en NEA, Cuyo y Patagonia) ----------
  { id:'acopio-1', name:'Acopio Pergamino',        type:'acopio', region:'Pampeana', province:'Buenos Aires',     x:0.2283,y:0.3660, capacity:140,
    processingRate: 1.1, closedWindows: [[0,4]] },        // cierre nocturno de recepción
  { id:'acopio-2', name:'Acopio Venado Tuerto',    type:'acopio', region:'Pampeana', province:'Santa Fe',         x:0.1897,y:0.3617, capacity:120,
    processingRate: 1.0, closedWindows: [[0,3]] },
  { id:'acopio-3', name:'Acopio Junín',            type:'acopio', region:'Pampeana', province:'Buenos Aires',     x:0.2084,y:0.3869, capacity:110,
    processingRate: 0.95, closedWindows: [[1,5]] },
  { id:'acopio-4', name:'Acopio Reconquista',      type:'acopio', region:'Centro',   province:'Santa Fe',         x:0.2576,y:0.2225, capacity:100,
    processingRate: 0.95, closedWindows: [[2,6]] },
  { id:'acopio-5', name:'Acopio Río Cuarto',       type:'acopio', region:'Centro',   province:'Córdoba',          x:0.1604,y:0.3430, capacity:115,
    processingRate: 1.0, closedWindows: [[0,4]] },
  { id:'acopio-6', name:'Acopio Santiago del Estero', type:'acopio', region:'NOA',   province:'Santiago del Estero', x:0.2364,y:0.1810, capacity:95,
    processingRate: 0.9, closedWindows: [[1,5]] },
  { id:'acopio-7', name:'Acopio Resistencia',      type:'acopio', region:'NEA',      province:'Chaco',            x:0.3150,y:0.1650, capacity:100,
    processingRate: 0.9, closedWindows: [[2,6]] },
  { id:'acopio-8', name:'Acopio Paraná',           type:'acopio', region:'Centro',   province:'Entre Ríos',       x:0.2950,y:0.2750, capacity:105,
    processingRate: 0.95, closedWindows: [[1,4]] },
  { id:'acopio-9', name:'Acopio Villa Mercedes',   type:'acopio', region:'Cuyo',     province:'San Luis',         x:0.1050,y:0.3550, capacity:90,
    processingRate: 0.9, closedWindows: [[0,5]] },
  { id:'acopio-10',name:'Acopio General Roca',     type:'acopio', region:'Patagonia',province:'Río Negro',        x:0.1250,y:0.5850, capacity:85,
    processingRate: 0.85, closedWindows: [[3,7]] },

  // ---------- PUERTOS (antes 6 de 8 estaban amontonados en el cordón
  // Rosario–San Lorenzo–Buenos Aires; ahora distribuidos en todo el
  // litoral fluvial y la costa atlántica, de norte a sur) ----------
  { id:'puerto-6', name:'Puerto Posadas',          type:'puerto', region:'NEA',       province:'Misiones',         x:0.3950,y:0.1900, capacity:90,
    processingRate: 0.85, closedWindows: [[3,7]] },
  { id:'puerto-9', name:'Puerto Barranqueras',     type:'puerto', region:'NEA',       province:'Chaco',            x:0.3300,y:0.1550, capacity:95,
    processingRate: 0.85, closedWindows: [[2,5]] },
  { id:'puerto-1', name:'Puerto Rosario',          type:'puerto', region:'Centro',    province:'Santa Fe',         x:0.2366,y:0.3375, capacity:220,
    processingRate: 1.3, closedWindows: [[12,12.5]] },     // pausa de aduana al mediodía
  { id:'puerto-10',name:'Puerto Ibicuy',           type:'puerto', region:'Centro',    province:'Entre Ríos',       x:0.3050,y:0.3550, capacity:120,
    processingRate: 1.0, closedWindows: [[5,8]] },
  { id:'puerto-2', name:'Puerto San Lorenzo',      type:'puerto', region:'Centro',    province:'Santa Fe',         x:0.2365,y:0.3299, capacity:180,
    processingRate: 1.15, closedWindows: [[18,18.5]] },
  { id:'puerto-3', name:'Puerto Buenos Aires',     type:'puerto', region:'Pampeana',  province:'Buenos Aires',     x:0.2642,y:0.3878, capacity:170,
    processingRate: 1.1, closedWindows: [[6,6.5]] },
  { id:'puerto-7', name:'Puerto Mar del Plata',    type:'puerto', region:'Pampeana',  province:'Buenos Aires',     x:0.2766,y:0.4904, capacity:130,
    processingRate: 1.0, closedWindows: [[14,14.5]] },
  { id:'puerto-4', name:'Puerto Necochea/Quequén', type:'puerto', region:'Pampeana',  province:'Buenos Aires',     x:0.2403,y:0.5070, capacity:150,
    processingRate: 1.0, closedWindows: [] },
  { id:'puerto-5', name:'Puerto Bahía Blanca',     type:'puerto', region:'Pampeana',  province:'Buenos Aires',     x:0.1987,y:0.5122, capacity:160,
    processingRate: 1.05, closedWindows: [[9,9.5]] },
  { id:'puerto-11',name:'Puerto San Antonio Oeste',type:'puerto', region:'Patagonia', province:'Río Negro',        x:0.1550,y:0.6100, capacity:90,
    processingRate: 0.85, closedWindows: [[4,8]] },
  { id:'puerto-8', name:'Puerto Comodoro Rivadavia', type:'puerto', region:'Patagonia', province:'Chubut',         x:0.0945,y:0.7283, capacity:80,
    processingRate: 0.8, closedWindows: [[5,9]] },
  { id:'puerto-12',name:'Puerto Ushuaia',          type:'puerto', region:'Patagonia', province:'Tierra del Fuego', x:0.1350,y:0.9700, capacity:70,
    processingRate: 0.75, closedWindows: [[6,10]] },
];

// Rutas válidas: origen -> acopio/puerto -> puerto. riskFactor se usa para
// modelar variabilidad/climatología propia de cada tramo (ej. tramos
// con caminos rurales en peor estado tienen mayor riskFactor base).
// baseTime ya NO es un número inventado: se calcula a partir de la
// distancia real entre nodos (ver buildWorld), así que el "costo de
// rodaje" económico y el tiempo de viaje están atados a la misma
// geografía.
export const ROUTE_DEFS = [
  // NOA / NEA -> acopios propios o cruzando a Centro
  ['origin-1','acopio-7', 1.0], ['origin-1','acopio-1', 1.15],
  ['origin-4','acopio-6', 1.1], ['origin-4','acopio-1', 1.3],
  ['origin-10','acopio-6', 1.2],
  ['origin-11','acopio-6', 1.05], ['origin-11','acopio-5', 1.15],
  ['origin-12','acopio-6', 1.15], ['origin-12','acopio-9', 1.3],
  ['origin-13','acopio-8', 1.15], ['origin-13','puerto-9', 1.2],
  ['origin-7','puerto-6', 1.05],

  // Centro
  ['origin-2','acopio-1', 1.0], ['origin-2','acopio-5', 1.0],
  ['origin-6','acopio-8', 1.0], ['origin-6','acopio-1', 1.1],
  ['origin-14','acopio-5', 1.2], ['origin-14','acopio-9', 1.25],

  // Cuyo
  ['origin-9','acopio-9', 1.0], ['origin-9','acopio-5', 1.15],
  ['origin-15','acopio-9', 1.2],
  ['origin-16','acopio-9', 1.25], ['origin-16','acopio-5', 1.35],

  // Pampeana
  ['origin-3','acopio-2', 1.05], ['origin-3','acopio-3', 1.0], ['origin-3','puerto-7', 1.1],
  ['origin-8','acopio-2', 1.15], ['origin-8','puerto-5', 1.2],

  // Patagonia
  ['origin-5','acopio-10', 1.05], ['origin-5','puerto-11', 1.2],
  ['origin-17','acopio-9', 1.3], ['origin-17','puerto-11', 1.35],
  ['origin-18','acopio-10', 1.2], ['origin-18','puerto-8', 1.15],

  // acopios -> puertos (NEA)
  ['acopio-7','puerto-9', 1.0], ['acopio-7','puerto-6', 1.15],

  // acopios -> puertos (Centro / litoral)
  ['acopio-1','puerto-1', 1.0], ['acopio-1','puerto-2', 1.1], ['acopio-1','puerto-3', 1.15],
  ['acopio-2','puerto-1', 1.05],['acopio-2','puerto-5', 1.2], ['acopio-2','puerto-4', 1.1],
  ['acopio-3','puerto-3', 1.0], ['acopio-3','puerto-4', 1.1], ['acopio-3','puerto-7', 1.1],
  ['acopio-4','puerto-1', 1.1], ['acopio-4','puerto-9', 1.2],
  ['acopio-5','puerto-1', 1.15], ['acopio-5','puerto-5', 1.2],
  ['acopio-6','puerto-1', 1.3], ['acopio-6','puerto-6', 1.25],
  ['acopio-8','puerto-10', 1.0], ['acopio-8','puerto-1', 1.15],

  // acopios -> puertos (Cuyo / Patagonia)
  ['acopio-9','puerto-5', 1.25], ['acopio-9','puerto-1', 1.4],
  ['acopio-10','puerto-11', 1.05], ['acopio-10','puerto-8', 1.2], ['acopio-10','puerto-12', 1.5],
];

// distancia real (en km) entre dos nodos, a partir de sus coordenadas en
// "espacio de forma" SIN ensanchar (las geográficas reales) y la escala
// KM_PER_SHAPE_UNIT. Es la base del costo de rodaje en EconomicLayer.
export function nodeDistanceKm(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy) * KM_PER_SHAPE_UNIT;
}

export function buildWorld() {
  const nodes = NODE_DEFS.map(n => ({
    ...n,
    load: n.type === 'origin' ? 0 : randi(10, Math.floor((n.capacity || 100) * 0.3)),
    queue: [],
    saturated: false,
    risk: false,
    closedNow: false,
    processingRate: n.processingRate ?? 1,
    closedWindows: n.closedWindows ?? [],
    _warnedQueue: false,
    _loggedSat: false,
    // acumuladores para hotspot scoring (cuánto "cuesta" este nodo en la ventana reciente)
    costContribution: 0,
  }));

  const byId = id => nodes.find(n => n.id === id);

  const routes = ROUTE_DEFS.map(([from, to, riskFactor]) => {
    const distanceKm = nodeDistanceKm(byId(from), byId(to));
    // tiempo simulado del tramo: proporcional a la distancia real (a más
    // km, más segundos de viaje simulado), en vez de un número fijo
    // desconectado de la geografía. ~45 km simulados por segundo de demo.
    const baseTime = Math.max(8, distanceKm / 45);
    return { from, to, distanceKm, baseTime, riskFactor: riskFactor ?? 1 };
  });

  return { nodes, routes };
}

export function createTruck(id, originId, destination) {
  return {
    id,
    originId,
    currentFromId: originId,
    currentToId: destination.route.to,
    progress: 0,
    state: 'en_ruta',           // en_ruta | esperando | descargando | completado
    tonnage: randi(28, 32),
    capacity: 32,
    costPerMinuteWaiting: rand(CONFIG.TRUCK_COST_PER_MIN_WAITING_MIN, CONFIG.TRUCK_COST_PER_MIN_WAITING_MAX),
    waitSeconds: 0,
    reassignedTimes: 0,
    unloadTimer: 0,
  };
}

// --- utilidades compartidas ---
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const choice = (arr) => arr[randi(0, arr.length - 1)];
