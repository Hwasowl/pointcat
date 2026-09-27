import type { CatSkin } from './cats';

const TAU = Math.PI * 2;

export type CatPose = {
  t: number;
  /** 가는 쪽. -1(왼쪽) ~ 1(오른쪽) */
  look: number;
  /** 빛을 건진 직후 1 → 0 */
  happy: number;
  /** 바위에 부딪힌 직후 1 → 0 */
  startled: number;
  /** 부스터가 켜진 직후 1 → 0. 움츠렸다 점프하고, 야옹 하며 따봉을 든다 */
  cheer: number;
  /** 움직임 줄이기 */
  still: boolean;
  /** 달·해 쪽 가장자리에 비치는 빛. 외곽선 대신 실루엣을 배경에서 떼어 준다 */
  rim: string;
  /** 빛이 오는 쪽. -1(왼쪽) 또는 1(오른쪽) */
  rimSide: number;
};

/**
 * 배 위 고양이. 원점은 배 중심이고 뱃전은 y ≈ -10.
 * 몸은 배 안에 두고 큰 머리와 앞발만 뱃전에 걸쳐 빼꼼 내다보는 자세다.
 * 배경처럼 외곽선 없이 면으로만 그린다.
 */
export function drawCat(ctx: CanvasRenderingContext2D, skin: CatSkin, p: CatPose) {
  const { t, startled } = p;
  const happy = Math.max(p.happy, p.cheer);
  const look = p.look * 1.6;
  const hop = happy > 0 ? Math.sin(happy * Math.PI) * 3 : 0;
  const shake = startled > 0.5 ? Math.sin(t * 60) * 1 : 0;
  const wag = p.still ? 0 : Math.sin(t * (happy > 0 ? 10 : 2)) * (happy > 0 ? 3.5 : 2);
  // 부스터 환호: 0~0.12 움츠림 → 0.12~0.5 점프(늘어남) → 0.5~0.62 착지(찌그러짐) → 끝까지 따봉
  const u = 1 - p.cheer;
  let jump = 0;
  let sy = 1;
  if (p.cheer > 0 && !p.still) {
    if (u < 0.12) sy = 1 - 0.18 * Math.sin((u / 0.12) * Math.PI * 0.5);
    else if (u < 0.5) {
      const k = (u - 0.12) / 0.38;
      jump = Math.sin(k * Math.PI) * 16;
      sy = 1 + 0.12 * Math.cos(k * Math.PI);
    } else if (u < 0.62) sy = 1 - 0.14 * Math.sin(((u - 0.5) / 0.12) * Math.PI);
  }
  /** 따봉 드는 동안에는 오른 앞발이 뱃전에서 떨어져 있다 */
  const raised = p.cheer > 0 && u > 0.1;
  ctx.save();
  ctx.translate(shake, -hop - jump);
  // 발밑(-10, -6)을 기준으로 늘이고 찌그러뜨린다 — 부피는 그대로
  ctx.translate(-10, -6);
  ctx.scale(1 / Math.sqrt(sy), sy);
  ctx.translate(10, 6);
  ctx.lineCap = 'round';

  // 실루엣을 빛 쪽으로 살짝 밀어 림 라이트로 한 번, 제자리에 털색으로 한 번
  ctx.save();
  ctx.translate(p.rimSide * 0.9, -0.9);
  silhouette(ctx, p.rim, p.rim, wag, look, raised);
  ctx.restore();
  silhouette(ctx, skin.fur, skin.light, wag, look, raised);

  // 얼룩·입 둘레 무늬는 머리 밖으로 삐져나오지 않게 머리 모양으로 잘라 그린다
  if (skin.patch || skin.muzzle) {
    ctx.save();
    headPath(ctx);
    ctx.clip();
    if (skin.patch) {
      for (const [i, [px, r]] of [[-20.5, 10], [0.5, 9]].entries()) {
        ctx.fillStyle = skin.patch[i];
        ctx.beginPath();
        ctx.arc(px + look * 0.4, -33, r, 0, TAU);
        ctx.fill();
      }
    }
    if (skin.muzzle) {
      ctx.fillStyle = skin.muzzle;
      ctx.beginPath();
      ctx.ellipse(-10 + look, -18.6, 6.2, 4.4, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  if (skin.stripe) {
    ctx.strokeStyle = skin.stripe;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const [sx, len] of [[-13, 2.6], [-10, 3.6], [-7, 2.6]]) {
      ctx.moveTo(sx + look * 0.4, -34.2);
      ctx.lineTo(sx + look * 0.4, -34.2 + len);
    }
    ctx.stroke();
  }

  // 얼굴 — 점 눈과 작은 입만
  const fx = -10 + look;
  const ey = -22.5;
  ctx.fillStyle = skin.eye;
  ctx.strokeStyle = skin.eye;
  ctx.lineWidth = 1.6;
  const blink = !p.still && t % 3.7 < 0.13;
  for (const ex of [fx - 5.6, fx + 5.6]) {
    ctx.beginPath();
    if (happy > 0) {
      // ^ ^
      ctx.moveTo(ex - 2.4, ey + 0.8);
      ctx.quadraticCurveTo(ex, ey - 2.8, ex + 2.4, ey + 0.8);
      ctx.stroke();
    } else if (startled > 0) {
      // > <
      const s = ex < fx ? 1 : -1;
      ctx.moveTo(ex - 1.8 * s, ey - 2);
      ctx.lineTo(ex + 1.6 * s, ey);
      ctx.lineTo(ex - 1.8 * s, ey + 2);
      ctx.stroke();
    } else if (blink) {
      ctx.moveTo(ex - 2.2, ey);
      ctx.lineTo(ex + 2.2, ey);
      ctx.stroke();
    } else {
      ctx.ellipse(ex, ey, 1.9, 2.5, 0, 0, TAU);
      ctx.fill();
    }
  }
  if (p.cheer > 0 && u < 0.7) {
    // 야옹 — 동그랗게 벌린 입
    ctx.fillStyle = skin.mouth;
    ctx.beginPath();
    ctx.ellipse(fx, -17.6, 2.2, 2.4 * Math.min(1, u / 0.1), 0, 0, TAU);
    ctx.fill();
  } else {
    // ω 입
    ctx.strokeStyle = skin.mouth;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(fx - 2.2, -19);
    ctx.quadraticCurveTo(fx - 1.1, -17.5, fx, -19.2);
    ctx.quadraticCurveTo(fx + 1.1, -17.5, fx + 2.2, -19);
    ctx.stroke();
  }
  // 따봉 — 오른 앞발을 머리 옆으로 번쩍 들고 엄지를 세운다. 끝날 즈음 다시 내린다
  if (raised) {
    const lift = Math.min(1, (u - 0.1) / 0.15) * Math.min(1, p.cheer / 0.15);
    const px = -4.5 + look * 0.3 + lift * 14;
    const py = -11 - lift * 19;
    ctx.fillStyle = skin.fur;
    ctx.strokeStyle = skin.fur;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(-2 + look * 0.3, -13);
    ctx.lineTo(px, py + 3);
    ctx.stroke();
    // 주먹은 세로로 세우고 엄지는 머리 쪽 가장자리에서 위로 — 가운데서 솟으면 다른 손가락처럼 보인다
    ctx.fillStyle = skin.light;
    ctx.beginPath();
    ctx.roundRect(px - 3, py - 2.5, 6.5, 7.5, 2.6);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px - 2.2, py - 2.5 - 2.6 * lift, 1.6, 2.9 * lift + 0.01, -0.25, 0, TAU);
    ctx.fill();
    // 말아 쥔 손가락 마디
    ctx.strokeStyle = 'rgba(0,0,0,.22)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (const dy of [0.2, 2.4]) {
      ctx.moveTo(px + 0.6, py + dy);
      ctx.lineTo(px + 3.3, py + dy);
    }
    ctx.stroke();
  }
  // 땀방울
  if (startled > 0) {
    ctx.fillStyle = `rgba(170,215,255,${Math.min(1, startled * 2)})`;
    ctx.beginPath();
    ctx.moveTo(6, -36);
    ctx.quadraticCurveTo(8.8, -31, 6, -30);
    ctx.quadraticCurveTo(3.2, -31, 6, -36);
    ctx.fill();
  }
  ctx.restore();
}

