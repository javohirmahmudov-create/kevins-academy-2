'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, BookOpen, Edit, Trash2, Headphones, PenSquare, Brain, Newspaper, Sparkles } from 'lucide-react';
import { getGroups, getStudents, addGroup, updateGroup, deleteGroup, Group, getIeltsProgressMap, saveIeltsProgressMap } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

type GroupLevel = 'Beginner' | 'Elementary' | 'Intermediate' | 'Advanced' | 'IELTS';
type GroupWithCount = Group & { studentCount: number; level?: GroupLevel; description?: string };
type ProgramTrack = 'foundation' | 'cefr' | 'ielts';

type IeltsProgressForm = {
  studentId: string;
  listeningTotalTests: number;
  listeningSolvedTests: number;
  listeningReadingCorrect: number;
  scriptWritingCount: number;
  podcastVideoAnalysisCount: number;
  writingTask1Uploads: number;
  writingTask2Uploads: number;
  speakingGeneralCount: number;
  speakingAcademicCount: number;
  fluencyScore: number;
  lexicalScore: number;
  grammarScore: number;
  pronunciationScore: number;
  vocabularyTotalWords: number;
  vocabularyKnownWords: number;
  vocabularyUnknownWords: number;
  vocabularyUploadNote: string;
  vocabularyUploadFiles: string[];
  grammarTopicTests: number;
  grammarFixScore: number;
  grammarErrorWorkCount: number;
  articleReadCount: number;
  articleTranslationCount: number;
  readingArtScore: number;
  attendanceEffectPercent: number;
}

const defaultIeltsProgressForm = (): IeltsProgressForm => ({
  studentId: '',
  listeningTotalTests: 40,
  listeningSolvedTests: 0,
  listeningReadingCorrect: 0,
  scriptWritingCount: 0,
  podcastVideoAnalysisCount: 0,
  writingTask1Uploads: 0,
  writingTask2Uploads: 0,
  speakingGeneralCount: 0,
  speakingAcademicCount: 0,
  fluencyScore: 0,
  lexicalScore: 0,
  grammarScore: 0,
  pronunciationScore: 0,
  vocabularyTotalWords: 0,
  vocabularyKnownWords: 0,
  vocabularyUnknownWords: 0,
  vocabularyUploadNote: '',
  vocabularyUploadFiles: [],
  grammarTopicTests: 0,
  grammarFixScore: 0,
  grammarErrorWorkCount: 0,
  articleReadCount: 0,
  articleTranslationCount: 0,
  readingArtScore: 0,
  attendanceEffectPercent: 100,
})

