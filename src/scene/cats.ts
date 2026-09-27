export type CatKey = 'black' | 'cheese' | 'mackerel' | 'tuxedo' | 'calico' | 'blue';

export type CatSkin = {
  name: string;
  sub: string;
  fur: string;
  /** 이마 줄무늬. 없으면 그리지 않는다 */
  stripe?: string;
  /** 입 둘레 무늬. 없으면 그리지 않는다 */
  muzzle?: string;
  /** 머리 왼쪽·오른쪽 얼룩(귀 포함). 없으면 그리지 않는다 */
  patch?: [string, string];
  /** 앞발 */
  light: string;
  /** 점 눈. 주변광을 섞지 않아 어두운 풍경에서도 또렷하다 */
  eye: string;
  mouth: string;
  /** 고양이와 어울리는 배. hull 몸통, rim 뱃전·병뚜껑, band 몸통 띠 */
  boat: { hull: string; rim: string; band: string };
};

export const CATS: Record<CatKey, CatSkin> = {
  black: { name: '까망이', sub: '검은 고양이', fur: '#2a2633', light: '#3b3547', eye: '#ffe07a', mouth: '#8d84a6',
    boat: { hull: '#3a3350', rim: '#e9b949', band: '#5d5180' } },
  cheese: { name: '치즈', sub: '주황 줄무늬', fur: '#ffd29a', stripe: '#f0a35e', light: '#fff6ea', eye: '#3b2a22', mouth: '#3b2a22',
    boat: { hull: '#a8683f', rim: '#ffe0b0', band: '#f0a35e' } },
  mackerel: { name: '고등어', sub: '회색 줄무늬', fur: '#b9bdc8', stripe: '#6f7482', light: '#f6f7fa', eye: '#2b2d35', mouth: '#2b2d35',
    boat: { hull: '#55667d', rim: '#e3eaf2', band: '#8ea2ba' } },
  tuxedo: { name: '턱시도', sub: '검정과 흰색', fur: '#2b2b33', muzzle: '#f5f5f7', light: '#f5f5f7', eye: '#b6e36b', mouth: '#6b6b78',
    boat: { hull: '#2f3446', rim: '#f0f0f3', band: '#c9434e' } },
  calico: { name: '삼색이', sub: '삼색 얼룩', fur: '#fbf4ea', patch: ['#e59a52', '#3a3238'], light: '#ffffff', eye: '#3b2a22', mouth: '#3b2a22',
    boat: { hull: '#8c5a3c', rim: '#fff1dc', band: '#e59a52' } },
  blue: { name: '러시안블루', sub: '초록 눈', fur: '#8e9bb0', light: '#a9b4c6', eye: '#9fe07a', mouth: '#4b5466',
    boat: { hull: '#44506a', rim: '#cfe6c4', band: '#7d8bb0' } },
};

export const CAT_KEYS: CatKey[] = ['black', 'cheese', 'mackerel', 'tuxedo', 'calico', 'blue'];

const mix = (a: string, b: string, k: number) => {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k)).join(',')})`;
};

/** 풍경의 주변광을 털색·배 색에 섞는다 — 고양이와 배가 같은 빛 아래 있는 것처럼 보이게 */
export function litSkin(skin: CatSkin, [ambient, k]: [string, number]): CatSkin {
  return {
    ...skin,
    fur: mix(skin.fur, ambient, k),
    stripe: skin.stripe && mix(skin.stripe, ambient, k),
    muzzle: skin.muzzle && mix(skin.muzzle, ambient, k),
    patch: skin.patch && [mix(skin.patch[0], ambient, k), mix(skin.patch[1], ambient, k)],
    light: mix(skin.light, ambient, k),
    mouth: mix(skin.mouth, ambient, k),
    boat: { hull: mix(skin.boat.hull, ambient, k), rim: mix(skin.boat.rim, ambient, k), band: mix(skin.boat.band, ambient, k) },
  };
}
