// src/lib/constants.js

// ─── PLATFORM CONFIG ─────────────────────────────────────────────
export const PLATFORM_FEE = 0.15  // 15% platform keeps
export const PRIZE_POOL   = 0.85  // 85% goes to users
export const WIN_RATIO    = 0.70  // 70% of users win

// ─── CONTEST CONFIG ──────────────────────────────────────────────
export const CONTESTS = {
  classic: {
    id: 'classic',
    name: 'Classic 11',
    icon: '🏏',
    color: '#e8191b',
    desc: 'Pick 11 players with Captain & Vice Captain',
    entry: 25,
    maxTeams: 4,
    maxParticipations: 2,
    totalPlayers: 11,
    credits: 100,
    roles: { WK: [1,2], BAT: [3,5], AR: [1,3], BOWL: [3,5] },
  },
  powerplay: {
    id: 'powerplay',
    name: 'Powerplay 5',
    icon: '⚡',
    color: '#f97316',
    desc: '5 players only: 2 BAT + 2 BOWL + 1 AR',
    entry: 50,
    maxTeams: 1,
    maxParticipations: 2,
    totalPlayers: 5,
    credits: 50,
    roles: { BAT: [2,2], AR: [1,1], BOWL: [2,2] },
  },
}

// ─── PRIZE ENGINE ─────────────────────────────────────────────────
// Always pays 70% of players. Top heavy but every winner profits.
export const buildPrizeTable = (totalUsers, totalPool) => {
  const net     = Math.floor(totalPool * PRIZE_POOL)
  const winners = Math.max(1, Math.floor(totalUsers * WIN_RATIO))
  const losers  = totalUsers - winners

  const rawW = Array.from({ length: winners }, (_, i) => {
    const pos = i / Math.max(winners - 1, 1)
    return Math.pow(1 - pos, 1.8) + 0.15
  })
  const totalW = rawW.reduce((s, w) => s + w, 0)

  const prizes = rawW.map((w, i) => ({
    rank: i + 1,
    pct: w / totalW,
    amount: Math.floor((w / totalW) * net),
  }))

  // Fix rounding: give remainder to 1st place
  const distrib = prizes.reduce((s, p) => s + p.amount, 0)
  if (prizes.length > 0) prizes[0].amount += net - distrib

  return {
    prizes,
    winners,
    losers,
    net,
    platform: Math.floor(totalPool * PLATFORM_FEE),
  }
}

// ─── IPL TEAMS ───────────────────────────────────────────────────
export const IPL_TEAMS = [
  { id:'MI',   name:'Mumbai Indians',         color:'#004B8D', bg:'#001a3a', emoji:'🔵' },
  { id:'CSK',  name:'Chennai Super Kings',    color:'#F9CD1B', bg:'#1a1400', emoji:'🟡' },
  { id:'RCB',  name:'Royal Challengers',      color:'#D4182A', bg:'#1a0000', emoji:'🔴' },
  { id:'KKR',  name:'Kolkata Knight Riders',  color:'#3A225D', bg:'#12001a', emoji:'🟣' },
  { id:'DC',   name:'Delhi Capitals',         color:'#0057E2', bg:'#00102b', emoji:'💙' },
  { id:'RR',   name:'Rajasthan Royals',       color:'#EA1A85', bg:'#1a0010', emoji:'🩷' },
  { id:'GT',   name:'Gujarat Titans',         color:'#1C4F7C', bg:'#001020', emoji:'⚡' },
  { id:'LSG',  name:'Lucknow Super Giants',   color:'#A72B5B', bg:'#1a0015', emoji:'🩵' },
  { id:'PBKS', name:'Punjab Kings',           color:'#ED1B24', bg:'#1a0000', emoji:'❤️' },
  { id:'SRH',  name:'Sunrisers Hyderabad',    color:'#FF6600', bg:'#1a0800', emoji:'🟠' },
]

