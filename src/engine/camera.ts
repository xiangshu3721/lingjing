export type CameraErrorKind = 'denied' | 'nodevice' | 'busy' | 'unsupported' | 'insecure' | 'unknown';

export class CameraError extends Error {
  constructor(public kind: CameraErrorKind) {
    super(kind);
  }
}

export function classifyCameraError(err: unknown): CameraErrorKind {
  if (err instanceof CameraError) return err.kind;
  const name = (err as { name?: string })?.name ?? '';
  if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(name)) return 'denied';
  if (['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError'].includes(name)) return 'nodevice';
  if (['NotReadableError', 'TrackStartError', 'AbortError'].includes(name)) return 'busy';
  if (name === 'TypeError') return 'unsupported';
  return 'unknown';
}

export const CAMERA_ERROR_TEXT: Record<CameraErrorKind, string> = {
  denied: '没有拿到摄像头权限。可在浏览器地址栏的「锁」图标里重新允许；现在先用手指 / 鼠标玩。',
  nodevice: '没找到摄像头，先用手指 / 鼠标玩吧。',
  busy: '摄像头被别的应用占用了，关掉后点「重试」；现在先用手指 / 鼠标玩。',
  unsupported: '这个浏览器不支持摄像头，建议用最新版 Safari / Chrome / 微信。先用手指 / 鼠标玩。',
  insecure: '需要 https 网址才能打开摄像头，先用手指 / 鼠标玩。',
  unknown: '摄像头没能打开，可点「重试」；现在先用手指 / 鼠标玩。',
};

export async function openCamera(): Promise<MediaStream> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) throw new CameraError('insecure');
  const md = navigator.mediaDevices;
  if (!md || typeof md.getUserMedia !== 'function') throw new CameraError('unsupported');
  const video: MediaTrackConstraints = {
    facingMode: { ideal: 'user' },
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, max: 30 },
  };
  try {
    return await md.getUserMedia({ video, audio: false });
  } catch (err) {
    if ((err as { name?: string })?.name === 'OverconstrainedError') return md.getUserMedia({ video: true, audio: false });
    throw err;
  }
}

export function stopStream(s: MediaStream | null | undefined) {
  s?.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      /* ignore */
    }
  });
}
