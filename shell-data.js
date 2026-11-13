/* Shell Topup — Free Fire product catalog (price in SHELLS, not rupees).
   Shared by shelltopup.html and the admin panel (sold-out toggles use these ids). */
const SHELL_PRODUCTS = [
  { id:'weekly-lite',       name:'Weekly Lite',        shells:18,  kind:'lite'    },
  { id:'weekly-membership', name:'Weekly Membership',  shells:86,  kind:'weekly'  },
  { id:'monthly-membership',name:'Monthly Membership', shells:430, kind:'monthly' },
  { id:'diamonds-25',       name:'25 Diamonds',        shells:13,  kind:'diamond' },
  { id:'diamonds-100',      name:'100 Diamonds',       shells:50,  kind:'diamond' },
  { id:'diamonds-310',      name:'310 Diamonds',       shells:152, kind:'diamond' },
  { id:'diamonds-520',      name:'520 Diamonds',       shells:254, kind:'diamond' },
  { id:'diamonds-1060',     name:'1060 Diamonds',      shells:500, kind:'diamond' },
  { id:'levelup-06',        name:'Level Up Pass - 06', shells:16,  kind:'levelup' },
  { id:'levelup-10',        name:'Level Up Pass - 10', shells:34,  kind:'levelup' },
  { id:'levelup-15',        name:'Level Up Pass - 15', shells:34,  kind:'levelup' },
  { id:'levelup-20',        name:'Level Up Pass - 20', shells:34,  kind:'levelup' },
  { id:'levelup-25',        name:'Level Up Pass - 25', shells:34,  kind:'levelup' },
  { id:'levelup-30',        name:'Level Up Pass - 30', shells:50,  kind:'levelup' },
];
async function fsGetShellSoldOut(){ return fsGetConfig('shellSoldOut', {}); }
async function fsSetShellSoldOut(map){ return fsSetConfig('shellSoldOut', map); }

/* Reusable shell logo (inline SVG so it needs no image file) */
function shellLogoSvg(size){
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M32 6C15 6 4 21 6 38c1.5 13 13 20 26 20s24.500-7 26-20C60 21 49 6 32 6z" fill="#FFE761" stroke="#F4B400" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 56V14M32 56L17 18M32 56L47 18M32 56L9 32M32 56L55 32" stroke="#F4B400" stroke-width="2.6" stroke-linecap="round" fill="none"/>
  </svg>`;
}
