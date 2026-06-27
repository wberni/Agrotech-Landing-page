import { SimulationEngine } from './engine/SimulationEngine.js';
import { findHotspots } from './engine/DecisionEngine.js';
import { MapRenderer } from './ui/render.js';
import { renderKPIs, updateNodeTooltip, positionTooltip } from './ui/dom.js';
import { createEventLogger, clearEventLog } from './ui/events.js';

// ============================================================
// MAIN — punto de entrada. Conecta motor de simulación (lógica
// pura) con la capa de presentación (canvas + DOM). Ningún otro
// módulo toca el DOM directamente salvo ui/render.js y ui/dom.js.
// ============================================================

const logEvent = createEventLogger('eventsList');
const engine = new SimulationEngine(logEvent);
const renderer = new MapRenderer(document.getElementById('mapCanvas'));

let lastTick = performance.now();
function frame(now) {
  const dtMs = now - lastTick;
  lastTick = now;
  engine.tick(dtMs);
  const hotspots = findHotspots(engine.nodes, 2);
  renderer.render(engine, hotspots);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

setInterval(() => {
  const hotspots = findHotspots(engine.nodes, 2);
  renderKPIs(engine, hotspots);
}, 300);

// -------------------- controles UI --------------------
document.getElementById('btnStart').onclick = () => {
  if (!engine.running) {
    engine.running = true;
    document.getElementById('statusText').textContent = 'corriendo';
    logEvent('Simulación iniciada', 'info', engine.simSeconds);
  }
};

document.getElementById('btnStop').onclick = () => {
  engine.running = false;
  document.getElementById('statusText').textContent = 'detenido';
  logEvent('Simulación detenida', 'info', engine.simSeconds);
};

document.getElementById('btnReset').onclick = () => {
  engine.running = false;
  engine.reset();
  clearEventLog('eventsList');
  document.getElementById('statusText').textContent = 'detenido';
  logEvent('Sistema reiniciado', 'info', 0);
};

document.querySelectorAll('.speed').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.speed').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    engine.speed = parseInt(btn.dataset.speed);
  };
});

document.getElementById('btnRain').onclick = () => engine.simulateRain();
document.getElementById('btnHarvest').onclick = () => engine.simulateMassiveHarvest();
document.getElementById('btnSaturate').onclick = () => engine.forcePortSaturation();

// -------------------- zoom +/- del mapa --------------------
function zoomCenter() {
  const rect = renderer.canvas.getBoundingClientRect();
  return { cx: rect.width / 2, cy: rect.height / 2 };
}
document.getElementById('zoomIn').onclick = () => {
  const { cx, cy } = zoomCenter();
  renderer.zoomAt(1.25, cx, cy);
};
document.getElementById('zoomOut').onclick = () => {
  const { cx, cy } = zoomCenter();
  renderer.zoomAt(1 / 1.25, cx, cy);
};
document.getElementById('zoomReset').onclick = () => renderer.resetView();

// -------------------- arrastrar para moverse por el mapa --------------------
const mapWrap = document.getElementById('mapWrap');
const tooltipEl = document.getElementById('nodeTooltip');
const canvasEl = renderer.canvas;

let dragging = false, lastX = 0, lastY = 0;

canvasEl.addEventListener('mousedown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  tooltipEl.classList.add('hidden');
});

window.addEventListener('mousemove', (e) => {
  if (dragging) {
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    renderer.panBy(dx, dy);
    return;
  }

  // --- hover: mostrar tarjetita con el nombre/estado del nodo ---
  const rect = canvasEl.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  if (mx < 0 || my < 0 || mx > rect.width || my > rect.height) {
    tooltipEl.classList.add('hidden');
    return;
  }
  const hovered = renderer.findNodeAt(mx, my);
  const hotspots = findHotspots(engine.nodes, 2);
  const isHotspot = hovered ? hotspots.some(h => h.id === hovered.id) : false;
  updateNodeTooltip(tooltipEl, hovered, isHotspot);
  if (hovered) positionTooltip(tooltipEl, mx, my, mapWrap.getBoundingClientRect());
});

window.addEventListener('mouseup', () => { dragging = false; });
canvasEl.addEventListener('mouseleave', () => { if (!dragging) tooltipEl.classList.add('hidden'); });

// estado inicial
logEvent('Sistema AGROTECH listo. Presione Iniciar para comenzar la simulación.', 'info', 0);
renderKPIs(engine, []);
