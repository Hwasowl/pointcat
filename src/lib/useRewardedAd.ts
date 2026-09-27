import { loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from './sound';

export type AdState = 'unsupported' | 'loading' | 'ready' | 'showing' | 'failed';

// Android 5.255.0은 dismissed가 오지 않는다 — 보상 이후 이 시간이 지나면 닫힌 것으로 본다.
const DISMISS_FALLBACK_MS = 15_000;

/**
 * 전체 화면 광고 하나를 load → show → load 순서로 돌린다.
 * show()는 보상 조건을 채웠는지 resolve한다 — 보상형은 끝까지 봤을 때(userEarnedReward),
 * 전면형은 그 이벤트가 없어 실제로 노출됐을 때(impression).
 * enabled가 true가 될 때 첫 로드를 시작한다(광고 그룹은 하나씩 순서대로 로드해야 한다).
 */
export function useRewardedAd(adGroupId: string, { interstitial = false, enabled = true } = {}) {
  const [state, setState] = useState<AdState>(() => (loadFullScreenAd.isSupported() ? 'loading' : 'unsupported'));
  const unregister = useRef<(() => void) | null>(null);

  // 상태 변경은 SDK 콜백에서만 한다(effect 안에서 동기 setState 금지)
  const request = useCallback(() => {
    if (!loadFullScreenAd.isSupported()) return;
    unregister.current?.();
    unregister.current = loadFullScreenAd({
      options: { adGroupId },
      onEvent: (e) => {
        if (e.type === 'loaded') setState('ready');
      },
      onError: () => setState('failed'),
    });
  }, [adGroupId]);

  const load = useCallback(() => {
    setState(loadFullScreenAd.isSupported() ? 'loading' : 'unsupported');
    request();
  }, [request]);

  useEffect(() => {
    if (!enabled) return;
    request();
    return () => unregister.current?.();
  }, [request, enabled]);

  const show = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        // devtools 목업은 userEarnedReward를 보내지 않아 보상 흐름을 확인할 수 없다. 빌드에서는 제거된다
        if (import.meta.env.DEV) {
          resolve(true);
          return;
        }
        if (state !== 'ready') {
          resolve(false);
          return;
        }
        let earned = false;
        let done = false;
        let fallback = 0;
        setState('showing');
        sound.hold('ad');
        const finish = () => {
          if (done) return;
          done = true;
          window.clearTimeout(fallback);
          sound.release('ad');
          load();
          resolve(earned);
        };
        showFullScreenAd({
          options: { adGroupId },
          onEvent: (e) => {
            if (e.type === (interstitial ? 'impression' : 'userEarnedReward')) {
              earned = true;
              fallback = window.setTimeout(finish, DISMISS_FALLBACK_MS);
            }
            if (e.type === 'dismissed' || e.type === 'failedToShow') finish();
          },
          onError: finish,
        });
      }),
    [adGroupId, interstitial, load, state],
  );

  return { state, show, reload: load };
}
