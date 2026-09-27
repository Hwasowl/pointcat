import { BOOST_MARBLE_EVERY_S, MARBLE_EVERY_S, MARBLE_SPEED, ROCK_EVERY_S } from '../config';
import { drawCat } from './cat';
import { drawObstacle } from './obstacles';
import { CATS, litSkin, type CatKey } from './cats';
import { THEMES, type ParticleKind, type Theme, type ThemeKey } from './themes';

type Particle = {
  k: ParticleKind;
  x: number;
  y: number;
  a: number;
  sp: number;
  ph: number;
  life: number;
  vy: number;
  rot: number;
  vr: number;
  s: number;
  lf: number;
  d: number;
  max: number;
  landed: boolean;
  dead: boolean;
};
type Spark = { x: number; y: number; vx: number; vy: number; life: number };
type Ring = { x: number; y: number; age: number };
/** 물 위에 떠내려오는 구슬·돌. d는 물길 안의 깊이(0 = 수평선 쪽, 1 = 시트 쪽), r은 강둑 사이에서의 자리(0~1) — 물길이 휘면 d가 따라 바뀐다 */
type Item = { k: 'orb' | 'rock'; x: number; d: number; r: number; ph: number; hit: boolean; dead: boolean };
type Pop = { x: number; y: number; text: string; age: number };
/** 배 꽁무니에서 뒤로 흘러가는 물보라. big은 부스터 중에 인 굵고 하얀 물보라 */
type Foam = { x: number; y: number; vy: number; age: number; big: boolean };
/** 부스터가 켜진 동안 물 위를 스쳐 가는 바람 줄기. x는 줄기의 앞끝 */
type Gust = { x: number; y: number; len: number; sp: number; ph: number };

const BOAT_SPEED = 240;
/** 관성: 목표 쪽으로 당기는 힘과 물의 저항. 저항을 조금 약하게 둬 급히 돌리면 살짝 지나쳤다가 돌아온다 */
const PULL = 40;
const WATER_DRAG = 6.5;
/** 대시: 손을 이 속도(px/s) 이상으로 튕기고 떼면 그 방향으로 짧게 돌진한다 */
const FLICK_SPEED = 1100;
const DASH_SPEED = 600;
const DASH_S = 0.35;
const DASH_DRAG = 1.5;
/** 대시가 끝날 때 남은 속도로 이만큼(초) 더 미끄러진 자리를 새 목표로 삼는다 — 되돌아가지 않고 자연스럽게 멈춘다 */
const DASH_GLIDE = 0.1;
const DASH_COOLDOWN_S = 1.2;
/** 물길 지형: 흐르는 거리 이만큼(px)마다 모양이 바뀐다. 트인 물의 폭은 1보다 넓게 둬 강둑이 화면 밖으로 물러나게 한다 */
const COURSE_SEG = 1100;
const OPEN_W = 1.3;

export type SceneOptions = {
  capacity: number;
  fill: number;
  theme: ThemeKey;
  cat: CatKey;
  reduceMotion: boolean;
  /** 화면 맨 위에서 네비게이션 바 아래까지의 높이(px). 수평선이 그 아래로 내려오게 한다 */
  topInset: () => number;
  /** 시트 윗변의 화면 y(px). 배는 수평선과 이 사이의 물길에서만 움직인다 */
  waterBottom: () => number;
  /** 구슬 하나를 건졌을 때. 유리병에 붓는 건 앱이 정한다 */
  onMarble: () => void;
};

export type SceneHandle = {
  setTheme: (k: ThemeKey) => void;
  setCat: (k: CatKey) => void;
  setMung: (on: boolean) => void;
  /** 이 시각(performance.now 기준)까지 부스터가 켜진다 */
  setBoostUntil: (t: number) => void;
  setFill: (n: number) => void;
  ripple: (clientX: number, clientY: number) => void;
  /** 수평선의 화면 y(px). 가이드 투어가 물 위 놀이 영역을 비출 때 쓴다 */
  horizonY: () => number;
  destroy: () => void;
};

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

const STARS = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.pow(Math.random(), 1.4) * 0.95, r: rnd(0.4, 1.3), p: rnd(0, TAU) }));
const RIPS = Array.from({ length: 44 }, () => ({ x: rnd(0, 1000), d: Math.random() }));
const CLOUDS = Array.from({ length: 4 }, () => ({ x: Math.random(), y: rnd(0.12, 0.5), s: rnd(0.7, 1.3) }));
const LAYERS = [
  { h: 46, amp: 22, f: 0.0062, p: 1.3, par: 0.12 },
  { h: 26, amp: 14, f: 0.012, p: 4.1, par: 0.3 },
  { h: 9, amp: 7, f: 0.024, p: 2.2, par: 0.6 },
];
const SPAWN: Record<ParticleKind, [number, number]> = {
  firefly: [0.7, 36], petal: [0.3, 80], glint: [0.045, 130], snow: [0.07, 120], rain: [0.012, 150], meteor: [2.6, 2],
};
const INITIAL: Record<ParticleKind, number> = { firefly: 26, petal: 30, glint: 60, snow: 80, rain: 90, meteor: 0 };