// ─── IPL PLAYERS ─────────────────────────────────────────────────
export const IPL_PLAYERS = [
  // MI
  { id:1,  name:'Rohit Sharma',       team:'MI',   role:'BAT',  cr:10.5, pts:105, img:'🏏' },
  { id:2,  name:'Jasprit Bumrah',     team:'MI',   role:'BOWL', cr:10.5, pts:108, img:'🎳' },
  { id:3,  name:'Hardik Pandya',      team:'MI',   role:'AR',   cr:10.0, pts:102, img:'⚡' },
  { id:4,  name:'Ishan Kishan',       team:'MI',   role:'WK',   cr:9.0,  pts:88,  img:'🧤' },
  { id:5,  name:'Suryakumar Yadav',   team:'MI',   role:'BAT',  cr:10.0, pts:103, img:'🏏' },
  // CSK
  { id:6,  name:'MS Dhoni',           team:'CSK',  role:'WK',   cr:9.5,  pts:98,  img:'🧤' },
  { id:7,  name:'Ravindra Jadeja',    team:'CSK',  role:'AR',   cr:9.5,  pts:96,  img:'⚡' },
  { id:8,  name:'Ruturaj Gaikwad',    team:'CSK',  role:'BAT',  cr:9.5,  pts:95,  img:'🏏' },
  { id:9,  name:'Deepak Chahar',      team:'CSK',  role:'BOWL', cr:8.5,  pts:85,  img:'🎳' },
  { id:10, name:'Shivam Dube',        team:'CSK',  role:'AR',   cr:8.5,  pts:82,  img:'⚡' },
  // RCB
  { id:11, name:'Virat Kohli',        team:'RCB',  role:'BAT',  cr:11.0, pts:110, img:'🏏' },
  { id:12, name:'Faf du Plessis',     team:'RCB',  role:'BAT',  cr:9.0,  pts:88,  img:'🏏' },
  { id:13, name:'Glenn Maxwell',      team:'RCB',  role:'AR',   cr:9.5,  pts:92,  img:'⚡' },
  { id:14, name:'Mohammed Siraj',     team:'RCB',  role:'BOWL', cr:9.0,  pts:90,  img:'🎳' },
  // KKR
  { id:15, name:'Shreyas Iyer',       team:'KKR',  role:'BAT',  cr:9.5,  pts:94,  img:'🏏' },
  { id:16, name:'Andre Russell',      team:'KKR',  role:'AR',   cr:10.0, pts:100, img:'⚡' },
  { id:17, name:'Sunil Narine',       team:'KKR',  role:'AR',   cr:9.0,  pts:89,  img:'⚡' },
  { id:18, name:'Varun Chakravarthy', team:'KKR',  role:'BOWL', cr:8.5,  pts:86,  img:'🎳' },
  // DC
  { id:19, name:'David Warner',       team:'DC',   role:'BAT',  cr:9.0,  pts:88,  img:'🏏' },
  { id:20, name:'Axar Patel',         team:'DC',   role:'AR',   cr:8.5,  pts:85,  img:'⚡' },
  { id:21, name:'Anrich Nortje',      team:'DC',   role:'BOWL', cr:8.5,  pts:84,  img:'🎳' },
  // RR
  { id:22, name:'Sanju Samson',       team:'RR',   role:'WK',   cr:9.0,  pts:90,  img:'🧤' },
  { id:23, name:'Jos Buttler',        team:'RR',   role:'WK',   cr:10.0, pts:102, img:'🧤' },
  { id:24, name:'Yuzvendra Chahal',   team:'RR',   role:'BOWL', cr:9.0,  pts:90,  img:'🎳' },
  { id:25, name:'Trent Boult',        team:'RR',   role:'BOWL', cr:9.0,  pts:88,  img:'🎳' },
  // GT
  { id:26, name:'Shubman Gill',       team:'GT',   role:'BAT',  cr:10.0, pts:100, img:'🏏' },
  { id:27, name:'Rashid Khan',        team:'GT',   role:'AR',   cr:10.0, pts:102, img:'⚡' },
  { id:28, name:'Mohammed Shami',     team:'GT',   role:'BOWL', cr:9.0,  pts:92,  img:'🎳' },
  // LSG
  { id:29, name:'KL Rahul',           team:'LSG',  role:'WK',   cr:9.5,  pts:95,  img:'🧤' },
  { id:30, name:'Quinton de Kock',    team:'LSG',  role:'WK',   cr:9.0,  pts:88,  img:'🧤' },
  // SRH
  { id:31, name:'Heinrich Klaasen',   team:'SRH',  role:'WK',   cr:9.0,  pts:90,  img:'🧤' },
  { id:32, name:'Pat Cummins',        team:'SRH',  role:'AR',   cr:9.5,  pts:95,  img:'⚡' },
  { id:33, name:'Bhuvneshwar Kumar',  team:'SRH',  role:'BOWL', cr:8.5,  pts:84,  img:'🎳' },
  // PBKS
  { id:34, name:'Shikhar Dhawan',     team:'PBKS', role:'BAT',  cr:8.5,  pts:83,  img:'🏏' },
  { id:35, name:'Kagiso Rabada',      team:'PBKS', role:'BOWL', cr:9.0,  pts:89,  img:'🎳' },
]

// ─── SCORING SYSTEM ──────────────────────────────────────────────
export const SCORING = {
  batting: [
    { label:'Run scored',     pts:1,    color:'#e2e8f0', icon:'🏏' },
    { label:'Boundary (4)',   pts:2,    color:'#22c55e', icon:'4️⃣', bonus:true },
    { label:'Six (6)',        pts:3,    color:'#22c55e', icon:'6️⃣', bonus:true },
    { label:'Half Century',   pts:10,   color:'#fbbf24', icon:'🌟', bonus:true },
    { label:'Century',        pts:20,   color:'#fbbf24', icon:'💯', bonus:true },
    { label:'Duck',           pts:-5,   color:'#f87171', icon:'🦆' },
  ],
  bowling: [
    { label:'Wicket',         pts:25,   color:'#e2e8f0', icon:'🎳' },
    { label:'3-Wicket haul',  pts:15,   color:'#22c55e', icon:'🔥', bonus:true },
    { label:'5-Wicket haul',  pts:25,   color:'#fbbf24', icon:'⭐', bonus:true },
    { label:'Maiden over',    pts:12,   color:'#22c55e', icon:'🏆', bonus:true },
    { label:'Economy < 6',    pts:10,   color:'#14b8a6', icon:'📊', bonus:true },
    { label:'Economy > 10',   pts:-5,   color:'#f87171', icon:'📉' },
  ],
  fielding: [
    { label:'Catch',          pts:10,   color:'#e2e8f0', icon:'🤲' },
    { label:'Stumping',       pts:15,   color:'#38bdf8', icon:'🧤' },
    { label:'Run Out',        pts:12,   color:'#a78bfa', icon:'🎯' },
  ],
  multipliers: [
    { label:'Captain',        pts:'2×',  color:'#fbbf24', icon:'👑' },
    { label:'Vice Captain',   pts:'1.5×',color:'#a78bfa', icon:'⭐' },
  ],
}
