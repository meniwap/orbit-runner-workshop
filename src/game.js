const FIXED_DT = 1 / 60;

const CONFIG = {
  maxHp: 5,
  dashCooldown: 2.0,
  dashDuration: 0.12,
  dashSpeed: 520,
  dashInvuln: 0.25,
  baseFireCd: 0.18,
  rapidFireCd: 0.08,
  rapidFireDuration: 5,
  waveDuration: 20,
  waveDurationTest: 6,
  baseMaxEnemies: 6,
  maxEnemiesCap: 18,
  pickupSpawnMin: 15,
  pickupSpawnMax: 20,
  pickupSpawnMinTest: 4,
  pickupSpawnMaxTest: 7,
  maxPickups: 2,
  hazardMin: 15,
  hazardMax: 20,
  hazardMinTest: 6,
  hazardMaxTest: 9,
  hazardTelegraph: 1,
  hazardSpeed: 220,
  hazardThickness: 12,
  shieldDuration: 2,
  shieldCooldown: 10,
  upgradeEveryWaves: 2,
};

const WEAPONS = {
  1: { id: 1, name: 'Single', angles: [0], fireFactor: 1, pierce: 0 },
  2: { id: 2, name: 'Spread', angles: [-15, 0, 15], fireFactor: 1.1, pierce: 0 },
  3: { id: 3, name: 'Pierce', angles: [0], fireFactor: 1.6, pierce: 2 },
};

const UPGRADE_OPTIONS = [
  { id: 1, label: '+1 Max HP' },
  { id: 2, label: 'Dash Cooldown -20%' },
  { id: 3, label: 'Rapid Fire +2s' },
];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function len(x, y) {
  return Math.hypot(x, y);
}

function norm(x, y) {
  const l = Math.hypot(x, y);
  if (!l) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

function randBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function rotate(dir, deg) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: dir.x * c - dir.y * s, y: dir.x * s + dir.y * c };
}

function drawRoundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

