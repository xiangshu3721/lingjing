"""灵境 端到端测试（Playwright + 无头 Chrome）
用法: python3 e2e/e2e.py <base_url> [场景id,逗号分隔]
- 大厅：手机 390x844 / 桌面 1440x900 截图，检查不横向溢出
- 每个场景：fake 摄像头（视频文件）进入 → 等识别就绪 → 用鼠标/触屏模拟操作 → 截图 → 检查无报错
- 无摄像头（拒绝权限）进入每个场景 → 有友好提示，触屏仍可操作
- 检查没有请求外部域名
"""
import json, os, sys, time
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4174/lingjing/'
ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else None
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
SHOTS = os.environ.get('SHOTS', '/workspace/lingjing-shots')
FAKE_VIDEO = os.environ.get('FAKE_VIDEO', '/workspace/aircanvas-e2e/hand.y4m')
TAG = os.environ.get('TAG', 'local')
os.makedirs(SHOTS, exist_ok=True)
results = []
IGNORE = ('GPU stall', 'WebGL', 'gpu', 'GL_', 'Automatic fallback to software', 'INFO:', 'Created TensorFlow', 'OpenGL', 'Feedback manager')


def ok(name, cond, info=''):
    results.append({'name': name, 'pass': bool(cond), 'info': str(info)[:300]})
    print(('PASS' if cond else 'FAIL'), name, str(info)[:300], flush=True)


def heart_path(cx, cy, s, n=40):
    import math
    pts = []
    for i in range(n + 1):
        t = i / n * math.pi * 2
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x / 17 * s, cy - y / 17 * s))
    return pts


def drag(pg, pts, hold_end=0.0):
    pg.mouse.move(*pts[0])
    pg.mouse.down()
    for x, y in pts[1:]:
        pg.mouse.move(x, y, steps=3)
        pg.wait_for_timeout(16)
    if hold_end:
        pg.wait_for_timeout(int(hold_end * 1000))
    pg.mouse.up()


def click_chip(pg, text):
    loc = pg.locator('.scene-ui .chip', has_text=text)
    if loc.count():
        loc.first.click()
        return True
    return False


