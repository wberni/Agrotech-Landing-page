import { CONFIG } from '../config.js';

// ============================================================
// ECONOMIC LAYER — costo operativo de la red en tiempo real
// Toda decisión logística tiene un correlato económico: esperar,
// saturarse, desviarse o simplemente RECORRER kilómetros cuesta dinero.
// Este módulo lo cuantifica con parámetros anclados a benchmarks reales
// del transporte de cargas (ver comentarios en config.js: ATRI y
// FADEEAC), no con magnitudes arbitrarias.
// ============================================================

export class EconomicLayer {
  constructor() {
    this.totalCost = 0;          // USD acumulados desde el inicio de la corrida
    this.tonsDelivered = 0;      // toneladas efectivamente exportadas
    this.congestionCostRate = 0; // USD/min que se están perdiendo *ahora* por congestión
    this.lastCosts = [];         // ventana corta para graficar tendencia simple

    // desglose por rubro, para que el panel pueda explicar de dónde sale
    // el costo total (en vez de un número opaco)
    this.breakdown = { running: 0, waiting: 0, saturation: 0, diversion: 0 };
  }

  reset() {
    this.totalCost = 0;
    this.tonsDelivered = 0;
    this.congestionCostRate = 0;
    this.lastCosts = [];
    this.breakdown = { running: 0, waiting: 0, saturation: 0, diversion: 0 };
  }

  _add(rubro, cost) {
    this.totalCost += cost;
    this.breakdown[rubro] += cost;
  }

  // costo de RODAJE: combustible + mantenimiento + conducción mientras el
  // camión recorre kilómetros reales de la red (antes este costo no
  // existía en el modelo, por eso el costo/tonelada salía artificialmente
  // bajo en redes de decenas/cientos de camiones: un camión podía cruzar
  // el país "gratis" y solo costaba algo si esperaba en cola).
  // distanceKm: tramo recorrido en este tick. CONFIG.TRUCK_RUNNING_COST_PER_KM
  // está anclado al costo operativo total de ATRI (≈ USD 1.40/km, 2024).
  runningCost(distanceKm) {
    const cost = CONFIG.TRUCK_RUNNING_COST_PER_KM * distanceKm;
    this._add('running', cost);
    return cost;
  }

  // costo de un camión esperando en cola: salario del conductor + costo de
  // capital del equipo parado (no incluye combustible, que no se consume
  // detenido). Anclado al costo "no-fuel" de ATRI (~USD 0.9-1.4/min).
  waitingCost(truck, dtSeconds) {
    const cost = truck.costPerMinuteWaiting * (dtSeconds / 60);
    this._add('waiting', cost);
    return cost;
  }

  // penalización por nodo saturado: la red pierde plata mientras un nodo
  // está al 85%+ de capacidad. A diferencia del modelo anterior (monto fijo
  // por nodo saturado, sin importar cuántos camiones afectaba), esto ESCALA
  // con la cantidad de camiones realmente parados/afectados en ese nodo:
  // así un puerto saturado con 20 camiones en cola pesa 20x más que uno
  // saturado con 1 solo camión, igual que en la realidad.
  saturationPenalty(node, dtSeconds) {
    if (!node.saturated) return 0;
    const affected = Math.max(1, node.queue.length);
    const cost = CONFIG.SATURATION_PENALTY_PER_TRUCK_PER_MIN * affected * (dtSeconds / 60);
    this._add('saturation', cost);
    node.costContribution += cost;
    return cost;
  }

  // costo flat al reasignar un camión (combustible/tiempo administrativo de redirigir)
  diversionCost(truck, node) {
    this._add('diversion', CONFIG.DIVERSION_COST);
    if (node) node.costContribution += CONFIG.DIVERSION_COST;
    return CONFIG.DIVERSION_COST;
  }

  registerDelivery(tons) {
    this.tonsDelivered += tons;
  }

  costPerTon() {
    return this.tonsDelivered > 0 ? this.totalCost / this.tonsDelivered : 0;
  }

  costPerHour(simSecondsElapsed) {
    const hours = simSecondsElapsed / 3600;
    return hours > 0 ? this.totalCost / hours : 0;
  }

  // recalcula la tasa de pérdida por congestión "instantánea" (USD/min),
  // sumando la penalización de todos los camiones parados en nodos
  // saturados en este instante (no solo "cantidad de nodos saturados").
  recomputeCongestionRate(nodes) {
    const affectedTrucks = nodes
      .filter(n => n.saturated)
      .reduce((sum, n) => sum + Math.max(1, n.queue.length), 0);
    this.congestionCostRate = affectedTrucks * CONFIG.SATURATION_PENALTY_PER_TRUCK_PER_MIN;
    return this.congestionCostRate;
  }

  pushSample() {
    this.lastCosts.push(this.totalCost);
    if (this.lastCosts.length > 200) this.lastCosts.shift();
  }
}
