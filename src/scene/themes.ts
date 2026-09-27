import type { ObstacleKind } from './obstacles';

export type ThemeKey = 'night' | 'spring' | 'sunset' | 'snow' | 'rain' | 'aurora';
export type ParticleKind = 'firefly' | 'petal' | 'glint' | 'snow' | 'rain' | 'meteor';

export type Theme = {
  name: string;
  sub: string;
  kind: ParticleKind;
  /** 물 위에 떠내려와 배를 튕겨 내는 장애물 */
  obstacle: ObstacleKind;
  sky: [string, string, string];
  hills: [string, string, string];
  water: [string, string];
  orb: { x: number; y: number; r: number; c: string; rgb: string };
  glowRGB: string;
  glow: string;
  /** 고양이 털색에 섞는 주변광과 그 비율 */
  ambient: [string, number];
  stars: number;
  clouds: number;
  cloud: string;
  ripple: string;
  blossom?: boolean;
  /** 하늘 윗부분이 밝아서 흰 네비게이션 아이콘이 묻히는 테마 */
  lightSky?: boolean;
  /** 하늘에 오로라 커튼을 두 겹 그린다. 아래쪽 색과 위쪽 색(rgb) */
  aurora?: [string, string];
};

export const THEMES: Record<ThemeKey, Theme> = {
  night: {
    name: '반딧불 호수', sub: '밤', kind: 'firefly', obstacle: 'lily',
    sky: ['#0a0f2c', '#1a2156', '#3b3f7c'], hills: ['#272e66', '#1b2152', '#11163c'], water: ['#161c4a', '#05081c'],
    orb: { x: 0.76, y: 0.34, r: 14, c: '#fff4d6', rgb: '255,244,214' }, glowRGB: '230,255,143', glow: '#e6ff8f',
    ambient: ['#2b3478', 0.3], stars: 90, clouds: 0, cloud: '255,255,255', ripple: '170,180,255',
  },
  spring: {
    name: '벚꽃 강', sub: '봄 오후', kind: 'petal', obstacle: 'plank',
    sky: ['#9fcdf0', '#d6eaf6', '#fbe4ea'], hills: ['#cfe0d6', '#a9cab8', '#83ae96'], water: ['#a6cde2', '#6795b4'],
    orb: { x: 0.2, y: 0.32, r: 20, c: '#fffaf0', rgb: '255,250,235' }, glowRGB: '255,176,198', glow: '#ffb0c6',
    ambient: ['#f3d6de', 0.12], stars: 0, clouds: 4, cloud: '255,255,255', ripple: '255,255,255',
    blossom: true, lightSky: true,
  },
  sunset: {
    name: '노을 바다', sub: '해 질 녘', kind: 'glint', obstacle: 'buoy',
    sky: ['#2f2f63', '#b56a8e', '#f6b48a'], hills: ['#9b6283', '#71476d', '#4a3152'], water: ['#7a4f73', '#2a1f3f'],
    orb: { x: 0.56, y: 0.86, r: 24, c: '#ffe3b3', rgb: '255,214,160' }, glowRGB: '255,216,156', glow: '#ffd89c',
    ambient: ['#9a5a86', 0.28], stars: 16, clouds: 3, cloud: '255,200,178', ripple: '255,214,186',
  },
  snow: {
    name: '눈꽃 호수', sub: '겨울 밤', kind: 'snow', obstacle: 'ice',
    sky: ['#1d2740', '#39486a', '#6d7ea0'], hills: ['#dfe8f3', '#b9c8da', '#8ea2bb'], water: ['#2f3d5c', '#0f1629'],
    orb: { x: 0.28, y: 0.3, r: 13, c: '#f3f7ff', rgb: '225,235,255' }, glowRGB: '170,220,255', glow: '#aadcff',
    ambient: ['#4a5a80', 0.22], stars: 30, clouds: 0, cloud: '255,255,255', ripple: '200,215,255',
  },
  rain: {
    name: '여름 소나기', sub: '비 오는 오후', kind: 'rain', obstacle: 'log',
    sky: ['#4a5563', '#7d8a96', '#a9b3b9'], hills: ['#5f7166', '#4a5c52', '#35463d'], water: ['#5b6b73', '#28343b'],
    orb: { x: 0.7, y: 0.3, r: 18, c: '#cdd4d6', rgb: '225,230,225' }, glowRGB: '255,217,138', glow: '#ffd98a',
    ambient: ['#6b7a86', 0.2], stars: 0, clouds: 4, cloud: '150,162,175', ripple: '200,215,225',
  },
  aurora: {
    name: '오로라 호수', sub: '별똥별 밤', kind: 'meteor', obstacle: 'berg',
    sky: ['#050b1c', '#0c1f3a', '#1a3a52'], hills: ['#1c3346', '#12263a', '#0a1a2b'], water: ['#0e2436', '#030a14'],
    orb: { x: 0.84, y: 0.18, r: 8, c: '#f4f8ff', rgb: '220,235,255' }, glowRGB: '140,255,200', glow: '#8cffc8',
    ambient: ['#1d4a5a', 0.3], stars: 90, clouds: 0, cloud: '255,255,255', ripple: '150,230,220',
    aurora: ['120,255,190', '150,120,255'],
  },
};

export const THEME_KEYS: ThemeKey[] = ['night', 'spring', 'sunset', 'snow', 'rain', 'aurora'];
