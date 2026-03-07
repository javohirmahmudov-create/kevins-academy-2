'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { upload } from '@vercel/blob/client'
import { ArrowLeft, Send, CalendarClock, Paperclip, Eye, Users, Clock3, Sparkles } from 'lucide-react'
import { useApp } from '@/lib/app-context'

type AdminTask = {
  id: number
  title: string
  group: string
  contentHtml: string
  deadlineAt?: string | null
  sentAt: string
  status: 'active' | 'expired'
  attachmentUrl?: string | null
  attachmentType?: string | null
  deliveryCount: number
  readCount: number
  openRate: number
  analytics: {
    targetedStudents: number
    telegramTargetedChats: number
    telegramDeliveredChats: number
    telegramFailedChats: number
  }
}

type GroupOption = {
  name: string
  telegramChatId?: string | null
}

const DEFAULT_GROUPS = ['PRE IELTS', 'CEFR', 'BEGINNER']

const normalizeGroupName = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')

const pickTaskEmoji = (title: string) => {
  const normalized = String(title || '').toLowerCase()
  if (normalized.includes('writing')) return '📝'
  if (normalized.includes('reading')) return '📖'
  if (normalized.includes('listening')) return '🎧'
  if (normalized.includes('speaking')) return '🗣️'
  if (normalized.includes('grammar')) return '🧠'
  if (normalized.includes('vocabulary')) return '📚'
  if (normalized.includes('ielts')) return '🎯'
  return '✅'
}

