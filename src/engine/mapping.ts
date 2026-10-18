/** 视频（object-fit: cover，前置镜头镜像）与舞台像素之间的坐标换算 */
export interface CoverMap {
  scale: number;
  offsetX: number;
  offsetY: number;
  vw: number;
  vh: number;
  sw: number;
  sh: number;
  mirror: boolean;
}

export function computeCover(vw: number, vh: number, sw: number, sh: number, mirror: boolean): CoverMap {
  const scale = Math.max(sw / Math.max(vw, 1), sh / Math.max(vh, 1));
  return { scale, offsetX: (sw - vw * scale) / 2, offsetY: (sh - vh * scale) / 2, vw, vh, sw, sh, mirror };
}

/** MediaPipe 归一化坐标（相对原始视频帧） → 舞台像素 */
export function mapPoint(nx: number, ny: number, m: CoverMap, out = { x: 0, y: 0 }) {
  const x = m.mirror ? 1 - nx : nx;
  out.x = m.offsetX + x * m.vw * m.scale;
  out.y = m.offsetY + ny * m.vh * m.scale;
  return out;
}

/**
 * 着色器里用：屏幕 uv(0~1, y 向下) → 视频纹理 uv。
 * videoUv = uv * repeat + offset（x 方向镜像时 repeat.x 为负）
 */
export function coverUv(m: CoverMap) {
  const fx = m.sw / (m.vw * m.scale); // 可见部分占视频宽的比例
  const fy = m.sh / (m.vh * m.scale);
  const ox = (1 - fx) / 2;
  const oy = (1 - fy) / 2;
  if (m.mirror) return { rx: -fx, ry: fy, ox: 1 - ox, oy };
  return { rx: fx, ry: fy, ox, oy };
}

/** 把当前视频帧按舞台显示效果（cover + 镜像）画到 2D 画布上 */
export function drawVideoCover(ctx: CanvasRenderingContext2D, video: HTMLVideoElement, w: number, h: number, mirror: boolean) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return false;
  const m = computeCover(vw, vh, w, h, mirror);
  ctx.save();
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, m.offsetX, m.offsetY, vw * m.scale, vh * m.scale);
  ctx.restore();
  return true;
}
