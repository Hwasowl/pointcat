import { Promotion } from '@apps-in-toss/web-framework';
import { PROMOTION_CODE } from '../config';

export type GrantOutcome = { ok: true } | { ok: false; retryable: boolean; message: string };

// 예산 소진·프로모션 종료처럼 다시 눌러도 풀리지 않는 코드
const CLOSED = new Set(['4100', '4109', '4112', '4116']);
const UNSUPPORTED = '토스 앱을 업데이트하면 포인트를 받을 수 있어요';

/** 포인트를 줄 수 없는 앱 버전이면 그 이유를 준다 — 광고를 보기 전에 확인해 헛되이 광고를 보지 않게 한다 */
export const grantBlockedReason = () => (Promotion.grantReward.isSupported() ? '' : UNSUPPORTED);

/** 가득 찬 유리병을 토스 포인트로 바꿔 지급한다 */
export async function grantJarReward(amount: number): Promise<GrantOutcome> {
  if (!Promotion.grantReward.isSupported()) {
    return { ok: false, retryable: false, message: UNSUPPORTED };
  }
  try {
    await Promotion.grantReward({ promotionCode: PROMOTION_CODE, amount });
    return { ok: true };
  } catch (e) {
    const code = String((e as { code?: unknown }).code ?? '');
    if (CLOSED.has(code)) {
      return { ok: false, retryable: false, message: '지금은 포인트 지급이 멈춰 있어요. 병은 그대로 남겨 둘게요' };
    }
    return { ok: false, retryable: true, message: '포인트를 보내지 못했어요. 잠시 뒤 다시 눌러 주세요' };
  }
}