export function createGame({ canvas, startBtn }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas not supported');

  const initialScenario =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('scenario') || 'default' : 'default';

  const state = {
    mode: 'menu', // menu | play | paused | gameover | upgrade
    time: 0,
    rngSeed: 1337,
    score: 0,
    stats: {
      shotsFired: 0,
      hits: 0,
      damageTaken: 0,
      dashesUsed: 0,
      streak: 0,
      multiplier: 1,
    },
    maxHp: CONFIG.maxHp,
    perks: {
      dashCooldownFactor: 1,
      rapidFireBonus: 0,
      maxHpBonus: 0,
    },
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 14,
      hp: CONFIG.maxHp,
      invuln: 0,
      fireCd: 0,
      dashCooldown: 0,
      dashTime: 0,
      dashDir: { x: 1, y: 0 },
      lastMoveDir: { x: 1, y: 0 },
      weaponId: 1,
      shieldCooldown: 0,
      shieldActive: 0,
    },
    buffs: {
      rapidFire: 0,
    },
    bullets: [],
    enemyBullets: [],
    enemies: [],
    pickups: [],
    pointer: { x: 0, y: 0, down: false },
    keys: new Set(),
    spawnTimer: 0,
    pickupTimer: 0,
    wave: 1,
    waveFlash: 0,
    maxEnemies: CONFIG.baseMaxEnemies,
    spawnDisabled: false,
    testScenario: initialScenario,
    testSpawnIndex: 0,
    testAutoFire: false,
    testAutoFireTimer: 0,
    testWeaponCycleIndex: 0,
    testShieldTimer: 0,
    hazard: {
      mode: 'idle',
      timer: 0,
      radius: 0,
      telegraph: 0,
      hit: false,
    },
    upgrade: {
      mode: 'none',
      options: UPGRADE_OPTIONS,
      selected: null,
      pendingWave: 0,
      autoTimer: 0,
    },
    viewport: {
      baseW: 960,
      baseH: 540,
      w: 960,
      h: 540,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
  };

  let rng = makeRng(state.rngSeed);
  const testEnv =
    typeof window !== 'undefined' &&
    (typeof window.__drainVirtualTimePending === 'function' || typeof window.__vt_pending !== 'undefined');

  function worldFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const wx = (x - state.viewport.offsetX) / state.viewport.scale;
    const wy = (y - state.viewport.offsetY) / state.viewport.scale;
    return { x: wx, y: wy };
  }

  function resize() {
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const parent = canvas.parentElement;
    const targetW = parent ? parent.clientWidth : window.innerWidth;
    const targetH = parent ? parent.clientHeight : window.innerHeight;

    const baseW = state.viewport.baseW;
    const baseH = state.viewport.baseH;
    const scale = Math.max(0.5, Math.min(targetW / baseW, targetH / baseH));

    state.viewport.w = baseW;
    state.viewport.h = baseH;
    state.viewport.scale = scale;
    state.viewport.offsetX = Math.floor((targetW - baseW * scale) / 2);
    state.viewport.offsetY = Math.floor((targetH - baseH * scale) / 2);

    canvas.width = Math.max(1, Math.floor(targetW * dpr));
    canvas.height = Math.max(1, Math.floor(targetH * dpr));
    canvas.style.width = `${targetW}px`;
    canvas.style.height = `${targetH}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setSeed(seed) {
    state.rngSeed = Number(seed) || 0;
    rng = makeRng(state.rngSeed);
  }

  function setWeapon(id) {
    const next = Math.max(1, Math.min(3, Number(id) || 1));
    state.player.weaponId = next;
  }

  function getDashCooldown() {
    return CONFIG.dashCooldown * state.perks.dashCooldownFactor;
  }

  function applyUpgrade(id) {
    if (id === 1) {
      state.perks.maxHpBonus += 1;
      state.maxHp = CONFIG.maxHp + state.perks.maxHpBonus;
      state.player.hp = Math.min(state.maxHp, state.player.hp + 1);
    } else if (id === 2) {
      state.perks.dashCooldownFactor = clamp(state.perks.dashCooldownFactor * 0.8, 0.4, 1);
      state.player.dashCooldown = Math.min(state.player.dashCooldown, getDashCooldown());
    } else if (id === 3) {
      state.perks.rapidFireBonus += 2;
    }
    state.upgrade.selected = id;
    state.upgrade.mode = 'none';
    state.mode = 'play';
  }

  function forceUpgrade(id) {
    applyUpgrade(Number(id) || 1);
  }

  function beginUpgrade() {
    if (state.upgrade.mode === 'choice') return;
    state.upgrade.mode = 'choice';
    state.upgrade.selected = null;
    state.mode = 'upgrade';
    if (testEnv && state.testScenario === 'upgrade') {
      state.upgrade.autoTimer = 0.4;
    }
  }

  function updateUpgrade(dt) {
    if (state.mode !== 'upgrade') return;
    if (testEnv && state.testScenario === 'upgrade') {
      state.upgrade.autoTimer -= dt;
      if (state.upgrade.autoTimer <= 0) {
        applyUpgrade(1);
      }
    }
  }

  function pickEnemyType() {
    if (testEnv && state.testScenario === 'default') {
      const pattern = ['chaser', 'chaser', 'shooter', 'chaser', 'tank'];
      const type = pattern[state.testSpawnIndex % pattern.length];
      state.testSpawnIndex += 1;
      return type;
    }
    const waveFactor = Math.min(1, state.wave / 6);
    const shooterWeight = 0.12 + waveFactor * 0.18;
    const tankWeight = 0.06 + waveFactor * 0.14;
    const chaserWeight = Math.max(0.4, 1 - shooterWeight - tankWeight);
    const total = chaserWeight + shooterWeight + tankWeight;
    const roll = rng() * total;
    if (roll < chaserWeight) return 'chaser';
    if (roll < chaserWeight + shooterWeight) return 'shooter';
    return 'tank';
  }

  function makeEnemy(type, x, y, overrides = {}) {
    let enemy = null;
    if (type === 'shooter') {
      enemy = {
        type,
        x,
        y,
        r: 16,
        hp: 2,
        speed: randBetween(rng, 25, 55),
        points: 2,
        shootCd: randBetween(rng, 0.8, 1.6),
        shootMin: 1.0,
        shootMax: 2.0,
        bulletSpeed: 170,
      };
    } else if (type === 'tank') {
      enemy = {
        type,
        x,
        y,
        r: 22,
        hp: 5,
        speed: randBetween(rng, 20, 35),
        points: 4,
      };
    } else {
      enemy = {
        type: 'chaser',
        x,
        y,
        r: 16,
        hp: 2,
        speed: randBetween(rng, 45, 85),
        points: 1,
      };
    }

    const eliteRoll = rng();
    if (!enemy.elite && eliteRoll < 0.15 && !testEnv) {
      const modifier = rng() < 0.5 ? 'fast' : 'tanky';
      enemy.elite = true;
      enemy.modifiers = [modifier];
      enemy.r += 2;
      if (modifier === 'fast') enemy.speed *= 1.4;
      if (modifier === 'tanky') enemy.hp *= 2;
      enemy.points += 1;
    }

    return { ...enemy, elite: enemy.elite || false, modifiers: enemy.modifiers || [], ...overrides };
  }

  function spawnEnemy(typeOverride, eliteOverride) {
    const w = state.viewport.baseW;
    const h = state.viewport.baseH;
    const side = Math.floor(randBetween(rng, 0, 4));
    const pad = 40;
    let x = 0;
    let y = 0;
    if (side === 0) {
      x = randBetween(rng, -pad, w + pad);
      y = -pad;
    } else if (side === 1) {
      x = w + pad;
      y = randBetween(rng, -pad, h + pad);
    } else if (side === 2) {
      x = randBetween(rng, -pad, w + pad);
      y = h + pad;
    } else {
      x = -pad;
      y = randBetween(rng, -pad, h + pad);
    }
    const type = typeOverride || pickEnemyType();
    const enemy = makeEnemy(type, x, y);
    if (eliteOverride) {
      enemy.elite = true;
      enemy.modifiers = eliteOverride;
      if (eliteOverride.includes('fast')) enemy.speed *= 1.4;
      if (eliteOverride.includes('tanky')) enemy.hp *= 2;
      enemy.r += 2;
      enemy.points += 1;
    }
    state.enemies.push(enemy);
  }

  function spawnPickup(typeOverride) {
    const w = state.viewport.baseW;
    const h = state.viewport.baseH;
    let x = randBetween(rng, 80, w - 80);
    let y = randBetween(rng, 80, h - 80);
    if (len(x - state.player.x, y - state.player.y) < 120) {
      x = clamp(state.player.x + 140, 80, w - 80);
      y = clamp(state.player.y + 40, 80, h - 80);
    }
    const type = typeOverride || (rng() < 0.55 ? 'hp' : 'rapid');
    state.pickups.push({
      type,
      x,
      y,
      r: 11,
      ttl: 12,
    });
  }

  function setupHazardTimer() {
    state.hazard.timer = testEnv
      ? randBetween(rng, CONFIG.hazardMinTest, CONFIG.hazardMaxTest)
      : randBetween(rng, CONFIG.hazardMin, CONFIG.hazardMax);
    state.hazard.mode = 'idle';
    state.hazard.radius = 0;
    state.hazard.telegraph = 0;
    state.hazard.hit = false;
  }

  function applyScenario() {
    state.spawnDisabled = false;
    state.pickupTimer = testEnv
      ? randBetween(rng, CONFIG.pickupSpawnMinTest, CONFIG.pickupSpawnMaxTest)
      : randBetween(rng, CONFIG.pickupSpawnMin, CONFIG.pickupSpawnMax);
    state.testSpawnIndex = 0;
    state.testAutoFire = false;
    state.testAutoFireTimer = 0;
    state.testWeaponCycleIndex = 0;
    state.testShieldTimer = 0;

    const scenario = state.testScenario || 'default';
    if (scenario === 'shoot-score') {
      state.spawnDisabled = true;
      state.enemies.push(
        makeEnemy('chaser', state.player.x + 260, state.player.y, { hp: 1, speed: 0, points: 2 })
      );
    } else if (scenario === 'shooter') {
      state.spawnDisabled = true;
      state.enemies.push(
        makeEnemy('shooter', state.player.x + 260, state.player.y - 40, {
          speed: 0,
          shootCd: 0.3,
          shootMin: 0.4,
          shootMax: 0.8,
        })
      );
    } else if (scenario === 'tank') {
      state.spawnDisabled = true;
      state.enemies.push(
        makeEnemy('tank', state.player.x + 260, state.player.y, {
          speed: 0,
          hp: 3,
          points: 4,
        })
      );
    } else if (scenario === 'powerups') {
      state.spawnDisabled = true;
      state.player.hp = Math.max(1, state.maxHp - 1);
      state.pickups.push({
        type: 'hp',
        x: state.player.x + 80,
        y: state.player.y,
        r: 11,
        ttl: 12,
      });
      state.pickups.push({
        type: 'rapid',
        x: state.player.x + 140,
        y: state.player.y,
        r: 11,
        ttl: 12,
      });
    } else if (scenario === 'gameover') {
      state.spawnDisabled = true;
      state.player.hp = 1;
      state.enemies.push(makeEnemy('chaser', state.player.x, state.player.y, { speed: 0 }));
    } else if (scenario === 'pause') {
      state.spawnDisabled = true;
      state.mode = 'paused';
    } else if (scenario === 'dash') {
      state.spawnDisabled = true;
    } else if (scenario === 'wave') {
      state.spawnDisabled = false;
    } else if (scenario === 'weapon-cycle') {
      state.spawnDisabled = true;
      state.player.weaponId = 1;
      state.testAutoFire = true;
      state.enemies.push(makeEnemy('chaser', state.player.x + 260, state.player.y, { hp: 3, speed: 0 }));
    } else if (scenario === 'shield') {
      state.spawnDisabled = true;
      state.player.shieldCooldown = 0;
      state.testShieldTimer = 0.25;
      state.enemyBullets.push({
        x: state.player.x + 140,
        y: state.player.y,
        vx: -140,
        vy: 0,
        r: 4,
        ttl: 3,
      });
    } else if (scenario === 'streak') {
      state.spawnDisabled = true;
      state.testAutoFire = true;
      state.player.weaponId = 3;
      state.enemies.push(makeEnemy('chaser', state.player.x + 180, state.player.y, { hp: 1, speed: 0 }));
      state.enemies.push(makeEnemy('chaser', state.player.x + 230, state.player.y, { hp: 1, speed: 0 }));
    } else if (scenario === 'hazard') {
      state.spawnDisabled = true;
      state.hazard.mode = 'telegraph';
      state.hazard.telegraph = 0.3;
      state.hazard.radius = 0;
      state.hazard.hit = false;
    } else if (scenario === 'upgrade') {
      state.spawnDisabled = true;
      state.mode = 'upgrade';
      state.upgrade.mode = 'choice';
      state.upgrade.selected = null;
      state.upgrade.autoTimer = 0.4;
    } else if (scenario === 'elite') {
      state.spawnDisabled = true;
      spawnEnemy('chaser', ['fast']);
    }
  }

  function resetPlay() {
    state.mode = 'play';
    state.time = 0;
    state.score = 0;
    state.stats = {
      shotsFired: 0,
      hits: 0,
      damageTaken: 0,
      dashesUsed: 0,
      streak: 0,
      multiplier: 1,
    };
    state.bullets = [];
    state.enemyBullets = [];
    state.enemies = [];
    state.pickups = [];
    state.spawnTimer = 1.0;
    state.pickupTimer = testEnv
      ? randBetween(rng, CONFIG.pickupSpawnMinTest, CONFIG.pickupSpawnMaxTest)
      : randBetween(rng, CONFIG.pickupSpawnMin, CONFIG.pickupSpawnMax);
    state.wave = 1;
    state.waveFlash = 0;
    state.maxEnemies = CONFIG.baseMaxEnemies;
    state.spawnDisabled = false;
    state.testSpawnIndex = 0;
    state.testAutoFire = false;
    state.testAutoFireTimer = 0;
    state.testWeaponCycleIndex = 0;
    state.testShieldTimer = 0;
    state.hazard = { mode: 'idle', timer: 0, radius: 0, telegraph: 0, hit: false };
    state.upgrade = { mode: 'none', options: UPGRADE_OPTIONS, selected: null, pendingWave: 0, autoTimer: 0 };

    rng = makeRng(state.rngSeed);
    state.player.x = state.viewport.baseW / 2;
    state.player.y = state.viewport.baseH / 2;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.hp = state.maxHp;
    state.player.invuln = 0;
    state.player.fireCd = 0;
    state.player.dashCooldown = 0;
    state.player.dashTime = 0;
    state.player.dashDir = { x: 1, y: 0 };
    state.player.lastMoveDir = { x: 1, y: 0 };
    state.player.weaponId = 1;
    state.player.shieldCooldown = 0;
    state.player.shieldActive = 0;
    state.buffs.rapidFire = 0;
    state.pointer.x = state.player.x;
    state.pointer.y = state.player.y;

    setupHazardTimer();
    applyScenario();
  }

  function setMode(next) {
    state.mode = next;
  }

  function togglePause() {
    if (state.mode === 'play') setMode('paused');
    else if (state.mode === 'paused') setMode('play');
  }

  function toggleFullscreen() {
    const el = canvas;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  function activateShield() {
    if (state.player.shieldCooldown > 0) return false;
    state.player.shieldActive = CONFIG.shieldDuration;
    state.player.shieldCooldown = CONFIG.shieldCooldown;
    return true;
  }

  function damagePlayer(amount) {
    if (state.player.shieldActive > 0) {
      state.player.shieldActive = 0;
      state.player.invuln = Math.max(state.player.invuln, 0.2);
      return;
    }
    if (state.player.invuln > 0) return;
    state.player.hp = Math.max(0, state.player.hp - amount);
    state.stats.damageTaken += amount;
    state.stats.streak = 0;
    state.stats.multiplier = 1;
    state.player.invuln = 0.75;
    if (state.player.hp <= 0) {
      state.mode = 'gameover';
    }
  }

  function spawnBullet(dir, pierce) {
    const speed = 420;
    state.bullets.push({
      x: state.player.x + dir.x * (state.player.r + 4),
      y: state.player.y + dir.y * (state.player.r + 4),
      vx: dir.x * speed,
      vy: dir.y * speed,
      r: 4,
      ttl: 2.0,
      pierce: pierce || 0,
    });
  }

  function shootAt(wx, wy) {
    if (state.player.fireCd > 0) return;
    const weapon = WEAPONS[state.player.weaponId] || WEAPONS[1];
    const baseCd = state.buffs.rapidFire > 0 ? CONFIG.rapidFireCd : CONFIG.baseFireCd;
    state.player.fireCd = baseCd * weapon.fireFactor;
    const dx = wx - state.player.x;
    const dy = wy - state.player.y;
    let dir = norm(dx, dy);
    if (Math.hypot(dx, dy) < 3) dir = { x: 1, y: 0 };
    for (const angle of weapon.angles) {
      const shotDir = angle === 0 ? dir : rotate(dir, angle);
      spawnBullet(shotDir, weapon.pierce);
    }
    state.stats.shotsFired += 1;
  }

  function tryDash() {
    if (state.mode !== 'play') return false;
    if (state.player.dashCooldown > 0) return false;
    let dir = state.player.lastMoveDir;
    if (!dir || (dir.x === 0 && dir.y === 0)) {
      dir = norm(state.pointer.x - state.player.x, state.pointer.y - state.player.y);
    }
    if (dir.x === 0 && dir.y === 0) dir = { x: 1, y: 0 };
    state.player.dashDir = dir;
    state.player.dashTime = CONFIG.dashDuration;
    state.player.dashCooldown = getDashCooldown();
    state.player.invuln = Math.max(state.player.invuln, CONFIG.dashInvuln);
    state.stats.dashesUsed += 1;
    return true;
  }

  function updateHazard(dt) {
    const centerX = state.viewport.baseW / 2;
    const centerY = state.viewport.baseH / 2;
    const maxRadius = Math.hypot(centerX, centerY) + 30;

    if (state.hazard.mode === 'idle') {
      state.hazard.timer -= dt;
      if (state.hazard.timer <= 0) {
        state.hazard.mode = 'telegraph';
        state.hazard.telegraph = CONFIG.hazardTelegraph;
        state.hazard.radius = 0;
        state.hazard.hit = false;
      }
      return;
    }

    if (state.hazard.mode === 'telegraph') {
      state.hazard.telegraph -= dt;
      if (state.hazard.telegraph <= 0) {
        state.hazard.mode = 'active';
        state.hazard.radius = 0;
      }
      return;
    }

    if (state.hazard.mode === 'active') {
      state.hazard.radius += CONFIG.hazardSpeed * dt;
      if (!state.hazard.hit) {
        const dist = len(state.player.x - centerX, state.player.y - centerY);
        if (Math.abs(dist - state.hazard.radius) <= CONFIG.hazardThickness) {
          damagePlayer(1);
          state.hazard.hit = true;
        }
      }
      if (state.hazard.radius >= maxRadius) {
        setupHazardTimer();
      }
    }
  }

  function update(dt) {
    if (state.mode === 'upgrade') {
      updateUpgrade(dt);
      return;
    }
    if (state.mode !== 'play') return;

    state.time += dt;
    state.player.invuln = Math.max(0, state.player.invuln - dt);
    state.player.fireCd = Math.max(0, state.player.fireCd - dt);
    state.player.dashCooldown = Math.max(0, state.player.dashCooldown - dt);
    state.player.shieldCooldown = Math.max(0, state.player.shieldCooldown - dt);
    state.player.shieldActive = Math.max(0, state.player.shieldActive - dt);
    state.buffs.rapidFire = Math.max(0, state.buffs.rapidFire - dt);

    if (state.testShieldTimer > 0) {
      state.testShieldTimer -= dt;
      if (state.testShieldTimer <= 0) activateShield();
    }

    if (state.testAutoFire) {
      state.testAutoFireTimer -= dt;
      if (state.testAutoFireTimer <= 0) {
        shootAt(state.player.x + 300, state.player.y);
        state.testAutoFireTimer = 0.3;
      }
    }

    if (state.testScenario === 'weapon-cycle') {
      const t = state.time;
      if (state.testWeaponCycleIndex === 0 && t > 0.3) {
        setWeapon(1);
        state.testWeaponCycleIndex = 1;
      } else if (state.testWeaponCycleIndex === 1 && t > 0.7) {
        setWeapon(2);
        state.testWeaponCycleIndex = 2;
      } else if (state.testWeaponCycleIndex === 2 && t > 1.1) {
        setWeapon(3);
        state.testWeaponCycleIndex = 3;
      }
    }

    if (state.player.dashTime > 0) {
      state.player.dashTime = Math.max(0, state.player.dashTime - dt);
      state.player.x += state.player.dashDir.x * CONFIG.dashSpeed * dt;
      state.player.y += state.player.dashDir.y * CONFIG.dashSpeed * dt;
    } else {
      const accel = 820;
      const maxSpeed = 220;
      const friction = 0.88;
      let ax = 0;
      let ay = 0;
      if (state.keys.has('ArrowLeft')) ax -= 1;
      if (state.keys.has('ArrowRight')) ax += 1;
      if (state.keys.has('ArrowUp')) ay -= 1;
      if (state.keys.has('ArrowDown')) ay += 1;
      if (ax || ay) {
        const d = norm(ax, ay);
        state.player.lastMoveDir = d;
        state.player.vx += d.x * accel * dt;
        state.player.vy += d.y * accel * dt;
      } else {
        state.player.vx *= friction;
        state.player.vy *= friction;
      }
      const sp = len(state.player.vx, state.player.vy);
      if (sp > maxSpeed) {
        const d = norm(state.player.vx, state.player.vy);
        state.player.vx = d.x * maxSpeed;
        state.player.vy = d.y * maxSpeed;
      }
      state.player.x += state.player.vx * dt;
      state.player.y += state.player.vy * dt;
    }

    const w = state.viewport.baseW;
    const h = state.viewport.baseH;
    state.player.x = clamp(state.player.x, state.player.r, w - state.player.r);
    state.player.y = clamp(state.player.y, state.player.r, h - state.player.r);

    const waveDuration = testEnv ? CONFIG.waveDurationTest : CONFIG.waveDuration;
    const nextWave = Math.floor(state.time / waveDuration) + 1;
    if (nextWave !== state.wave) {
      state.wave = nextWave;
      state.waveFlash = 1.25;
      if (state.wave % CONFIG.upgradeEveryWaves === 0 && state.upgrade.pendingWave !== state.wave) {
        state.upgrade.pendingWave = state.wave;
        beginUpgrade();
        return;
      }
    }
    state.waveFlash = Math.max(0, state.waveFlash - dt);
    state.maxEnemies = clamp(CONFIG.baseMaxEnemies + state.wave * 2, CONFIG.baseMaxEnemies, CONFIG.maxEnemiesCap);

    if (!state.spawnDisabled) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.enemies.length < state.maxEnemies) {
        spawnEnemy();
        const intensity = clamp(1 + state.wave * 0.2, 1, 3.2);
        state.spawnTimer = randBetween(rng, 1.0 / intensity, 1.8 / intensity);
      }
    }

    if (!state.spawnDisabled && state.pickups.length < CONFIG.maxPickups) {
      state.pickupTimer -= dt;
      if (state.pickupTimer <= 0) {
        spawnPickup();
        state.pickupTimer = testEnv
          ? randBetween(rng, CONFIG.pickupSpawnMinTest, CONFIG.pickupSpawnMaxTest)
          : randBetween(rng, CONFIG.pickupSpawnMin, CONFIG.pickupSpawnMax);
      }
    }

    for (const e of state.enemies) {
      const d = norm(state.player.x - e.x, state.player.y - e.y);
      e.x += d.x * e.speed * dt;
      e.y += d.y * e.speed * dt;
      if (e.type === 'shooter') {
        e.shootCd -= dt;
        if (e.shootCd <= 0 && state.enemyBullets.length < 16) {
          const dir = norm(state.player.x - e.x, state.player.y - e.y);
          state.enemyBullets.push({
            x: e.x + dir.x * (e.r + 4),
            y: e.y + dir.y * (e.r + 4),
            vx: dir.x * e.bulletSpeed,
            vy: dir.y * e.bulletSpeed,
            r: 4,
            ttl: 3.5,
          });
          const min = e.shootMin ?? 1.0;
          const max = e.shootMax ?? 2.2;
          e.shootCd = randBetween(rng, min, max);
        }
      }
    }

    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
    }
    state.bullets = state.bullets.filter((b) => b.ttl > 0);

    for (const b of state.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
    }
    state.enemyBullets = state.enemyBullets.filter((b) => b.ttl > 0);

    // bullet ↔ enemy
    for (const b of state.bullets) {
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        const d = len(b.x - e.x, b.y - e.y);
        if (d <= b.r + e.r) {
          e.hp -= 1;
          state.stats.hits += 1;
          if (b.pierce && b.pierce > 0) {
            b.pierce -= 1;
            if (b.pierce <= 0) b.ttl = 0;
          } else {
            b.ttl = 0;
          }
          if (e.hp <= 0) {
            state.stats.streak += 1;
            state.stats.multiplier = 1 + Math.floor(state.stats.streak / 5);
            state.score += (e.points || 1) * state.stats.multiplier;
          }
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.ttl > 0);
    state.enemies = state.enemies.filter((e) => e.hp > 0);

    // enemy bullets ↔ player
    for (const b of state.enemyBullets) {
      const d = len(b.x - state.player.x, b.y - state.player.y);
      if (d <= b.r + state.player.r) {
        b.ttl = 0;
        damagePlayer(1);
      }
    }
    state.enemyBullets = state.enemyBullets.filter((b) => b.ttl > 0);

    // enemy ↔ player
    for (const e of state.enemies) {
      const d = len(e.x - state.player.x, e.y - state.player.y);
      if (d <= e.r + state.player.r) {
        damagePlayer(1);
        const push = norm(state.player.x - e.x, state.player.y - e.y);
        state.player.vx += push.x * 220;
        state.player.vy += push.y * 220;
      }
    }

    // pickups ↔ player
    for (const p of state.pickups) {
      const d = len(p.x - state.player.x, p.y - state.player.y);
      if (d <= p.r + state.player.r) {
        if (p.type === 'hp') {
          state.player.hp = Math.min(state.maxHp, state.player.hp + 1);
        } else if (p.type === 'rapid') {
          state.buffs.rapidFire = Math.max(
            state.buffs.rapidFire,
            CONFIG.rapidFireDuration + state.perks.rapidFireBonus
          );
        }
        p.ttl = 0;
      } else {
        p.ttl -= dt;
      }
    }
    state.pickups = state.pickups.filter((p) => p.ttl > 0);

    updateHazard(dt);

    if (state.player.hp <= 0) {
      state.mode = 'gameover';
    }
  }

  function drawCenteredText(text, x, y, size, color = '#fff') {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  }

  function render() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(state.viewport.offsetX, state.viewport.offsetY);
    ctx.scale(state.viewport.scale, state.viewport.scale);

    // world background
    ctx.fillStyle = '#101a33';
    ctx.fillRect(0, 0, state.viewport.baseW, state.viewport.baseH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, state.viewport.baseW - 12, state.viewport.baseH - 12);

    if (state.mode === 'menu') {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, state.viewport.baseW, state.viewport.baseH);
      drawCenteredText('Orbit Runner', state.viewport.baseW / 2, 150, 56);
      drawCenteredText('Arrows: Move  •  Mouse: Aim  •  Click: Shoot', state.viewport.baseW / 2, 240, 18, 'rgba(255,255,255,0.9)');
      drawCenteredText('Shift: Dash  •  E: Shield  •  1/2/3: Weapon', state.viewport.baseW / 2, 270, 18, 'rgba(255,255,255,0.8)');
      drawCenteredText('B: Pause  •  A: Restart  •  F: Fullscreen', state.viewport.baseW / 2, 296, 16, 'rgba(255,255,255,0.7)');
      ctx.restore();
      return;
    }

    if (state.hazard.mode === 'telegraph') {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.viewport.baseW / 2, state.viewport.baseH / 2, 40, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (state.hazard.mode === 'active') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = CONFIG.hazardThickness;
      ctx.beginPath();
      ctx.arc(state.viewport.baseW / 2, state.viewport.baseH / 2, state.hazard.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // pickups
    for (const p of state.pickups) {
      if (p.type === 'hp') {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(p.x - 2, p.y - 7, 4, 14);
        ctx.fillRect(p.x - 7, p.y - 2, 14, 4);
      } else {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - p.r);
        ctx.lineTo(p.x + p.r, p.y);
        ctx.lineTo(p.x, p.y + p.r);
        ctx.lineTo(p.x - p.r, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // enemies
    for (const e of state.enemies) {
      if (e.type === 'shooter') ctx.fillStyle = '#a855f7';
      else if (e.type === 'tank') ctx.fillStyle = '#f97316';
      else ctx.fillStyle = '#ff4d6d';

      if (e.elite) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(e.x - 4, e.y - 4, e.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // enemy bullets
    for (const b of state.enemyBullets) {
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // bullets
    for (const b of state.bullets) {
      ctx.fillStyle = '#ffd60a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // player
    const flash = state.player.invuln > 0 && Math.floor((nowMs() / 60) % 2) === 0;
    ctx.fillStyle = flash ? 'rgba(255,255,255,0.9)' : '#4cc9f0';
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2);
    ctx.fill();

    if (state.player.shieldActive > 0) {
      ctx.strokeStyle = 'rgba(59,130,246,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, state.player.r + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // aim line
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y);
    ctx.lineTo(state.pointer.x, state.pointer.y);
    ctx.stroke();

    // HUD
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 16px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Score: ${state.score}`, 12, 12);
    ctx.fillText(`HP: ${Math.max(0, state.player.hp)}/${state.maxHp}`, 12, 32);
    ctx.fillText(`Shots: ${state.stats.shotsFired}`, 12, 52);
    const dashLabel =
      state.player.dashCooldown > 0 ? `Dash: ${state.player.dashCooldown.toFixed(1)}s` : 'Dash: Ready';
    ctx.fillText(dashLabel, 12, 72);
    const shieldLabel =
      state.player.shieldActive > 0
        ? 'Shield: Active'
        : state.player.shieldCooldown > 0
          ? `Shield: ${state.player.shieldCooldown.toFixed(1)}s`
          : 'Shield: Ready';
    ctx.fillText(shieldLabel, 12, 92);
    if (state.buffs.rapidFire > 0) {
      ctx.fillText(`Rapid: ${state.buffs.rapidFire.toFixed(1)}s`, 12, 112);
    }
    ctx.fillText(`Streak: ${state.stats.streak}  x${state.stats.multiplier}`, 12, 132);
    ctx.fillText(`Weapon: W${state.player.weaponId} ${WEAPONS[state.player.weaponId].name}`, 12, 152);
    ctx.textAlign = 'right';
    ctx.fillText(`Wave ${state.wave}`, state.viewport.baseW - 12, 12);

    if (state.waveFlash > 0) {
      const alpha = clamp(state.waveFlash, 0, 1);
      drawCenteredText(`Wave ${state.wave}`, state.viewport.baseW / 2, 80, 36, `rgba(255,255,255,${alpha})`);
    }

    if (state.mode === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, state.viewport.baseW, state.viewport.baseH);
      drawCenteredText('Paused', state.viewport.baseW / 2, state.viewport.baseH / 2 - 10, 48);
      drawCenteredText('Press B to resume', state.viewport.baseW / 2, state.viewport.baseH / 2 + 38, 18, 'rgba(255,255,255,0.85)');
    }

    if (state.mode === 'upgrade') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, state.viewport.baseW, state.viewport.baseH);
      drawCenteredText('Upgrade', state.viewport.baseW / 2, 140, 48);
      const cardW = 220;
      const cardH = 90;
      const gap = 20;
      const startX = state.viewport.baseW / 2 - (cardW * 3 + gap * 2) / 2 + cardW / 2;
      UPGRADE_OPTIONS.forEach((opt, idx) => {
        const x = startX + idx * (cardW + gap);
        const y = state.viewport.baseH / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        drawRoundRect(ctx, x - cardW / 2, y - cardH / 2, cardW, cardH, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = '600 16px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opt.label, x, y);
        ctx.font = '600 14px system-ui';
        ctx.fillText(`Press ${idx + 1}`, x, y + 26);
      });
    }

    if (state.mode === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, state.viewport.baseW, state.viewport.baseH);
      drawCenteredText('Game Over', state.viewport.baseW / 2, state.viewport.baseH / 2 - 30, 56);
      drawCenteredText(`Final score: ${state.score}`, state.viewport.baseW / 2, state.viewport.baseH / 2 + 16, 20, 'rgba(255,255,255,0.9)');
      drawCenteredText('Press A to restart', state.viewport.baseW / 2, state.viewport.baseH / 2 + 54, 18, 'rgba(255,255,255,0.85)');
    }

    ctx.restore();
  }

  let raf = 0;
  let rafLast = 0;
  let rafAcc = 0;
  let externalStepping = false;
  function loop() {
    raf = requestAnimationFrame(loop);
    const t = nowMs() / 1000;
    if (!rafLast) rafLast = t;
    const dt = Math.min(0.05, Math.max(0, t - rafLast));
    rafLast = t;

    if (!externalStepping) {
      rafAcc += dt;
      const maxSteps = 5;
      let steps = 0;
      while (rafAcc >= FIXED_DT && steps < maxSteps) {
        update(FIXED_DT);
        rafAcc -= FIXED_DT;
        steps += 1;
      }
    }
    render();
    ensurePauseInTest();
  }

  function renderGameToText() {
    const enemiesPreview = state.enemies.slice(0, 10).map((e) => ({
      x: Number(e.x.toFixed(2)),
      y: Number(e.y.toFixed(2)),
      r: e.r,
      hp: e.hp,
      type: e.type,
      elite: e.elite,
      modifiers: e.modifiers,
    }));
    const bulletsPreview = state.bullets.slice(0, 5).map((b) => ({
      x: Number(b.x.toFixed(2)),
      y: Number(b.y.toFixed(2)),
      r: b.r,
      ttl: Number(b.ttl.toFixed(2)),
      pierce: b.pierce || 0,
    }));
    const enemyBulletsPreview = state.enemyBullets.slice(0, 5).map((b) => ({
      x: Number(b.x.toFixed(2)),
      y: Number(b.y.toFixed(2)),
      r: b.r,
      ttl: Number(b.ttl.toFixed(2)),
    }));
    const pickupsPreview = state.pickups.slice(0, 5).map((p) => ({
      x: Number(p.x.toFixed(2)),
      y: Number(p.y.toFixed(2)),
      r: p.r,
      type: p.type,
      ttl: Number(p.ttl.toFixed(2)),
    }));
    const hazardActive = state.hazard.mode !== 'idle';
    const hazardTtl =
      state.hazard.mode === 'telegraph'
        ? state.hazard.telegraph
        : state.hazard.mode === 'active'
          ? Math.max(0, (Math.hypot(state.viewport.baseW / 2, state.viewport.baseH / 2) - state.hazard.radius) / CONFIG.hazardSpeed)
          : 0;
    const payload = {
      mode: state.mode,
      coords: 'origin top-left; x right; y down',
      viewport: {
        baseW: state.viewport.baseW,
        baseH: state.viewport.baseH,
        scale: state.viewport.scale,
      },
      time: Number(state.time.toFixed(3)),
      wave: state.wave,
      maxEnemies: state.maxEnemies,
      score: state.score,
      player: {
        x: Number(state.player.x.toFixed(2)),
        y: Number(state.player.y.toFixed(2)),
        vx: Number(state.player.vx.toFixed(2)),
        vy: Number(state.player.vy.toFixed(2)),
        r: state.player.r,
        hp: state.player.hp,
        maxHp: state.maxHp,
        invuln: Number(state.player.invuln.toFixed(2)),
        dashCooldown: Number(state.player.dashCooldown.toFixed(2)),
        dashCooldownMax: getDashCooldown(),
        weaponId: state.player.weaponId,
        shieldCooldown: Number(state.player.shieldCooldown.toFixed(2)),
        shieldActive: Number(state.player.shieldActive.toFixed(2)),
        buffs: {
          rapidFire: Number(state.buffs.rapidFire.toFixed(2)),
        },
      },
      enemies: {
        count: state.enemies.length,
        sample: enemiesPreview,
      },
      bullets: {
        count: state.bullets.length,
        sample: bulletsPreview,
      },
      enemyBullets: {
        count: state.enemyBullets.length,
        sample: enemyBulletsPreview,
      },
      pickups: {
        count: state.pickups.length,
        sample: pickupsPreview,
      },
      hazards: {
        active: hazardActive,
        mode: state.hazard.mode,
        radius: Number(state.hazard.radius.toFixed(2)),
        ttl: Number(hazardTtl.toFixed(2)),
      },
      upgrade: {
        mode: state.upgrade.mode,
        options: state.upgrade.options,
        selected: state.upgrade.selected,
      },
      stats: state.stats,
    };
    return JSON.stringify(payload);
  }

  function advanceTime(ms) {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    if (testEnv) externalStepping = true;
    for (let i = 0; i < steps; i++) update(FIXED_DT);
    render();
  }

  function onKeyDown(e) {
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      if (state.mode === 'play' || state.mode === 'paused') togglePause();
      return;
    }
    if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      if (state.mode === 'play' || state.mode === 'paused' || state.mode === 'gameover') resetPlay();
      return;
    }
    if (e.key === 'Enter') {
      if (state.mode === 'menu') {
        e.preventDefault();
        resetPlay();
      }
      return;
    }
    if (e.key === 'Shift') {
      e.preventDefault();
      tryDash();
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      tryDash();
      return;
    }
    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      activateShield();
      return;
    }
    if (e.key === '1' || e.key === '2' || e.key === '3') {
      e.preventDefault();
      const id = Number(e.key);
      if (state.mode === 'upgrade') {
        applyUpgrade(id);
      } else {
        setWeapon(id);
      }
      return;
    }

    if (e.key.startsWith('Arrow')) {
      state.keys.add(e.key);
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    if (e.key.startsWith('Arrow')) state.keys.delete(e.key);
  }

  function onPointerMove(e) {
    const p = worldFromClient(e.clientX, e.clientY);
    state.pointer.x = clamp(p.x, 0, state.viewport.baseW);
    state.pointer.y = clamp(p.y, 0, state.viewport.baseH);
  }

  function onPointerDown(e) {
    if (state.mode === 'menu') {
      resetPlay();
      return;
    }
    if (state.mode !== 'play') return;
    const p = worldFromClient(e.clientX, e.clientY);
    shootAt(p.x, p.y);
  }

  function onMouseDown(e) {
    if (state.mode === 'menu') {
      resetPlay();
      return;
    }
    if (state.mode !== 'play') return;
    const p = worldFromClient(e.clientX, e.clientY);
    shootAt(p.x, p.y);
  }

  function onStartClicked() {
    resetPlay();
  }

  function ensurePauseInTest() {
    if (testEnv && state.testScenario === 'pause') {
      state.mode = 'paused';
    }
  }

  function attach() {
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('fullscreenchange', () => {
      resize();
    });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('mousedown', onMouseDown);
    startBtn?.addEventListener('click', onStartClicked);

    window.render_game_to_text = renderGameToText;
    window.advanceTime = advanceTime;
    window.setSeed = setSeed;
    window.resetTestScenario = (scenario) => {
      state.testScenario = scenario || 'default';
      resetPlay();
    };
    window.setWeapon = setWeapon;
    window.forceUpgrade = forceUpgrade;

    if (state.mode === 'menu') {
      state.player.x = state.viewport.baseW / 2;
      state.player.y = state.viewport.baseH / 2;
      state.pointer.x = state.player.x;
      state.pointer.y = state.player.y;
    }
    loop();
  }

  function detach() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('mousedown', onMouseDown);
    startBtn?.removeEventListener('click', onStartClicked);
  }

  return { state, attach, detach, resetPlay, render, update };
}
