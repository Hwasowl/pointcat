// 배경음(잔잔한 물소리 + 풍경마다 다른 음악)과 효과음(빛이 들어올 때 맑은 음)을 따로 켜고 끈다. 광고 재생·백그라운드 전환 동안은 멈춘다.
// 음원 파일 없이 Web Audio로 그 자리에서 만든다 — 화음 위에 음계 안의 음을 드문드문 얹는 앰비언트.

import type { ThemeKey } from '../scene/themes';

type Music = {
  bpm: number;
  /** 한 마디에 하나씩 도는 화음(MIDI 음 번호) */
  chords: number[][];
  /** 멜로디·효과음이 고르는 음계(MIDI) */
  scale: number[];
  pad: OscillatorType;
  lead: OscillatorType;
  /** 8분음표 자리마다 멜로디 음이 나올 확률 */
  density: number;
  /** 화음 소리의 밝기(저역 통과 주파수) */
  bright: number;
  /** 환경음 크기: 빗소리, 바람, 물결 출렁임 */
  rain: number;
  wind: number;
  swell: number;
};

const MUSIC: Record<ThemeKey, Music> = {
  // 반딧불 호수 — 느린 A단조, Am F C G
  night: {
    bpm: 60, chords: [[57, 60, 64], [53, 57, 60], [48, 55, 60, 64], [55, 59, 62]], scale: [69, 72, 74, 76, 79, 81, 84],
    pad: 'triangle', lead: 'sine', density: 0.35, bright: 900, rain: 0, wind: 0, swell: 0.1,
  },
  // 벚꽃 강 — 오르골 같은 D장조, D Bm G A
  spring: {
    bpm: 76, chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 55, 59, 62], [45, 57, 61, 64]], scale: [74, 76, 78, 81, 83, 86, 88],
    pad: 'triangle', lead: 'triangle', density: 0.5, bright: 1400, rain: 0, wind: 0, swell: 0.1,
  },
  // 노을 바다 — 몽환적인 maj7, Fmaj7 Em7 Dm7 Cmaj7, 파도가 깊게 출렁인다
  sunset: {
    bpm: 64, chords: [[41, 53, 57, 60, 64], [40, 52, 55, 59, 62], [38, 50, 53, 57, 60], [36, 48, 52, 55, 59]], scale: [65, 67, 69, 72, 74, 77, 79],
    pad: 'triangle', lead: 'sine', density: 0.3, bright: 1000, rain: 0, wind: 0, swell: 0.2,
  },
  // 눈꽃 호수 — 높고 드문 종소리, Em Cmaj7 G D, 바람
  snow: {
    bpm: 56, chords: [[40, 52, 55, 59], [36, 52, 55, 59], [43, 55, 59, 62], [38, 54, 57, 62]], scale: [76, 79, 81, 83, 86, 88, 91],
    pad: 'triangle', lead: 'sine', density: 0.3, bright: 800, rain: 0, wind: 1, swell: 0.06,
  },
  // 여름 소나기 — 로파이 G장조 maj7, 빗소리
  rain: {
    bpm: 70, chords: [[43, 55, 59, 62, 66], [40, 55, 59, 62], [36, 52, 55, 59], [38, 54, 57, 59]], scale: [67, 69, 71, 74, 76, 79, 81],
    pad: 'triangle', lead: 'triangle', density: 0.4, bright: 1100, rain: 1, wind: 0, swell: 0.08,
  },
  // 오로라 호수 — C 리디안, 길게 퍼지는 톱니파 패드, 옅은 바람
  aurora: {
    bpm: 50, chords: [[36, 55, 60, 64], [36, 54, 57, 62], [36, 55, 59, 64], [36, 52, 60, 67]], scale: [72, 74, 76, 78, 79, 83, 84, 86],
    pad: 'sawtooth', lead: 'sine', density: 0.25, bright: 700, rain: 0, wind: 0.5, swell: 0.1,
  },
};

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

let ac: AudioContext | null = null;
let master: GainNode | null = null;
/** 배경음(음악+물·비·바람)과 효과음(구슬 건질 때)은 따로 켜고 끈다 */
let bgOn = false;
let fxOn = false;
let bg: GainNode | null = null;
let fx: GainNode | null = null;
const holds = new Set<string>();
let theme: ThemeKey = 'night';

