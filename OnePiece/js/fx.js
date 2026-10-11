'use strict';
// Partículas y efectos estilo manga: estrellas de impacto, onomatopeyas, salpicaduras, polvo.
(function () {
  const U = G.U, A = G.art;
  const FX = G.fx = {
    list: [],
    reset() { this.list.length = 0; },
    add(p) {
      p.t = 0; p.vx = p.vx || 0; p.vy = p.vy || 0;
      if (this.list.length < 500) this.list.push(p);
      return p;
    },
    update(dt) {
      const L = this.list;
      for (let i = L.length - 1; i >= 0; i--) {
        const p = L[i];
        p.t += dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.g) p.vy += p.g * dt;
        if (p.drag) { p.vx *= Math.pow(p.drag, dt * 60); p.vy *= Math.pow(p.drag, dt * 60); }
        if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
        if (p.t >= p.life) L.splice(i, 1);
      }
    },
    draw(ctx, camX, camY, layer) {
      for (const p of this.list) {
        if ((p.layer || 0) !== layer) continue;
        const k = p.t / p.life;
        const x = p.screen ? p.x : p.x - camX, y = p.screen ? p.y : p.y - camY;
        ctx.save();
        switch (p.type) {
          case 'spark': {
            const s = p.size * (0.6 + U.easeOutCubic(Math.min(1, k * 3)) * 0.6) * (1 - k * 0.3);
            ctx.globalAlpha = 1 - k * k;
            ctx.translate(x, y); ctx.rotate(p.rot0 || 0);
            A.star(ctx, 0, 0, s, s * 0.38, p.points || 8);
            ctx.fillStyle = p.color || '#fff6c0'; ctx.fill();
            ctx.lineWidth = 2.4; ctx.strokeStyle = p.edge || '#ff8a1a'; ctx.stroke();
            A.star(ctx, 0, 0, s * 0.45, s * 0.2, p.points || 8);
            ctx.fillStyle = '#fff'; ctx.fill();
            break;
          }
          case 'ring': {
            ctx.globalAlpha = 1 - k;
            ctx.lineWidth = (p.w || 4) * (1 - k);
            ctx.strokeStyle = p.color || '#fff';
            const rr = p.r0 + (p.r1 - p.r0) * U.easeOutCubic(k);
            ctx.beginPath(); ctx.ellipse(x, y, rr, rr * (p.sy || 1), 0, 0, Math.PI * 2); ctx.stroke();
            break;
          }
          case 'streak': {
            // tajo de impacto: línea que sale disparada y se afina
            const len = p.len * (1 - k * 0.6);
            ctx.globalAlpha = 1 - k;
            ctx.translate(x, y); ctx.rotate(p.ang);
            ctx.fillStyle = p.color || '#fff';
            ctx.beginPath(); ctx.moveTo(0, -p.w * (1 - k)); ctx.lineTo(len, 0); ctx.lineTo(0, p.w * (1 - k)); ctx.lineTo(-len * 0.2, 0); ctx.closePath(); ctx.fill();
            break;
          }
          case 'bubble': {
            ctx.globalAlpha = 0.8 * (1 - k);
            ctx.strokeStyle = '#d8f4ff'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(x + Math.sin(p.t * 20 + p.r) * 1.5, y, p.r * (1 + k * 0.5), 0, Math.PI * 2); ctx.stroke();
            break;
          }
          case 'mote': {
            // partícula de luz flotante
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.sin(k * Math.PI) * (p.alpha || 0.7);
            const g = ctx.createRadialGradient(x, y, 0, x, y, p.r * 3);
            g.addColorStop(0, p.color || 'rgba(255,220,150,1)'); g.addColorStop(1, 'rgba(255,160,80,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.r * 3, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'dot': {
            ctx.globalAlpha = p.fade === false ? 1 : 1 - k;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, p.r * (1 - k * (p.shrink ?? 1))), 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'puff': case 'boom': {
            // nubecilla de dibujo animado: bolas con contorno, base y brillo; se encoge al final
            const grow = U.easeOutCubic(Math.min(1, k * 3));
            const shrink = k > 0.55 ? 1 - (k - 0.55) / 0.45 : 1;
            const R = p.r * (0.45 + 0.55 * grow) * shrink;
            if (R < 0.4) break;
            let base = p.color || '#e8dcc8', hi = p.hi || '#fff8ec';
            if (p.type === 'boom') {
              // fuego que pasa de amarillo a naranja y acaba en humo gris
              base = k < 0.25 ? '#ffe45a' : k < 0.5 ? '#ff9a2a' : k < 0.7 ? '#d8582a' : '#6a5a6a';
              hi = k < 0.25 ? '#fffbe0' : k < 0.5 ? '#ffd86a' : k < 0.7 ? '#ff9a5a' : '#9a8a9a';
            }
            ctx.globalAlpha = p.alpha ?? 1;
            const balls = p.balls;
            ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(26,14,30,.85)';
            ctx.beginPath();
            for (const b of balls) { ctx.moveTo(x + b[0] * R + b[2] * R, y + b[1] * R); ctx.arc(x + b[0] * R, y + b[1] * R, b[2] * R, 0, Math.PI * 2); }
            ctx.stroke();
            ctx.fillStyle = base;
            ctx.fill();
            ctx.fillStyle = hi;
            ctx.beginPath();
            for (const b of balls) { const rr = b[2] * R * 0.55; ctx.moveTo(x + b[0] * R - b[2] * R * 0.25 + rr, y + b[1] * R - b[2] * R * 0.3); ctx.arc(x + b[0] * R - b[2] * R * 0.25, y + b[1] * R - b[2] * R * 0.3, rr, 0, Math.PI * 2); }
            ctx.fill();
            break;
          }
          case 'decal': {
            // marca en el suelo (grieta o charco de tinta) que se desvanece
            ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
            ctx.translate(x, y);
            if (p.kind === 'crack') {
              ctx.strokeStyle = 'rgba(30,12,24,.85)'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
              for (const br of p.branches) { ctx.beginPath(); ctx.moveTo(0, 0); for (const q of br) ctx.lineTo(q[0], q[1]); ctx.stroke(); }
              ctx.fillStyle = 'rgba(30,12,24,.35)'; ctx.beginPath(); ctx.ellipse(0, 1, p.r * 0.35, 3, 0, 0, Math.PI * 2); ctx.fill();
            } else {
              ctx.fillStyle = '#1e1428';
              ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
              for (const b of p.blobs) { ctx.beginPath(); ctx.ellipse(b[0], b[1], b[2], b[2] * 0.4, 0, 0, Math.PI * 2); ctx.fill(); }
              ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.ellipse(-p.r * 0.3, -1, p.r * 0.3, 1.2, 0, 0, Math.PI * 2); ctx.fill();
            }
            break;
          }
          case 'dust': {
            ctx.globalAlpha = (1 - k) * (p.alpha || 0.6);
            ctx.fillStyle = p.color || '#d8c8b0';
            ctx.beginPath(); ctx.arc(x, y, p.r * (0.5 + k), 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'smoke': {
            ctx.globalAlpha = (1 - k) * 0.45;
            ctx.fillStyle = '#e8e8f0';
            ctx.beginPath(); ctx.arc(x + Math.sin(p.t * 5 + p.seed) * 3, y, p.r * (0.6 + k * 1.6), 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'drop': {
            // gota en forma de lágrima orientada según su velocidad
            ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
            ctx.translate(x, y);
            ctx.rotate(Math.atan2(p.vy, p.vx));
            const r = p.r * (1 - k * 0.3), L = r * (1.6 + Math.min(2, Math.hypot(p.vx, p.vy) / 300));
            ctx.beginPath();
            ctx.moveTo(L, 0);
            ctx.quadraticCurveTo(0, -r * 1.1, -r, 0);
            ctx.quadraticCurveTo(0, r * 1.1, L, 0);
            ctx.fillStyle = p.color || '#bfe8ff'; ctx.fill();
            ctx.strokeStyle = 'rgba(25,70,130,.85)'; ctx.lineWidth = 1.3; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,.85)';
            ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'crown': {
            // columna de agua de la corona de salpicadura: sube, se curva y cae
            const hgt = p.h * Math.sin(Math.min(1, k * 1.25) * Math.PI);
            if (hgt < 1) break;
            ctx.globalAlpha = 0.95;
            ctx.translate(x, y);
            ctx.rotate(p.ang);
            ctx.beginPath();
            ctx.moveTo(-p.w, 0);
            ctx.quadraticCurveTo(-p.w * 0.6, -hgt * 0.6, -p.w * 0.1, -hgt);
            ctx.quadraticCurveTo(p.w * 0.5, -hgt * 0.9, p.w * 0.25, -hgt * 0.55);
            ctx.quadraticCurveTo(p.w * 0.5, -hgt * 0.2, p.w, 0);
            ctx.closePath();
            ctx.fillStyle = '#d6f2ff'; ctx.fill();
            ctx.strokeStyle = 'rgba(25,70,130,.85)'; ctx.lineWidth = 1.4; ctx.stroke();
            break;
          }
          case 'debris': {
            ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
            ctx.translate(x, y); ctx.rotate(p.rot);
            ctx.fillStyle = p.color; ctx.strokeStyle = A.OUT; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(-p.r, -p.r * 0.6); ctx.lineTo(p.r, -p.r * 0.2); ctx.lineTo(p.r * 0.3, p.r * 0.8); ctx.closePath();
            ctx.fill(); ctx.stroke();
            break;
          }
          case 'text': {
            const inT = Math.min(1, p.t / 0.18);
            const s = (p.t < 0.18 ? U.easeOutBack(inT) : 1) * (p.scale || 1);
            ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
            ctx.translate(x, y - (p.rise || 0) * k);
            ctx.rotate(p.rot0 || 0);
            ctx.scale(s, s);
            ctx.font = `${p.size || 28}px Bangers, Impact, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.lineWidth = (p.size || 28) * 0.28; ctx.strokeStyle = p.edge || '#1a0e1e';
            ctx.strokeText(p.text, 0, 0);
            ctx.fillStyle = p.color || '#fff';
            ctx.fillText(p.text, 0, 0);
            break;
          }
          case 'speed': {
            // líneas cinéticas de manga
            ctx.globalAlpha = (1 - k) * 0.7;
            ctx.strokeStyle = p.color || '#fff'; ctx.lineWidth = p.w || 2;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + p.len * p.dir, y); ctx.stroke();
            break;
          }
          case 'flash': {
            if (p.t < (p.delay || 0)) break;
            ctx.globalAlpha = (1 - (p.t - (p.delay || 0)) / (p.life - (p.delay || 0))) * (p.alpha || 0.8);
            ctx.fillStyle = p.color || '#fff';
            ctx.fillRect(0, 0, G.W, G.H);
            break;
          }
          case 'flame': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1 - k;
            const r = p.r * (1 - k * 0.5);
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, 'rgba(255,240,170,.9)'); g.addColorStop(0.5, 'rgba(255,130,40,.6)'); g.addColorStop(1, 'rgba(255,40,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            break;
          }
        }
        ctx.restore();
      }
    },

    // ------------------------------------------------------------ atajos
    hit(x, y, big, dir = 0) {
      this.add({ type: 'spark', x, y, life: big ? 0.26 : 0.18, size: big ? 30 : 20, rot0: Math.random(), points: big ? 10 : 8, layer: 1 });
      // tajos de impacto en la dirección del golpe
      const ns = big ? 5 : 3;
      for (let i = 0; i < ns; i++) {
        const ang = (dir < 0 ? Math.PI : dir > 0 ? 0 : Math.random() * Math.PI * 2) + U.rand(-0.7, 0.7);
        this.add({ type: 'streak', x, y, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, ang, len: U.rand(26, big ? 60 : 40), w: big ? 4 : 3, color: i % 2 ? '#ffe27a' : '#fff', life: U.rand(0.12, 0.2), layer: 1 });
      }
      this.add({ type: 'ring', x, y, life: 0.25, r0: 4, r1: big ? 46 : 30, w: big ? 6 : 4, layer: 1 });
      const n = big ? 10 : 6;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = U.rand(120, big ? 420 : 300);
        this.add({ type: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: U.rand(2, 4), color: U.choose(['#fff', '#ffe27a', '#ffb347']), life: U.rand(0.2, 0.4), drag: 0.9, layer: 1 });
      }
    },
    // forma aleatoria de nubecilla (3-4 bolas solapadas)
    balls() {
      const n = U.randi(3, 4), out = [];
      for (let i = 0; i < n; i++) out.push([U.rand(-0.55, 0.55), U.rand(-0.45, 0.25), U.rand(0.45, 0.75)]);
      out.push([0, 0, 0.8]);
      return out;
    },
    dust(x, y, n = 5, dir = 0) {
      for (let i = 0; i < n; i++) {
        this.add({ type: 'puff', x: x + U.rand(-8, 8), y: y - U.rand(2, 8), vx: (dir || U.rand(-1, 1)) * U.rand(20, 90), vy: -U.rand(10, 45), r: U.rand(5, 9), life: U.rand(0.3, 0.5), drag: 0.9, balls: this.balls(), color: '#e8d6bc', hi: '#fff6e4' });
      }
    },
    splash(x, y, big) {
      const n = big ? 22 : 12;
      for (let i = 0; i < n; i++) {
        this.add({ type: 'drop', x: x + U.rand(-10, 10), y, vx: U.rand(-160, 160), vy: -U.rand(200, big ? 620 : 460), g: 1400, r: U.rand(2.5, 5), life: U.rand(0.5, 0.9), layer: 1 });
      }
      this.add({ type: 'ring', x, y, life: 0.4, r0: 6, r1: big ? 50 : 30, w: 3, color: '#cfefff', layer: 1, sy: 0.35 });
      const nc = big ? 7 : 4;
      for (let i = 0; i < nc; i++) {
        const k = (i / (nc - 1)) * 2 - 1;
        this.add({ type: 'crown', x: x + k * (big ? 26 : 16), y, ang: k * 0.5, h: (big ? 46 : 28) * (1 - Math.abs(k) * 0.4) * U.rand(0.8, 1.1), w: big ? 6 : 4.5, life: U.rand(0.35, 0.5), layer: 1 });
      }
    },
    smoke(x, y) {
      this.add({ type: 'smoke', x, y, vx: U.rand(-6, 6), vy: -U.rand(18, 30), r: U.rand(2, 3), life: U.rand(0.9, 1.4), seed: Math.random() * 9 });
    },
    text(x, y, text, o = {}) {
      return this.add(Object.assign({ type: 'text', x, y, text, life: 0.9, size: 30, rise: 26, rot0: U.rand(-0.12, 0.12), layer: 2 }, o));
    },
    debris(x, y, color, n = 8) {
      for (let i = 0; i < n; i++) {
        this.add({ type: 'debris', x, y, vx: U.rand(-200, 200), vy: -U.rand(150, 400), g: 1300, r: U.rand(3, 6), rot: Math.random() * 6, vr: U.rand(-12, 12), color: Array.isArray(color) ? U.choose(color) : color, life: U.rand(0.6, 1), layer: 1 });
      }
    },
    explosion(x, y, scale = 1) {
      // explosión de dibujo animado: bolas de fuego con contorno que acaban en humo
      for (let i = 0; i < 9 * scale; i++) {
        const a = Math.random() * Math.PI * 2, s = U.rand(30, 200) * scale;
        this.add({ type: 'boom', x: x + U.rand(-8, 8), y: y + U.rand(-8, 8), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50, r: U.rand(12, 24) * scale, life: U.rand(0.5, 0.9), drag: 0.88, balls: this.balls(), layer: 1 });
      }
      for (let i = 0; i < 5 * scale; i++) {
        const a = Math.random() * Math.PI * 2, s = U.rand(60, 220) * scale;
        this.add({ type: 'flame', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, r: U.rand(14, 26) * scale, life: U.rand(0.25, 0.45), drag: 0.9, layer: 1 });
      }
      this.hit(x, y, true);
      this.dust(x, y + 20, 8);
    },
    // grieta radial en el suelo (aterrizajes muy fuertes)
    crack(x, y, r = 40) {
      const branches = [];
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI * 0 + (i - 3) * 0.45, pts = [];
        let px = 0, py = 0;
        const dir = i % 2 ? 1 : -1;
        for (let j = 1; j <= 3; j++) { px += dir * r * U.rand(0.2, 0.42); py = U.rand(-2, 4) * (j === 1 ? 0.3 : 1); pts.push([px, py]); }
        branches.push(pts);
        void a;
      }
      this.add({ type: 'decal', kind: 'crack', x, y: y - 1, r, branches, life: 2.2, layer: 0 });
    },
    inkPuddle(x, y, r = 22) {
      const blobs = [];
      for (let i = 0; i < 4; i++) blobs.push([U.rand(-r, r), U.rand(-2, 2), U.rand(4, 9)]);
      this.add({ type: 'decal', kind: 'ink', x, y: y - 1, r, blobs, life: 3, layer: 0 });
    },
    speedLines(dir, n = 10, color) {
      for (let i = 0; i < n; i++) {
        const y = U.rand(40, G.H - 40);
        this.add({ type: 'speed', screen: true, x: dir > 0 ? U.rand(-100, G.W) : U.rand(0, G.W + 100), y, len: U.rand(80, 220), dir, vx: dir * 900, w: U.rand(1, 3), life: U.rand(0.2, 0.35), color, layer: 2 });
      }
    },
    flash(color = '#fff', life = 0.25, alpha = 0.8, delay = 0) {
      this.add({ type: 'flash', screen: true, x: 0, y: 0, color, life: life + delay, delay, alpha, layer: 3 });
    },
  };
})();
