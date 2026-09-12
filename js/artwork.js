const svg = (content, viewBox = '0 0 360 180') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none" aria-hidden="true">${content}</svg>`;
const ticks = (cx, cy, radius, count, from = 0, sweep = 360, major = 5) => Array.from({length: count}, (_, i) => {
  const angle = (from + i * sweep / (sweep === 360 ? count : count - 1)) * Math.PI / 180;
  const length = i % major === 0 ? 12 : 6;
  return `<path d="M${cx + Math.cos(angle) * radius} ${cy + Math.sin(angle) * radius}l${-Math.cos(angle) * length} ${-Math.sin(angle) * length}" stroke="currentColor" stroke-width="${i % major === 0 ? 1.5 : 1}" opacity="${i % major === 0 ? .65 : .25}"/>`;
}).join('');
const hex = (x, y, r, color, opacity = 1) => `<polygon points="${Array.from({length:6}, (_,i) => `${x+r*Math.cos((30+i*60)*Math.PI/180)},${y+r*Math.sin((30+i*60)*Math.PI/180)}`).join(' ')}" fill="${color}" opacity="${opacity}" stroke="#262a26" stroke-width="1.2" stroke-linejoin="round"/>`;
export const artwork = {
  hero: svg(`
    <defs><pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" stroke="#bcb9af" stroke-width=".5" opacity=".55"/></pattern></defs>
    <rect x="18" y="18" width="414" height="370" rx="4" fill="url(#grid)"/>
    <path d="M18 48V18h30M402 18h30v30M18 358v30h30M402 388h30v-30" stroke="#a8a69c"/>
    <g transform="rotate(-9 213 206)">
      <rect x="86" y="68" width="246" height="287" rx="17" fill="#cfcec5"/>
      <rect x="78" y="58" width="246" height="287" rx="17" fill="#eeece3" stroke="#34382f" stroke-width="1.7"/>
      <path d="M95 102h212" stroke="#cbc9be"/>
      <text x="98" y="86" fill="#4b5046" font-family="monospace" font-size="9" letter-spacing="2">FIND YOUR FREQUENCY</text>
      <circle cx="201" cy="207" r="80" fill="#dedfd4" stroke="#b0b3a6"/>
      ${ticks(201,207,72,41,145,250)}
      <path d="M146 246a66 66 0 1 1 109 0" stroke="#4f5b47" stroke-width="2"/>
      <circle cx="201" cy="207" r="44" fill="#f8f6ee" stroke="#a9ad9d"/>
      <path d="m201 207 31-62" stroke="#d65a36" stroke-width="3" stroke-linecap="round"/>
      <circle cx="201" cy="207" r="9" fill="#303a2e"/>
      <circle cx="201" cy="207" r="3" fill="#f3f2e8"/>
      <text x="201" y="266" text-anchor="middle" font-size="9" font-family="monospace" fill="#5a6154" letter-spacing="2">IN YOUR OWN TIME</text>
      <path d="M98 298h112" stroke="#b4b5a8"/>
      <circle cx="134" cy="298" r="7" fill="#303a2e"/>
      <circle cx="284" cy="299" r="17" fill="#dc6441" stroke="#a64e32"/>
      <path d="m281 293 8 6-8 6z" fill="#fff4df"/>
      <circle cx="94" cy="329" r="2" fill="#8c9082"/><circle cx="307" cy="329" r="2" fill="#8c9082"/>
    </g>
    <g transform="rotate(8 342 116)"><rect x="291" y="75" width="108" height="69" rx="7" fill="#dce6f0" stroke="#596d79" stroke-width="1.2"/><path d="M302 111h12l6-17 9 35 8-26 7 14 6-6h37" stroke="#486d85" stroke-width="1.7" stroke-linejoin="round"/><circle cx="382" cy="87" r="3" fill="#486d85"/></g>
    <g transform="rotate(7 318 317)"><rect x="273" y="289" width="127" height="61" rx="3" fill="#e7b957"/><text x="288" y="315" font-family="monospace" font-size="10" fill="#574320">A LITTLE LESS</text><text x="288" y="331" font-family="monospace" font-size="10" fill="#574320">ON YOUR MIND.</text></g>
    <path d="m48 130 14 4m-10-20 11 10m-3-28 6 14M378 217l6 19m-13-9 20-2" stroke="#6e775d" stroke-width="1.4" stroke-linecap="round"/>
    <text x="37" y="376" fill="#888c7f" font-family="monospace" font-size="8" letter-spacing="2">HNS — EVERYDAY INSTRUMENTS</text>
  `, '0 0 450 410'),
  metronome: svg(`
    <path d="M28 143h298" stroke="#b5baaa"/>
    <path d="m129 142 34-114h35l35 114z" fill="#e5e8dc" stroke="#59634d" stroke-width="1.5"/>
    <path d="m158 125 16-81h13l17 81" stroke="#b0b7a0"/>
    <path d="M180 135 215 38" stroke="#444e3a" stroke-width="3" stroke-linecap="round"/>
    <path d="m195 80 16 6" stroke="#d96c45" stroke-width="11"/>
    <circle cx="180" cy="133" r="6" fill="#454f3c"/>
    <path d="M106 71a82 82 0 0 1 148 0" stroke="#89947a" stroke-dasharray="2 5"/>
    <text x="41" y="103" font-size="35" font-family="monospace" fill="#4b5740" letter-spacing="-2">120</text>
    <text x="43" y="122" font-size="9" font-family="monospace" fill="#727c66" letter-spacing="2">BPM</text>
    <circle cx="273" cy="92" r="4" fill="#d76b43"/><circle cx="289" cy="92" r="4" fill="#c0c8b5"/><circle cx="305" cy="92" r="4" fill="#c0c8b5"/><circle cx="321" cy="92" r="4" fill="#c0c8b5"/>
  `),
  tuner: svg(`
    ${ticks(180,137,112,31,205,130)}
    <path d="M79 94a112 112 0 0 1 202 0" stroke="#7b9bb1" stroke-width="1.5"/>
    <path d="M167 27h26" stroke="#4c7c85" stroke-width="4"/>
    <path d="M180 87V36" stroke="#447783" stroke-width="2"/>
    <text x="180" y="121" text-anchor="middle" font-size="52" font-family="sans-serif" fill="#395b70">A<tspan font-size="20">4</tspan></text>
    <text x="180" y="145" text-anchor="middle" font-size="10" font-family="monospace" fill="#5b7b90" letter-spacing="2">440.00 Hz</text>
    <text x="66" y="112" font-size="17" fill="#5b7b90">♭</text><text x="284" y="112" font-size="17" fill="#5b7b90">♯</text>
  `),
  timer: svg(`
    <circle cx="180" cy="89" r="65" stroke="#dbc7b2" stroke-width="9"/>
    <circle cx="180" cy="89" r="65" stroke="#b8754d" stroke-width="9" stroke-dasharray="306 409" transform="rotate(-90 180 89)"/>
    ${ticks(180,89,52,60)}
    <text x="180" y="98" text-anchor="middle" font-size="29" font-family="monospace" fill="#8a593c" letter-spacing="-1">05:00</text>
    <text x="180" y="116" text-anchor="middle" font-size="8" font-family="monospace" fill="#9a7458" letter-spacing="2">MAKE A LITTLE SPACE</text>
  `),
  'tap-tempo': svg(`
    <circle cx="180" cy="89" r="73" stroke="#cabbd3" stroke-dasharray="2 5"/>
    <circle cx="180" cy="89" r="57" stroke="#b59ac2"/>
    <circle cx="180" cy="89" r="41" fill="#d5c2df" stroke="#9c7aad"/>
    <path d="M166 96V82a4 4 0 0 1 8 0v9-25a4 4 0 0 1 8 0v23-15a4 4 0 0 1 8 0v17-8a4 4 0 0 1 8 0v17c0 14-23 24-30 8l-9-13c-3-5 3-8 6-4l9 10" stroke="#70557f" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M83 89h13m168 0h13m-26-44 9-9M109 45l-9-9" stroke="#aa8abc" stroke-width="1.5"/>
  `),
  hexic: svg(`
    ${hex(180,89,29,'#eed5a4')}${hex(128,89,29,'#bccdb6')}${hex(232,89,29,'#b9cedf')}
    ${hex(154,44,29,'#c6b9d7')}${hex(206,44,29,'#e2aa90')}
    ${hex(154,134,29,'#b9cedf')}${hex(206,134,29,'#c6b9d7')}
    <path d="m168 88 8 8 15-17" stroke="#8d7448" stroke-width="1.5" stroke-linecap="round"/>
  `),
};
