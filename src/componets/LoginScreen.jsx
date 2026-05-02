// src/components/LoginScreen.jsx
// Replace your LOGIN and OTP screens in App.jsx with this component
// Email OTP — user gets 6-digit code in their email inbox

import { useState, useEffect } from 'react'

const C = {
  bg:"#04060e", surface:"#090f1d", card:"#0c1425",
  border:"#172030", red:"#e8191b", gold:"#fbbf24",
  green:"#22c55e", blue:"#38bdf8", text:"#e2e8f0", muted:"#5a6a8a",
}

export default function LoginScreen({ onLogin, authError }) {
  const [step, setStep]       = useState('email')  // email | otp
  const [email, setEmail]     = useState('')
  const [otp, setOtp]         = useState(['','','','','',''])
  const [otpTimer, setOtpTimer] = useState(0)
  const [loading, setLoading] = useState(false)
  const [toast, setToast]     = useState(null)

  const showToast = (msg, color=C.green) => {
    setToast({msg,color})
    setTimeout(()=>setToast(null), 3000)
  }

  useEffect(() => {
    if (!otpTimer) return
    const iv = setInterval(()=>setOtpTimer(t=>t-1), 1000)
    return () => clearInterval(iv)
  }, [otpTimer])

  // Send OTP to email
  const handleSendOtp = async () => {
    if (!email.includes('@')) { showToast('Enter valid email', C.red); return }
    setLoading(true)
    const ok = await onLogin.sendOtp(email)
    setLoading(false)
    if (ok) {
      setStep('otp')
      setOtpTimer(60)
      showToast('OTP sent to your email! ✉️', C.blue)
    } else {
      showToast(authError || 'Failed to send OTP', C.red)
    }
  }

  // Verify OTP
  const handleVerify = async (digits = otp) => {
    const token = digits.join('')
    if (token.length !== 6) { showToast('Enter 6-digit OTP', C.red); return }
    setLoading(true)
    const ok = await onLogin.verifyOtp(email, token)
    setLoading(false)
    if (!ok) showToast(authError || 'Wrong OTP! Check your email', C.red)
  }

  const handleOtpInput = (val, idx) => {
    const d = [...otp]; d[idx] = val.slice(-1); setOtp(d)
    if (val && idx < 5) document.getElementById(`otp${idx+1}`)?.focus()
    if (idx === 5 && val) setTimeout(() => handleVerify(d), 100)
  }

  return (
    <div style={{fontFamily:"'Rajdhani','Segoe UI',sans-serif", background:C.bg,
      minHeight:'100vh', color:C.text, maxWidth:430, margin:'0 auto',
      display:'flex', flexDirection:'column'}}>

      {/* Toast */}
      {toast && (
        <div style={{position:'fixed',top:16,left:'50%',transform:'translateX(-50%)',
          background:toast.color,color:'#fff',padding:'11px 24px',borderRadius:26,
          fontWeight:700,fontSize:14,zIndex:9999,whiteSpace:'nowrap',
          boxShadow:'0 6px 28px rgba(0,0,0,.6)'}}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{background:'linear-gradient(160deg,#0a2a0a 0%,#04060e 60%)',
        padding:'52px 24px 36px', textAlign:'center', position:'relative'}}>
        <div style={{position:'absolute',top:16,right:16,
          background:`${C.green}20`,border:`1px solid ${C.green}40`,
          borderRadius:20,padding:'4px 12px',fontSize:11,color:C.green,fontWeight:700}}>
          70% WIN 🏆
        </div>
        <div style={{fontSize:56, marginBottom:8}}>🏏</div>
        <div style={{fontSize:32,fontWeight:900,letterSpacing:1}}>
          Cricket<span style={{color:C.gold}}>Bazar</span>
        </div>
        <div style={{fontSize:11,color:'rgba(255,255,255,.4)',letterSpacing:3,marginTop:4}}>
          FANTASY CRICKET • WIN REAL MONEY
        </div>
      </div>

      <div style={{flex:1, padding:'28px 20px'}}>

        {/* USP Pills */}
        <div style={{display:'flex',gap:8,marginBottom:24}}>
          {[['🏆','70% Win'],['💰','85% Prize'],['🔍','Transparent']].map(([ic,l])=>(
            <div key={l} style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,
              borderRadius:10,padding:'10px 6px',textAlign:'center'}}>
              <div style={{fontSize:18}}>{ic}</div>
              <div style={{fontSize:10,color:C.green,fontWeight:700,marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>

        {/* EMAIL STEP */}
        {step === 'email' && (
          <>
            <div style={{fontSize:21,fontWeight:800,marginBottom:4}}>Login / Register</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:18}}>
              Enter your email — we'll send a 6-digit OTP
            </div>

            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="yourname@gmail.com"
              type="email"
              style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,
                borderRadius:12,padding:'14px 16px',color:'#fff',fontSize:16,
                fontWeight:500,outline:'none',marginBottom:14,boxSizing:'border-box'}}
            />

            <button onClick={handleSendOtp} disabled={loading}
              style={{width:'100%',padding:'13px 20px',borderRadius:12,border:'none',
                background:loading?C.muted:`linear-gradient(135deg,${C.green},#15803d)`,
                color:'#fff',fontWeight:800,fontSize:15,cursor:loading?'not-allowed':'pointer',
                boxShadow:loading?'none':`0 4px 18px ${C.green}44`}}>
              {loading ? 'Sending...' : 'Send OTP to Email →'}
            </button>

            <div style={{marginTop:20,padding:14,background:C.surface,
              borderRadius:12,border:`1px solid ${C.border}`,fontSize:12,
              color:C.muted,lineHeight:1.7}}>
              ✅ No phone number needed<br/>
              ✅ OTP sent directly to your email<br/>
              ✅ Works with Gmail, Yahoo, any email
            </div>
          </>
        )}

        {/* OTP STEP */}
        {step === 'otp' && (
          <>
            <button onClick={()=>setStep('email')}
              style={{background:'none',border:`1px solid ${C.border}`,borderRadius:9,
                padding:'7px 14px',color:C.muted,fontSize:13,cursor:'pointer',marginBottom:24}}>
              ← Back
            </button>

            <div style={{fontSize:36,marginBottom:10}}>✉️</div>
            <div style={{fontSize:24,fontWeight:800,marginBottom:4}}>Check Your Email</div>
            <div style={{fontSize:13,color:C.muted,marginBottom:6}}>
              OTP sent to:
            </div>
            <div style={{fontSize:14,fontWeight:700,color:C.blue,marginBottom:24}}>
              {email}
            </div>

            {/* OTP boxes */}
            <div style={{display:'flex',gap:10,justifyContent:'center',marginBottom:24}}>
              {otp.map((d,i) => (
                <input key={i} id={`otp${i}`} value={d}
                  onChange={e => handleOtpInput(e.target.value, i)}
                  onKeyDown={e => { if(e.key==='Backspace'&&!d&&i>0) document.getElementById(`otp${i-1}`)?.focus() }}
                  maxLength={1} type="tel"
                  style={{width:48,height:58,textAlign:'center',fontSize:26,fontWeight:900,
                    background:C.surface,border:`2px solid ${d?C.green:C.border}`,
                    borderRadius:12,color:'#fff',outline:'none'}}/>
              ))}
            </div>

            <button onClick={()=>handleVerify()} disabled={loading}
              style={{width:'100%',padding:'13px 20px',borderRadius:12,border:'none',
                background:loading?C.muted:`linear-gradient(135deg,${C.green},#15803d)`,
                color:'#fff',fontWeight:800,fontSize:15,cursor:loading?'not-allowed':'pointer',
                boxShadow:loading?'none':`0 4px 18px ${C.green}44`,marginBottom:16}}>
              {loading ? 'Verifying...' : 'Verify & Enter App ✓'}
            </button>

            <div style={{textAlign:'center',fontSize:13,color:C.muted}}>
              {otpTimer > 0
                ? `Resend OTP in ${otpTimer}s`
                : <span onClick={handleSendOtp}
                    style={{color:C.blue,cursor:'pointer',fontWeight:700}}>
                    Resend OTP
                  </span>}
            </div>

            <div style={{marginTop:20,padding:14,background:"#0a1e38",
              borderRadius:12,border:`1px solid ${C.blue}30`,fontSize:12,
              color:C.muted,lineHeight:1.7}}>
              📧 Check your inbox for the OTP<br/>
              📁 Also check Spam / Junk folder<br/>
              ⏱️ OTP expires in 10 minutes
            </div>
          </>
        )}

      </div>
    </div>
  )
}
