import { Storage } from '@apps-in-toss/web-framework';
import type { CatKey } from '../scene/cats';
import type { ThemeKey } from '../scene/themes';

export type SaveData = {
  day: string;
  /** 유리병이 찬 칸 수(0 ~ JAR_CAPACITY) */
  fill: number;
  /** 모으는 중인 구슬(0 ~ MARBLES_PER_POUR - 1). 다 모이면 유리병에 붓고 0부터 다시 모은다 */
  marbles: number;
  /** 오늘 토스 포인트로 교환한 횟수(한도는 pointsToday로 센다) */
  jarsToday: number;
  pointsToday: number;
  pointsTotal: number;
  mungSecToday: number;
  streak: number;
  theme: ThemeKey;
  /** 광고를 보고 연 풍경. 기본 풍경(night)은 처음부터 열려 있다 */
  unlockedThemes: ThemeKey[];
  cat: CatKey;
  /** 열린 고양이. 처음 들어와 고른 한 마리 + 광고를 보고 연 고양이 */
  unlockedCats: CatKey[];
  /** 첫 진입의 고양이 고르기를 마쳤는지. false면 고르기 화면을 띄운다 */
  catPicked: boolean;
  /** 광고는 끝까지 봤는데 지급이 실패한 병. 다시 누르면 광고 없이 지급을 재시도한다 */
  pendingGrant: boolean;
  /** 마지막으로 저장한 시각(ms). 다음 실행에서 방치 보상을 계산한다. 0이면 계산하지 않는다 */
  lastSeen: number;
};

const KEY = 'yunseul.save.v1';

const pad = (n: number) => String(n).padStart(2, '0');
const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dayOf(new Date());
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayOf(d);
};

export const DEFAULT_SAVE: SaveData = {
  day: today(),
  fill: 0,
  marbles: 0,
  jarsToday: 0,
  pointsToday: 0,
  pointsTotal: 0,
  mungSecToday: 0,
  streak: 1,
  theme: 'night',
  unlockedThemes: ['night'],
  cat: 'black',
  unlockedCats: [],
  catPicked: false,
  pendingGrant: false,
  lastSeen: 0,
};

/** 날짜가 바뀌었으면 하루 단위 값을 새로 채운다 */
export function rollDay(d: SaveData): SaveData {
  const now = today();
  if (d.day === now) return d;
  return {
    ...d,
    day: now,
    jarsToday: 0,
    pointsToday: 0,
    mungSecToday: 0,
    streak: d.day === yesterday() ? d.streak + 1 : 1,
  };
}

export async function loadSave(): Promise<SaveData> {
  try {
    const raw = await Storage.getItem(KEY);
    if (!raw) return DEFAULT_SAVE;
    return rollDay({ ...DEFAULT_SAVE, ...(JSON.parse(raw) as Partial<SaveData>) });
  } catch {
    return DEFAULT_SAVE;
  }
}

// 저장할 때마다 시각을 찍어 둔다 — 앱을 나간 시점을 알아야 방치 보상을 계산할 수 있다
const stamp = (d: SaveData) => JSON.stringify({ ...d, lastSeen: Date.now() });

let timer = 0;
export function saveLater(d: SaveData) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    Storage.setItem(KEY, stamp(d)).catch(() => {});
  }, 400);
}

/** 포인트 지급 전후처럼 늦게 저장하면 앱이 꺼졌을 때 포인트가 두 번 나갈 수 있는 순간에 바로 저장한다 */
export function saveNow(d: SaveData) {
  window.clearTimeout(timer);
  return Storage.setItem(KEY, stamp(d)).catch(() => {});
}
