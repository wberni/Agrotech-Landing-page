# AGROTECH — Control Tower de Logística Agroexportadora

MVP de simulador en tiempo real de la cadena de maíz en Argentina (campo → acopio → puerto),
con motor económico y decisiones por scoring. 100% frontend, sin backend ni cloud.

## Cómo correrlo localmente

Los módulos están escritos como ES Modules (`import`/`export`), por lo que el navegador
los bloquea si abrís el `index.html` con doble clic (política CORS de `file://`).
Necesitás un servidor estático mínimo — no requiere instalar nada nuevo si tenés Python:

```bash
cd agrotech-control-tower
python3 -m http.server 8000
```

Luego abrí: `http://localhost:8000/index.html`

(Alternativa con Node si lo preferís: `npx serve .`)

## Estructura de carpetas

```
agrotech-control-tower/
├── index.html              # shell de la UI (control tower)
├── README.md
└── src/
    ├── styles.css           # tema visual industrial
    ├── config.js            # TODOS los parámetros calibrables en un solo lugar
    ├── main.js              # punto de entrada: conecta engine ↔ UI
    ├── model/
    │   └── world.js         # entidades (Truck/Node/Route), defs de mapa, factories
    ├── engine/
    │   ├── SimulationEngine.js   # tick loop, movimiento, nodos, eventos de escenario
    │   ├── DecisionEngine.js     # scoring de rutas + ventanas operativas + hotspots
    │   └── EconomicLayer.js      # costo por espera/saturación/desvío, KPIs económicos
    └── ui/
        ├── render.js         # dibuja el mapa (canvas)
        ├── dom.js            # actualiza KPIs y tabla de nodos
        └── events.js         # bitácora de eventos en pantalla
```

**Separación de responsabilidades**: `engine/` y `model/` no tocan el DOM ni el canvas —
son lógica pura, testeable independientemente de la UI. `ui/` solo lee el estado del
engine y lo pinta. `main.js` es el único lugar que conecta ambos mundos (y maneja los
listeners de los botones).

## Qué cambió respecto a la versión anterior (single-file)

### 1. Modularización
El archivo único se separó en 9 módulos con responsabilidad única. Cambiar un parámetro
económico, agregar un nodo, o reemplazar el renderer por otro framework no requiere
tocar el resto del sistema.

### 2. Capa económica (`EconomicLayer.js`) — la pieza nueva clave
Cada camión tiene `costPerMinuteWaiting` (varía por camión, simulando distintos
fletes/contratos). El sistema acumula:
- **Costo por espera**: minutos en cola × costo/minuto del camión.
- **Penalización por saturación**: USD/min que "pierde" la red mientras un nodo
  está ≥85% de capacidad (ineficiencia, sobrecostos en cascada).
- **Costo de desvío**: costo flat al reasignar un camión a otro nodo.

KPIs expuestos en la UI: **costo total acumulado**, **costo por hora**,
**costo por tonelada exportada**, y **pérdida instantánea por congestión** ($/min).

### 3. Motor de decisiones mejorado (`DecisionEngine.js`)
Antes: elegía el destino con menor `load`+`queue.length` (heurístico de distancia/cola).
Ahora usa una función de scoring explícita:

```
score = (travelTime + expectedQueueTime) * costFactor + congestionPenalty + closedPenalty
```

- `travelTime` incorpora el `riskFactor` propio de cada tramo (variabilidad/clima).
- `expectedQueueTime` estima cuánto se va a esperar según la cola actual y el
  `processingRate` del nodo.
- `congestionPenalty` pesa qué tan lleno está el nodo (no solo saturado/no saturado:
  ahora es un gradiente continuo).
- `closedPenalty` desincentiva fuertemente (sin prohibir del todo) mandar camiones a un
  nodo fuera de su ventana operativa.

### 4. Ventanas operativas (`operatingWindows` / `closedWindows`)
Cada nodo tiene un ciclo "día operativo" (configurable en `CONFIG.DAY_LENGTH_SIM_SECONDS`,
240s simulados = 1 día demo) y franjas horarias cerradas: cierre nocturno de acopios,
pausas de aduana en puertos. El motor de decisiones evita mandar camiones a un nodo
cerrado, y si un camión llega justo cuando cierra, se reasigna (visible como evento en
la bitácora).

### 5. Hotspots logísticos
`findHotspots()` identifica los 1-2 nodos que más están penalizando económicamente a la
red en la ventana reciente (combinando saturación + costo acumulado). Se resaltan en el
mapa con un anillo ámbar pulsante y la etiqueta `HOTSPOT`, y aparecen destacados en la
tabla lateral de nodos.

### 6. Eventos de escenario expandidos
- 🌧 **Lluvia**: ahora también incrementa el `riskFactor` efectivo del tramo (vía
  `weatherFactor`), no solo la velocidad.
- 🌾 **Cosecha masiva**: ráfaga de camiones (sin cambios de fondo, ya funcionaba bien).
- ⚠ **Forzar saturación de puerto** (nuevo botón): lleva un puerto al 95% de
  capacidad al instante, útil para demostrar la reasignación automática en vivo sin
  esperar a que ocurra naturalmente.
- **Cierres programados** (ventanas operativas): ya no es un evento manual, es parte
  del ciclo — se puede ver en la bitácora cuando un nodo cierra y reasigna camiones.

### 7. Diferenciación visual de estados
Los nodos ahora tienen 4 estados visuales (antes 3): normal (verde), riesgo (ámbar),
saturado (rojo), **fuera de ventana operativa (violeta)** — nuevo.

## Calibración rápida

Todos los números de negocio viven en `src/config.js`. Para una demo más o menos
"caótica", lo más impactante es tocar:
- `SATURATION_PENALTY_PER_MIN` / `DIVERSION_COST` → cuánto "duele" económicamente la
  congestión.
- `SPAWN_PROBABILITY` / `SPAWN_INTERVAL_SIM_SECONDS` → presión de tráfico entrante.
- `DAY_LENGTH_SIM_SECONDS` → qué tan rápido se ven los cierres por ventana operativa.

## Qué NO se hizo (a propósito, evitando sobre-ingeniería)

- Sin backend/WebSockets: todo corre en el cliente, suficiente para una demo de stand.
- Sin ML real en el Decision Engine: el scoring es una fórmula explícita y auditable,
  más creíble para una demo técnica que una caja negra.
- Sin persistencia: cada reset arranca de cero: es un simulador, no un sistema de
  registro histórico.
