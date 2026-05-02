// src/hooks/useAuth.js
// Email OTP Login — Supabase handles it FREE, no Twilio needed!
// User enters email → gets OTP in email → enters OTP → logged in

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // ── Check existing session ─────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) loadProfile(data.session.user)
      else setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        if (session?.user) await loadProfile(session.user)
        else { setUser(null); setLoading(false) }
      }
    )
    return () => listener.subscription.unsubscribe()
  }, [])

  // ── Load or create user profile ────────────────────────────
  const loadProfile = async (authUser) => {
    try {
      const { data: existing } = await supabase
        .from('users').select('*')
        .eq('id', authUser.id).single()

      if (existing) {
        setUser(existing)
      } else {
        const email = authUser.email || ''
        const name  = email.split('@')[0] || 'Player'
        const { data: newUser } = await supabase
          .from('users')
          .insert({ id: authUser.id, mobile: email, name, balance: 0 })
          .select().single()
        setUser(newUser)
      }
    } catch (e) {
      console.error('Profile error:', e)
    } finally {
      setLoading(false)
    }
  }

  // ── SEND OTP to Email ──────────────────────────────────────
  const login = async (email) => {
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        }
      })
      if (error) throw error
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  // ── VERIFY OTP from Email ──────────────────────────────────
  const verify = async (email, token) => {
    setError(null)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      })
      if (error) throw error
      return true
    } catch (e) {
      setError(e.message)
      return false
    }
  }

  // ── LOGOUT ────────────────────────────────────────────────
  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  // ── REFRESH USER ──────────────────────────────────────────
  const refreshUser = async () => {
    if (!session?.user) return
    try {
      const { data } = await supabase
        .from('users').select('*')
        .eq('id', session.user.id).single()
      if (data) setUser(data)
    } catch (e) {
      console.error('Refresh error:', e)
    }
  }

  return { user, session, loading, error, login, verify, logout, refreshUser }
}
