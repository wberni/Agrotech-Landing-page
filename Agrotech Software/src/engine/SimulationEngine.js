import { CONFIG } from '../config.js';
import { buildWorld, createTruck, clamp, choice, randi } from '../model/world.js';
import { pickBestDestination, isNodeOperating } from './DecisionEngine.js';
import { EconomicLayer } from './EconomicLayer.js';

// ============================================================
// SIMULATION ENGINE — orquesta el mundo en tiempo discreto.
// No sabe nada de DOM/Canvas: expone estado + un callback de log,
// para que la UI sea reemplazable sin tocar la lógica de simulación.
// ============================================================

export class SimulationEngine {
  constructor(onEvent = () => {}) {
    this.onEvent = onEvent;
    this.econ = new EconomicLayer();
    this.reset();
  }

  reset() {
    const { nodes, routes } = buildWorld();
    this.nodes = nodes;
    this.routes = routes;
    this.trucks = [];
    this.nextTruckId = 1;
    this.running = false;
    this.speed = 1;
    this.simSeconds = 0;
    this.weatherFactor = 1;
    this.reassignCount = 0;
    this.spawnAccumulator = 0;
    this.econ.reset();
  }

  nodeById(id) { return this.nodes.find(n => n.id === id); }
  routesFrom(nodeId) { return this.routes.filter(r => r.from === nodeId); }

  get opHour() {
    const cyclePos = (this.simSeconds % CONFIG.DAY_LENGTH_SIM_SECONDS) / CONFIG.DAY_LENGTH_SIM_SECONDS;
    return cyclePos * 24;
  }

  // -------------------- ciclo principal --------------------
  tick(realDtMs) {
    if (!this.running) return;
    const dtSim = (realDtMs / 1000) * this.speed;
    this.simSeconds += dtSim;

    this._spawnTrucks(dtSim);
    this.trucks.forEach(t => this._advanceTruck(t, dtSim));
    this.trucks = this.trucks.filter(t => t.state !== 'completado');

    this._decayNodeLoads(dtSim);
    this._updateNodeStatusAndWindows();
    this._applyCongestionEconomics(dtSim);
    this.econ.recomputeCongestionRate(this.nodes);
    this.econ.pushSample();
  }

  // -------------------- spawn de camiones --------------------
  _spawnTrucks(dtSim) {
    this.spawnAccumulator += dtSim;
    while (this.spawnAccumulator >= CONFIG.SPAWN_INTERVAL_SIM_SECONDS) {
      this.spawnAccumulator -= CONFIG.SPAWN_INTERVAL_SIM_SECONDS;
      if (Math.random() < CONFIG.SPAWN_PROBABILITY) this._spawnOneTruck();
    }
  }

  _spawnOneTruck() {
    const origins = this.nodes.filter(n => n.type === 'origin');
    const origin = choice(origins);
    const opts = this.routesFrom(origin.id);
    if (opts.length === 0) return;
    const best = pickBestDestination(opts, id => this.nodeById(id), this.opHour);
    if (!best) return;
    const truck = createTruck('TRK-' + String(this.nextTruckId++).padStart(4, '0'), origin.id, best);
    this.trucks.push(truck);
  }

  // -------------------- movimiento de camiones --------------------
  _advanceTruck(truck, dt) {
    if (truck.state === 'en_ruta') {
      const route = this._currentRoute(truck);
      if (!route) return;
      const dur = route.baseTime * route.riskFactor * this.weatherFactor;
      const fraction = Math.min(dt / dur, 1 - truck.progress);
      truck.progress += fraction;
      // costo de rodaje: combustible+mantenimiento+conducción por los km
      // reales recorridos en este tick (ver EconomicLayer.runningCost).
      this.econ.runningCost(route.distanceKm * fraction);
      if (truck.progress >= 1) {
        truck.progress = 1;
        this._arriveAtNode(truck);
      }
    } else if (truck.state === 'esperando') {
      truck.waitSeconds += dt;
      this.econ.waitingCost(truck, dt);
      const node = this.nodeById(truck.currentToId);
      const canProcess = isNodeOperating(node, this.opHour) || node.queue[0] !== truck.id;
      if (node.queue[0] === truck.id && node.load < node.capacity && isNodeOperating(node, this.opHour)) {
        node.queue.shift();
        truck.state = 'descargando';
        truck.unloadTimer = (9 / (node.processingRate || 1)) + Math.random() * 3;
      }
    } else if (truck.state === 'descargando') {
      truck.unloadTimer -= dt;
      if (truck.unloadTimer <= 0) {
        const node = this.nodeById(truck.currentToId);
        node.load += truck.tonnage;
        this.econ.registerDelivery(truck.tonnage);
        this._finishLegOrRemove(truck, node);
      }
    }
  }

  _currentRoute(truck) {
    return this.routes.find(r => r.from === truck.currentFromId && r.to === truck.currentToId);
  }

