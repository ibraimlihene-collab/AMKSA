import { useEffect, useRef, useState } from 'react';
import { digits, puzzleCopy, text, type Language } from './i18n';
import { rebind, type Action, type Bindings } from './input';
import type { LogicPuzzle } from './content';

export type TouchSize = 'small' | 'medium' | 'large';
type SettingsProps = {
  lang: Language; music: number; sfx: number; motion: boolean; large: boolean; challenge: boolean; shake: boolean; touchSize: TouchSize; touchOpacity: number; bindings: Bindings;
  onMusic: (v: number) => void; onSfx: (v: number) => void; onMotion: (v: boolean) => void; onLarge: (v: boolean) => void; onChallenge: (v: boolean) => void; onShake: (v: boolean) => void; onTouchSize: (v: TouchSize) => void; onTouchOpacity: (v: number) => void; onBindings: (v: Bindings) => void;
};
export function Settings(p: SettingsProps) {
  const [binding, setBinding] = useState<Action | null>(null);
  useEffect(() => {
    if (!binding) return;
    const listener = (e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); if (!['Escape', 'Tab', 'Enter'].includes(e.code)) p.onBindings(rebind(p.bindings, binding, e.code)); setBinding(null); };
    window.addEventListener('keydown', listener, true); return () => window.removeEventListener('keydown', listener, true);
  }, [binding, p.bindings, p.onBindings]);
  const t = (k: string) => text(p.lang, k);
  return <details className="settings"><summary>{t('settings')}</summary>
    <label>{t('music')}<input type="range" min="0" max="1" step="0.05" value={p.music} onChange={e => p.onMusic(Number(e.target.value))} /></label>
    <label>{t('sfx')}<input type="range" min="0" max="1" step="0.05" value={p.sfx} onChange={e => p.onSfx(Number(e.target.value))} /></label>
    <label><input type="checkbox" checked={p.motion} onChange={e => p.onMotion(e.target.checked)} />{t('motion')}</label>
    <label><input type="checkbox" checked={p.shake} onChange={e => p.onShake(e.target.checked)} />{t('shake')}</label>
    <label><input type="checkbox" checked={p.large} onChange={e => p.onLarge(e.target.checked)} />{t('large')}</label>
    <label><input type="checkbox" checked={p.challenge} onChange={e => p.onChallenge(e.target.checked)} />{t('challenge')}</label>
    <label>{t('touchSize')}<select value={p.touchSize} onChange={e => p.onTouchSize(e.target.value as TouchSize)}><option value="small">{t('small')}</option><option value="medium">{t('medium')}</option><option value="large">{t('largeSize')}</option></select></label>
    <label>{t('touchOpacity')}<input type="range" min="0.3" max="1" step="0.05" value={p.touchOpacity} onChange={e => p.onTouchOpacity(Number(e.target.value))} /></label>
    <div className="binding-grid">{(Object.keys(p.bindings) as Action[]).map(a => <button key={a} onClick={() => setBinding(a)}>{t(a)}<kbd>{binding === a ? '…' : p.bindings[a]}</kbd></button>)}</div><p>{t('controls')}</p>
  </details>;
}

/** Three optional hint tiers for the current room. Revealing a hint costs nothing. */
export function HintPanel({ lang, hints, tier, onReveal }: { lang: Language; hints: [string, string, string] | null; tier: number; onReveal: () => void }) {
  const t = (k: string) => text(lang, k);
  if (!hints) return null;
  return <section className="hint-panel" aria-label={t('hints')}><h2>{t('hints')}</h2><p className="muted">{t('hintHelp')}</p>
    <ol>{hints.slice(0, tier).map(h => <li key={h}>{t(h)}</li>)}</ol>
    {tier < 3 && <button data-testid="reveal-hint" onClick={onReveal}>{t('hintTier')} {tier + 1} / 3</button>}
  </section>;
}

export function PuzzlePanel({ puzzle, lang, onSolve, onBack }: { puzzle: LogicPuzzle; lang: Language; onSolve: () => void; onBack: () => void }) {
  const [value, setValue] = useState(0), [wrong, setWrong] = useState(false), [hint, showHint] = useState(false), [marked, mark] = useState<number[]>([]);
  const heading = useRef<HTMLHeadingElement>(null); useEffect(() => { heading.current?.focus(); }, []);
  const t = (k: string) => text(lang, k), copy = puzzleCopy(puzzle.id, lang, puzzle);
  const piles = puzzle.piles ?? [], count = puzzle.kind === 'akomas-count', weights = puzzle.kind === 'equation';
  const target = count ? piles.length : puzzle.id === 3 ? 3 : 4;
  return <section className="panel puzzle-panel" data-testid="puzzle-panel" aria-labelledby="puzzle-title"><p className="eyebrow">AMKSA · {t('puzzle')}</p><h1 ref={heading} tabIndex={-1} id="puzzle-title">{copy.prompt}</h1>
    <aside className="clue"><strong>{t('clue')}</strong><p>{copy.clue ?? t('count')}</p></aside>
    {count && <div className="piles" data-testid="stone-piles">{piles.map((n, i) => <button key={i} aria-label={`${t('count')} ${i + 1}`} aria-pressed={marked.includes(i)} onClick={() => mark(v => v.includes(i) ? v.filter(a => a !== i) : [...v, i])}><svg viewBox="0 0 90 90" aria-hidden="true">{Array.from({ length: n }, (_, j) => <ellipse key={j} cx={45 + (j % 2 ? 4 : -3)} cy={76 - j * 15} rx={31 - j * 5} ry="9" fill={marked.includes(i) ? '#e9b85f' : '#a7b3ac'} stroke="#24352e" strokeWidth="2" />)}</svg>{marked.includes(i) ? '✓' : '○'}</button>)}</div>}
    {weights && <div className="balance" data-testid="weight-balance"><div className="beam" style={{ transform: `rotate(${Math.max(-14, Math.min(14, (value - target) * 4))}deg)` }} /><div className="balance-pans"><span>{puzzle.id === 3 ? '⚖ × 3' : '⚖ × ' + value}</span><span>{puzzle.id === 3 ? '● ● ● ● ● ● ● ● ●' : '● ● ● ● ● ● ● ●'}</span></div></div>}
    <div className="number-control"><button aria-label="−" onClick={() => { setValue(v => Math.max(0, v - 1)); setWrong(false); }}>−</button><output data-testid="puzzle-value">{digits(String(value), lang)}</output><button aria-label="+" onClick={() => { setValue(v => Math.min(36, v + 1)); setWrong(false); }}>+</button></div>
    {wrong && <p role="alert" className="error">{t('wrong')}</p>}{hint && <p>{copy.hint}</p>}<div className="actions"><button onClick={onBack}>{t('back')}</button><button onClick={() => showHint(true)}>{t('hint')}</button><button className="primary" data-testid="confirm-puzzle" onClick={() => value === target ? onSolve() : setWrong(true)}>{t('confirm')}</button></div>
  </section>;
}
