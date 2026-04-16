'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type Profile = {
  id: string
  full_name: string
  current_streak: number
  best_streak: number
  total_sober_days: number
  vault_deposit: number
  vault_rate_per_day: number
  vault_earned: number
  last_checkin_date: string | null
  invite_code: string
  sober_start_date: string | null
}

type Friend = {
  id: string
  full_name: string
  current_streak: number
  vault_earned: number
}

type FocusSession = {
  date: string
  duration: number
}

type FocusStats = {
  sessions: FocusSession[]
  totalTime: number
  distractions: number
}

export default function Dashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'sober' | 'focus'>('sober')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [showVaultSetup, setShowVaultSetup] = useState(false)
  const [depositAmount, setDepositAmount] = useState('100')
  const [dailyRate, setDailyRate] = useState('1')
  const [showInvite, setShowInvite] = useState(false)
  const [copied, setCopied] = useState(false)
  const [savingVault, setSavingVault] = useState(false)

  // Focus Timer States
  const [taskInput, setTaskInput] = useState('')
  const [focusStats, setFocusStats] = useState<FocusStats>({ sessions: [], totalTime: 0, distractions: 0 })
  const [timerMinutes, setTimerMinutes] = useState(25)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [timerDuration, setTimerDuration] = useState(25)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  // Load focus stats from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('focusStats')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setFocusStats(parsed)
      } catch (e) {
        setFocusStats({ sessions: [], totalTime: 0, distractions: 0 })
      }
    }
  }, [])

  // Timer effect
  useEffect(() => {
    if (!isRunning) return

    timerRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev === 0) {
          if (timerMinutes === 0) {
            setIsRunning(false)
            completeSession()
            return 0
          }
          setTimerMinutes(prev => prev - 1)
          return 59
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning, timerMinutes])

  async function loadData() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/auth'); return }

    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (p) {
      setProfile(p)
      setCheckedInToday(p.last_checkin_date === today)
      setDepositAmount(String(p.vault_deposit || 100))
      setDailyRate(String(p.vault_rate_per_day || 1))
    }

    const { data: friendLinks } = await supabase
      .from('sober_friends')
      .select('friend_id')
      .eq('user_id', session.user.id)

    if (friendLinks && friendLinks.length > 0) {
      const ids = friendLinks.map((f: any) => f.friend_id)
      const { data: friendProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, current_streak, vault_earned')
        .in('id', ids)
      setFriends(friendProfiles || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function checkIn() {
    if (!profile || checkedInToday) return
    const { error } = await supabase.from('sober_checkins').insert({
      user_id: profile.id,
      checkin_date: today
    })
    if (error) return

    const newStreak = profile.current_streak + 1
    const newBest = Math.max(newStreak, profile.best_streak)
    const newEarned = Math.min(newStreak * profile.vault_rate_per_day, profile.vault_deposit)

    await supabase.from('profiles').update({
      current_streak: newStreak,
      best_streak: newBest,
      total_sober_days: profile.total_sober_days + 1,
      vault_earned: newEarned,
      last_checkin_date: today,
    }).eq('id', profile.id)

    await supabase.from('vault_transactions').insert({
      user_id: profile.id,
      type: 'earned',
      amount: profile.vault_rate_per_day,
      note: `Day ${newStreak} check-in`
    })

    setProfile(prev => prev ? { ...prev, current_streak: newStreak, best_streak: newBest, vault_earned: newEarned, last_checkin_date: today } : prev)
    setCheckedInToday(true)
  }

  async function saveVault() {
    if (!profile) return
    setSavingVault(true)
    const deposit = parseFloat(depositAmount) || 100
    const rate = parseFloat(dailyRate) || 1

    await supabase.from('profiles').update({
      vault_deposit: deposit,
      vault_rate_per_day: rate,
      vault_earned: Math.min(profile.current_streak * rate, deposit)
    }).eq('id', profile.id)

    await supabase.from('vault_transactions').insert({
      user_id: profile.id,
      type: 'deposit',
      amount: deposit,
      note: 'Vault setup'
    })

    setProfile(prev => prev ? { ...prev, vault_deposit: deposit, vault_rate_per_day: rate } : prev)
    setShowVaultSetup(false)
    setSavingVault(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/')
  }

  function copyInviteLink() {
    if (!profile) return
    const link = `${window.location.origin}/invite/${profile.invite_code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function startTimer() { setIsRunning(true) }
  function pauseTimer() { setIsRunning(false) }
  function resetTimer() {
    setIsRunning(false)
    setTimerMinutes(timerDuration)
    setTimerSeconds(0)
  }

  function completeSession() {
    const newSession: FocusSession = { date: today, duration: timerDuration }
    const newStats = {
      ...focusStats,
      sessions: [...focusStats.sessions, newSession],
      totalTime: focusStats.totalTime + timerDuration
    }
    setFocusStats(newStats)
    localStorage.setItem('focusStats', JSON.stringify(newStats))
    setTaskInput('')
    setTimerMinutes(timerDuration)
    setTimerSeconds(0)
  }

  function logDistraction() {
    const newStats = { ...focusStats, distractions: focusStats.distractions + 1 }
    setFocusStats(newStats)
    localStorage.setItem('focusStats', JSON.stringify(newStats))
  }

  function getTodayStats() {
    const todaySessions = focusStats.sessions.filter(s => s.date === today)
    const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration, 0)
    return { count: todaySessions.length, minutes: todayMinutes }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <span style={{ color: '#525252', fontSize: 14 }}>loading...</span>
    </div>
  )

  if (!profile) return null

  const vaultPct = profile.vault_deposit > 0 ? Math.min((profile.vault_earned / profile.vault_deposit) * 100, 100) : 0
  const streakPct = Math.min((profile.current_streak / 30) * 100, 100)
  const locked = Math.max(profile.vault_deposit - profile.vault_earned, 0)
  const todayStats = getTodayStats()

  const allUsers = [
    { id: profile.id, full_name: profile.full_name || 'You', current_streak: profile.current_streak, vault_earned: profile.vault_earned, isMe: true },
    ...friends.map(f => ({ ...f, isMe: false }))
  ].sort((a, b) => b.current_streak - a.current_streak)

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '0 0 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>locked in</span>
        <button onClick={signOut} style={{ background: 'transparent', border: 'none', color: '#525252', fontSize: 13, cursor: 'pointer' }}>sign out</button>
      </div>

      {/* User Greeting */}
      <div style={{ padding: '16px 24px 0' }}>
        <div style={{ fontSize: 16, color: '#a3a3a3' }}>
          hey, {profile.full_name?.split(' ')[0] || 'there'}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 0, padding: '20px 24px 0', borderBottom: '1px solid #1a1a1a' }}>
        <button
          onClick={() => setActiveTab('sober')}
          style={{
            padding: '12px 16px',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'sober' ? '#ffffff' : '#525252',
            fontSize: 14,
            fontWeight: activeTab === 'sober' ? 600 : 400,
            cursor: 'pointer',
            borderBottom: activeTab === 'sober' ? '2px solid #16a34a' : 'none',
            transition: 'all .2s'
          }}
        >
          sober tracker
        </button>
        <button
          onClick={() => setActiveTab('focus')}
          style={{
            padding: '12px 16px',
            background: 'transparent',
            border: 'none',
            color: activeTab === 'focus' ? '#ffffff' : '#525252',
            fontSize: 14,
            fontWeight: activeTab === 'focus' ? 600 : 400,
            cursor: 'pointer',
            borderBottom: activeTab === 'focus' ? '2px solid #16a34a' : 'none',
            transition: 'all .2s'
          }}
        >
          focus timer
        </button>
      </div>

      {/* SOBER TRACKER TAB */}
      {activeTab === 'sober' && (
        <>
          {/* Streak Display */}
          <div style={{ padding: '40px 24px 32px', textAlign: 'center', borderBottom: '1px solid #1a1a1a' }}>
            <div style={{ fontSize: 80, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}>
              {profile.current_streak}
            </div>
            <div style={{ color: '#525252', fontSize: 16, marginTop: 8 }}>days sober</div>

            <div style={{ margin: '24px 0 8px' }}>
              <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${streakPct}%`, background: '#fff', borderRadius: 2, transition: 'width .5s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 11, color: '#404040' }}>0</span>
                <span style={{ fontSize: 11, color: '#404040' }}>30 days</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 24 }}>
              {[
                ['best streak', profile.best_streak + ' days'],
                ['total days', profile.total_sober_days + ' days'],
              ].map(([label, val]) => (
                <div key={label} style={{ background: '#111', borderRadius: 10, padding: '12px 14px', border: '1px solid #1a1a1a' }}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{val}</div>
                  <div style={{ fontSize: 11, color: '#525252', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Vault Section */}
          <div style={{ padding: '24px 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '.06em' }}>vault</span>
              <button onClick={() => setShowVaultSetup(!showVaultSetup)} style={{ background: 'transparent', border: 'none', color: '#525252', fontSize: 13, cursor: 'pointer' }}>
                {showVaultSetup ? 'cancel' : 'edit'}
              </button>
            </div>

            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>${profile.vault_earned.toFixed(2)}</div>
                  <div style={{ fontSize: 13, color: '#525252', marginTop: 2 }}>earned of ${profile.vault_deposit.toFixed(2)}</div>
                </div>
                <div style={{ background: '#1a1a1a', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#a3a3a3' }}>
                  ${profile.vault_rate_per_day}/day
                </div>
              </div>

              <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', width: `${vaultPct}%`, background: '#fff', borderRadius: 3, transition: 'width .5s' }} />
              </div>
              <div style={{ fontSize: 12, color: '#404040' }}>
                {locked > 0 ? `$${locked.toFixed(2)} locked — keep going` : 'full deposit earned back'}
              </div>

              {showVaultSetup && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #1a1a1a' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#525252', marginBottom: 6 }}>deposit ($)</div>
                      <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#525252', marginBottom: 6 }}>earn per day ($)</div>
                      <input type="number" value={dailyRate} onChange={e => setDailyRate(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: '#404040', marginBottom: 12, lineHeight: 1.5 }}>
                    Note: real money transfers require Stripe setup. This tracks your commitment and logs transactions.
                  </p>
                  <button onClick={saveVault} disabled={savingVault} style={btnWhite}>
                    {savingVault ? 'saving...' : 'save vault settings'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Leaderboard Section */}
          <div style={{ padding: '24px 24px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#a3a3a3', textTransform: 'uppercase', letterSpacing: '.06em' }}>leaderboard</span>
              <button onClick={() => setShowInvite(!showInvite)} style={{ background: 'transparent', border: 'none', color: '#525252', fontSize: 13, cursor: 'pointer' }}>
                + invite
              </button>
            </div>

            {showInvite && (
              <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: '#a3a3a3', marginBottom: 10 }}>share your invite link</div>
                <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#525252', marginBottom: 10, wordBreak: 'break-all' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/invite/${profile.invite_code}` : `.../${profile.invite_code}`}
                </div>
                <button onClick={copyInviteLink} style={btnWhite}>
                  {copied ? 'copied!' : 'copy link'}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allUsers.map((u, i) => (
                <div key={u.id} style={{
                  background: '#111',
                  border: u.isMe ? '1px solid #ffffff30' : '1px solid #1a1a1a',
                  borderRadius: 10,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: u.isMe ? '#fff' : '#1a1a1a',
                    color: u.isMe ? '#000' : '#525252',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 600, flexShrink: 0
                  }}>
                    {u.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: u.isMe ? '#fff' : '#e5e5e5' }}>
                      {u.full_name}{u.isMe ? ' (you)' : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#525252', marginTop: 1 }}>${u.vault_earned.toFixed(2)} earned</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{u.current_streak}</div>
                    <div style={{ fontSize: 10, color: '#404040' }}>#{i + 1}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Check-in Button */}
          <div style={{ padding: '24px 24px 0' }}>
            <button
              onClick={checkIn}
              disabled={checkedInToday}
              style={{
                width: '100%', padding: '16px', borderRadius: 12,
                fontSize: 16, fontWeight: 600,
                background: checkedInToday ? '#111' : '#fff',
                color: checkedInToday ? '#404040' : '#000',
                border: checkedInToday ? '1px solid #1a1a1a' : 'none',
                cursor: checkedInToday ? 'default' : 'pointer',
                transition: 'all .2s'
              }}
            >
              {checkedInToday ? 'checked in today' : 'check in — day ' + (profile.current_streak + 1)}
            </button>
          </div>
        </>
      )}

      {/* FOCUS TIMER TAB */}
      {activeTab === 'focus' && (
        <>
          {/* Timer Display */}
          <div style={{ padding: '40px 24px 32px', textAlign: 'center', borderBottom: '1px solid #1a1a1a' }}>
            <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: 'monospace' }}>
              {String(timerMinutes).padStart(2, '0')}:{String(timerSeconds).padStart(2, '0')}
            </div>
            <div style={{ color: '#525252', fontSize: 16, marginTop: 8 }}>
              {timerDuration}-minute session
            </div>

            {/* Timer Controls */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
              <button onClick={startTimer} disabled={isRunning} style={{
                padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: isRunning ? '#1a1a1a' : '#16a34a', color: isRunning ? '#525252' : '#ffffff',
                border: 'none', cursor: isRunning ? 'default' : 'pointer', transition: 'all .2s'
              }}>start</button>
              <button onClick={pauseTimer} disabled={!isRunning} style={{
                padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: isRunning ? '#fff' : '#1a1a1a', color: isRunning ? '#000' : '#525252',
                border: 'none', cursor: isRunning ? 'pointer' : 'default', transition: 'all .2s'
              }}>pause</button>
              <button onClick={resetTimer} style={{
                padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: '#1a1a1a', color: '#525252', border: '1px solid #262626',
                cursor: 'pointer', transition: 'all .2s'
              }}>reset</button>
            </div>

            {/* Duration Presets */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 20 }}>
              {[15, 25, 45].map(mins => (
                <button key={mins} onClick={() => {
                  setTimerDuration(mins)
                  setTimerMinutes(mins)
                  setTimerSeconds(0)
                }} style={{
                  padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: timerDuration === mins ? '#fff' : '#111',
                  color: timerDuration === mins ? '#000' : '#a3a3a3',
                  border: `1px solid ${timerDuration === mins ? '#fff' : '#1a1a1a'}`,
                  cursor: 'pointer'
                }}>{mins}m</button>
              ))}
            </div>
          </div>

          {/* Task Input */}
          <div style={{ padding: '24px' }}>
            <div style={{ fontSize: 13, color: '#a3a3a3', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>what are you working on?</div>
            <input type="text" value={taskInput} onChange={e => setTaskInput(e.target.value)}
              placeholder="e.g., finish report, code review..."
              style={{ width: '100%', background: '#111', border: '1px solid #262626', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 15, outline: 'none' }}
            />
          </div>

          {/* Distraction Counter */}
          <div style={{ padding: '0 24px 24px' }}>
            <button onClick={logDistraction} style={{
              width: '100%', padding: '12px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: '#111', color: '#e5e5e5', border: '1px solid #1a1a1a', cursor: 'pointer', transition: 'all .2s'
            }}>
              distracted 🔴 ({focusStats.distractions} today)
            </button>
          </div>

          {/* Daily Focus Stats */}
          <div style={{ padding: '0 24px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['focus sessions', todayStats.count.toString()],
                ['total focus time', todayStats.minutes + ' min'],
              ].map(([label, val]) => (
                <div key={label} style={{ background: '#111', borderRadius: 10, padding: '12px 14px', border: '1px solid #1a1a1a' }}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{val}</div>
                  <div style={{ fontSize: 11, color: '#525252', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tip */}
          <div style={{ padding: '0 24px' }}>
            <div style={{ background: '#1a1a0a', border: '1px solid #333300', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, color: '#a3a300', lineHeight: 1.5 }}>
                💡 Track your focus sessions locally. Keep your streak going while staying productive. The distraction counter helps you stay aware of breaks.
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}

const inputStyle: React.CSSProperties = { background: '#0a0a0a', border: '1px solid #262626', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 14, outline: 'none' }
const btnWhite: React.CSSProperties = { width: '100%', padding: '12px', background: '#fff', color: '#000', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
