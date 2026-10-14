import { COLORS, type AvatarAppearance } from '@rene/contracts';
import { AvatarPortrait } from './AvatarPortrait';
const choices: { key: keyof AvatarAppearance; label: string; options: [string, string][] }[] = [
  { key: 'head', label: 'La silhouette', options: [['pear', 'Poire'], ['square', 'Pavé'], ['bean', 'Haricot']] },
  { key: 'hair', label: 'La coiffure', options: [['none', 'Rien'], ['tuft', 'Mèche'], ['flat', 'Casque'], ['spikes', 'Piques']] },
  { key: 'eyes', label: 'Le regard', options: [['wide', 'Ébahi'], ['sleepy', 'Blasé'], ['tiny', 'Malin']] },
  { key: 'nose', label: 'Le nez', options: [['long', 'Immense'], ['round', 'Patate'], ['small', 'Discret']] },
  { key: 'mouth', label: 'L’expression', options: [['flat', 'Impassible'], ['smile', 'Sourire'], ['surprised', 'Surprise']] },
  { key: 'accessory', label: 'Le petit truc', options: [['none', 'Nature'], ['glasses', 'Lunettes'], ['hat', 'Chapeau'], ['moustache', 'Moustache']] },
];
const colorNames = ['Rose', 'Tomate', 'Citron', 'Vert', 'Pétrole', 'Encre', 'Crème'];
export function AvatarEditor({ value, onChange }: { value: AvatarAppearance; onChange: (a: AvatarAppearance) => void }) {
  return <div className="avatar-editor"><div className="editor-preview"><span className="eyebrow">Spécimen unique</span><AvatarPortrait appearance={value} /><span className="handwritten">c’est tout vous.</span></div><div className="editor-options">
    {choices.map(({ key, label, options }) => <label className="field" key={key}>{label}<select value={value[key]} onChange={event => onChange({ ...value, [key]: event.target.value })}>{options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>)}
    {([['skin', 'Visage'], ['body', 'Vêtement'], ['hairColor', 'Cheveux']] as const).map(([key, label]) => <fieldset className="swatch-field" key={key}><legend>{label}</legend><div className="swatches">{COLORS.map((color, i) => <button key={color} type="button" title={colorNames[i]} aria-label={`${label} ${colorNames[i]}`} aria-pressed={value[key] === color} style={{ background: color }} onClick={() => onChange({ ...value, [key]: color })}>{value[key] === color && <span style={{ color: color === '#191719' || color === '#087BA0' ? 'white' : '#191719' }}>✓</span>}</button>)}</div></fieldset>)}
  </div></div>;
}
