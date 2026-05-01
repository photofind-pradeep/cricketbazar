// src/hooks/useAuth.js
import { useState, useEffect } from 'react'
import { supabase, sendOTP, verifyOTP, createUser, getUser, signOut } from '../lib/supabase'

export function useAuth() {
  const [user, setUser]       = useState(null)   // DB user profile
  const [session, setSession] = useState(null)   // Supabase session
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // ── Listen for auth changes ──────────────────────────────────────
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) loadUserProfile(data.session.user)
      else setLoading(false)
    })

    // Listen for login/logout
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        if (session?.user) await loadUserProfile(session.user)
        else { setUser(null); setLoading(false) }
      }
    )

    return () => listener.subscription.unsubscribe()
  }, [])

  const loadUserProfile = async (authUser) => {
    try {
      let profile = await getUser(authUser.id).catch(() => null)
      if (!profile) {
        // First time login — create profile
        const mobile = authUser.phone?.replace('+91', '') || ''
        profile = await createUser(authUser.id, mobile)
      }
      setUser(profile)
    } catch (e) {
      console.error('Profile load error:', e)
    } finally {
      setLoading(false)
    }
  }

  // ── Send OTP ─────────────────────────────────────────────────────
  const login = async (mobile) => {
    setError(null)
    try {
      await sendOTP(mobile)
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  // ── Verify OTP ───────────────────────────────────────────────────
  const verify = async (mobile, token) => {
    setError(null)
    try {
      await verifyOTP(mobile, token)
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  // ── Logout ───────────────────────────────────────────────────────
  const logout = async () => {
    await signOut()
    setUser(null)
    setSession(null)
  }

  // ── Refresh user from DB ─────────────────────────────────────────
  const refreshUser = async () => {
    if (!session?.user) return
    const profile = await getUser(session.user.id)
    setUser(profile)
  }

  return { user, session, loading, error, login, verify, logout, refreshUser }
}
