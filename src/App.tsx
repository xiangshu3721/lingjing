import { useEffect, useState } from 'react';
import { audio } from './engine/audio';
import { Hall } from './hall/Hall';
import { findScene } from './scenes';
import { SceneShell } from './ui/SceneShell';

function sceneFromHash() {
  const m = location.hash.match(/^#\/s\/([\w-]+)/);
  return m ? m[1] : null;
}

export default function App() {
  const [id, setId] = useState<string | null>(sceneFromHash());
  useEffect(() => {
    const on = () => setId(sceneFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const def = id ? findScene(id) : undefined;
  useEffect(() => {
    document.title = def ? `${def.meta.title} · 灵境` : '灵境 · 指间幻境';
    if (!def) window.scrollTo(0, Number(sessionStorage.getItem('hallScroll') || 0));
  }, [def]);
  if (def)
    return (
      <SceneShell
        key={def.meta.id}
        def={def}
        onExit={() => {
          if (history.length > 1 && sessionStorage.getItem('cameFromHall') === '1') history.back();
          else location.hash = '';
        }}
      />
    );
  return (
    <Hall
      onEnter={(sid) => {
        audio.unlock();
        sessionStorage.setItem('hallScroll', String(window.scrollY));
        sessionStorage.setItem('cameFromHall', '1');
        location.hash = `#/s/${sid}`;
      }}
    />
  );
}
