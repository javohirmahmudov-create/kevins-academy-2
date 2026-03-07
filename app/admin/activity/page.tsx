'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useApp } from '@/lib/app-context'
import { Activity, ArrowLeft, Clock3, ShieldAlert, Users } from 'lucide-react'

type ActivityRow = {
  id: number
  role: 'student' | 'parent'
  userId: string
  fullName: string
  group: string
  deviceType: string
  ipAddress: string
  sessionId: string
  loginAt: string
  lastSeenAt: string
  durationSeconds: number | null
  online: boolean
}

type LatestUserState = {
  key: string
  role: 'student' | 'parent'
  userId: string
  fullName: string
  group: string
  lastSeenAt: string
  event: 'login' | 'heartbeat' | 'logout'
  online: boolean
}

type ActivityResponse = {
  summary: {
    totalUsers: number
    onlineNow: number
    loginsToday: number
    inactiveCount: number
    parentLoginRate: number
  }
  rows: ActivityRow[]
  groups: string[]
  inactiveUsers: LatestUserState[]
  todayLogins: ActivityRow[]
  notLoggedToday: LatestUserState[]
  rankings: {
    parents: Array<{
      key: string
      role: 'student' | 'parent'
      userId: string
      fullName: string
      group: string
      loginCount: number
      lastLoginAt: string
    }>
    students: Array<{
      key: string
      role: 'student' | 'parent'
      userId: string
      fullName: string
      group: string
      loginCount: number
      lastLoginAt: string
    }>
  }
  aiReport: string[]
}

