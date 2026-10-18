"""用合成手部关键点（注入 window.__lingjingFakeHands）验证视频复刻四场景对「手势」的响应。
用法: python3 e2e/gestures.py <base_url>
"""
import math, os, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4174/lingjing/'
SHOTS = os.environ.get('SHOTS', '/workspace/lingjing-shots')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
errors_all = []


def make_hand(cx=0.5, cy=0.75, s=0.1, ext=(1, 1, 1, 1, 1), pinch=False, flat=True):
    """与 tests/handFixtures.ts 一致（归一化坐标，视频 640x480）"""
    lm = [None] * 21
    asp = 480 / 640  # x 按宽归一化：让手在像素上不变形

    def P(x, y):
        return {'x': cx + x * s * asp * (1 if flat else 0.15), 'y': cy + y * s, 'z': (0 if flat else x * s)}
    lm[0] = P(0, 0)
    bases = [-0.32, 0, 0.3, 0.55]
    ids = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]
    for k, f in enumerate(ids):
        bx = bases[k]
        lm[f[0]] = P(bx, -1)
        if ext[k + 1]:
            lm[f[1]], lm[f[2]], lm[f[3]] = P(bx, -1.4), P(bx, -1.7), P(bx, -2.0)
        else:
            lm[f[1]], lm[f[2]], lm[f[3]] = P(bx, -1.3), P(bx, -1.05), P(bx, -0.85)
    lm[1], lm[2] = P(-0.35, -0.2), P(-0.65, -0.4)
    if ext[0]:
        lm[3], lm[4] = P(-0.95, -0.55), P(-1.2, -0.65)
    else:
        lm[3], lm[4] = P(-0.55, -0.7), P(-0.35, -0.85)
    if pinch:
        lm[4] = dict(lm[8])
        lm[4]['x'] += 0.002
    return lm


PINCH = dict(ext=(1, 1, 0, 0, 0), pinch=True)
OPEN = dict(ext=(1, 1, 1, 1, 1))
LSHAPE = dict(ext=(1, 1, 0, 0, 0))


def setf(pg, hands):
    pg.evaluate('h => { window.__lingjingFakeHands = h; }', hands)


def run(b, sid, steps):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script("""(() => { const md = navigator.mediaDevices || {}; md.getUserMedia = () => Promise.reject(new DOMException('mock', 'NotFoundError')); })();""")
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(BASE + '#/s/' + sid)
    pg.wait_for_function('window.__lingjing && window.__lingjing.info().sceneReady', timeout=20000)
    pg.evaluate("document.querySelector('.banner .ghost') && document.querySelector('.banner .ghost').click()")
    pg.evaluate("document.querySelector('.hint') && document.querySelector('.hint').click()")
    steps(pg)
    info = pg.evaluate('window.__lingjing.info()')
    print(sid, 'gestures seen:', info['gestures'], 'errors:', errs[:3])
    errors_all.extend(errs)
    ctx.close()


def box(pg):
    # 两只手捏合，逐渐拉开并旋转
    for i in range(20):
        a = 0.35 - i * 0.006
        setf(pg, [make_hand(cx=0.5 - a * 0.6, cy=0.62 + i * 0.002, **PINCH), make_hand(cx=0.5 + a * 0.6, cy=0.55 - i * 0.004, s=0.11, **PINCH)])
        pg.wait_for_timeout(40)
    pg.wait_for_timeout(300)
    pg.screenshot(path=f'{SHOTS}/gesture_box.png')
    setf(pg, [make_hand(cx=0.3, cy=0.62, **OPEN), make_hand(cx=0.7, cy=0.55, **OPEN)])
    pg.wait_for_timeout(200)
    pg.screenshot(path=f'{SHOTS}/gesture_box_release.png')


