// src/App.jsx
// CricketBazar — Full Production App
// Stack: React + Supabase + ekamid/cricbuzz-live + Razorpay

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './hooks/useAuth'
import { useLiveScore } from './hooks/useLiveScore'
import {
  saveTeam, getUserTeams, joinContest as joinContestDB,
  deductEntryFee, getTransactions, addMoney as addMoneyDB,
  requestWithdrawal, getLeaderboard, getAllUsers,
  distributePrizes as distributePrizesDB, getWithdrawals,
  approveWithdrawal, updateUserName,
} from './lib/supabase'
import {
  IPL_TEAMS, IPL_PLAYERS, CONTESTS, SCORING,
  buildPrizeTable, WIN_RATIO, PLATFORM_FEE,
} from './lib/constants'

// ─── THEME ──────────────────────────────────────────────────────
const C = {
  bg:'#04060e', surface:'#090f1d', card:'#0c1425',
  border:'#172030', red:'#e8191b', gold:'#fbbf24',
  green:'#22c55e', blue:'#38bdf8', orange:'#f97316',
  purple:'#a78bfa', teal:'#14b8a6', text:'#e2e8f0', muted:'#5a6a8a',
}

// ─── HELPERS ────────────────────────────────────────────────────
const Toast = ({ msg, color }) => (
  <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)',
    background:color, color:'#fff', padding:'11px 24px', borderRadius:26,
    fontWeight:700, fontSize:14, zIndex:9999, whiteSpace:'nowrap',
    boxShadow:'0 6px 28px rgba(0,0,0,.6)', animation:'fadeUp .2s ease' }}>
    {msg}
  </div>
)

const Spinner = ({ label='Loading...' }) => (
  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:40, gap:12 }}>
    <div style={{ width:36, height:36, borderRadius:'50%',
      border:`3px solid ${C.border}`, borderTopColor:C.green,
      animation:'spin .7s linear infinite' }}/>
    <div style={{ color:C.muted, fontSize:13 }}>{label}</div>
  </div>
)

const Btn = ({ children, onClick, color=C.red, disabled=false, sm=false, outline=false }) => (
  <button onClick={onClick} disabled={disabled} style={{
    background: outline ? 'transparent' : disabled ? C.muted : `linear-gradient(135deg,${color},${color}bb)`,
    color: outline ? color : '#fff',
    border: outline ? `2px solid ${color}` : 'none',
    borderRadius: sm ? 9 : 12,
    padding: sm ? '8px 16px' : '13px 20px',
    fontWeight:800, fontSize: sm ? 12 : 15,
    cursor: disabled ? 'not-allowed' : 'pointer',
    width:'100%',
    boxShadow: disabled || outline ? 'none' : `0 4px 18px ${color}44`,
    transition:'all .2s',
  }}>{children}</button>
)

const TeamBadge = ({ teamId, size=32 }) => {
  const t = IPL_TEAMS.find(x => x.id === teamId) || { color:'#333', emoji:'🏏' }
  return (
    <div style={{ width:size, height:size, borderRadius:'50%',
      background:`${t.color}30`, border:`2px solid ${t.color}60`,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*.42, flexShrink:0, boxShadow:`0 0 8px ${t.color}50` }}>
      {t.emoji}
    </div>
  )
}

const RolePill = ({ role }) => {
  const cols = { WK:C.purple, BAT:C.blue, AR:C.green, BOWL:C.orange }
  return (
    <span style={{ background:`${cols[role]||C.muted}20`, color:cols[role]||C.muted,
      fontSize:9, fontWeight:700, padding:'2px 6px', borderRadius:4,
      border:`1px solid ${cols[role]||C.muted}30` }}>{role}</span>
  )
}