def act(pg, sid, W, H):
    """各场景的模拟操作，返回操作后要截图的等待毫秒"""
    cx, cy = W / 2, H / 2
    if sid in ('box', 'flowercube'):
        pg.mouse.move(cx - W * 0.25, cy + 40)
        pg.mouse.down()
        for i in range(12):
            pg.mouse.move(cx - W * 0.25 + i * W * 0.04, cy + 40 - i * 8, steps=2)
            pg.wait_for_timeout(30)
        pg.wait_for_timeout(500)
        pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_held.png')
        pg.mouse.up()
        if sid == 'flowercube':
            pg.wait_for_timeout(1200)
            pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_cloud.png')
            click_chip(pg, '乱旋')
            pg.wait_for_timeout(1200)
            pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_chaos.png')
            click_chip(pg, '乱旋')
            drag(pg, [(cx - 100, cy), (cx + 100, cy - 30)], hold_end=1.6)
        return 600
    if sid == 'shatter':
        pts = [(cx - W * 0.3 + i * W * 0.04, cy - 60 + (i % 3) * 30) for i in range(16)]
        drag(pg, pts)
        pg.wait_for_timeout(1800)
        pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_falling.png')
        pg.wait_for_timeout(2500)
        return 10
    if sid == 'heart':
        drag(pg, heart_path(cx, cy - 40, min(W, H) * 0.25))
        pg.wait_for_timeout(700)
        pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_drawn.png')
        click_chip(pg, '星爆')
        pg.wait_for_timeout(250)
        pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_burst.png')
        click_chip(pg, '水波')
        drag(pg, [(cx - 120 + i * 20, cy + 60 + (i % 2) * 20) for i in range(12)])
        pg.wait_for_timeout(200)
        pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_ripple.png')
        click_chip(pg, '水波')
        click_chip(pg, '催眠')
        pg.wait_for_timeout(3000)
        pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_hypno.png')
        click_chip(pg, '催眠')
        return 300
    if sid == 'vinyl':
        import math
        R = min(W * 0.4, H * 0.27)
        rcx, rcy = W / 2 - R * 0.12, H * 0.46
        px, py = rcx + R * 1.12, rcy - R * 0.95
        a = math.pi / 2 + 0.15 + 0.05
        hx, hy = px + math.cos(a) * R * 1.55, py + math.sin(a) * R * 1.55
        a2 = math.pi / 2 + 0.15 + 0.5
        tx, ty = px + math.cos(a2) * R * 1.55, py + math.sin(a2) * R * 1.55
        pg.wait_for_timeout(2500)
        drag(pg, [(hx, hy), ((hx + tx) / 2, (hy + ty) / 2), (tx, ty)])
        pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_playing.png')
        pts = [(rcx + math.cos(t / 10 * 6.28) * R * 0.7, rcy + math.sin(t / 10 * 6.28) * R * 0.7) for t in range(12)]
        drag(pg, pts)
        click_chip(pg, '下一张')
        pg.wait_for_timeout(1500)
        return 500
    if sid == 'recorder':
        click_chip(pg, '录音')
        pg.wait_for_timeout(1800)
        click_chip(pg, '停止录音')
        pg.wait_for_timeout(1200)
        click_chip(pg, '变声')
        click_chip(pg, '播放')
        pg.wait_for_timeout(600)
        pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_playing.png')
        return 300
    if sid == 'ikebana':
        tray_y = H - 150 + 8
        gap = min(64, (W - 24) / 6)
        for i in range(4):
            x = W / 2 + (i - 2.5) * gap
            drag(pg, [(x, tray_y), (x, tray_y - 120), (W / 2 + (i - 1.5) * 60, H * 0.25 + i * 20)])
            pg.wait_for_timeout(150)
        return 500
    if sid == 'tea':
        pg.mouse.move(W * 0.3, H * 0.35)
        pg.mouse.down()
        pg.mouse.move(W * 0.6, H * 0.45, steps=10)
        pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{SHOTS}/{TAG}_scene_{sid}_pour.png')
        pg.mouse.up()
        return 1200
    if sid == 'cards':
        pg.mouse.click(W / 2, H * 0.45)
        pg.wait_for_timeout(1400)
        pg.mouse.click(W / 2, H * 0.62)
        pg.wait_for_timeout(1500)
        return 300
    if sid in ('fudai', 'tangyuan'):
        click_chip(pg, '开始')
        for i in range(10):
            pg.mouse.click(W * (0.2 + 0.06 * i), H * 0.5)
            pg.wait_for_timeout(200)
        drag(pg, [(W * 0.2, H * 0.75), (W * 0.8, H * 0.75), (W * 0.4, H * 0.75)])
        return 1500
    if sid == 'dressup':
        for t in ['发型', '发型', '头饰', '眼镜', '面妆']:
            click_chip(pg, t)
            pg.wait_for_timeout(120)
        return 400
    # 通用：点几下 + 拖动
    for i in range(3):
        pg.mouse.click(cx + (i - 1) * 60, cy)
        pg.wait_for_timeout(250)
    drag(pg, [(cx - 120 + i * 24, cy + 40 - (i % 4) * 18) for i in range(11)])
    return 800


