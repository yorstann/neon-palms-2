// Transient visual juice: particles, floating text, skid marks and the
// camera shake. Everything lives in world space and is drawn by render.js
// between the actors and the night lighting.
import { G } from './state.js';
import { clamp } from './config.js';

export const FX = {
  parts: [],
  texts: [],
  skids: [],

  burst(x, y, color, n = 10, speed = 160, life = 0.5, size = 3, grav = 0) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 420) this.parts.shift();
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: life * (0.6 + Math.random() * 0.7), max: life,
        size: size * (0.6 + Math.random() * 0.8), color, grav,
      });
    }
  },

  smoke(x, y, big = false) {
    if (this.parts.length > 420) return;
    this.parts.push({
      x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 22, vy: -34 - Math.random() * 26,
      life: big ? 1.5 : 0.9, max: 1.5, size: big ? 11 : 7, color: 'smoke', grav: -30,
    });
  },

  sparks(x, y, n = 8) { this.burst(x, y, '#ffd76a', n, 240, 0.35, 2.4, 300); },
  splashPuff(x, y) { this.burst(x, y, '#e8e2d2', 8, 110, 0.4, 3, 160); },
  muzzle(x, y, angle) {
    this.burst(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, '#ffca7a', 4, 130, 0.12, 2.6, 0);
  },

  text(x, y, str, color = '#ffffff', size = 15) {
    this.texts.push({ x, y, str, color, size, life: 1.15, max: 1.15 });
    if (this.texts.length > 14) this.texts.shift();
  },

  skid(x, y) {
    this.skids.push({ x, y, life: 5 });
    if (this.skids.length > 700) this.skids.shift();
  },

  shake(mag) {
    G.shakeMag = Math.max(G.shakeMag || 0, mag);
  },

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= (1 - 1.6 * dt);
      p.vy *= (1 - 1.6 * dt);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }
    if (G.shakeMag) {
      G.shakeMag = Math.max(0, G.shakeMag - dt * 26);
    }
  },

  drawSkids(ctx) {
    ctx.fillStyle = '#26282c';
    for (const s of this.skids) {
      ctx.globalAlpha = clamp(s.life / 5, 0, 0.5);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  drawParts(ctx) {
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.color === 'smoke') {
        ctx.fillStyle = 'rgba(70,70,74,' + (0.34 * a) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  },

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const a = clamp(t.life / t.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = '700 ' + t.size + 'px "Segoe UI", system-ui, sans-serif';
      ctx.strokeStyle = 'rgba(10,10,14,0.75)';
      ctx.lineWidth = 3;
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  },
};
