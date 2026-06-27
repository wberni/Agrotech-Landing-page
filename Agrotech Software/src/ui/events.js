// ============================================================
// EVENTS UI — bitácora de eventos en pantalla
// ============================================================

function simTimeStr(simSeconds) {
  const s = Math.floor(simSeconds);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function createEventLogger(listElementId) {
  const list = document.getElementById(listElementId);
  return function logEvent(msg, level = 'info', simSeconds = 0) {
    const div = document.createElement('div');
    div.className = 'ev ' + level;
    div.innerHTML = `<span class="t">${simTimeStr(simSeconds)}</span><span>${msg}</span>`;
    list.prepend(div);
    while (list.children.length > 120) list.removeChild(list.lastChild);
  };
}

export function clearEventLog(listElementId) {
  document.getElementById(listElementId).innerHTML = '';
}
