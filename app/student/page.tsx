"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getDataForAdmin } from '@/lib/storage';
import { useApp } from '@/lib/app-context';
import { BookOpen, BarChart3, LogOut, GraduationCap, AlertCircle, Brain, Trophy, Target, BookMarked, ChevronLeft, ChevronRight, Timer, FileText } from 'lucide-react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from 'recharts';

type SkillResult = {
  key: string;
  label: string;
  score: number;
};

type WordStatus = 'Learning' | 'Learned';

type BadgeResult = {
  key: string;
  title: string;
  description: string;
  earned: boolean;
};

type WeeklyHeroBadge = {
  title: string;
  weekKey: string;
  rank: number;
  badgeEndAt: string;
};

const skillLabels: Record<string, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  speaking: 'Speaking',
  reading: 'Reading',
  writing: 'Writing',
  listening: 'Listening',
};

const skillColors: Record<string, string> = {
  vocabulary: 'bg-blue-500',
  grammar: 'bg-purple-500',
  speaking: 'bg-green-500',
  reading: 'bg-orange-500',
  writing: 'bg-pink-500',
  listening: 'bg-teal-500',
};

const RADAR_KEYS = ['speaking', 'listening', 'reading', 'writing', 'vocabulary'] as const;

const LEVELS = [
  { name: 'Beginner 1', min: 0, max: 300 },
  { name: 'Beginner 2', min: 300, max: 650 },
  { name: 'Intermediate 1', min: 650, max: 1050 },
  { name: 'Intermediate 2', min: 1050, max: 1600 },
  { name: 'Advanced', min: 1600, max: 99999 },
];

const ADVISOR_LINKS: Record<string, string> = {
  listening: 'https://www.youtube.com/results?search_query=ielts+listening+multiple+choice+tips',
  reading: 'https://www.youtube.com/results?search_query=ielts+reading+skimming+scanning+strategy',
  writing: 'https://www.youtube.com/results?search_query=ielts+writing+task+2+structure',
  speaking: 'https://www.youtube.com/results?search_query=ielts+speaking+part+2+band+7',
  vocabulary: 'https://www.youtube.com/results?search_query=english+vocabulary+active+recall+method',
};

function safePercent(value: unknown) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function sectionPercent(score: any, key: string) {
  const section = score?.breakdown?.[key];
  if (section && typeof section === 'object') {
    const pct = Number((section as any).percent);
    if (Number.isFinite(pct)) return safePercent(pct);
    const s = Number((section as any).score);
    const max = Number((section as any).maxScore ?? 100);
    if (Number.isFinite(s) && Number.isFinite(max) && max > 0) return safePercent((s / max) * 100);
  }
  return 0;
}

function normalizeTrackLevel(raw?: string | null) {
  const value = String(raw || '').trim().toLowerCase()
  if (value.includes('advanced')) return 'advanced'
  if (value.includes('intermediate')) return 'intermediate'
  return 'other'
}