const INACTIVE_MS = 3 * 24 * 60 * 60 * 1000

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateTime(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('uz-UZ')
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} soat ${m} daqiqa`
  return `${m} daqiqa`
}

function formatLastSeenText(value?: string) {
  if (!value) return 'Oxirgi marta: -'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Oxirgi marta: -'

  const now = new Date()
  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate()

  const timePart = date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
  if (isSameDay) return `Oxirgi marta: Bugun ${timePart} da kirdi`
  return `Oxirgi marta: ${date.toLocaleString('uz-UZ')} da kirdi`
}

export default function ActivityMonitorPage() {
  const router = useRouter()
  const { currentAdmin } = useApp()

  const today = new Date()
  const defaultTo = toDateInputValue(today)
  const defaultFromDate = new Date(today)
  defaultFromDate.setDate(defaultFromDate.getDate() - 30)
  const defaultFrom = toDateInputValue(defaultFromDate)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<ActivityResponse | null>(null)

  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [role, setRole] = useState('')
  const [group, setGroup] = useState('')
  const [search, setSearch] = useState('')
  const [activePanel, setActivePanel] = useState<'users' | 'online' | 'today' | 'inactive' | 'rate' | null>('today')
  const [rateTab, setRateTab] = useState<'parents' | 'students'>('parents')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    if (role) params.set('role', role)
    if (group) params.set('group', group)
    if (search.trim()) params.set('search', search.trim())
    return params.toString()
  }, [from, to, role, group, search])

  const loadActivity = useCallback(async () => {
    if (!currentAdmin?.id) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/activity${queryString ? `?${queryString}` : ''}`, {
        headers: {
          'x-admin-id': String(currentAdmin.id),
        },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(String(result?.error || 'Faollikni yuklashda xatolik'))
      setData(result)
    } catch (loadError: any) {
      setError(String(loadError?.message || 'Faollikni yuklashda xatolik'))
    } finally {
      setLoading(false)
    }
  }, [currentAdmin?.id, queryString])

  useEffect(() => {
    if (!currentAdmin) {
      router.replace('/')
      return
    }
    loadActivity()
  }, [currentAdmin, router, loadActivity])

  useEffect(() => {
    if (!currentAdmin?.id) return
    const timer = setInterval(() => {
      loadActivity()
    }, 30_000)
    return () => clearInterval(timer)
  }, [currentAdmin?.id, loadActivity])

  const applyQuickRange = (days: number) => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - days)
    setFrom(toDateInputValue(start))
    setTo(toDateInputValue(end))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-zinc-900 text-amber-50">
      <header className="sticky top-0 z-40 border-b border-amber-500/30 bg-black/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10"
            >
              <ArrowLeft className="w-4 h-4" />
              Orqaga
            </button>
            <div>
              <h1 className="text-xl font-bold text-amber-300">Foydalanuvchilar Faolligi</h1>
              <p className="text-xs text-zinc-400">Login loglar, online holat, inactive ogohlantirish</p>
            </div>
          </div>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
            Kevin Monitor
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { key: 'users' as const, label: 'Jami user', value: data?.summary.totalUsers || 0, icon: Users },
            { key: 'online' as const, label: 'Online hozir', value: data?.summary.onlineNow || 0, icon: Activity },
            { key: 'today' as const, label: 'Bugun login', value: data?.summary.loginsToday || 0, icon: Clock3 },
            { key: 'inactive' as const, label: '3+ kun nofaol', value: data?.summary.inactiveCount || 0, icon: ShieldAlert },
            { key: 'rate' as const, label: 'Parent login rate', value: `${data?.summary.parentLoginRate || 0}%`, icon: Activity },
          ].map((card) => (
            <motion.button
              type="button"
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setActivePanel(card.key)}
              className={`text-left rounded-xl border p-4 shadow-[0_0_25px_rgba(245,158,11,0.08)] transition-all ${activePanel === card.key ? 'border-amber-300 bg-zinc-800/90 ring-1 ring-amber-400/40' : 'border-amber-500/35 bg-zinc-900/70 hover:border-amber-400/60'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">{card.label}</p>
                <card.icon className="w-4 h-4 text-amber-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-200">{card.value}</p>
            </motion.button>
          ))}
        </section>

        <section className="rounded-2xl border border-amber-500/35 bg-zinc-900/70 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-amber-300">
              {activePanel === 'users' ? 'Barcha foydalanuvchilar (last seen)' :
               activePanel === 'online' ? 'Hozir online foydalanuvchilar' :
               activePanel === 'inactive' ? '3+ kun nofaol foydalanuvchilar' :
               activePanel === 'rate' ? 'Faollik reytingi (ota-ona / o‘quvchi)' :
              'Tanlangan davr bo‘yicha loginlar'}
            </h2>

            {activePanel === 'rate' ? (
              <div className="inline-flex rounded-lg border border-amber-500/35 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRateTab('parents')}
                  className={`px-3 py-1.5 text-xs ${rateTab === 'parents' ? 'bg-amber-500/20 text-amber-200' : 'bg-black/30 text-zinc-300'}`}
                >
                  Ota-onalar
                </button>
                <button
                  type="button"
                  onClick={() => setRateTab('students')}
                  className={`px-3 py-1.5 text-xs border-l border-amber-500/35 ${rateTab === 'students' ? 'bg-amber-500/20 text-amber-200' : 'bg-black/30 text-zinc-300'}`}
                >
                  O‘quvchilar
                </button>
              </div>
            ) : null}
          </div>

          {activePanel === 'rate' ? (
            (rateTab === 'parents' ? (data?.rankings?.parents || []) : (data?.rankings?.students || [])).length === 0 ? (
              <p className="text-sm text-zinc-400">Reyting uchun ma'lumot yo‘q.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-amber-500/20">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-400 border-b border-amber-500/20 bg-black/30">
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Foydalanuvchi</th>
                      <th className="py-2 px-3">Guruh</th>
                      <th className="py-2 px-3">Login soni</th>
                      <th className="py-2 px-3">Oxirgi login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rateTab === 'parents' ? (data?.rankings?.parents || []) : (data?.rankings?.students || [])).map((row, index) => (
                      <tr key={row.key} className="border-b border-zinc-800/70">
                        <td className="py-2 px-3 text-zinc-300">{index + 1}</td>
                        <td className="py-2 px-3 text-amber-100">{row.fullName} <span className="text-zinc-500 text-xs">(ID: {row.userId})</span></td>
                        <td className="py-2 px-3 text-zinc-300">{row.group}</td>
                        <td className="py-2 px-3 text-amber-200 font-semibold">{row.loginCount}</td>
                        <td className="py-2 px-3 text-zinc-300">{formatDateTime(row.lastLoginAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            (() => {
              const rows = activePanel === 'users'
                ? [...(data?.notLoggedToday || []), ...(data?.inactiveUsers || [])]
                : activePanel === 'online'
                ? (data?.rows || []).filter((row) => row.online)
                : activePanel === 'inactive'
                ? (data?.inactiveUsers || [])
                : (data?.todayLogins || [])

              if (!rows.length) {
                return <p className="text-sm text-zinc-400">Bu bo‘limda hozircha ma'lumot yo‘q.</p>
              }

              if (activePanel === 'inactive' || activePanel === 'users') {
                return (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {(rows as LatestUserState[]).slice(0, 60).map((user) => (
                      <div key={user.key} className="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2">
                        <p className="text-sm text-amber-100 inline-flex items-center gap-1.5">
                          <span className={`inline-block h-2 w-2 rounded-full ${user.online ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                          {user.fullName} {activePanel === 'inactive' ? '⚠️' : ''}
                        </p>
                        <p className="text-xs text-zinc-400">{user.role} • {user.group} • ID: {user.userId}</p>
                        <p className="text-xs text-zinc-500">Oxirgi kirish: {formatDateTime(user.lastSeenAt)}</p>
                      </div>
                    ))}
                  </div>
                )
              }

              return (
                <div className="overflow-x-auto rounded-xl border border-amber-500/20">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-400 border-b border-amber-500/20 bg-black/30">
                        <th className="py-2 px-3">Foydalanuvchi</th>
                        <th className="py-2 px-3">Role/Guruh</th>
                        <th className="py-2 px-3">Login vaqti</th>
                        <th className="py-2 px-3">Holat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rows as ActivityRow[]).slice(0, 80).map((row) => (
                        <tr key={`${row.id}-${row.sessionId}`} className="border-b border-zinc-800/70">
                          <td className="py-2 px-3 text-amber-100">{row.fullName} <span className="text-zinc-500 text-xs">(ID: {row.userId})</span></td>
                          <td className="py-2 px-3 text-zinc-300">{row.role} • {row.group}</td>
                          <td className="py-2 px-3 text-zinc-300">{formatDateTime(row.loginAt)}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs border ${row.online ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : 'text-zinc-300 border-zinc-600 bg-zinc-800/60'}`}>
                              {row.online ? 'online' : 'offline'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()
          )}
        </section>

        <section className="rounded-2xl border border-amber-500/35 bg-zinc-900/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400 mr-1">Tezkor davr:</span>
            <button
              type="button"
              onClick={() => applyQuickRange(0)}
              className="rounded-md border border-amber-500/35 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/10"
            >
              Bugun
            </button>
            <button
              type="button"
              onClick={() => applyQuickRange(7)}
              className="rounded-md border border-amber-500/35 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/10"
            >
              Oxirgi 7 kun
            </button>
            <button
              type="button"
              onClick={() => applyQuickRange(30)}
              className="rounded-md border border-amber-500/35 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-500/10"
            >
              Oxirgi 30 kun
            </button>
            <button
              type="button"
              onClick={() => {
                setFrom('')
                setTo('')
              }}
              className="rounded-md border border-zinc-600 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
            >
              Barcha tarix
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-amber-500/30 bg-black/50 px-3 py-2 text-sm" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-amber-500/30 bg-black/50 px-3 py-2 text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-lg border border-amber-500/30 bg-black/50 px-3 py-2 text-sm">
              <option value="">Barcha rollar</option>
              <option value="student">Student</option>
              <option value="parent">Parent</option>
            </select>
            <select value={group} onChange={(e) => setGroup(e.target.value)} className="rounded-lg border border-amber-500/30 bg-black/50 px-3 py-2 text-sm">
              <option value="">Barcha guruhlar</option>
              {(data?.groups || []).map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ism yoki ID bo‘yicha qidirish"
              className="rounded-lg border border-amber-500/30 bg-black/50 px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-zinc-500">
            Sana + Guruh + Ism/ID orqali kim qachon kirganini tarix bo‘yicha ko‘rishingiz mumkin.
          </p>
          <div className="flex justify-end">
            <button onClick={loadActivity} className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/20">
              Filtrni qo'llash
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-2xl border border-amber-500/35 bg-zinc-900/70 p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-amber-300 mb-3">Login jurnali</h2>
            {loading ? (
              <p className="text-sm text-zinc-400">Yuklanmoqda...</p>
            ) : error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : (data?.rows || []).length === 0 ? (
              <p className="text-sm text-zinc-400">Log topilmadi</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-400 border-b border-amber-500/20">
                    <th className="py-2 pr-3">Foydalanuvchi</th>
                    <th className="py-2 pr-3">Role/Guruh</th>
                    <th className="py-2 pr-3">Login</th>
                    <th className="py-2 pr-3">Last seen</th>
                    <th className="py-2 pr-3">Device/IP</th>
                    <th className="py-2 pr-3">Sessiya</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.rows || []).map((row) => {
                    const lastSeenTs = new Date(row.lastSeenAt).getTime()
                    const isInactive = Number.isFinite(lastSeenTs) && Date.now() - lastSeenTs >= INACTIVE_MS

                    return (
                    <tr key={row.id} className="border-b border-zinc-800/70">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-amber-100 inline-flex items-center gap-1.5">
                          <span className={`inline-block h-2 w-2 rounded-full ${row.online ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                          {row.fullName}
                          {isInactive ? <span title="3+ kun nofaol">⚠️</span> : null}
                        </p>
                        <p className="text-xs text-zinc-500">ID: {row.userId}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <p className="text-zinc-200">{row.role}</p>
                        <p className="text-xs text-zinc-500">{row.group}</p>
                      </td>
                      <td className="py-2 pr-3 text-zinc-300">{formatDateTime(row.loginAt)}</td>
                      <td className="py-2 pr-3">
                        <p className="text-zinc-300">{formatDateTime(row.lastSeenAt)}</p>
                        <p className="text-[11px] text-zinc-500 mt-1">{formatLastSeenText(row.lastSeenAt)}</p>
                        <span className={`inline-flex mt-1 items-center rounded-full px-2 py-0.5 text-xs border ${row.online ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10' : 'text-zinc-300 border-zinc-600 bg-zinc-800/60'}`}>
                          {row.online ? 'online' : 'offline'}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <p className="text-zinc-300">{row.deviceType}</p>
                        <p className="text-xs text-zinc-500">{row.ipAddress}</p>
                      </td>
                      <td className="py-2 pr-3">
                        <p className="text-zinc-300">{formatDuration(row.durationSeconds)}</p>
                        <p className="text-xs text-zinc-500">{row.sessionId.slice(0, 8)}...</p>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-red-500/35 bg-red-950/25 p-4">
              <h3 className="text-sm font-semibold text-red-300 mb-2">⚠️ 3+ kun nofaol</h3>
              {(data?.inactiveUsers || []).length === 0 ? (
                <p className="text-sm text-zinc-300">Nofaol user yo'q</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {(data?.inactiveUsers || []).slice(0, 20).map((user) => (
                    <div key={user.key} className="rounded-lg border border-red-500/30 bg-black/30 px-3 py-2">
                      <p className="text-sm text-red-100">{user.fullName}</p>
                      <p className="text-xs text-red-300">{user.role} • {user.group}</p>
                      <p className="text-xs text-zinc-400">Oxirgi kirish: {formatDateTime(user.lastSeenAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-amber-500/35 bg-zinc-900/70 p-4">
              <h3 className="text-sm font-semibold text-amber-300 mb-2">🤖 Kevin AI Weekly Diagnostic</h3>
              <ul className="space-y-2 text-sm text-zinc-200">
                {(data?.aiReport || []).map((line, index) => (
                  <li key={`${index}-${line}`} className="leading-relaxed">• {line}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
