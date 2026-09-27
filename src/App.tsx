import { SafeArea } from '@apps-in-toss/web-framework';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { BannerAd } from './components/BannerAd';
import { CatFace } from './components/CatFace';
import { Close } from './components/icons';
import { Tour, type TourStep } from './components/Tour';
import {
  AWAY_FILL_PER_HOUR,
  AWAY_MAX_FILL,
  BOOST_EVERY_MS,
  BOOST_MS,
  DAILY_EXCHANGE_LIMIT,
  INTERSTITIAL_AD_GROUP_ID,
  JAR_CAPACITY,
  LIFETIME_POINT_CAP,
  MARBLES_PER_POUR,
  POINT_PER_JAR,
  POUR_FILL,
  REWARDED_AD_GROUP_ID,
} from './config';
import { grantBlockedReason, grantJarReward } from './lib/reward';
import { sound } from './lib/sound';
import { DEFAULT_SAVE, loadSave, rollDay, type SaveData, saveLater, saveNow } from './lib/store';
import { useRewardedAd } from './lib/useRewardedAd';
import { createScene, type SceneHandle } from './scene/engine';
import { CAT_KEYS, CATS, type CatKey } from './scene/cats';
import { THEME_KEYS, THEMES, type ThemeKey } from './scene/themes';