def shatter(pg):
    setf(pg, [make_hand(cx=0.75, cy=0.6, **OPEN)])
    pg.wait_for_timeout(300)
    pg.screenshot(path=f'{SHOTS}/gesture_shatter_tooltip.png')
    for i in range(24):
        setf(pg, [make_hand(cx=0.78 - i * 0.022, cy=0.55 + math.sin(i * 0.8) * 0.03, **PINCH)])
        pg.wait_for_timeout(45)
    pg.screenshot(path=f'{SHOTS}/gesture_shatter_crack.png')
    setf(pg, [make_hand(cx=0.25, cy=0.55, **OPEN)])
    pg.wait_for_timeout(400)
    pg.screenshot(path=f'{SHOTS}/gesture_shatter_break.png')
    pg.wait_for_timeout(2600)
    pg.screenshot(path=f'{SHOTS}/gesture_shatter_orbit.png')
    setf(pg, [make_hand(cx=0.5, cy=0.55, **PINCH)])
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{SHOTS}/gesture_shatter_rewind.png')


def heart(pg):
    n = 46
    for i in range(n + 1):
        t = i / n * math.pi * 2
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        # 视频坐标（镜像前），屏幕会左右翻转
        setf(pg, [make_hand(cx=0.5 - x / 17 * 0.13, cy=0.62 - y / 17 * 0.12, s=0.09, **PINCH)])
        pg.wait_for_timeout(35)
    setf(pg, [make_hand(cx=0.5, cy=0.9, s=0.09, ext=(1, 1, 0, 0, 0))])
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SHOTS}/gesture_heart_drawn.png')
    # 握拳 → 张开 = 星爆
    setf(pg, [make_hand(cx=0.5, cy=0.7, ext=(0, 0, 0, 0, 0))])
    pg.wait_for_timeout(250)
    setf(pg, [make_hand(cx=0.5, cy=0.7, **OPEN)])
    pg.wait_for_timeout(300)
    pg.screenshot(path=f'{SHOTS}/gesture_heart_burst.png')
    # 挥手 → 水波
    for i in range(14):
        setf(pg, [make_hand(cx=0.25 + i * 0.04, cy=0.7, **OPEN)])
        pg.wait_for_timeout(35)
    pg.screenshot(path=f'{SHOTS}/gesture_heart_ripple.png')
    # 平掌不动 → 催眠
    setf(pg, [make_hand(cx=0.5, cy=0.65, s=0.12, **OPEN)])
    pg.wait_for_timeout(4200)
    pg.screenshot(path=f'{SHOTS}/gesture_heart_hypno.png')


def flower(pg):
    for i in range(16):
        a = 0.2 + i * 0.008
        setf(pg, [make_hand(cx=0.5 - a, cy=0.62, **PINCH), make_hand(cx=0.5 + a, cy=0.58, **PINCH)])
        pg.wait_for_timeout(45)
    pg.wait_for_timeout(400)
    pg.screenshot(path=f'{SHOTS}/gesture_flower_held.png')
    setf(pg, [make_hand(cx=0.3, cy=0.62, **OPEN), make_hand(cx=0.7, cy=0.58, **OPEN)])
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{SHOTS}/gesture_flower_cloud.png')
    setf(pg, [make_hand(cx=0.3, cy=0.62, **LSHAPE)])
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{SHOTS}/gesture_flower_chaos.png')
    setf(pg, [make_hand(cx=0.3, cy=0.62, **PINCH), make_hand(cx=0.7, cy=0.58, **PINCH)])
    pg.wait_for_timeout(700)
    pg.screenshot(path=f'{SHOTS}/gesture_flower_reassemble.png')
    pg.wait_for_timeout(1000)
    pg.screenshot(path=f'{SHOTS}/gesture_flower_back.png')


with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    for sid, fn in [('box', box), ('shatter', shatter), ('heart', heart), ('flowercube', flower)]:
        run(b, sid, fn)
    b.close()
print('TOTAL ERRORS', len(errors_all))
sys.exit(1 if errors_all else 0)
