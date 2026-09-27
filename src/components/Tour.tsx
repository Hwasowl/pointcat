import { type CSSProperties, useEffect, useRef, useState } from 'react';

type Box = { left: number; top: number; width: number; height: number };

export type TourStep = {
  /** 비출 대상. 요소면 시트 안에서 보이게 스크롤하고, 박스면 그 영역을 그대로 비춘다 */
  target: () => Element | Box | null;
  title: string;
  body: string;
};

/** 비추는 영역을 대상보다 이만큼 넓힌다 */
const PAD = 6;

const boxOf = (t: Element | Box | null): Box | null => (t instanceof Element ? t.getBoundingClientRect() : t);
const sameBox = (a: Box, b: Box) => a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

/** 첫 진입 가이드 투어 — 어둡게 덮고 한 곳씩 비추며 말풍선으로 설명한다 */
export function Tour({ steps, onDone }: { steps: TourStep[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[i];
  const last = i === steps.length - 1;

  useEffect(() => {
    const t = step.target();
    if (t instanceof Element) t.scrollIntoView({ block: 'nearest' });
    nextRef.current?.focus();
    // 배처럼 움직이는 대상·스크롤되는 시트도 따라가도록 매 프레임 위치를 다시 읽는다
    let raf = 0;
    const tick = () => {
      const b = boxOf(step.target());
      setBox((prev) => (prev && b && sameBox(prev, b) ? prev : b));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDone]);

  const next = () => (last ? onDone() : setI(i + 1));

  // 대상이 화면 아래쪽이면 말풍선을 위에, 위쪽이면 아래에 띄운다
  let tipStyle: CSSProperties = { top: '50%', transform: 'translateY(-50%)' };
  if (box) {
    tipStyle =
      box.top + box.height / 2 > window.innerHeight / 2
        ? { bottom: window.innerHeight - box.top + PAD + 12 }
        : { top: box.top + box.height + PAD + 12 };
  }

  return (
    <div className={`tour${box ? '' : ' no-hole'}`} onClick={(e) => e.stopPropagation()}>
      {box && (
        <div
          className="tour-hole"
          aria-hidden="true"
          style={{ left: box.left - PAD, top: box.top - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }}
        />
      )}
      <div className="tour-tip" role="dialog" aria-modal="true" aria-labelledby="tour-title" style={tipStyle}>
        <small className="tour-count">
          {i + 1}/{steps.length}
        </small>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="tour-actions">
          {!last && (
            <button type="button" className="tour-skip" onClick={onDone}>
              건너뛰기
            </button>
          )}
          <button ref={nextRef} type="button" className="tour-next" onClick={next}>
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