export default function StudentDashboard() {
  const router = useRouter();
  const {
    currentStudent,
    impersonating,
    impersonationWarning,
    clearImpersonationWarning,
    logoutStudent,
    t,
  } = useApp();
  const [student, setStudent] = useState<any | null>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [averageScore, setAverageScore] = useState(0);
  const [skillBreakdown, setSkillBreakdown] = useState<SkillResult[]>([]);
  const [latestScoreDate, setLatestScoreDate] = useState<string | null>(null);
  const [ranking, setRanking] = useState({ weeklyRank: 0, mockRank: 0, totalInGroup: 0 });
  const [goalText, setGoalText] = useState('Keyingi mockda 85%+ olish');
  const [goalProgress, setGoalProgress] = useState(0);
  const [wordStatuses, setWordStatuses] = useState<Record<string, WordStatus>>({});
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [certificates, setCertificates] = useState<Array<{ id: number; fileName: string; fileUrl: string; fileType?: string; uploadedAt?: string }>>([]);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState('');
  const [weeklyHeroBadge, setWeeklyHeroBadge] = useState<WeeklyHeroBadge | null>(null);
  const adminScope = student?.adminId ? String(student.adminId) : 'system';

  useEffect(() => {
    if (currentStudent) {
      setStudent(currentStudent);
      return;
    }

    const stored = localStorage.getItem('currentStudent');
    if (stored) {
      try {
        setStudent(JSON.parse(stored));
      } catch {
        localStorage.removeItem('currentStudent');
        router.replace('/');
      }
    } else {
      router.replace('/');
    }
  }, [currentStudent, router]);

  useEffect(() => {
    if (!student) return;

    try {
      const savedGoalText = localStorage.getItem(`student-goal-text:${student.id}`);
      const savedGoalProgress = Number(localStorage.getItem(`student-goal-progress:${student.id}`) || 0);
      const savedWordStatuses = localStorage.getItem(`student-word-status:${student.id}`);

      if (savedGoalText) setGoalText(savedGoalText);
      if (Number.isFinite(savedGoalProgress)) setGoalProgress(Math.max(0, Math.min(100, savedGoalProgress)));
      if (savedWordStatuses) {
        const parsed = JSON.parse(savedWordStatuses);
        if (parsed && typeof parsed === 'object') setWordStatuses(parsed);
      }
    } catch {
      // ignore localStorage parse issues
    }

    (async () => {
      try {
        const [allScores, allStudents] = await Promise.all([
          getDataForAdmin(adminScope, 'scores'),
          getDataForAdmin(adminScope, 'students'),
        ]);
        const studentScores = allScores.filter((s: any) =>
          String(s.studentId || '') === String(student.id) ||
          s.studentName === student.fullName
        ).sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setScores(studentScores);

        const studentGroup = (allStudents || []).find((s: any) => String(s.id) === String(student.id))?.group;
        if (studentGroup) {
          const [weeklyRes, mockRes] = await Promise.all([
            fetch(`/api/scores?mode=ranking&group=${encodeURIComponent(studentGroup)}&scoreType=weekly`).then((res) => res.json()),
            fetch(`/api/scores?mode=ranking&group=${encodeURIComponent(studentGroup)}&scoreType=mock`).then((res) => res.json()),
          ]);

          const weeklyRow = Array.isArray(weeklyRes)
            ? weeklyRes.find((row: any) => String(row.studentId) === String(student.id))
            : null;
          const mockRow = Array.isArray(mockRes)
            ? mockRes.find((row: any) => String(row.studentId) === String(student.id))
            : null;

          const totalInGroup = Array.isArray(weeklyRes) ? weeklyRes.length : 0;
          setRanking({
            weeklyRank: Number(weeklyRow?.rank || 0),
            mockRank: Number(mockRow?.rank || 0),
            totalInGroup,
          });
        }

        try {
          const badgeRes = await fetch(`/api/vocabulary/weekly-hero/active?studentId=${encodeURIComponent(String(student.id))}`)
          const badgeData = await badgeRes.json()
          if (badgeRes.ok && badgeData?.hasBadge && badgeData?.badge) {
            setWeeklyHeroBadge({
              title: String(badgeData.badge.title || 'Hafta Qahramoni'),
              weekKey: String(badgeData.badge.weekKey || ''),
              rank: Number(badgeData.badge.rank || 0),
              badgeEndAt: String(badgeData.badge.badgeEndAt || ''),
            })
          } else {
            setWeeklyHeroBadge(null)
          }
        } catch {
          setWeeklyHeroBadge(null)
        }

        if (studentScores.length > 0) {
          const latest = studentScores[0];
          const avg = studentScores.reduce((sum: number, item: any) => sum + safePercent(item?.overallPercent ?? item?.value), 0) / studentScores.length;
          setAverageScore(Math.round(avg));
          setSkillBreakdown(
            RADAR_KEYS.map((key) => ({
              key,
              label: skillLabels[key],
              score: sectionPercent(latest, key),
            })).filter((item) => item.score > 0)
          );
          setLatestScoreDate(latest.createdAt || null);
        } else {
          setAverageScore(0);
          setSkillBreakdown([]);
          setLatestScoreDate(null);
          setRanking({ weeklyRank: 0, mockRank: 0, totalInGroup: 0 });
        }

        const trackLevel = normalizeTrackLevel(studentScores[0]?.level || student?.level)
        const canUseCertificates = trackLevel === 'intermediate' || trackLevel === 'advanced'
        if (adminScope !== 'system' && canUseCertificates) {
          setCertLoading(true)
          setCertError('')
          try {
            const certRes = await fetch(`/api/certificates?studentId=${encodeURIComponent(String(student.id))}`, {
              headers: {
                'x-admin-id': String(adminScope),
              },
            })
            const certData = await certRes.json()
            if (!certRes.ok) {
              throw new Error(String(certData?.error || 'Sertifikatlarni yuklashda xatolik'))
            }
            setCertificates(Array.isArray(certData) ? certData : [])
          } catch (certError: any) {
            setCertError(String(certError?.message || 'Sertifikatlarni yuklashda xatolik'))
            setCertificates([])
          } finally {
            setCertLoading(false)
          }
        } else {
          setCertificates([])
        }
      } catch (error) {
        console.error('Error loading scores:', error);
      }
    })();
  }, [student, adminScope]);

  useEffect(() => {
    if (!student) return;
    localStorage.setItem(`student-goal-text:${student.id}`, goalText);
  }, [student, goalText]);

  useEffect(() => {
    if (!student) return;
    localStorage.setItem(`student-goal-progress:${student.id}`, String(goalProgress));
  }, [student, goalProgress]);

  useEffect(() => {
    if (!student) return;
    localStorage.setItem(`student-word-status:${student.id}`, JSON.stringify(wordStatuses));
  }, [student, wordStatuses]);

  const handleLogout = () => {
    logoutStudent();
    router.push('/');
  };

  if (!student) return null;

  const radarData = RADAR_KEYS.map((key) => {
    if (!scores.length) return { skill: skillLabels[key], percent: 0, key };
    const avg = scores.reduce((sum: number, score: any) => sum + sectionPercent(score, key), 0) / scores.length;
    return { skill: skillLabels[key], percent: Number(avg.toFixed(1)), key };
  });

  const weakestRadar = [...radarData].sort((a, b) => a.percent - b.percent)[0];
  const latestBreakdown = scores[0]?.breakdown && typeof scores[0]?.breakdown === 'object' ? scores[0].breakdown : {};
  const weakestPart = weakestRadar?.key && latestBreakdown?.[weakestRadar.key]?.weakestPart
    ? String(latestBreakdown[weakestRadar.key].weakestPart)
    : '';

  const totalPoints = Math.round(scores.reduce((sum: number, item: any) => sum + safePercent(item?.overallPercent ?? item?.value), 0));
  const currentLevel = LEVELS.find((lvl, idx) => totalPoints >= lvl.min && totalPoints < lvl.max && idx < LEVELS.length - 1) || LEVELS[LEVELS.length - 1];
  const currentLevelIndex = LEVELS.findIndex((lvl) => lvl.name === currentLevel.name);
  const nextLevel = LEVELS[currentLevelIndex + 1] || null;
  const levelRange = Math.max(1, (currentLevel.max - currentLevel.min));
  const levelProgress = nextLevel ? Math.max(0, Math.min(100, ((totalPoints - currentLevel.min) / levelRange) * 100)) : 100;

  const vocabularyPerfectStreak = (() => {
    let streak = 0;
    for (const item of scores) {
      if (sectionPercent(item, 'vocabulary') >= 99.5) streak += 1;
      else break;
    }
    return streak;
  })();

  const grammarStrongCount = scores.filter((item) => sectionPercent(item, 'grammar') >= 90).length;
  const firstOverall = scores.length ? safePercent(scores[scores.length - 1]?.overallPercent ?? scores[scores.length - 1]?.value) : 0;
  const latestOverall = scores.length ? safePercent(scores[0]?.overallPercent ?? scores[0]?.value) : 0;
  const fastLearnerDelta = latestOverall - firstOverall;

  const badges: BadgeResult[] = [
    {
      key: 'vocabulary-king',
      title: 'Vocabulary King',
      description: 'Ketma-ket 3 ta 100% Vocabulary natija',
      earned: vocabularyPerfectStreak >= 3,
    },
    {
      key: 'grammar-ninja',
      title: 'Grammar Ninja',
      description: 'Grammar bo‘yicha 3 marta 90%+',
      earned: grammarStrongCount >= 3,
    },
    {
      key: 'fast-learner',
      title: 'Fast Learner',
      description: 'Boshlang‘ich natijaga nisbatan +15% o‘sish',
      earned: fastLearnerDelta >= 15,
    },
    {
      key: 'gold-medal',
      title: 'Gold Medal',
      description: 'Umumiy 95%+ natija',
      earned: scores.some((item) => safePercent(item?.overallPercent ?? item?.value) >= 95),
    },
  ];

  const wordBank = (() => {
    const words = new Set<string>();
    for (const score of scores) {
      const vocab = score?.breakdown?.vocabulary;
      if (!vocab || typeof vocab !== 'object') continue;

      const sourceWords = Array.isArray(vocab.sourceWordList) ? vocab.sourceWordList : [];
      const learnedWords = Array.isArray(vocab.wordList) ? vocab.wordList : [];
      [...sourceWords, ...learnedWords].forEach((item: any) => {
        const clean = String(item || '').trim();
        if (clean) words.add(clean);
      });
    }
    return Array.from(words);
  })();

  const currentWord = wordBank[flashcardIndex] || '';
  const currentWordStatus = currentWord ? (wordStatuses[currentWord] || 'Learning') : 'Learning';

  const now = new Date();
  const mockDates = scores
    .filter((item: any) => String(item?.scoreType || '').toLowerCase() === 'mock')
    .map((item: any) => new Date(item?.examDateTime || item?.createdAt || now))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const nextExamDate = mockDates.find((date) => date.getTime() > now.getTime())
    || (mockDates.length ? new Date(mockDates[mockDates.length - 1].getTime() + 1000 * 60 * 60 * 24 * 14) : new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14));
  const countdownMs = Math.max(0, nextExamDate.getTime() - now.getTime());
  const countdownDays = Math.floor(countdownMs / (1000 * 60 * 60 * 24));
  const countdownHours = Math.floor((countdownMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  const advisorMessage = weakestRadar
    ? `Salom ${student.fullName}! ${weakestRadar.skill} bo‘yicha natijang ${weakestRadar.percent}%.${weakestPart ? ` Eng qiyin qism: ${weakestPart}.` : ''} Shu bo‘limni kuchaytirish uchun har kuni 20 daqiqa focused practice qil.`
    : `${student.fullName}, oxirgi natijalar kelishi bilan men sen uchun aniq tavsiyalarni chiqaraman.`;

  const derivedTrackLevel = normalizeTrackLevel(scores[0]?.level || student?.level)
  const certificateAllowed = derivedTrackLevel === 'intermediate' || derivedTrackLevel === 'advanced'

  const loadCertificates = async () => {
    if (!student?.id || !adminScope || adminScope === 'system' || !certificateAllowed) {
      setCertificates([])
      return
    }
    setCertLoading(true)
    setCertError('')
    try {
      const response = await fetch(`/api/certificates?studentId=${encodeURIComponent(String(student.id))}`, {
        headers: {
          'x-admin-id': String(adminScope),
        },
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(String(data?.error || 'Sertifikatlarni yuklashda xatolik'))
      }
      setCertificates(Array.isArray(data) ? data : [])
    } catch (error: any) {
      setCertError(String(error?.message || 'Sertifikatlarni yuklashda xatolik'))
    } finally {
      setCertLoading(false)
    }
  }

  const menuItems = [
    { icon: BookOpen, label: t('my_lessons'), href: '/student/lessons', color: 'from-blue-500 to-blue-600' },
    { icon: FileText, label: t('pending_tasks'), href: '/student/homework', color: 'from-emerald-500 to-emerald-600' },
    { icon: BarChart3, label: t('my_scores'), href: '/student/scores', color: 'from-orange-500 to-orange-600' },
    { icon: Brain, label: 'AI Vocabulary Proctor', href: '/student/vocabulary', color: 'from-indigo-500 to-purple-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kevin's Academy</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{student?.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('student')}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {impersonationWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-100 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl text-sm flex items-start justify-between"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 mt-0.5" />
              <div>
                <p className="font-semibold">{t('viewing_as_student')}</p>
                <p className="text-xs">{t('logout_to_admin_hint')}</p>
              </div>
            </div>
            <button
              onClick={clearImpersonationWarning}
              className="text-xs underline hover:text-yellow-900"
            >
              {t('dismiss')}
            </button>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-black via-zinc-900 to-zinc-800 rounded-2xl p-8 text-amber-100 border border-amber-300/20"
        >
          <h2 className="text-3xl font-bold mb-2">{t('welcome_back')}, {student.fullName}!</h2>
          <p className="text-amber-200/90">{t('review_lessons_scores')}</p>
          {weeklyHeroBadge ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-400/20 px-4 py-2">
              <Trophy className="w-4 h-4 text-amber-300" />
              <span className="text-sm font-semibold text-amber-100">{weeklyHeroBadge.title} • TOP-{weeklyHeroBadge.rank}</span>
              <span className="text-xs text-amber-200/90">{weeklyHeroBadge.weekKey} · {weeklyHeroBadge.badgeEndAt ? ` ${new Date(weeklyHeroBadge.badgeEndAt).toLocaleDateString()} gacha` : ''}</span>
            </div>
          ) : null}
        </motion.div>

        <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="xl:col-span-2 bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Visual Skill Wheel</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">L/R/S/W/V</span>
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="skill" />
                  <Radar name="Skills" dataKey="percent" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.28} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-gradient-to-br from-black via-zinc-900 to-zinc-800 rounded-2xl shadow-lg border border-amber-300/30 p-6 text-amber-100"
          >
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-amber-300" />
              <h3 className="text-lg font-semibold">Level Progress</h3>
            </div>
            <p className="text-sm text-amber-200">Current: <span className="font-semibold">{currentLevel.name}</span></p>
            <p className="text-xs text-amber-300 mt-1">Total XP: {totalPoints}</p>
            <div className="w-full bg-zinc-700 rounded-full h-3 mt-4">
              <div className="h-3 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300" style={{ width: `${levelProgress}%` }} />
            </div>
            <p className="text-xs text-amber-300 mt-2">{nextLevel ? `Next: ${nextLevel.name}` : 'Max level reached'}</p>
            <div className="mt-4 space-y-2">
              {badges.map((badge) => (
                <div key={badge.key} className={`rounded-lg border px-3 py-2 ${badge.earned ? 'bg-amber-400/20 border-amber-300/60' : 'bg-zinc-800/60 border-zinc-600'}`}>
                  <p className="text-sm font-semibold">{badge.earned ? '🏅' : '🔒'} {badge.title}</p>
                  <p className="text-[11px] text-amber-200/90">{badge.description}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-1 bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{t('average_score')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('latest_overall_performance')}{latestScoreDate ? ` · ${new Date(latestScoreDate).toLocaleDateString()}` : ''}
            </p>
            <div className="flex items-end space-x-4">
              <span className="text-5xl font-bold text-gray-900 dark:text-white">{averageScore}%</span>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('keep_practicing')}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('skill_breakdown')}</h3>
            {skillBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('no_scores_recorded')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {skillBreakdown.map((skill, index) => (
                  <motion.div
                    key={skill.key}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{skill.label}</span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{skill.score}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${skill.score}%` }}
                        transition={{ duration: 0.6 }}
                        className={`${skillColors[skill.key] || 'bg-blue-500'} h-2 rounded-full`}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('group_weekly_rank')}</p>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-300">{ranking.weeklyRank ? `#${ranking.weeklyRank}` : 'N/A'}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('group_mock_rank')}</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-300">{ranking.mockRank ? `#${ranking.mockRank}` : 'N/A'}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('students_in_group')}</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-300">{ranking.totalInGroup || 0}</p>
          </motion.div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Kevin Advisor</h3>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{advisorMessage}</p>
            {weakestRadar?.key ? (
              <a
                href={ADVISOR_LINKS[weakestRadar.key]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex mt-4 px-3 py-2 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 text-sm"
              >
                Tavsiya video resursini ochish
              </a>
            ) : null}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <Timer className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Exam Countdown & Goals</h3>
            </div>
            <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 mb-4">
              <p className="text-sm text-orange-700">Keyingi mock/examgacha</p>
              <p className="text-2xl font-bold text-orange-800">{countdownDays} kun {countdownHours} soat</p>
              <p className="text-xs text-orange-700 mt-1">{nextExamDate.toLocaleDateString()}</p>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mening maqsadim</label>
              <input
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Masalan: Keyingi oyda 85%+ olish"
              />
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Goal progress</span>
                  <span>{goalProgress}%</span>
                </div>
                <input type="range" min={0} max={100} value={goalProgress} onChange={(e) => setGoalProgress(Number(e.target.value || 0))} className="w-full" />
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 rounded-full" style={{ width: `${goalProgress}%` }} />
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Vocabulary Vault</h3>
            </div>
            <span className="text-xs text-gray-500">{wordBank.length} words</span>
          </div>

          {wordBank.length === 0 ? (
            <p className="text-sm text-gray-500">Hali word bank to‘planmagan.</p>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-1 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <p className="text-xs text-blue-700 mb-2">Flashcard</p>
                <p className="text-2xl font-bold text-blue-900 break-words min-h-[40px]">{currentWord}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFlashcardIndex((prev) => (prev - 1 + wordBank.length) % wordBank.length)}
                    className="p-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlashcardIndex((prev) => (prev + 1) % wordBank.length)}
                    className="p-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWordStatuses((prev) => ({ ...prev, [currentWord]: currentWordStatus === 'Learned' ? 'Learning' : 'Learned' }))}
                    className={`ml-auto px-3 py-2 text-sm rounded-lg border ${currentWordStatus === 'Learned' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}
                  >
                    {currentWordStatus}
                  </button>
                </div>
              </div>

              <div className="xl:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                {wordBank.map((word) => {
                  const status = wordStatuses[word] || 'Learning';
                  return (
                    <button
                      key={word}
                      type="button"
                      onClick={() => setFlashcardIndex(wordBank.findIndex((item) => item === word))}
                      className="text-left rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{word}</p>
                      <p className={`text-[11px] mt-1 ${status === 'Learned' ? 'text-green-600' : 'text-amber-600'}`}>{status}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mening sertifikatim</h3>
            {certificateAllowed ? <span className="text-xs text-emerald-600">Intermediate/Advanced</span> : <span className="text-xs text-gray-500">Beginner/Elementary</span>}
          </div>

          {!certificateAllowed ? (
            <p className="text-sm text-gray-500">Bu bo‘lim faqat intermediate va advanced o‘quvchilar uchun ochiq.</p>
          ) : (
            <>
              <p className="text-xs text-gray-600 mb-3">Sertifikatlar admin panel orqali yuklanadi. Siz bu yerda ko‘rish va yuklab olish imkoniga egasiz.</p>
              {certError ? <p className="text-sm text-red-500 mt-1">{certError}</p> : null}

              <div className="mt-4 space-y-2">
                {certLoading ? (
                  <p className="text-sm text-gray-500">Sertifikatlar yuklanmoqda...</p>
                ) : certificates.length === 0 ? (
                  <p className="text-sm text-gray-500">Hali sertifikat yuklanmagan.</p>
                ) : (
                  certificates.map((item) => (
                    <div key={item.id} className="rounded-lg border border-gray-200 px-3 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-gray-800">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium truncate hover:underline">
                            {item.fileName}
                          </a>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{item.uploadedAt ? new Date(item.uploadedAt).toLocaleString('uz-UZ') : ''}</p>
                      </div>
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 text-xs rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        Yuklab olish
                      </a>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800/80 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('navigation')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {menuItems.map((item, index) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => router.push(item.href)}
                className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all text-left"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mb-3`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{item.label}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {item.href === '/student/lessons'
                    ? t('view_materials_teacher')
                    : item.href === '/student/homework'
                      ? t('teacher_no_homework_yet')
                      : item.href === '/student/vocabulary'
                        ? 'AI quiz, peer-check va smart flashcards'
                        : t('track_detailed_scores')}
                </p>
              </motion.button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
