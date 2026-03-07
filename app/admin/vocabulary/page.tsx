/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Brain, Check, RefreshCw, Users, X } from 'lucide-react'
import { getGroups } from '@/lib/storage'
import { useApp } from '@/lib/app-context'

type LiveRow = {
  studentId: number
  studentName: string
  group: string
  totalWords: number
  masteredWords: number
  dueWords: number
  progressPercent: number
  nextReviewAt?: string | null
  lastAttemptAt?: string | null
}

export default function AdminVocabularyPage() {
  const router = useRouter()
  const { currentAdmin } = useApp()

  const [groups, setGroups] = useState<Array<{ name: string }>>([])
  const [selectedGroup, setSelectedGroup] = useState('')

  const [loadingLive, setLoadingLive] = useState(false)
  const [livePercent, setLivePercent] = useState(0)
  const [liveRows, setLiveRows] = useState<LiveRow[]>([])

  const [loadingPending, setLoadingPending] = useState(false)
  const [pendingRows, setPendingRows] = useState<any[]>([])

  const loadGroups = useCallback(async () => {
    const data = await getGroups()
    setGroups(Array.isArray(data) ? data.map((item: any) => ({ name: String(item?.name || '') })).filter((item) => item.name) : [])
  }, [])

  const loadLive = useCallback(async () => {
    if (!currentAdmin?.id) return
    setLoadingLive(true)
    try {
      const query = selectedGroup ? `?group=${encodeURIComponent(selectedGroup)}` : ''
      const response = await fetch(`/api/admin/vocabulary/live${query}`, {
        headers: { 'x-admin-id': String(currentAdmin.id) },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload?.error || 'Live progress xatoligi'))
      setLivePercent(Number(payload?.livePercent || 0))
      setLiveRows(Array.isArray(payload?.rows) ? payload.rows : [])
    } catch {
      setLivePercent(0)
      setLiveRows([])
    } finally {
      setLoadingLive(false)
    }
  }, [currentAdmin?.id, selectedGroup])

  const loadPending = useCallback(async () => {
    if (!currentAdmin?.id) return
    setLoadingPending(true)
    try {
      const response = await fetch('/api/admin/vocabulary/peer-pending?status=pending', {
        headers: { 'x-admin-id': String(currentAdmin.id) },
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload?.error || 'Pending load error'))
      setPendingRows(Array.isArray(payload) ? payload : [])
    } catch {
      setPendingRows([])
    } finally {
      setLoadingPending(false)
    }
  }, [currentAdmin?.id])

  useEffect(() => {
    if (!currentAdmin) {
      router.replace('/')
      return
    }
    loadGroups()
  }, [currentAdmin, loadGroups, router])

  useEffect(() => {
    loadLive()
  }, [loadLive])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  const approve = async (scoreId: number, approved: boolean) => {
    if (!currentAdmin?.id) return
    const reviewNote = window.prompt(approved ? 'Tasdiq izohi (ixtiyoriy)' : 'Rad etish sababi') || ''
    const response = await fetch('/api/vocabulary/peer/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-id': String(currentAdmin.id),
      },
      body: JSON.stringify({ scoreId, approved, reviewNote }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      alert(String(payload?.error || 'Tasdiqlashda xatolik'))
      return
    }
    await loadPending()
  }

  const completionMeta = useMemo(() => {
    const total = liveRows.length
    const high = liveRows.filter((row) => Number(row.progressPercent || 0) >= 80).length
    return { total, high }
  }, [liveRows])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-red-900/20 dark:to-slate-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200">
            <ArrowLeft className="w-4 h-4" /> Orqaga
          </button>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white inline-flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" /> Vocabulary Live Panel
          </h1>
          <button onClick={() => { loadLive(); loadPending() }} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-700 dark:text-indigo-300">
            <RefreshCw className="w-4 h-4" /> Yangilash
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-gray-500">Live mastery (guruh bo‘yicha)</p>
              <p className="text-3xl font-bold text-indigo-600">{livePercent}%</p>
              <p className="text-xs text-gray-500 mt-1">80%+ ga yetganlar: {completionMeta.high}/{completionMeta.total}</p>
            </div>

            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <select
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value)}
                className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
              >
                <option value="">Barcha guruhlar</option>
                {groups.map((group) => (
                  <option key={group.name} value={group.name}>{group.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700 text-gray-500">
                  <th className="py-2">Student</th>
                  <th className="py-2">Group</th>
                  <th className="py-2">Mastered</th>
                  <th className="py-2">Due</th>
                  <th className="py-2">Progress</th>
                  <th className="py-2">Last quiz</th>
                </tr>
              </thead>
              <tbody>
                {loadingLive ? (
                  <tr><td className="py-3 text-gray-500" colSpan={6}>Yuklanmoqda...</td></tr>
                ) : liveRows.length === 0 ? (
                  <tr><td className="py-3 text-gray-500" colSpan={6}>Ma’lumot topilmadi</td></tr>
                ) : liveRows.map((row) => (
                  <tr key={row.studentId} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{row.studentName}</td>
                    <td className="py-2 text-gray-600 dark:text-gray-300">{row.group || '-'}</td>
                    <td className="py-2 text-gray-600 dark:text-gray-300">{row.masteredWords}/{row.totalWords}</td>
                    <td className="py-2 text-amber-600">{row.dueWords}</td>
                    <td className="py-2">
                      <div className="w-28 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full bg-indigo-600" style={{ width: `${Math.max(0, Math.min(100, row.progressPercent || 0))}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{row.progressPercent}%</span>
                    </td>
                    <td className="py-2 text-xs text-gray-500">{row.lastAttemptAt ? new Date(row.lastAttemptAt).toLocaleString('uz-UZ') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Peer-check tasdiqlash</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700 text-gray-500">
                  <th className="py-2">Vaqt</th>
                  <th className="py-2">Student</th>
                  <th className="py-2">Partner</th>
                  <th className="py-2">Ball</th>
                  <th className="py-2">Recording</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingPending ? (
                  <tr><td className="py-3 text-gray-500" colSpan={6}>Yuklanmoqda...</td></tr>
                ) : pendingRows.length === 0 ? (
                  <tr><td className="py-3 text-gray-500" colSpan={6}>Tasdiq kutayotgan natija yo‘q</td></tr>
                ) : pendingRows.map((row) => {
                  const peer = row?.breakdown?.peerChecking || {}
                  return (
                    <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 text-xs text-gray-500">{row.createdAt ? new Date(row.createdAt).toLocaleString('uz-UZ') : '-'}</td>
                      <td className="py-2 font-medium text-gray-900 dark:text-gray-100">{peer.studentName || row.studentId || '-'}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-300">{peer.partnerName || '-'}</td>
                      <td className="py-2 text-indigo-600 font-semibold">{Math.round(Number(row.value || 0))}</td>
                      <td className="py-2">
                        {peer.recordingUrl ? (
                          <a href={peer.recordingUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Open</a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => approve(Number(row.id), true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 text-white px-2 py-1 text-xs">
                            <Check className="w-3.5 h-3.5" /> Tasdiqlash
                          </button>
                          <button onClick={() => approve(Number(row.id), false)} className="inline-flex items-center gap-1 rounded-lg bg-red-600 text-white px-2 py-1 text-xs">
                            <X className="w-3.5 h-3.5" /> Rad etish
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