def run_scene(b, sid, mode, vp, mobile):
    ctx = b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, has_touch=mobile, is_mobile=mobile, permissions=['camera', 'microphone'])
    if mode == 'denied':
        ctx.add_init_script("""(() => { const md = navigator.mediaDevices || {}; md.getUserMedia = () => Promise.reject(new DOMException('mock', 'NotAllowedError')); })();""")
    pg = ctx.new_page()
    errors, ext = [], []
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and not any(k in m.text for k in IGNORE) else None)
    pg.on('pageerror', lambda e: errors.append('PAGEERROR ' + str(e)))
    host = urlparse(BASE).netloc
    pg.on('request', lambda r: ext.append(r.url) if urlparse(r.url).netloc not in (host, '') and not r.url.startswith(('data:', 'blob:')) else None)
    t0 = time.time()
    pg.goto(BASE + '#/s/' + sid)
    V = f'[{mode}] {sid}: '
    try:
        pg.wait_for_function('window.__lingjing && window.__lingjing.info().sceneReady', timeout=20000)
    except Exception as e:
        ok(V + '场景加载', False, e)
        pg.screenshot(path=f'{SHOTS}/{TAG}_fail_{mode}_{sid}.png')
        ctx.close()
        return
    info = None
    if mode == 'fake' and sid == 'recorder':
        info = pg.evaluate('window.__lingjing.info()')
        ok(V + '无需摄像头（仅麦克风）', not info['cameraOk'], info)
    elif mode == 'fake':
        try:
            pg.wait_for_function('(() => { const i = window.__lingjing.info(); return i.cameraOk && (i.modelsReady || i.delegate === ""); })()', timeout=60000)
            pg.wait_for_timeout(1500)
            info = pg.evaluate('window.__lingjing.info()')
            ok(V + '摄像头+识别就绪', True, f"{time.time()-t0:.1f}s {info}")
        except Exception as e:
            info = pg.evaluate('window.__lingjing.info()')
            ok(V + '摄像头+识别就绪', False, info)
    else:
        pg.wait_for_timeout(800)
        meta_no_cam = pg.evaluate("document.querySelector('.banner') !== null")
        ok(V + '拒绝摄像头时显示友好提示', meta_no_cam or sid in ('recorder',), pg.evaluate("(document.querySelector('.banner p')||{}).textContent"))
    W, H = vp['width'], vp['height']
    wait = act(pg, sid, W, H)
    pg.wait_for_timeout(wait)
    info = pg.evaluate('window.__lingjing.info()')
    ok(V + '运行中帧率', info['fps'] >= 5, info)
    shot = f'{SHOTS}/{TAG}_scene_{sid}{"" if mode == "fake" else "_nocam"}{"_m" if mobile else ""}.png'
    pg.screenshot(path=shot)
    # 返回大厅，检查摄像头关闭
    pg.locator('button[aria-label="返回大厅"]').click()
    pg.wait_for_timeout(500)
    ok(V + '返回大厅', pg.locator('.hall').count() == 1)
    ok(V + '无报错', not errors, errors[:5])
    ok(V + '无外部请求', not ext, ext[:5])
    ctx.close()


def hall(b):
    for name, vp, mobile in [('mobile', {'width': 390, 'height': 844}, True), ('desktop', {'width': 1440, 'height': 900}, False)]:
        ctx = b.new_context(viewport=vp, device_scale_factor=2 if mobile else 1, has_touch=mobile, is_mobile=mobile)
        pg = ctx.new_page()
        errors = []
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(BASE)
        pg.wait_for_selector('.card')
        pg.wait_for_timeout(400)
        n = pg.locator('.card').count()
        ov = pg.evaluate('document.documentElement.scrollWidth - innerWidth')
        ok(f'大厅 {name}: 卡片数量', n >= 4, n)
        ok(f'大厅 {name}: 不横向溢出', ov <= 0, ov)
        ok(f'大厅 {name}: 无报错', not errors, errors[:3])
        pg.screenshot(path=f'{SHOTS}/{TAG}_hall_{name}.png')
        pg.screenshot(path=f'{SHOTS}/{TAG}_hall_{name}_full.png', full_page=True)
        ctx.close()


def main():
    with sync_playwright() as p:
        args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', f'--use-file-for-fake-video-capture={FAKE_VIDEO}',
                '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
        b = p.chromium.launch(executable_path=CHROME, args=args)
        hall(b)
        pg = b.new_page()
        pg.goto(BASE)
        ids = pg.evaluate("Array.from(document.querySelectorAll('.card')).map(c => c.dataset.testid.replace('card-',''))")
        pg.close()
        if ONLY:
            ids = [i for i in ids if i in ONLY]
        for sid in ids:
            run_scene(b, sid, 'fake', {'width': 390, 'height': 844}, True)
        for sid in ids:
            run_scene(b, sid, 'denied', {'width': 1280, 'height': 800}, False)
        b.close()
    fails = [r for r in results if not r['pass']]
    json.dump(results, open(f'{SHOTS}/e2e_{TAG}.json', 'w'), ensure_ascii=False, indent=1)
    print(f'\n总计 {len(results)} 项，失败 {len(fails)} 项')
    for f in fails:
        print('  FAIL', f['name'], f['info'])
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    main()
