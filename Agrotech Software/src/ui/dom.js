import { clamp } from '../model/world.js';

// ============================================================
// DOM / KPI PANEL — métricas operativas y económicas en vivo
// ============================================================

function simTimeStr(simSeconds) {
  const s = Math.floor(simSeconds);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

const fmtUSD = (v) => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });

// ============================================================
// TOOLTIP DE NODO — la tarjetita que aparece al pasar el mouse por
// encima de un campo/acopio/puerto en el mapa (en vez de mostrar
// el nombre siempre fijo sobre el canvas).
// ============================================================
const TYPE_LABEL = { origin: 'Campo de origen', acopio: 'Acopio', puerto: 'Puerto' };

export function updateNodeTooltip(tooltipEl, node, isHotspot = false) {
  if (!node) { tooltipEl.classList.add('hidden'); return; }

  let extra = '';
  if (node.type !== 'origin') {
    const statusLabel = node.closedNow ? 'CERRADO' : (node.saturated ? 'SATURADO' : (node.risk ? 'RIESGO' : 'NORMAL'));
    const statusColor = node.closedNow ? 'var(--violet)' : (node.saturated ? 'var(--red)' : (node.risk ? 'var(--amber)' : 'var(--green)'));
    const cap = node.capacity === Infinity ? '∞' : node.capacity;
    extra = `
      <div class="tt-row"><span>Estado</span><b style="color:${statusColor}">${statusLabel}${isHotspot ? ' · HOTSPOT' : ''}</b></div>
      <div class="tt-row"><span>Carga</span><b>${Math.round(node.load)}/${cap} t</b></div>
      <div class="tt-row"><span>Cola</span><b>${node.queue.length}</b></div>
      <div class="tt-row"><span>Costo acum.</span><b>${fmtUSD(node.costContribution)}</b></div>
    `;
  }

  tooltipEl.innerHTML = `
    <div class="tt-name">${node.name}</div>
    <div class="tt-type">${TYPE_LABEL[node.type] || node.type}${node.province ? ' · ' + node.province : ''}${node.region ? ' (' + node.region + ')' : ''}</div>
    ${extra}
  `;
  tooltipEl.classList.remove('hidden');
}

// Posiciona la tarjetita cerca del cursor sin que se salga del contenedor del mapa.
export function positionTooltip(tooltipEl, mouseX, mouseY, wrapRect) {
  const pad = 16;
  const ttRect = tooltipEl.getBoundingClientRect();
  let left = mouseX + pad;
  let top = mouseY + pad;
  if (left + ttRect.width > wrapRect.width) left = mouseX - ttRect.width - pad;
  if (top + ttRect.height > wrapRect.height) top = mouseY - ttRect.height - pad;
  if (left < 0) left = pad;
  if (top < 0) top = pad;
  tooltipEl.style.left = left + 'px';
  tooltipEl.style.top = top + 'px';
}

export function renderKPIs(engine, hotspots) {
  document.getElementById('kpiTrucks').textContent = engine.trucks.length;

  const waiting = engine.trucks.filter(t => t.state === 'esperando');
  const avgWaitSec = waiting.length ? (waiting.reduce((s, t) => s + t.waitSeconds, 0) / waiting.length) : 0;
  const avgWaitMin = avgWaitSec / 60;
  const kpiWait = document.getElementById('kpiWait');
  // Formateo igual que KPIs económicos: valor limpio con unidad apropiada
  if (avgWaitMin < 1) {
    kpiWait.textContent = Math.round(avgWaitSec) + ' seg';
  } else if (avgWaitMin < 60) {
    kpiWait.textContent = avgWaitMin.toFixed(1) + ' min';
  } else {
    kpiWait.textContent = (avgWaitMin / 60).toFixed(1) + ' h';
  }
  kpiWait.className = 'value ' + (avgWaitSec > 180 ? 'alert' : (avgWaitSec > 60 ? '' : 'ok'));

  document.getElementById('kpiThroughput').textContent = Math.round(engine.econ.tonsDelivered) + ' tn';

  const satCount = engine.nodes.filter(n => n.saturated).length;
  const kpiSat = document.getElementById('kpiSat');
  kpiSat.textContent = satCount;
  kpiSat.className = 'value ' + (satCount > 0 ? 'alert' : 'ok');
  document.getElementById('kpiTotalNodes').textContent = engine.nodes.filter(n => n.type !== 'origin').length;

  document.getElementById('kpiReassign').textContent = engine.reassignCount;

  // --- KPIs económicos ---
  document.getElementById('kpiTotalCost').textContent = fmtUSD(engine.econ.totalCost);
  document.getElementById('kpiCostHour').textContent = fmtUSD(engine.econ.costPerHour(engine.simSeconds)) + '/h';
  document.getElementById('kpiCostTon').textContent = fmtUSD(engine.econ.costPerTon()) + '/tn';
  const kpiCongestion = document.getElementById('kpiCongestionRate');
  kpiCongestion.textContent = fmtUSD(engine.econ.congestionCostRate) + '/min';
  kpiCongestion.className = 'value ' + (engine.econ.congestionCostRate > 0 ? 'alert' : 'ok');

  // Desglose eliminado por solicitud del usuario (items Rodaje, Saturación, Desvíos, Espera).

  document.getElementById('clock').textContent = 'T+' + simTimeStr(engine.simSeconds);
  document.getElementById('opClock').textContent = 'Día op. ' + engine.opHour.toFixed(1) + 'h';

  // --- tabla de nodos ---
  const hotspotIds = new Set(hotspots.map(n => n.id));
  const list = document.getElementById('nodesList');
  list.innerHTML = '';
  engine.nodes.filter(n => n.type !== 'origin').forEach(n => {
    const pct = clamp(n.load / n.capacity, 0, 1);
    const color = n.closedNow ? 'var(--violet)' : (n.saturated ? 'var(--red)' : (n.risk ? 'var(--amber)' : 'var(--green)'));
    const row = document.createElement('div');
    row.className = 'noderow' + (hotspotIds.has(n.id) ? ' hotspot' : '');
    const statusLabel = n.closedNow ? 'cerrado' : (n.saturated ? 'saturado' : (n.risk ? 'riesgo' : 'normal'));
    row.innerHTML = `
      <div>
        <div class="nname">${n.name}${hotspotIds.has(n.id) ? ' <span class="tag">HOTSPOT</span>' : ''}</div>
        <div class="ntype">${n.type} · ${n.province || ''} (${n.region || ''}) · cola ${n.queue.length} · ${statusLabel} · costo ${fmtUSD(n.costContribution)}</div>
      </div>
      <div class="bar"><i style="width:${pct * 100}%;background:${color}"></i></div>
    `;
    list.appendChild(row);
  });
}