const PrizeRow = ({ rank, amount, pct, entry, isWinner=true }) => {
  const profit = amount - entry
  const medals = ['🥇','🥈','🥉']
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'9px 12px',
      background: rank===1 ? '#0a2a0a' : isWinner ? C.surface : '#1a0a0a',
      borderRadius:9, marginBottom:5,
      border:`1px solid ${rank===1?'#2d6a3a':isWinner?C.border:'#4a1a1a'}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:28, height:28, borderRadius:'50%', fontSize:16,
          background:rank<=3?'transparent':'#1a2540',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontWeight:900, color:rank>3?'#fff':'unset' }}>
          {rank<=3 ? medals[rank-1] : rank}
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:700 }}>Rank #{rank}</div>
          <div style={{ fontSize:10, color:C.muted }}>{(pct*100).toFixed(1)}% of pool</div>
        </div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:15, fontWeight:900, color:rank===1?C.gold:C.green }}>₹{amount}</div>
        {isWinner && <div style={{ fontSize:10, color:profit>=0?C.green:'#f87171', fontWeight:700 }}>
          +₹{profit} profit
        </div>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
export default function App() {
  const { user, loading:authLoading, error:authError, login, verify, logout, refreshUser } = useAuth()
  const liveScore = useLiveScore()

  // ── Navigation ───────────────────────────────────────────────
  const [screen, setScreen]     = useState('login')   // login|otp|app|admin
  const [appTab, setAppTab]     = useState('home')
  const [adminTab, setAdminTab] = useState('overview')
  const [profileTab, setProfileTab] = useState('stats')

  // ── Toast ────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)
  const showToast = (msg, color=C.green) => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 2800)
  }

  // ── Login state ──────────────────────────────────────────────
  const [mobile, setMobile]   = useState('')
  const [otp, setOtp]         = useState(['','','','','',''])
  const [otpTimer, setOtpTimer] = useState(0)
  const [loginLoading, setLoginLoading] = useState(false)

  // ── Team builder ─────────────────────────────────────────────
  const [contestType, setContestType] = useState('classic')
  const [buildView, setBuildView]     = useState('preview')  // build|preview
  const [bPlayers, setBPlayers]       = useState([])
  const [capId, setCapId]             = useState(null)
  const [vcId, setVcId]               = useState(null)
  const [teamFilter, setTeamFilter]   = useState('ALL')
  const [myTeams, setMyTeams]         = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)

  // ── Wallet ───────────────────────────────────────────────────
  const [txns, setTxns]     = useState([])
  const [addAmt, setAddAmt] = useState('')
  const [upiId, setUpiId]   = useState('')
  const [payStep, setPayStep] = useState('amount')  // amount|qr|confirm

  // ── Admin ────────────────────────────────────────────────────
  const [adminUsers, setAdminUsers]         = useState([])
  const [adminWithdrawals, setAdminWithdrawals] = useState([])
  const [leaderboard, setLeaderboard]       = useState([])
  const [pools]  = useState({ classic:10*25, powerplay:10*50 })

  // ── Handle auth state ────────────────────────────────────────
  useEffect(() => {
    if (!authLoading) {
      if (user) { setScreen('app'); loadUserData() }
      else setScreen('login')
    }
  }, [user, authLoading])

  // OTP countdown
  useEffect(() => {
    if (!otpTimer) return
    const iv = setInterval(() => setOtpTimer(t => t-1), 1000)
    return () => clearInterval(iv)
  }, [otpTimer])

  const loadUserData = async () => {
    if (!user) return
    try {
      const [teams, transactions] = await Promise.all([
        getUserTeams(user.id),
        getTransactions(user.id),
      ])
      setMyTeams(teams)
      setTxns(transactions)
    } catch (e) {
      console.error('Load data error:', e)
    }
  }

  // ── AUTH ─────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (mobile.length !== 10) { showToast('Enter 10-digit number', C.red); return }
    setLoginLoading(true)
    const ok = await login(mobile)
    setLoginLoading(false)
    if (ok) { setScreen('otp'); setOtpTimer(30); showToast('OTP sent!', C.blue) }
    else showToast(authError || 'Failed to send OTP', C.red)
  }

  const handleOtpInput = (val, idx) => {
    const d = [...otp]; d[idx] = val.slice(-1); setOtp(d)
    if (val && idx < 5) document.getElementById(`otp${idx+1}`)?.focus()
    if (idx === 5 && val) setTimeout(() => handleVerify(d), 100)
  }

  const handleVerify = async (digits = otp) => {
    setLoginLoading(true)
    const ok = await verify(mobile, digits.join(''))
    setLoginLoading(false)
    if (!ok) showToast(authError || 'Wrong OTP', C.red)
  }

  // ── TEAM BUILDER ─────────────────────────────────────────────
  const contest   = CONTESTS[contestType]
  const ROLE_MAX  = contest.roles
  const MAX_PL    = contest.totalPlayers
  const CREDITS   = contest.credits
  const allowedRoles = Object.keys(ROLE_MAX)
  const usedCr    = bPlayers.reduce((s,id) => s+(IPL_PLAYERS.find(x=>x.id===id)?.cr||0), 0)
  const roleSel   = (role) => bPlayers.filter(id => IPL_PLAYERS.find(x=>x.id===id)?.role===role).length
  const filtPl    = IPL_PLAYERS.filter(p =>
    allowedRoles.includes(p.role) && (teamFilter==='ALL' || p.team===teamFilter)
  )

  const togglePlayer = (pid) => {
    const p = IPL_PLAYERS.find(x => x.id===pid); if (!p) return
    if (bPlayers.includes(pid)) {
      setBPlayers(prev => prev.filter(x => x!==pid))
      if (capId===pid) setCapId(null)
      if (vcId===pid) setVcId(null)
    } else {
      if (bPlayers.length >= MAX_PL) { showToast(`Max ${MAX_PL} players`, C.red); return }
      const [,max] = ROLE_MAX[p.role]||[0,0]
      if (roleSel(p.role) >= max) { showToast(`Max ${max} ${p.role}s`, C.red); return }
      if (usedCr+p.cr > CREDITS) { showToast('Not enough credits', C.red); return }
      setBPlayers(prev => [...prev, pid])
    }
  }

  const handleSaveTeam = async () => {
    if (bPlayers.length < MAX_PL) { showToast(`Pick ${MAX_PL-bPlayers.length} more`, C.red); return }
    if (contestType==='classic' && (!capId||!vcId)) { showToast('Set C & VC', C.red); return }

    const myContestTeams = myTeams.filter(t => t.contest_type===contestType)
    if (myContestTeams.length >= contest.maxTeams) {
      showToast(`Max ${contest.maxTeams} teams for this contest`, C.red); return
    }

    setTeamsLoading(true)
    try {
      const team = await saveTeam(user.id, {
        contestType,
        matchId: liveScore.selMatch?.id || 'MI-CSK-2025',
        players: bPlayers,
        captainId: capId,
        vcId: vcId,
      })
      setMyTeams(prev => [team, ...prev])
      setBuildView('preview')
      showToast('Team saved! 🎉')
    } catch (e) {
      showToast(e.message, C.red)
    } finally {
      setTeamsLoading(false)
    }
  }

  const handleJoinContest = async (team) => {
    if (!user) return
    const c = CONTESTS[team.contest_type]
    try {
      await joinContestDB(team.id, user.id, team.contest_type, c.entry)
      const newBal = await deductEntryFee(user.id, c.entry, c.name)
      setMyTeams(prev => prev.map(t => t.id===team.id ? {...t, joined:true} : t))
      await refreshUser()
      const txnList = await getTransactions(user.id)
      setTxns(txnList)
      showToast(`Joined ${c.name}! 🏆`)
    } catch (e) {
      showToast(e.message, C.red)
    }
  }

  // ── WALLET / PAYMENT ─────────────────────────────────────────
  // Razorpay integration
  const openRazorpay = (amount) => {
    if (!window.Razorpay) {
      showToast('Payment loading...', C.orange)
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => openRazorpay(amount)
      document.head.appendChild(script)
      return
    }
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY || 'rzp_test_your_key_here',
      amount: amount * 100,
      currency: 'INR',
      name: 'CricketBazar',
      description: 'Add Money to Wallet',
      image: '/icon-192.png',
      handler: async (response) => {
        try {
          await addMoneyDB(user.id, amount, response.razorpay_payment_id)
          await refreshUser()
          const txnList = await getTransactions(user.id)
          setTxns(txnList)
          setAddAmt('')
          setPayStep('amount')
          showToast(`₹${amount} added! 💰`)
        } catch (e) {
          showToast('Payment failed. Contact support.', C.red)
        }
      },
      prefill: { contact: `+91${user?.mobile}` },
      theme: { color: C.green },
      modal: { ondismiss: () => showToast('Payment cancelled', C.orange) },
    }
    new window.Razorpay(options).open()
  }

  // Demo payment (for testing without Razorpay)
  const confirmDemoPayment = async () => {
    const amount = parseInt(addAmt)
    if (!amount || amount < 10) { showToast('Min ₹10', C.red); return }
    try {
      await addMoneyDB(user.id, amount, `demo_${Date.now()}`)
      await refreshUser()
      const txnList = await getTransactions(user.id)
      setTxns(txnList)
      setAddAmt(''); setPayStep('amount')
      showToast(`₹${amount} added! 💰`)
    } catch (e) {
      showToast(e.message, C.red)
    }
  }

  const handleWithdraw = async () => {
    if (!upiId.includes('@')) { showToast('Enter valid UPI ID', C.red); return }
    const amt = user?.balance || 0
    if (amt < 100) { showToast('Min ₹100 to withdraw', C.red); return }
    try {
      await requestWithdrawal(user.id, amt, upiId)
      await refreshUser()
      const txnList = await getTransactions(user.id)
      setTxns(txnList)
      setUpiId('')
      showToast('Withdrawal requested! Admin will process in 24h 💸')
    } catch (e) {
      showToast(e.message, C.red)
    }
  }

  // ── ADMIN ────────────────────────────────────────────────────
  const loadAdminData = async () => {
    try {
      const [users, withdrawals] = await Promise.all([
        getAllUsers(),
        getWithdrawals(),
      ])
      setAdminUsers(users)
      setAdminWithdrawals(withdrawals)
    } catch (e) {
      showToast('Admin load error', C.red)
    }
  }

  useEffect(() => {
    if (screen === 'admin') loadAdminData()
  }, [screen])

  const handleDistribute = async (contestType) => {
    try {
      await distributePrizesDB('contest-id', 'match-id', contestType)
      showToast('Prizes distributed! 🏆', C.gold)
      loadAdminData()
    } catch (e) {
      showToast(e.message, C.red)
    }
  }

  // ── LOADING SCREEN ───────────────────────────────────────────
  if (authLoading) return (
    <div style={{ background:C.bg, minHeight:'100vh', display:'flex',
      alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:48 }}>🏏</div>
      <div style={{ fontSize:28, fontWeight:900, color:'#fff' }}>
        Cricket<span style={{ color:C.gold }}>Bazar</span>
      </div>
      <Spinner label="Loading your account..." />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ══════════════════════════════════════════════════════════════
  // ── LOGIN ────────────────────────────────────────────────────
  if (screen === 'login') return (
    <div style={{ fontFamily:"'Rajdhani','Segoe UI',sans-serif", background:C.bg,
      minHeight:'100vh', color:C.text, maxWidth:430, margin:'0 auto',
      display:'flex', flexDirection:'column' }}>
      {toast && <Toast {...toast}/>}

      <div style={{ background:`linear-gradient(160deg,#0a2a0a 0%,#04060e 60%)`,
        padding:'52px 24px 36px', textAlign:'center', position:'relative' }}>
        <div style={{ position:'absolute', top:16, right:16,
          background:`${C.green}20`, border:`1px solid ${C.green}40`,
          borderRadius:20, padding:'4px 12px', fontSize:11, color:C.green, fontWeight:700 }}>
          70% WIN 🏆
        </div>
        <div style={{ fontSize:56, marginBottom:8 }}>🏏</div>
        <div style={{ fontSize:32, fontWeight:900, letterSpacing:1 }}>
          Cricket<span style={{ color:C.gold }}>Bazar</span>
        </div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,.4)', letterSpacing:3, marginTop:4 }}>
          FANTASY CRICKET • WIN REAL MONEY
        </div>
      </div>

      <div style={{ flex:1, padding:'28px 20px' }}>
        {/* USP pills */}
        <div style={{ display:'flex', gap:8, marginBottom:24 }}>
          {[['🏆','70% Win'],['💰','85% Prize'],['🔍','Transparent']].map(([ic,l]) => (
            <div key={l} style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`,
              borderRadius:10, padding:'10px 6px', textAlign:'center' }}>
              <div style={{ fontSize:18 }}>{ic}</div>
              <div style={{ fontSize:10, color:C.green, fontWeight:700, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize:21, fontWeight:800, marginBottom:4 }}>Login / Register</div>
        <div style={{ fontSize:13, color:C.muted, marginBottom:18 }}>
          Enter your mobile number to get OTP
        </div>

        <div style={{ display:'flex', background:C.surface, border:`1px solid ${C.border}`,
          borderRadius:12, overflow:'hidden', marginBottom:14 }}>
          <div style={{ padding:'14px', fontSize:15, fontWeight:700, color:C.muted,
            borderRight:`1px solid ${C.border}`, background:C.card, whiteSpace:'nowrap' }}>
            🇮🇳 +91
          </div>
          <input value={mobile}
            onChange={e => setMobile(e.target.value.replace(/\D/g,'').slice(0,10))}
            placeholder="Mobile number" type="tel"
            style={{ flex:1, padding:'14px', background:'none', border:'none',
              color:'#fff', fontSize:18, fontWeight:700, outline:'none' }}/>
        </div>

        <Btn onClick={handleSendOtp} disabled={loginLoading} color={C.green}>
          {loginLoading ? 'Sending...' : 'Get OTP →'}
        </Btn>

        <button onClick={() => setScreen('admin')}
          style={{ width:'100%', marginTop:12, padding:11,
            border:`1px solid ${C.border}`, borderRadius:12,
            background:'none', color:C.muted, fontWeight:700,
            cursor:'pointer', fontSize:13 }}>
          ⚙️ Admin Panel
        </button>
      </div>

      <style>{`@keyframes fadeUp{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  )

  // ── OTP ──────────────────────────────────────────────────────
  if (screen === 'otp') return (
    <div style={{ fontFamily:"'Rajdhani','Segoe UI',sans-serif", background:C.bg,
      minHeight:'100vh', color:C.text, maxWidth:430, margin:'0 auto', padding:'32px 20px' }}>
      {toast && <Toast {...toast}/>}

      <button onClick={() => setScreen('login')}
        style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:9,
          padding:'7px 14px', color:C.muted, fontSize:13, cursor:'pointer', marginBottom:28 }}>
        ← Back
      </button>

      <div style={{ fontSize:44, marginBottom:10 }}>📱</div>
      <div style={{ fontSize:26, fontWeight:800, marginBottom:4 }}>Verify OTP</div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:28 }}>
        Sent to +91 {mobile} via SMS
      </div>

      <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:28 }}>
        {otp.map((d, i) => (
          <input key={i} id={`otp${i}`} value={d}
            onChange={e => handleOtpInput(e.target.value, i)}
            onKeyDown={e => { if(e.key==='Backspace'&&!d&&i>0) document.getElementById(`otp${i-1}`)?.focus() }}
            maxLength={1} type="tel"
            style={{ width:48, height:58, textAlign:'center', fontSize:26, fontWeight:900,
              background:C.surface, border:`2px solid ${d?C.green:C.border}`,
              borderRadius:12, color:'#fff', outline:'none' }}/>
        ))}
      </div>

      <Btn onClick={() => handleVerify()} disabled={loginLoading} color={C.green}>
        {loginLoading ? 'Verifying...' : 'Verify & Enter App ✓'}
      </Btn>

      <div style={{ textAlign:'center', marginTop:18, fontSize:13, color:C.muted }}>
        {otpTimer > 0
          ? `Resend OTP in ${otpTimer}s`
          : <span onClick={handleSendOtp} style={{ color:C.blue, cursor:'pointer', fontWeight:700 }}>
              Resend OTP
            </span>}
      </div>

      <style>{`@keyframes fadeUp{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  )

  // ── ADMIN PANEL ──────────────────────────────────────────────
  if (screen === 'admin') {
    const totalPool = pools.classic + pools.powerplay
    return (
      <div style={{ fontFamily:"'Rajdhani','Segoe UI',sans-serif", background:C.bg,
        minHeight:'100vh', color:C.text, maxWidth:430, margin:'0 auto', paddingBottom:72 }}>
        {toast && <Toast {...toast}/>}

        <div style={{ background:'linear-gradient(135deg,#0a1428,#0d1e3a)',
          padding:'14px 16px', display:'flex', justifyContent:'space-between',
          alignItems:'center', borderBottom:`1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:20, fontWeight:900 }}>⚙️ CricketBazar Admin</div>
            <div style={{ fontSize:10, color:C.muted, letterSpacing:2 }}>MANAGEMENT PANEL</div>
          </div>
          <button onClick={() => setScreen('login')}
            style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:9,
              padding:'6px 12px', color:C.muted, fontSize:12, cursor:'pointer' }}>
            ← Exit
          </button>
        </div>

        <div style={{ display:'flex', background:C.surface, borderBottom:`1px solid ${C.border}` }}>
          {[['overview','📊'],['users','👥'],['prizes','🏆'],['withdrawals','💸']].map(([k,ic]) => (
            <button key={k} onClick={() => setAdminTab(k)}
              style={{ flex:1, padding:'10px 0', border:'none', background:'none',
                color:adminTab===k?C.gold:C.muted, fontWeight:700, fontSize:11,
                cursor:'pointer', borderBottom:`2px solid ${adminTab===k?C.gold:'transparent'}`,
                textTransform:'capitalize' }}>
              {ic} {k}
            </button>
          ))}
        </div>

        <div style={{ padding:'12px 11px' }}>

          {adminTab==='overview' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                {[
                  {icon:'👥',label:'Total Users',    value:adminUsers.length,              color:C.blue},
                  {icon:'💰',label:'Total Pool',     value:`₹${totalPool}`,               color:C.gold},
                  {icon:'📈',label:'Platform 15%',   value:`₹${Math.floor(totalPool*.15)}`,color:C.green},
                  {icon:'🏆',label:'Prize Pool 85%', value:`₹${Math.floor(totalPool*.85)}`,color:C.orange},
                ].map(({icon,label,value,color}) => (
                  <div key={label} style={{ background:C.card, border:`1px solid ${C.border}`,
                    borderRadius:13, padding:14 }}>
                    <div style={{ fontSize:26 }}>{icon}</div>
                    <div style={{ fontSize:20, fontWeight:900, color, marginTop:4 }}>{value}</div>
                    <div style={{ fontSize:11, color:C.muted }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:C.card, border:`1px solid ${C.border}`,
                borderRadius:13, padding:14 }}>
                <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>
                  🔍 Transparency Summary
                </div>
                {[
                  ['Win Ratio','70% users win', C.green],
                  ['Platform Fee','15% only', C.muted],
                  ['Prize Pool','85% to users', C.gold],
                  ['Auto Update','Via Netlify + SW', C.blue],
                  ['Live Scores','ekamid/cricbuzz-live', C.teal],
                ].map(([l,v,c]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between',
                    padding:'8px 0', borderTop:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.muted }}>{l}</span>
                    <span style={{ fontWeight:700, color:c }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {adminTab==='users' && (
            <>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700,
                letterSpacing:1, marginBottom:10 }}>
                ALL USERS ({adminUsers.length})
              </div>
              {adminUsers.length===0
                ? <Spinner label="Loading users..."/>
                : adminUsers.map((u,i) => (
                  <div key={u.id} style={{ background:C.card,
                    border:`1px solid ${C.border}`, borderRadius:12,
                    padding:14, marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between',
                      alignItems:'center', marginBottom:8 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:15 }}>{u.name}</div>
                        <div style={{ fontSize:11, color:C.muted }}>📱 {u.mobile}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:900, color:C.green, fontSize:16 }}>
                          ₹{u.balance}
                        </div>
                        <div style={{ fontSize:10, color:C.muted }}>
                          Won: ₹{u.total_won||0}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                      {[['Contests',u.contests_joined||0],['Status',i<Math.floor(adminUsers.length*WIN_RATIO)?'🏆 Win':'❌ Lose'],['Rank',`#${i+1}`]].map(([l,v]) => (
                        <div key={l} style={{ background:C.surface, borderRadius:8,
                          padding:'6px 4px', textAlign:'center' }}>
                          <div style={{ fontWeight:700, fontSize:13 }}>{v}</div>
                          <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </>
          )}

          {adminTab==='prizes' && (
            <>
              {Object.values(CONTESTS).map(c => {
                const { prizes, winners, losers, net } = buildPrizeTable(adminUsers.length||10, pools[c.id])
                return (
                  <div key={c.id} style={{ background:C.card,
                    border:`1px solid ${c.color}30`, borderRadius:13,
                    padding:14, marginBottom:14 }}>
                    <div style={{ fontSize:16, fontWeight:900, marginBottom:12 }}>
                      {c.icon} {c.name}
                    </div>
                    <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                      <div style={{ flex:1, background:'#0a2a1a', borderRadius:9, padding:10, textAlign:'center', border:`1px solid #2d6a3a` }}>
                        <div style={{ fontSize:20, fontWeight:900, color:C.green }}>{winners}</div>
                        <div style={{ fontSize:10, color:C.muted }}>Win 🏆</div>
                      </div>
                      <div style={{ flex:1, background:'#2a0a0a', borderRadius:9, padding:10, textAlign:'center', border:`1px solid #6a2d2d` }}>
                        <div style={{ fontSize:20, fontWeight:900, color:'#f87171' }}>{losers}</div>
                        <div style={{ fontSize:10, color:C.muted }}>Lose ❌</div>
                      </div>
                      <div style={{ flex:1, background:'#1a1200', borderRadius:9, padding:10, textAlign:'center', border:`1px solid #6a4d00` }}>
                        <div style={{ fontSize:18, fontWeight:900, color:C.gold }}>₹{net}</div>
                        <div style={{ fontSize:10, color:C.muted }}>Pool</div>
                      </div>
                    </div>
                    {prizes.slice(0,5).map((p,i) => (
                      <PrizeRow key={i} rank={p.rank} amount={p.amount} pct={p.pct} entry={c.entry}/>
                    ))}
                    <div style={{ marginTop:10 }}>
                      <Btn onClick={() => handleDistribute(c.id)} color={C.green}>
                        🏆 Distribute Prizes
                      </Btn>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {adminTab==='withdrawals' && (
            <>
              <div style={{ fontSize:12, color:C.muted, fontWeight:700,
                letterSpacing:1, marginBottom:10 }}>
                WITHDRAWAL REQUESTS ({adminWithdrawals.length})
              </div>
              {adminWithdrawals.length===0
                ? <div style={{ textAlign:'center', padding:40, color:C.muted }}>
                    No pending withdrawals
                  </div>
                : adminWithdrawals.map(w => (
                  <div key={w.id} style={{ background:C.card,
                    border:`1px solid ${w.status==='pending'?C.gold:C.border}`,
                    borderRadius:12, padding:14, marginBottom:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between',
                      alignItems:'center', marginBottom:8 }}>
                      <div>
                        <div style={{ fontWeight:700 }}>{w.users?.name}</div>
                        <div style={{ fontSize:11, color:C.muted }}>{w.upi_id}</div>
                      </div>
                      <div style={{ fontWeight:900, fontSize:18, color:C.gold }}>
                        ₹{w.amount}
                      </div>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between',
                      alignItems:'center' }}>
                      <span style={{ fontSize:11, color:w.status==='pending'?C.gold:C.green,
                        fontWeight:700 }}>
                        {w.status==='pending' ? '⏳ Pending' : '✅ Paid'}
                      </span>
                      {w.status==='pending' && (
                        <button onClick={async () => {
                          await approveWithdrawal(w.id)
                          showToast('Marked as paid ✅')
                          loadAdminData()
                        }} style={{ background:C.green, border:'none', borderRadius:8,
                          padding:'6px 14px', color:'#fff', fontWeight:700,
                          cursor:'pointer', fontSize:12 }}>
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>

        <div style={{ position:'fixed', bottom:0, left:'50%',
          transform:'translateX(-50%)', width:'100%', maxWidth:430,
          background:C.bg, borderTop:`1px solid ${C.border}`, display:'flex' }}>
          {[['overview','📊'],['users','👥'],['prizes','🏆'],['withdrawals','💸']].map(([k,ic]) => (
            <button key={k} onClick={() => setAdminTab(k)}
              style={{ flex:1, padding:'9px 0 7px', border:'none', background:'none',
                color:adminTab===k?C.gold:C.muted, fontWeight:700, fontSize:10,
                cursor:'pointer', display:'flex', flexDirection:'column',
                alignItems:'center', gap:2 }}>
              <span style={{ fontSize:20 }}>{ic}</span>{k}
            </button>
          ))}
        </div>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  // ── MAIN APP ─────────────────────────────────────────────────
  const NAV = [
    { key:'home',    icon:'🏠', label:'Home' },
    { key:'teams',   icon:'👥', label:'Teams' },
    { key:'live',    icon:'📺', label:'Live' },
    { key:'wallet',  icon:'💳', label:'Wallet' },
    { key:'profile', icon:'👤', label:'Profile' },
  ]

  return (
    <div style={{ fontFamily:"'Rajdhani','Segoe UI',sans-serif", background:C.bg,
      minHeight:'100vh', color:C.text, maxWidth:430, margin:'0 auto', paddingBottom:72 }}>
      {toast && <Toast {...toast}/>}

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div style={{ background:'linear-gradient(135deg,#050e05,#0a1a0a)',
        padding:'12px 16px', display:'flex', justifyContent:'space-between',
        alignItems:'center', borderBottom:`1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize:22, fontWeight:900 }}>
            Cricket<span style={{ color:C.gold }}>Bazar</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:1 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:C.green }}/>
            <span style={{ fontSize:10, color:C.green, fontWeight:700 }}>70% USERS WIN</span>
          </div>
        </div>
        <div style={{ textAlign:'right', cursor:'pointer' }}
          onClick={() => setAppTab('wallet')}>
          <div style={{ fontSize:11, color:C.muted }}>Balance</div>
          <div style={{ fontSize:18, fontWeight:900, color:C.green }}>
            ₹{user?.balance?.toLocaleString() || 0}
          </div>
        </div>
      </div>

      {/* ── HOME ────────────────────────────────────────────── */}
      {appTab==='home' && (
        <div style={{ padding:'12px 11px' }}>
          {/* 70% WIN BANNER */}
          <div style={{ background:'linear-gradient(135deg,#0a2a0a,#0f3a0f)',
            border:`1px solid #2d6a2d`, borderRadius:14, padding:14, marginBottom:14 }}>
            <div style={{ fontSize:15, fontWeight:900, color:C.green, marginBottom:8 }}>
              🏆 70% Users Win Every Match!
            </div>
            <div style={{ display:'flex', gap:10 }}>
              {[['85%','To users'],['15%','Platform'],['70%','Win rate']].map(([v,l]) => (
                <div key={l} style={{ flex:1, background:`${C.green}10`,
                  borderRadius:9, padding:'8px 6px', textAlign:'center',
                  border:`1px solid ${C.green}20` }}>
                  <div style={{ fontSize:18, fontWeight:900, color:C.gold }}>{v}</div>
                  <div style={{ fontSize:10, color:C.muted }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* IPL Teams horizontal scroll */}
          <div style={{ fontSize:12, color:C.muted, fontWeight:700,
            letterSpacing:1, marginBottom:10 }}>IPL 2025 TEAMS</div>
          <div style={{ display:'flex', gap:12, overflowX:'auto',
            paddingBottom:10, marginBottom:14 }}>
            {IPL_TEAMS.map(t => (
              <div key={t.id} onClick={() => {
                setTeamFilter(t.id)
                setContestType('classic')
                setBuildView('build')
                setBPlayers([]); setCapId(null); setVcId(null)
                setAppTab('teams')
              }} style={{ flexShrink:0, display:'flex', flexDirection:'column',
                alignItems:'center', gap:5, cursor:'pointer' }}>
                <div style={{ width:52, height:52, borderRadius:14,
                  background:`${t.color}20`, border:`2px solid ${t.color}60`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:26, boxShadow:`0 4px 14px ${t.color}30` }}>
                  {t.emoji}
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:C.muted }}>{t.id}</div>
              </div>
            ))}
          </div>

          {/* Today's match */}
          <div style={{ background:'linear-gradient(135deg,#0a1e38,#0d1830)',
            border:`1px solid #1e3a60`, borderRadius:14, padding:14, marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ fontSize:11, color:C.gold, fontWeight:700 }}>🔴 TODAY • IPL 2025</span>
              <span style={{ fontSize:11, color:C.muted }}>7:30 PM</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-around',
              alignItems:'center', marginBottom:12 }}>
              {[IPL_TEAMS[0], IPL_TEAMS[1]].map(t => (
                <div key={t.id} style={{ textAlign:'center' }}>
                  <div style={{ width:50, height:50, borderRadius:14,
                    background:`${t.color}20`, border:`2px solid ${t.color}60`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:26, margin:'0 auto 6px' }}>
                    {t.emoji}
                  </div>
                  <div style={{ fontWeight:900, fontSize:14 }}>{t.id}</div>
                </div>
              ))}
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:22, fontWeight:900, color:C.muted }}>VS</div>
                <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>Wankhede</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => {
                setContestType('classic'); setTeamFilter('ALL')
                setBuildView('build'); setBPlayers([]); setCapId(null); setVcId(null)
                setAppTab('teams')
              }} style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none',
                background:`linear-gradient(135deg,${C.red},#8b0000)`,
                color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                🏏 Classic ₹25
              </button>
              <button onClick={() => {
                setContestType('powerplay'); setTeamFilter('ALL')
                setBuildView('build'); setBPlayers([]); setCapId(null); setVcId(null)
                setAppTab('teams')
              }} style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none',
                background:`linear-gradient(135deg,${C.orange},#7a3000)`,
                color:'#fff', fontWeight:800, fontSize:13, cursor:'pointer' }}>
                ⚡ Powerplay ₹50
              </button>
            </div>
          </div>

          {/* Contest cards with prize preview */}
          {Object.values(CONTESTS).map(c => {
            const { prizes, winners, losers } = buildPrizeTable(100, 100*c.entry)
            return (
              <div key={c.id} style={{ background:C.card,
                border:`1px solid ${c.color}25`, borderRadius:14,
                padding:14, marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:15, fontWeight:900 }}>{c.icon} {c.name}</div>
                  <div style={{ fontSize:12, color:C.muted }}>₹{c.entry}/team</div>
                </div>
                <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>{c.desc}</div>
                <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                  <div style={{ flex:1, background:'#0a2a1a', borderRadius:9,
                    padding:'7px 8px', textAlign:'center', border:`1px solid #2d6a3a` }}>
                    <div style={{ fontSize:16, fontWeight:900, color:C.green }}>{winners}%</div>
                    <div style={{ fontSize:10, color:C.muted }}>win 🏆</div>
                  </div>
                  <div style={{ flex:1, background:'#2a0a0a', borderRadius:9,
                    padding:'7px 8px', textAlign:'center', border:`1px solid #6a2d2d` }}>
                    <div style={{ fontSize:16, fontWeight:900, color:'#f87171' }}>{losers}%</div>
                    <div style={{ fontSize:10, color:C.muted }}>lose ❌</div>
                  </div>
                  <div style={{ flex:1, background:C.surface, borderRadius:9,
                    padding:'7px 8px', textAlign:'center', border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:14, fontWeight:900, color:C.gold }}>
                      ₹{prizes[0]?.amount}
                    </div>
                    <div style={{ fontSize:10, color:C.muted }}>1st</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TEAMS ───────────────────────────────────────────── */}
      {appTab==='teams' && (
        <div>
          {buildView==='build' && (
            <div>
              {/* Build header */}
              <div style={{ background:C.surface, padding:'10px 14px',
                borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', marginBottom:6 }}>
                  <button onClick={() => setBuildView('preview')}
                    style={{ background:'none', border:`1px solid ${C.border}`,
                      borderRadius:7, padding:'5px 10px', color:C.muted,
                      fontSize:12, cursor:'pointer' }}>← Back</button>
                  <div style={{ fontSize:13, fontWeight:700 }}>
                    {contest.icon} {contest.name}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700,
                    color:bPlayers.length===MAX_PL?C.green:C.gold }}>
                    {bPlayers.length}/{MAX_PL}
                  </div>
                </div>
                <div style={{ height:3, background:C.border, borderRadius:3 }}>
                  <div style={{ height:'100%', borderRadius:3,
                    width:`${(bPlayers.length/MAX_PL)*100}%`,
                    background:`linear-gradient(90deg,${contest.color},${C.gold})`,
                    transition:'width .3s' }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between',
                  marginTop:5, fontSize:11 }}>
                  <span style={{ color:C.muted }}>
                    Credits: <b style={{ color:(CREDITS-usedCr)<5?'#f87171':C.green }}>
                      {(CREDITS-usedCr).toFixed(1)}
                    </b>
                  </span>
                  {contestType==='classic' &&
                    <span style={{ color:C.muted }}>
                      C:{capId?'✅':'—'} VC:{vcId?'✅':'—'}
                    </span>}
                </div>
              </div>

              {/* Role counts */}
              <div style={{ display:'flex', gap:5, padding:'6px 10px',
                background:C.bg, borderBottom:`1px solid ${C.border}` }}>
                {allowedRoles.map(role => {
                  const [min,max] = ROLE_MAX[role]
                  const cnt = roleSel(role)
                  const cols = { WK:C.purple, BAT:C.blue, AR:C.green, BOWL:C.orange }
                  return (
                    <div key={role} style={{ flex:1, textAlign:'center',
                      background:C.surface, borderRadius:8, padding:'5px 0',
                      border:`1px solid ${cnt>=min?cols[role]:C.border}` }}>
                      <div style={{ fontSize:11, fontWeight:700, color:cols[role] }}>{role}</div>
                      <div style={{ fontSize:10, color:C.muted }}>{cnt}/{max}</div>
                    </div>
                  )
                })}
              </div>

              {/* Team filter */}
              <div style={{ display:'flex', gap:7, padding:'7px 10px',
                overflowX:'auto', background:C.bg }}>
                <button onClick={() => setTeamFilter('ALL')}
                  style={{ flexShrink:0, padding:'5px 12px', borderRadius:20,
                    border:'none', background:teamFilter==='ALL'?C.green:'#1a2540',
                    color:'#fff', fontWeight:700, fontSize:12, cursor:'pointer' }}>All</button>
                {IPL_TEAMS.map(t => (
                  <button key={t.id} onClick={() => setTeamFilter(t.id)}
                    style={{ flexShrink:0, padding:'5px 12px', borderRadius:20,
                      border:'none', background:teamFilter===t.id?t.color:'#1a2540',
                      color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer' }}>
                    {t.emoji} {t.id}
                  </button>
                ))}
              </div>

              {/* Player list */}
              <div style={{ padding:'0 8px', maxHeight:'52vh', overflowY:'auto' }}>
                {filtPl.map(player => {
                  const isSel = bPlayers.includes(player.id)
                  const isCap = capId===player.id
                  const isVc  = vcId===player.id
                  return (
                    <div key={player.id} style={{
                      background:isSel?'linear-gradient(135deg,#0f2d1a,#122018)':C.card,
                      border:`1px solid ${isSel?'#2d6a3a':C.border}`,
                      borderRadius:12, margin:'5px 0', padding:'10px 12px',
                      display:'flex', alignItems:'center', gap:10 }}>
                      <TeamBadge teamId={player.team} size={36}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14,
                          display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                          {player.name}
                          {isCap && <span style={{ background:C.gold, color:'#000',
                            fontSize:9, fontWeight:900, padding:'1px 5px',
                            borderRadius:4 }}>C</span>}
                          {isVc && <span style={{ background:C.purple, color:'#000',
                            fontSize:9, fontWeight:900, padding:'1px 5px',
                            borderRadius:4 }}>VC</span>}
                        </div>
                        <div style={{ display:'flex', gap:6, marginTop:2, alignItems:'center' }}>
                          <span style={{ fontSize:10, color:C.muted, fontWeight:700 }}>
                            {player.team}
                          </span>
                          <RolePill role={player.role}/>
                          <span style={{ fontSize:10, color:C.muted }}>⭐{player.pts}pts</span>
                        </div>
                      </div>
                      <div style={{ textAlign:'center', marginRight:4 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:C.gold }}>
                          {player.cr}cr
                        </div>
                        {isSel && contestType==='classic' && (
                          <div style={{ display:'flex', gap:3, marginTop:3 }}>
                            <button onClick={() => setCapId(capId===player.id?null:player.id)}
                              style={{ background:isCap?C.gold:'#1e2d4a',
                                color:isCap?'#000':C.muted, border:'none',
                                borderRadius:4, fontSize:10, fontWeight:900,
                                padding:'2px 4px', cursor:'pointer' }}>C</button>
                            <button onClick={() => setVcId(vcId===player.id?null:player.id)}
                              style={{ background:isVc?C.purple:'#1e2d4a',
                                color:isVc?'#000':C.muted, border:'none',
                                borderRadius:4, fontSize:10, fontWeight:900,
                                padding:'2px 4px', cursor:'pointer' }}>VC</button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => togglePlayer(player.id)}
                        style={{ width:32, height:32, borderRadius:'50%', border:'none',
                          background:isSel
                            ?`linear-gradient(135deg,${C.red},#8b0000)`
                            :`linear-gradient(135deg,${C.green},#15803d)`,
                          color:'#fff', fontSize:20, fontWeight:700, cursor:'pointer',
                          display:'flex', alignItems:'center',
                          justifyContent:'center', flexShrink:0 }}>
                        {isSel ? '−' : '+'}
                      </button>
                    </div>
                  )
                })}
              </div>

              <div style={{ padding:'10px 11px' }}>
                <Btn onClick={handleSaveTeam} disabled={teamsLoading}
                  color={contestType==='classic'?C.red:C.orange}>
                  {teamsLoading ? 'Saving...' : `Save Team (${bPlayers.length}/${MAX_PL})`}
                </Btn>
              </div>
            </div>
          )}

          {buildView==='preview' && (
            <div style={{ padding:'12px 11px' }}>
              <div style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', marginBottom:14 }}>
                <div style={{ fontSize:18, fontWeight:900 }}>My Teams</div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => {
                    setContestType('classic'); setTeamFilter('ALL')
                    setBuildView('build'); setBPlayers([]); setCapId(null); setVcId(null)
                  }} style={{ padding:'7px 12px', borderRadius:9, border:'none',
                    background:C.red, color:'#fff', fontWeight:700,
                    fontSize:12, cursor:'pointer' }}>+ Classic</button>
                  <button onClick={() => {
                    setContestType('powerplay'); setTeamFilter('ALL')
                    setBuildView('build'); setBPlayers([]); setCapId(null); setVcId(null)
                  }} style={{ padding:'7px 12px', borderRadius:9, border:'none',
                    background:C.orange, color:'#fff', fontWeight:700,
                    fontSize:12, cursor:'pointer' }}>+ Power</button>
                </div>
              </div>

              {teamsLoading ? <Spinner/>
              : myTeams.length===0
                ? <div style={{ textAlign:'center', padding:48, color:C.muted }}>
                    <div style={{ fontSize:40, marginBottom:10 }}>👥</div>
                    <div>No teams yet. Create one!</div>
                  </div>
                : myTeams.map((team, i) => {
                  const ps = (team.players||[]).map(id => IPL_PLAYERS.find(p=>p.id===id)).filter(Boolean)
                  const c  = CONTESTS[team.contest_type]
                  return (
                    <div key={team.id} style={{ background:C.card,
                      border:`1px solid ${team.joined?'#2d6a3a':C.border}`,
                      borderRadius:13, padding:14, marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between',
                        alignItems:'center', marginBottom:8 }}>
                        <div>
                          <div style={{ fontWeight:700, fontSize:15 }}>
                            {c?.icon} {c?.name} — Team {i+1}
                          </div>
                          <div style={{ fontSize:11, color:C.muted }}>
                            {ps.length} players • {team.total_pts||0} pts
                          </div>
                        </div>
                        {team.joined
                          ? <span style={{ color:C.green, fontSize:12, fontWeight:700 }}>✅ Joined</span>
                          : <span style={{ color:C.gold, fontSize:13, fontWeight:700 }}>₹{c?.entry}</span>}
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                        {ps.map(p => (
                          <div key={p.id} style={{ display:'flex', alignItems:'center',
                            gap:4, background:C.surface, borderRadius:8, padding:'3px 7px' }}>
                            <TeamBadge teamId={p.team} size={16}/>
                            <span style={{ fontSize:11, fontWeight:700 }}>
                              {p.name.split(' ')[0]}
                            </span>
                            {team.captain_id===p.id &&
                              <span style={{ fontSize:9, background:C.gold, color:'#000',
                                borderRadius:3, padding:'0 3px', fontWeight:900 }}>C</span>}
                            {team.vc_id===p.id &&
                              <span style={{ fontSize:9, background:C.purple, color:'#000',
                                borderRadius:3, padding:'0 3px', fontWeight:900 }}>VC</span>}
                          </div>
                        ))}
                      </div>
                      {!team.joined && (
                        <Btn onClick={() => handleJoinContest(team)}
                          color={c?.color||C.red} sm>
                          Join Contest — ₹{c?.entry}
                        </Btn>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ── LIVE SCORES ─────────────────────────────────────── */}
      {appTab==='live' && (
        <div style={{ padding:'10px 10px 0' }}>
          {/* Match type */}
          <div style={{ display:'flex', gap:7, padding:'8px 1px',
            overflowX:'auto', marginBottom:8 }}>
            {[['league','IPL 🏆'],['international','International 🌍'],
              ['domestic','Domestic 🇮🇳'],['women','Women 👩']].map(([k,l]) => (
              <button key={k} onClick={() => liveScore.setMatchType(k)}
                style={{ flexShrink:0, padding:'6px 13px', borderRadius:20,
                  border:'none', background:liveScore.matchType===k?C.green:'#1a2540',
                  color:'#fff', fontWeight:700, fontSize:11, cursor:'pointer' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Live/Recent/Upcoming tabs */}
          {!liveScore.selMatch && (
            <div style={{ display:'flex', background:C.card,
              borderBottom:`1px solid ${C.border}`, marginBottom:10 }}>
              {[['live','🔴 Live',C.red],['recent','🕒 Recent',C.muted],
                ['upcoming','📅 Upcoming',C.blue]].map(([k,l,col]) => (
                <button key={k} onClick={() => liveScore.setMatchTab(k)}
                  style={{ flex:1, padding:'10px 0', border:'none', background:'none',
                    color:liveScore.matchTab===k?col:C.muted, fontWeight:700,
                    fontSize:12, cursor:'pointer',
                    borderBottom:`2px solid ${liveScore.matchTab===k?col:'transparent'}` }}>
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Back button if match selected */}
          {liveScore.selMatch && (
            <button onClick={liveScore.closeMatch}
              style={{ background:'none', border:`1px solid ${C.border}`,
                borderRadius:9, padding:'7px 14px', color:C.muted,
                fontSize:13, cursor:'pointer', marginBottom:12 }}>
              ← All Matches
            </button>
          )}

          {/* Error */}
          {liveScore.error && (
            <div style={{ background:'#1f0a0a', border:`1px solid #7f1d1d`,
              borderRadius:11, padding:14, marginBottom:12 }}>
              <div style={{ color:'#fca5a5', fontSize:13, fontWeight:700, marginBottom:6 }}>
                ⚠️ {liveScore.error}
              </div>
              <button onClick={liveScore.refresh}
                style={{ background:C.red, border:'none', borderRadius:8,
                  padding:'7px 14px', color:'#fff', fontWeight:700,
                  fontSize:12, cursor:'pointer' }}>Retry</button>
            </div>
          )}

          {/* Match list */}
          {!liveScore.selMatch && (
            liveScore.loading
              ? <Spinner label="Fetching live matches..."/>
              : liveScore.matches.length===0
                ? <div style={{ textAlign:'center', padding:48, color:C.muted }}>
                    <div style={{ fontSize:36, marginBottom:10 }}>🏏</div>
                    <div>No {liveScore.matchTab} matches right now</div>
                  </div>
                : liveScore.matches.map((m,i) => (
                  <div key={m.id||i} onClick={() => liveScore.openMatch(m)}
                    style={{ background:C.card,
                      border:`1px solid ${liveScore.matchTab==='live'?'#22c55e25':C.border}`,
                      borderRadius:14, marginBottom:10, padding:'14px 15px',
                      cursor:'pointer', position:'relative', overflow:'hidden' }}>
                    {liveScore.matchTab==='live' &&
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:2,
                        background:`linear-gradient(90deg,${C.red},${C.gold},${C.green},${C.red})`,
                        backgroundSize:'300% 100%', animation:'shimmer 3s linear infinite' }}/>}
                    <div style={{ display:'flex', justifyContent:'space-between',
                      alignItems:'flex-start', marginBottom:8, gap:8 }}>
                      <div style={{ fontSize:14, fontWeight:700, flex:1, lineHeight:1.3 }}>
                        {m.title}
                      </div>
                      <span style={{ background:liveScore.matchTab==='live'?`${C.green}20`:`${C.muted}20`,
                        color:liveScore.matchTab==='live'?C.green:C.muted, fontSize:10,
                        fontWeight:700, padding:'2px 8px', borderRadius:20, flexShrink:0 }}>
                        {liveScore.matchTab==='live'?'🔴 LIVE':'✅ DONE'}
                      </span>
                    </div>
                    {m.teams?.map((t,ti) => (
                      <div key={ti} style={{ display:'flex', justifyContent:'space-between',
                        marginBottom:3 }}>
                        <span style={{ fontWeight:700, fontSize:13 }}>{t.team}</span>
                        <span style={{ fontWeight:800, fontSize:14,
                          color:t.run?C.gold:C.muted }}>{t.run||'—'}</span>
                      </div>
                    ))}
                    {m.overview && (
                      <div style={{ fontSize:12, color:C.green, fontWeight:600,
                        borderTop:`1px solid ${C.border}`, paddingTop:7, marginTop:6 }}>
                        {m.overview}
                      </div>
                    )}
                    <div style={{ fontSize:11, color:C.blue, fontWeight:600, marginTop:6 }}>
                      Tap for live scorecard →
                    </div>
                  </div>
                ))
          )}

          {/* Score detail */}
          {liveScore.selMatch && (
            liveScore.scoreLoading
              ? <Spinner label="Loading scorecard..."/>
              : liveScore.scoreData && (
                <div>
                  <div style={{ background:'linear-gradient(135deg,#061a0a,#0a2a10)',
                    border:`1px solid #1a4020`, borderRadius:14, padding:18, marginBottom:12 }}>
                    {liveScore.scoreData.liveScore && (
                      <div style={{ fontSize:34, fontWeight:900, color:C.gold, marginBottom:6 }}>
                        {liveScore.scoreData.liveScore}
                      </div>
                    )}
                    {liveScore.scoreData.update && (
                      <div style={{ fontSize:13, color:C.green, fontWeight:600 }}>
                        {liveScore.scoreData.update}
                      </div>
                    )}
                    {liveScore.scoreData.runRate && (
                      <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>
                        CRR: <b style={{ color:C.gold }}>{liveScore.scoreData.runRate}</b>
                      </div>
                    )}
                  </div>

                  {/* Batting */}
                  {liveScore.scoreData.batsmanOne && (
                    <div style={{ background:C.card, border:`1px solid ${C.border}`,
                      borderRadius:13, padding:14, marginBottom:12 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.muted,
                        letterSpacing:1, marginBottom:10 }}>🏏 BATTING</div>
                      {[
                        { n:liveScore.scoreData.batsmanOne, r:liveScore.scoreData.batsmanOneRun,
                          b:liveScore.scoreData.batsmanOneBall, sr:liveScore.scoreData.batsmanOneSR },
                        { n:liveScore.scoreData.batsmanTwo, r:liveScore.scoreData.batsmanTwoRun,
                          b:liveScore.scoreData.batsmanTwoBall, sr:liveScore.scoreData.batsmanTwoSR },
                      ].filter(x=>x.n).map((bat,i) => (
                        <div key={i} style={{ display:'grid',
                          gridTemplateColumns:'2fr 1fr 1fr 1fr',
                          padding:'9px 0', borderTop:`1px solid ${C.border}` }}>
                          <div style={{ fontWeight:700, color:C.green }}>{bat.n}</div>
                          <div style={{ textAlign:'right', fontWeight:900,
                            fontSize:16, color:C.gold }}>{bat.r||'—'}</div>
                          <div style={{ textAlign:'right', color:C.muted }}>
                            {bat.b?.replace(/[()]/g,'')||'—'}
                          </div>
                          <div style={{ textAlign:'right', fontSize:12,
                            color:parseFloat(bat.sr)>150?C.green:C.text }}>
                            {bat.sr||'—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bowling */}
                  {liveScore.scoreData.bowlerOne && (
                    <div style={{ background:C.card, border:`1px solid ${C.border}`,
                      borderRadius:13, padding:14 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.muted,
                        letterSpacing:1, marginBottom:10 }}>🎳 BOWLING</div>
                      {[
                        { n:liveScore.scoreData.bowlerOne, o:liveScore.scoreData.bowlerOneOver,
                          r:liveScore.scoreData.bowlerOneRun, w:liveScore.scoreData.bowlerOneWickets,
                          eco:liveScore.scoreData.bowlerOneEconomy },
                        { n:liveScore.scoreData.bowlerTwo, o:liveScore.scoreData.bowlerTwoOver,
                          r:liveScore.scoreData.bowlerTwoRun, w:liveScore.scoreData.bowlerTwoWicket,
                          eco:liveScore.scoreData.bowlerTwoEconomy },
                      ].filter(x=>x.n&&x.n!=='O').map((bowl,i) => (
                        <div key={i} style={{ display:'grid',
                          gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',
                          padding:'9px 0', borderTop:`1px solid ${C.border}` }}>
                          <div style={{ fontWeight:700 }}>{bowl.n}</div>
                          <div style={{ textAlign:'right', color:C.muted }}>{bowl.o||'—'}</div>
                          <div style={{ textAlign:'right', color:C.muted }}>{bowl.r||'—'}</div>
                          <div style={{ textAlign:'right', fontWeight:700,
                            color:parseInt(bowl.w)>0?C.red:C.text }}>{bowl.w||'0'}</div>
                          <div style={{ textAlign:'right', fontSize:12,
                            color:parseFloat(bowl.eco)<8?C.green:'#f87171' }}>
                            {bowl.eco||'—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
          )}
        </div>
      )}

      {/* ── WALLET ──────────────────────────────────────────── */}
      {appTab==='wallet' && (
        <div style={{ padding:'12px 11px' }}>
          <div style={{ background:'linear-gradient(135deg,#0a2a1a,#0f3a22)',
            border:`1px solid #2d6a3a`, borderRadius:16, padding:20,
            marginBottom:14, textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>WALLET BALANCE</div>
            <div style={{ fontSize:46, fontWeight:900, color:C.green }}>
              ₹{user?.balance?.toLocaleString()||0}
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
              Total won: ₹{user?.total_won?.toLocaleString()||0}
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:12 }}>
              <button onClick={() => setPayStep('amount')}
                style={{ flex:1, padding:'11px 0', borderRadius:11, border:'none',
                  background:`linear-gradient(135deg,${C.green},#15803d)`,
                  color:'#fff', fontWeight:800, cursor:'pointer', fontSize:14 }}>
                + Add Money
              </button>
              <button onClick={() => setPayStep('withdraw')}
                style={{ flex:1, padding:'11px 0', borderRadius:11,
                  border:`1px solid ${C.gold}`, background:'rgba(251,191,36,.08)',
                  color:C.gold, fontWeight:800, cursor:'pointer', fontSize:14 }}>
                Withdraw
              </button>
            </div>
          </div>

          {/* Add money flow */}
          {payStep==='amount' && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`,
              borderRadius:14, padding:16, marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>💳 Add Money</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                {[25,50,100,200,500,1000].map(a => (
                  <button key={a} onClick={() => setAddAmt(String(a))}
                    style={{ padding:'8px 14px', borderRadius:9,
                      border:`1px solid ${addAmt===String(a)?C.gold:C.border}`,
                      background:addAmt===String(a)?'rgba(251,191,36,.1)':'none',
                      color:addAmt===String(a)?C.gold:C.muted,
                      fontWeight:700, fontSize:13, cursor:'pointer' }}>₹{a}</button>
                ))}
              </div>
              <input value={addAmt}
                onChange={e => setAddAmt(e.target.value.replace(/\D/g,''))}
                placeholder="Custom amount"
                style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`,
                  borderRadius:10, padding:'12px 14px', color:'#fff', fontSize:16,
                  boxSizing:'border-box', marginBottom:12 }}/>
              <Btn onClick={() => {
                const amt = parseInt(addAmt)
                if (!amt || amt<10) { showToast('Min ₹10', C.red); return }
                // Use Razorpay in production, demo for testing:
                if (import.meta.env.VITE_RAZORPAY_KEY) openRazorpay(amt)
                else setPayStep('qr')
              }} color={C.green}>
                Pay ₹{addAmt||'0'} via UPI →
              </Btn>
            </div>
          )}

          {payStep==='qr' && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`,
              borderRadius:14, padding:20, marginBottom:12, textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>
                Scan & Pay ₹{addAmt}
              </div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:16 }}>
                GPay • PhonePe • Paytm • BHIM
              </div>
              <div style={{ background:'#fff', borderRadius:16, padding:16,
                display:'inline-block', marginBottom:14, boxShadow:'0 8px 32px rgba(0,0,0,.5)' }}>
                <div style={{ width:160, height:160, position:'relative',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {[[0,0],[0,112],[112,0]].map(([top,left],ci) => (
                    <div key={ci} style={{ position:'absolute', top, left,
                      width:48, height:48, border:'5px solid #000', borderRadius:4 }}>
                      <div style={{ position:'absolute', top:7, left:7,
                        width:18, height:18, background:'#000', borderRadius:2 }}/>
                    </div>
                  ))}
                  <div style={{ position:'absolute', inset:0, padding:14,
                    display:'grid', gridTemplateColumns:'repeat(8,1fr)',
                    gap:2, opacity:.65 }}>
                    {Array.from({length:64}).map((_,i) => (
                      <div key={i} style={{ background:
                        Math.sin(i*2.7+parseInt(addAmt||'1'))>0.08?'#000':'transparent',
                        borderRadius:1 }}/>
                    ))}
                  </div>
                  <div style={{ position:'relative', zIndex:2, background:'#fff',
                    borderRadius:8, padding:'4px 6px', fontSize:22 }}>🏏</div>
                </div>
              </div>
              <div style={{ background:C.surface, borderRadius:12, padding:12,
                marginBottom:14, textAlign:'left' }}>
                {[['UPI ID','cricketbazar@upi'],['Amount',`₹${addAmt}`],['Name','CricketBazar']].map(([l,v]) => (
                  <div key={l} style={{ display:'flex', justifyContent:'space-between',
                    padding:'6px 0', borderTop:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.muted }}>{l}</span>
                    <span style={{ fontWeight:700, fontSize:13,
                      color:l==='Amount'?C.gold:l==='UPI ID'?C.blue:C.text }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setPayStep('amount')}
                  style={{ flex:1, padding:12, borderRadius:10,
                    border:`1px solid ${C.border}`, background:'none',
                    color:C.muted, fontWeight:700, cursor:'pointer' }}>← Back</button>
                <Btn onClick={confirmDemoPayment} color={C.green}>
                  Confirm ₹{addAmt} Added ✓
                </Btn>
              </div>
            </div>
          )}

          {payStep==='withdraw' && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`,
              borderRadius:14, padding:16, marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>
                💸 Withdraw to UPI
              </div>
              <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>
                Available: <b style={{ color:C.green }}>₹{user?.balance||0}</b>
                {' '}• Min ₹100 • Processed in 24h
              </div>
              <input value={upiId} onChange={e => setUpiId(e.target.value)}
                placeholder="your@upi or phone@paytm"
                style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`,
                  borderRadius:10, padding:'12px 14px', color:'#fff', fontSize:14,
                  boxSizing:'border-box', marginBottom:12 }}/>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => setPayStep('amount')}
                  style={{ flex:1, padding:12, borderRadius:10,
                    border:`1px solid ${C.border}`, background:'none',
                    color:C.muted, fontWeight:700, cursor:'pointer' }}>← Back</button>
                <Btn onClick={handleWithdraw} color={C.gold}>
                  Withdraw ₹{user?.balance||0}
                </Btn>
              </div>
            </div>
          )}

          {/* Transactions */}
          {txns.length>0 && (
            <div style={{ background:C.card, border:`1px solid ${C.border}`,
              borderRadius:14, padding:14 }}>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>📋 Transactions</div>
              {txns.map((t,i) => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', gap:12,
                  padding:'10px 0', borderTop:i>0?`1px solid ${C.border}`:'none' }}>
                  <div style={{ width:36, height:36, borderRadius:'50%',
                    background:t.type==='credit'?'rgba(34,197,94,.12)':'rgba(232,25,27,.12)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                    {t.type==='credit' ? '💚' : '🔴'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{t.description}</div>
                    <div style={{ fontSize:11, color:C.muted }}>
                      {new Date(t.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div style={{ fontWeight:900, fontSize:14,
                    color:t.type==='credit'?C.green:'#f87171' }}>
                    {t.type==='credit'?'+':''}₹{Math.abs(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PROFILE ──────────────────────────────────────────── */}
      {appTab==='profile' && (
        <div style={{ padding:'12px 11px' }}>
          <div style={{ background:'linear-gradient(135deg,#0a1428,#0d1e38)',
            border:`1px solid #1e3a60`, borderRadius:16, padding:20,
            marginBottom:14, textAlign:'center' }}>
            <div style={{ width:62, height:62, borderRadius:'50%',
              background:`linear-gradient(135deg,${C.green},#15803d)`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:28, margin:'0 auto 10px' }}>🏏</div>
            <div style={{ fontSize:20, fontWeight:900 }}>{user?.name}</div>
            <div style={{ fontSize:12, color:C.muted }}>📱 +91 {user?.mobile}</div>
            <div style={{ display:'flex', justifyContent:'center', gap:24, marginTop:16 }}>
              {[
                ['🏆', user?.contests_joined||0, 'Contests'],
                ['💰', `₹${user?.total_won||0}`, 'Won'],
                ['👥', myTeams.length, 'Teams'],
              ].map(([ic,v,l]) => (
                <div key={l} style={{ textAlign:'center' }}>
                  <div style={{ fontSize:12 }}>{ic}</div>
                  <div style={{ fontSize:20, fontWeight:900,
                    color:l==='Won'?C.green:C.text }}>{v}</div>
                  <div style={{ fontSize:10, color:C.muted }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring system */}
          {Object.entries(SCORING).map(([cat, items]) => (
            <div key={cat} style={{ background:C.card, border:`1px solid ${C.border}`,
              borderRadius:14, padding:14, marginBottom:10 }}>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:10, textTransform:'capitalize' }}>
                {cat==='batting'?'🏏':cat==='bowling'?'🎳':cat==='fielding'?'🧤':'⭐'} {cat}
              </div>
              {items.map((s,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between',
                  padding:'8px 0', borderTop:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13 }}>{s.icon} {s.label}</span>
                  <span style={{ fontWeight:800, fontSize:13, color:s.color }}>
                    {typeof s.pts==='number'&&s.pts>0?'+':''}{s.pts}
                    {typeof s.pts==='number'?' pts':''}
                  </span>
                </div>
              ))}
            </div>
          ))}

          <button onClick={logout}
            style={{ width:'100%', padding:12,
              border:`1px solid #7f1d1d`, borderRadius:12,
              background:'rgba(232,25,27,.08)', color:'#f87171',
              fontWeight:700, cursor:'pointer', fontSize:14 }}>
            Logout
          </button>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position:'fixed', bottom:0, left:'50%',
        transform:'translateX(-50%)', width:'100%', maxWidth:430,
        background:'#04060e', borderTop:`1px solid ${C.border}`,
        display:'flex', zIndex:100 }}>
        {NAV.map(({key,icon,label}) => (
          <button key={key} onClick={() => setAppTab(key)}
            style={{ flex:1, padding:'9px 0 7px', border:'none', background:'none',
              color:appTab===key?C.green:C.muted, fontWeight:700, fontSize:9,
              cursor:'pointer', display:'flex', flexDirection:'column',
              alignItems:'center', gap:2, transition:'color .2s' }}>
            <span style={{ fontSize:20 }}>{icon}</span>
            <span style={{ lineHeight:1.1, textAlign:'center' }}>{label}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translate(-50%,-10px)} to{opacity:1;transform:translate(-50%,0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>
    </div>
  )
}
