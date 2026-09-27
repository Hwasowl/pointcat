export type ObstacleKind = 'lily' | 'plank' | 'buoy' | 'ice' | 'log' | 'berg';

const TAU = Math.PI * 2;

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function buoyPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.quadraticCurveTo(-9, -12, 0, -14);
  ctx.quadraticCurveTo(9, -12, 9, 0);
  ctx.closePath();
}

/**
 * 물 위에 떠내려오는 장애물. 부딪히면 배가 튕겨난다.
 * 원점은 물에 닿는 자리이고, 폭은 풍경과 상관없이 약 32(충돌 판정과 같은 크기)다.
 */
export function drawObstacle(ctx: CanvasRenderingContext2D, kind: ObstacleKind, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (kind === 'lily') {
    // 한쪽이 파인 연잎 위에 연꽃 한 송이
    ctx.fillStyle = '#2f5a45';
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.ellipse(0, -1, 16, 5.5, 0, 0.35, TAU - 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3f7356';
    ctx.beginPath();
    ctx.ellipse(-4, -2, 9, 3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2a8c2';
    for (const a of [-0.7, 0, 0.7]) {
      ctx.save();
      ctx.translate(-4, -3);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -4, 2.4, 4.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffe38a';
    ctx.beginPath();
    ctx.arc(-4, -4, 1.4, 0, TAU);
    ctx.fill();
  } else if (kind === 'plank') {
    ctx.rotate(-0.06);
    ctx.fillStyle = '#8a5d3b';
    ctx.beginPath();
    ctx.roundRect(-17, -5, 34, 6, 1.5);
    ctx.fill();
    ctx.fillStyle = '#b98a5c';
    ctx.beginPath();
    ctx.roundRect(-17, -8, 34, 5, 1.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,35,.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-11, -6);
    ctx.lineTo(-1, -6);
    ctx.moveTo(4, -5);
    ctx.lineTo(12, -5);
    ctx.stroke();
    ctx.fillStyle = '#5a4030';
    for (const nx of [-14, 14]) {
      ctx.beginPath();
      ctx.arc(nx, -5.5, 0.9, 0, TAU);
      ctx.fill();
    }
  } else if (kind === 'buoy') {
    // 빨간 몸통에 흰 띠, 꼭대기에 작은 등
    ctx.fillStyle = '#e0564a';
    buoyPath(ctx);
    ctx.fill();
    ctx.save();
    buoyPath(ctx);
    ctx.clip();
    ctx.fillStyle = '#f4efe8';
    ctx.fillRect(-10, -8, 20, 4);
    ctx.restore();
    ctx.strokeStyle = '#4a3a45';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -19);
    ctx.stroke();
    ctx.fillStyle = '#ffd89c';
    ctx.beginPath();
    ctx.arc(0, -20.5, 2, 0, TAU);
    ctx.fill();
  } else if (kind === 'ice') {
    // 납작한 얼음 조각 — 옆면 한 겹, 윗면 한 겹
    ctx.fillStyle = '#a9c3de';
    poly(ctx, [[-16, -4], [-10, -2], [12, -2], [16, -5], [16, -1], [12, 1], [-10, 1], [-16, 0]]);
    ctx.fill();
    ctx.fillStyle = '#eef5ff';
    poly(ctx, [[-16, -4], [-11, -8], [-2, -9], [8, -8], [16, -5], [12, -2], [-10, -2]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-11, -8);
    ctx.lineTo(-2, -9);
    ctx.stroke();
  } else if (kind === 'log') {
    // 통나무 — 몸통, 나이테가 보이는 끝, 잎 달린 잔가지
    ctx.fillStyle = '#6b4a33';
    ctx.beginPath();
    ctx.roundRect(-17, -9, 32, 9, 4.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,25,15,.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(4, -6);
    ctx.moveTo(-8, -3);
    ctx.lineTo(8, -3);
    ctx.stroke();
    ctx.fillStyle = '#c49a6c';
    ctx.beginPath();
    ctx.ellipse(15, -4.5, 3, 4.5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8a6440';
    ctx.beginPath();
    ctx.ellipse(15, -4.5, 1.5, 2.5, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#6b4a33';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(-9, -13);
    ctx.stroke();
    ctx.fillStyle = '#6f9a5a';
    ctx.beginPath();
    ctx.ellipse(-10.5, -14.5, 2.8, 1.4, -0.6, 0, TAU);
    ctx.fill();
  } else {
    // 작은 빙산 — 밝은 앞면과 그늘진 오른면
    ctx.fillStyle = '#d8eef5';
    poly(ctx, [[-15, 0], [-10, -9], [-4, -17], [1, -11], [6, -14], [15, 0]]);
    ctx.fill();
    ctx.fillStyle = '#93bccd';
    poly(ctx, [[-4, -17], [1, -11], [6, -14], [15, 0], [2, 0]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-10, -9);
    ctx.lineTo(-4, -17);
    ctx.stroke();
  }
  ctx.restore();
}
