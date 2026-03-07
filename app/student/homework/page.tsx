'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, CalendarClock, Clock3, Eye, FileText, Link as LinkIcon, AlertCircle } from 'lucide-react'
import { useApp } from '@/lib/app-context'

type StudentTask = {
  id: number
  title: string
  group: string
  contentHtml: string
  contentText: string
  deadlineAt?: string | null
  sentAt: string
  status: 'active' | 'expired'
  attachmentUrl?: string | null
  attachmentType?: string | null
  isRead: boolean
}

export default function StudentHomeworkPage() {
  const router = useRouter()
  const { currentStudent, t } = useApp()

  const [student, setStudent] = useState<any>(null)
  const [tasks, setTasks] = useState<StudentTask[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null)

  useEffect(() => {
    if (currentStudent) {
      setStudent(currentStudent)
      return
    }

    const stored = localStorage.getItem('currentStudent')
    if (!stored) {
      router.replace('/')
      return
    }

    try {
      setStudent(JSON.parse(stored))
    } catch {
      localStorage.removeItem('currentStudent')
      router.replace('/')
    }
  }, [currentStudent, router])

  useEffect(() => {
    if (!student?.id) return
    void loadTasks(student)
  }, [student])

  const loadTasks = async (studentValue: any) => {
    setLoading(true)
    const adminId = String(studentValue?.adminId || '').trim()
    if (!adminId) {
      setTasks([])
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/tasks?mode=student&studentId=${encodeURIComponent(String(studentValue.id))}`, {
        headers: {
          'x-admin-id': adminId,
        },
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(String(payload?.error || 'Tasklarni yuklab bo‘lmadi'))
      }
      setTasks(Array.isArray(payload) ? payload : [])
    } catch (error) {
      console.error('Student tasks load error:', error)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (taskId: number) => {
    if (!student?.id || !student?.adminId) return
    try {
      await fetch('/api/tasks/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': String(student.adminId),
        },
        body: JSON.stringify({
          taskId,
          studentId: Number(student.id),
        }),
      })

      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, isRead: true } : task)))
    } catch (error) {
      console.error('Task read receipt error:', error)
    }
  }

  const toggleTask = async (taskId: number) => {
    const next = expandedTaskId === taskId ? null : taskId
    setExpandedTaskId(next)

    if (next) {
      const target = tasks.find((task) => task.id === taskId)
      if (target && !target.isRead) {
        await markAsRead(taskId)
      }
    }
  }

  const activeCount = useMemo(() => tasks.filter((task) => task.status === 'active').length, [tasks])
  const expiredCount = useMemo(() => tasks.filter((task) => task.status === 'expired').length, [tasks])

  if (!student) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-amber-500/20 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <button onClick={() => router.push('/student')} className="flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
              <ArrowLeft className="h-4 w-4" />
              <span>{t('back_to_dashboard')}</span>
            </button>
            <h1 className="text-xl font-bold text-amber-300">My Tasks</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200">Active</p>
            <p className="mt-1 text-3xl font-bold text-emerald-100">{activeCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5">
            <p className="text-sm text-rose-200">Expired</p>
            <p className="mt-1 text-3xl font-bold text-rose-100">{expiredCount}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-400">Yuklanmoqda...</p>
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-zinc-700 bg-zinc-900/60 p-10 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-zinc-500" />
            <h3 className="text-lg font-semibold text-zinc-200">Vazifalar topilmadi</h3>
            <p className="text-sm text-zinc-400">Sizning darajangiz uchun hozircha yangi topshiriq yo‘q.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task, index) => {
              const expanded = expandedTaskId === task.id
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-5 shadow-2xl shadow-black/40"
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-amber-300">{task.title}</h2>
                      <p className="text-xs text-zinc-400">{task.group}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.status === 'expired' && <AlertCircle className="h-4 w-4 text-rose-300" />}
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${task.status === 'expired' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {task.status === 'expired' ? 'Expired' : 'Active'}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs ${task.isRead ? 'bg-blue-500/20 text-blue-300' : 'bg-zinc-700 text-zinc-200'}`}>
                        {task.isRead ? 'Opened' : 'New'}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Yuborilgan: {new Date(task.sentAt).toLocaleString('uz-UZ')}</span>
                    <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Muddat: {task.deadlineAt ? new Date(task.deadlineAt).toLocaleString('uz-UZ') : '-'}</span>
                    {task.attachmentUrl && (
                      <a href={task.attachmentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-amber-300 underline">
                        <LinkIcon className="h-3.5 w-3.5" /> Biriktirma
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => void toggleTask(task.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {expanded ? 'Yopish' : 'Batafsil ko‘rish'}
                  </button>

                  {expanded && (
                    <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-900/70 p-4 text-sm text-zinc-200">
                      <div dangerouslySetInnerHTML={{ __html: task.contentHtml || task.contentText || '-' }} />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
