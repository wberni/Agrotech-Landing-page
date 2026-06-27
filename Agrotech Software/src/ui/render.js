import { ARG_OUTLINE_MAIN, ARG_OUTLINE_TDF, ARG_SHAPE } from '../model/world.js';
import { isNodeOperating } from '../engine/DecisionEngine.js';

// ============================================================
// MAP RENDERER — dibuja la red logística sobre un canvas, usando el
// mapa REAL de Argentina (imagen + contorno) como fondo, ajustado
// ("contain") al canvas sin deformar la silueta del país. Los nodos
// están definidos en las mismas coordenadas de "espacio de forma" que
// el contorno, así que siempre quedan dentro de la frontera real.
// ============================================================

export class MapRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.lastNodePositions = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * devicePixelRatio;
    this.canvas.height = rect.height * devicePixelRatio;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  // Calcula el rectángulo donde la silueta de Argentina ("espacio de
  // forma" ARG_SHAPE.w x ARG_SHAPE.h) entra en el canvas w x h, centrada,
  // conservando proporciones reales (sin estirar el país).
  fit(w, h) {
    const padX = w * 0.05, padY = h * 0.04;
    const availW = w - padX * 2, availH = h - padY * 2;
    const baseScale = Math.min(availW / ARG_SHAPE.w, availH / ARG_SHAPE.h);
    const scale = baseScale * this.zoom;
    const shapeW = ARG_SHAPE.w * scale, shapeH = ARG_SHAPE.h * scale;
    const offX = (w - shapeW) / 2 + this.panX;
    const offY = (h - shapeH) / 2 + this.panY;
    return { scale, offX, offY };
  }

  pos(node, w, h) {
    const { scale, offX, offY } = this.fit(w, h);
    return { x: offX + node.x * scale, y: offY + node.y * scale };
  }

  // --- Zoom / Pan (usado en test.html con la ruedita del mouse) ---
  zoomAt(factor, cx, cy) {
    const w = this.canvas.width / devicePixelRatio, h = this.canvas.height / devicePixelRatio;
    const before = this.fit(w, h);
    // punto del mundo bajo el cursor antes de zoomear
    const worldX = (cx - before.offX) / before.scale;
    const worldY = (cy - before.offY) / before.scale;
    this.zoom = Math.min(8, Math.max(1, this.zoom * factor));
    const after = this.fit(w, h);
    // ajustamos el pan para que ese mismo punto del mundo quede bajo el cursor
    const targetOffX = cx - worldX * after.scale;
    const targetOffY = cy - worldY * after.scale;
    this.panX += targetOffX - after.offX;
    this.panY += targetOffY - after.offY;
    this.clampPan(w, h);
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    const w = this.canvas.width / devicePixelRatio, h = this.canvas.height / devicePixelRatio;
    this.clampPan(w, h);
  }

  clampPan(w, h) {
    // evita panear tan lejos que el mapa desaparezca de la vista
    const { scale } = this.fit(w, h);
    const shapeW = ARG_SHAPE.w * scale, shapeH = ARG_SHAPE.h * scale;
    const maxPanX = Math.max(0, shapeW - w * 0.2);
    const maxPanY = Math.max(0, shapeH - h * 0.2);
    this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX));
    this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY));
  }

  resetView() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  // Devuelve el nodo bajo el cursor (coords relativas al canvas), o null.
  // Se usa para mostrar la tarjetita de hover en vez de nombres fijos.
  findNodeAt(mx, my) {
    let best = null, bestDist = Infinity;
    for (const item of this.lastNodePositions) {
      const dx = mx - item.x, dy = my - item.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const tolerance = item.radius + 6;
      if (dist <= tolerance && dist < bestDist) { best = item.node; bestDist = dist; }
    }
    return best;
  }

  nodeColor(node) {
    if (node.type === 'origin') return '#5f6e80';
    if (node.closedNow) return '#7a5fff';
    if (node.saturated) return '#ff4757';
    if (node.risk) return '#ffb020';
    return '#36d399';
  }

  render(engine, hotspots = []) {
    const ctx = this.ctx;
    const w = this.canvas.width / devicePixelRatio, h = this.canvas.height / devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    // grid de fondo
    ctx.strokeStyle = '#121826';
    ctx.lineWidth = 1;
    const step = 32;
    for (let x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

    const { scale, offX, offY } = this.fit(w, h);
    const toPx = ([nx, ny]) => [offX + nx * scale, offY + ny * scale];

    // mapa de Argentina: relleno azul navy sólido (no la foto, para que el
    // color quede limpio y consistente, sin el efecto "gris" de la imagen
    // semitransparente).
    ctx.save();
    ctx.beginPath();
    ARG_OUTLINE_MAIN.forEach((p, i) => {
      const [px, py] = toPx(p);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ARG_OUTLINE_TDF.forEach((p, i) => {
      const [px, py] = toPx(p);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = '#15406b';
    ctx.fill();
    ctx.restore();

    // contorno (trazo) del país, sobre el relleno
    [ARG_OUTLINE_MAIN, ARG_OUTLINE_TDF].forEach(outline => {
      ctx.beginPath();
      outline.forEach((p, i) => {
        const [px, py] = toPx(p);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(124,255,94,0.45)';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    });

    // rutas
    engine.routes.forEach(r => {
      const a = this.pos(engine.nodeById(r.from), w, h);
      const b = this.pos(engine.nodeById(r.to), w, h);
      ctx.strokeStyle = 'rgba(70,198,232,0.15)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });

    const hotspotIds = new Set(hotspots.map(n => n.id));
    this.lastNodePositions = [];

    // nodos
    engine.nodes.forEach(n => {
      const p = this.pos(n, w, h);
      const color = this.nodeColor(n);
      const pct = n.capacity === Infinity ? 0 : Math.min(1.2, n.load / n.capacity);
      const radius = n.type === 'origin' ? 7 : 10 + pct * 10;

      this.lastNodePositions.push({ node: n, x: p.x, y: p.y, radius });

      if (n.saturated || hotspotIds.has(n.id)) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 6 + Math.sin(engine.simSeconds * 4) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = hotspotIds.has(n.id) ? 'rgba(255,177,32,0.7)' : 'rgba(255,71,87,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = n.type === 'origin' ? 0.6 : 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#0a0e14';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // camiones
    engine.trucks.forEach(t => {
      let x, y;
      if (t.state === 'en_ruta') {
        const a = this.pos(engine.nodeById(t.currentFromId), w, h);
        const b = this.pos(engine.nodeById(t.currentToId), w, h);
        x = a.x + (b.x - a.x) * t.progress;
        y = a.y + (b.y - a.y) * t.progress;
      } else {
        const node = engine.nodeById(t.currentToId);
        const n = this.pos(node, w, h);
        const idx = node.queue.indexOf(t.id);
        const offset = (idx >= 0 ? idx : 0) * 5;
        x = n.x - 18 - offset; y = n.y + 18;
      }
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = t.state === 'descargando' ? '#36d399' : (t.state === 'esperando' ? '#ffb020' : '#46c6e8');
      ctx.fill();
    });
  }
}
