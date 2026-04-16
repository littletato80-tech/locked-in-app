'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type InviterProfile = {
  id: string; full_name: string; current_streak: number; best_streak: number;
  total_sober_days: number; vault_earned: number; vault_deposit: number; sober_start_date: string | null
}

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const [inviter, setInviter] = useState<InviterProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [session, setSession] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session: s } } = await supabase.auth.getSession()
      setSession(s)
      const { data } = await supabase.from('profiles')
        .select('id, full_name, current_streak, best_streak, total_sober_days, vault_earned, vault_deposit, sober_start_date')
        .eq('invite_code', code).single()
      if (!data) { setNotFound(true); setLoading(false); return }
      setInviter(data)
      if (s) {
        const { data: existing } = await supabase.from('sober_friends').select('id').eq('user_id', s.user.id).eq('friend_id', data.id).single()
        if (existing) setJoined(true)
      }
      setLoading(false)
    }
    load()
  }, [code])

  async function joinStreak() {
    if (!session) { router.push('/auth?mode=signup'); return }
    if (!inviter) return
    setJoining(true)
    await supabase.from('sober_friends').upsert([
      { user_id: session.user.id, friend_id: inviter.id },
      { user_id: inviter.id, friend_id: session.user.id },
    ])
    setJoined(true); setJoining(false)
  }

  if (loading) return (<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><span style={{ color: '#525252', fontSize: 14 }}>loading...</span></div>)
  if (notFound) return (<main style={page}><h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>link not found</h1><p style={{ color: '#525252' }}>This invite link doesn't exist.</p></main>)
  if (!inviter) return null

  const vaultPct = inviter.vault_deposit > 0 ? Math.min((inviter.vault_earned / inviter.vault_deposit) * 100, 100) : 0

  return (
    <main style={page}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 13, color: '#525252', marginBottom: 24 }}>locked in · invite</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>{inviter.full_name} is on a streak</h1>
        <p style={{ color: '#a3a3a3', fontSize: 16 }}>They invited you to hold them accountable.</p>
      </div>

      <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '24px', marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}>{inviter.current_streak}</div>
        <div style={{ color: '#525252', fontSize: 15, marginTop: 6 }}>days sober</div>
        <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden', margin: '20px 0 6px' }}>
          <div style={{ height: '100%', width: `${Math.min((inviter.current_streak / 30) * 100, 100)}%`, background: '#fff', borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 11, color: '#404040' }}>next milestone: 30 days</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 24 }}>
        {[['best', inviter.best_streak + 'd'], ['total', inviter.total_sober_days + 'd'], ['earned', '$' + inviter.vault_earned.toFixed(0)]].map(([label, val]) => (
          <div key={label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{val}</div>
            <div style={{ fontSize: 11, color: '#525252', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {joined ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px', marginBottom: 16 }}>
            <div style={{ fontSize: 15, color: '#a3a3a3' }}>you're following {inviter.full_name.split(' ')[0]}'s streak</div>
          </div>
          <button onClick={() => router.push('/dashboard')} style={btnWhite}>go to your dashboard</button>
        </div>
      ) : (
        <div>
          <button onClick={joinStreak} disabled={joining} style={btnWhite}>
            {joining ? 'joining...' : session ? `follow ${inviter.full_name.split(' ')[0]}'s streak` : 'sign up to follow their streak'}
          </button>
          <p style={{ fontSize: 12, color: '#404040', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
            {session ? "You'll see their streak on your leaderboard." : "Create a free account to track each other's streaks."}
          </p>
        </div>
      )}
    </main>
  )
}

const page: React.CSSProperties = { maxWidth: 420, margin: '0 auto', padding: '48px 24px', minHeight: '100vh' }
const btnWhite: React.CSSProperties = { width: '100%', padding: '15px', background: '#fff', color: '#000', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer' }
