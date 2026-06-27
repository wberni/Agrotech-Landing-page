// ============================================================
// CONFIG — parámetros centrales de la simulación
// Tocar estos valores alcanza para recalibrar todo el sistema
// sin tener que modificar lógica en otros módulos.
// ============================================================

export const CONFIG = {
  // --- Generación de tráfico ---
  SPAWN_INTERVAL_SIM_SECONDS: 2.5,   // cada cuántos seg. simulados se evalúa un spawn
  SPAWN_PROBABILITY: 0.85,           // probabilidad de que ese spawn ocurra
  HARVEST_BURST_TRUCKS: 12,          // camiones extra al simular cosecha masiva
  HARVEST_BURST_INTERVAL_MS: 320,

  // --- Capa económica ---
  // Calibrado contra benchmarks reales de la industria del transporte de
  // cargas, en vez de valores arbitrarios:
  //  · ATRI "An Analysis of the Operational Costs of Trucking" (2025 Update,
  //    datos 2024): costo operativo total de un camión ≈ USD 2.26/milla
  //    (≈ USD 1.40/km) y ≈ USD 90.89/hora; el costo "no-fuel" (el que sigue
  //    corriendo aunque el camión esté detenido: salario del conductor,
  //    cuota/leasing del equipo, seguros) ≈ USD 1.78/milla y representa
  //    ~el 79% del total → ≈ USD 71-72/hora ≈ USD 1.2/min de costo de
  //    "camión parado".
  //  · FADEEAC (Federación Argentina de Entidades Empresarias del
  //    Autotransporte de Cargas) publica el Índice de Costos del Transporte
  //    y tarifas de referencia para cereales/oleaginosas; confirma que
  //    combustible + conducción son los rubros dominantes y que el costo
  //    se expresa de forma realista en USD/tonelada según distancia, no
  //    como un monto fijo por minuto desacoplado del recorrido.
  //  · Literatura de logística agropecuaria reporta un costo de flete
  //    carretero de cereal en Argentina del orden de USD 0.05-0.07 por
  //    tonelada-km, consistente con USD 1.40/km / 32 t ≈ USD 0.044/t-km.
  TRUCK_COST_PER_MIN_WAITING_MIN: 0.9,  // USD/min, piso (costo "no-fuel" de un camión parado)
  TRUCK_COST_PER_MIN_WAITING_MAX: 1.4,  // USD/min, techo
  TRUCK_RUNNING_COST_PER_KM: 1.40,      // USD/km recorrido con carga (combustible+mantenimiento+conducción, ATRI 2024 ≈ USD 2.26/milla)
  SATURATION_PENALTY_PER_TRUCK_PER_MIN: 1.6, // USD/min por CADA camión afectado por un nodo saturado (antes era un monto fijo por nodo, sin importar cuántos camiones esperaban: subestimaba la congestión real)
  DIVERSION_COST: 45,                  // USD flat al reasignar un camión (combustible del desvío + tiempo administrativo)
  CONGESTION_PENALTY_WEIGHT: 18,       // peso de congestión en el scoring de rutas

  // --- Motor de decisiones ---
  AVG_PROCESS_TIME_SEC: 9,             // tiempo medio de descarga, usado para estimar cola

  // --- Flujo de nodos ---
  PORT_OUTFLOW_RATE: 1.0,              // tn/seg simulado que exporta un puerto
  ACOPIO_OUTFLOW_RATE: 0.9,            // tn/seg simulado que despacha un acopio

  // --- Ventanas operativas ---
  DAY_LENGTH_SIM_SECONDS: 240,         // 1 "día operativo" demo = 240s simulados

  // --- Clima / eventos ---
  RAIN_SLOWDOWN_FACTOR: 1.6,
  RAIN_DURATION_MS: 25000,

  // --- Umbrales de estado de nodo ---
  SATURATION_THRESHOLD: 0.85,
  RISK_THRESHOLD: 0.6,
};