const htmlToPlainText = (html: string) =>
  String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<\s*\/div\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n• ')
    .replace(/<\s*\/li\s*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const toDeadlineLabel = (value?: string) => {
  if (!value) return 'Belgilanmagan'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Belgilanmagan'

  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear())
  const hh = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}`
}

const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const buildProfessionalTaskHtml = (input: {
  title: string
  deadline?: string
  bodyText: string
}) => {
  const safeTitle = String(input.title || '').trim() || 'TASK'
  const heading = `${pickTaskEmoji(safeTitle)} ${safeTitle.toUpperCase()}`

  const rawLines = String(input.bodyText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const instructionLines = rawLines.length > 0
    ? rawLines
    : [
        'Darsdagi asosiy qoidalarni qayta ko‘rib chiqing.',
        'Berilgan mavzu bo‘yicha topshiriqni bosqichma-bosqich bajaring.',
        'Natijani tekshirib, xatolarni tuzatib yuboring.',
      ]

  const lineMarkup = instructionLines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')

  const deadlineLabel = toDeadlineLabel(input.deadline)

  return [
    `<p><strong>${escapeHtml(heading)}</strong></p>`,
    '<p>Bugungi darsimizni mustahkamlash uchun quyidagi topshiriqlarni bajaring.</p>',
    '<p><strong>Topshiriq yo‘riqnomasi:</strong></p>',
    lineMarkup,
    '<p><strong>Akademik uslub:</strong> IELTS/CEFR darajasiga mos, aniq va mantiqiy ifodalardan foydalaning.</p>',
    `<p>⏳ <strong>Deadline:</strong> ${escapeHtml(deadlineLabel)}</p>`,
    '<p><em>Savollar bo‘lsa, guruhda yozishingiz mumkin.</em></p>',
  ].join('')
}

const buildProfessionalTaskText = (input: {
  title: string
  deadline?: string
  bodyText: string
}) => {
  const safeTitle = String(input.title || '').trim() || 'TASK'
  const heading = `${pickTaskEmoji(safeTitle)} ${safeTitle.toUpperCase()}`
  const deadlineLabel = toDeadlineLabel(input.deadline)

  const rawLines = String(input.bodyText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const instructionLines = rawLines.length > 0
    ? rawLines
    : [
        'Darsdagi asosiy qoidalarni qayta ko‘rib chiqing.',
        'Berilgan mavzu bo‘yicha topshiriqni bosqichma-bosqich bajaring.',
        'Natijani tekshirib, xatolarni tuzatib yuboring.',
      ]

  const listed = instructionLines.map((line) => `• ${line}`)

  return [
    heading,
    '',
    'Bugungi darsimizni mustahkamlash uchun quyidagi topshiriqlarni bajaring.',
    '',
    'Topshiriq yo‘riqnomasi:',
    ...listed,
    '',
    'Akademik uslub: IELTS/CEFR darajasiga mos, aniq va mantiqiy ifodalardan foydalaning.',
    `⏳ Deadline: ${deadlineLabel}`,
    'Savollar bo‘lsa, guruhda yozishingiz mumkin.',
  ].join('\n')
}

const buildAttachmentHtmlBlock = (input: {
  fileName: string
  fileUrl: string
  extractedText?: string
  comment?: string
}) => {
  const title = escapeHtml(input.fileName || 'Material')
  const note = String(input.comment || '').trim()
  const summary = String(input.extractedText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 16)

  return [
    '<hr />',
    `<p><strong>📎 Material:</strong> <a href="${input.fileUrl}" target="_blank" rel="noreferrer">${title}</a></p>`,
    note ? `<p><strong>💬 Izoh:</strong> ${escapeHtml(note)}</p>` : '',
    summary.length
      ? ['<p><strong>📄 Fayl ichidagi asosiy ma’lumot:</strong></p>', ...summary.map((line) => `<p>• ${escapeHtml(line)}</p>`)].join('')
      : '<p><em>Fayl biriktirildi. Batafsil ko‘rish uchun linkdan oching.</em></p>',
  ].filter(Boolean).join('')
}

export default function AdminTasksPage() {
  const router = useRouter()
  const { currentAdmin } = useApp()
  const editorRef = useRef<HTMLDivElement | null>(null)

  const [groupOptions, setGroupOptions] = useState<GroupOption[]>([])
  const [tasks, setTasks] = useState<AdminTask[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadDragOver, setUploadDragOver] = useState(false)

  const [selectedGroup, setSelectedGroup] = useState('')
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [attachmentType, setAttachmentType] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentComment, setAttachmentComment] = useState('')

  useEffect(() => {
    if (!currentAdmin) {
      router.replace('/')
      return
    }
    void bootstrap()
  }, [currentAdmin, router])

  const bootstrap = async () => {
    setLoading(true)
    try {
      const [groupsRes, tasksRes] = await Promise.all([
        fetch('/api/groups', {
          headers: { 'x-admin-id': String(currentAdmin?.id || '') },
        }),
        fetch('/api/tasks', {
          headers: { 'x-admin-id': String(currentAdmin?.id || '') },
        }),
      ])

      const groupsData = await groupsRes.json()
      const tasksData = await tasksRes.json()

      const liveGroups = Array.isArray(groupsData)
        ? groupsData
            .map((group: any) => ({
              name: String(group?.name || '').trim(),
              telegramChatId: String(group?.telegramChatId || '').trim() || null,
            }))
            .filter((group: GroupOption) => Boolean(group.name))
        : []

      const merged = new Map<string, GroupOption>()
      for (const group of liveGroups) {
        merged.set(normalizeGroupName(group.name), group)
      }

      if (merged.size === 0) {
        for (const name of DEFAULT_GROUPS) {
          merged.set(normalizeGroupName(name), { name, telegramChatId: null })
        }
      }

      const mergedGroups = Array.from(merged.values())
      setGroupOptions(mergedGroups)
      if (!mergedGroups.some((group) => normalizeGroupName(group.name) === normalizeGroupName(selectedGroup))) {
        setSelectedGroup(mergedGroups[0]?.name || '')
      }

      setTasks(Array.isArray(tasksData) ? tasksData : [])
    } catch (error) {
      console.error('Task dispatcher bootstrap error:', error)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const runEditorCommand = (command: string, value?: string) => {
    if (!editorRef.current) return
    editorRef.current.focus()
    document.execCommand(command, false, value)
  }

  const onAddLink = () => {
    const url = prompt('Link kiriting (https://...)')
    if (!url) return
    runEditorCommand('createLink', url)
  }

  const applyProfessionalTemplate = () => {
    if (!editorRef.current) return
    const bodyText = String(editorRef.current.innerText || '').trim()
    const professionalHtml = buildProfessionalTaskHtml({
      title,
      deadline,
      bodyText,
    })
    editorRef.current.innerHTML = professionalHtml
  }

  const onAttachmentUpload = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/materials/upload',
      })
      setAttachmentUrl(blob.url)
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      setAttachmentType(
        ext === 'pdf'
          ? 'pdf'
          : ext === 'html' || ext === 'htm'
            ? 'html'
            : file.type.startsWith('image/')
              ? 'image'
              : 'file'
      )
      setAttachmentName(file.name)
    } catch (error) {
      console.error('Attachment upload failed:', error)
      alert('Fayl yuklashda xatolik')
    } finally {
      setUploading(false)
      setUploadDragOver(false)
    }
  }

  const onAttachmentDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setUploadDragOver(false)
    const file = event.dataTransfer?.files?.[0] || null
    await onAttachmentUpload(file)
  }

  const insertAttachmentIntoEditor = () => {
    if (!editorRef.current || !attachmentUrl) return
    void (async () => {
      let extractedText = ''
      try {
        if (attachmentType === 'pdf' || attachmentType === 'html' || attachmentType === 'image') {
          const res = await fetch('/api/tasks/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileUrl: attachmentUrl,
              fileType: attachmentType,
              fileName: attachmentName,
            }),
          })
          const data = await res.json().catch(() => null)
          extractedText = String(data?.extractedText || '').trim()
        }
      } catch {
        extractedText = ''
      }

      editorRef.current?.focus()
      if (attachmentType === 'image') {
        document.execCommand('insertHTML', false, buildAttachmentHtmlBlock({
          fileName: attachmentName || 'image',
          fileUrl: attachmentUrl,
          extractedText,
          comment: attachmentComment,
        }))
        document.execCommand('insertImage', false, attachmentUrl)
        return
      }

      document.execCommand('insertHTML', false, buildAttachmentHtmlBlock({
        fileName: attachmentName || 'material',
        fileUrl: attachmentUrl,
        extractedText,
        comment: attachmentComment,
      }))
    })()
  }

  const sendTask = async () => {
    const rawContentHtml = String(editorRef.current?.innerHTML || '').trim()
    const rawContentText = String(editorRef.current?.innerText || '').trim()

    if (!title.trim() || !selectedGroup.trim() || (!rawContentHtml && !rawContentText)) {
      alert('Sarlavha, guruh va vazifa matnini to‘ldiring')
      return
    }

    const professionalContentHtml = buildProfessionalTaskHtml({
      title,
      deadline,
      bodyText: rawContentText || htmlToPlainText(rawContentHtml),
    })
    const professionalContentText = buildProfessionalTaskText({
      title,
      deadline,
      bodyText: rawContentText || htmlToPlainText(rawContentHtml),
    })

    if (editorRef.current) {
      editorRef.current.innerHTML = professionalContentHtml
    }

    const selected = groupOptions.find((item) => normalizeGroupName(item.name) === normalizeGroupName(selectedGroup))
    if (!selected?.telegramChatId) {
      alert('Ushbu guruhga Telegram ID ulanmagan. Iltimos, sozlamalardan ID qo\'shing')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': String(currentAdmin?.id || ''),
        },
        body: JSON.stringify({
          group: selectedGroup,
          title,
          contentHtml: professionalContentHtml,
          contentText: professionalContentText,
          deadlineAt: deadline || null,
          attachmentUrl: attachmentUrl || null,
          attachmentType: attachmentType || null,
          attachmentComment: attachmentComment || null,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(String(payload?.error || 'Vazifani yuborib bo‘lmadi'))
      }

      const delivered = Number(payload?.delivery?.telegramDeliveredChats || 0)
      const targeted = Number(payload?.delivery?.telegramTargetedChats || 0)

      setTitle('')
      setDeadline('')
      setAttachmentUrl('')
      setAttachmentType('')
      setAttachmentName('')
      setAttachmentComment('')
      if (editorRef.current) editorRef.current.innerHTML = ''

      await bootstrap()

      if (payload?.warning) {
        alert(`${String(payload.warning)}\nStudent panelga saqlandi.`)
      } else {
        alert(`Vazifa yuborildi ✅ Telegram: ${delivered}/${targeted} | Student panel: OK`)
      }
    } catch (error: any) {
      alert(String(error?.message || 'Vazifani yuborishda xatolik'))
    } finally {
      setSending(false)
    }
  }

  const activeCount = useMemo(() => tasks.filter((task) => task.status === 'active').length, [tasks])
  const selectedGroupMeta = useMemo(
    () => groupOptions.find((item) => normalizeGroupName(item.name) === normalizeGroupName(selectedGroup)) || null,
    [groupOptions, selectedGroup]
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900 text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-amber-500/20 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/admin')} className="rounded-lg border border-zinc-700 p-2 hover:bg-zinc-800">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-amber-300">Task Dispatcher</h1>
                <p className="text-xs text-zinc-400">Telegram guruh + Student panel professional delivery</p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-right">
              <p className="text-xs text-zinc-400">Active Tasks</p>
              <p className="text-lg font-bold text-amber-300">{activeCount}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-5 lg:px-8">
        <section className="lg:col-span-2 rounded-2xl border border-amber-500/20 bg-zinc-900/80 p-5 shadow-2xl shadow-black/40">
          <div className="mb-4 flex items-center gap-2 text-amber-300">
            <Sparkles className="h-4 w-4" />
            <p className="text-sm font-semibold">New Task</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Group Selection</label>
              <select
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              >
                {groupOptions.map((group) => (
                  <option key={group.name} value={group.name}>{group.name}</option>
                ))}
              </select>
              {!selectedGroupMeta?.telegramChatId ? (
                <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                  Ushbu guruhga Telegram ID ulanmagan. Iltimos, sozlamalardan ID qo'shing
                </p>
              ) : (
                <p className="mt-2 text-xs text-emerald-300">Telegram ulangan: {selectedGroupMeta.telegramChatId}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">Mavzu (Title)</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Masalan: Writing Task 2 - Education"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">Rich Text Editor</label>
              <div className="mb-2 flex flex-wrap gap-2">
                <button onClick={() => runEditorCommand('bold')} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">B</button>
                <button onClick={() => runEditorCommand('italic')} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">I</button>
                <button onClick={() => runEditorCommand('insertUnorderedList')} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">• List</button>
                <button onClick={() => runEditorCommand('insertOrderedList')} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">1. List</button>
                <button onClick={onAddLink} className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800">Link</button>
                <button onClick={applyProfessionalTemplate} className="rounded-lg border border-amber-500/60 px-2 py-1 text-xs text-amber-300 hover:bg-amber-500/10">✨ Professional</button>
              </div>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                className="min-h-40 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">Deadline (Sana va vaqt)</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">Image/PDF upload</label>
              <label
                onDragOver={(event) => {
                  event.preventDefault()
                  setUploadDragOver(true)
                }}
                onDragLeave={() => setUploadDragOver(false)}
                onDrop={(event) => void onAttachmentDrop(event)}
                className={`flex w-full cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${uploadDragOver ? 'border-amber-400 bg-amber-500/10' : 'border-zinc-700 bg-zinc-950 hover:bg-zinc-900'}`}
              >
                <span className="truncate text-zinc-300">{attachmentName || (attachmentUrl ? 'Fayl yuklandi' : 'Fayl tanlang')}</span>
                <Paperclip className="h-4 w-4 text-zinc-400" />
                <input
                  type="file"
                  accept=".pdf,image/*,.html,.htm,text/html"
                  className="hidden"
                  onChange={(event) => void onAttachmentUpload(event.target.files?.[0] || null)}
                />
              </label>
              <input
                value={attachmentComment}
                onChange={(event) => setAttachmentComment(event.target.value)}
                placeholder="PDF/Image/HTML uchun qisqa izoh (comment)"
                className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
              />
              {uploading && <p className="mt-1 text-xs text-amber-300">Yuklanmoqda...</p>}
              {attachmentUrl && (
                <div className="mt-2 space-y-2">
                  {attachmentType === 'image' ? (
                    <img src={attachmentUrl} alt={attachmentName || 'attachment'} className="max-h-40 rounded-lg border border-zinc-700 object-contain" />
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-amber-300 underline">
                      Biriktirilgan faylni ko‘rish
                    </a>
                    <button type="button" onClick={insertAttachmentIntoEditor} className="rounded-md border border-amber-500/40 px-2 py-1 text-amber-300 hover:bg-amber-500/10">
                      Editorga joylash
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => void sendTask()}
              disabled={sending || uploading}
              className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 px-4 py-3 text-sm font-bold text-black shadow-lg shadow-amber-700/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex items-center justify-center gap-2">
                <Send className="h-4 w-4" />
                {sending ? 'Yuborilmoqda...' : 'Send Task'}
              </span>
            </button>
          </div>
        </section>

        <section className="lg:col-span-3 rounded-2xl border border-zinc-700/70 bg-zinc-900/70 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Dispatch History & Analytics</h2>
            <span className="text-xs text-zinc-400">{tasks.length} ta yuborilgan</span>
          </div>

          {loading ? (
            <p className="text-sm text-zinc-400">Yuklanmoqda...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-zinc-400">Hali vazifa yuborilmagan</p>
          ) : (
            <div className="space-y-4">
              {tasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-2xl border border-zinc-700 bg-zinc-950/80 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-amber-300">{task.title}</h3>
                      <p className="text-xs text-zinc-400">{task.group}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${task.status === 'expired' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {task.status === 'expired' ? 'Expired' : 'Active'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-xs text-zinc-300 sm:grid-cols-4">
                    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-2">
                      <p className="mb-1 flex items-center gap-1 text-zinc-400"><Users className="h-3.5 w-3.5" /> Yetib borgan</p>
                      <p className="text-sm font-semibold">{task.deliveryCount}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-2">
                      <p className="mb-1 flex items-center gap-1 text-zinc-400"><Eye className="h-3.5 w-3.5" /> O‘qilgan</p>
                      <p className="text-sm font-semibold">{task.readCount}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-2">
                      <p className="mb-1 text-zinc-400">Open Rate</p>
                      <p className="text-sm font-semibold">{task.openRate}%</p>
                    </div>
                    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-2">
                      <p className="mb-1 flex items-center gap-1 text-zinc-400"><CalendarClock className="h-3.5 w-3.5" /> Muddat</p>
                      <p className="text-sm font-semibold">{task.deadlineAt ? new Date(task.deadlineAt).toLocaleString('uz-UZ') : '-'}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {new Date(task.sentAt).toLocaleString('uz-UZ')}</span>
                    <span>Telegram: {task.analytics.telegramDeliveredChats}/{task.analytics.telegramTargetedChats}</span>
                    <span>Students: {task.analytics.targetedStudents}</span>
                    {task.attachmentUrl && (
                      <a href={task.attachmentUrl} target="_blank" rel="noreferrer" className="text-amber-300 underline">Attachment</a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}