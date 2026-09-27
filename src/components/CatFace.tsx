import { useId } from 'react';
import type { CatSkin } from '../scene/cats';

// 귀 한쪽(왼쪽). 오른쪽은 머리 가운데(x = -10)를 기준으로 뒤집어 쓴다
const EAR = 'M-23 -26Q-24.5 -37 -21.5 -38.5Q-18.5 -38.5 -13 -33.5Z';

/** 꾸미기 패널의 고양이 얼굴 미리보기. 좌표와 색은 배 위 고양이(scene/cat.ts)와 같다 */
export function CatFace({ skin, size = 30 }: { skin: CatSkin; size?: number }) {
  // useId의 «»·: 문자는 url(#…) 참조에서 깨질 수 있어 뺀다
  const clip = `cat${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg className="cat-face" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <g transform="translate(26 41.5)">
        <clipPath id={clip}>
          <path d={EAR} />
          <path d={EAR} transform="translate(-20 0) scale(-1 1)" />
          <ellipse cx="-10" cy="-23.5" rx="14" ry="11.5" />
        </clipPath>
        <g fill={skin.fur}>
          <path d={EAR} />
          <path d={EAR} transform="translate(-20 0) scale(-1 1)" />
          <ellipse cx="-10" cy="-23.5" rx="14" ry="11.5" />
        </g>
        {(skin.patch || skin.muzzle) && (
          <g clipPath={`url(#${clip})`}>
            {skin.patch && <circle cx="-20.5" cy="-33" r="10" fill={skin.patch[0]} />}
            {skin.patch && <circle cx="0.5" cy="-33" r="9" fill={skin.patch[1]} />}
            {skin.muzzle && <ellipse cx="-10" cy="-18.6" rx="6.2" ry="4.4" fill={skin.muzzle} />}
          </g>
        )}
        {skin.stripe && <path d="M-13 -34.2v2.6M-10 -34.2v3.6M-7 -34.2v2.6" stroke={skin.stripe} strokeWidth="1.5" strokeLinecap="round" />}
        <ellipse cx="-15.6" cy="-22.5" rx="1.9" ry="2.5" fill={skin.eye} />
        <ellipse cx="-4.4" cy="-22.5" rx="1.9" ry="2.5" fill={skin.eye} />
        <path d="M-12.2 -19q1.1 1.5 2.2 -.2q1.1 1.7 2.2 .2" fill="none" stroke={skin.mouth} strokeWidth="0.9" strokeLinecap="round" />
      </g>
    </svg>
  );
}
