// src/lib/supabase.js
// ─── Supabase client + all DB functions ───────────────────────────
// Setup: npm install @supabase/supabase-js
// Add to .env:
//   VITE_SUPABASE_URL=https://xxxxx.supabase.co
//   VITE_SUPABASE_KEY=your_anon_key

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'your-anon-key'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── AUTH ─────────────────────────────────────────────────────────

// Send OTP to mobile number (Supabase sends SMS automatically)
export const sendOTP = async (mobile) => {
  const { error } = await supabase.auth.signInWithOtp({
    phone: `+91${mobile}`,
  })
  if (error) throw error
  return true
}

// Verify OTP entered by user
export const verifyOTP = async (mobile, token) => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: `+91${mobile}`,
    token,
    type: 'sms',
  })
  if (error) throw error
  return data
}

// Get current logged-in session
export const getSession = async () => {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// Sign out
export const signOut = async () => {
  await supabase.auth.signOut()
}

// ─── USERS ────────────────────────────────────────────────────────

// Get user profile from DB
export const getUser = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// Create user profile after first login
export const createUser = async (userId, mobile) => {
  const name = `Player_${mobile.slice(-4)}`
  const { data, error } = await supabase
    .from('users')
    .upsert({ id: userId, mobile, name, balance: 0 })
    .select()
    .single()
  if (error) throw error
  return data
}

// Update user name
export const updateUserName = async (userId, name) => {
  const { data, error } = await supabase
    .from('users')
    .update({ name })
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── WALLET ───────────────────────────────────────────────────────

// Add money to wallet (called after Razorpay success)
export const addMoney = async (userId, amount, paymentId) => {
  // 1. Add to balance
  const { data: user } = await supabase
    .from('users')
    .select('balance')
    .eq('id', userId)
    .single()

  await supabase
    .from('users')
    .update({ balance: user.balance + amount })
    .eq('id', userId)

  // 2. Log transaction
  await supabase.from('transactions').insert({
    user_id: userId,
    type: 'credit',
    amount,
    description: 'Added via UPI',
    razorpay_payment_id: paymentId,
  })

  return user.balance + amount
}

// Deduct entry fee when joining contest
export const deductEntryFee = async (userId, amount, contestName) => {
  const { data: user } = await supabase
    .from('users')
    .select('balance')
    .eq('id', userId)
    .single()

  if (user.balance < amount) throw new Error('Insufficient balance')

  await supabase
    .from('users')
    .update({
      balance: user.balance - amount,
      contests_joined: supabase.rpc('increment', { x: 1 }),
    })
    .eq('id', userId)

  await supabase.from('transactions').insert({
    user_id: userId,
    type: 'debit',
    amount: -amount,
    description: `Joined ${contestName}`,
  })

  return user.balance - amount
}

// Credit prize money to winner
export const creditPrize = async (userId, amount, rank) => {
  const { data: user } = await supabase
    .from('users')
    .select('balance, total_won')
    .eq('id', userId)
    .single()

  await supabase
    .from('users')
    .update({
      balance: user.balance + amount,
      total_won: (user.total_won || 0) + amount,
    })
    .eq('id', userId)

  await supabase.from('transactions').insert({
    user_id: userId,
    type: 'credit',
    amount,
    description: `Prize — Rank #${rank} 🏆`,
  })
}

// Withdraw to UPI (admin approves manually or auto via Razorpay X)
export const requestWithdrawal = async (userId, amount, upiId) => {
  const { data: user } = await supabase
    .from('users')
    .select('balance')
    .eq('id', userId)
    .single()

  if (user.balance < amount) throw new Error('Insufficient balance')
  if (amount < 100) throw new Error('Minimum withdrawal ₹100')

  await supabase
    .from('users')
    .update({ balance: user.balance - amount })
    .eq('id', userId)

  await supabase.from('transactions').insert({
    user_id: userId,
    type: 'debit',
    amount: -amount,
    description: `Withdrawal to UPI: ${upiId}`,
    status: 'pending',
  })

  // Also create withdrawal request for admin
  await supabase.from('withdrawal_requests').insert({
    user_id: userId,
    amount,
    upi_id: upiId,
    status: 'pending',
  })
}

// Get user's transaction history
export const getTransactions = async (userId, limit = 20) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// ─── TEAMS ────────────────────────────────────────────────────────

// Save a new team
export const saveTeam = async (userId, teamData) => {
  const { data, error } = await supabase
    .from('teams')
    .insert({
      user_id: userId,
      contest_type: teamData.contestType,
      match_id: teamData.matchId,
      players: teamData.players,
      captain_id: teamData.captainId,
      vc_id: teamData.vcId,
      total_pts: 0,
      joined: false,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Get all teams for a user
export const getUserTeams = async (userId) => {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Mark team as joined (after paying entry fee)
export const joinContest = async (teamId, userId, contestType, entryFee) => {
  // Check participation limit (max 2 per contest type per match)
  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('user_id', userId)
    .eq('contest_type', contestType)
    .eq('joined', true)

  if (existing && existing.length >= 2) {
    throw new Error('Max 2 participations per match')
  }

  // Mark team joined
  const { error } = await supabase
    .from('teams')
    .update({ joined: true })
    .eq('id', teamId)
    .eq('user_id', userId)

  if (error) throw error
  return true
}

// Update team fantasy points (called after match)
export const updateTeamPoints = async (teamId, points) => {
  await supabase
    .from('teams')
    .update({ total_pts: points })
    .eq('id', teamId)
}

// ─── CONTESTS ─────────────────────────────────────────────────────

// Get or create active contest for a match
export const getActiveContest = async (matchId, contestType, entryFee) => {
  let { data } = await supabase
    .from('contests')
    .select('*')
    .eq('match_id', matchId)
    .eq('contest_type', contestType)
    .eq('status', 'open')
    .single()

  if (!data) {
    const { data: newContest } = await supabase
      .from('contests')
      .insert({ match_id: matchId, contest_type: contestType, entry_fee: entryFee })
      .select()
      .single()
    data = newContest
  }

  return data
}

// Add entry fee to contest pool
export const addToContestPool = async (contestId, amount) => {
  const { data } = await supabase
    .from('contests')
    .select('total_pool')
    .eq('id', contestId)
    .single()

  await supabase
    .from('contests')
    .update({ total_pool: (data?.total_pool || 0) + amount })
    .eq('id', contestId)
}

// ─── LEADERBOARD ──────────────────────────────────────────────────

// Get leaderboard for a contest
export const getLeaderboard = async (matchId, contestType, limit = 50) => {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      id, total_pts, contest_type,
      users ( id, name, mobile )
    `)
    .eq('match_id', matchId)
    .eq('contest_type', contestType)
    .eq('joined', true)
    .order('total_pts', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []).map((t, i) => ({
    rank: i + 1,
    teamId: t.id,
    userId: t.users?.id,
    name: t.users?.name,
    pts: t.total_pts,
  }))
}

// ─── ADMIN ────────────────────────────────────────────────────────

// Get all users (admin only)
export const getAllUsers = async () => {
  const { data } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

// Distribute prizes to winners
export const distributePrizes = async (contestId, matchId, contestType) => {
  const { data: contest } = await supabase
    .from('contests')
    .select('*')
    .eq('id', contestId)
    .single()

  if (contest?.prizes_distributed) throw new Error('Already distributed')

  const leaderboard = await getLeaderboard(matchId, contestType)
  const net = Math.floor(contest.total_pool * 0.85)
  const winners = Math.max(1, Math.floor(leaderboard.length * 0.7))

  // Build prize table
  const rawWeights = Array.from({ length: winners }, (_, i) => {
    const pos = i / Math.max(winners - 1, 1)
    return Math.pow(1 - pos, 1.8) + 0.15
  })
  const totalW = rawWeights.reduce((s, w) => s + w, 0)

  // Credit each winner
  for (let i = 0; i < winners; i++) {
    const winner = leaderboard[i]
    if (!winner) continue
    const prizeAmt = Math.floor((rawWeights[i] / totalW) * net)
    await creditPrize(winner.userId, prizeAmt, i + 1)
  }

  // Mark contest done
  await supabase
    .from('contests')
    .update({ prizes_distributed: true, status: 'completed' })
    .eq('id', contestId)

  return true
}

// Get all withdrawal requests (admin)
export const getWithdrawals = async () => {
  const { data } = await supabase
    .from('withdrawal_requests')
    .select(`*, users(name, mobile)`)
    .order('created_at', { ascending: false })
  return data || []
}

// Approve withdrawal (admin marks as paid)
export const approveWithdrawal = async (requestId) => {
  await supabase
    .from('withdrawal_requests')
    .update({ status: 'paid' })
    .eq('id', requestId)
}