  _arriveAtNode(truck) {
    const node = this.nodeById(truck.currentToId);
    this._evaluateNodeStatus(node);
    const blocked = node.saturated || !isNodeOperating(node, this.opHour);
    if (blocked) {
      // 1) Intentar PASO A TRAVÉS: el camión usa el nodo saturado como
      //    punto de tránsito y continúa hacia un nodo downstream desde él.
      //    Esto solo aplica si el nodo tiene rutas salientes (no es destino final)
      //    y existe al menos una ruta downstream disponible (no bloqueada).
      const downstreamRoutes = this.routesFrom(node.id);
      const availableDownstream = downstreamRoutes.filter(r => {
        const dest = this.nodeById(r.to);
        return dest && !dest.saturated && isNodeOperating(dest, this.opHour);
      });

      if (availableDownstream.length > 0) {
        const best = pickBestDestination(availableDownstream, id => this.nodeById(id), this.opHour);
        const reason = node.saturated ? 'saturado' : 'fuera de ventana';
        this.onEvent(
          `${truck.id} pasa por ${node.name} (${reason}) → ${best.node.name}`,
          'warn', this.simSeconds
        );
        // El camión "atraviesa" el nodo: parte desde él hacia el siguiente destino
        truck.currentFromId = node.id;
        truck.currentToId = best.route.to;
        truck.progress = 0;
        truck.reassignedTimes++;
        this.reassignCount++;
        this.econ.diversionCost(truck, node);
        truck.state = 'en_ruta';
        return;
      }

      // 2) Si no hay downstream disponible, intentar reasignación lateral
      //    (ruta alternativa desde el nodo origen del último tramo).
      const siblingRoutes = this.routesFrom(truck.currentFromId).filter(r => r.to !== node.id);
      if (siblingRoutes.length > 0) {
        const best = pickBestDestination(siblingRoutes, id => this.nodeById(id), this.opHour);
        const reason = node.saturated ? 'saturado' : 'fuera de ventana operativa';
        this.onEvent(`${truck.id} reasignado: ${node.name} ${reason} → ${best.node.name}`, 'warn', this.simSeconds);
        truck.currentToId = best.route.to;
        truck.progress = 0.05;
        truck.reassignedTimes++;
        this.reassignCount++;
        this.econ.diversionCost(truck, node);
        truck.state = 'en_ruta';
        return;
      }
    }
    node.queue.push(truck.id);
    truck.state = 'esperando';
    truck.waitSeconds = 0;
    if (node.queue.length > 6 && !node._warnedQueue) {
      this.onEvent(`Cola creciente en ${node.name} (${node.queue.length} camiones)`, 'warn', this.simSeconds);
      node._warnedQueue = true;
    }
  }

  _finishLegOrRemove(truck, node) {
    this._evaluateNodeStatus(node);
    node._warnedQueue = false;
    if (node.type === 'puerto') {
      truck.state = 'completado';
    } else {
      const opts = this.routesFrom(node.id);
      if (opts.length === 0) { truck.state = 'completado'; return; }
      const best = pickBestDestination(opts, id => this.nodeById(id), this.opHour);
      truck.currentFromId = node.id;
      truck.currentToId = best.route.to;
      truck.progress = 0;
      truck.state = 'en_ruta';
    }
  }

  // -------------------- nodos --------------------
  _evaluateNodeStatus(node) {
    if (node.type === 'origin') { node.saturated = false; node.risk = false; return; }
    const pct = node.load / node.capacity;
    node.saturated = pct >= CONFIG.SATURATION_THRESHOLD;
    node.risk = pct >= CONFIG.RISK_THRESHOLD && pct < CONFIG.SATURATION_THRESHOLD;
  }

  _decayNodeLoads(dt) {
    this.nodes.forEach(n => {
      if (n.type === 'origin') return;
      const baseRate = n.type === 'puerto' ? CONFIG.PORT_OUTFLOW_RATE : CONFIG.ACOPIO_OUTFLOW_RATE;
      const outflow = baseRate * (n.processingRate || 1) * dt;
      n.load = Math.max(0, n.load - outflow);
    });
  }

  _updateNodeStatusAndWindows() {
    this.nodes.forEach(n => {
      this._evaluateNodeStatus(n);
      n.closedNow = !isNodeOperating(n, this.opHour);
      if (n.type === 'puerto') {
        if (n.saturated && !n._loggedSat) {
          this.onEvent(`🚨 ${n.name} saturado (${Math.round(n.load / n.capacity * 100)}% capacidad)`, 'crit', this.simSeconds);
          n._loggedSat = true;
        } else if (!n.saturated) {
          n._loggedSat = false;
        }
      }
    });
  }

  _applyCongestionEconomics(dt) {
    this.nodes.forEach(n => this.econ.saturationPenalty(n, dt));
    // decaimiento lento del "costContribution" para que los hotspots reflejen ventana reciente
    this.nodes.forEach(n => { n.costContribution *= 0.995; });
  }

  // -------------------- eventos de escenario --------------------
  simulateRain() {
    this.weatherFactor = clamp(this.weatherFactor * CONFIG.RAIN_SLOWDOWN_FACTOR, 1, 4);
    this.onEvent('🌧 Lluvia afecta la zona: velocidad reducida y mayor riesgo en toda la red', 'crit', this.simSeconds);
    setTimeout(() => {
      this.weatherFactor = Math.max(1, this.weatherFactor / CONFIG.RAIN_SLOWDOWN_FACTOR);
      this.onEvent('Lluvia disipada: condiciones normalizadas', 'info', this.simSeconds);
    }, CONFIG.RAIN_DURATION_MS);
  }

  simulateMassiveHarvest() {
    this.onEvent('🌾 Cosecha masiva: ingreso acelerado de camiones a la red', 'crit', this.simSeconds);
    let n = 0;
    const burst = setInterval(() => {
      this._spawnOneTruck();
      n++;
      if (n >= CONFIG.HARVEST_BURST_TRUCKS) clearInterval(burst);
    }, CONFIG.HARVEST_BURST_INTERVAL_MS);
  }

  // fuerza la saturación de un puerto al azar, útil para demostrar reasignación en vivo
  forcePortSaturation() {
    const ports = this.nodes.filter(n => n.type === 'puerto');
    const port = choice(ports);
    port.load = port.capacity * 0.95;
    this.onEvent(`⚠ Saturación forzada (demo) en ${port.name}`, 'crit', this.simSeconds);
  }
}
