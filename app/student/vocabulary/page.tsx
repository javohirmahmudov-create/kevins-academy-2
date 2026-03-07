/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Bell, Brain, Link as LinkIcon, Mic, RefreshCw, Search, Upload, Users, Video, CheckCircle2 } from 'lucide-react'
import { useApp } from '@/lib/app-context'

type QuizItem = {
  wordId: string
  promptUz: string
}

type FlashcardItem = {
  wordId: string
  promptUz: string
  answerEn: string
  mastered: boolean
  due: boolean
  nextReviewAt: string
}

type PartnerItem = {
  id: number
  fullName: string
  group?: string
}

type DuelItem = {
  id: number
  challengerId: number
  opponentId: number
  status: string
  challengerName?: string
  opponentName?: string
  incoming?: boolean
}

const MAX_RECORDING_SECONDS = 120

export default function StudentVocabularyPage() {
  const router = useRouter()
  const { currentStudent } = useApp()

  const [student, setStudent] = useState<any>(null)
  const [tab, setTab] = useState<'proctor' | 'peer' | 'flashcards'>('proctor')

  const [loading, setLoading] = useState(false)
  const [quiz, setQuiz] = useState<QuizItem[]>([])
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([])
  const [stats, setStats] = useState({ totalWords: 0, masteredWords: 0, dueWords: 0 })

  const [timeLimitSeconds, setTimeLimitSeconds] = useState(8)
  const [quizRunning, setQuizRunning] = useState(false)
  const [quizIndex, setQuizIndex] = useState(0)
  const [answerText, setAnswerText] = useState('')
  const [result, setResult] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [quizError, setQuizError] = useState('')

  const [flashcardIndex, setFlashcardIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)

  const [pairLoading, setPairLoading] = useState(false)
  const [pairPartner, setPairPartner] = useState<any>(null)
  const [pairCandidates, setPairCandidates] = useState<PartnerItem[]>([])
  const [partnerSearch, setPartnerSearch] = useState('')
  const [peerScore, setPeerScore] = useState(80)
  const [peerNote, setPeerNote] = useState('')
  const [peerRecordingUrl, setPeerRecordingUrl] = useState('')
  const [peerSubmitting, setPeerSubmitting] = useState(false)

  const [duelLoading, setDuelLoading] = useState(false)
  const [duelActionLoading, setDuelActionLoading] = useState(false)
  const [pendingIncomingDuels, setPendingIncomingDuels] = useState<DuelItem[]>([])
  const [pendingOutgoingDuels, setPendingOutgoingDuels] = useState<DuelItem[]>([])
  const [activeDuel, setActiveDuel] = useState<DuelItem | null>(null)
  const [duelReadyForClass, setDuelReadyForClass] = useState(false)
  const [botLinked, setBotLinked] = useState(true)
  const [botStartLink, setBotStartLink] = useState('')

  const [recordingFile, setRecordingFile] = useState<File | null>(null)
  const [uploadingRecording, setUploadingRecording] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [recordingActive, setRecordingActive] = useState(false)
  const [recordingRemainingSeconds, setRecordingRemainingSeconds] = useState(MAX_RECORDING_SECONDS)
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [recordingWarningSoundEnabled, setRecordingWarningSoundEnabled] = useState(true)

  const questionStartedAtRef = useRef(0)
  const questionTimeoutRef = useRef<any>(null)
  const responsesRef = useRef<Array<{ wordId: string; answer: string; elapsedMs: number }>>([])
  const recognitionRef = useRef<any>(null)
  const activeDuelSeenRef = useRef<number>(0)
  const [nowTick, setNowTick] = useState(Date.now())
  const liveVideoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<BlobPart[]>([])
  const recordingIntervalRef = useRef<any>(null)
  const recordedPreviewUrlRef = useRef('')
  const lastBeepSecondRef = useRef(-1)

  useEffect(() => {
    if (currentStudent) {
      setStudent(currentStudent)
      return
    }

    const raw = localStorage.getItem('currentStudent')
    if (!raw) {
      router.replace('/')
      return
    }

    try {
      setStudent(JSON.parse(raw))
    } catch {
      router.replace('/')
    }
  }, [currentStudent, router])

  const loadSession = useCallback(async () => {
    if (!student?.id) return
    setLoading(true)
    setQuizError('')
    try {
      const res = await fetch(`/api/vocabulary/proctor/session?studentId=${encodeURIComponent(String(student.id))}&size=10`)
      const data = await res.json()
      if (!res.ok) throw new Error(String(data?.error || 'Yuklashda xatolik'))

      setQuiz(Array.isArray(data?.quiz) ? data.quiz : [])
      setFlashcards(Array.isArray(data?.flashcards) ? data.flashcards : [])
      setStats({
        totalWords: Number(data?.stats?.totalWords || 0),
        masteredWords: Number(data?.stats?.masteredWords || 0),
        dueWords: Number(data?.stats?.dueWords || 0),
      })
      if (data?.message) {
        setQuizError(String(data.message))
      }
      setResult(null)
      setQuizRunning(false)
      responsesRef.current = []
      setQuizIndex(0)
      setAnswerText('')
      setFlashcardIndex(0)
      setShowAnswer(false)
    } catch (error: any) {
      setQuizError(String(error?.message || 'Yuklashda xatolik'))
    } finally {
      setLoading(false)
    }
  }, [student?.id])

  const loadPairing = useCallback(async () => {
    if (!student?.id || !student?.group) return
    setPairLoading(true)
    try {
      const response = await fetch(`/api/vocabulary/peer/pairs?group=${encodeURIComponent(String(student.group))}&studentId=${encodeURIComponent(String(student.id))}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload?.error || 'Pairing xatoligi'))
      setPairPartner(payload?.myPartner || null)
      setPairCandidates(Array.isArray(payload?.students) ? payload.students : [])
    } catch {
      setPairPartner(null)
      setPairCandidates([])
    } finally {
      setPairLoading(false)
    }
  }, [student?.group, student?.id])

  const loadDuels = useCallback(async () => {
    if (!student?.id) return
    setDuelLoading(true)
    try {
      const response = await fetch(`/api/vocabulary/duels?studentId=${encodeURIComponent(String(student.id))}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload?.error || 'Duel ma’lumotlari yuklanmadi'))
      setPendingIncomingDuels(Array.isArray(payload?.pendingIncoming) ? payload.pendingIncoming : [])
      setPendingOutgoingDuels(Array.isArray(payload?.pendingOutgoing) ? payload.pendingOutgoing : [])
      setActiveDuel(payload?.activeDuel || null)
      setDuelReadyForClass(Boolean(payload?.session?.readyForClass))
      setBotLinked(Boolean(payload?.bot?.linked))
      setBotStartLink(String(payload?.bot?.startLink || ''))
    } catch {
      setPendingIncomingDuels([])
      setPendingOutgoingDuels([])
      setActiveDuel(null)
      setDuelReadyForClass(false)
      setBotLinked(true)
      setBotStartLink('')
    } finally {
      setDuelLoading(false)
    }
  }, [student?.id])

  const createDuelInvite = useCallback(async (mode: 'manual' | 'random') => {
    if (!student?.id) return
    if (!duelReadyForClass) {
      alert('Admin bugungi sessionni boshlamaguncha duel ishlamaydi')
      return
    }
    if (!botLinked) {
      alert('Avval Kevin Botni ulang, keyin duelga kirishingiz mumkin')
      return
    }
    if (mode === 'manual' && !pairPartner?.id) {
      alert('Avval partner tanlang')
      return
    }

    setDuelActionLoading(true)
    try {
      const response = await fetch('/api/vocabulary/duels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          opponentId: mode === 'manual' ? pairPartner.id : undefined,
          mode,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload?.error || 'Duel yuborilmadi'))
      await loadDuels()
      alert(payload?.existed ? 'Bu juftlikda duel allaqachon bor' : 'Duel chaqiruvi yuborildi ✅')
    } catch (error: any) {
      alert(String(error?.message || 'Duel yuborilmadi'))
    } finally {
      setDuelActionLoading(false)
    }
  }, [botLinked, duelReadyForClass, loadDuels, pairPartner?.id, student?.id])

  const respondToDuel = useCallback(async (duelId: number, action: 'accept' | 'reject') => {
    if (!student?.id || !duelId) return
    setDuelActionLoading(true)
    try {
      const response = await fetch('/api/vocabulary/duels/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duelId, studentId: student.id, action }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload?.error || 'Duel javobi yuborilmadi'))
      await loadDuels()
      if (action === 'accept') {
        setTab('proctor')
      }
    } catch (error: any) {
      alert(String(error?.message || 'Duel javobi yuborilmadi'))
    } finally {
      setDuelActionLoading(false)
    }
  }, [loadDuels, student?.id])

  useEffect(() => {
    if (!student?.id) return
    loadSession()
    loadPairing()
    loadDuels()
  }, [student?.id, loadDuels, loadPairing, loadSession])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const requestedTab = String(new URLSearchParams(window.location.search).get('tab') || '').trim().toLowerCase()
    if (requestedTab === 'peer' || requestedTab === 'proctor' || requestedTab === 'flashcards') {
      setTab(requestedTab)
    }
  }, [])

  useEffect(() => {
    if (!student?.id) return
    const timer = setInterval(() => {
      loadDuels()
    }, 12000)
    return () => clearInterval(timer)
  }, [loadDuels, student?.id])

  useEffect(() => {
    if (!activeDuel?.id || !student?.id) return
    if (activeDuelSeenRef.current === activeDuel.id) return
    activeDuelSeenRef.current = activeDuel.id
    setTab('proctor')
    if (!quizRunning && quiz.length > 0) {
      setTimeout(() => {
        setTab('proctor')
        responsesRef.current = []
        setResult(null)
        setQuizError('')
        setQuizRunning(true)
        setQuizIndex(0)
        setAnswerText('')
      }, 120)
    }
  }, [activeDuel?.id, quiz.length, quizRunning, student?.id])

  const currentQuizItem = quiz[quizIndex] || null

  const startQuestionTimer = useCallback(() => {
    if (!quizRunning || !currentQuizItem) return
    if (questionTimeoutRef.current) {
      clearTimeout(questionTimeoutRef.current)
      questionTimeoutRef.current = null
    }
    questionStartedAtRef.current = Date.now()
    questionTimeoutRef.current = setTimeout(() => {
      if (!quizRunning) return
      const elapsedMs = timeLimitSeconds * 1000 + 10
      responsesRef.current.push({
        wordId: String(currentQuizItem.wordId || ''),
        answer: String(answerText || '').trim(),
        elapsedMs,
      })
      setAnswerText('')
      setQuizIndex((prev) => prev + 1)
    }, timeLimitSeconds * 1000)
  }, [answerText, currentQuizItem, quizRunning, timeLimitSeconds])

  useEffect(() => {
    if (!quizRunning || !currentQuizItem) return
    startQuestionTimer()

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(currentQuizItem.promptUz)
      utterance.lang = 'uz-UZ'
      utterance.rate = 0.95
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    }

    return () => {
      if (questionTimeoutRef.current) {
        clearTimeout(questionTimeoutRef.current)
        questionTimeoutRef.current = null
      }
    }
  }, [currentQuizItem, quizRunning, startQuestionTimer])

  useEffect(() => {
    if (!quizRunning) return
    const interval = setInterval(() => setNowTick(Date.now()), 250)
    return () => clearInterval(interval)
  }, [quizRunning])

  useEffect(() => {
    if (!quizRunning) return
    if (quizIndex < quiz.length) return

    const submit = async () => {
      setSubmitting(true)
      try {
        const response = await fetch('/api/vocabulary/proctor/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: student?.id,
            answers: responsesRef.current,
            timeLimitSeconds,
          }),
        })
        const payload = await response.json()
        if (!response.ok) throw new Error(String(payload?.error || 'Yuborishda xatolik'))
        setResult(payload)
        setQuizRunning(false)
        await loadSession()
      } catch (error: any) {
        setQuizError(String(error?.message || 'Yuborishda xatolik'))
        setQuizRunning(false)
      } finally {
        setSubmitting(false)
      }
    }

    submit()
  }, [quiz.length, quizIndex, quizRunning, student?.id, timeLimitSeconds, loadSession])

  useEffect(() => {
    return () => {
      if (questionTimeoutRef.current) clearTimeout(questionTimeoutRef.current)
      if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
        recognitionRef.current.stop()
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
        mediaStreamRef.current = null
      }
      if (recordedPreviewUrlRef.current) {
        URL.revokeObjectURL(recordedPreviewUrlRef.current)
        recordedPreviewUrlRef.current = ''
      }
    }
  }, [])

  useEffect(() => {
    if (!cameraActive) return
    const videoElement = liveVideoRef.current
    const stream = mediaStreamRef.current
    if (!videoElement || !stream) return

    videoElement.srcObject = stream
    void videoElement.play().catch(() => undefined)
  }, [cameraActive])

  useEffect(() => {
    if (!recordingActive) {
      lastBeepSecondRef.current = -1
      return
    }

    if (!recordingWarningSoundEnabled) {
      lastBeepSecondRef.current = -1
      return
    }

    const seconds = recordingRemainingSeconds
    const shouldBeep = seconds === 10 || seconds === 5 || seconds === 3 || seconds === 2 || seconds === 1
    if (!shouldBeep) return
    if (lastBeepSecondRef.current === seconds) return
    lastBeepSecondRef.current = seconds

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      const audioContext = new AudioContextClass()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.value = seconds <= 3 ? 980 : 740
      gainNode.gain.value = 0.06

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.12)
      oscillator.onended = () => {
        audioContext.close().catch(() => undefined)
      }
    } catch {
      // ignore beep errors
    }
  }, [recordingActive, recordingRemainingSeconds, recordingWarningSoundEnabled])

  const secondsLeft = useMemo(() => {
    if (!quizRunning || !currentQuizItem || !questionStartedAtRef.current) return timeLimitSeconds
    const elapsed = nowTick - questionStartedAtRef.current
    return Math.max(0, Math.ceil((timeLimitSeconds * 1000 - elapsed) / 1000))
  }, [currentQuizItem, nowTick, quizRunning, timeLimitSeconds])

  const startQuiz = () => {
    if (!quiz.length) return
    responsesRef.current = []
    setResult(null)
    setQuizError('')
    setQuizRunning(true)
    setQuizIndex(0)
    setAnswerText('')
  }

  const submitCurrentAnswer = () => {
    if (!quizRunning || !currentQuizItem) return
    if (questionTimeoutRef.current) {
      clearTimeout(questionTimeoutRef.current)
      questionTimeoutRef.current = null
    }
    const elapsedMs = Math.max(0, Date.now() - questionStartedAtRef.current)
    responsesRef.current.push({
      wordId: String(currentQuizItem.wordId || ''),
      answer: String(answerText || '').trim(),
      elapsedMs,
    })
    setAnswerText('')
    setQuizIndex((prev) => prev + 1)
  }

  const startVoiceInput = () => {
    if (typeof window === 'undefined') return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Brauzeringizda voice recognition yo‘q')
      return
    }

    try {
      if (recognitionRef.current && typeof recognitionRef.current.stop === 'function') {
        recognitionRef.current.stop()
      }

      const recognition = new SpeechRecognition()
      recognition.lang = 'en-US'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || ''
        setAnswerText(String(transcript).trim())
      }
      recognition.onerror = () => {
        // no-op
      }
      recognitionRef.current = recognition
      recognition.start()
    } catch {
      // ignore
    }
  }

  const currentFlashcard = flashcards[flashcardIndex] || null

  const filteredPartners = useMemo(() => {
    const query = partnerSearch.trim().toLowerCase()
    if (!query) return pairCandidates
    return pairCandidates.filter((item) => String(item.fullName || '').toLowerCase().includes(query))
  }, [pairCandidates, partnerSearch])

  const chooseRandomPartner = () => {
    if (!pairCandidates.length) {
      setPairPartner(null)
      return
    }
    const random = pairCandidates[Math.floor(Math.random() * pairCandidates.length)]
    setPairPartner(random || null)
  }

  const getSupportedRecorderMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return ''
    const preferredTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ]
    return preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ''
  }

  const clearRecordingTimer = () => {
    if (!recordingIntervalRef.current) return
    clearInterval(recordingIntervalRef.current)
    recordingIntervalRef.current = null
  }

  const stopPeerRecording = () => {
    clearRecordingTimer()
    const recorder = mediaRecorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    recorder.stop()
  }

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  const turnOnCamera = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Brauzeringiz kamerani qo‘llab-quvvatlamaydi')
      return
    }

    try {
      setCameraError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 360 },
        },
        audio: true,
      })
      mediaStreamRef.current = stream
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch {
      setCameraError('Kameraga ruxsat berilmadi yoki kamera topilmadi')
      setCameraActive(false)
    }
  }

  const startPeerRecording = () => {
    if (!mediaStreamRef.current || recordingActive) return
    if (typeof MediaRecorder === 'undefined') {
      setCameraError('MediaRecorder bu brauzerda mavjud emas')
      return
    }

    const mimeType = getSupportedRecorderMimeType()
    try {
      setCameraError('')
      recordingChunksRef.current = []
      const recorder = mimeType
        ? new MediaRecorder(mediaStreamRef.current, {
            mimeType,
            videoBitsPerSecond: 800000,
            audioBitsPerSecond: 64000,
          })
        : new MediaRecorder(mediaStreamRef.current)

      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        clearRecordingTimer()
        const chunks = recordingChunksRef.current
        if (!chunks.length) {
          setRecordingActive(false)
          return
        }

        const resolvedType = chunks[0] instanceof Blob ? chunks[0].type : ''
        const blob = new Blob(chunks, { type: resolvedType || mimeType || 'video/webm' })
        const extension = blob.type.includes('mp4') ? 'mp4' : 'webm'
        const file = new File([blob], `peer-recording-${student?.id || 'student'}-${Date.now()}.${extension}`, { type: blob.type })
        setRecordingFile(file)
        setPeerRecordingUrl('')

        if (recordedPreviewUrlRef.current) {
          URL.revokeObjectURL(recordedPreviewUrlRef.current)
          recordedPreviewUrlRef.current = ''
        }
        const nextPreviewUrl = URL.createObjectURL(blob)
        recordedPreviewUrlRef.current = nextPreviewUrl
        setRecordedPreviewUrl(nextPreviewUrl)
        setRecordingActive(false)
      }
      recorder.start(1000)
      lastBeepSecondRef.current = -1
      setRecordingRemainingSeconds(MAX_RECORDING_SECONDS)
      setRecordingActive(true)
      clearRecordingTimer()
      recordingIntervalRef.current = setInterval(() => {
        setRecordingRemainingSeconds((prev) => {
          if (prev <= 1) {
            stopPeerRecording()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch {
      setCameraError('Yozishni boshlashda xatolik yuz berdi')
      setRecordingActive(false)
    }
  }

  const resetRecordedVideo = () => {
    setRecordingFile(null)
    setPeerRecordingUrl('')
    if (recordedPreviewUrlRef.current) {
      URL.revokeObjectURL(recordedPreviewUrlRef.current)
      recordedPreviewUrlRef.current = ''
    }
    setRecordedPreviewUrl('')
    setRecordingRemainingSeconds(MAX_RECORDING_SECONDS)
  }

  const recordingCountdownLabel = useMemo(() => {
    const safeSeconds = Math.max(0, recordingRemainingSeconds)
    const minutes = Math.floor(safeSeconds / 60)
    const seconds = safeSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }, [recordingRemainingSeconds])

  const recordingWarning = recordingActive && recordingRemainingSeconds <= 10

  const uploadRecording = async () => {
    if (!recordingFile || !student?.group) return
    setUploadingRecording(true)
    try {
      const form = new FormData()
      form.append('title', `PEER_RECORDING:${student.id}:${Date.now()}`)
      form.append('group', '__peer_recordings__')
      form.append('type', 'video')
      form.append('file', recordingFile)
      form.append('content', `Group: ${student.group}`)

      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: student?.adminId ? { 'x-admin-id': String(student.adminId) } : undefined,
        body: form,
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload?.error || 'Video yuklanmadi'))
      setPeerRecordingUrl(String(payload?.fileUrl || ''))
      alert('Video yuklandi ✅')
    } catch (error: any) {
      alert(String(error?.message || 'Video yuklanmadi'))
    } finally {
      setUploadingRecording(false)
    }
  }

  const submitPeerResult = async () => {
    if (!student?.id || !pairPartner?.id) {
      alert('Juft topilmadi')
      return
    }

    setPeerSubmitting(true)
    try {
      const response = await fetch('/api/vocabulary/peer/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          partnerId: pairPartner.id,
          duelId: activeDuel?.id || undefined,
          score: peerScore,
          note: peerNote,
          recordingUrl: peerRecordingUrl || undefined,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(String(payload?.error || 'Jo‘natishda xatolik'))
      if (payload?.status === 'auto_approved') {
        alert('Natija yuborildi va avtomatik tasdiqlandi ✅')
      } else if (payload?.status === 'needs_review') {
        alert('Natija yuborildi. Shubhali holat admin ko‘rigiga tushdi ⚠️')
      } else {
        alert('Natija yuborildi. Partner javobi kelgach auto-check qilinadi ✅')
      }
      setPeerNote('')
      await loadDuels()
    } catch (error: any) {
      alert(String(error?.message || 'Jo‘natishda xatolik'))
    } finally {
      setPeerSubmitting(false)
    }
  }

  if (!student) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => router.push('/student')}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
          >
            <ArrowLeft className="w-4 h-4" /> Orqaga
          </button>
          <h1 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white inline-flex items-center gap-2 order-3 sm:order-none w-full sm:w-auto">
            <Brain className="w-5 h-5 text-indigo-500" /> AI Vocabulary Proctor
          </h1>
          <button
            onClick={loadSession}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 text-indigo-700 dark:text-indigo-300 px-3 py-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Yangilash
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-blue-100 bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500">Total words</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalWords}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500">Mastered</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.masteredWords}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-white dark:bg-gray-900 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500">Due now</p>
            <p className="text-2xl font-bold text-amber-600">{stats.dueWords}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-1 w-full sm:inline-grid">
          <button onClick={() => setTab('proctor')} className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${tab === 'proctor' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}>AI Proctor</button>
          <button onClick={() => setTab('peer')} className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${tab === 'peer' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}>Peer Checking</button>
          <button onClick={() => setTab('flashcards')} className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm ${tab === 'flashcards' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}>Flashcards</button>
        </div>

        {tab === 'proctor' && (
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm text-gray-500">Har bir so‘zga vaqt chegarasi</p>
                <select
                  value={timeLimitSeconds}
                  onChange={(event) => setTimeLimitSeconds(Number(event.target.value || 8))}
                  className="mt-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                  disabled={quizRunning}
                >
                  <option value={5}>5 soniya</option>
                  <option value={8}>8 soniya</option>
                  <option value={10}>10 soniya</option>
                </select>
              </div>
              {!quizRunning ? (
                <button
                  onClick={startQuiz}
                  disabled={loading || quiz.length === 0}
                  className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  Quizni boshlash
                </button>
              ) : (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Word {Math.min(quizIndex + 1, quiz.length)} / {quiz.length}</p>
                  <p className="text-xl font-bold text-red-500">{secondsLeft}s</p>
                </div>
              )}
            </div>

            {quizError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-700 px-3 py-2 text-sm">{quizError}</div>
            ) : null}

            {!loading && !quizRunning && quiz.length === 0 ? (
              <div className="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 p-4 text-sm">
                <p className="font-medium text-gray-900 dark:text-white">Quiz uchun so‘z topilmadi</p>
                <p className="text-gray-500 mt-1">Admin material biriktirgach, bu yerdan qayta boshlang.</p>
                <button onClick={loadSession} className="mt-3 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5">Qayta yuklash</button>
              </div>
            ) : null}

            {quizRunning && currentQuizItem ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/30 p-5 space-y-4">
                <p className="text-sm text-gray-500">Uzbek prompt</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{currentQuizItem.promptUz}</p>

                <div className="flex gap-2">
                  <input
                    value={answerText}
                    onChange={(event) => setAnswerText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        submitCurrentAnswer()
                      }
                    }}
                    className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
                    placeholder="Inglizcha javob..."
                  />
                  <button onClick={startVoiceInput} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3">
                    <Mic className="w-4 h-4" />
                  </button>
                  <button onClick={submitCurrentAnswer} className="rounded-lg bg-indigo-600 text-white px-4">
                    Next
                  </button>
                </div>
              </motion.div>
            ) : null}

            {submitting ? <p className="text-sm text-gray-500">Natija hisoblanmoqda...</p> : null}

            {result?.result ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 p-4">
                <p className="font-semibold">Natija: {result.result.correctCount}/{result.result.total} ({result.result.percent}%)</p>
                <p className="text-sm">Ball avtomatik ravishda Scores bo‘limiga yozildi.</p>
              </div>
            ) : null}
          </section>
        )}

        {tab === 'peer' && (
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white inline-flex items-center gap-2"><Users className="w-5 h-5 text-indigo-500" /> Peer-to-Peer Checking</h2>
              <div className="flex items-center gap-2">
                <button onClick={chooseRandomPartner} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Random tanlash</button>
                <button onClick={loadPairing} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm">Yangilash</button>
              </div>
            </div>

            {pendingIncomingDuels.length > 0 ? (
              <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-950/30 dark:to-amber-950/20 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700 dark:text-red-300 inline-flex items-center gap-2"><Bell className="w-4 h-4" /> Yangi duel chaqiruvi</p>
                {pendingIncomingDuels.map((duel) => (
                  <div key={duel.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="text-gray-700 dark:text-gray-200"><span className="font-semibold">{duel.challengerName || 'Partner'}</span> sizni duelga chaqirdi</p>
                    <div className="flex items-center gap-2">
                      <button disabled={duelActionLoading} onClick={() => respondToDuel(duel.id, 'accept')} className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs sm:text-sm disabled:opacity-50">Qabul qilish</button>
                      <button disabled={duelActionLoading} onClick={() => respondToDuel(duel.id, 'reject')} className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-xs sm:text-sm disabled:opacity-50">Rad etish</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {!botLinked ? (
              <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-700 dark:text-red-300 space-y-2">
                <p className="font-semibold">Iltimos, avval Kevin Botni ulang. Aks holda duel chaqiruvlarini ololmaysiz.</p>
                {botStartLink ? (
                  <a
                    href={botStartLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 text-white px-3 py-1.5"
                  >
                    <LinkIcon className="w-4 h-4" /> Kevin Botni ulash
                  </a>
                ) : (
                  <p className="text-xs">Bot username sozlamasi topilmadi. Admin bilan bog‘laning.</p>
                )}
              </div>
            ) : null}

            {!duelReadyForClass ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-300">
                Duel rejimi hozir o‘chiq. Admin paneldan bugungi sessionni boshlab, &quot;Duel rejimini yoqish&quot; ni yoqishi kerak.
              </div>
            ) : null}

            {activeDuel ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-300">
                Aktiv duel: {activeDuel.challengerName} vs {activeDuel.opponentName}. Proctor tabiga o‘ting va quizni boshlang.
              </div>
            ) : null}

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">Partnerni qo‘lda tanlang va duelga chaqiring</p>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={partnerSearch}
                  onChange={(event) => setPartnerSearch(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent pl-9 pr-3 py-2 text-sm"
                  placeholder="Student nomi bo‘yicha qidirish"
                />
              </div>
              <div className="max-h-40 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
                {filteredPartners.length === 0 ? (
                  <p className="text-sm text-gray-500 p-3">Qidiruv bo‘yicha student topilmadi.</p>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filteredPartners.map((partner) => (
                      <button
                        key={partner.id}
                        onClick={() => setPairPartner(partner)}
                        className={`w-full text-left px-3 py-2 text-sm ${Number(pairPartner?.id) === Number(partner.id) ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}
                      >
                        {partner.fullName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button disabled={duelActionLoading || !pairPartner?.id || !duelReadyForClass || !botLinked} onClick={() => createDuelInvite('manual')} className="rounded-lg bg-red-600 text-white px-3 py-1.5 text-sm disabled:opacity-50">Duelga chaqirish</button>
                <button disabled={duelActionLoading || !duelReadyForClass || !botLinked} onClick={() => createDuelInvite('random')} className="rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 px-3 py-1.5 text-sm disabled:opacity-50">Random duel</button>
                {duelLoading ? <span className="text-xs text-gray-500">Duel holati yangilanmoqda...</span> : null}
              </div>
              {pendingOutgoingDuels.length > 0 ? <p className="text-xs text-gray-500">Kutilyapti: {pendingOutgoingDuels.length} ta yuborilgan chaqiruv.</p> : null}
            </div>

            {pairLoading ? <p className="text-sm text-gray-500">Juftlik yuklanmoqda...</p> : null}
            {!pairLoading && !pairPartner ? (
              <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-700 p-4 text-sm">
                <p className="text-amber-700 dark:text-amber-300 font-medium">Hali partner tanlanmagan</p>
                <p className="text-gray-500 mt-1">Yuqoridan student tanlang yoki random tugmasini bosing.</p>
              </div>
            ) : null}
            {pairPartner ? (
              <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 p-4 space-y-3">
                <p className="text-sm text-gray-500">Sizning juftingiz</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{pairPartner.fullName}</p>

                <div className="space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-300">Live video recording</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={cameraActive ? stopCamera : turnOnCamera}
                      disabled={recordingActive}
                      className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {cameraActive ? 'Kamerani o‘chirish' : 'Kamerani yoqish'}
                    </button>
                    {recordedPreviewUrl ? (
                      <button
                        onClick={resetRecordedVideo}
                        disabled={recordingActive}
                        className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50"
                      >
                        Qayta yozish
                      </button>
                    ) : null}
                    <button
                      onClick={() => setRecordingWarningSoundEnabled((prev) => !prev)}
                      className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm"
                    >
                      {recordingWarningSoundEnabled ? '🔊 Ovoz: ON' : '🔇 Ovoz: OFF'}
                    </button>
                  </div>

                  {cameraError ? (
                    <p className="text-xs text-red-600 dark:text-red-300">{cameraError}</p>
                  ) : null}

                  {cameraActive ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-black">
                      <video ref={liveVideoRef} autoPlay playsInline muted className="w-full max-h-72 object-cover" />
                      <div className={`absolute top-2 left-2 rounded-md px-2 py-1 text-xs text-white ${recordingWarning ? 'bg-red-600 animate-pulse' : 'bg-black/60'}`}>
                        {recordingActive ? `⏱ ${recordingCountdownLabel}` : 'Tayyor 2:00'}
                      </div>
                      {recordingWarning ? (
                        <div className="absolute top-10 left-2 rounded-md bg-red-600/90 animate-pulse px-2 py-1 text-[11px] font-semibold text-white">
                          ⚠️ {recordingRemainingSeconds}s qoldi
                        </div>
                      ) : null}
                      <div className="absolute top-2 right-2 flex items-center gap-2">
                        <button
                          onClick={startPeerRecording}
                          disabled={recordingActive}
                          className="rounded-md bg-red-600 text-white px-2.5 py-1 text-xs disabled:opacity-50"
                        >
                          🔴 Record
                        </button>
                        <button
                          onClick={stopPeerRecording}
                          disabled={!recordingActive}
                          className="rounded-md bg-gray-800/80 text-white px-2.5 py-1 text-xs disabled:opacity-50"
                        >
                          ⏹ Stop
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {recordedPreviewUrl ? (
                    <div className="space-y-2 rounded-xl border border-indigo-200 dark:border-indigo-800 p-3">
                      <p className="text-sm text-gray-600 dark:text-gray-300">Preview</p>
                      <video src={recordedPreviewUrl} controls playsInline className="w-full rounded-lg bg-black max-h-72" />
                      <button
                        onClick={uploadRecording}
                        disabled={!recordingFile || uploadingRecording}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50"
                      >
                        <Upload className="w-4 h-4" /> {uploadingRecording ? 'Yuklanmoqda...' : 'Upload'}
                      </button>
                    </div>
                  ) : null}

                  {peerRecordingUrl ? (
                    <a href={peerRecordingUrl} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 inline-flex items-center gap-1 hover:underline">
                      <Video className="w-4 h-4" /> Recording link
                    </a>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300">Juftingizga qo‘yadigan ball (0-100)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={peerScore}
                      onChange={(event) => setPeerScore(Math.max(0, Math.min(100, Number(event.target.value || 0))))}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-300">Izoh</label>
                    <input
                      value={peerNote}
                      onChange={(event) => setPeerNote(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
                      placeholder="Qisqa izoh"
                    />
                  </div>
                </div>

                <button
                  onClick={submitPeerResult}
                  disabled={peerSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" /> {peerSubmitting ? 'Yuborilmoqda...' : 'Natijani yuborish'}
                </button>
              </div>
            ) : null}
          </section>
        )}

        {tab === 'flashcards' && (
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-4">
            {!currentFlashcard ? (
              <div className="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 p-4 text-sm">
                <p className="font-medium text-gray-900 dark:text-white">Flashcards topilmadi</p>
                <p className="text-gray-500 mt-1">Avval AI Proctorda quiz ishlang, keyin qayta tekshiring.</p>
                <button onClick={() => setTab('proctor')} className="mt-3 rounded-lg bg-indigo-600 text-white px-3 py-1.5">AI Proctorga o‘tish</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">{flashcardIndex + 1} / {flashcards.length}</p>
                  <p className={`text-xs px-2 py-1 rounded-full ${currentFlashcard.mastered ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {currentFlashcard.mastered ? 'Mastered' : currentFlashcard.due ? 'Due now' : 'Learning'}
                  </p>
                </div>

                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 p-6 text-center space-y-3">
                  <p className="text-sm text-gray-500">Prompt (UZ)</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{currentFlashcard.promptUz}</p>
                  {showAnswer ? <p className="text-xl font-semibold text-indigo-600">{currentFlashcard.answerEn}</p> : null}
                  <button onClick={() => setShowAnswer((prev) => !prev)} className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-1.5 text-sm">
                    {showAnswer ? 'Javobni yashirish' : 'Javobni ko‘rsatish'}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setFlashcardIndex((prev) => Math.max(0, prev - 1))
                      setShowAnswer(false)
                    }}
                    disabled={flashcardIndex === 0}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Oldingi
                  </button>
                  <button
                    onClick={() => {
                      setFlashcardIndex((prev) => Math.min(flashcards.length - 1, prev + 1))
                      setShowAnswer(false)
                    }}
                    disabled={flashcardIndex >= flashcards.length - 1}
                    className="rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    Keyingi
                  </button>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
