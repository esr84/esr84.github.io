'use strict';
// Jugador: Luffy (puño elástico de largo alcance) o Daniela (patadas rápidas, doble salto).
(function () {
  const U = G.U, A = G.art, I = G.input;
  const GRAV = 2250, MAXFALL = 1000;

  const DEFS = {
    luffy: {
      name: 'LUFFY', dims: A.LUFFY_DIMS, draw: 'drawLuffy',
      speed: 240, jump: 840, dj: 0, maxHp: 16,
      attackT: 0.40, special: 'GATLING', specialT: 0.9,
      trail: ['rgba(255,255,255,.8)', 'rgba(255,214,150,.75)'],
    },
    daniela: {
      name: 'DANIELA', dims: A.DANI_DIMS, draw: 'drawDaniela',
      speed: 268, jump: 820, dj: 690, maxHp: 16,
      attackT: 0.28, special: 'MOUTON', specialT: 0.46,
      trail: ['rgba(255,255,255,.85)', 'rgba(255,150,60,.8)'],
    },
  };
  G.PLAYER_DEFS = DEFS;

  // muelle amortiguado genérico
  function spring(o, target, k, d, dt) {
    o.v += ((target - o.x) * k - o.v * d) * dt;
    o.x += o.v * dt;
  }

  class Player {
    constructor(kind) {
      this.kind = kind;
      this.def = DEFS[kind];
      this.name = this.def.name;
      this.w = 28; this.h = 92;
      this.maxHp = this.def.maxHp;
      this.hp = this.maxHp;
      this.energy = 20; this.maxEnergy = 50;
      this.reset(120, G.Level.GY);
    }
    reset(x, y) {
      this.x = x; this.y = y; this.vx = 0; this.vy = 0;
      this.facing = 1; this.state = 'normal'; this.stateT = 0; this.t = 0;
      this.invuln = 0; this.coyote = 0; this.jumpBuf = 0; this.atkBuf = 0; this.jumpsLeft = 1;
      this.onGround = true; this.dropping = 0; this.crouch = false;
      this.hitId = 0; this.combo = 0; this.queued = false; this.hitConfirm = false;
      this.lastSafeX = x; this.lastSafeY = y;
      this.smokeT = 0; this.stepT = 0; this.hurtFlash = 0;
      this.pose = A.pose.idle(0); this.dpose = null; this.J = null;
      this.auto = 0;
      this.hp = this.maxHp;
      // animación secundaria
      this.sq = { x: 1, v: 0 };          // escala horizontal (squash & stretch)
      this.sqy = { x: 1, v: 0 };         // escala vertical
      this.hat = { x: 0, v: 0 }; this.hatL = { x: 0, v: 0 };
      this.sway = { x: 0, v: 0 };
      this.landT = 0; this.skidT = 0; this.skidDir = 0; this.idleT = 0;
      this.trail = []; this.ghosts = []; this.ghostT = 0;
    }
    setState(s) { this.state = s; this.stateT = 0; }
    newHit() { this.hitId = ++G.hitCounter; this.hitConfirm = false; }
    squash(sx, sy) { this.sq.x = sx; this.sqy.x = sy; this.sq.v = 0; this.sqy.v = 0; }

    // ------------------------------------------------------------ actualización
    update(dt, game) {
      const ctrl = game.controlsEnabled();
      this.t += dt; this.stateT += dt;
      if (this.invuln > 0) this.invuln -= dt;
      if (this.hurtFlash > 0) this.hurtFlash -= dt;
      if (this.dropping > 0) this.dropping -= dt;
      if (this.landT > 0) this.landT -= dt;
      const L = this.kind === 'luffy';
      const inL = ctrl && I.held.left, inR = ctrl && I.held.right, inD = ctrl && I.held.down;
      const pJump = ctrl && I.pressed.jump, hJump = ctrl && I.held.jump;
      const pSpc = ctrl && I.pressed.special;
      if (pJump) this.jumpBuf = 0.12; else this.jumpBuf -= dt;
      if (ctrl && I.pressed.attack) this.atkBuf = 0.16; else this.atkBuf -= dt;
      const wasGround = this.onGround;
      let grav = true;
      const dirIn = (inR ? 1 : 0) - (inL ? 1 : 0);

      switch (this.state) {
        case 'normal': {
          let dir = dirIn;
          if (!ctrl && this.auto) dir = this.auto;
          this.crouch = inD && this.onGround;
          // derrape al invertir la marcha a toda velocidad
          if (this.onGround && dir && this.skidT <= 0 && Math.sign(this.vx) === -dir && Math.abs(this.vx) > 150) {
            this.skidT = 0.16; this.skidDir = dir;
            G.fx.dust(this.x + Math.sign(this.vx) * 10, this.y, 5, Math.sign(this.vx));
            G.audio.sfx('step');
          }
          if (this.skidT > 0) {
            this.skidT -= dt;
            if (this.skidT <= 0 || Math.sign(this.vx) !== -this.skidDir) { this.skidT = 0; this.facing = this.skidDir; }
            if (Math.random() < 0.5) G.fx.dust(this.x + this.facing * 8, this.y, 1, this.facing);
          } else if (dir) this.facing = dir;
          const target = this.crouch ? 0 : dir * this.def.speed;
          const acc = this.onGround ? (this.skidT > 0 ? 1700 : 2600) : 2300;
          this.vx = U.approach(this.vx, target, acc * dt);
          // salto / bajar de plataforma
          if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
            this.jumpBuf = 0;
            if (inD && this.groundRef && !this.groundRef.kind) {
              this.dropping = 0.22; this.onGround = false; this.y += 2;
            } else this.doJump();
          } else if (this.jumpBuf > 0 && !this.onGround && this.def.dj && this.jumpsLeft > 0) {
            this.jumpBuf = 0; this.jumpsLeft--;
            this.vy = -this.def.dj; G.audio.sfx('djump');
            this.squash(0.8, 1.22);
            G.fx.add({ type: 'ring', x: this.x, y: this.y, life: 0.3, r0: 6, r1: 38, w: 3, color: '#fff', layer: 1, sy: 0.35 });
            G.fx.dust(this.x, this.y + 4, 3);
          }
          if (!hJump && this.vy < -320) this.vy = -320;           // salto variable
          if (this.atkBuf > 0) {
            this.atkBuf = 0;
            if (!this.onGround && inD) {
              this.setState('stomp'); this.newHit(); this.vy = -180; G.audio.sfx(L ? 'stretch' : 'whoosh'); this.squash(1.15, 0.9);
              G.fx.text(this.x, this.y - 140, L ? '¡GOMU GOMU NO... ONO!' : '¡CONCASSÉ!', { size: 22, color: '#ffe14a', life: 0.7, rise: 8 });
            }
            else this.startAttack(0);
          } else if (pSpc) {
            if (this.energy >= 10) this.startSpecial(game);
            else { G.fx.text(this.x, this.y - 120, 'SIN ENERGÍA', { size: 18, color: '#9fd8ff', life: 0.7 }); G.audio.sfx('select'); }
          }
          break;
        }
        case 'attack': {
          const T = this.attackLen();
          if (this.onGround) this.vx = U.approach(this.vx, 0, 2200 * dt);
          else this.vx = U.approach(this.vx, dirIn * this.def.speed * 0.8, 900 * dt);
          if (!L && this.combo === 2 && this.stateT > 0.05 && this.stateT < 0.12 && this.onGround) this.vx = this.facing * 260;
          if (!hJump && this.vy < -320) this.vy = -320;
          // permite girarse justo al empezar el golpe
          if (this.stateT < 0.04 && dirIn && dirIn !== this.facing) this.facing = dirIn;
          if (this.atkBuf > 0 && this.stateT > (L ? 0.16 : 0.08)) { this.queued = true; this.atkBuf = 0; }
          // cancelar la recuperación con un salto tras acertar
          if (this.jumpBuf > 0 && this.onGround && this.stateT > 0.14 && (this.hitConfirm || this.stateT > T * 0.75)) {
            this.jumpBuf = 0; this.setState('normal'); this.doJump(); break;
          }
          const maxCombo = L ? 99 : 2;
          const early = this.hitConfirm ? (L ? 0.28 : 0.15) : T;
          if (this.queued && this.stateT >= early && this.combo < maxCombo) {
            this.startAttack(this.combo + 1);
          } else if (this.stateT >= T) this.setState('normal');
          break;
        }
        case 'stomp': {
          if (this.stateT > 0.12) { this.vy = 1000; }
          this.vx = U.approach(this.vx, 0, 1500 * dt);
          if (this.onGround && this.stateT > 0.05) {
            this.setState('normal');
            this.squash(1.35, 0.7); this.landT = 0.14;
            G.fx.crack(this.x, this.y, 34);
            G.fx.dust(this.x - 10, this.y, 5, -1); G.fx.dust(this.x + 10, this.y, 5, 1);
            G.fx.add({ type: 'ring', x: this.x, y: this.y, life: 0.3, r0: 8, r1: 60, w: 5, color: '#fff2c0', layer: 1, sy: 0.3 });
            G.audio.sfx('land'); game.shake(6);
          }
          break;
        }
        case 'special': {
          if (L) {
            if (this.onGround) this.vx = U.approach(this.vx, 0, 2400 * dt);
            if (this.stateT > 0.12 && Math.floor(this.stateT / 0.1) !== Math.floor((this.stateT - dt) / 0.1)) {
              this.newHit(); G.audio.sfx('whoosh');
              G.fx.text(this.x + this.facing * U.rand(60, 150), this.y - U.rand(55, 115), U.choose(['¡DA!', '¡DADA!', '¡DADADA!']), { size: U.rand(18, 26), color: U.choose(['#fff', '#ffe27a']), life: 0.35, rise: 12, layer: 2 });
            }
            if (this.stateT > 0.15 && Math.random() < 0.5) G.fx.speedLines(-this.facing, 1, 'rgba(255,255,255,.8)');
          } else {
            grav = false;
            if (this.stateT < 0.1) { this.vx = 0; this.vy = 0; }
            else if (this.stateT < 0.42) {
              this.vx = this.facing * 780; this.vy = 0;
              if (Math.random() < 0.7) G.fx.add({ type: 'flame', x: this.x - this.facing * 10, y: this.y - 50 + U.rand(-10, 10), vx: -this.facing * 120, r: U.rand(10, 18), life: 0.3, layer: 0 });
              this.ghostT -= dt;
              if (this.ghostT <= 0) { this.ghostT = 0.035; this.ghosts.push({ x: this.x, y: this.y, pose: this.dpose || this.pose, f: this.facing, life: 0.22, t: 0 }); }
            } else this.vx = U.approach(this.vx, 0, 3000 * dt);
          }
          if (this.stateT >= this.def.specialT) this.setState('normal');
          break;
        }
        case 'hurt': {
          if (this.onGround && this.stateT > 0.3) { this.setState('normal'); this.vx = 0; }
          break;
        }
        case 'dead': {
          this.vx = U.approach(this.vx, 0, 400 * dt);
          if (this.stateT > 2.2 && !this.deadNotified) { this.deadNotified = true; game.onPlayerDead(); }
          break;
        }
      }

      if (grav) { this.vy = Math.min(MAXFALL, this.vy + GRAV * dt); }
      const vyBefore = this.vy;
      G.phys.move(this, dt, game.level);

      if (this.onGround) {
        this.coyote = 0.09; this.jumpsLeft = 1;
        if (!wasGround && vyBefore > 300) {
          const k = U.clamp((vyBefore - 300) / 700, 0, 1);
          this.squash(1 + 0.3 * k, 1 - 0.28 * k);
          if (this.state === 'normal' && Math.abs(this.vx) < 80) this.landT = 0.13 * (0.5 + k);
          G.audio.sfx('land'); G.fx.dust(this.x, this.y, 3 + Math.round(k * 5));
          if (k > 0.7) game.shake(3);
        }
        const lv = game.level;
        if (G.phys.groundAt(lv, this.x - 48, this.y + 1) && G.phys.groundAt(lv, this.x + 48, this.y + 1) && this.state !== 'hurt') {
          this.lastSafeX = this.x; this.lastSafeY = this.y;
        }
        if (this.state === 'normal' && Math.abs(this.vx) > 60) {
          this.stepT += dt;
          if (this.stepT > 0.24) { this.stepT = 0; G.fx.dust(this.x - this.facing * 8, this.y, 1, -this.facing); }
        }
      } else this.coyote -= dt;

      // límites: no se puede salir de la pantalla (como en Castlevania)
      const cam = game.cam;
      this.x = U.clamp(this.x, cam.x + 16, cam.x + G.W - 16);
      if (game.arena) this.x = U.clamp(this.x, game.arena.x0 + G.ARENA_WALL + 15, game.arena.x1 - G.ARENA_WALL - 15);

      // caída al agua
      if (this.y > G.H + 40 && this.state !== 'dead') game.playerFell(this);

      // reposo prolongado (animaciones de espera)
      const idle = this.state === 'normal' && this.onGround && Math.abs(this.vx) < 5 && !this.crouch && ctrl && !dirIn;
      this.idleT = idle ? this.idleT + dt : 0;

      // animación secundaria por muelles
      spring(this.sq, 1, 420, 15, dt); spring(this.sqy, 1, 420, 15, dt);
      spring(this.hat, U.clamp(-this.vx / 240 * 0.16 - (this.vy < 0 ? 0.06 : 0), -0.3, 0.3), 140, 9, dt);
      spring(this.hatL, this.vy > 250 ? Math.min(7, (this.vy - 250) / 90) : 0, 160, 11, dt);
      spring(this.sway, U.clamp(-this.vx / 268 + this.vy / 1400, -1.2, 1.2), 90, 7, dt);

      // pose objetivo (para golpes) y pose dibujada (mezclada)
      this.pose = this.computePose();
      this.J = A.solve(this.pose, this.def.dims);
      const fast = this.state === 'attack' || this.state === 'special' || this.state === 'stomp' || this.state === 'hurt';
      this.dpose = A.blend(this.dpose, this.pose, 1 - Math.exp(-dt * (fast ? 40 : 17)));

      // estelas de golpe (cinta que sigue al puño o al pie)
      const tip = this.attackTip();
      if (tip) this.trail.push({ x: this.x + tip.x * this.facing, y: this.y + tip.y, t: this.t });
      while (this.trail.length && (this.t - this.trail[0].t > 0.09 || this.trail.length > 9)) this.trail.shift();
      for (const g of this.ghosts) g.t += dt;
      this.ghosts = this.ghosts.filter((g) => g.t < g.life);

      // humo del cigarro de Daniela
      if (!L && this.state !== 'dead' && !this.pose.noCig) {
        this.smokeT -= dt;
        if (this.smokeT <= 0) {
          this.smokeT = 0.16;
          const JJ = A.solve(this.dpose, this.def.dims);
          const tp = A.headPoint(JJ, 19, -5.2);
          G.fx.smoke(this.x + tp.x * this.facing * this.sq.x, this.y + tp.y * this.sqy.x);
        }
      }
    }

    doJump() {
      this.vy = -this.def.jump; this.onGround = false; this.coyote = 0;
      this.squash(0.78, 1.25);
      G.audio.sfx('jump'); G.fx.dust(this.x, this.y, 4);
    }
    attackLen() {
      if (this.kind === 'luffy') return this.def.attackT;
      return this.combo === 2 ? 0.36 : this.def.attackT;
    }
    startAttack(combo) {
      const L = this.kind === 'luffy';
      this.setState('attack'); this.newHit();
      this.combo = combo; this.queued = false;
      G.audio.sfx(L ? 'stretch' : 'kick');
      if (!L && combo > 0) this.vx = this.facing * 110;
    }

    startSpecial(game) {
      this.energy -= 10;
      this.setState('special'); this.newHit();
      G.audio.sfx('special');
      game.hitstop(0.1);
      game.focusLines(0.55);
      game.punchZoom(0.07, this.x, this.y - 60);
      if (this.kind === 'luffy') {
        G.fx.text(this.x + this.facing * 40, this.y - 140, '¡GOMU GOMU NO... GATLING!', { size: 30, color: '#ffe14a', life: 1.1, rise: 10 });
      } else {
        G.fx.text(this.x + this.facing * 40, this.y - 140, '¡MOUTON SHOT!', { size: 34, color: '#ff9a3a', life: 1.0, rise: 10 });
        this.invuln = Math.max(this.invuln, 0.5);
      }
      G.fx.speedLines(-this.facing, 14);
    }

    // ------------------------------------------------------------ poses
    computePose() {
      const P = A.pose, t = this.t, s = this.stateT, L = this.kind === 'luffy';
      let p;
      if (this.victory && this.onGround) {
        return L
          ? Object.assign(P.idle(t), { aF: Math.PI - 0.25 + Math.sin(t * 6) * 0.08, eF: 0.1, aB: -0.5, eB: 0.4, face: 'grin', head: -0.2, torso: -0.05, hatRot: Math.sin(t * 6) * 0.05 })
          : Object.assign(P.idle(t), { aF: 1.9, eF: 1.6, aB: -0.2, eB: 0.85, pocketB: 1, face: 'heart', head: -0.1 });
      }
      switch (this.state) {
        case 'dead': p = this.onGround ? P.dead() : P.hurt(t); break;
        case 'hurt': p = P.hurt(t); break;
        case 'stomp':
          p = s < 0.12
            ? { torso: -0.35, head: 0.3, aF: 2.9, eF: 0.2, aB: -2.7, eB: 0.3, lF: 2.7, kF: -0.1, lB: 0.9, kB: -1.6, hy: -8, face: 'shout' }
            : { torso: 0.15, head: 0.1, aF: 2.4, eF: 0.4, aB: -2.4, eB: 0.4, lF: 0.1, kF: 0, lB: 0.9, kB: -1.7, hy: -4, face: 'shout' };
          // Luffy estira la pierna hacia el cielo antes del hachazo
          if (L) { p.stretchL = s < 0.12 ? 70 * U.easeOutCubic(s / 0.12) : 16; if (s < 0.12) { p.lF = 3.0; p.kF = 0; } }
          break;
        case 'attack':
          p = L ? this.luffyAttackPose(s) : this.daniAttackPose(s);
          break;
        case 'special':
          p = L ? this.luffyGatlingPose(s) : this.daniMoutonPose(s);
          break;
        default:
          if (!this.onGround) p = P.jump(this.vy);
          else if (this.skidT > 0) p = P.skid();
          else if (this.crouch) p = P.crouch();
          else if (Math.abs(this.vx) > 30) p = P.run(t, L ? 1 : 1.1);
          else p = this.idlePose(t);
          if (this.landT > 0 && this.onGround && !this.crouch) p = A.blend(p, P.land(), U.clamp(this.landT / 0.1, 0, 1));
          if (!L && !this.onGround && this.jumpsLeft === 0 && this.vy < 0) {
            // voltereta del doble salto
            p = { torso: 0.55, head: 0.35, aF: 1.2, eF: 1.3, aB: 0.8, eB: 1.4, lF: 1.7, kF: -2.3, lB: 1.4, kB: -2.1, hy: -12 };
          }
      }
      if (this.crouch && this.state === 'attack') p.hy = Math.max(p.hy || 0, 20);
      // movimiento secundario
      p.hatRot = (p.hatRot || 0) + this.hat.x;
      p.hatLift = this.hatL.x;
      p.hairSway = this.sway.x;
      if (!L) p.flap = (p.flap || 0) + U.clamp(Math.abs(this.vx) / this.def.speed, 0, 1) * (0.55 + 0.45 * Math.sin(t * 16)) + U.clamp(-this.vy / 900, 0, 0.6);
      return p;
    }
    idlePose(t) {
      const P = A.pose, L = this.kind === 'luffy';
      const p = P.idle(t);
      const cyc = this.idleT % 6;
      if (L) {
        // Luffy se recoloca el sombrero de vez en cuando
        if (this.idleT > 3 && cyc > 4.2 && cyc < 5.2) {
          const k = Math.sin((cyc - 4.2) / 1.0 * Math.PI);
          Object.assign(p, { aF: 0.22 + k * 2.45, eF: 0.45 + k * 0.5, head: -0.02 - k * 0.12, hatRot: -k * 0.12, face: 'grin' });
        }
        return p;
      }
      // Daniela: manos en los bolsillos; de vez en cuando da una calada
      Object.assign(p, { aF: -0.05, eF: 0.75, aB: -0.2, eB: 0.85, pocketF: 1, pocketB: 1, torso: -0.03, head: 0.02 });
      if (this.idleT > 2 && cyc > 3.6 && cyc < 4.5) {
        const k = Math.sin((cyc - 3.6) / 0.9 * Math.PI);
        Object.assign(p, { aF: -0.05 + k * 0.85, eF: 0.75 + k * 1.7, pocketF: k < 0.35 ? 1 : 0, head: 0.02 - k * 0.12 });
      }
      if (this.idleT > 2 && cyc > 4.5 && cyc < 4.52 && !this.puffed) {
        this.puffed = true;
        const tp = A.headPoint(A.solve(p, this.def.dims), 14, -4);
        for (let i = 0; i < 5; i++) G.fx.add({ type: 'smoke', x: this.x + tp.x * this.facing, y: this.y + tp.y, vx: this.facing * U.rand(20, 60), vy: -U.rand(10, 30), r: U.rand(3, 5), life: U.rand(1.2, 1.8), seed: Math.random() * 9 });
      }
      if (cyc < 4.5) this.puffed = false;
      return p;
    }
    luffyAttackPose(s) {
      const crouch = this.crouch, air = !this.onGround;
      let st = 0, sag = 0;
      const ant = s < 0.05;
      if (ant) st = 0;
      else if (s < 0.13) st = U.easeOutCubic((s - 0.05) / 0.08) * 155;
      else if (s < 0.21) st = 155 + Math.sin((s - 0.13) * 90) * 3;
      else if (s < 0.33) { const k = (s - 0.21) / 0.12; st = 155 * (1 - U.smooth(k)); sag = Math.sin(k * Math.PI * 3) * (1 - k) * 11; }
      this.reach = st;
      const back = this.combo % 2 === 1;
      const p = {
        torso: ant ? -0.12 : 0.24, head: ant ? 0.05 : -0.2,
        lF: air ? 1.0 : (crouch ? 1.25 : 0.6), kF: air ? -1.3 : (crouch ? -2.35 : -0.4),
        lB: air ? 0.1 : (crouch ? 0.55 : -0.5), kB: air ? -0.7 : (crouch ? -2.0 : -0.1),
        hy: crouch ? 20 : 3, face: 'angry',
      };
      const punchA = Math.PI / 2 - (crouch ? 0.05 : 0.02);
      if (back) Object.assign(p, { aB: ant ? -0.6 : punchA, eB: ant ? 1.7 : 0, stretchB: st, sagB: sag, aF: 0.5, eF: 1.6 });
      else Object.assign(p, { aF: ant ? -0.6 : punchA, eF: ant ? 1.7 : 0, stretchF: st, sagF: sag, aB: -0.6, eB: 1.2 });
      return p;
    }
    daniAttackPose(s) {
      const k = this.combo, air = !this.onGround;
      const T = this.attackLen();
      const ext = s < 0.05 ? 0 : s < 0.09 ? (s - 0.05) / 0.04 : s < 0.17 ? 1 : Math.max(0, 1 - (s - 0.17) / (T - 0.17));
      const chamber = s < 0.05 ? s / 0.05 : 1 - ext;
      if (air) {
        return { torso: -0.35, head: 0.25, aF: -1.0, eF: 0.6, aB: -1.6, eB: 0.5, lF: 0.8 + ext * 0.95, kF: -1.6 * (1 - ext), lB: 0.6, kB: -1.8, frontLegLast: 1, face: 'angry', hy: -4 };
      }
      if (this.crouch) {
        // barrido bajo
        return { hy: 24, torso: 0.35, head: -0.2, aF: 0.9, eF: 0.6, aB: -0.4, eB: 0.8, lF: 0.5 + ext * 1.1, kF: -0.4 * (1 - ext), lB: 0.6, kB: -2.2, frontLegLast: 1, face: 'angry' };
      }
      if (k === 0) {
        // patada alta (Collier Shoot): recoge la rodilla y la dispara
        return { torso: -0.1 - ext * 0.4, head: 0.1 + ext * 0.22, aF: -0.7 - ext * 0.3, eF: 0.6, aB: -1.3, eB: 0.4,
          lF: 0.5 + chamber * 0.8 + ext * 1.5, kF: -2.0 * chamber * (1 - ext), lB: -0.12, kB: -0.1, frontLegLast: 1, face: 'angry', hy: -ext * 2 };
      }
      if (k === 1) {
        // giro con patada horizontal (Épaule Shoot)
        return { torso: -0.55 * ext - 0.05, head: 0.38 * ext, aF: -1.5, eF: 0.4, aB: -2.3, eB: 0.3, lF: 0.5 + chamber * 0.5 + ext * 1.15, kF: -1.6 * chamber * (1 - ext), lB: -0.25, kB: -0.15, frontLegLast: 1, face: 'shout', hy: -2 };
      }
      // patada frontal potente (Poitrine Shoot)
      return { torso: 0.15 - ext * 0.45, head: 0.1, aF: -1.1, eF: 0.8, aB: 0.6, eB: 1.0, lF: 0.9 + chamber * 0.6 + ext * 0.75, kF: -2.2 * chamber * (1 - ext), lB: -0.45, kB: -0.2, frontLegLast: 1, face: 'shout', hy: -3, fire: ext > 0.5 };
    }
    luffyGatlingPose(s) {
      return { torso: 0.25, head: -0.2, aF: Math.PI / 2, eF: 0, stretchF: 40 + Math.abs(Math.sin(s * 40)) * 90, aB: Math.PI / 2 - 0.3, eB: 0.2, stretchB: 30 + Math.abs(Math.cos(s * 40)) * 60,
        lF: 0.65, kF: -0.35, lB: -0.55, kB: -0.1, gatling: s > 0.1, face: 'shout', hy: 4 };
    }
    daniMoutonPose(s) {
      if (s < 0.1) return { torso: 0.45, head: -0.25, aF: -0.6, eF: 1, aB: -1, eB: 1, lF: 1.7, kF: -2.5, lB: 0.2, kB: -0.8, hy: 8, face: 'angry', frontLegLast: 1 };
      return { torso: -0.55, head: 0.45, aF: -1.6, eF: 0.4, aB: -2.2, eB: 0.4, lF: Math.PI / 2 + 0.05, kF: 0, lB: 0.3, kB: -1.6, frontLegLast: 1, face: 'shout', fire: true, hy: -10 };
    }

    // ------------------------------------------------------------ golpes
    // punta del golpe (para la estela), en coordenadas locales
    attackTip() {
      const J = this.J, s = this.stateT;
      if (!J) return null;
      if (this.state === 'attack') {
        if (this.kind === 'luffy') return this.reach > 40 ? (this.combo % 2 ? J.haB : J.haF) : null;
        return s > 0.04 && s < 0.2 ? J.ftF : null;
      }
      if (this.state === 'special' && this.kind === 'daniela' && s > 0.1 && s < 0.42) return J.ftF;
      return null;
    }
    // Devuelve la caja de ataque activa en coordenadas del mundo, o null.
    attackBox() {
      const J = this.J; if (!J) return null;
      const s = this.stateT, f = this.facing, L = this.kind === 'luffy';
      const seg = (a, b, r) => {
        const x1 = this.x + a.x * f, y1 = this.y + a.y, x2 = this.x + b.x * f, y2 = this.y + b.y;
        return { x: Math.min(x1, x2) - r, y: Math.min(y1, y2) - r, w: Math.abs(x2 - x1) + r * 2, h: Math.abs(y2 - y1) + r * 2 };
      };
      if (this.state === 'attack') {
        if (L) {
          const back = this.combo % 2 === 1;
          if (s > 0.06 && s < 0.26 && this.reach > 30) return { box: back ? seg(J.elB, J.haB, 13) : seg(J.elF, J.haF, 13), dmg: 3, id: this.hitId, kb: 170 };
        } else if (s > 0.05 && s < 0.19) {
          const k = this.combo;
          return { box: seg(J.knF, J.ftF, 15), dmg: k === 2 ? 3 : 2, id: this.hitId, kb: k === 2 ? 320 : k === 1 ? 230 : 150 };
        }
      } else if (this.state === 'stomp') {
        return { box: { x: this.x - 22, y: this.y - 26, w: 44, h: 34 }, dmg: 3, id: this.hitId, kb: 80, stomp: true };
      } else if (this.state === 'special') {
        if (L && s > 0.1) return { box: { x: f > 0 ? this.x + 4 : this.x - 150, y: this.y - 104, w: 146, h: 64 }, dmg: 1, id: this.hitId, kb: 60, multi: true };
        if (!L && s > 0.08 && s < 0.44) return { box: seg(J.hipF, J.ftF, 20), dmg: 4, id: this.hitId, kb: 380 };
      }
      return null;
    }
    onHitSomething(target, atk, game) {
      this.hitConfirm = true;
      if (atk.stomp) {
        this.vy = -640; this.setState('normal');
        this.squash(1.2, 0.85);
        G.fx.text(this.x, this.y - 30, this.kind === 'luffy' ? '¡ONO!' : '¡CONCASSÉ!', { size: 24, color: '#ffd84a', life: 0.6 });
      }
    }
    damage(dmg, srcX, game) {
      if (this.invuln > 0 || this.state === 'dead') return false;
      if (game.godMode) return false;
      this.hp = Math.max(0, this.hp - dmg);
      G.audio.sfx('hurt');
      game.shake(9); game.hitstop(0.08);
      game.onPlayerHurt(dmg);
      G.fx.hit(this.x, this.y - 60, false);
      this.hurtFlash = 0.16;
      const dir = srcX < this.x ? 1 : -1;
      this.facing = -dir;
      this.squash(0.8, 1.15);
      if (this.hp <= 0) {
        this.setState('dead'); this.deadNotified = false;
        this.vy = -500; this.vx = dir * 160; this.invuln = 99;
        G.fx.text(this.x, this.y - 130, this.kind === 'luffy' ? '¡UAAAH!' : '¡NAMI-SAAAN!', { size: 26, color: '#ff6a5a', life: 1.4 });
        game.impact(0.08);
        game.slowmo(0.9, 0.35);
        game.focusLines(0.6);
        return true;
      }
      this.setState('hurt');
      this.vy = -400; this.vx = dir * 230; this.invuln = 1.4;
      return true;
    }
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

    // ------------------------------------------------------------ dibujo
    draw(ctx, camX, game) {
      const draw = A[this.def.draw];
      // imágenes residuales (Mouton Shot)
      for (const g of this.ghosts) {
        ctx.save();
        ctx.globalAlpha = 0.45 * (1 - g.t / g.life);
        ctx.translate(g.x - camX, g.y); ctx.scale(g.f, 1);
        A.flash = '#ff9a4a';
        draw(ctx, g.pose, this.t);
        A.flash = false;
        ctx.restore();
      }
      const blink = this.invuln > 0 && this.state !== 'hurt' && this.state !== 'dead' && this.state !== 'special' && Math.floor(this.t * 22) % 2 === 0;
      if (!blink) {
        ctx.save();
        ctx.translate(this.x - camX, this.y);
        // sombra en el suelo
        const gy = G.reflecting ? null : game.groundBelow(this.x, this.y);
        if (gy !== null) {
          ctx.save(); ctx.translate(0, gy - this.y);
          const k = U.clamp(1 - (gy - this.y) / 260, 0.3, 1);
          A.shadow(ctx, 18 * k * this.sq.x, 0.32 * k);
          ctx.restore();
        }
        ctx.scale(this.facing * this.sq.x, this.sqy.x);
        if (this.hurtFlash > 0) A.flash = Math.floor(this.hurtFlash * 30) % 2 ? '#ff5a5a' : '#ffffff';
        draw(ctx, this.dpose || this.pose, this.t);
        A.flash = false;
        ctx.restore();
      }
      if (!G.reflecting) this.drawTrail(ctx, camX);
      // estrellas de K.O. girando sobre la cabeza
      if (this.state === 'dead' && this.onGround && !G.reflecting) {
        for (let i = 0; i < 3; i++) {
          const a = this.t * 5 + i * 2.1;
          ctx.save();
          ctx.translate(this.x - camX - this.facing * 30 + Math.cos(a) * 22, this.y - 34 + Math.sin(a) * 6);
          A.star(ctx, 0, 0, 7, 3, 5);
          ctx.fillStyle = '#ffe14a'; ctx.fill(); ctx.strokeStyle = A.OUT; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.restore();
        }
      }
    }
    // cinta de movimiento (smear) que sigue al puño o al pie
    drawTrail(ctx, camX) {
      const tr = this.trail;
      if (tr.length < 3) return;
      const n = tr.length, W = this.kind === 'luffy' ? 9 : 13;
      const left = [], right = [];
      for (let i = 0; i < n; i++) {
        const a = tr[Math.max(0, i - 1)], b = tr[Math.min(n - 1, i + 1)];
        let dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const w = W * (i / (n - 1));
        left.push([tr[i].x - camX - dy * w, tr[i].y + dx * w]);
        right.push([tr[i].x - camX + dy * w, tr[i].y - dx * w]);
      }
      ctx.save();
      for (let pass = 0; pass < 2; pass++) {
        ctx.beginPath();
        const sc = pass ? 0.45 : 1;
        const pts = left.map((p, i) => [U.lerp(tr[i].x - camX, p[0], sc), U.lerp(tr[i].y, p[1], sc)])
          .concat(right.map((p, i) => [U.lerp(tr[i].x - camX, p[0], sc), U.lerp(tr[i].y, p[1], sc)]).reverse());
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) ctx.lineTo(p[0], p[1]);
        ctx.closePath();
        ctx.fillStyle = this.def.trail[pass];
        ctx.fill();
      }
      ctx.restore();
    }
  }
  G.Player = Player;
  G.hitCounter = 0;
})();
