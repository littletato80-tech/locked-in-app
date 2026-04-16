'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

function AuthForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    const supabase = createClient()

    if (mode === 'signup') {
      const { data, error: err } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      })
      if (err) { setError(err.message); setLoading(false); return }
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: name,
        })
        setDone(true)
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      router.push('/dashboard')
    }
    setLoading(false)
  }

  if (done) return (
    <main style={page}>
      <h1 style={heading}>check your email</h1>
      <p style={sub}>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
      <button onClick={() => setMode('login')} style={btnPrimary}>back to sign in</button>
    </main>
  )

  return (
    <main style={page}>
      <a href="/" style={{ color: '#525252', fontSize: 14, marginBottom: 48, display: 'block' }}>← back</a>
      <h1 style={heading}>{mode === 'signup' ? 'create account' : 'welcome back'}</h1>
      <p style={sub}>{mode === 'signup' ? 'Start your journey today.' : 'Sign in to your account.'}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 32 }}>
        {mode === 'signup' && (
          <input
            style={input}
            placeholder="your name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        )}
        <input
          style={input}
          type="email"
          placeholder="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <input
          style={input}
          type="password"
          placeholder="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
        {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}
        <button onClick={handleSubmit} disabled={loading} style={btnPrimary}>
          {loading ? 'loading...' : mode === 'signup' ? 'create account' : 'sign in'}
        </button>
      </div>

      <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} style={btnGhost}>
        {mode === 'login' ? "don't have an account? sign up" : 'already have an account? sign in'}
      </button>
    </main>
  )
}

export default function AuthPage() {
  return <Suspense><AuthForm /></Suspense>
}

const page: React.CSSProperties = { maxWidth: 420, margin: '0 auto', padding: '48px 24px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }
const heading: React.CSSProperties = { fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }
const sub: React.CSSProperties = { color: '#a3a3a3', fontSize: 16, lineHeight: 1.5 }
const input: React.CSSProperties = { background: '#111', border: '1px solid #262626', borderRadius: 10, padding: '14px 16px', color: '#fff', fontSize: 16, outline: 'none', width: '100%' }
const btnPrimary: React.CSSProperties = { background: '#fff', color: '#000', border: 'none', borderRadius: 10, padding: '14px 16px', fontSize: 16, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 4 }
const btnGhost: React.CSSProperties = { background: 'transparent', color: '#525252', border: 'none', fontSize: 14, cursor: 'pointer', marginTop: 16, padding: '8px 0' }