let music: GainNode | null = null;
let echo: GainNode | null = null;
let padLp: BiquadFilterNode | null = null;
let rainG: GainNode | null = null;
let windG: GainNode | null = null;
let swellG: GainNode | null = null;
let nextBar = 0;
let bar = 0;
/** 멜로디가 음계 위를 조금씩 걸어 다니는 자리 */
let mel = 3;

function noise(brown: boolean) {
  const buf = ac!.createBuffer(1, ac!.sampleRate * 4, ac!.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (!brown) {
      d[i] = w;
      continue;
    }
    last = (last + 0.02 * w) / 1.02;
    d[i] = last * 3.2;
  }
  const src = ac!.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.start();
  return src;
}

function lfo(freq: number, depth: number, target: AudioParam) {
  const o = ac!.createOscillator();
  const g = ac!.createGain();
  o.frequency.value = freq;
  g.gain.value = depth;
  o.connect(g).connect(target);
  o.start();
  return g;
}

function start() {
  ac = new AudioContext();
  master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  bg = ac.createGain();
  bg.gain.value = 0;
  bg.connect(master);
  fx = ac.createGain();
  fx.gain.value = 0;
  fx.connect(master);

  // 물소리
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 520;
  const g = ac.createGain();
  g.gain.value = 0.08;
  swellG = lfo(0.08, MUSIC[theme].swell * 0.36, g.gain);
  noise(true).connect(lp).connect(g).connect(bg);

  // 빗소리: 흰 소음의 높은 쪽만
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1400;
  const rlp = ac.createBiquadFilter();
  rlp.type = 'lowpass';
  rlp.frequency.value = 7000;
  rainG = ac.createGain();
  rainG.gain.value = 0;
  noise(false).connect(hp).connect(rlp).connect(rainG).connect(bg);

  // 바람: 좁은 대역이 천천히 오르내린다
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 520;
  bp.Q.value = 1.2;
  lfo(0.06, 260, bp.frequency);
  windG = ac.createGain();
  windG.gain.value = 0;
  noise(true).connect(bp).connect(windG).connect(bg);

  // 음악 버스 + 메아리(되먹임 지연)
  music = ac.createGain();
  music.gain.value = 1;
  music.connect(bg);
  padLp = ac.createBiquadFilter();
  padLp.type = 'lowpass';
  padLp.connect(music);
  echo = ac.createGain();
  echo.gain.value = 0.3;
  const delay = ac.createDelay(2);
  delay.delayTime.value = 0.42;
  const fb = ac.createGain();
  fb.gain.value = 0.35;
  const dlp = ac.createBiquadFilter();
  dlp.type = 'lowpass';
  dlp.frequency.value = 2400;
  echo.connect(delay).connect(dlp).connect(fb).connect(delay);
  dlp.connect(music);

  applyTheme();
  window.setInterval(tick, 200);
}

/** 환경음과 화음 밝기를 지금 풍경에 맞춰 천천히 옮긴다 */
function applyTheme() {
  if (!ac || !rainG || !windG || !swellG || !padLp) return;
  const m = MUSIC[theme];
  const now = ac.currentTime;
  rainG.gain.setTargetAtTime(m.rain * 0.007, now, 1);
  windG.gain.setTargetAtTime(m.wind * 0.07, now, 1);
  swellG.gain.setTargetAtTime(m.swell * 0.36, now, 1);
  padLp.frequency.setTargetAtTime(m.bright, now, 1);
}

function padNote(f: number, t: number, dur: number, type: OscillatorType, level: number) {
  const g = ac!.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 1.2);
  g.gain.setTargetAtTime(0, t + dur - 1.2, 0.5);
  g.connect(padLp!);
  for (const cents of [-6, 6]) {
    const o = ac!.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = cents;
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 1.5);
  }
}

function bell(f: number, t: number, type: OscillatorType, level: number, out: AudioNode, toEcho: boolean) {
  for (const [fr, v] of [[f, level], [f * 2, level / 4]] as const) {
    const o = ac!.createOscillator();
    const g = ac!.createGain();
    o.type = type;
    o.frequency.value = fr;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    o.connect(g).connect(out);
    if (toEcho) g.connect(echo!);
    o.start(t);
    o.stop(t + 2.3);
  }
}