export default function GroupsPage() {
  const router = useRouter();
  const { t } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [editingGroup, setEditingGroup] = useState<GroupWithCount | null>(null);
  const [programTrack, setProgramTrack] = useState<ProgramTrack>('foundation');
  const [ieltsProgress, setIeltsProgress] = useState<IeltsProgressForm>(defaultIeltsProgressForm());
  const [ieltsSaving, setIeltsSaving] = useState(false);
  const [ieltsFeedback, setIeltsFeedback] = useState('');

  const [formData, setFormData] = useState<{
    name: string;
    level: GroupLevel;
    description: string;
    telegramChatId: string;
  }>({
    name: '',
    level: 'Beginner',
    description: '',
    telegramChatId: ''
  });

  useEffect(() => {
    loadGroups();
  }, []);

  const inferTrackFromLevel = (level?: string): ProgramTrack => {
    const normalized = String(level || '').toLowerCase();
    if (normalized.includes('ielts')) return 'ielts';
    return normalized.includes('intermediate') || normalized.includes('advanced') ? 'cefr' : 'foundation';
  };

  const handleSelectFoundationLevel = (level: Extract<GroupLevel, 'Beginner' | 'Elementary'>) => {
    setProgramTrack('foundation');
    setFormData((prev) => ({ ...prev, level }));
  };

  const handleSelectCefrLevel = (level: Extract<GroupLevel, 'Intermediate' | 'Advanced'>) => {
    setProgramTrack('cefr');
    setFormData((prev) => ({ ...prev, level }));
  };

  const handleSelectIeltsTrack = () => {
    setProgramTrack('ielts');
    setFormData((prev) => ({ ...prev, level: 'IELTS' }));
  };

  const openAddModal = () => {
    setFormData({ name: '', level: 'Beginner', description: '', telegramChatId: '' });
    setProgramTrack('foundation');
    setIeltsProgress(defaultIeltsProgressForm());
    setIeltsFeedback('');
    setShowAddModal(true);
  };

  const calculateIeltsBand = (correctAnswers: number) => {
    const score = Math.max(0, Math.min(40, Math.round(Number(correctAnswers) || 0)));
    if (score >= 39) return 9.0;
    if (score >= 37) return 8.5;
    if (score >= 35) return 8.0;
    if (score >= 33) return 7.5;
    if (score >= 30) return 7.0;
    if (score >= 27) return 6.5;
    if (score >= 23) return 6.0;
    if (score >= 19) return 5.5;
    if (score >= 15) return 5.0;
    if (score >= 12) return 4.5;
    return 4.0;
  };

  const vocabularyKnownPercent = ieltsProgress.vocabularyTotalWords > 0
    ? Math.min(100, Math.max(0, (ieltsProgress.vocabularyKnownWords / ieltsProgress.vocabularyTotalWords) * 100))
    : 0;

  const listeningProgressPercent = ieltsProgress.listeningTotalTests > 0
    ? Math.min(100, Math.max(0, (ieltsProgress.listeningSolvedTests / ieltsProgress.listeningTotalTests) * 100))
    : 0;

  const speakingAverage = (
    ieltsProgress.fluencyScore +
    ieltsProgress.lexicalScore +
    ieltsProgress.grammarScore +
    ieltsProgress.pronunciationScore
  ) / 4;

  const ieltsBand = calculateIeltsBand(ieltsProgress.listeningReadingCorrect);

  const loadGroups = async () => {
    const allGroups = await getGroups();
    const allStudents = await getStudents();
    setStudents(allStudents);
    
    // Count students for each group
    const groupsWithCount = allGroups.map((group: any) => ({
      ...group,
      studentCount: allStudents.filter((s: any) => s.group === group.name).length
    }));
    
    setGroups(groupsWithCount);
  };

  const handleAddGroup = async () => {
    if (!formData.name) {
      alert(t('please_enter_group_name'));
      return;
    }

    const groupData = {
      name: formData.name,
      level: formData.level,
      description: formData.description,
      telegramChatId: formData.telegramChatId,
      teacher: 'Unassigned',
      schedule: 'TBD',
      maxStudents: 20
    };

    try {
      const created = await addGroup(groupData);
      if (created?.verification?.ok) {
        alert(created.verification.message || 'Muvaffaqiyatli bog‘landi ✅');
      }

      await loadGroups();
      setFormData({ name: '', level: 'Beginner', description: '', telegramChatId: '' });
      setProgramTrack('foundation');
      setIeltsProgress(defaultIeltsProgressForm());
      setShowAddModal(false);
    } catch (error: any) {
      alert(String(error?.message || 'Guruh yaratishda xatolik yuz berdi'));
    }
  };

  const handleEditGroup = (group: GroupWithCount) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      level: group.level as any,
      description: group.description || '',
      telegramChatId: String(group.telegramChatId || '')
    });
    setProgramTrack(inferTrackFromLevel(group.level));
    setIeltsFeedback('');
    setIeltsProgress(defaultIeltsProgressForm());
    setShowEditModal(true);
  };

  const handleStudentProgressLoad = async (studentId: string) => {
    setIeltsProgress((prev) => ({ ...prev, studentId }));
    setIeltsFeedback('');
    if (!studentId) return;

    try {
      const res = await getIeltsProgressMap(studentId);
      const breakdown = res?.breakdown || {};
      const listening = breakdown?.listeningReading || {};
      const writingSpeaking = breakdown?.writingSpeaking || {};
      const grammarVocabulary = breakdown?.grammarVocabulary || {};
      const articleAttendance = breakdown?.articleAttendance || {};
      const speaking = writingSpeaking?.speaking || {};

      setIeltsProgress((prev) => ({
        ...prev,
        studentId,
        listeningTotalTests: Number(listening.totalTests || prev.listeningTotalTests),
        listeningSolvedTests: Number(listening.solvedTests || 0),
        listeningReadingCorrect: Number(listening.correctAnswers40 || 0),
        scriptWritingCount: Number(listening.scriptWritingCount || 0),
        podcastVideoAnalysisCount: Number(listening.podcastVideoAnalysisCount || 0),
        writingTask1Uploads: Number(writingSpeaking.writingTask1Uploads || 0),
        writingTask2Uploads: Number(writingSpeaking.writingTask2Uploads || 0),
        speakingGeneralCount: Number(writingSpeaking.speakingGeneralCount || 0),
        speakingAcademicCount: Number(writingSpeaking.speakingAcademicCount || 0),
        fluencyScore: Number(speaking.fluency || 0),
        lexicalScore: Number(speaking.lexicalResource || 0),
        grammarScore: Number(speaking.grammar || 0),
        pronunciationScore: Number(speaking.pronunciation || 0),
        vocabularyTotalWords: Number(grammarVocabulary.vocabularyTotalWords || 0),
        vocabularyKnownWords: Number(grammarVocabulary.vocabularyKnownWords || 0),
        vocabularyUnknownWords: Number(grammarVocabulary.vocabularyUnknownWords || 0),
        vocabularyUploadNote: String(grammarVocabulary.vocabularyUploadNote || ''),
        vocabularyUploadFiles: Array.isArray(grammarVocabulary.vocabularyUploadFiles) ? grammarVocabulary.vocabularyUploadFiles : [],
        grammarTopicTests: Number(grammarVocabulary.grammarTopicTests || 0),
        grammarFixScore: Number(grammarVocabulary.grammarFixScore || 0),
        grammarErrorWorkCount: Number(grammarVocabulary.grammarErrorWorkCount || 0),
        articleReadCount: Number(articleAttendance.articleReadCount || 0),
        articleTranslationCount: Number(articleAttendance.articleTranslationCount || 0),
        readingArtScore: Number(articleAttendance.readingArtScore || 0),
        attendanceEffectPercent: Number(articleAttendance.attendanceEffectPercent || prev.attendanceEffectPercent),
      }));

      if (breakdown && Object.keys(breakdown).length > 0) {
        setIeltsFeedback('Mavjud IELTS Progress Map yuklandi');
      }
    } catch {
      setIeltsFeedback('Progress map topilmadi, yangi ma’lumot kiriting');
    }
  };

  const handleSaveIeltsProgress = async () => {
    if (!ieltsProgress.studentId) {
      alert('IELTS progress uchun o‘quvchini tanlang');
      return;
    }

    try {
      setIeltsSaving(true);
      setIeltsFeedback('');
      await saveIeltsProgressMap({
        ...ieltsProgress,
        studentId: ieltsProgress.studentId,
        groupName: formData.name || editingGroup?.name || undefined,
      });
      setIeltsFeedback('IELTS Progress Map saqlandi ✅');
    } catch {
      setIeltsFeedback('IELTS Progress Map saqlashda xatolik');
    } finally {
      setIeltsSaving(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !formData.name) {
      alert(t('please_enter_group_name'));
      return;
    }

    const updatedData = {
      name: formData.name,
      level: formData.level,
      description: formData.description,
      telegramChatId: formData.telegramChatId,
    };
    try {
      const updated = await updateGroup(editingGroup.id, updatedData);
      if (updated?.verification?.ok) {
        alert(updated.verification.message || 'Muvaffaqiyatli bog‘landi ✅');
      }

      if (programTrack === 'ielts' && ieltsProgress.studentId) {
        try {
          setIeltsSaving(true);
          await saveIeltsProgressMap({
            ...ieltsProgress,
            studentId: ieltsProgress.studentId,
            groupName: formData.name,
          });
          setIeltsFeedback('IELTS Progress Map saqlandi ✅');
        } catch {
          setIeltsFeedback('IELTS Progress Map saqlashda xatolik');
        } finally {
          setIeltsSaving(false);
        }
      }

      await loadGroups();
      setFormData({ name: '', level: 'Beginner', description: '', telegramChatId: '' });
      setProgramTrack('foundation');
      setIeltsProgress(defaultIeltsProgressForm());
      setEditingGroup(null);
      setShowEditModal(false);
    } catch (error: any) {
      alert(String(error?.message || 'Guruhni yangilashda xatolik yuz berdi'));
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (confirm(t('delete_group_confirm'))) {
      await deleteGroup(id);
      await loadGroups();
    }
  };

  const levelColors: Record<GroupLevel, string> = {
    Beginner: 'from-green-500 to-emerald-600',
    Elementary: 'from-blue-500 to-cyan-600',
    Intermediate: 'from-purple-500 to-pink-600',
    Advanced: 'from-orange-500 to-red-600',
    IELTS: 'from-gray-900 via-gray-800 to-amber-500'
  };

  const getLevel = (level?: string): GroupLevel => {
    if (level === 'Elementary' || level === 'Intermediate' || level === 'Advanced' || level === 'IELTS') {
      return level;
    }
    return 'Beginner';
  };

  const targetGroupName = formData.name || editingGroup?.name || '';
  const ieltsStudents = students.filter((student) => !targetGroupName || student.group === targetGroupName);

  const renderIeltsBlocks = () => (
    <div className="mt-4 rounded-2xl border border-amber-400/50 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 text-amber-100 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide flex items-center gap-2"><Sparkles className="w-4 h-4" /> IELTS Advanced Management (6-Modul)</h3>
        <span className="text-xs px-2 py-1 rounded-full bg-amber-400/15 border border-amber-300/40">Luxury Gold / Black</span>
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1">Progress Map uchun o‘quvchi</label>
        <select
          value={ieltsProgress.studentId}
          onChange={(e) => handleStudentProgressLoad(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-black/40 border border-amber-300/40 text-amber-100 focus:ring-2 focus:ring-amber-400 outline-none"
        >
          <option value="">O‘quvchini tanlang</option>
          {(ieltsStudents.length > 0 ? ieltsStudents : students).map((student) => (
            <option key={student.id} value={student.id}>{student.fullName}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase flex items-center gap-2"><Headphones className="w-4 h-4" /> 1) Listening & Reading</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.listeningTotalTests} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, listeningTotalTests: Number(e.target.value || 0) }))} placeholder="Total test" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.listeningSolvedTests} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, listeningSolvedTests: Number(e.target.value || 0) }))} placeholder="Solved" />
            <input type="number" min={0} max={40} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.listeningReadingCorrect} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, listeningReadingCorrect: Number(e.target.value || 0) }))} placeholder="Correct /40" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.scriptWritingCount} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, scriptWritingCount: Number(e.target.value || 0) }))} placeholder="Script writing" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30 col-span-2" value={ieltsProgress.podcastVideoAnalysisCount} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, podcastVideoAnalysisCount: Number(e.target.value || 0) }))} placeholder="Podcast/Video analysis" />
          </div>
          <p className="text-[11px] text-amber-200">Progress: {listeningProgressPercent.toFixed(1)}% • Band: <span className="font-semibold">{ieltsBand.toFixed(1)}</span></p>
        </div>

        <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase flex items-center gap-2"><PenSquare className="w-4 h-4" /> 2) Writing & Speaking</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.writingTask1Uploads} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, writingTask1Uploads: Number(e.target.value || 0) }))} placeholder="Task 1 uploads" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.writingTask2Uploads} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, writingTask2Uploads: Number(e.target.value || 0) }))} placeholder="Task 2 uploads" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.speakingGeneralCount} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, speakingGeneralCount: Number(e.target.value || 0) }))} placeholder="General Q" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.speakingAcademicCount} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, speakingAcademicCount: Number(e.target.value || 0) }))} placeholder="Academic Q" />
            <input type="number" min={0} max={9} step={0.5} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.fluencyScore} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, fluencyScore: Number(e.target.value || 0) }))} placeholder="Fluency" />
            <input type="number" min={0} max={9} step={0.5} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.lexicalScore} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, lexicalScore: Number(e.target.value || 0) }))} placeholder="Lexical" />
            <input type="number" min={0} max={9} step={0.5} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.grammarScore} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, grammarScore: Number(e.target.value || 0) }))} placeholder="Grammar" />
            <input type="number" min={0} max={9} step={0.5} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.pronunciationScore} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, pronunciationScore: Number(e.target.value || 0) }))} placeholder="Pronunciation" />
          </div>
          <p className="text-[11px] text-amber-200">Speaking Avg: {speakingAverage.toFixed(2)} / 9</p>
        </div>

        <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase flex items-center gap-2"><Brain className="w-4 h-4" /> 3) Grammar & Vocabulary</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.vocabularyTotalWords} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, vocabularyTotalWords: Number(e.target.value || 0) }))} placeholder="Total words" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.vocabularyKnownWords} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, vocabularyKnownWords: Number(e.target.value || 0) }))} placeholder="Known words" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.vocabularyUnknownWords} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, vocabularyUnknownWords: Number(e.target.value || 0) }))} placeholder="Unknown words" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.grammarTopicTests} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, grammarTopicTests: Number(e.target.value || 0) }))} placeholder="Grammar tests" />
            <input type="number" min={0} max={100} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.grammarFixScore} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, grammarFixScore: Number(e.target.value || 0) }))} placeholder="Grammar score %" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.grammarErrorWorkCount} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, grammarErrorWorkCount: Number(e.target.value || 0) }))} placeholder="Error work" />
          </div>
          <input
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.pdf,image/*"
            onChange={(e) => {
              const fileNames = Array.from(e.target.files || []).map((file) => file.name);
              setIeltsProgress((prev) => ({ ...prev, vocabularyUploadFiles: fileNames }));
            }}
            className="w-full text-xs"
          />
          <input type="text" className="w-full px-2 py-1 rounded bg-black/40 border border-amber-300/30 text-xs" value={ieltsProgress.vocabularyUploadNote} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, vocabularyUploadNote: e.target.value }))} placeholder="Upload izoh (Excel/CSV/PDF/IMAGE)" />
          <p className="text-[11px] text-amber-200">Known vocab: {vocabularyKnownPercent.toFixed(1)}% {vocabularyKnownPercent < 60 ? '• Bot alert yuboriladi' : ''}</p>
        </div>

        <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase flex items-center gap-2"><Newspaper className="w-4 h-4" /> 4) Article & Attendance</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.articleReadCount} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, articleReadCount: Number(e.target.value || 0) }))} placeholder="Article read" />
            <input type="number" min={0} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.articleTranslationCount} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, articleTranslationCount: Number(e.target.value || 0) }))} placeholder="Translated" />
            <input type="number" min={0} max={100} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.readingArtScore} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, readingArtScore: Number(e.target.value || 0) }))} placeholder="Reading Art %" />
            <input type="number" min={0} max={100} className="px-2 py-1 rounded bg-black/40 border border-amber-300/30" value={ieltsProgress.attendanceEffectPercent} onChange={(e) => setIeltsProgress((prev) => ({ ...prev, attendanceEffectPercent: Number(e.target.value || 0) }))} placeholder="Attendance effect %" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-amber-200">Progress Map DB linking: har bir saqlash alohida snapshot bo‘lib yoziladi.</p>
        <button
          type="button"
          onClick={handleSaveIeltsProgress}
          disabled={ieltsSaving}
          className="px-3 py-2 rounded-lg text-sm font-semibold bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-50"
        >
          {ieltsSaving ? 'Saqlanmoqda...' : 'Progress Map saqlash'}
        </button>
      </div>
      {ieltsFeedback ? <p className="text-xs text-emerald-300">{ieltsFeedback}</p> : null}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/admin')} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{t('group_management')}</h1>
                <p className="text-sm text-gray-500">{t('manage_all_groups')}</p>
              </div>
            </div>
            <button onClick={openAddModal} className="flex items-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all">
              <Plus className="w-5 h-5" />
              <span>{t('create_group')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group, index) => (
            <motion.div key={group.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all overflow-hidden">
              {(() => {
                const level = getLevel(group.level);
                return (
              <div 
                onClick={() => router.push(`/admin/students?group=${encodeURIComponent(group.name)}`)}
                className="cursor-pointer"
              >
                <div className={`w-16 h-16 bg-gradient-to-br ${levelColors[level]} rounded-2xl flex items-center justify-center mb-4`}>
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 break-words">{group.name}</h3>
                <p className="text-sm text-gray-500 mb-4 break-words">{group.description}</p>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${levelColors[level]} text-white`}>
                      {level}
                    </span>
                    {(level === 'Intermediate' || level === 'Advanced') ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-black text-amber-300 border border-amber-300/40">
                        CEFR
                      </span>
                    ) : null}
                    {level === 'IELTS' ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-black text-amber-300 border border-amber-300/40">
                        IELTS
                      </span>
                    ) : null}
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/admin/students?group=${encodeURIComponent(group.name)}`);
                    }}
                    className="flex items-center space-x-1 text-gray-600 cursor-pointer hover:text-purple-600"
                  >
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">{group.studentCount || 0} {t('students_count')}</span>
                  </div>
                </div>
              </div>
                );
              })()}
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleEditGroup(group)}
                  className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100"
                >
                  <Edit className="w-4 h-4" />
                  <span className="text-sm">{t('edit')}</span>
                </button>
                <button 
                  onClick={() => handleDeleteGroup(group.id)} 
                  className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">{t('delete')}</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto my-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('create_new_group')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('group_name')} *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" placeholder={t('group_name')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('level')} *</label>
                <div className="space-y-3">
                  <div className="rounded-xl border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Foundation</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Beginner', 'Elementary'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handleSelectFoundationLevel(level)}
                          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${formData.level === level ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-purple-50'}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-300/60 bg-amber-50/40 p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">CEFR</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Intermediate', 'Advanced'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handleSelectCefrLevel(level)}
                          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${formData.level === level ? 'bg-black border-black text-amber-300' : 'bg-white border-amber-300/60 text-amber-800 hover:bg-amber-100/70'}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-amber-700 mt-2">CEFR guruhlar `Scores` bo‘limida yangi L/R/W/S CEFR moduliga ulanadi.</p>
                  </div>

                  <div className="rounded-xl border border-amber-400/60 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-3">
                    <p className="text-xs font-semibold text-amber-300 mb-2 uppercase tracking-wide">IELTS</p>
                    <button
                      type="button"
                      onClick={handleSelectIeltsTrack}
                      className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-all ${formData.level === 'IELTS' ? 'bg-amber-400 border-amber-400 text-black' : 'bg-black/30 border-amber-400/40 text-amber-200 hover:bg-black/50'}`}
                    >
                      IELTS Advanced (6-Modul)
                    </button>
                    <p className="text-[11px] text-amber-200 mt-2">Listening/Reading, Writing/Speaking, Grammar/Vocab, Article/Attendance bloklari yoqiladi.</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Tanlangan yo‘nalish: <span className="font-semibold">{programTrack === 'ielts' ? 'IELTS' : (programTrack === 'cefr' ? 'CEFR' : 'Foundation')}</span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('description')}</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" rows={3} placeholder={t('brief_description')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telegram Group ID</label>
                <input
                  type="text"
                  value={formData.telegramChatId}
                  onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="-1002616498594"
                />
                <p className="text-xs text-gray-500 mt-1">-100... formatida kiriting. Saqlashda bot admin huquqi tekshiriladi.</p>
              </div>
              {programTrack === 'ielts' ? (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  IELTS tanlandi ✅ Avval guruhni yarating, keyin <span className="font-semibold">Edit</span> orqali IELTS modul va Progress Map ni to‘ldirasiz.
                </div>
              ) : null}
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => { setShowAddModal(false); setFormData({ name: '', level: 'Beginner', description: '', telegramChatId: '' }); }} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleAddGroup} className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg">{t('create_group')}</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Group Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto my-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('edit')} {t('group')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('group_name')} *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" placeholder={t('group_name')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('level')} *</label>
                <div className="space-y-3">
                  <div className="rounded-xl border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Foundation</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Beginner', 'Elementary'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handleSelectFoundationLevel(level)}
                          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${formData.level === level ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-purple-50'}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-300/60 bg-amber-50/40 p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">CEFR</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Intermediate', 'Advanced'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handleSelectCefrLevel(level)}
                          className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${formData.level === level ? 'bg-black border-black text-amber-300' : 'bg-white border-amber-300/60 text-amber-800 hover:bg-amber-100/70'}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-amber-700 mt-2">CEFR guruhlar `Scores` bo‘limida yangi L/R/W/S CEFR moduliga ulanadi.</p>
                  </div>

                  <div className="rounded-xl border border-amber-400/60 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-3">
                    <p className="text-xs font-semibold text-amber-300 mb-2 uppercase tracking-wide">IELTS</p>
                    <button
                      type="button"
                      onClick={handleSelectIeltsTrack}
                      className={`w-full px-3 py-2 rounded-lg border text-sm font-medium transition-all ${formData.level === 'IELTS' ? 'bg-amber-400 border-amber-400 text-black' : 'bg-black/30 border-amber-400/40 text-amber-200 hover:bg-black/50'}`}
                    >
                      IELTS Advanced (6-Modul)
                    </button>
                    <p className="text-[11px] text-amber-200 mt-2">Listening/Reading, Writing/Speaking, Grammar/Vocab, Article/Attendance bloklari yoqiladi.</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Tanlangan yo‘nalish: <span className="font-semibold">{programTrack === 'ielts' ? 'IELTS' : (programTrack === 'cefr' ? 'CEFR' : 'Foundation')}</span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('description')}</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none" rows={3} placeholder={t('brief_description')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telegram Group ID</label>
                <input
                  type="text"
                  value={formData.telegramChatId}
                  onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="-1002616498594"
                />
                <p className="text-xs text-gray-500 mt-1">-100... formatida kiriting. Saqlashda bot admin huquqi tekshiriladi.</p>
              </div>
              {programTrack === 'ielts' && editingGroup ? renderIeltsBlocks() : null}
            </div>
            <div className="flex space-x-3 mt-6">
              <button onClick={() => { setShowEditModal(false); setEditingGroup(null); setFormData({ name: '', level: 'Beginner', description: '', telegramChatId: '' }); setProgramTrack('foundation'); setIeltsProgress(defaultIeltsProgressForm()); setIeltsFeedback(''); }} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">{t('cancel')}</button>
              <button onClick={handleUpdateGroup} className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:shadow-lg">{t('update_group')}</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}