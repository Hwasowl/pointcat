import { TossAds } from '@apps-in-toss/web-framework';
import { useEffect, useRef, useState } from 'react';
import { BANNER_AD_GROUP_ID } from '../config';

// SDK 초기화는 앱에서 한 번만 한다(중복 호출 시 Already initialized 에러).
let init: Promise<void> | null = null;
function initOnce() {
  init ??= new Promise((resolve, reject) => {
    TossAds.initialize({ callbacks: { onInitialized: () => resolve(), onInitializationFailed: reject } });
  });
  return init;
}

/**
 * 시트 안 배너(보상 카드 사이). 보상형 광고 로드가 끝난 뒤(enabled)에 붙인다 —
 * 전면형과 배너를 동시에 로드하면 일부 안드로이드 버전에서 이벤트가 빠진다.
 * 광고가 없거나 실패하면 자리를 비우지 않고 통째로 숨긴다.
 */
export function BannerAd({ enabled, adGroupId = BANNER_AD_GROUP_ID }: { enabled: boolean; adGroupId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [supported] = useState(() => TossAds.initialize.isSupported() && TossAds.attachBanner.isSupported());
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!supported || !enabled || !ref.current) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;
    initOnce()
      .then(() => {
        if (cancelled || !ref.current) return;
        destroy = TossAds.attachBanner(adGroupId, ref.current, {
          theme: 'auto',
          tone: 'blackAndWhite',
          variant: 'expanded',
          callbacks: {
            onNoFill: () => setVisible(false),
            onAdFailedToRender: () => setVisible(false),
          },
        }).destroy;
      })
      .catch(() => setVisible(false));
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [supported, enabled, adGroupId]);

  if (!supported || !visible) return null;
  return <div className="banner-slot" ref={ref} />;
}