function scheduleBar(t0: number) {
  const m = MUSIC[theme];
  const beat = 60 / m.bpm;
  const len = beat * 4;
  const chord = m.chords[bar % m.chords.length];
  for (const n of chord) padNote(hz(n), t0, len + 1.2, m.pad, (m.pad === 'sawtooth' ? 0.021 : 0.042) / chord.length);
  for (let i = 0; i < 8; i++) {
    if (Math.random() > (i % 2 ? m.density * 0.4 : m.density)) continue;
    mel = Math.max(0, Math.min(m.scale.length - 1, mel + pick([-2, -1, -1, 1, 1, 2])));
    bell(hz(m.scale[mel]), t0 + (i * beat) / 2 + Math.random() * 0.03, m.lead, 0.025, music!, true);
  }
  bar++;
}

function tick() {
  if (!ac || !bgOn || holds.size > 0 || ac.state !== 'running') return;
  const now = ac.currentTime;
  if (nextBar < now) nextBar = now + 0.1;
  while (nextBar < now + 0.6) {
    scheduleBar(nextBar);
    nextBar += (60 / MUSIC[theme].bpm) * 4;
  }
}

function apply() {
  if (!ac || !master || !bg || !fx) return;
  if (holds.size > 0) {
    ac.suspend().catch(() => {});
    return;
  }
  const now = ac.currentTime;
  if (bgOn || fxOn) ac.resume().catch(() => {});
  master.gain.cancelScheduledValues(now);
  master.gain.setTargetAtTime(bgOn || fxOn ? 0.7 : 0, now, 0.3);
  bg.gain.setTargetAtTime(bgOn ? 1 : 0, now, bgOn ? 0.4 : 0.3);
  fx.gain.setTargetAtTime(fxOn ? 1 : 0, now, 0.05);
}

export const sound = {
  /** 둘 다 사용자 탭 안에서 불러야 한다(자동 재생 제한) */
  setBg(next: boolean) {
    bgOn = next;
    if (next && !ac) start();
    apply();
  },
  setFx(next: boolean) {
    fxOn = next;
    if (next && !ac) start();
    apply();
  },
  /** 풍경이 바뀌면 다음 마디부터 그 풍경의 음악으로 넘어간다 */
  setTheme(k: ThemeKey) {
    theme = k;
    applyTheme();
  },
  hold(reason: string) {
    holds.add(reason);
    apply();
  },
  release(reason: string) {
    holds.delete(reason);
    apply();
  },
  chime() {
    if (!fxOn || !ac || !fx || holds.size > 0) return;
    // 지금 풍경의 음계에서 한 옥타브 위 음을 고른다(너무 높은 음계는 그대로)
    const n = pick(MUSIC[theme].scale);
    bell(hz(n < 76 ? n + 12 : n), ac.currentTime, 'sine', 0.06, fx, false);
  },
  /** 부스터가 켜질 때 — 바람이 쏴아 하고 지나가는 소리(대역을 올렸다 내리는 흰 소음) */
  whoosh() {
    if (!fxOn || !ac || !fx || holds.size > 0) return;
    const t = ac.currentTime;
    const src = noise(false);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.5);
    bp.frequency.exponentialRampToValueAtTime(600, t + 1.3);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    src.connect(bp).connect(g).connect(fx);
    src.stop(t + 1.5);
  },
  /** 부스터가 켜질 때 고양이가 '먀-옹' — 음높이를 올렸다 내리고, 입 모양(대역)을 열었다 닫는다 */
  meow() {
    if (!fxOn || !ac || !fx || holds.size > 0) return;
    const t = ac.currentTime + 0.12;
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(560, t);
    o.frequency.exponentialRampToValueAtTime(860, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(470, t + 0.5);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(2000, t + 0.16);
    bp.frequency.exponentialRampToValueAtTime(750, t + 0.5);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.05);
    g.gain.setValueAtTime(0.12, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(bp).connect(g).connect(fx);
    o.start(t);
    o.stop(t + 0.6);
  },
};
