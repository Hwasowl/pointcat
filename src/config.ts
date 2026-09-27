// 보상·광고 설정 — 출시 전에 콘솔에서 발급받은 값으로 바꾼다.
// 개발 중에는 테스트 ID와 TEST_ 프로모션 코드만 쓴다(운영 ID로 테스트하면 제재 대상).

/** 유리병 한 병의 칸 수. 구슬을 모아 부으면 찬다 */
export const JAR_CAPACITY = 40;
/** 가득 찬 유리병 하나를 토스 포인트로 바꾸면 주는 포인트(원). 짧은 광고(전면형 5초)를 보면 바로 지급한다(고정 지급).
    광고 1회당 지급액 = 본전 eCPM ÷ 1,000 — 실제 eCPM을 보고 조정한다 */
export const POINT_PER_JAR = 1;
/** 하루에 토스 포인트로 바꿀 수 있는 횟수 — 하루 최대 이 값 × POINT_PER_JAR원 */
export const DAILY_EXCHANGE_LIMIT = 9;
/** 1인당 누적 지급 상한. 프로모션 정책의 1인당 5,000포인트 한도보다 낮게 둔다 */
export const LIFETIME_POINT_CAP = 4990;

/** 배를 조작해 구슬을 다 건지면 한 병이 차는 시간(분). 가만히 있으면 차지 않는다 */
export const ACTIVE_JAR_MIN = 5;
/** 구슬을 이만큼 모으면 유리병에 부어 준다 */
export const MARBLES_PER_POUR = 30;
/** 구슬을 한 번 부을 때 차는 칸 — 4칸 = 유리병의 10% */
export const POUR_FILL = 4;
/** 구슬 하나의 몫(칸). 떠오르는 간격을 계산할 때만 쓴다 */
const MARBLE_VALUE = POUR_FILL / MARBLES_PER_POUR;
/** 구슬이 떠오르는 간격(초). 다 건지면 5분에 한 병 — 1초 */
export const MARBLE_EVERY_S = MARBLE_VALUE / (JAR_CAPACITY / (ACTIVE_JAR_MIN * 60));
/** 부스터 중 구슬 간격(초) — 평소(1초)의 약 3배로 떠오른다 */
export const BOOST_MARBLE_EVERY_S = 0.3;
/** 구슬이 흘러오는 속도 배율. 물결·돌보다 이만큼 빠르게 배 쪽으로 다가와, 맨 앞에 서 있어도 다 건지기는 어렵다 */
export const MARBLE_SPEED = 2;
/** 돌 간격(초). 부딪히면 배가 튕겨난다 */
export const ROCK_EVERY_S = 6;

/** 부스터: 30초 동안 게이지가 차오르면 저절로 5초 동안 켜진다(광고 없음) */
export const BOOST_EVERY_MS = 30_000;
export const BOOST_MS = 5_000;

/** 방치 보상: 앱을 나가 있던 동안 한 시간에 이만큼 유리병이 찬다(나간 시간에 비례) — 4칸 = 10% */
export const AWAY_FILL_PER_HOUR = 4;
/** 방치 보상으로 한 번에 채워 주는 최대 칸 — 20칸 = 50%(5시간). 나머지는 구슬로 채운다 */
export const AWAY_MAX_FILL = 20;

// 광고·프로모션 ID는 빌드 모드별 env 파일에서 온다.
// 개발·테스트(`npm run dev`, `npm run build:test`)는 .env의 테스트 값, 출시(`npm run build`)는 .env.production의 운영 값.
export const PROMOTION_CODE = import.meta.env.VITE_PROMOTION_CODE;
/** 보상형(30초, 긴 광고) — 풍경·고양이 열기 */
export const REWARDED_AD_GROUP_ID = import.meta.env.VITE_REWARDED_AD_GROUP_ID;
/** 전면형(5초, 짧은 광고) — 가득 찬 유리병을 토스 포인트로 교환 */
export const INTERSTITIAL_AD_GROUP_ID = import.meta.env.VITE_INTERSTITIAL_AD_GROUP_ID;
export const BANNER_AD_GROUP_ID = import.meta.env.VITE_BANNER_AD_GROUP_ID;
/** 문구 강조 배너(리스트형) — 풍경만 보기 바닥 배너 */
export const TEXT_BANNER_AD_GROUP_ID = import.meta.env.VITE_TEXT_BANNER_AD_GROUP_ID;