/** 귀 두 쪽과 머리를 합친 경로(무늬를 자를 때 쓴다). 모양은 silhouette과 같다 */
function headPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  for (const m of [1, -1]) {
    const x = (v: number) => -10 + (v + 10) * m;
    ctx.moveTo(x(-23), -26);
    ctx.quadraticCurveTo(x(-24.5), -37, x(-21.5), -38.5);
    ctx.quadraticCurveTo(x(-18.5), -38.5, x(-13), -33.5);
    ctx.closePath();
  }
  ctx.moveTo(4, -23.5);
  ctx.ellipse(-10, -23.5, 14, 11.5, 0, 0, TAU);
}

/** 꼬리·몸·귀·머리·앞발 */
function silhouette(ctx: CanvasRenderingContext2D, fur: string, paw: string, wag: number, look: number, raised: boolean) {
  ctx.strokeStyle = fur;
  ctx.lineWidth = 4.4;
  ctx.beginPath();
  ctx.moveTo(-20, -12);
  ctx.bezierCurveTo(-30, -12, -31 + wag * 0.3, -23, -26 + wag, -29);
  ctx.stroke();
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(-12, -13, 11, 7, 0, 0, TAU);
  ctx.fill();
  // 귀 — 머리(가운데 x = -10)를 기준으로 좌우 대칭
  for (const m of [1, -1]) {
    const x = (v: number) => -10 + (v + 10) * m;
    ctx.beginPath();
    ctx.moveTo(x(-23), -26);
    ctx.quadraticCurveTo(x(-24.5), -37, x(-21.5), -38.5);
    ctx.quadraticCurveTo(x(-18.5), -38.5, x(-13), -33.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(-10, -23.5, 14, 11.5, 0, 0, TAU);
  ctx.fill();
  // 뱃전에 올린 앞발
  ctx.fillStyle = paw;
  ctx.beginPath();
  ctx.ellipse(-15.5 + look * 0.3, -11, 3.6, 2.6, 0, 0, TAU);
  if (!raised) ctx.ellipse(-4.5 + look * 0.3, -11, 3.6, 2.6, 0, 0, TAU);
  ctx.fill();
}
