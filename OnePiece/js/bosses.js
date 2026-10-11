'use strict';
// Jefes: Hatchan (mini-jefe) y Arlong (jefe final con dos fases).
(function () {
  const U = G.U, A = G.art, P = A.pose;
  const GRAV = 2100;

  class Boss extends G.Enemy {
    constructor(x, y) {
      super(x, y);
      this.isBoss = true; this.contact = 3; this.active = false; this.facing = -1;
    }
    hurt(atk, game) {
      if (this.dead || !this.active || this.invulnT > 0 || atk.id === this.lastHitId) return false;
      this.lastHitId = atk.id;
      let dmg = atk.dmg;
      if (this.state === 'stuck' || this.state === 'dizzy') dmg = Math.ceil(dmg * 1.5);
      this.hp = Math.max(0, this.hp - dmg);
      this.flashT = 0.1;
      this.sq.x = 0.9; this.sq.v = 0;
      G.audio.sfx(dmg >= 3 ? 'bighit' : 'hit');
      game.hitstop(0.05);
      if (this.hp <= 0) { this.defeat(game); return true; }
      // aguante: sólo se tambalea cada varios golpes; si no, a veces contraataca
      this.poise = (this.poise || 0) + 1;
      if (this.poise >= 5) { this.poise = 0; this.onHit(game, atk); }
      else if ((this.state === 'idle' || this.state === 'walk') && Math.random() < 0.35) this.counter(game);
      return true;
    }
    onHit() {}
    counter() {}
    clampArena(game) {
      const a = game.arena;
      if (!a) return;
      const m = G.ARENA_WALL + this.w / 2 + 4;
      if (this.x < a.x0 + m) { this.x = a.x0 + m; this.hitArenaWall = -1; }
      else if (this.x > a.x1 - m) { this.x = a.x1 - m; this.hitArenaWall = 1; }
      else this.hitArenaWall = 0;
    }
    faceP(game) { this.facing = game.player.x < this.x ? -1 : 1; }
    defeat(game) {
      this.dead = true; this.active = false; this.setState('defeated');
      this.vx = -this.facing * 160; this.vy = -500;
      game.onBossDefeated(this);
    }
  }

  // ================================================================ HATCHAN
  class Hatchan extends Boss {
    constructor(x, y) {
      super(x, y);
      this.name = 'HATCHAN'; this.w = 52; this.h = 112; this.hp = this.maxHp = 28; this.score = 3000;
      this.state = 'wait'; this.cool = 0.8; this.scale = 1.15;
    }
    update(dt, game) {
      this.t += dt; this.stateT += dt; if (this.flashT > 0) this.flashT -= dt;
      const p = game.player, dx = p.x - this.x, dist = Math.abs(dx);
      const rage = this.hp < this.maxHp / 2 ? 1.3 : 1;
      switch (this.state) {
        case 'wait': this.faceP(game); this.vx = 0; break;
        case 'idle':
          this.faceP(game); this.vx = U.approach(this.vx, 0, 1200 * dt);
          if (this.stateT > 0.55 / rage) this.choose(game, dist);
          break;
        case 'walk':
          this.faceP(game); this.vx = this.facing * 110 * rage;
          if (dist < 140 || this.stateT > 1.3) this.choose(game, dist, true);
          break;
        case 'slash':
          this.vx = U.approach(this.vx, 0, 1500 * dt);
          if (this.stateT > 0.4 && this.stateT < 0.45) { G.audio.sfx('slash'); }
          if (this.stateT > 0.4 && this.stateT < 0.8 && Math.random() < 0.4) G.audio.sfx('slash');
          if (this.stateT > 1.15) this.setState('idle');
          break;
        case 'spin':
          if (this.stateT < 0.5) { this.vx = 0; }
          else if (this.stateT < 2.0) {
            this.vx = this.facing * 430 * rage;
            if (this.hitArenaWall === this.facing) { this.setState('dizzy'); this.vx = 0; game.shake(6); G.audio.sfx('stuck'); }
            if (Math.random() < 0.3) G.audio.sfx('whoosh');
          } else this.setState('dizzy');
          break;
        case 'dizzy':
          this.vx = U.approach(this.vx, 0, 1500 * dt);
          if (this.stateT > 1.0) this.setState('idle');
          break;
        case 'ink':
          this.vx = 0;
          if (this.stateT > 0.45 && !this.fired) {
            this.fired = true;
            const n = rage > 1 ? 5 : 3;
            for (let i = 0; i < n; i++) {
              const spd = 200 + i * 110;
              game.addProjectile({ kind: 'ink', x: this.x + this.facing * 30, y: this.y - 110, vx: this.facing * spd, vy: -420 - i * 30, g: 900, r: 9, dmg: 2 });
            }
            G.audio.sfx('spit');
          }
          if (this.stateT > 1.0) { this.fired = false; this.setState('idle'); }
          break;
        case 'hurt':
          this.vx = U.approach(this.vx, 0, 1200 * dt);
          if (this.stateT > 0.2) this.setState('idle');
          break;
        case 'defeated':
          this.vx = U.approach(this.vx, 0, 300 * dt);
          break;
      }
      this.vy = Math.min(1000, this.vy + GRAV * dt);
      G.phys.move(this, dt, game.level);
      this.clampArena(game);
    }
    choose(game, dist, fromWalk) {
      const r = Math.random();
      if (dist > 300) this.setState(r < 0.45 ? 'ink' : r < 0.75 ? 'spin' : 'walk');
      else if (dist < 170) this.setState(r < 0.6 ? 'slash' : r < 0.8 ? 'spin' : 'ink');
      else this.setState(fromWalk ? (r < 0.5 ? 'slash' : 'ink') : (r < 0.4 ? 'walk' : r < 0.7 ? 'spin' : 'ink'));
      if (this.state === 'spin') { this.faceP(game); G.fx.text(this.x, this.y - 150, '¡ROKUTORYU!', { size: 26, color: '#ff9ab0' }); }
      if (this.state === 'slash') this.faceP(game);
    }
    onHit(game, atk) {
      if (this.state === 'idle' || this.state === 'walk') { this.setState('hurt'); this.vx = (this.x > game.player.x ? 1 : -1) * 120; }
    }
    counter(game) {
      const dist = Math.abs(game.player.x - this.x);
      this.faceP(game);
      this.setState(dist < 170 ? 'slash' : 'spin');
      if (this.state === 'spin') G.fx.text(this.x, this.y - 150, '¡ROKUTORYU!', { size: 26, color: '#ff9ab0' });
    }
    attackBox() {
      const f = this.facing;
      if (this.state === 'slash' && this.stateT > 0.4 && this.stateT < 0.85) return { x: f > 0 ? this.x : this.x - 120, y: this.y - 120, w: 120, h: 110, dmg: 3 };
      if (this.state === 'spin' && this.stateT > 0.5 && this.stateT < 2) return { x: this.x - 60, y: this.y - 110, w: 120, h: 100, dmg: 3 };
      return null;
    }
    pose() {
      const t = this.t, s = this.stateT;
      // brazos en abanico: tres hacia atrás (0-2) y tres hacia delante (3-5)
      const base = (k) => Array.from({ length: 6 }, (_, i) => {
        const j = i % 3, wob = Math.sin(t * 2 + i) * 0.1 * k;
        if (i < 3) { const a = -0.5 - j * 0.6 + wob, e = -0.5; return { a, e, w: a + e - 1.3 }; }
        return { a: 0.55 + j * 0.62 + wob, e: 0.6 };
      });
      switch (this.state) {
        case 'walk': return Object.assign(P.run(t, 0.5), { arms: base(1) });
        case 'slash': {
          if (s < 0.4) return Object.assign(P.idle(t), { torso: -0.15, arms: Array.from({ length: 6 }, (_, i) => ({ a: 2.6 + (i % 3) * 0.2, e: 0.3 })) });
          return Object.assign(P.idle(t), { torso: 0.25, arms: Array.from({ length: 6 }, (_, i) => ({ a: 1.0 + Math.sin(t * 50 + i * 2) * 1.0, e: 0.2 + Math.cos(t * 40 + i) * 0.3 })) });
        }
        case 'spin': {
          const k = s < 0.5 ? s * 2 : 1;
          return Object.assign(P.idle(t), { torso: 0.1, arms: Array.from({ length: 6 }, (_, i) => ({ a: Math.PI / 2 + Math.sin(t * 30 * k + i * 1.05) * 1.4, e: 0.1, w: Math.PI / 2 + Math.sin(t * 30 * k + i * 1.05) * 1.4 + 1.5 })) });
        }
        case 'dizzy': return Object.assign(P.idle(t * 0.5), { torso: Math.sin(t * 6) * 0.15, head: Math.sin(t * 7) * 0.2, arms: base(0), face: 'ko' });
        case 'ink': return Object.assign(P.idle(t), { torso: s < 0.45 ? -0.3 : 0.25, head: s < 0.45 ? -0.3 : 0.15, arms: base(1) });
        case 'hurt': return Object.assign(P.hurt(t), { arms: base(0) });
        case 'defeated': return Object.assign(P.dead(), { arms: Array.from({ length: 6 }, (_, i) => ({ a: -2.4 - i * 0.15, e: 0.2 })), face: 'ko' });
        default: return Object.assign(P.idle(t), { arms: base(1) });
      }
    }
    draw(ctx, camX) {
      ctx.save();
      ctx.translate(this.x - camX + this.jitter(), this.y);
      A.shadow(ctx, 30);
      ctx.scale(this.facing * this.scale * this.sq.x, this.scale * (2 - this.sq.x));
      A.flash = this.flashMode();
      A.drawHatchan(ctx, this.drawPose(), this.t);
      A.flash = false;
      ctx.restore();
      if (this.state === 'dizzy') this.drawStars(ctx, camX);
    }
    drawStars(ctx, camX) {
      for (let i = 0; i < 3; i++) {
        const a = this.t * 4 + i * 2.1;
        ctx.save();
        ctx.translate(this.x - camX + Math.cos(a) * 26, this.y - this.h * this.scale - 6 + Math.sin(a) * 7);
        A.star(ctx, 0, 0, 7, 3, 5);
        ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.strokeStyle = A.OUT; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
    }
  }
  G.Hatchan = Hatchan;

  // ================================================================ ARLONG
  class Arlong extends Boss {
    constructor(x, y) {
      super(x, y);
      this.name = 'ARLONG'; this.w = 56; this.h = 168; this.hp = this.maxHp = 44; this.score = 10000;
      this.state = 'sit'; this.phase = 1; this.sword = false; this.scale = 1.12;
      this.chairX = x;
    }
    update(dt, game) {
      this.t += dt; this.stateT += dt; if (this.flashT > 0) this.flashT -= dt;
      if (this.invulnT > 0) this.invulnT -= dt;
      const p = game.player, dx = p.x - this.x, dist = Math.abs(dx);
      const sp = this.phase === 2 ? 1.2 : 1;
      let grav = true;
      switch (this.state) {
        case 'sit': this.vx = 0; this.facing = -1; break;
        case 'rise':
          if (this.stateT > 0.2 && !this.roared) {
            this.roared = true; G.audio.sfx('roar'); G.audio.sfx('splash'); game.shake(12);
            G.fx.text(this.x - 40, this.y - 210, '¡SHAHAHAHA!', { size: 34, color: '#9fd0ff', life: 1.4 });
            // géiseres de agua y onda de choque al levantarse
            for (const dx of [-90, 0, 90]) G.fx.splash(this.x + dx, this.y, true);
            G.fx.add({ type: 'ring', x: this.x, y: this.y, life: 0.5, r0: 20, r1: 260, w: 7, color: '#bfe8ff', layer: 1, sy: 0.3 });
            G.fx.dust(this.x, this.y, 12);
          }
          if (this.stateT > 1.1) { this.active = true; this.setState('idle'); }
          break;
        case 'idle':
          this.faceP(game); this.vx = U.approach(this.vx, 0, 1500 * dt);
          if (this.stateT > (this.phase === 2 ? 0.45 : 0.7)) this.choose(game, dist);
          break;
        case 'walk':
          this.faceP(game); this.vx = this.facing * 130 * sp;
          if (dist < 120 || this.stateT > 1.1) this.choose(game, dist, true);
          break;
        case 'darts': {
          const W = this.phase === 2 ? 0.55 : 0.75;
          if (this.stateT < W) {
            this.vx = U.approach(this.vx, -this.facing * 40, 600 * dt);
            if (Math.random() < 0.3) G.fx.dust(this.x + this.facing * 20, this.y, 1, -this.facing);
          } else {
            grav = false;
            if (!this.dashStarted) { this.dashStarted = true; G.audio.sfx('whoosh'); G.fx.speedLines(-this.facing, 12, '#bfe8ff'); this.vy = 0; }
            this.vx = this.facing * (this.phase === 2 ? 1060 : 900);
            if (Math.random() < 0.6) G.fx.add({ type: 'drop', x: this.x - this.facing * 30, y: this.y - 70 + U.rand(-20, 20), vx: -this.facing * 200, vy: U.rand(-80, 80), r: 3, life: 0.4, layer: 1 });
            // la nariz se clava en la columna del borde de la arena
            const a = game.arena, stopX = this.facing > 0 ? a.x1 - Arlong.WALL - Arlong.NOSE : a.x0 + Arlong.WALL + Arlong.NOSE;
            if ((this.facing > 0 && this.x + this.vx * dt >= stopX) || (this.facing < 0 && this.x + this.vx * dt <= stopX)) {
              this.x = stopX;
              this.setState('stuck'); this.vx = 0; this.dashStarted = false;
              game.shake(14); G.audio.sfx('stuck');
              G.fx.debris(this.x + this.facing * (Arlong.NOSE + 6), this.y - 80, ['#c8b4a4', '#7d685e'], 12);
              G.fx.text(this.x, this.y - 200, '¡SE HA CLAVADO!', { size: 26, color: '#ffe14a', life: 1.2 });
            } else if (this.stateT > W + 1.6) { this.setState('idle'); this.dashStarted = false; }
          }
          break;
        }
        case 'stuck':
          this.vx = 0;
          if (this.stateT > (this.phase === 2 ? 1.15 : 1.6)) { this.setState('idle'); this.vx = -this.facing * 160; G.audio.sfx('roar'); }
          break;
        case 'bite':
          if (this.stateT < 0.35) { this.vx = 0; this.faceP(game); }
          else if (!this.jumped) {
            this.jumped = true;
            const tx = U.clamp(p.x, game.arena.x0 + 60, game.arena.x1 - 60);
            const T = 0.75;
            this.vx = (tx - this.x) / T; this.vy = -0.5 * GRAV * T;
            G.audio.sfx('jump');
          } else if (this.onGround && this.stateT > 0.5) {
            if (!this.landed) { this.landed = true; this.vx = 0; game.shake(8); G.fx.dust(this.x, this.y, 10); G.audio.sfx('bighit'); }
            if (this.stateT > 1.5) { this.jumped = false; this.landed = false; this.setState('idle'); }
          }
          break;
        case 'uchimizu':
          this.vx = 0; this.faceP(game);
          if (this.stateT > 0.45 && !this.fired) {
            this.fired = true;
            const n = this.phase === 2 ? 5 : 3;
            const sx = this.x + this.facing * 40, sy = this.y - 120;
            const base = Math.atan2(p.y - 50 - sy, p.x - sx);
            for (let i = 0; i < n; i++) {
              const a = base + (i - (n - 1) / 2) * 0.16;
              game.addProjectile({ kind: 'uchimizu', x: sx, y: sy, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, g: 0, r: 7, dmg: 3 });
            }
            G.audio.sfx('spit');
            G.fx.text(sx, sy - 40, '¡UCHIMIZU!', { size: 22, color: '#9fd8ff', life: 0.8 });
          }
          if (this.stateT > 1.0) { this.fired = false; this.setState('idle'); }
          break;
        case 'punch':
          this.vx = this.stateT > 0.3 && this.stateT < 0.42 ? this.facing * 300 : U.approach(this.vx, 0, 2000 * dt);
          if (this.stateT > 0.3 && !this.swung) { this.swung = true; G.audio.sfx('whoosh'); }
          if (this.stateT > 0.85) { this.swung = false; this.setState('idle'); }
          break;
        case 'saw':
          this.vx = this.stateT > 0.5 && this.stateT < 0.65 ? this.facing * 360 : U.approach(this.vx, 0, 2000 * dt);
          if (this.stateT > 0.5 && !this.swung) { this.swung = true; G.audio.sfx('slash'); game.shake(5); }
          if (this.stateT > 1.15) { this.swung = false; this.setState('idle'); }
          break;
        case 'slam':
          if (this.stateT < 0.35) { this.vx = 0; this.faceP(game); }
          else if (!this.jumped) {
            this.jumped = true;
            const tx = U.clamp(p.x, game.arena.x0 + 80, game.arena.x1 - 80);
            const T = 0.9;
            this.vx = (tx - this.x) / T; this.vy = -0.5 * GRAV * T;
            G.audio.sfx('jump');
          } else if (this.onGround && this.stateT > 0.5) {
            if (!this.landed) {
              this.landed = true; this.vx = 0; game.shake(14); G.audio.sfx('explode');
              G.fx.dust(this.x, this.y, 14);
              G.fx.crack(this.x, this.y, 70);
              for (const d of [-1, 1]) game.addProjectile({ kind: 'shock', x: this.x + d * 50, y: this.y, vx: d * 380, vy: 0, g: 0, r: 14, h: 46, dir: d, dmg: 3, life: 2.5 });
            }
            if (this.stateT > 1.6) { this.jumped = false; this.landed = false; this.setState('idle'); }
          }
          break;
        case 'rage':
          this.vx = 0; this.invulnT = 0.2;
          if (this.stateT > 0.9 && !this.sword) {
            this.sword = true; G.audio.sfx('slash'); game.shake(10);
            G.fx.text(this.x, this.y - 220, '¡¡KIRIBACHI!!', { size: 40, color: '#ff6a5a', life: 1.6 });
            G.fx.flash('#fff', 0.3, 0.6);
          }
          if (this.stateT > 1.8) { this.setState('idle'); this.active = true; }
          break;
        case 'hurt':
          this.vx = U.approach(this.vx, 0, 1500 * dt);
          if (this.stateT > 0.18) this.setState('idle');
          break;
        case 'defeated':
          this.vx = U.approach(this.vx, 0, 200 * dt);
          if (Math.random() < 0.15 && this.stateT < 1.5) G.fx.explosion(this.x + U.rand(-40, 40), this.y - U.rand(40, 160), 0.6);
          break;
      }
      if (grav) this.vy = Math.min(1100, this.vy + GRAV * dt); else this.vy = 0;
      G.phys.move(this, dt, game.level);
      if (this.state !== 'sit') this.clampArena(game);
      // fase 2
      if (this.phase === 1 && this.hp <= this.maxHp / 2 && !this.dead && ['idle', 'walk', 'hurt', 'stuck'].includes(this.state)) {
        this.phase = 2; this.active = false; this.setState('rage'); this.vx = 0;
        game.storm = true;
        // respiro antes de la fase final: caen una mandarina de Nami y energía
        const cx = (game.arena.x0 + game.arena.x1) / 2;
        game.spawnPickup(cx - 60, 120, 'mikan');
        game.spawnPickup(cx + 60, 120, 'energy');
        game.say([{ who: 'ARLONG', text: '¡Basta de juegos! ¡Vas a probar el filo de mi KIRIBACHI!', face: 'shout' }]);
      }
    }
    choose(game, dist, fromWalk) {
      const r = Math.random();
      const ph2 = this.phase === 2;
      let s;
      if (dist < 150) s = ph2 ? (r < 0.55 ? 'saw' : r < 0.75 ? 'slam' : 'darts') : (r < 0.5 ? 'punch' : r < 0.75 ? 'bite' : 'darts');
      else if (dist < 380) s = ph2 ? (r < 0.3 ? 'darts' : r < 0.6 ? 'slam' : r < 0.8 ? 'uchimizu' : 'walk') : (r < 0.35 ? 'darts' : r < 0.6 ? 'bite' : r < 0.8 ? 'uchimizu' : 'walk');
      else s = r < 0.45 ? 'darts' : r < 0.75 ? 'uchimizu' : (ph2 ? 'slam' : 'walk');
      if (fromWalk && s === 'walk') s = 'uchimizu';
      if (s === this.lastMove && s !== 'darts' && Math.random() < 0.6) s = 'darts';
      this.lastMove = s;
      this.faceP(game);
      this.setState(s);
      if (s === 'darts') {
        G.audio.sfx('alert');
        G.fx.text(this.x, this.y - 205, '¡SHARK ON DARTS!', { size: 28, color: '#9fd0ff', life: 1.0 });
      }
    }
    onHit(game) {
      if (this.state === 'idle' || this.state === 'walk') { this.setState('hurt'); this.vx = (this.x > game.player.x ? 1 : -1) * 100; }
    }
    counter(game) {
      const dist = Math.abs(game.player.x - this.x);
      const r = Math.random();
      let s;
      if (dist < 160) s = this.phase === 2 ? (r < 0.6 ? 'saw' : 'slam') : (r < 0.6 ? 'punch' : 'bite');
      else s = r < 0.55 ? 'darts' : (this.phase === 2 ? 'slam' : 'bite');
      this.faceP(game);
      this.setState(s);
      if (s === 'darts') { G.audio.sfx('alert'); G.fx.text(this.x, this.y - 205, '¡SHARK ON DARTS!', { size: 28, color: '#9fd0ff', life: 1.0 }); }
    }
    attackBox() {
      const f = this.facing, s = this.stateT;
      if (this.state === 'darts' && this.dashStarted) return { x: f > 0 ? this.x - 60 : this.x - Arlong.NOSE - 30, y: this.y - 100, w: Arlong.NOSE + 90, h: 74, dmg: 4 };
      if (this.state === 'bite' && this.jumped) return { x: f > 0 ? this.x - 20 : this.x - 80, y: this.y - 170, w: 100, h: 150, dmg: 3 };
      if (this.state === 'punch' && s > 0.3 && s < 0.5) return { x: f > 0 ? this.x : this.x - 105, y: this.y - 140, w: 105, h: 60, dmg: 3 };
      if (this.state === 'saw' && s > 0.48 && s < 0.72) return { x: f > 0 ? this.x - 10 : this.x - 175, y: this.y - 200, w: 185, h: 195, dmg: 4 };
      if (this.state === 'slam' && this.jumped && !this.landed) return { x: this.x - 50, y: this.y - 170, w: 100, h: 170, dmg: 3 };
      return null;
    }
    pose() {
      const t = this.t, s = this.stateT;
      let p;
      switch (this.state) {
        case 'sit': p = { hy: 34, torso: -0.55, head: 0.35, aF: -0.6, eF: 1.6, aB: -0.9, eB: 1.8, lF: 1.5, kF: -1.3, lB: 1.3, kB: -1.0 }; break;
        case 'rise': p = s < 0.6 ? { hy: 34 - s * 50, torso: -0.3 + s, head: 0, aF: 0.2, eF: 0.5, aB: -0.2, eB: 0.5, lF: 1.3 - s * 2, kF: -1.3 + s * 2, lB: 1.0 - s * 1.6, kB: -1 + s * 1.5, face: 'shout' } : Object.assign(P.idle(t), { aF: 1.0, eF: -0.4, aB: -1.2, eB: 0.4, face: 'shout', torso: -0.15 }); break;
        case 'walk': p = P.run(t, 0.55); p.torso = 0.15; break;
        case 'darts':
          if (!this.dashStarted) p = { hy: 18, torso: 0.6, head: -0.5, aF: -0.4, eF: 0.6, aB: -0.9, eB: 0.6, lF: 1.1, kF: -1.9, lB: -0.2, kB: -1.0 };
          else p = { hy: -6, torso: 1.45, head: -1.1, aF: 2.4, eF: 0.2, aB: 2.2, eB: 0.2, lF: -0.3 + Math.sin(t * 30) * 0.2, kF: -0.4, lB: -0.5, kB: -0.6 };
          break;
        case 'stuck': p = { hy: -4, torso: 1.3, head: -0.95 + Math.sin(t * 30) * 0.05, aF: 2.0 + Math.sin(t * 18) * 0.5, eF: 0.4, aB: 1.6 + Math.cos(t * 18) * 0.5, eB: 0.4, lF: -0.2 + Math.sin(t * 22) * 0.3, kF: -0.6, lB: -0.6 - Math.sin(t * 22) * 0.3, kB: -0.6, face: 'shout' }; break;
        case 'bite': p = this.jumped && !this.landed ? { torso: 0.5, head: -0.3, aF: 1.9, eF: 0.6, aB: 1.6, eB: 0.6, lF: 1.1, kF: -1.6, lB: 0.6, kB: -1.4, bite: 1, hy: -10 } : Object.assign(P.crouch(), { bite: this.landed ? 1 : 0, face: 'shout' }); break;
        case 'uchimizu': p = s < 0.45 ? { torso: -0.2, head: 0.1, aF: -1.2, eF: 1.2, aB: -0.4, eB: 0.5, lF: 0.4, kF: -0.3, lB: -0.4, kB: -0.1 } : { torso: 0.3, head: -0.1, aF: 1.7, eF: 0, aB: -0.6, eB: 0.5, lF: 0.6, kF: -0.4, lB: -0.5, kB: -0.1, face: 'shout' }; break;
        case 'punch': p = s < 0.3 ? { torso: -0.3, head: 0.15, aF: -1.0, eF: 1.6, aB: 0.6, eB: 0.8, lF: 0.3, kF: -0.3, lB: -0.5, kB: -0.1, face: 'shout' } : { torso: 0.45, head: -0.2, aF: Math.PI / 2, eF: 0, aB: -0.9, eB: 0.6, lF: 0.7, kF: -0.4, lB: -0.6, kB: -0.1, face: 'shout' }; break;
        case 'saw': {
          const k = s < 0.5 ? 0 : Math.min(1, (s - 0.5) / 0.15);
          p = { torso: -0.3 + k * 0.75, head: 0.1 - k * 0.2, aF: Math.PI - 0.2 - k * 2.0, eF: 0.2, aB: -0.6, eB: 0.6, lF: 0.4 + k * 0.4, kF: -0.3, lB: -0.4 - k * 0.2, kB: -0.1, face: 'shout', wA: Math.PI - 0.2 - k * 2.3 };
          break;
        }
        case 'slam': p = this.jumped && !this.landed ? { torso: -0.2, head: 0.1, aF: Math.PI - 0.3, eF: 0.2, aB: 2.2, eB: 0.4, lF: 1.0, kF: -1.6, lB: 0.4, kB: -1.2, face: 'shout', wA: Math.PI - 0.1, hy: -6 } : Object.assign(P.crouch(), { aF: 1.4, eF: 0.1, wA: 1.55, face: 'shout' }); break;
        case 'rage': p = Object.assign(P.idle(t), { torso: -0.2, head: -0.25, aF: s > 0.9 ? 2.8 : 1.2, eF: 0.2, aB: -1.4, eB: 0.6, face: 'shout', wA: 3.0 }); break;
        case 'hurt': p = P.hurt(t); break;
        case 'defeated': p = this.onGround && this.stateT > 0.6 ? P.dead() : P.hurt(t); p.face = 'ko'; break;
        default: p = Object.assign(P.idle(t), { aF: 0.35, eF: 0.6, aB: -0.2, eB: 0.5 });
      }
      p.sword = this.sword && this.state !== 'defeated';
      if (p.sword && p.wA === undefined && this.state !== 'darts' && this.state !== 'stuck') { p.aF = p.aF ?? 0.6; p.wA = 2.2; }
      return p;
    }
    draw(ctx, camX) {
      ctx.save();
      ctx.translate(this.x - camX + this.jitter(), this.y);
      A.shadow(ctx, 34);
      if (this.phase === 2 && !this.dead) this.drawAura(ctx);
      if (this.state === 'darts' && this.dashStarted) this.drawWaterShark(ctx);
      ctx.scale(this.facing * this.scale * this.sq.x, this.scale * (2 - this.sq.x));
      A.flash = this.flashMode();
      A.drawArlong(ctx, this.drawPose(), this.t);
      A.flash = false;
      ctx.restore();
      // destello en la nariz antes del Shark on Darts
      if (this.state === 'darts' && !this.dashStarted) {
        const k = (this.stateT * 6) % 1;
        ctx.save();
        ctx.translate(this.x - camX + this.facing * 70, this.y - 120);
        ctx.globalAlpha = 1 - k;
        A.star(ctx, 0, 0, 12 + k * 10, 3, 4);
        ctx.fillStyle = '#fff'; ctx.fill();
        ctx.restore();
      }
      if (this.state === 'saw' && this.stateT > 0.5 && this.stateT < 0.75) {
        ctx.save();
        ctx.translate(this.x - camX, this.y - 110);
        ctx.scale(this.facing, 1);
        ctx.globalAlpha = 1 - (this.stateT - 0.5) / 0.25;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.arc(20, 0, 120, -1.6, 1.0); ctx.stroke();
        ctx.strokeStyle = '#ff7a6a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(20, 0, 106, -1.4, 0.8); ctx.stroke();
        ctx.restore();
      }
    }
  }
  // aura roja de la segunda fase: lenguas de energía que laten alrededor del cuerpo
  Arlong.prototype.drawAura = function (ctx) {
    if (G.lowFx) return;
    const t = this.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, -95, 10, 0, -95, 130);
    g.addColorStop(0, `rgba(255,60,40,${0.25 + Math.sin(t * 8) * 0.06})`); g.addColorStop(1, 'rgba(255,30,30,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -95, 95, 130, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.32;
      const len = 60 + Math.sin(t * 11 + i * 1.7) * 18 + (i % 2) * 20;
      const bx = Math.cos(a) * 45, by = -90 + Math.sin(a) * 70;
      ctx.fillStyle = `rgba(255,${80 + i * 10},50,.22)`;
      ctx.beginPath();
      ctx.moveTo(bx - 10, by + 10);
      ctx.quadraticCurveTo(bx + Math.cos(a) * len * 0.5 - 8, by + Math.sin(a) * len * 0.5, bx + Math.cos(a) * len, by + Math.sin(a) * len);
      ctx.quadraticCurveTo(bx + Math.cos(a) * len * 0.5 + 8, by + Math.sin(a) * len * 0.5, bx + 10, by + 10);
      ctx.fill();
    }
    ctx.restore();
    if (Math.random() < 0.35) G.fx.add({ type: 'mote', x: this.x + U.rand(-50, 50), y: this.y - U.rand(20, 160), vx: U.rand(-15, 15), vy: -U.rand(60, 120), r: U.rand(1, 2), life: U.rand(0.5, 0.9), color: 'rgba(255,80,50,1)', alpha: 0.9, layer: 1 });
  };
  // tiburón de agua translúcido que envuelve a Arlong durante el Shark on Darts
  Arlong.prototype.drawWaterShark = function (ctx) {
    const f = this.facing, t = this.t;
    ctx.save();
    ctx.scale(f, 1);
    ctx.translate(10, -70);
    ctx.globalAlpha = 0.5;
    ctx.lineJoin = 'round';
    const body = new Path2D();
    body.moveTo(150, 0);
    body.quadraticCurveTo(110, -46, 10, -40);
    body.lineTo(-10, -78); body.lineTo(-30, -36);
    body.quadraticCurveTo(-100, -28, -150, -6);
    body.lineTo(-200, -46 + Math.sin(t * 30) * 6); body.lineTo(-180, 0); body.lineTo(-200, 40 + Math.sin(t * 30) * 6); body.lineTo(-150, 8);
    body.quadraticCurveTo(-60, 40, 20, 36);
    body.quadraticCurveTo(110, 40, 150, 0);
    const g = ctx.createLinearGradient(-200, 0, 150, 0);
    g.addColorStop(0, 'rgba(80,170,240,0)'); g.addColorStop(0.35, 'rgba(90,175,245,.85)'); g.addColorStop(1, 'rgba(200,240,255,.95)');
    ctx.fillStyle = g; ctx.fill(body);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(body);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const y = -24 + i * 16; ctx.beginPath(); ctx.moveTo(-140 + i * 10, y); ctx.lineTo(60 - i * 20, y * 0.8); ctx.stroke(); }
    ctx.restore();
  };
  Arlong.WALL = 34;   // ancho de las columnas que cierran la arena
  Arlong.NOSE = 92;   // distancia del centro a la punta de la nariz en pleno embiste
  G.Arlong = Arlong;
  G.ARENA_WALL = Arlong.WALL;
})();
