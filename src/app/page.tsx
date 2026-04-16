'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
      else setLoading(false)
    })
  }, [router])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <span style={{ color: '#525252', fontSize: 14 }}>loading...</span>
    </div>
  )

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ marginBottom: 64 }}>
        <h1 style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 16 }}>
          Locked<br />In.
        </h1>
        <p style={{ color: '#a3a3a3', fontSize: 18, lineHeight: 1.5 }}>
          Stay sober. Stay focused. Earn your money back.<br />Your friends are watching.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <a href="/auth?mode=signup" style={{
          display: 'block', textAlign: 'center', padding: '16px 24px',
          background: '#ffffff', color: '#0a0a0a',
          borderRadius: 12, fontSize: 16, fontWeight: 600,
          border: 'none'
        }}>
          get started
        </a>
        <a href="/auth?mode=login" style={{
          display: 'block', textAlign: 'center', padding: '16px 24px',
          background: 'transparent', color: '#ffffff',
          borderRadius: 12, fontSize: 16, fontWeight: 500,
          border: '1px solid #262626'
        }}>
          sign in
        </a>
      </div>

      <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[
          ['deposit cash', 'Lock in any amount. $50, $100, whatever hurts to lose.'],
          ['stay sober & focused', 'Check in daily, use the focus timer to stay productive.'],
          ['friends see your streak', 'Send a link. They see your streak and focus sessions in real time.'],
        ].map(([title, desc]) => (
          <div key={title}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 14, color: '#525252', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>
    </main>
  )
}
