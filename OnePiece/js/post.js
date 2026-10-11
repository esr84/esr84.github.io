'use strict';
// Posprocesado de la escena: gradación de color, viñeta, daño, líneas de concentración y fotograma de impacto.
(function () {
  const W = G.W, H = G.H;
  const Post = G.post = {
    vig: null, vigKey: '',
    // la viñeta se pinta una vez en un lienzo auxiliar y se reutiliza
    vignette(ctx) {
      const cw = G.canvas.width, ch = G.canvas.height, key = cw + 'x' + ch;
      if (this.vigKey !== key) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(cw / 2)); c.height = Math.max(1, Math.round(ch / 2));
        const x = c.getContext('2d');
        const g = x.createRadialGradient(c.width / 2, c.height * 0.55, c.height * 0.38, c.width / 2, c.height * 0.55, Math.hypot(c.width, c.height) * 0.62);
        g.addColorStop(0, 'rgba(24,6,36,0)'); g.addColorStop(0.7, 'rgba(24,6,36,.22)'); g.addColorStop(1, 'rgba(14,2,24,.62)');
        x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
        this.vig = c; this.vigKey = key;
      }
      ctx.drawImage(this.vig, 0, 0, W, H);
    },
    draw(ctx, g) {
      if (G.lowFx) { this.vignette(ctx); if (g.impactT > 0) this.negative(ctx); return; }
      ctx.save();
      // gradación: luz cálida arriba, sombras frías abajo
      ctx.globalCompositeOperation = 'soft-light';
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      const nk = G.nightK || 0;
      gr.addColorStop(0, `rgba(255,170,90,${0.38 - nk * 0.18})`); gr.addColorStop(0.55, 'rgba(255,150,110,.12)'); gr.addColorStop(1, `rgba(80,40,150,${0.22 + nk * 0.2})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      this.vignette(ctx);
      // daño recibido / vida baja: bordes rojos que laten
      const p = g.player;
      let red = 0;
      if (g.hurtT > 0) red = (g.hurtT / 0.4) * 0.6;
      if (p && p.hp > 0 && p.hp <= 4 && g.state === 'play') red = Math.max(red, 0.2 + 0.15 * Math.sin(g.time * 7));
      if (red > 0) {
        ctx.save();
        const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
        rg.addColorStop(0, 'rgba(255,0,30,0)'); rg.addColorStop(1, `rgba(200,0,20,${red})`);
        ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      if (g.focusT > 0) this.focus(ctx, g, Math.min(1, g.focusT * 3));
      // fotograma de impacto: imagen en negativo durante un instante (muy anime)
      if (g.impactT > 0) this.negative(ctx);
    },
    // fotograma de impacto: negativo en blanco y negro, como una viñeta de manga
    negative(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255,40,60,.12)'; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },
    // líneas de concentración (shūchūsen) hacia el centro de la acción
    focus(ctx, g, a) {
      let r = Math.floor(g.time * 24) * 7919 + 13;
      const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
      const p = g.player;
      const cx = p ? (p.x - g.cam.x) * 0.5 + W / 4 : W / 2, cy = H * 0.5;
      ctx.save();
      for (let i = 0; i < 80; i++) {
        const ang = rnd() * Math.PI * 2, w = 0.003 + rnd() * 0.012;
        const r0 = 260 + rnd() * 160, r1 = 900;
        ctx.globalAlpha = a * (0.35 + rnd() * 0.4);
        ctx.fillStyle = i % 4 === 0 ? '#1a0e1e' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.62);
        ctx.lineTo(cx + Math.cos(ang - w) * r1, cy + Math.sin(ang - w) * r1 * 0.62);
        ctx.lineTo(cx + Math.cos(ang + w) * r1, cy + Math.sin(ang + w) * r1 * 0.62);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
  };
})();