export function createScene(canvas: HTMLCanvasElement, opts: SceneOptions): SceneHandle {
  const ctx = canvas.getContext('2d')!;
  const reduce = opts.reduceMotion;
  let W = 1;
  let H = 1;
  let theme: Theme = THEMES[opts.theme];
  let catKey = opts.cat;
  let cat = litSkin(CATS[catKey], theme.ambient);
  let fill = opts.fill;
  let mung = false;
  let mungT = 0;
  let boostUntil = 0;
  /** 부스터가 켜진 시각 — 켜질 때 화면이 한 번 크게 흔들린다 */
  let boostFrom = 0;
  let P: Particle[] = [];
  let FX: Spark[] = [];
  let RINGS: Ring[] = [];
  let ITEMS: Item[] = [];
  let POPS: Pop[] = [];
  let WAKE: Foam[] = [];
  let GUSTS: Gust[] = [];
  let gustAcc = 0;
  let wakeAcc = 0;
  let t = 0;
  let scroll = 0;
  let spawnAcc = 0;
  /** 유리병이 가득 찬 동안 반짝이를 튀기는 간격을 잰다 */
  let fullAcc = 0;
  let marbleAcc = 0;
  let rockAcc = 0;
  let jarPulse = 0;
  let hy = 0;
  let bx = -1;
  let by = 0;
  /** 배의 물길 깊이(0~1)와 목표 위치 */
  let bk = 0.1;
  let tx = -1;
  let tk = 0.1;
  let vx = 0;
  /** 배가 실제로 움직이는 속도: 가로(px/s)와 물길 깊이(1/s) */
  let bv = 0;
  let kv = 0;
  let dashT = 0;
  let dashCd = 0;
  let kick = 0;
  let stun = 0;
  let happy = 0;
  let startled = 0;
  /** 부스터가 켜지면 1 → 0(1.1초). 고양이가 점프하고 따봉을 든다 */
  let cheer = 0;
  /** fvx·fvy는 손가락의 최근 속도(px/s) — 뗄 때 튕겼는지 본다 */
  let drag: { id: number; x: number; y: number; bx: number; bk: number; moved: boolean; lx: number; ly: number; lt: number; fvx: number; fvy: number } | null = null;
  let jx = 0;
  let jy = 0;
  let lastHy = -1;
  let raf = 0;
  let last = performance.now();

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const baseHy = () => Math.max(H * 0.27, opts.topInset() + 96);
  const surfaceY = (frac: number) => hy + 3 + frac * (H - hy - 3);
  // 배가 다니는 물길: 수평선 바로 아래부터 시트 위까지
  const laneTop = () => hy + 18;
  const laneBot = () => Math.max(laneTop() + 40, Math.min(H, opts.waterBottom()) - 22);
  const laneY = (k: number) => laneTop() + k * (laneBot() - laneTop());
  /** 가까울수록(아래일수록) 크게 */
  const scaleAt = (k: number) => 0.82 + 0.38 * k;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const smooth = (v: number) => {
    const s = clamp(v, 0, 1);
    return s * s * (3 - 2 * s);
  };

  /** 흐른 거리 u에서 물길의 가운데와 폭(깊이 단위). 구간마다 트인 물·물결형·병목형·굽이형 중 하나이고, 구간 사이는 트인 물로 이어진다 */
  function course(u: number): [number, number] {
    const i = Math.floor(u / COURSE_SEG);
    const s = u / COURSE_SEG - i;
    // 첫 구간은 트인 물로 시작한다
    const env = i < 1 ? 0 : smooth(s / 0.22) * smooth((1 - s) / 0.22);
    const h = hash(i + 3.7);
    let c = 0.5;
    let w = OPEN_W;
    if (h < 0.25) {
      // 트인 물
    } else if (h < 0.5) {
      // 물결형: 물길이 위아래로 굽이친다
      c = 0.5 + 0.18 * Math.sin(s * TAU * 2);
      w = 0.62;
    } else if (h < 0.75) {
      // 병목형: 양쪽 강둑이 좁혀 든다
      c = 0.5 + 0.05 * Math.sin(s * TAU);
      w = 0.52;
    } else {
      // 굽이형: 물길이 한쪽으로 휘었다가 돌아온다
      c = hash(i + 9.1) < 0.5 ? 0.3 : 0.7;
      w = 0.62;
    }
    return [0.5 + (c - 0.5) * env, OPEN_W + (w - OPEN_W) * env];
  }
  /** 화면 x에서 위·아래 강둑의 깊이. 0 미만·1 초과면 강둑이 물길 밖으로 물러나 있다. 풍경만 보기에서는 트인 물로 돌아간다 */
  function banks(x: number): [number, number] {
    const [c, w] = course(x + scroll);
    const open = Math.max(0, mungT);
    const top = c - w / 2 + (0.5 - OPEN_W / 2 - (c - w / 2)) * open;
    const bot = c + w / 2 + (0.5 + OPEN_W / 2 - (c + w / 2)) * open;
    return [top, bot];
  }
  /** 화면 x에서 배와 구슬이 다닐 수 있는 깊이 범위 */
  function channel(x: number): [number, number] {
    const [top, bot] = banks(x);
    return [Math.max(0, top), Math.min(1, bot)];
  }

  function blank(k: ParticleKind): Particle {
    return { k, x: 0, y: 0, a: 0, sp: 0, ph: rnd(0, TAU), life: 1, vy: 0, rot: 0, vr: 0, s: 0, lf: 0, d: 0, max: 0, landed: false, dead: false };
  }

  function spawn(k: ParticleKind, init = false) {
    const p = blank(k);
    if (k === 'firefly') {
      p.x = rnd(-10, W + 10);
      p.y = hy - rnd(8, 170);
      p.a = rnd(0, TAU);
      p.sp = rnd(5, 12);
      p.life = init ? 1 : 0;
    } else if (k === 'petal') {
      p.x = rnd(-20, W + 60);
      p.y = init ? rnd(-10, hy) : -10;
      p.vy = rnd(10, 20);
      p.rot = rnd(0, TAU);
      p.vr = rnd(-1.5, 1.5);
      p.s = rnd(2.6, 4.4);
      p.lf = Math.pow(Math.random(), 1.3) * 0.95;
    } else if (k === 'snow') {
      p.x = rnd(-20, W + 40);
      p.y = init ? rnd(-10, H * 0.7) : -10;
      p.vy = rnd(16, 34);
      p.s = rnd(0.9, 2.4);
      p.lf = Math.pow(Math.random(), 1.2) * 0.95;
    } else if (k === 'rain') {
      p.x = rnd(-20, W + 80);
      p.y = init ? rnd(-20, H * 0.7) : rnd(-40, -10);
      p.vy = rnd(420, 560);
      p.lf = Math.pow(Math.random(), 1.1) * 0.95;
    } else if (k === 'meteor') {
      // 하늘 위쪽에서 왼쪽 아래로 긋고 사라진다
      p.x = rnd(W * 0.3, W * 1.05);
      p.y = rnd(0, hy * 0.45);
      p.a = Math.PI - rnd(0.35, 0.6);
      p.sp = rnd(260, 380);
      p.max = rnd(0.6, 1.1);
      p.life = 0;
    } else {
      const d = Math.pow(Math.random(), 1.7);
      p.d = d;
      p.x = Math.random() < 0.55 ? theme.orb.x * W + rnd(-1, 1) * (20 + d * 110) : rnd(0, W);
      p.life = 0;
      p.max = rnd(0.9, 2.4);
      if (init) p.life = rnd(0, p.max);
    }
    P.push(p);
  }

  function resetParticles() {
    P = [];
    FX = [];
    hy = baseHy();
    for (let i = 0; i < INITIAL[theme.kind]; i++) spawn(theme.kind, true);
  }

  function spawnItem(k: Item['k']) {
    const r = Math.random();
    const [lo, hi] = channel(W + 30);
    ITEMS.push({ k, x: W + 30, d: lo + r * (hi - lo), r, ph: rnd(0, TAU), hit: false, dead: false });
  }

  function sparkle(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU);
      const v = rnd(14, 40);
      FX.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 14, life: 1 });
    }
  }
  function catchMarble(x: number, y: number) {
    happy = 0.8;
    POPS.push({ x, y: y - 10, text: '+1', age: 0 });
    sparkle(x, y, 6);
    opts.onMarble();
  }

  function bump(x: number, y: number) {
    stun = 0.7;
    startled = 1;
    kick = -170;
    RINGS.push({ x, y, age: 0.6 });
  }

  function dash(ux: number, uy: number) {
    const lh = laneBot() - laneTop();
    dashT = DASH_S;
    dashCd = DASH_COOLDOWN_S;
    bv = ux * DASH_SPEED;
    kv = (uy * DASH_SPEED) / lh;
    // 멈출 자리를 미리 목표로 둔다 — 대시 중에 다시 끌어도 원래 자리로 끌려가지 않게
    const left = Math.exp(-DASH_DRAG * DASH_S);
    const travel = (1 - left) / DASH_DRAG + left * DASH_GLIDE;
    tx = clamp(bx + bv * travel, 40, W - 40);
    tk = clamp(bk + kv * travel, 0, 1);
    RINGS.push({ x: bx, y: by, age: 0.3 });
  }

  // 손가락을 따라가지 않고 끈 만큼만 움직인다 — 손가락이 배를 가리지 않게. 짧게 탭하면 그 자리로 간다.
  // 빠르게 튕기고 떼면 대시
  function onDown(e: PointerEvent) {
    if (mung) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, bx: tx, bk: tk, moved: false, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, fvx: 0, fvy: 0 };
    canvas.setPointerCapture?.(e.pointerId);
  }
  function onMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    const fdt = (e.timeStamp - drag.lt) / 1000;
    if (fdt > 0) {
      const a = Math.min(1, fdt * 25);
      drag.fvx += ((e.clientX - drag.lx) / fdt - drag.fvx) * a;
      drag.fvy += ((e.clientY - drag.ly) / fdt - drag.fvy) * a;
      drag.lx = e.clientX;
      drag.ly = e.clientY;
      drag.lt = e.timeStamp;
    }
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true;
    tx = clamp(drag.bx + dx * 1.3, 40, W - 40);
    tk = clamp(drag.bk + (dy * 1.3) / (laneBot() - laneTop()), 0, 1);
  }
  function onUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) {
      const r = canvas.getBoundingClientRect();
      tx = clamp(e.clientX - r.left, 40, W - 40);
      tk = clamp((e.clientY - r.top - laneTop()) / (laneBot() - laneTop()), 0, 1);
    } else if (dashCd <= 0 && stun <= 0 && e.timeStamp - drag.lt < 80) {
      // 튕긴 뒤 멈췄다 떼면 대시가 아니다
      const sp = Math.hypot(drag.fvx, drag.fvy);
      if (sp > FLICK_SPEED) dash(drag.fvx / sp, drag.fvy / sp);
    }
    drag = null;
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  function step(p: Particle, dt: number, drift: number) {
    if (p.k === 'firefly') {
      p.life = Math.min(1, p.life + dt * 0.5);
      p.a +=rnd(-1, 1) * 1.8 * dt;
      p.x += Math.cos(p.a) * p.sp * dt - drift * 0.35 * dt;
      p.y += Math.sin(p.a) * p.sp * 0.6 * dt;
      if (p.y > hy - 4) {
        p.y = hy - 4;
        p.a = -Math.PI / 2 + rnd(-0.8, 0.8);
      }
      if (p.y < hy - 200) p.a = Math.PI / 2 + rnd(-0.8, 0.8);
      if (p.x < -20) p.dead = true;
    } else if (p.k === 'petal') {
      if (p.landed) {
        p.x -= drift * 0.6 * dt;
        p.y = surfaceY(p.lf);
        p.life -= dt / 8;
        if (p.life <= 0 || p.x < -20) p.dead = true;
        return;
      }
      p.rot += p.vr * dt;
      p.y += p.vy * dt;
      p.x += Math.sin(t * 0.9 + p.ph) * 14 * dt - drift * 0.5 * dt;
      if (p.y >= surfaceY(p.lf)) p.landed = true;
      if (p.x < -30) p.dead = true;
    } else if (p.k === 'snow' || p.k === 'rain') {
      // 물에 닿으면 눈은 녹아 사라지고, 비는 작은 파문을 남긴다
      if (p.landed) {
        p.x -= drift * (0.75 + p.lf * 0.5) * dt;
        p.life -= dt / (p.k === 'snow' ? 0.8 : 0.5);
        if (p.life <= 0) p.dead = true;
        return;
      }
      p.y += p.vy * dt;
      p.x += p.k === 'snow' ? Math.sin(t * 1.1 + p.ph) * 12 * dt - drift * 0.3 * dt : -60 * dt;
      if (p.y >= surfaceY(p.lf)) {
        p.y = surfaceY(p.lf);
        p.landed = true;
      }
      if (p.x < -30) p.dead = true;
    } else if (p.k === 'meteor') {
      p.life += dt;
      p.x += Math.cos(p.a) * p.sp * dt;
      p.y += Math.sin(p.a) * p.sp * dt;
      if (p.life > p.max || p.y > hy - 12) p.dead = true;
    } else {
      p.life += dt;
      p.x -= drift * (0.4 + p.d) * dt;
      if (p.life > p.max) p.dead = true;
    }
  }

  function update(dt: number) {
    const boost = performance.now() < boostUntil;
    // 세상이 뒤로 흐르는 속도 = 배가 나아가는 속도. 물결·돌이 같은 속도로 흘러야 배가 달리는 것처럼 보인다(구슬은 MARBLE_SPEED배 빠르게 다가온다)
    const drift = (boost ? 95 : 70) * (mung ? 0.5 : 1) * (reduce ? 0.5 : 1);
    scroll += drift * dt;
    mungT += ((mung ? 1 : 0) - mungT) * Math.min(1, dt * 1.4);
    const base = baseHy();
    hy = base + (H * 0.47 - base) * Math.max(0, mungT);
    if (Math.abs(hy - lastHy) > 0.5) {
      lastHy = hy;
      canvas.parentElement?.style.setProperty('--hy', `${hy.toFixed(1)}px`);
    }
    // 배: 목표 쪽으로 미끄러지듯 간다. 풍경만 보기에서는 가운데로 돌아가 쉰다
    if (bx < 0) bx = tx = W * 0.42;
    if (mung) {
      tx = W * 0.42;
      tk = 0.1;
    }
    const px = bx;
    // 관성: 목표 쪽으로 당기고 물이 붙잡는다. 부딪혀 멍할 때와 대시 중에는 당기지 않고 미끄러지기만 한다
    const pull = stun > 0 || dashT > 0 ? 0 : PULL;
    const wd = dashT > 0 ? DASH_DRAG : WATER_DRAG;
    const cap = dashT > 0 ? DASH_SPEED : BOAT_SPEED;
    bv = clamp(bv + ((tx - bx) * pull - bv * wd) * dt, -cap, cap);
    bx = clamp(bx + (bv + kick) * dt, 30, W - 30);
    kick *= Math.exp(-dt * 5);
    kv += ((tk - bk) * pull - kv * wd) * dt;
    bk += kv * dt;
    // 강둑에 닿으면 막혀서 강둑을 따라 미끄러진다. 아래 강둑은 배 앞을 가리므로 선체 높이만큼 띄운다
    const [lo, hi] = channel(bx);
    const lh = laneBot() - laneTop();
    const bLo = Math.min(1, lo + 4 / lh);
    const bHi = Math.max(bLo, hi - 14 / lh);
    if (bk < bLo || bk > bHi) {
      bk = clamp(bk, bLo, bHi);
      kv = 0;
    }
    if (dashT > 0) {
      dashT = Math.max(0, dashT - dt);
      if (dashT === 0) {
        tx = clamp(bx + bv * DASH_GLIDE, 40, W - 40);
        tk = clamp(bk + kv * DASH_GLIDE, 0, 1);
      }
    }
    dashCd = Math.max(0, dashCd - dt);
    vx += ((bx - px) / dt - vx) * Math.min(1, dt * 8);
    stun = Math.max(0, stun - dt);
    happy = Math.max(0, happy - dt);
    startled = Math.max(0, startled - dt);
    cheer = Math.max(0, cheer - dt / 1.1);
    const sc = scaleAt(bk);
    by = laneY(bk) + (reduce ? 0 : Math.sin(t * 1.1) * 1.6);
    jx = bx + 15 * sc;
    jy = by - 16 * sc;

    const [every, max] = SPAWN[theme.kind];
    spawnAcc += dt;
    while (spawnAcc > every) {
      spawnAcc -= every;
      if (P.length < max) spawn(theme.kind);
    }
    for (const p of P) step(p, dt, drift);
    P = P.filter((p) => !p.dead);

    // 유리병이 가득 차면 토스 포인트로 바꿀 때까지 병에서 반짝이가 계속 튄다
    if (fill >= opts.capacity && !reduce) {
      fullAcc += dt;
      if (fullAcc > 0.45) {
        fullAcc = 0;
        sparkle(jx, jy, 3);
      }
    }

    // 구슬: 배를 끌어 건지면 유리병이 찬다(다 건지면 5분에 한 병). 돌은 부딪히면 튕겨난다.
    // 병이 가득 차거나 풍경만 보기일 때는 새로 띄우지 않는다
    const spawning = !mung && fill < opts.capacity;
    const marbleEvery = boost ? BOOST_MARBLE_EVERY_S : MARBLE_EVERY_S;
    marbleAcc += dt;
    rockAcc += dt;
    if (marbleAcc >= marbleEvery) {
      marbleAcc = rnd(-0.2, 0.2) * marbleEvery;
      if (spawning) spawnItem('orb');
    }
    if (rockAcc >= ROCK_EVERY_S) {
      rockAcc = rnd(-0.3, 0.3) * ROCK_EVERY_S;
      if (spawning) spawnItem('rock');
    }
    for (const it of ITEMS) {
      it.x -= drift * (0.75 + it.d * 0.5) * (it.k === 'orb' ? MARBLE_SPEED : 1) * dt;
      if (it.x < -30) it.dead = true;
      // 물길을 따라 휘어 흐른다
      const [lo, hi] = channel(it.x);
      it.d = lo + it.r * (hi - lo);
      if (it.hit) continue;
      const iy = laneY(it.d);
      const s = scaleAt(it.d);
      const reachX = it.k === 'rock' ? 30 * sc + 8 * s : 36 * sc + 6 * s;
      if (Math.abs(it.x - bx) > reachX || Math.abs(iy - by) > 9 * sc + 5) continue;
      if (it.k === 'rock') {
        it.hit = true;
        bump(it.x, iy);
      } else if (fill < opts.capacity) {
        it.dead = true;
        catchMarble(it.x, iy);
      }
    }
    ITEMS = ITEMS.filter((it) => !it.dead);
    for (const p of POPS) p.age += dt;
    POPS = POPS.filter((p) => p.age < 1);

    for (const f of FX) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 20 * dt;
      f.life -= dt * 1.6;
    }
    FX = FX.filter((f) => f.life > 0);
    // 물보라: 꽁무니에서 위아래로 벌어지며 뒤로 흘러간다
    wakeAcc += dt;
    // 대시·부스터 중에는 물보라가 촘촘하게 인다. 부스터 물보라는 더 넓게 벌어진다
    const wakeEvery = dashT > 0 || boost ? 0.012 : 0.04;
    while (wakeAcc > wakeEvery) {
      wakeAcc -= wakeEvery;
      const side = WAKE.length % 2 ? 1 : -1;
      WAKE.push({ x: bx - 38 * sc, y: by + 3, vy: side * rnd(4, 11) * (boost ? 2.2 : 1) * sc, age: 0, big: boost });
    }
    for (const f of WAKE) {
      f.x -= drift * (0.75 + bk * 0.5) * dt;
      f.y += f.vy * dt;
      f.age += dt;
    }
    WAKE = WAKE.filter((f) => f.age < 1.6);
    // 부스터: 바람 줄기가 배가 나아가는 쪽(오른쪽)으로 물 위를 스쳐 간다
    if (boost && !mung && !reduce) {
      gustAcc += dt;
      while (gustAcc > 0.12) {
        gustAcc -= 0.12;
        const len = rnd(80, 150);
        GUSTS.push({ x: -len, y: rnd(hy - 50, laneBot()), len, sp: rnd(420, 560), ph: rnd(0, TAU) });
      }
    }
    for (const g of GUSTS) g.x += g.sp * dt;
    GUSTS = GUSTS.filter((g) => g.x - g.len < W);
    for (const r of RINGS) r.age += dt;
    RINGS = RINGS.filter((r) => r.age < 2.4);
    jarPulse = Math.max(0, jarPulse - dt * 2);
  }

  function ridgeY(L: (typeof LAYERS)[number], x: number) {
    const X = x + scroll * L.par;
    return hy - L.h - L.amp * (0.6 * Math.sin(X * L.f + L.p) + 0.3 * Math.sin(X * L.f * 2.7 + L.p * 1.9) + 0.1 * Math.sin(X * L.f * 6.3));
  }
  function hillPath(L: (typeof LAYERS)[number], mirror: boolean) {
    ctx.beginPath();
    ctx.moveTo(-4, hy);
    for (let x = -4; x <= W + 4; x += 4) {
      const y = ridgeY(L, x);
      ctx.lineTo(x, mirror ? hy + (hy - y) * 0.6 : y);
    }
    ctx.lineTo(W + 4, hy);
    ctx.closePath();
  }
  function glowDot(x: number, y: number, r: number, rgb: string, a: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function drawBoat() {
    const f = fill / opts.capacity;
    const sc = scaleAt(bk);
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(sc, sc);
    ctx.rotate((reduce ? 0 : Math.sin(t * 0.9) * 0.035) + clamp(vx / 1800, -0.07, 0.07));
    ctx.globalCompositeOperation = 'lighter';
    glowDot(15, -16, 16 + f * 46 + jarPulse * 12, theme.glowRGB, 0.16 + 0.34 * f + jarPulse * 0.2);
    ctx.globalCompositeOperation = 'source-over';
    drawCat(ctx, cat, { t, look: clamp(vx / 90, -1, 1), happy: happy / 0.8, startled, cheer, still: reduce, rim: `rgba(${theme.orb.rgb},.6)`, rimSide: theme.orb.x * W > bx ? 1 : -1 });
    // 유리병
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath();
    ctx.roundRect(8, -27, 14, 19, 4);
    ctx.fill();
    const lh = 16 * f;
    if (lh > 0.5) {
      ctx.fillStyle = theme.glow;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.roundRect(9.5, -9.5 - lh, 11, lh, 3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(8, -27, 14, 19, 4);
    ctx.stroke();
    ctx.fillStyle = cat.boat.rim;
    ctx.fillRect(9, -30, 12, 3.5);
    // 배 — 고양이 스킨에 맞춘 색
    ctx.fillStyle = cat.boat.hull;
    ctx.beginPath();
    ctx.moveTo(-44, -9);
    ctx.quadraticCurveTo(-34, 10, -2, 11);
    ctx.quadraticCurveTo(32, 10, 46, -11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = cat.boat.rim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-44, -9);
    ctx.lineTo(46, -11);
    ctx.stroke();
    ctx.strokeStyle = cat.boat.band;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-38, -1);
    ctx.quadraticCurveTo(0, 6, 40, -4);
    ctx.stroke();
    ctx.restore();
  }

  function drawPetal(p: Particle, a: number) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffc3d3';
    ctx.beginPath();
    ctx.ellipse(0, 0, p.s, p.s * 0.58, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff9fba';
    ctx.beginPath();
    ctx.ellipse(p.s * 0.35, 0, p.s * 0.45, p.s * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function drawGlint(x: number, y: number, s: number, rgb: string, a: number) {
    ctx.strokeStyle = `rgba(${rgb},${a})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s * 0.55);
    ctx.lineTo(x, y + s * 0.55);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
  }

  /** 오로라 두 겹 — 아랫단이 밝고 위로 갈수록 옅어지는 세로 줄을 촘촘히 세운다. mirror면 물에 비친 모습 */
  function drawAurora([lo, hi]: [string, string], mirror: boolean) {
    const drift = reduce ? 0 : t;
    ctx.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 2; band++) {
      for (let x = 0; x < W; x += 3) {
        // HUD에 가리지 않게 하늘 위쪽(네비게이션 바 뒤)에 띄운다
        const base = hy * (0.3 + band * 0.1) + hy * 0.07 * Math.sin(x * 0.011 + drift * 0.25 + band * 2) + hy * 0.04 * Math.sin(x * 0.029 - drift * 0.4);
        const h = hy * (0.24 + 0.08 * Math.sin(x * 0.017 + drift * 0.35 + band));
        const a = (band ? 0.16 : 0.22) * (0.45 + 0.55 * Math.sin(x * 0.043 + drift * 1.2 + band * 3) ** 2) * (mirror ? 0.45 : 1);
        for (let s = 0; s < 3; s++) {
          ctx.fillStyle = `rgba(${s ? hi : lo},${a * (1 - s * 0.3)})`;
          if (mirror) ctx.fillRect(x, hy + (hy - base + (h * s) / 3) * 0.6, 3, (h / 3) * 0.6);
          else ctx.fillRect(x, base - (h * (s + 1)) / 3, 3, h / 3);
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawItem(it: Item) {
    const s = scaleAt(it.d);
    const bob = reduce ? 0 : Math.sin(t * 2.2 + it.ph) * 1.6;
    const y = laneY(it.d);
    ctx.strokeStyle = `rgba(${theme.ripple},.35)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(it.x, y + 3 * s, (it.k === 'rock' ? 17 : 10) * s, 2.6 * s, 0, 0, TAU);
    ctx.stroke();
    if (it.k === 'rock') {
      // 장애물은 풍경마다 다르다(연잎·나무판자·부표…). 떠 있는 것이라 구슬보다 얕게 출렁인다
      drawObstacle(ctx, theme.obstacle, it.x, y + 3 * s + bob * 0.5, s);
      return;
    }
    const cy = y - 3 * s + bob;
    ctx.globalCompositeOperation = 'lighter';
    glowDot(it.x, cy, 17 * s, theme.glowRGB, 0.5 + 0.15 * Math.sin(t * 3 + it.ph));
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = theme.glow;
    ctx.beginPath();
    ctx.arc(it.x, cy, 4.6 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.arc(it.x - 1.4 * s, cy - 1.5 * s, 1.5 * s, 0, TAU);
    ctx.fill();
  }

  /** 강둑: 풍경의 산 색으로 칠한 땅, 물에 젖어 빛나는 물가, 드문드문 선 갈대. top이면 수평선 쪽(배 뒤), 아니면 시트 쪽(배 앞) */
  function drawBank(top: boolean) {
    const th = theme;
    const edge: number[] = [];
    for (let x = -6; x <= W + 6; x += 6) {
      const [a, b] = banks(x);
      edge.push(top ? Math.max(hy, laneY(a)) : Math.min(H, laneY(b)));
    }
    const y0 = top ? hy : H;
    const visible = (y: number) => (top ? y > hy + 1 : y < H - 1);
    if (!edge.some(visible)) return;
    // 밤 풍경에서도 물과 구분되게 산 색 중 밝은 쪽을 쓴다
    ctx.fillStyle = th.hills[top ? 0 : 1];
    ctx.beginPath();
    ctx.moveTo(-6, y0);
    edge.forEach((y, i) => ctx.lineTo(-6 + i * 6, y));
    ctx.lineTo(W + 6, y0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(${th.ripple},.5)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    edge.forEach((y, i) => (i && visible(y) ? ctx.lineTo(-6 + i * 6, y) : ctx.moveTo(-6 + i * 6, y)));
    ctx.stroke();
    // 갈대: 강둑과 같이 흘러가도록 흐른 거리에 고정해 둔다
    const s = scaleAt(top ? 0 : 1);
    ctx.strokeStyle = th.hills[2];
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath();
    const j0 = Math.floor(scroll / 16);
    for (let j = j0; j < j0 + W / 16 + 2; j++) {
      if (hash(j * 1.31 + (top ? 0 : 50)) < 0.6) continue;
      const x = j * 16 - scroll;
      const y = edge[clamp(Math.round((x + 6) / 6), 0, edge.length - 1)];
      if (!visible(y)) continue;
      const base = top ? y - 2 : y + 5 * s;
      const hgt = (7 + hash(j + 7) * 7) * s;
      for (let n = -1; n <= 1; n++) {
        ctx.moveTo(x + n * 2.5 * s, base);
        ctx.lineTo(x + n * 4 * s, base - hgt * (n ? 0.8 : 1));
      }
    }
    ctx.stroke();
  }

  function draw() {
    const th = theme;
    // 하늘
    let g = ctx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, th.sky[0]);
    g.addColorStop(0.6, th.sky[1]);
    g.addColorStop(1, th.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, hy + 1);
    for (let i = 0; i < th.stars; i++) {
      const s = STARS[i];
      const a = (th.kind === 'firefly' || th.kind === 'meteor' ? 0.75 : 0.4) * (0.55 + 0.45 * Math.sin(t * 1.3 + s.p)) * (1 - s.y * 0.6);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * hy * 0.85, s.r, 0, TAU);
      ctx.fill();
    }
    if (th.aurora) drawAurora(th.aurora, false);
    const ox = th.orb.x * W;
    const oy = th.orb.y * hy;
    glowDot(ox, oy, th.orb.r * 5, th.orb.rgb, 0.35);
    ctx.fillStyle = th.orb.c;
    ctx.beginPath();
    ctx.arc(ox, oy, th.orb.r, 0, TAU);
    ctx.fill();
    for (let i = 0; i < th.clouds; i++) {
      const c = CLOUDS[i];
      const span = W + 240;
      const cx = (((c.x * span - scroll * 0.08 * c.s) % span) + span) % span - 120;
      const cy = c.y * hy;
      ctx.fillStyle = `rgba(${th.cloud},.5)`;
      for (let j = 0; j < 5; j++) {
        ctx.beginPath();
        ctx.ellipse(cx + (j - 2) * 16 * c.s, cy - Math.sin(j * 1.3) * 5 * c.s, 22 * c.s, 9 * c.s, 0, 0, TAU);
        ctx.fill();
      }
    }
    // 산
    LAYERS.forEach((L, i) => {
      ctx.fillStyle = th.hills[i];
      hillPath(L, false);
      ctx.fill();
    });
    if (th.blossom) {
      const L = LAYERS[1];
      const off = scroll * L.par;
      const j0 = Math.floor(off / 22) - 1;
      for (let j = j0; j < j0 + W / 22 + 3; j++) {
        if (hash(j) < 0.45) continue;
        const x = j * 22 - off;
        const y = ridgeY(L, x);
        const r = 4 + hash(j + 9) * 5;
        ctx.fillStyle = '#f3bccb';
        ctx.beginPath();
        ctx.arc(x, y + r * 0.4, r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fbdde5';
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y, r * 0.5, 0, TAU);
        ctx.fill();
      }
    }
    g = ctx.createLinearGradient(0, hy - 40, 0, hy);
    g.addColorStop(0, `rgba(${th.orb.rgb},0)`);
    g.addColorStop(1, `rgba(${th.orb.rgb},.18)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, hy - 40, W, 40);
    // 물
    g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, th.water[0]);
    g.addColorStop(1, th.water[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, hy, W, H - hy);
    ctx.globalAlpha = 0.3;
    LAYERS.forEach((L, i) => {
      ctx.fillStyle = th.hills[i];
      hillPath(L, true);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (th.aurora) drawAurora(th.aurora, true);
    // 달·해 물빛 기둥
    for (let y = hy + 2; y < H; y += 3) {
      const k = (y - hy) / (H - hy);
      const half = (3 + k * 44) * (0.35 + 0.65 * Math.abs(Math.sin(t * 1.1 + y * 0.19 + Math.sin(y * 0.05 + t * 0.4))));
      ctx.fillStyle = `rgba(${th.orb.rgb},${0.5 * (1 - k) * (1 - k)})`;
      ctx.fillRect(ox - half + Math.sin(t * 0.9 + y * 0.08) * 3, y, half * 2, 1.2);
    }
    for (const r of RIPS) {
      const y = surfaceY(r.d);
      const span = W + 120;
      // 구슬과 같은 원근 속도로 흘린다(가까울수록 빠르게)
      const sp = 0.75 + r.d * 1.4;
      const x = (((r.x - scroll * sp) % span) + span) % span - 60;
      ctx.fillStyle = `rgba(${th.ripple},${0.08 + 0.12 * r.d})`;
      ctx.fillRect(x, y, 12 + r.d * 60, 1);
    }
    for (const r of RINGS) {
      const k = r.age / 2.4;
      for (let n = 0; n < 3; n++) {
        const kk = k - n * 0.12;
        if (kk <= 0) continue;
        ctx.strokeStyle = `rgba(${th.ripple},${0.45 * (1 - kk)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, 6 + kk * 70, (6 + kk * 70) * 0.28, 0, 0, TAU);
        ctx.stroke();
      }
    }
    // 물 위 입자
    ctx.globalCompositeOperation = 'lighter';
    for (const p of P) {
      if (p.k === 'glint') {
        const a = Math.sin((Math.PI * p.life) / p.max);
        drawGlint(p.x, surfaceY(p.d), 2 + p.d * 7 * a, th.glowRGB, 0.9 * a);
      }
      if (p.k === 'firefly') {
        const a = p.life * (0.5 + 0.5 * Math.sin(t * 2.2 + p.ph));
        glowDot(p.x, hy + (hy - p.y) * 0.9, 5, th.glowRGB, 0.22 * a);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of P) if (p.k === 'petal' && p.landed) drawPetal(p, 0.85 * p.life);
    for (const p of P) {
      if (!p.landed) continue;
      if (p.k === 'snow') {
        ctx.fillStyle = `rgba(255,255,255,${0.7 * p.life})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.s * 1.2, p.s * 0.45, 0, 0, TAU);
        ctx.fill();
      } else if (p.k === 'rain') {
        const r = (1 - p.life) * (4 + p.lf * 8);
        ctx.strokeStyle = `rgba(${th.ripple},${0.55 * p.life})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 1 + r, (1 + r) * 0.3, 0, 0, TAU);
        ctx.stroke();
      }
    }
    drawBank(true);
    // 떠내려오는 것은 배보다 먼 것 → 배 → 가까운 것 순서로 그린다
    for (const it of ITEMS) if (laneY(it.d) <= by) drawItem(it);
    for (const f of WAKE) {
      const k = f.age / 1.6;
      ctx.fillStyle = f.big ? `rgba(255,255,255,${0.85 * (1 - k) * (1 - k)})` : `rgba(${th.ripple},${0.7 * (1 - k) * (1 - k)})`;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, (3 + k * 9) * (f.big ? 1.6 : 1), (1 + k * 0.8) * (f.big ? 1.5 : 1), 0, 0, TAU);
      ctx.fill();
    }
    // 배 반영, 배
    const sc = scaleAt(bk);
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.translate(0, 2 * (by + 3));
    ctx.scale(1, -1);
    drawBoat();
    ctx.restore();
    ctx.strokeStyle = `rgba(${th.ripple},.35)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 46 * sc, by + 3.5);
    ctx.lineTo(bx + 48 * sc, by + 2.5);
    ctx.stroke();
    drawBoat();
    for (const it of ITEMS) if (laneY(it.d) > by) drawItem(it);
    drawBank(false);
    // 부스터 바람 줄기: 물결치듯 휘어진 선. 가운데가 밝고 양끝이 흐려진다 — 곧은 물결 반짝임과 구분되게
    ctx.save();
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (const g of GUSTS) {
      const grad = ctx.createLinearGradient(g.x - g.len, 0, g.x, 0);
      grad.addColorStop(0, 'rgba(235,246,255,0)');
      grad.addColorStop(0.65, 'rgba(235,246,255,.95)');
      grad.addColorStop(1, 'rgba(235,246,255,0)');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        const x = g.x - g.len + u * g.len;
        const y = g.y + Math.sin(u * TAU + g.ph + t * 6) * 4;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    // 공중 입자
    ctx.globalCompositeOperation = 'lighter';
    for (const p of P) {
      if (p.k === 'firefly') {
        const a = p.life * (0.45 + 0.55 * Math.sin(t * 2.2 + p.ph));
        glowDot(p.x, p.y, 9, th.glowRGB, 0.55 * a);
        ctx.fillStyle = `rgba(255,255,230,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, TAU);
        ctx.fill();
      }
      if (p.k === 'meteor') {
        // 머리는 밝게, 꼬리는 지나온 쪽으로 옅어진다. 나타날 때와 사라질 때는 흐리게
        const a = Math.sin((Math.PI * p.life) / p.max);
        const tx0 = p.x - Math.cos(p.a) * 70;
        const ty0 = p.y - Math.sin(p.a) * 70;
        const g = ctx.createLinearGradient(tx0, ty0, p.x, p.y);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, `rgba(255,255,255,${0.85 * a})`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(tx0, ty0);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        glowDot(p.x, p.y, 7, th.glowRGB, 0.6 * a);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of P) if (p.k === 'petal' && !p.landed) drawPetal(p, 0.92);
    for (const p of P) {
      if (p.landed) continue;
      if (p.k === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.s, 0, TAU);
        ctx.fill();
      } else if (p.k === 'rain') {
        ctx.strokeStyle = 'rgba(225,235,245,.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 60 * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const f of FX) glowDot(f.x, f.y, 4, th.glowRGB, 0.8 * f.life);
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '700 17px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const p of POPS) {
      ctx.fillStyle = `rgba(255,255,255,${1 - p.age * p.age})`;
      ctx.shadowColor = `rgba(${th.glowRGB},.9)`;
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y - p.age * 26);
    }
    ctx.shadowBlur = 0;
  }

  /** 부스터 중 화면 가장자리의 파란 빛. 켜지고 꺼질 때는 서서히 밝아지고 흐려진다 */
  function drawBoostEdge(now: number) {
    const env = Math.min(1, (now - boostFrom) / 300, (boostUntil - now) / 400);
    const a = env * (reduce ? 0.35 : 0.3 + 0.15 * Math.sin(t * 8));
    const e = 36;
    // 아래쪽은 시트에 가려지므로 시트 윗변을 테두리로 삼는다
    const B = Math.min(H, opts.waterBottom());
    const edges: [number, number, number, number, number, number, number, number][] = [
      [0, 0, 0, e, 0, 0, W, e],
      [0, B, 0, B - e, 0, B - e, W, e],
      [0, 0, e, 0, 0, 0, e, B],
      [W, 0, W - e, 0, W - e, 0, e, B],
    ];
    for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(90,176,255,${a})`);
      g.addColorStop(1, 'rgba(90,176,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(rx, ry, rw, rh);
    }
  }

  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    update(dt);
    const boostFx = now < boostUntil && !mung;
    // 부스터: 켜지는 순간 크게, 이후로는 잔잔하게 화면이 흔들린다. 흔들려도 가장자리가 비지 않게 살짝 확대한다
    const shake = boostFx && !reduce ? 1 + 3 * Math.max(0, 1 - (now - boostFrom) / 600) : 0;
    if (shake) {
      ctx.save();
      ctx.translate(W / 2 + rnd(-shake, shake), H / 2 + rnd(-shake, shake));
      ctx.scale(1 + 10 / W, 1 + 10 / W);
      ctx.translate(-W / 2, -H / 2);
    }
    draw();
    if (shake) ctx.restore();
    if (boostFx) drawBoostEdge(now);
    raf = requestAnimationFrame(frame);
  }

  resetParticles();
  raf = requestAnimationFrame(frame);

  return {
    setTheme(k) {
      theme = THEMES[k];
      cat = litSkin(CATS[catKey], theme.ambient);
      resetParticles();
    },
    setCat(k) {
      catKey = k;
      cat = litSkin(CATS[k], theme.ambient);
    },
    setMung(on) {
      mung = on;
      drag = null;
    },
    setBoostUntil(v) {
      boostUntil = v;
      boostFrom = performance.now();
      cheer = 1;
      const sc = scaleAt(bk);
      POPS.push({ x: bx - 10 * sc, y: by - 48 * sc, text: '야옹!', age: 0 });
    },
    setFill(n) {
      // 구슬을 부어 병이 찼을 때도 병이 반짝이게
      if (n > fill) {
        jarPulse = 1;
        sparkle(jx, jy, 10);
      }
      fill = n;
    },
    ripple(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      const y = clientY - r.top;
      if (y > hy + 4) RINGS.push({ x: clientX - r.left, y, age: 0 });
    },
    horizonY() {
      return canvas.getBoundingClientRect().top + hy;
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    },
  };
}
