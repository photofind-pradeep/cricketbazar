// src/hooks/useLiveScore.js
// Uses ONLY Netlify proxy — no direct browser API calls
// Fixes CORS issue with cricbuzz-live

import { useState, useEffect, useCallback, useRef } from 'react'

// All calls go through Netlify function → no CORS issues
const PROXY = '/.netlify/functions/cricket'
const REFRESH = 30000

// ─── DREAM11 T20 FANTASY SCORING ─────────────────────────────
const T20 = {
  run:1, four:2, six:3, fifty:10, century:20, duck:-5,
  sr_gt_170:6, sr_150_170:4, sr_130_150:2,
  sr_60_70:-2, sr_50_60:-4, sr_lt_50:-6,
  wicket:25, haul3:4, haul4:8, haul5:16, maiden:8,
  eco_lt5:6, eco_5_6:4, eco_6_7:2,
  eco_10_11:-2, eco_11_12:-4, eco_gt12:-6,
  catch:8, catch3bonus:4, stumping:12, runout:12,
  playing11:4, captain:2.0, vc:1.5,
}

export const calcPlayerPts = (p={}, isCap=false, isVC=false) => {
  let pts = T20.playing11
  const runs  = parseInt(p.r  ?? p.runs  ?? 0)
  const balls = parseInt(p.b  ?? p.balls ?? 0)
  const fours = parseInt(p['4s'] ?? p.fours ?? 0)
  const sixes = parseInt(p['6s'] ?? p.sixes ?? 0)
  const isOut = p.dismissal
    ? !String(p.dismissal).toLowerCase().includes('not out')
    : Boolean(p.out)

  pts += runs * T20.run
  pts += fours * T20.four
  pts += sixes * T20.six
  if      (runs >= 100) pts += T20.century
  else if (runs >= 50)  pts += T20.fifty
  if (isOut && runs === 0 && balls > 0) pts += T20.duck
  if (balls >= 10) {
    const sr = (runs/balls)*100
    if      (sr > 170) pts += T20.sr_gt_170
    else if (sr > 150) pts += T20.sr_150_170
    else if (sr > 130) pts += T20.sr_130_150
    else if (sr <  50) pts += T20.sr_lt_50
    else if (sr <  60) pts += T20.sr_50_60
    else if (sr <  70) pts += T20.sr_60_70
  }

  const wkts  = parseInt(p.w  ?? p.wickets ?? 0)
  const overs = parseFloat(p.o ?? p.overs  ?? 0)
  const rc    = parseInt(p.r_c ?? p.runs_conceded ?? 0)
  const maidn = parseInt(p.m  ?? p.maidens ?? 0)
  if (overs > 0) {
    pts += wkts * T20.wicket
    if      (wkts >= 5) pts += T20.haul5
    else if (wkts >= 4) pts += T20.haul4
    else if (wkts >= 3) pts += T20.haul3
    pts += maidn * T20.maiden
    if (overs >= 2) {
      const eco = rc/overs
      if      (eco < 5)  pts += T20.eco_lt5
      else if (eco < 6)  pts += T20.eco_5_6
      else if (eco < 7)  pts += T20.eco_6_7
      else if (eco < 11) pts += T20.eco_10_11
      else if (eco < 12) pts += T20.eco_11_12
      else               pts += T20.eco_gt12
    }
  }

  const catches = parseInt(p.catches ?? 0)
  pts += catches * T20.catch
  pts += parseInt(p.stumpings ?? 0) * T20.stumping
  pts += parseInt(p.runouts   ?? 0) * T20.runout
  if (catches >= 3) pts += T20.catch3bonus

  if      (isCap) pts = Math.round(pts * T20.captain)
  else if (isVC)  pts = Math.round(pts * T20.vc)
  else            pts = Math.round(pts)
  return pts
}

export const calcTeamPts = (scorecard, teamConfig) => {
  if (!scorecard || !teamConfig?.players?.length) return { total:0, breakdown:[] }
  const allBat  = [...(scorecard.bat1||[]), ...(scorecard.bat2||[])]
  const allBowl = [...(scorecard.bowl1||[]), ...(scorecard.bowl2||[])]
  const breakdown = []
  teamConfig.players.forEach(({id,name}) => {
    if (!name) return
    const last  = name.split(' ').pop().toLowerCase()
    const bat   = allBat.find(b  => (b.name||'').toLowerCase().includes(last))
    const bowl  = allBowl.find(b => (b.name||'').toLowerCase().includes(last))
    const isCap = teamConfig.captainId === id
    const isVC  = teamConfig.vcId      === id
    const merged = {...(bat||{}), ...(bowl||{})}
    const pts = Object.keys(merged).length > 0
      ? calcPlayerPts(merged, isCap, isVC)
      : Math.round(T20.playing11 * (isCap?T20.captain:isVC?T20.vc:1))
    breakdown.push({id, name, pts, isCap, isVC, bat, bowl})
  })
  return { total: Math.round(breakdown.reduce((s,p)=>s+p.pts,0)), breakdown }
}

