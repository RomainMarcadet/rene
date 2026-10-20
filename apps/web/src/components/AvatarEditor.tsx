import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { AppearanceSchema, AVATAR_CATALOG, COLORS, COLOR_NAMES, HEADWEAR, PERSONALITIES, randomAppearance, type AvatarAppearance, type AvatarCategory } from '@rene/contracts';
import { AvatarPortrait } from './AvatarPortrait';
const Preview = lazy(() => import('../scene/AvatarPreview'));
const labels: Record<AvatarCategory, string> = { head: 'La silhouette', hair: 'La coiffure', eyes: 'Le regard', nose: 'Le nez', mouth: 'L’expression', accessory: 'Le petit truc' };
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="hint">La 3D est indisponible. Utilisez le portrait.</p> : this.props.children; }
}
export function AvatarEditor({ value, onChange }: { value: AvatarAppearance; onChange: (a: AvatarAppearance) => void }) {
  const [notice, setNotice] = useState('');
  const change = (key: keyof AvatarAppearance, next: string) => { setNotice(''); onChange(AppearanceSchema.parse({ ...value, [key]: next })); };
  return <div className="avatar-editor">
    <div className="editor-preview"><span className="eyebrow">Spécimen unique</span>
      <div className="editor-3d" role="img" aria-label="Aperçu 3D de votre avatar"><PreviewBoundary><Suspense fallback={<p className="hint">Votre tête prend du volume…</p>}><Preview appearance={value} /></Suspense></PreviewBoundary></div>
      <div className="editor-portrait"><AvatarPortrait appearance={value} /><span className="handwritten">c’est tout vous.</span></div>
      <button type="button" className="button button-cream random-avatar" onClick={() => { onChange(randomAppearance()); setNotice('Une nouvelle tête, rien qu’à vous.'); }}>Surprends-moi ↗</button>
      <p className="editor-notice" role="status">{notice || 'Faites glisser l’aperçu pour tourner.'}</p>
    </div>
    <div className="editor-options">
      <label className="field">L’allure<select aria-label="L’allure" value={value.personality} onChange={event => change('personality', event.target.value)}>{Object.entries(PERSONALITIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      {(Object.keys(AVATAR_CATALOG) as AvatarCategory[]).map(key => <label className="field" key={key}>{labels[key]}<select aria-label={labels[key]} value={value[key]} onChange={event => change(key, event.target.value)}>{Object.entries(AVATAR_CATALOG[key]).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>)}
      {(HEADWEAR as readonly string[]).includes(value.accessory) && value.hair !== 'none' && <p className="hint editor-fit-note">La coiffure se tasse sous le couvre-chef.</p>}
      {([['skin', 'Visage'], ['body', 'Vêtement'], ['hairColor', 'Cheveux'], ['accessoryColor', 'Accessoire']] as const).map(([key, label]) => <fieldset className="swatch-field" key={key}><legend>{label}</legend><div className="swatches">{COLORS.map((color, i) => <button key={color} type="button" title={COLOR_NAMES[i]} aria-label={`${label} ${COLOR_NAMES[i]}`} aria-pressed={value[key] === color} style={{ background: color }} onClick={() => change(key, color)}>{value[key] === color && <span style={{ color: ['#191719', '#087BA0', '#455FC1', '#6A4637', '#9D422F'].includes(color) ? 'white' : '#191719' }}>✓</span>}</button>)}</div></fieldset>)}
    </div>
  </div>;
}
