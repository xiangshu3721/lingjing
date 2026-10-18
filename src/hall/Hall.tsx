import { GROUPS, type InputKind } from '../scenes/types';
import { SCENES } from '../scenes';
import { Cover } from './Cover';

const INPUT_LABEL: Record<InputKind, string> = { hand: '手', face: '脸', pose: '身体', touch: '触屏', mic: '麦克风' };

export function Hall({ onEnter }: { onEnter: (id: string) => void }) {
  return (
    <main className="hall">
      <header className="hall-hero">
        <div className="seal" aria-hidden>
          灵<br />境
        </div>
        <div>
          <h1>
            灵境 <span>· 指间幻境</span>
          </h1>
          <p className="lead">举起手、做个表情、动一动身体 —— 在镜头前召唤东方幻境。</p>
          <p className="privacy">画面只在你的设备上处理，不上传、不录像。没有摄像头也能用手指玩。</p>
        </div>
      </header>
      {GROUPS.map((g) => {
        const list = SCENES.filter((s) => s.meta.group === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id} className="hall-group" aria-labelledby={`grp-${g.id}`}>
            <div className="group-head">
              <h2 id={`grp-${g.id}`}>{g.title}</h2>
              <p>{g.desc}</p>
            </div>
            <div className="cards">
              {list.map(({ meta }) => (
                <button key={meta.id} className="card" onClick={() => onEnter(meta.id)} data-testid={`card-${meta.id}`} aria-label={`进入 ${meta.title}：${meta.tagline}`}>
                  <div className="cover" style={{ ['--accent' as string]: meta.cover.accent }}>
                    <Cover meta={meta} />
                    <span className="glyph" style={{ color: meta.cover.accent }}>
                      {meta.cover.glyph}
                    </span>
                  </div>
                  <div className="card-body">
                    <h3>{meta.title}</h3>
                    <p>{meta.tagline}</p>
                    <div className="tags">
                      {meta.inputs.map((k) => (
                        <span key={k} className={`tag tag-${k}`}>
                          {INPUT_LABEL[k]}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <footer className="hall-foot">
        <p>建议在光线充足处使用，手离镜头 40–80 厘米效果最好。</p>
        <p>灵境 · 所有声音由浏览器实时合成 · 无广告无追踪</p>
      </footer>
    </main>
  );
}
