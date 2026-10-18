export interface Pt {
  x: number;
  y: number;
  z?: number;
}

export type GestureName = 'none' | 'pinch' | 'open' | 'fist' | 'L' | 'point' | 'victory';

export const GESTURE_LABEL: Record<GestureName, string> = {
  none: '手',
  pinch: '捏合',
  open: '张开手掌',
  fist: '握拳',
  L: 'L 手势',
  point: '食指',
  victory: '剪刀手',
};

/** 一只手（来自摄像头，或由触屏/鼠标模拟），坐标均为舞台 CSS 像素，已做镜像 */
export interface Hand {
  id: number;
  source: 'camera' | 'touch';
  /** 21 个关键点（舞台像素）；触屏模拟的手为 null */
  lm: Pt[] | null;
  /** 手掌中心 */
  palm: Pt;
  /** 拇指尖与食指尖中点 */
  pinchPt: Pt;
  /** 食指尖 */
  tip: Pt;
  pinching: boolean;
  pinchRatio: number;
  gesture: GestureName;
  /** 手掌大小（手腕到中指根，像素），可当作远近 */
  palmSize: number;
  /** 手掌速度（像素/秒） */
  vel: Pt;
  /** 手的倾斜角：手腕→中指根 相对竖直向上的角度（弧度，顺时针为正） */
  roll: number;
  /** 掌心是否正对镜头（平摊） */
  palmFlat: boolean;
  handedness: string;
}

export interface Face {
  /** 478 个关键点（舞台像素） */
  lm: Pt[];
  bs: Record<string, number>;
  blink: number;
  mouthOpen: number;
  smile: number;
  browUp: number;
  frown: number;
  /** 两眼外角连线角度（弧度） */
  roll: number;
  /** 左右转头 -1~1（正为用户看到的右） */
  yaw: number;
  center: Pt;
  /** 脸宽（像素，两鬓之间） */
  width: number;
  /** 额头顶到下巴 */
  height: number;
  nose: Pt;
  mouth: Pt;
}

export interface PosePt extends Pt {
  v: number;
}

export interface Pose {
  lm: PosePt[];
}

export interface InputFrame {
  t: number;
  dt: number;
  width: number;
  height: number;
  /** 摄像头 + 识别是否在工作 */
  tracking: boolean;
  hands: Hand[];
  face: Face | null;
  pose: Pose | null;
  /** 本帧开始捏合的手 */
  pinchStarted: Hand[];
  /** 本帧结束捏合的手（包括捏着时消失的手），为最后一次的状态 */
  pinchEnded: Hand[];
}

export interface Needs {
  hand?: boolean;
  face?: boolean;
  pose?: boolean;
}