// ─── NORMALIZERS ──────────────────────────────────────────────
const normalizeMatch = (m) => ({
  id:     m.id,
  title:  m.name || m.title || '',
  status: m.status || '',
  isLive: Boolean(m.matchStarted && !m.matchEnded),
  venue:  m.venue || '',
  teams:  (m.teams||[]).map((team,i)=>({
    team,
    run: m.score?.[i] ? `${m.score[i].r}/${m.score[i].w} (${m.score[i].o} ov)` : null,
  })),
  score: m.score || [],
})

const parseBat = (inning) =>
  (inning?.batting||[]).map(b=>({
    name:      b.batsman?.name || b.name || '',
    r:         parseInt(b.r  ?? b.runs  ?? 0),
    b:         parseInt(b.b  ?? b.balls ?? 0),
    '4s':      parseInt(b['4s'] ?? b.fours ?? 0),
    '6s':      parseInt(b['6s'] ?? b.sixes ?? 0),
    sr:        parseFloat(b.sr ?? 0),
    dismissal: b.dismissal || (b.out ? 'out' : 'not out'),
  }))

const parseBowl = (inning) =>
  (inning?.bowling||[]).map(b=>({
    name: b.bowler?.name || b.name || '',
    o:    parseFloat(b.o  ?? b.overs   ?? 0),
    r_c:  parseInt(b.r    ?? b.runs    ?? 0),
    w:    parseInt(b.w    ?? b.wickets ?? 0),
    m:    parseInt(b.m    ?? b.maidens ?? 0),
    eco:  parseFloat(b.eco ?? b.economy ?? 0),
  }))

const normalizeScorecard = (data) => {
  if (!data) return null
  const innings = Array.isArray(data.scorecard)
    ? data.scorecard
    : data.scorecard ? [data.scorecard] : []
  return {
    bat1:   parseBat(innings[0]),
    bowl1:  parseBowl(innings[0]),
    bat2:   parseBat(innings[1]  || {}),
    bowl2:  parseBowl(innings[1] || {}),
    inn1:   innings[0]?.inning || 'Inning 1',
    inn2:   innings[1]?.inning || 'Inning 2',
    hasTwo: innings.length > 1,
    raw:    data,
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════
export function useLiveScore() {
  const [matches, setMatches]           = useState([])
  const [selMatch, setSelMatch]         = useState(null)
  const [scorecard, setScorecard]       = useState(null)
  const [activeInning, setActiveInning] = useState(0)
  const [matchTab, setMatchTab]         = useState('live')
  const [loading, setLoading]           = useState(false)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [error, setError]               = useState(null)
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [autoRefresh, setAutoRefresh]   = useState(true)
  const ivRef = useRef(null)

  // ── FETCH MATCHES via Netlify proxy ───────────────────────
  const fetchMatches = useCallback(async (tab=matchTab) => {
    setLoading(true); setError(null)
    try {
      const endpoint = tab==='live' ? 'currentMatches' : 'matches'
      const res  = await fetch(`${PROXY}?endpoint=${endpoint}&offset=0`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.status==='failure') throw new Error(json.reason)

      let data = json.data || []
      if (tab==='live')     data = data.filter(m=>m.matchStarted&&!m.matchEnded)
      if (tab==='recent')   data = data.filter(m=>m.matchEnded)
      if (tab==='upcoming') data = data.filter(m=>!m.matchStarted)

      setMatches(data.map(normalizeMatch))
      setLastUpdated(new Date())
    } catch(e) {
      console.error('[CB] fetchMatches error:', e.message)
      setError('Live scores temporarily unavailable')
      setMatches([])
    } finally { setLoading(false) }
  }, [matchTab])

  // ── FETCH SCORECARD via Netlify proxy ─────────────────────
  const fetchScorecard = useCallback(async (matchId) => {
    if (!matchId) return
    setScoreLoading(true)
    try {
      const res  = await fetch(`${PROXY}?endpoint=match_scorecard&id=${matchId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.status==='failure') throw new Error(json.reason)
      setScorecard(normalizeScorecard(json.data))
    } catch(e) {
      console.error('[CB] fetchScorecard error:', e.message)
      setScorecard(null)
    } finally { setScoreLoading(false) }
  }, [])

  const openMatch  = (m) => { setSelMatch(m); setScorecard(null); setActiveInning(0); fetchScorecard(m.id) }
  const closeMatch = () => { setSelMatch(null); setScorecard(null) }
  const refresh    = () => selMatch ? fetchScorecard(selMatch.id) : fetchMatches(matchTab)

  useEffect(() => {
    fetchMatches(matchTab)
    clearInterval(ivRef.current)
    if (autoRefresh) {
      ivRef.current = setInterval(() => {
        if (selMatch) fetchScorecard(selMatch.id)
        else if (matchTab==='live') fetchMatches('live')
      }, REFRESH)
    }
    return () => clearInterval(ivRef.current)
  }, [matchTab, autoRefresh])

  useEffect(() => {
    if (selMatch?.id) fetchScorecard(selMatch.id)
  }, [selMatch?.id])

  return {
    matches, matchTab, setMatchTab,
    loading, error,
    selMatch, scorecard,
    activeInning, setActiveInning,
    scoreLoading,
    openMatch, closeMatch, refresh,
    autoRefresh, setAutoRefresh,
    lastUpdated,
    calcPlayerPts, calcTeamPts,
  }
}