// 투명 네비게이션 바의 높이. 공식 문서에 값이 없어 추정값을 쓴다 — 실기기에서 확인한다.
const NAV_H = 54;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readInsets() {
  try {
    return SafeArea.get();
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}
const HOUR_MS = 3_600_000;
/** 나가 있던 시간만큼 병에 더할 칸 수. 한 번에 AWAY_MAX_FILL까지, 병의 남은 칸을 넘지 않는다 */
const awayFill = (ms: number, fill: number) =>
  Math.min(JAR_CAPACITY - fill, AWAY_MAX_FILL, Math.max(0, Math.floor((ms / HOUR_MS) * AWAY_FILL_PER_HOUR)));
const awayFor = (ms: number) => {
  const h = Math.floor(ms / HOUR_MS);
  return h < 24 ? `${h}시간` : `${Math.floor(h / 24)}일`;
};
const pct = (cells: number) => Math.floor((cells / JAR_CAPACITY) * 100);
const AWAY_RULE = `앱을 꺼 둬도 1시간마다 유리병이 ${pct(AWAY_FILL_PER_HOUR)}%씩 차요 (최대 ${pct(AWAY_MAX_FILL)}%)`;

/** 한 번 true가 되면 계속 true — 첫 로드 순서만 맞추고, 이후 광고를 다시 불러올 때는 흔들리지 않게 한다 */
function useOnce(cond: boolean) {
  const [on, setOn] = useState(cond);
  if (cond && !on) setOn(true);
  return on;
}
const LOCK = (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="3" y="7" width="10" height="7" rx="2" fill="currentColor" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export default function App() {
  const [save, setSave] = useState<SaveData | null>(null);
  const [insets, setInsets] = useState(readInsets);
  const [bgOn, setBgOn] = useState(false);
  const [fxOn, setFxOn] = useState(false);
  /** 스피커를 누르면 여는 배경음·효과음 메뉴 */
  const [soundOpen, setSoundOpen] = useState(false);
  const soundOn = bgOn || fxOn;
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState('');
  const [themeOpen, setThemeOpen] = useState(false);
  /** 첫 진입 고르기 화면에서 지금 누른 고양이 */
  const [starter, setStarter] = useState<CatKey>('black');
  /** 고양이를 고른 직후 한 번 보여 주는 가이드 투어 */
  const [touring, setTouring] = useState(false);
  /** 돌아왔을 때 보여 줄 방치 보상 안내. 병은 이미 찬 뒤라 닫기만 한다 */
  /** 부스터 주기: 지금 켜져 있는지, 이번 단계(충전·부스터)가 끝나는 시각 */
  const [wind, setWind] = useState({ on: false, until: 0 });
  const [now, setNow] = useState(() => Date.now());
  const [away, setAway] = useState<{ ms: number; added: number; full: boolean } | null>(null);
  /** 다시 눌러도 풀리지 않는 지급 실패의 안내 문구. 있으면 이번 실행 동안 교환 카드를 막는다 */
  const [grantStop, setGrantStop] = useState(grantBlockedReason);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const scene = useRef<SceneHandle | null>(null);
  const saveRef = useRef<SaveData | null>(null);
  const insetsRef = useRef(insets);
  const claiming = useRef(false);
  const snackTimer = useRef(0);
  /** 유리병 게이지를 연속으로 누른 횟수와 마지막으로 누른 시각 — 가이드 투어 다시 보기 */
  const jarTaps = useRef({ n: 0, t: 0 });
  // 광고 그룹은 하나씩 순서대로 로드한다: 전면형 → 보상형 → 배너
  const short = useRewardedAd(INTERSTITIAL_AD_GROUP_ID, { interstitial: true });
  const ad = useRewardedAd(REWARDED_AD_GROUP_ID, { enabled: useOnce(short.state !== 'loading') });
  // 한 번 붙인 배너는 광고를 다시 불러오는 동안에도 떼지 않는다(상시 노출)
  const bannerOn = useOnce(short.state !== 'loading' && ad.state !== 'loading');

  useEffect(() => {
    saveRef.current = save;
    if (save) saveLater(save);
  }, [save]);
  useEffect(() => {
    insetsRef.current = insets;
  }, [insets]);

  // 앱을 다시 열면 지난번에 나간 뒤로 흐른 시간만큼 유리병을 채운다
  useEffect(() => {
    loadSave().then((d) => {
      const ms = d.lastSeen ? Date.now() - d.lastSeen : 0;
      const n = awayFill(ms, d.fill);
      if (!n) {
        setSave(d);
        return;
      }
      const next = { ...d, fill: d.fill + n };
      setSave(next);
      saveNow(next); // 바로 저장해 두어야 곧장 꺼져도 같은 시간으로 두 번 차지 않는다
      if (ms >= HOUR_MS) setAway({ ms, added: n, full: next.fill >= JAR_CAPACITY });
    });
  }, []);

  useEffect(() => {
    try {
      return SafeArea.subscribe({ onEvent: setInsets });
    } catch {
      return undefined;
    }
  }, []);

  const ready = save !== null;
  useEffect(() => {
    const initial = saveRef.current;
    if (!ready || !initial || !canvasRef.current) return;
    const s = createScene(canvasRef.current, {
      capacity: JAR_CAPACITY,
      fill: initial.fill,
      theme: initial.theme,
      cat: initial.cat,
      reduceMotion,
      topInset: () => insetsRef.current.top + NAV_H,
      waterBottom: () => sheetRef.current?.getBoundingClientRect().top ?? window.innerHeight,
      onMarble: () => {
        sound.chime();
        // 구슬이 다 모이면 유리병에 붓고 0부터 다시 모은다
        setSave((x) => {
          if (!x) return x;
          const m = x.marbles + 1;
          if (m < MARBLES_PER_POUR) return { ...x, marbles: m };
          return { ...x, marbles: m - MARBLES_PER_POUR, fill: Math.min(JAR_CAPACITY, x.fill + POUR_FILL) };
        });
      },
    });
    scene.current = s;
    return () => {
      s.destroy();
      scene.current = null;
    };
  }, [ready]);

  const fill = save?.fill ?? 0;
  const theme = save?.theme ?? 'night';
  useEffect(() => scene.current?.setFill(fill), [fill]);
  useEffect(() => scene.current?.setTheme(theme), [theme]);
  useEffect(() => sound.setTheme(theme), [theme]);
  const cat = save?.cat ?? 'black';
  useEffect(() => scene.current?.setCat(cat), [cat]);

  // 1초 시계: 부스터까지 남은 초, 날짜 바뀜
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      setSave((x) => x && rollDay(x));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // 백그라운드로 가면 소리를 멈추고, 돌아오면 나가 있던 시간만큼 유리병을 채운다.
  // 한 시간 미만이면 안내 창 없이 병만 반짝이며 찬다
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.hidden) {
        sound.hold('bg');
        hiddenAt = Date.now();
        if (saveRef.current) saveNow(saveRef.current); // 나간 시각을 남겨 둔다(앱이 꺼져도 다음 실행에서 계산)
        return;
      }
      sound.release('bg');
      const ms = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      if (!saveRef.current) return;
      const n = awayFill(ms, saveRef.current.fill);
      if (!n) return;
      const next = { ...saveRef.current, fill: saveRef.current.fill + n };
      setSave(next);
      saveNow(next);
      if (ms >= HOUR_MS) setAway({ ms, added: n, full: next.fill >= JAR_CAPACITY });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // 부스터: 30초 동안 게이지가 차오르면 저절로 5초 동안 켜진다(광고 없음)
  useEffect(() => {
    if (!ready) return;
    let id = 0;
    const phase = (on: boolean) => {
      const ms = on ? BOOST_MS : BOOST_EVERY_MS;
      setWind({ on, until: Date.now() + ms });
      if (on) {
        scene.current?.setBoostUntil(performance.now() + ms);
        sound.whoosh();
      }
      id = window.setTimeout(() => phase(!on), ms);
    };
    id = window.setTimeout(() => phase(false), 0);
    return () => window.clearTimeout(id);
  }, [ready]);

  const showSnack = useCallback((msg: string) => {
    setSnack(msg);
    window.clearTimeout(snackTimer.current);
    snackTimer.current = window.setTimeout(() => setSnack(''), 2400);
  }, []);

  // 구슬 수가 줄었다 = 유리병에 부었다
  const marbles = save?.marbles ?? 0;
  const prevMarbles = useRef(marbles);
  useEffect(() => {
    if (marbles < prevMarbles.current) showSnack(`구슬 ${MARBLES_PER_POUR}개를 유리병에 부었어요`);
    prevMarbles.current = marbles;
  }, [marbles, showSnack]);

  const s = save ?? DEFAULT_SAVE;
  const full = s.fill >= JAR_CAPACITY;
  // 유리병이 가득 차면 바로 토스 포인트로 바꿀 수 있다
  const canExchange = full;
  const dailyDone = s.jarsToday >= DAILY_EXCHANGE_LIMIT;
  const capDone = s.pointsTotal + POINT_PER_JAR > LIFETIME_POINT_CAP;

  const toggleBg = () => {
    sound.setBg(!bgOn);
    setBgOn(!bgOn);
  };
  const toggleFx = () => {
    sound.setFx(!fxOn);
    setFxOn(!fxOn);
  };

  const claim = async () => {
    if (claiming.current || !save || dailyDone || capDone || grantStop) return;
    if (!s.pendingGrant) {
      if (!canExchange) return;
      if (short.state === 'failed') {
        short.reload();
        return;
      }
      if (short.state !== 'ready') return;
    }
    claiming.current = true;
    setBusy(true);
    if (!s.pendingGrant) {
      // 짧은 광고(전면형 5초)를 보면 가득 찬 유리병을 토스 포인트로 바꾼다
      const earned = await short.show();
      if (!earned) {
        claiming.current = false;
        setBusy(false);
        showSnack('광고를 보여주지 못했어요. 다시 눌러 주세요');
        return;
      }
      setSave((x) => x && { ...x, pendingGrant: true });
      // 지급을 요청하기 전에 '광고 봤음'이 저장돼 있어야 도중에 꺼져도 광고를 다시 보지 않는다
      if (saveRef.current) await saveNow({ ...saveRef.current, pendingGrant: true });
    }
    const r = await grantJarReward(POINT_PER_JAR);
    if (r.ok) {
      const granted = (x: SaveData): SaveData => ({
        ...x,
        fill: 0,
        pendingGrant: false,
        jarsToday: x.jarsToday + 1,
        pointsToday: x.pointsToday + POINT_PER_JAR,
        pointsTotal: x.pointsTotal + POINT_PER_JAR,
      });
      setSave((x) => x && granted(x));
      // 지급 직후 바로 저장한다 — 늦으면 다시 열었을 때 남은 pendingGrant로 한 번 더 지급된다
      if (saveRef.current) saveNow(granted(saveRef.current));
      sound.chime();
      showSnack('토스 포인트를 받았어요');
    } else {
      showSnack(r.message);
      // 예산 소진처럼 다시 눌러도 같은 실패면 버튼을 막는다. 광고 본 기록(pendingGrant)은 남겨 다음 실행에서 광고 없이 다시 받는다
      if (!r.retryable) setGrantStop(r.message);
    }
    claiming.current = false;
    setBusy(false);
  };

  useEffect(() => {
    if (!themeOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setThemeOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [themeOpen]);

  useEffect(() => {
    if (!soundOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSoundOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [soundOpen]);

  /** 잠긴 배경·고양이는 광고를 끝까지 보면 열린다 */
  const unlockWithAd = async (unlock: (x: SaveData) => SaveData, doneMsg: string) => {
    if (claiming.current) return;
    if (ad.state === 'unsupported') {
      showSnack('토스 앱을 업데이트하면 열 수 있어요');
      return;
    }
    if (ad.state === 'failed') {
      ad.reload();
      showSnack('광고를 다시 불러오고 있어요');
      return;
    }
    if (ad.state !== 'ready') {
      showSnack('광고를 준비하고 있어요');
      return;
    }
    claiming.current = true;
    setBusy(true);
    const earned = await ad.show();
    if (earned) {
      setSave((x) => x && unlock(x));
      showSnack(doneMsg);
    } else {
      showSnack('광고를 끝까지 보면 열려요');
    }
    claiming.current = false;
    setBusy(false);
  };
  const pickTheme = (k: ThemeKey) => {
    if (s.unlockedThemes.includes(k)) setSave((x) => x && { ...x, theme: k });
    else unlockWithAd((x) => ({ ...x, theme: k, unlockedThemes: [...x.unlockedThemes, k] }), `${THEMES[k].name} 배경이 열렸어요`);
  };
  // 처음 고른 한 마리는 광고 없이 연다. 나머지는 꾸미기에서 긴 광고(30초)를 보면 열린다
  const startWith = () => {
    setSave((x) => x && { ...x, cat: starter, unlockedCats: x.unlockedCats.includes(starter) ? x.unlockedCats : [...x.unlockedCats, starter], catPicked: true });
    setTouring(true);
  };
  const pickCat = (k: CatKey) => {
    if (s.unlockedCats.includes(k)) setSave((x) => x && { ...x, cat: k });
    else unlockWithAd((x) => ({ ...x, cat: k, unlockedCats: [...x.unlockedCats, k] }), `${CATS[k].name}가 배에 탔어요`);
  };

  // 가이드 투어 순서: 게이지 → 배 → 교환 카드 → 소리·꾸미기
  const tourSteps = useMemo<TourStep[]>(() => {
    const q = (k: string) => () => document.querySelector(`[data-tour="${k}"]`);
    return [
      {
        target: q('gauges'),
        title: '구슬을 모아 유리병을 채워요',
        body: `구슬 ${MARBLES_PER_POUR}개를 모으면 유리병이 ${pct(POUR_FILL)}% 차요. ${BOOST_EVERY_MS / 1000}초마다 부스터가 켜져 구슬이 많이 떠올라요`,
      },
      {
        target: () => {
          // 수평선부터 시트 위까지, 배가 다니는 물 전체를 비춘다
          const top = scene.current?.horizonY();
          const bottom = sheetRef.current?.getBoundingClientRect().top;
          return top === undefined || bottom === undefined ? null : { left: 12, top: top + 6, width: window.innerWidth - 24, height: bottom - top - 24 };
        },
        title: '배를 끌어 구슬을 건져요',
        body: '돌에 부딪히면 배가 튕겨나요',
      },
      {
        target: q('exchange'),
        title: '가득 차면 토스 포인트로 바꿔요',
        body: '짧은 광고를 보면 바로 받아요',
      },
      {
        target: q('tools'),
        title: '소리와 꾸미기',
        body: '배경음을 켜고 배경과 고양이를 바꿔요',
      },
    ];
  }, []);
  // 투어가 시트를 스크롤해 두었으니 끝나면 맨 위로 되돌린다
  const endTour = useCallback(() => {
    setTouring(false);
    sheetRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  // 유리병 게이지를 1초 안쪽 간격으로 20번 이어서 누르면 가이드 투어를 다시 띄운다(숨은 기능)
  const tapJar = () => {
    const h = jarTaps.current;
    const t = Date.now();
    h.n = t - h.t < 1000 ? h.n + 1 : 1;
    h.t = t;
    if (h.n < 20) return;
    h.n = 0;
    setTouring(true);
  };

  // 교환 카드 상태 — 설명 한 줄과 받기 버튼
  let claimDesc: string;
  let claimOn = false;
  let claimAd = true;
  let claimLabel = '광고 보고 토스 포인트 받기';
  if (capDone) {
    claimDesc = '받을 수 있는 포인트를 모두 받았어요';
    claimAd = false;
  } else if (dailyDone) {
    claimDesc = `오늘은 ${DAILY_EXCHANGE_LIMIT}번 모두 받았어요. 내일 다시 받을 수 있어요`;
    claimAd = false;
  } else if (grantStop) {
    claimDesc = grantStop;
    claimAd = false;
  } else if (busy) {
    claimDesc = '포인트를 보내고 있어요';
  } else if (s.pendingGrant) {
    claimDesc = '광고는 이미 봤어요. 눌러서 다시 받아요';
    claimLabel = '포인트 다시 받기';
    claimOn = true;
    claimAd = false;
  } else if (!canExchange) {
    claimDesc = '유리병이 가득 차면 받을 수 있어요';
  } else if (short.state === 'unsupported') {
    claimDesc = '토스 앱을 업데이트하면 받을 수 있어요';
  } else if (short.state === 'failed') {
    claimDesc = '광고를 불러오지 못했어요';
    claimLabel = '광고 다시 불러오기';
    claimOn = true;
  } else if (short.state !== 'ready') {
    claimDesc = '광고를 준비하고 있어요';
  } else {
    claimDesc = `오늘 ${DAILY_EXCHANGE_LIMIT - s.jarsToday}번 더 받을 수 있어요`;
    claimOn = true;
  }

  const th = THEMES[theme];
  const style = {
    '--safe-top': `${insets.top}px`,
    '--safe-bottom': `${insets.bottom}px`,
    '--nav-h': `${NAV_H}px`,
  } as CSSProperties;

  return (
    <div className={`app${th.lightSky ? ' light-sky' : ''}`} style={style}>
      <div className="stage" onClick={(e) => scene.current?.ripple(e.clientX, e.clientY)}>
        <canvas ref={canvasRef} className="scene" role="img" aria-label={`${th.name} 배경. 배를 끌어서 물 위의 구슬을 건지면 유리병이 차요`} />
        <div className="scrim" aria-hidden="true" />

        <div className="hud">
          <div className="balance">
            <div className="gauges" data-tour="gauges">
              <div className={`gauge${full ? ' full' : ''}`} onClick={tapJar}>
                <svg className="gauge-ic" viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="5" y="1" width="6" height="2" rx="0.6" fill="#c79a6b" />
                  <rect x="3.5" y="3" width="9" height="12" rx="3" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.7)" />
                  <rect x="5" y={13.5 - (s.fill / JAR_CAPACITY) * 8} width="6" height={(s.fill / JAR_CAPACITY) * 8} rx="1.6" fill="#fff3c4" />
                </svg>
                <span>유리병</span>
                <span className="bar" aria-hidden="true">
                  <i style={{ width: `${(s.fill / JAR_CAPACITY) * 100}%` }} />
                </span>
                <span>{Math.floor((s.fill / JAR_CAPACITY) * 100)}%</span>
              </div>
              <div className="gauge">
                <svg className="gauge-ic" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.5" fill={th.glow} />
                  <circle cx="6.3" cy="6.2" r="1.8" fill="#fff" />
                </svg>
                <span>구슬</span>
                <span className="bar" aria-hidden="true">
                  <i style={{ width: `${(s.marbles / MARBLES_PER_POUR) * 100}%` }} />
                </span>
                <span>
                  {s.marbles}/{MARBLES_PER_POUR}
                </span>
              </div>
              {/* 부스터: 30초 동안 막대가 차오르고, 켜진 5초 동안은 파랗게 빛나며 줄어든다 */}
              <div className={`gauge wind${wind.on ? ' on' : ''}`}>
                <svg className="gauge-ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <path d="M2 7h10a2.5 2.5 0 1 0-2.5-2.5" />
                  <path d="M2 11h13a2.5 2.5 0 1 1-2.5 2.5" />
                  <path d="M2 15h5" />
                </svg>
                <span>부스터</span>
                <span className="bar" aria-hidden="true">
                  <i key={wind.until} className={wind.on ? 'drain' : 'charge'} style={{ animationDuration: `${wind.on ? BOOST_MS : BOOST_EVERY_MS}ms` }} />
                </span>
                <span>{wind.on ? '작동 중' : `${Math.max(0, Math.ceil((wind.until - now) / 1000))}초`}</span>
              </div>
            </div>
          </div>
          <div className="tools" data-tour="tools">
            <button
              type="button"
              className="tool"
              aria-pressed={soundOn}
              aria-label="소리 설정"
              aria-expanded={soundOpen}
              aria-controls="sound-panel"
              onClick={(e) => {
                e.stopPropagation();
                setSoundOpen((v) => !v);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                {!soundOn && (
                  <defs>
                    <mask id="mute-cut">
                      <rect width="20" height="20" fill="#fff" />
                      <path d="M3 3l14 14" stroke="#000" strokeWidth="4.6" strokeLinecap="round" />
                    </mask>
                  </defs>
                )}
                <path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="currentColor" mask={soundOn ? undefined : 'url(#mute-cut)'} />
                {soundOn ? (
                  <path d="M13 7c1.3 1.6 1.3 4.4 0 6M15.5 5c2.6 3 2.6 7 0 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                ) : (
                  <path d="M3 3l14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                )}
              </svg>
            </button>
            <button
              type="button"
              className="tool"
              aria-label="꾸미기"
              aria-expanded={themeOpen}
              aria-controls="theme-panel"
              onClick={(e) => {
                e.stopPropagation();
                setThemeOpen((v) => !v);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M10 2.5a7.5 7.5 0 0 0 0 15c1.1 0 1.7-.8 1.7-1.6 0-.5-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6h1.9c1.9 0 3.5-1.6 3.5-3.5 0-3.4-3.5-6.1-7.9-6.1z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <circle cx="6" cy="10" r="1.2" fill="currentColor" />
                <circle cx="7.4" cy="6.5" r="1.2" fill="currentColor" />
                <circle cx="11" cy="5.4" r="1.2" fill="currentColor" />
                <circle cx="14.2" cy="7.4" r="1.2" fill="currentColor" />
              </svg>
            </button>
          </div>
          {full && !touring && (
            <div className="toast sparkle">
              <span className="bang" aria-hidden="true">
                !
              </span>
              <span>
                <b>유리병이 가득 찼어요</b>
                <small>아래에서 토스 포인트로 바꿔요</small>
              </span>
            </div>
          )}
        </div>
      </div>

      <section ref={sheetRef} className="sheet" aria-label="유리병과 보상">
        <div className="sheet-body">
          {/* 유리병 → 토스 포인트. 가득 차면 카드가 반짝이며 받기 버튼이 켜진다 */}
          <section className={`card exch${claimOn && full ? ' ready' : ''}`} aria-label="토스 포인트 교환" data-tour="exchange">
            <strong>유리병을 토스 포인트로 바꿔요</strong>
            {claimAd && <span className="ad">짧은 광고</span>}
            {/* 배너까지 첫 화면에 보이도록 유리병은 진행 막대 한 줄로 */}
            <div className="jar-row">
              <svg viewBox="0 0 34 34" aria-hidden="true">
                <rect x="10" y="3" width="14" height="4" rx="1.2" fill="#c79a6b" />
                <rect x="8" y="7" width="18" height="24" rx="6" fill="#e9f3ff" stroke="#b9d4f2" strokeWidth="1.4" />
                <rect x="11" y={28 - (s.fill / JAR_CAPACITY) * 14} width="12" height={Math.max(0.01, (s.fill / JAR_CAPACITY) * 14)} rx="4" fill="#ffd66b" />
              </svg>
              <span className="jar-bar" aria-hidden="true">
                <i style={{ width: `${(s.fill / JAR_CAPACITY) * 100}%` }} />
              </span>
              <b>{full ? '가득' : `${pct(s.fill)}%`}</b>
            </div>
            <p className="desc">{claimDesc}</p>
            <button type="button" className="exch-btn" aria-disabled={!claimOn || busy} onClick={claim}>
              {claimLabel}
            </button>
          </section>

          <BannerAd enabled={bannerOn} />

          <div className="today">
            <div>
              <small>오늘 교환</small>
              <b>
                {s.jarsToday}/{DAILY_EXCHANGE_LIMIT}번
              </b>
            </div>
            <div>
              <small>연속 방문</small>
              <b>{s.streak}일째</b>
            </div>
          </div>
          <p className="away-hint">
            {AWAY_RULE}
            <br />
            {/* 프로모션 사전 점검 체크리스트의 필수 고지 문구 */}
            토스 포인트 이벤트는 사전 고지 없이 중단될 수 있어요
          </p>
        </div>
      </section>

      {soundOpen && (
        <>
          <div className="theme-backdrop" aria-hidden="true" onClick={() => setSoundOpen(false)} />
          <div id="sound-panel" className="sound-panel" role="dialog" aria-label="소리">
            <button type="button" role="switch" aria-checked={bgOn} className="sound-row" onClick={toggleBg}>
              <span>
                <b>배경음</b>
                <small>음악과 물소리</small>
              </span>
              <i className="switch" aria-hidden="true" />
            </button>
            <button type="button" role="switch" aria-checked={fxOn} className="sound-row" onClick={toggleFx}>
              <span>
                <b>효과음</b>
                <small>구슬을 모을 때</small>
              </span>
              <i className="switch" aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {themeOpen && (
        <>
          <div className="theme-backdrop" aria-hidden="true" onClick={() => setThemeOpen(false)} />
          <div id="theme-panel" className="theme-panel" role="dialog" aria-label="꾸미기">
            <div className="theme-head">
              <h2>꾸미기</h2>
              <button type="button" className="icon-btn" aria-label="닫기" onClick={() => setThemeOpen(false)}>
                <Close size={20} />
              </button>
            </div>
            <p className="skin-note">
              {LOCK}
              <span>자물쇠가 걸린 배경과 고양이는 긴 광고(30초)를 끝까지 보면 열려요</span>
            </p>
            <h3 className="skin-label">배경</h3>
            <div className="theme-row">
              {THEME_KEYS.map((k) => {
                const locked = !s.unlockedThemes.includes(k);
                return (
                  <button key={k} type="button" className={`theme-chip${locked ? ' locked' : ''}`} aria-pressed={theme === k} onClick={() => pickTheme(k)}>
                    <i style={{ background: `linear-gradient(160deg, ${THEMES[k].sky[0]}, ${THEMES[k].sky[2]})` }}>{locked && LOCK}</i>
                    <b>{THEMES[k].name}</b>
                    <small>{locked ? '광고 보고 열기' : THEMES[k].sub}</small>
                  </button>
                );
              })}
            </div>
            <h3 className="skin-label">고양이</h3>
            <div className="theme-row">
              {CAT_KEYS.map((k) => {
                const locked = !s.unlockedCats.includes(k);
                return (
                  <button key={k} type="button" className={`theme-chip cat-chip${locked ? ' locked' : ''}`} aria-pressed={cat === k} onClick={() => pickCat(k)}>
                    <i>
                      <CatFace skin={CATS[k]} />
                      {locked && LOCK}
                    </i>
                    <b>{CATS[k].name}</b>
                    <small>{locked ? '광고 보고 열기' : CATS[k].sub}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {away && (
        <>
          <div className="away-dim" aria-hidden="true" onClick={() => setAway(null)} />
          <div className="away" role="dialog" aria-modal="true" aria-labelledby="away-title">
            <svg className="away-ic" viewBox="0 0 56 56" aria-hidden="true">
              <circle cx="28" cy="28" r="26" fill="#ffd66b" opacity="0.25" />
              <circle cx="28" cy="28" r="15" fill="#ffd66b" />
            </svg>
            <h2 id="away-title">
              {away.full ? '쉬는 동안 유리병이 가득 찼어요' : `쉬는 동안 유리병이 ${pct(away.added)}% 찼어요`}
            </h2>
            <p>
              {awayFor(away.ms)} 동안 자리를 비웠어요
              <br />
              {away.full ? '아래에서 짧은 광고를 보고 토스 포인트로 바꿔요' : AWAY_RULE}
            </p>
            <button type="button" className="away-ok" onClick={() => setAway(null)}>
              확인
            </button>
          </div>
        </>
      )}

      {save && !save.catPicked && !away && (
        <>
          <div className="away-dim" aria-hidden="true" />
          <div className="away starter" role="dialog" aria-modal="true" aria-labelledby="starter-title">
            <h2 id="starter-title">함께 배에 탈 고양이를 골라요</h2>
            <p>나머지 고양이는 꾸미기에서 획득할 수 있어요</p>
            <div className="starter-row">
              {CAT_KEYS.map((k) => (
                <button key={k} type="button" className="theme-chip cat-chip starter-chip" aria-pressed={starter === k} onClick={() => setStarter(k)}>
                  <i>
                    <CatFace skin={CATS[k]} size={52} />
                  </i>
                  <b>{CATS[k].name}</b>
                  <small>{CATS[k].sub}</small>
                </button>
              ))}
            </div>
            <button type="button" className="away-ok" onClick={startWith}>
              {CATS[starter].name}와 시작하기
            </button>
          </div>
        </>
      )}

      {touring && <Tour steps={tourSteps} onDone={endTour} />}

      <div className={`snack${snack ? ' on' : ''}`} role="status">
        {snack}
      </div>
    </div>
  );
}
