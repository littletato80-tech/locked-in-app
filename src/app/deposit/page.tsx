'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

declare global {
  interface Window { Stripe: any }
}

export default function DepositPage() {
  const router = useRouter()
  const [amount, setAmount] = useState('100')
  const [rate, setRate] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stripe, setStripe] = useState<any>(null)
  const [stripeReady, setStripeReady] = useState(false)
  const [session, setSession] = useState<any>(null)
  const presets = ['25', '50', '100', '250']
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!s) { router.replace('/auth'); return }
      setSession(s)
    })
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    if (!pk) { setStripeReady(false); return }
    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/'
    script.onload = () => { const s = window.Stripe(pk); setStripe(s); setStripeReady(true) }
    document.head.appendChild(script)
  }, [])

  async function handleDeposit() {
    if (!session) return
    setLoading(true); setError('')
    const depositAmount = parseFloat(amount)
    if (isNaN(depositAmount) || depositAmount < 10) { setError('Minimum deposit is $10'); setLoading(false); return }
    if (!stripeReady || !stripe) { setError('Stripe is not configured yet.'); setLoading(false); return }
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${freshSession?.access_token}` },
        body: JSON.stringify({ amount: depositAmount })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Payment failed'); setLoading(false); return }
      const result = await stripe.confirmCardPayment(data.client_secret, { payment_method: { card: { token: 'tok_visa' } } })
      if (result.error) { setError(result.error.message) }
      else {
        await supabase.from('profiles').update({ vault_deposit: depositAmount, vault_rate_per_day: parseFloat(rate) || 1, vault_earned: 0 }).eq('id', session.user.id)
        router.push('/dashboard')
      }
    } catch (e: any) { setError(e.message || 'Something went wrong') }
    setLoading(false)
  }

  const daysToEarnBack = parseFloat(rate) > 0 ? Math.ceil(parseFloat(amount) / parseFloat(rate)) : 0

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '48px 24px', minHeight: '100vh' }}>
      <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: '#525252', fontSize: 14, cursor: 'pointer', marginBottom: 40, padding: 0 }}>← back</button>
      <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>lock in your deposit</h1>
      <p style={{ color: '#525252', fontSize: 15, lineHeight: 1.5, marginBottom: 36 }}>Put real money on the line. Earn it back $1 at a time, every sober day.</p>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>deposit amount</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {presets.map(p => (<button key={p} onClick={() => setAmount(p)} style={{ padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 500, background: amount === p ? '#fff' : '#111', color: amount === p ? '#000' : '#a3a3a3', border: `1px solid ${amount === p ? '#fff' : '#1a1a1a'}`, cursor: 'pointer' }}>${p}</button>))}
        </div>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="custom amount" style={inputStyle} min="10" />
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 12 }}>daily earn rate</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[['$1','1'],['$2','2'],['$5','5']].map(([label, val]) => (<button key={val} onClick={() => setRate(val)} style={{ padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 500, background: rate === val ? '#fff' : '#111', color: rate === val ? '#000' : '#a3a3a3', border: `1px solid ${rate === val ? '#fff' : '#1a1a1a'}`, cursor: 'pointer' }}>{label}/day</button>))}
        </div>
        <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="custom rate" style={inputStyle} min="1" />
      </div>

      {amount && rate && (
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#525252', marginBottom: 6 }}>your commitment</div>
          <div style={{ fontSize: 15, color: '#e5e5e5', lineHeight: 1.6 }}>
            Deposit <strong style={{ color: '#fff' }}>${parseFloat(amount).toFixed(2)}</strong> today.<br />
            Earn back <strong style={{ color: '#fff' }}>${parseFloat(rate).toFixed(2)}/day</strong> for staying sober.<br />
            Full deposit back in <strong style={{ color: '#fff' }}>{daysToEarnBack} days</strong>.
          </div>
        </div>
      )}

      {!stripeReady && (
        <div style={{ background: '#1a1a0a', border: '1px solid #333300', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#a3a300', lineHeight: 1.5 }}>Stripe not yet connected. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable real payments.</div>
        </div>
      )}

      {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <button onClick={handleDeposit} disabled={loading} style={{
        width: '100%', padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 600,
        background: loading ? '#1a1a1a' : '#fff', color: loading ? '#525252' : '#000',
        border: 'none', cursor: loading ? 'default' : 'pointer', transition: 'all .2s'
      }}>{loading ? 'processing...' : `deposit $${parseFloat(amount || '0').toFixed(2)}`}</button>

      <p style={{ fontSize: 11, color: '#404040', textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
        Payments secured by Stripe. Your streak resets if you miss a day, but your money stays locked until you earn it back.
      </p>
    </main>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', background: '#111', border: '1px solid #262626', borderRadius: 8, padding: '12px 14px', color: '#fff', fontSize: 15, outline: 'none' }
