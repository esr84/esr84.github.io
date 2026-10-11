'use strict';
// Enemigos comunes, proyectiles, objetos recogibles y decorados rompibles.
(function () {
  const U = G.U, A = G.art, P = A.pose;
  const GRAV = 2100;

  // ================================================================ base
  class Enemy {
    constructor(x, y) {
      this.x = x; this.y = y; this.vx = 0; this.vy = 0;
      this.w = 30; this.h = 88; this.hp = 3; this.facing = -1;
      this.t = Math.random() * 5; this.state = 'idle'; this.stateT = 0;
      this.dead = false; this.remove = false; this.flashT = 0; this.lastHitId = -1;
      this.contact = 2; this.score = 100; this.onGround = false; this.gravity = true;
      this.hitShake = 0; this.sq = { x: 1, v: 0 }; this.dp = null;
    }
    // mezcla suave entre poses + muelle de squash
    animate(dt) {
      this.sq.v += ((1 - this.sq.x) * 420 - this.sq.v * 14) * dt;
      this.sq.x += this.sq.v * dt;
      if (this.hitShake > 0) this.hitShake -= dt;
      if (!this.pose) return;
      this.dp = A.blend(this.dp, this.pose(), 1 - Math.exp(-dt * (this.blendRate || 16)));
    }
    drawPose() { return this.dp || this.pose(); }
    jitter() { return this.hitShake > 0 ? (Math.random() * 2 - 1) * 5 * Math.min(1, this.hitShake / 0.1) : 0; }
    // destello blanco y luego rojo al recibir un golpe
    flashMode() { return this.flashT > 0.06 ? true : this.flashT > 0 ? '#ff7a6a' : false; }
    setState(s) { this.state = s; this.stateT = 0; }
    get alive() { return !this.dead; }
    hurt(atk, game) {
      if (this.dead || atk.id === this.lastHitId) return false;
      this.lastHitId = atk.id;
      this.hp -= atk.dmg;
      this.flashT = 0.12;
      this.sq.x = 0.78; this.sq.v = 0;
      this.dp = null;
      const dir = this.x >= game.player.x ? 1 : -1;
      G.audio.sfx('hit');
      game.hitstop(0.045);
      if (this.hp <= 0) { this.die(game, dir); return true; }
      this.vx = dir * (atk.kb || 150);
      if (this.onGround && atk.kb > 100) this.vy = -160;
      this.onHurt(game);
      return true;
    }
    onHurt() { this.setState('hurt'); }
    die(game, dir) {
      this.dead = true;
      this.setState('dying');
      this.vx = dir * 220; this.vy = -360;
      game.addScore(this.score, this.x, this.y - this.h - 10);
      G.audio.sfx('enemyDie');
      if (Math.random() < 0.18) game.spawnPickup(this.x, this.y - 40, Math.random() < 0.6 ? 'coin' : 'energy');
    }
    updateDying(dt, game) {
      this.flashT = (Math.floor(this.stateT * 30) % 2) ? 0.1 : 0;
      this.vy += GRAV * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.stateT > 0.42) {
        this.remove = true;
        G.fx.explosion(this.x, this.y - this.h / 2, 0.6);
        G.fx.debris(this.x, this.y - this.h / 2, ['#fff', '#ffd84a', '#ff8a3a'], 6);
        G.fx.add({ type: 'ring', x: this.x, y: this.y - this.h / 2, life: 0.35, r0: 10, r1: 70, w: 5, color: '#ffe27a', layer: 1 });
        for (let i = 0; i < 4; i++) G.fx.add({ type: 'spark', x: this.x + U.rand(-30, 30), y: this.y - this.h / 2 + U.rand(-30, 30), life: 0.3, size: 10, points: 5, color: '#fff6c0', edge: '#ffb02e', layer: 1 });
      }
    }
    physics(dt, game) {
      if (this.gravity) this.vy = Math.min(1000, this.vy + GRAV * dt);
      G.phys.move(this, dt, game.level);
    }
    groundAhead(game, dist = 22) {
      return G.phys.groundAt(game.level, this.x + this.facing * dist, this.y + 2);
    }
    box() { return U.box(this); }
    attackBox() { return null; }
  }
  G.Enemy = Enemy;

  // ================================================================ soldado con espada
  class Grunt extends Enemy {
    constructor(x, y, v) {
      super(x, y); this.v = v || 0; this.hp = 4; this.score = 100; this.kind = 'sword';
      this.speed = 80 + v * 6;
    }
    update(dt, game) {
      this.t += dt; this.stateT += dt; if (this.flashT > 0) this.flashT -= dt;
      if (this.state === 'dying') return this.updateDying(dt, game);
      const p = game.player, dx = p.x - this.x, dist = Math.abs(dx);
      switch (this.state) {
        case 'idle':
          this.vx = 0;
          if (dist < 560) this.setState('walk');
          break;
        case 'walk':
          this.facing = dx < 0 ? -1 : 1;
          this.vx = this.facing * this.speed;
          if (!this.groundAhead(game) || dist < 46) this.vx = 0;
          if (dist < 78 && Math.abs(p.y - this.y) < 70 && p.state !== 'dead') {
            this.setState('windup'); G.audio.sfx('alert');
            G.fx.text(this.x, this.y - 112, '!', { size: 34, color: '#ff4a4a', life: 0.4, rise: 8, rot0: 0 });
          }
          break;
        case 'windup':
          this.vx = U.approach(this.vx, 0, 1500 * dt);
          if (this.stateT > 0.36) { this.setState('slash'); G.audio.sfx('slash'); }
          break;
        case 'slash':
          this.vx = this.facing * (this.stateT < 0.1 ? 120 : 0);
          if (this.stateT > 0.24) this.setState('recover');
          break;
        case 'recover':
          this.vx = 0;
          if (this.stateT > 0.65) this.setState('walk');
          break;
        case 'hurt':
          this.vx = U.approach(this.vx, 0, 900 * dt);
          if (this.stateT > 0.28) this.setState('walk');
          break;
      }
      this.physics(dt, game);
      if (this.y > G.H + 100) { this.remove = true; this.dead = true; }
    }
    attackBox() {
      if (this.state === 'slash' && this.stateT > 0.03 && this.stateT < 0.17) {
        return { x: this.facing > 0 ? this.x : this.x - 70, y: this.y - 86, w: 70, h: 64, dmg: 3 };
      }
      return null;
    }
    pose() {
      const s = this.stateT;
      switch (this.state) {
        case 'walk': return Object.assign(P.run(this.t, 0.55), { aF: 0.9, eF: 0.7, wA: 2.3, face: 'angry', torso: 0.12 });
        case 'windup': return { torso: -0.2, head: 0.1, aF: Math.PI - 0.3, eF: 0.3, aB: -0.4, eB: 0.6, lF: 0.4, kF: -0.3, lB: -0.4, kB: -0.1, face: 'angry', wA: Math.PI - 0.1 };
        case 'slash': { const k = Math.min(1, s / 0.1); return { torso: 0.35, head: -0.1, aF: Math.PI - 0.3 - k * 1.9, eF: 0.1, aB: -0.6, eB: 0.6, lF: 0.6, kF: -0.4, lB: -0.5, kB: -0.1, face: 'angry', wA: Math.PI - 0.3 - k * 1.7 }; }
        case 'hurt': case 'dying': return P.hurt(this.t);
        default: return Object.assign(P.idle(this.t), { aF: 0.9, eF: 0.6, wA: 2.4 });
      }
    }
    draw(ctx, camX) {
      ctx.save();
      ctx.translate(this.x - camX + this.jitter(), this.y);
      if (this.state !== 'dying') A.shadow(ctx, 16);
      ctx.scale(this.facing * this.sq.x, 2 - this.sq.x);
      if (this.state === 'dying') ctx.rotate(-this.stateT * 4);
      A.flash = this.flashMode();
      A.drawFishman(ctx, this.drawPose(), this.t, { kind: this.kind, v: this.v });
      A.flash = false;
      ctx.restore();
      if (this.state === 'slash' && this.stateT < 0.2) {
        // arco del tajo
        ctx.save();
        ctx.translate(this.x - camX, this.y - 60);
        ctx.scale(this.facing, 1);
        ctx.globalAlpha = 1 - this.stateT / 0.2;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(10, 0, 52, -1.3, 0.9); ctx.stroke();
        ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(10, 0, 44, -1.1, 0.7); ctx.stroke();
        ctx.restore();
      }
    }
  }
  G.Grunt = Grunt;

  // ================================================================ arponero (desde repisas)
  class Harpooner extends Grunt {
    constructor(x, y, v) {
      super(x, y, v); this.kind = 'harpoon'; this.hp = 3; this.score = 200; this.cd = U.rand(0.8, 1.6);
    }
    update(dt, game) {
      this.t += dt; this.stateT += dt; if (this.flashT > 0) this.flashT -= dt;
      if (this.state === 'dying') return this.updateDying(dt, game);
      const p = game.player, dx = p.x - this.x;
      if (this.state !== 'hurt') this.facing = dx < 0 ? -1 : 1;
      switch (this.state) {
        case 'idle': case 'walk':
          this.vx = 0;
          this.cd -= dt;
          if (this.cd <= 0 && Math.abs(dx) < 620 && Math.abs(dx) > 50) this.setState('aim');
          break;
        case 'aim':
          if (this.stateT > 0.55) {
            this.setState('throw');
            const sx = this.x + this.facing * 20, sy = this.y - 72;
            const tx = p.x, ty = p.y - 50;
            const spd = 430;
            const tt = Math.max(0.35, Math.abs(tx - sx) / spd);
            const g = 500;
            const vy = (ty - sy - 0.5 * g * tt * tt) / tt;
            game.addProjectile({ kind: 'harpoon', x: sx, y: sy, vx: this.facing * spd, vy: U.clamp(vy, -500, 300), g, r: 8, dmg: 3 });
            G.audio.sfx('throw');
          }
          break;
        case 'throw':
          if (this.stateT > 0.5) { this.setState('idle'); this.cd = U.rand(1.6, 2.4); }
          break;
        case 'hurt':
          this.vx = U.approach(this.vx, 0, 900 * dt);
          if (this.stateT > 0.3) this.setState('idle');
          break;
      }
      if (!this.groundAhead(game, 4) && this.onGround) this.vx = 0;
      this.physics(dt, game);
      if (this.y > G.H + 100) { this.remove = true; this.dead = true; }
    }
    attackBox() { return null; }
    pose() {
      switch (this.state) {
        case 'aim': return { torso: -0.25, head: 0.1, aF: Math.PI - 0.5, eF: 0.4, aB: 0.6, eB: 0.3, lF: 0.4, kF: -0.2, lB: -0.4, kB: -0.1, face: 'angry', wA: Math.PI / 2 - 0.2 };
        case 'throw': return { torso: 0.35, head: -0.1, aF: Math.PI / 2 + 0.2, eF: 0, aB: -0.5, eB: 0.4, lF: 0.6, kF: -0.4, lB: -0.5, kB: -0.1, face: 'angry', noWeapon: this.stateT < 0.45 };
        case 'hurt': case 'dying': return P.hurt(this.t);
        default: return Object.assign(P.idle(this.t), { aF: 0.4, eF: 0.4, wA: 2.9 });
      }
    }
  }
  G.Harpooner = Harpooner;

  // ================================================================ saltador de las pozas
  class Leaper extends Enemy {
    constructor(x, y, v, dir) {
      super(x, y); this.v = v; this.hp = 2; this.score = 150;
      this.vy = -1020; this.vx = dir * U.rand(90, 150); this.facing = dir;
      this.state = 'leap'; this.splashed = false; this.spitCd = U.rand(1.2, 2);
    }
    update(dt, game) {
      this.t += dt; this.stateT += dt; if (this.flashT > 0) this.flashT -= dt;
      if (this.state === 'dying') return this.updateDying(dt, game);
      const p = game.player, dx = p.x - this.x;
      const WY = G.Level.WATER_Y;
      if (!this.splashed && this.y < WY + 10) { this.splashed = true; G.fx.splash(this.x, WY, true); G.audio.sfx('splash'); }
      switch (this.state) {
        case 'leap':
          if (this.onGround && this.stateT > 0.2) this.setState('walk');
          if (this.vy > 0 && this.y > WY + 40) { this.remove = true; this.dead = true; G.fx.splash(this.x, WY); }
          break;
        case 'walk':
          this.facing = dx < 0 ? -1 : 1;
          this.vx = this.facing * 60;
          if (!this.groundAhead(game)) this.vx = 0;
          this.spitCd -= dt;
          if (this.spitCd <= 0 && Math.abs(dx) < 520) this.setState('spit');
          break;
        case 'spit':
          this.vx = 0;
          if (this.stateT > 0.35 && !this.spat) {
            this.spat = true;
            game.addProjectile({ kind: 'water', x: this.x + this.facing * 22, y: this.y - 74, vx: this.facing * 300, vy: -220, g: 650, r: 7, dmg: 2 });
            G.audio.sfx('spit');
          }
          if (this.stateT > 0.7) { this.setState('walk'); this.spat = false; this.spitCd = U.rand(2, 3); }
          break;
        case 'hurt':
          this.vx = U.approach(this.vx, 0, 900 * dt);
          if (this.stateT > 0.25) this.setState('walk');
          break;
      }
      this.physics(dt, game);
      if (this.y > G.H + 120) { this.remove = true; this.dead = true; }
    }
    onHurt() { if (this.state !== 'leap') this.setState('hurt'); }
    pose() {
      switch (this.state) {
        case 'leap': return this.vy < 0
          ? { torso: 0.3, head: -0.3, aF: 2.8, eF: 0.1, aB: 2.6, eB: 0.2, lF: 0.1, kF: -0.1, lB: -0.1, kB: -0.2 }
          : { torso: 0.2, head: 0.1, aF: 1.2, eF: 0.5, aB: -1.2, eB: 0.6, lF: 0.6, kF: -0.8, lB: 0.1, kB: -0.5 };
        case 'walk': return Object.assign(P.run(this.t, 0.45), { face: 'angry' });
        case 'spit': return { torso: this.stateT < 0.35 ? -0.3 : 0.3, head: this.stateT < 0.35 ? -0.3 : 0.2, aF: 0.6, eF: 0.8, aB: -0.4, eB: 0.6, lF: 0.4, kF: -0.3, lB: -0.4, kB: -0.1, face: 'angry' };
        default: return P.hurt(this.t);
      }
    }
    draw(ctx, camX) {
      ctx.save();
      ctx.translate(this.x - camX + this.jitter(), this.y);
      ctx.scale(this.facing * this.sq.x, 2 - this.sq.x);
      if (this.state === 'dying') ctx.rotate(-this.stateT * 4);
      A.flash = this.flashMode();
      A.drawFishman(ctx, this.drawPose(), this.t, { kind: 'bare', v: this.v });
      A.flash = false;
      ctx.restore();
    }
  }
  G.Leaper = Leaper;

  // ================================================================ pez volador (onda senoidal)
  class Flyfish extends Enemy {
    constructor(x, y, dir) {
      super(x, y); this.baseY = y; this.dir = dir; this.facing = dir;
      this.w = 34; this.h = 20; this.hp = 1; this.score = 50; this.gravity = false;
      this.vx = dir * 240; this.state = 'fly';
    }
    update(dt, game) {
      this.t += dt; this.stateT += dt; if (this.flashT > 0) this.flashT -= dt;
      if (this.state === 'dying') return this.updateDying(dt, game);
      this.x += this.vx * dt;
      this.y = this.baseY + Math.sin(this.t * 4.2) * 46;
      const cam = game.cam;
      if (this.x < cam.x - 160 || this.x > cam.x + G.W + 160) { this.remove = true; this.dead = true; }
    }
    onHurt() {}
    draw(ctx, camX) {
      ctx.save();
      ctx.translate(this.x - camX, this.y - 10);
      ctx.scale(this.facing, 1);
      ctx.rotate(Math.cos(this.t * 4.2) * 0.35);
      if (this.state === 'dying') ctx.rotate(this.stateT * 8);
      A.flash = this.flashMode();
      A.drawFlyfish(ctx, this.t);
      A.flash = false;
      ctx.restore();
    }
  }
  G.Flyfish = Flyfish;

  // ================================================================ proyectiles
  G.updateProjectile = function (pr, dt, game) {
    pr.t = (pr.t || 0) + dt;
    pr.vy += (pr.g || 0) * dt;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    if ((pr.kind === 'uchimizu' || pr.kind === 'water') && Math.random() < 0.5) G.fx.add({ type: 'drop', x: pr.x - pr.vx * 0.02, y: pr.y - pr.vy * 0.02, vx: pr.vx * 0.1, vy: pr.vy * 0.1 + 40, g: 300, r: 2, life: 0.25, layer: 1 });
    if (pr.kind === 'shock') {
      if (!G.phys.groundAt(game.level, pr.x + pr.dir * 10, pr.y + 2)) pr.dead = true;
      if (Math.random() < 0.5) G.fx.dust(pr.x, pr.y, 1, -pr.dir);
    }
    if (pr.t > (pr.life || 4) || pr.y > G.H + 60 || pr.x < game.cam.x - 200 || pr.x > game.cam.x + G.W + 200) pr.dead = true;
    // choca con muros sólidos
    if (pr.kind !== 'shock') {
      for (const s of game.level.solids) {
        if (pr.x > s.x && pr.x < s.x + s.w && pr.y > s.y && pr.y < s.y + s.h) {
          pr.dead = true;
          if (pr.kind === 'water' || pr.kind === 'uchimizu') G.fx.splash(pr.x, pr.y);
          else if (pr.kind === 'ink') G.fx.inkPuddle(pr.x, s.y, 20);
          else G.fx.dust(pr.x, pr.y, 3);
          break;
        }
      }
    }
  };
  G.projBox = (pr) => pr.kind === 'shock'
    ? { x: pr.x - 14, y: pr.y - (pr.h || 40), w: 28, h: pr.h || 40 }
    : { x: pr.x - pr.r, y: pr.y - pr.r, w: pr.r * 2, h: pr.r * 2 };

  // ================================================================ objetos recogibles
  G.PICKUP_INFO = {
    meat: { text: '¡CARNE!', color: '#ff9a6a' },
    mikan: { text: '¡MANDARINA!', color: '#ffb347' },
    coin: { text: '+500', color: '#ffe14a' },
    berry: { text: '+50', color: '#ffe14a' },
    bigcoin: { text: '+2000', color: '#ffe14a' },
    energy: { text: '+ENERGÍA', color: '#8fe6ff' },
    hat: { text: '¡1UP!', color: '#ffe14a' },
  };
  G.updatePickup = function (it, dt, game) {
    it.t += dt;
    const p = game.player;
    // imán: los objetos cercanos vuelan hacia el jugador
    if (it.t > 0.35 && p && p.state !== 'dead') {
      const dx = p.x - it.x, dy = (p.y - 45) - (it.y - 14), d = Math.hypot(dx, dy);
      if (d < 95 || it.magnet) {
        it.magnet = true;
        const sp = 260 + it.t * 300;
        it.x += dx / (d || 1) * sp * dt; it.y += dy / (d || 1) * sp * dt;
        return;
      }
    }
    if (!it.landed) {
      it.vy = Math.min(700, it.vy + 1400 * dt);
      it.x += (it.vx || 0) * dt;
      const prev = it.y;
      it.y += it.vy * dt;
      const land = (y) => {
        it.y = y;
        if (it.vy > 220) { it.vy = -it.vy * 0.42; it.vx = (it.vx || 0) * 0.6; }
        else { it.landed = true; it.vx = 0; }
      };
      for (const s of game.level.solids) {
        if (it.x > s.x && it.x < s.x + s.w && prev <= s.y && it.y >= s.y) land(s.y);
      }
      for (const q of game.level.oneways) {
        if (it.x > q.x && it.x < q.x + q.w && prev <= q.y && it.y >= q.y) land(q.y);
      }
      if (it.y > G.H + 40) it.dead = true;
    }
    if (it.t > 12) it.dead = true;
  };
  G.drawPickup = function (ctx, it, camX) {
    if (it.t > 9 && Math.floor(it.t * 12) % 2) return;
    ctx.save();
    ctx.translate(it.x - camX, it.y - 14);
    A.drawItem(ctx, it.kind, it.t);
    // destello periódico
    const ph = (it.t * 0.9 + it.x * 0.01) % 1.6;
    if (ph < 0.25 && it.kind !== 'berry') {
      const k = Math.sin(ph / 0.25 * Math.PI);
      ctx.translate(7, -9); ctx.rotate(ph * 3);
      A.star(ctx, 0, 0, 7 * k, 1.6 * k, 4); ctx.fillStyle = '#ffffff'; ctx.fill();
    }
    ctx.restore();
  };

  // ================================================================ rompibles
  G.breakBox = (b) => b.kind === 'lantern' ? { x: b.x - 15, y: b.y - 18, w: 30, h: 36 } : { x: b.x - 16, y: b.y - 52, w: 32, h: 52 };
  G.drawBreakable = function (ctx, b, camX, t) {
    ctx.save();
    ctx.translate(b.x - camX, b.y);
    A.flash = b.flashT > 0;
    if (b.kind === 'lantern') A.drawLantern(ctx, t + b.x);
    else A.drawBrazier(ctx, t + b.x * 0.1);
    A.flash = false;
    ctx.restore();
  };
})();
