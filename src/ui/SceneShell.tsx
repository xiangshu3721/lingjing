import { useEffect, useRef, useState } from 'react';
import type { FaceLandmarkerResult, HandLandmarkerResult, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { audio } from '../engine/audio';
import { CAMERA_ERROR_TEXT, classifyCameraError, openCamera, stopStream } from '../engine/camera';
import { InputBuilder } from '../engine/input';
import { computeCover, drawVideoCover, type CoverMap } from '../engine/mapping';
import { GESTURE_LABEL, type InputFrame } from '../engine/types';
import { detect, getDelegate, isReady, loadNeeds } from '../engine/vision';
import type { SceneContext, SceneDef, SceneInstance } from '../scenes/types';
import { Icon } from './Icons';

interface Props {
  def: SceneDef;
  onExit: () => void;
}

type Banner = { kind: 'error' | 'info'; text: string; retry?: boolean } | null;

declare global {
  interface Window {
    __lingjing?: Record<string, unknown>;
  }
}

export function SceneShell({ def, onExit }: Props) {
  const { meta } = def;
  const stageRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cursorRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [hint, setHint] = useState(meta.hint);
  const [hintOpen, setHintOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [muted, setMuted] = useState(audio.muted);
  const [photo, setPhoto] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const captureRef = useRef<() => string | null>(() => null);

  useEffect(() => audio.onMute(setMuted) as () => void, []);

  useEffect(() => {
    const stage = stageRef.current!;
    const layers = layersRef.current!;
    const ui = uiRef.current!;
    const video = videoRef.current!;
    const cursor = cursorRef.current!;
    const cg = cursor.getContext('2d')!;
    let disposed = false;
    let stream: MediaStream | null = null;
    let scene: SceneInstance | null = null;
    let raf = 0;
    let videoOpacity = meta.video;
    const input = new InputBuilder();
    input.pointerMode = meta.pointerMode ?? 'single';
    const raw: { hand: HandLandmarkerResult | null; face: FaceLandmarkerResult | null; pose: PoseLandmarkerResult | null } = { hand: null, face: null, pose: null };
    const rawT = { hand: 0, face: 0, pose: 0 };
    const needKinds = (['hand', 'face', 'pose'] as const).filter((k) => meta.needs[k]);
    let modelsReady = needKinds.length === 0;
    let cameraOk = false;
    let w = stage.clientWidth;
    let h = stage.clientHeight;
    let cover: CoverMap | null = null;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sizeCursor = () => {
      cursor.width = w * dpr;
      cursor.height = h * dpr;
      cursor.style.width = w + 'px';
      cursor.style.height = h + 'px';
    };
    sizeCursor();

    const updateCover = () => {
      cover = cameraOk && video.videoWidth ? computeCover(video.videoWidth, video.videoHeight, w, h, true) : null;
    };

    const ctx: SceneContext = {
      root: layers,
      ui,
      video,
      audio,
      get width() {
        return w;
      },
      get height() {
        return h;
      },
      hasVideo: () => cameraOk && video.videoWidth > 0,
      cover: () => cover,
      toast: (m) => {
        setToast(m);
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => setToast(null), 1800);
      },
      setHint: (m) => {
        setHint(m);
        setHintOpen(true);
      },
      setPointerMode: (m) => (input.pointerMode = m),
      setVideoOpacity: (v) => {
        videoOpacity = v;
        video.style.opacity = String(cameraOk ? v : 0);
      },
    };

    // ---- 拍照：把摄像头画面 + 所有场景画布合成一张图（只在本机） ----
    captureRef.current = () => {
      const c = document.createElement('canvas');
      const s = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(w * s);
      c.height = Math.round(h * s);
      const g = c.getContext('2d')!;
      g.scale(s, s);
      g.fillStyle = '#07080b';
      g.fillRect(0, 0, w, h);
      if (cameraOk && videoOpacity > 0) {
        g.globalAlpha = videoOpacity;
        drawVideoCover(g, video, w, h, true);
        g.globalAlpha = 1;
      }
      layers.querySelectorAll('canvas').forEach((cv) => {
        const el = cv as HTMLCanvasElement;
        if (el.style.display === 'none' || !el.width || el.dataset.nophoto) return;
        const op = parseFloat(getComputedStyle(el).opacity || '1');
        g.globalAlpha = op;
        g.drawImage(el, 0, 0, w, h);
      });
      g.globalAlpha = 0.75;
      g.fillStyle = '#d8b46a';
      g.font = `600 ${Math.max(12, w * 0.028)}px system-ui, sans-serif`;
      g.textAlign = 'right';
      g.fillText(`灵境 · ${meta.title}`, w - 14, h - 14);
      try {
        return c.toDataURL('image/jpeg', 0.92);
      } catch {
        return null;
      }
    };

    // ---- 触屏 / 鼠标 ----
    const pos = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top] as const;
    };
    const onDown = (e: PointerEvent) => {
      audio.unlock();
      const [x, y] = pos(e);
      input.pointerDown(e.pointerId, x, y, e.pointerType);
      try {
        layers.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onMove = (e: PointerEvent) => {
      const [x, y] = pos(e);
      input.pointerMove(e.pointerId, x, y, e.pointerType);
    };
    const onUp = (e: PointerEvent) => input.pointerUp(e.pointerId, e.pointerType);
    const onLeave = (e: PointerEvent) => input.pointerLeave(e.pointerId);
    layers.addEventListener('pointerdown', onDown);
    layers.addEventListener('pointermove', onMove);
    layers.addEventListener('pointerup', onUp);
    layers.addEventListener('pointercancel', onUp);
    layers.addEventListener('pointerleave', onLeave);

    const onResize = () => {
      w = stage.clientWidth;
      h = stage.clientHeight;
      sizeCursor();
      updateCover();
      scene?.resize?.(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(stage);

    // ---- 摄像头 + 模型（并行），场景立即可用触屏玩 ----
    const startCamera = async () => {
      if (meta.noCamera) return;
      try {
        stream = await openCamera();
        if (disposed) return stopStream(stream);
        video.srcObject = stream;
        video.muted = true;
        video.setAttribute('playsinline', '');
        await video.play().catch(() => {});
        await new Promise<void>((res) => {
          if (video.videoWidth) return res();
          const on = () => (video.removeEventListener('loadedmetadata', on), res());
          video.addEventListener('loadedmetadata', on);
          setTimeout(res, 3000);
        });
        if (disposed) return;
        cameraOk = true;
        video.style.opacity = String(videoOpacity);
        updateCover();
      } catch (err) {
        if (disposed) return;
        const kind = classifyCameraError(err);
        console.info('[灵境] 摄像头不可用：', kind);
        setBanner({ kind: 'error', text: CAMERA_ERROR_TEXT[kind], retry: kind !== 'unsupported' && kind !== 'insecure' && kind !== 'nodevice' });
      }
    };
    const startModels = async () => {
      if (!needKinds.length || meta.noCamera) return;
      try {
        await loadNeeds(meta.needs, (p) => !disposed && setProgress(p.total ? p.loaded / p.total : 0));
        if (disposed) return;
        modelsReady = true;
        setProgress(null);
      } catch (err) {
        console.warn('[灵境] 模型加载失败', err);
        if (disposed) return;
        setProgress(null);
        setBanner({ kind: 'error', text: '识别模型没能加载（可能网络不稳）。可以点「重试」，或者先用手指 / 鼠标玩。', retry: true });
      }
    };
    void Promise.all([startCamera(), startModels()]);

    // ---- 加载场景模块 ----
    def
      .load()
      .then((mod) => {
        if (disposed) return;
        scene = mod.create(ctx);
        scene.resize?.(w, h);
      })
      .catch((err) => {
        console.error(err);
        setBanner({ kind: 'error', text: '这个场景没能打开，请返回后重试。' });
      });

    // ---- 主循环 ----
    let last = performance.now();
    let nextDetect = 0;
    let rr = 0;
    let lastVideoTime = -1;
    let frames = 0;
    let fps = 0;
    let fpsT = last;
    let statusT = 0;
    let lastFrame: InputFrame | null = null;
    let detectMs = 0;
    const others = needKinds.filter((k) => k !== 'hand');

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      frames++;
      if (now - fpsT > 1000) {
        fps = (frames * 1000) / (now - fpsT);
        frames = 0;
        fpsT = now;
      }
      const tracking = cameraOk && modelsReady && video.readyState >= 2;
      if (tracking && now >= nextDetect && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const t0 = performance.now();
        if (meta.needs.hand && isReady('hand')) {
          raw.hand = detect('hand', video, now) as HandLandmarkerResult | null;
          rawT.hand = now;
        }
        if (others.length) {
          const k = others[rr++ % others.length];
          if (isReady(k)) {
            const r = detect(k, video, now);
            if (k === 'face') raw.face = r as FaceLandmarkerResult | null;
            else raw.pose = r as PoseLandmarkerResult | null;
            rawT[k] = now;
          }
        }
        const cost = performance.now() - t0;
        detectMs = detectMs ? detectMs * 0.8 + cost * 0.2 : cost;
        // 识别耗时越大，间隔越长，保证至少一半时间留给画面渲染（慢设备也不卡死）
        nextDetect = now + Math.min(400, Math.max(30, detectMs * 1.4, detectMs < 60 ? 0 : detectMs * 2));
      }
      // 过期结果丢弃
      for (const k of ['hand', 'face', 'pose'] as const) if (raw[k] && now - rawT[k] > 500 + detectMs * 3) raw[k] = null;
      if (!cover && cameraOk) updateCover();
      // 自动化测试用：注入合成的手部关键点（归一化，相对 640x480 视频）
      const fake = (window as unknown as { __lingjingFakeHands?: { x: number; y: number; z: number }[][] }).__lingjingFakeHands;
      let fcover = cover;
      if (fake) {
        raw.hand = { landmarks: fake, worldLandmarks: [], handedness: [], handednesses: [] } as unknown as HandLandmarkerResult;
        rawT.hand = now;
        if (!fcover) fcover = computeCover(640, 480, w, h, true);
      }
      const f = input.build(raw, fcover, now, dt, w, h, tracking || !!fake);
      lastFrame = f;
      try {
        scene?.update(f);
      } catch (err) {
        console.error('[灵境] 场景出错', err);
      }
      // 手的光标（不进照片）
      cg.setTransform(dpr, 0, 0, dpr, 0, 0);
      cg.clearRect(0, 0, w, h);
      for (const hd of f.hands) {
        if (hd.source === 'camera' && hd.lm) {
          cg.fillStyle = 'rgba(255,255,255,0.45)';
          for (const i of [4, 8, 12, 16, 20]) {
            cg.beginPath();
            cg.arc(hd.lm[i].x, hd.lm[i].y, 2.5, 0, Math.PI * 2);
            cg.fill();
          }
        }
        cg.beginPath();
        cg.arc(hd.pinchPt.x, hd.pinchPt.y, hd.pinching ? 9 : 6, 0, Math.PI * 2);
        cg.strokeStyle = hd.pinching ? '#5fe3b0' : 'rgba(255,255,255,0.7)';
        cg.lineWidth = 2;
        cg.stroke();
      }
      if (now - statusT > 200) {
        statusT = now;
        let s: string;
        let on = false;
        if (meta.noCamera) s = '触屏 / 鼠标';
        else if (!cameraOk) s = '触屏模式';
        else if (!modelsReady) s = '识别加载中…';
        else {
          const parts: string[] = [];
          const cams = f.hands.filter((x) => x.source === 'camera');
          if (meta.needs.hand) parts.push(cams.length ? cams.map((x) => GESTURE_LABEL[x.gesture]).join(' + ') : '未见手');
          if (meta.needs.face) parts.push(f.face ? (f.face.mouthOpen > 0.35 ? '张嘴' : f.face.blink > 0.55 ? '眨眼' : f.face.smile > 0.5 ? '微笑' : '已识别脸') : '未见脸');
          if (meta.needs.pose) parts.push(f.pose ? '已识别身体' : '未见身体');
          s = parts.join(' · ');
          on = cams.length > 0 || !!f.face || !!f.pose;
        }
        if (statusRef.current) statusRef.current.textContent = s;
        if (dotRef.current) dotRef.current.dataset.on = on ? '1' : '0';
      }
    };
    raf = requestAnimationFrame(loop);

    window.__lingjing = {
      scene: meta.id,
      info: () => ({
        scene: meta.id,
        fps: Math.round(fps),
        detectMs: Math.round(detectMs),
        cameraOk,
        modelsReady,
        delegate: needKinds.map((k) => `${k}:${getDelegate(k) ?? '-'}`).join(','),
        hands: lastFrame?.hands.length ?? 0,
        gestures: lastFrame?.hands.map((x) => x.gesture) ?? [],
        face: !!lastFrame?.face,
        pose: !!lastFrame?.pose,
        sceneReady: !!scene,
      }),
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearTimeout(toastTimer);
      layers.removeEventListener('pointerdown', onDown);
      layers.removeEventListener('pointermove', onMove);
      layers.removeEventListener('pointerup', onUp);
      layers.removeEventListener('pointercancel', onUp);
      layers.removeEventListener('pointerleave', onLeave);
      try {
        scene?.dispose();
      } catch (e) {
        console.warn(e);
      }
      layers.innerHTML = '';
      ui.innerHTML = '';
      stopStream(stream);
      video.srcObject = null;
      input.reset();
    };
  }, [def, retryKey]);

  // 提示条始终放在底部按钮区上方，避免和多行按钮重叠
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBarH(bar.offsetHeight));
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setHintOpen(false), 9000);
    return () => clearTimeout(t);
  }, [hint]);

  const takePhoto = () => {
    audio.unlock();
    audio.tone(1800, { gain: 0.08, decay: 0.08 });
    const url = captureRef.current();
    if (url) setPhoto(url);
  };

  return (
    <div className="stage" ref={stageRef} data-scene={meta.id}>
      <div className="stage-bg" aria-hidden />
      <video ref={videoRef} className="cam" playsInline muted aria-hidden style={{ opacity: 0 }} />
      <div className="layers" ref={layersRef} role="application" aria-label={`${meta.title} 互动区域`} />
      <canvas ref={cursorRef} className="cursor-layer" aria-hidden />
      {progress !== null && (
        <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-label="识别模型加载进度">
          <div style={{ width: `${Math.max(3, progress * 100)}%` }} />
        </div>
      )}
      <header className="topbar">
        <button className="icon-btn" onClick={onExit} aria-label="返回大厅">
          <Icon name="back" />
        </button>
        <div className="title-block">
          <h1>{meta.title}</h1>
          <div className="status">
            <span className="dot" ref={dotRef} data-on="0" />
            <span ref={statusRef}>{progress !== null ? '加载中…' : '准备中…'}</span>
            {progress !== null && <span className="pct">{Math.round(progress * 100)}%</span>}
          </div>
        </div>
        <button className="icon-btn" onClick={() => setHintOpen((v) => !v)} aria-label="玩法说明">
          <Icon name="help" />
        </button>
        <button className="icon-btn" onClick={() => (audio.unlock(), audio.setMuted(!muted))} aria-label={muted ? '打开声音' : '静音'}>
          <Icon name={muted ? 'mute' : 'sound'} />
        </button>
      </header>
      {banner && (
        <div className={`banner ${banner.kind}`} role="alert">
          <p>{banner.text}</p>
          <div className="banner-actions">
            {banner.retry && (
              <button
                className="chip"
                onClick={() => {
                  setBanner(null);
                  setRetryKey((k) => k + 1);
                }}
              >
                重试
              </button>
            )}
            <button className="chip ghost" onClick={() => setBanner(null)}>
              知道了
            </button>
          </div>
        </div>
      )}
      {hintOpen && (
        <div className="hint" style={barH > 80 ? { bottom: barH + 10 } : undefined} onClick={() => setHintOpen(false)}>
          <p>{hint}</p>
          <p className="sub">触屏：{meta.touchHint}</p>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      <div className="bottom-bar" ref={barRef}>
        <div className="scene-ui" ref={uiRef} />
        {meta.photo && (
          <button className="shutter" onClick={takePhoto} aria-label="拍照保存">
            <Icon name="camera" />
          </button>
        )}
      </div>
      {photo && (
        <div className="photo-modal" role="dialog" aria-label="照片预览">
          <img src={photo} alt="刚拍的照片" />
          <p className="sub">照片只保存在你的设备上。手机上可长按图片保存。</p>
          <div className="banner-actions">
            <a className="chip" href={photo} download={`lingjing-${meta.id}-${Date.now()}.jpg`}>
              保存图片
            </a>
            <button className="chip ghost" onClick={() => setPhoto(null)}>
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
