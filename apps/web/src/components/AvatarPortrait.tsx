import type { AvatarAppearance } from '@rene/contracts';
export function AvatarPortrait({ appearance: a, className = '' }: { appearance: AvatarAppearance; className?: string }) {
  return <svg className={`portrait ${className}`} viewBox="0 0 180 200" role="img" aria-label="Votre drôle de tête">
    <path d="M32 200 42 150 Q88 129 139 150 L151 200" fill={a.body} stroke="#191719" strokeWidth="3" />
    <g transform={a.head === 'bean' ? 'rotate(-8 90 95)' : undefined}>
      <path d={a.head === 'square' ? 'M44 34 Q86 20 130 37 L137 131 Q133 157 104 155 L50 151 Q30 151 32 125 L29 57 Q29 35 44 34' : a.head === 'bean' ? 'M112 24 Q154 38 136 83 Q167 130 112 151 Q42 179 30 111 Q15 74 53 54 Q72 6 112 24' : 'M82 21 Q125 21 125 65 Q168 134 117 157 Q50 173 29 133 Q14 110 44 68 Q49 19 82 21'} fill={a.skin} stroke="#191719" strokeWidth="3" />
      {a.hair === 'tuft' && <path d="M57 42 Q39 -2 73 14 L83 34 Q80 -3 105 13 L107 39" fill={a.hairColor} />}
      {a.hair === 'flat' && <path d="M37 48 Q25 8 80 18 Q139 4 141 60 L116 57 118 39 56 43 51 65Z" fill={a.hairColor} />}
      {a.hair === 'spikes' && <path d="M38 51 35 11 60 34 70 1 84 31 109 3 114 35 143 22 129 60Z" fill={a.hairColor} />}
      {[61, 114].map((x, i) => <g key={x}><ellipse cx={x} cy={79 + i * 3} rx={a.eyes === 'tiny' ? 8 : 16} ry={a.eyes === 'sleepy' ? 8 : 20} fill="#F5F2EA" stroke="#191719" strokeWidth="2" /><ellipse cx={x + 3} cy={81 + i * 3} rx="4" ry="6" fill="#191719" /></g>)}
      <path d={a.nose === 'long' ? 'M87 79 109 119 74 116' : a.nose === 'round' ? 'M83 92 Q112 91 105 112 Q86 125 78 109Z' : 'M88 101 95 109 85 109'} fill="#F34531" stroke="#191719" strokeWidth="2" strokeLinejoin="round" />
      {a.mouth === 'surprised' ? <ellipse cx="91" cy="133" rx="6" ry="9" fill="#191719" /> : <path d={a.mouth === 'smile' ? 'M69 126 Q91 149 112 125' : 'M78 132 103 130'} fill="none" stroke="#191719" strokeWidth="4" strokeLinecap="round" />}
      {a.accessory === 'glasses' && <g fill="none" stroke="#191719" strokeWidth="5"><ellipse cx="60" cy="82" rx="25" ry="28" /><ellipse cx="118" cy="83" rx="24" ry="27" /><path d="M85 78 93 78" /></g>}
      {a.accessory === 'hat' && <g fill="#65B847" stroke="#191719" strokeWidth="3"><path d="M67 33 64 0 110 0 116 32Z" /><ellipse cx="88" cy="33" rx="49" ry="10" /></g>}
      {a.accessory === 'moustache' && <path d="M89 117 Q58 108 57 137 Q72 134 88 126 Q106 140 125 130 Q118 105 89 117" fill="#191719" />}
    </g>
  </svg>;
}
