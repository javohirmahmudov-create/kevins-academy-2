'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, Award, Brain, TrendingUp } from 'lucide-react';
import { getDataForAdmin } from '@/lib/storage';
import { useApp } from '@/lib/app-context';
import { Line, LineChart, ResponsiveContainer } from 'recharts';

const SECTION_LABELS: Record<string, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  speed_reading: 'Speed Reading',
  translation: 'Translation',
  attendance: 'Participation',
  listening: 'Listening',
  reading: 'Reading',
  speaking: 'Speaking',
  writing: 'Writing',
};

const SECTION_ICON: Record<string, string> = {
  vocabulary: '📚',
  grammar: '🧠',
  speed_reading: '📖',
  translation: '🔁',
  attendance: '🔥',
  listening: '🎧',
  reading: '📘',
  speaking: '🗣️',
  writing: '✍️',
};

const FOUNDATION_KEYS = ['grammar', 'vocabulary', 'speed_reading', 'translation', 'attendance'];
const ACADEMIC_KEYS = ['listening', 'reading', 'writing', 'speaking', 'grammar', 'vocabulary', 'translation'];

const normalizeLevel = (raw?: string | null) => {
  const value = String(raw || '').toLowerCase();
  if (value.includes('advanced')) return 'advanced';
  if (value.includes('intermediate')) return 'intermediate';
  if (value.includes('elementary')) return 'elementary';
  return 'beginner';
};

const sectionPercent = (value: any) => {
  if (value && typeof value === 'object') {
    const directPercent = Number((value as any).percent);
    if (Number.isFinite(directPercent)) return Math.max(0, Math.min(100, directPercent));
    const score = Number((value as any).score);
    const max = Number((value as any).maxScore ?? 100);
    if (Number.isFinite(score) && Number.isFinite(max) && max > 0) {
      return Math.max(0, Math.min(100, (score / max) * 100));
    }
  }
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0;
};

function ProgressRing({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(100, value));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <svg width="84" height="84" viewBox="0 0 84 84">
      <circle cx="42" cy="42" r={radius} stroke="#3f3f46" strokeWidth="8" fill="none" />
      <circle
        cx="42"
        cy="42"
        r={radius}
        stroke="#fbbf24"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="47" textAnchor="middle" className="fill-zinc-100 text-sm font-bold">
        {Math.round(safe)}%
      </text>
    </svg>
  );
}

export default function StudentScoresPage() {
  const router = useRouter();
  const { currentStudent, t, language } = useApp();
  const [student, setStudent] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [averageScore, setAverageScore] = useState(0);
  const [advisorText, setAdvisorText] = useState('');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const adminScope = student?.adminId ? String(student.adminId) : 'system';

  useEffect(() => {
    if (currentStudent) {
      setStudent(currentStudent);
      return;
    }

    const stored = localStorage.getItem('currentStudent');
    if (!stored) {
      router.replace('/');
      return;
    }

    try {
      setStudent(JSON.parse(stored));
    } catch {
      localStorage.removeItem('currentStudent');
      router.replace('/');
    }
  }, [currentStudent, router]);

  useEffect(() => {
    if (!student) return;

    (async () => {
      const allScores = (await getDataForAdmin(adminScope, 'scores')) || [];
      const studentScores = allScores
        .filter((score: any) =>
          String(score.studentId || '') === String(student.id) ||
          score.studentName === student.fullName
        )
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setScores(studentScores);

      if (studentScores.length === 0) {
        setAverageScore(0);
        return;
      }

      const total = studentScores.reduce((sum: number, score: any) => sum + Number(score.overallPercent ?? score.value ?? 0), 0);
      setAverageScore(Math.round(total / studentScores.length));
    })();
  }, [student, adminScope]);

  useEffect(() => {
    if (!student) {
      setAdvisorText('');
      setAdvisorLoading(false);
      return;
    }

    const latestScore = scores[0];
    const latestLevel = normalizeLevel(latestScore?.level || student?.level);
    const isAcademic = latestLevel === 'intermediate' || latestLevel === 'advanced';
    const activeKeys = isAcademic ? ACADEMIC_KEYS : FOUNDATION_KEYS;
    const latestBreakdown = latestScore?.breakdown && typeof latestScore?.breakdown === 'object' ? latestScore.breakdown : {};
    const sectionCards = activeKeys
      .filter((key) => latestBreakdown?.[key] !== undefined)
      .map((key) => {
        const raw = latestBreakdown[key];
        const percent = sectionPercent(raw);
        return {
          key,
          label: SECTION_LABELS[key] || key,
          icon: SECTION_ICON[key] || '📌',
          percent,
        };
      });

    const trendData = scores
      .slice(0, 5)
      .reverse()
      .map((item, index) => ({
        index: index + 1,
        score: Number(item?.overallPercent ?? item?.value ?? 0),
      }));

    const weakestSection = sectionCards.length ? [...sectionCards].sort((a, b) => a.percent - b.percent)[0] : null;
    const weakestPart = weakestSection?.key && latestBreakdown?.[weakestSection.key]?.weakestPart
      ? String(latestBreakdown[weakestSection.key].weakestPart)
      : '';
    const advisorFallbackText = weakestSection
      ? `${student.fullName}, bu hafta ${weakestSection.label}${weakestPart ? ` (${weakestPart})` : ''} bo‘yicha ko‘proq mashq qil!`
      : `${student.fullName}, yangi baholar kirishi bilan shaxsiy tavsiya chiqadi.`;

    if (!scores.length) {
      setAdvisorText(advisorFallbackText);
      setAdvisorLoading(false);
      return;
    }

    let cancelled = false;
    setAdvisorLoading(true);

    (async () => {
      try {
        const response = await fetch('/api/ai/student-advisor', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: student.fullName,
            level: latestLevel,
            averageScore,
            weakestSection: weakestSection?.label || '',
            weakestPart,
            trend: trendData,
            sections: sectionCards,
          }),
        });

        const data = await response.json();
        if (cancelled) return;

        if (response.ok && data?.advice) {
          setAdvisorText(String(data.advice));
        } else {
          setAdvisorText(advisorFallbackText);
        }
      } catch {
        if (!cancelled) setAdvisorText(advisorFallbackText);
      } finally {
        if (!cancelled) setAdvisorLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [student, scores, averageScore]);

  if (!student) return null;

  const getWeekdayLabel = (score: any) => {
    const dateValue = score?.examDateTime || score?.createdAt;
    const date = new Date(dateValue || Date.now());
    if (Number.isNaN(date.getTime())) return t('not_available');

    const locale = language === 'uz' ? 'uz-UZ' : 'en-US';
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  };

  const formatPercent = (value: unknown) => {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return '0.0%';
    return `${numeric.toFixed(1)}%`;
  };

  const latestScore = scores[0];
  const latestLevel = normalizeLevel(latestScore?.level || student?.level);
  const isAcademic = latestLevel === 'intermediate' || latestLevel === 'advanced';
  const activeKeys = isAcademic ? ACADEMIC_KEYS : FOUNDATION_KEYS;

  const latestBreakdown = latestScore?.breakdown && typeof latestScore?.breakdown === 'object' ? latestScore.breakdown : {};
  const sectionCards = activeKeys
    .filter((key) => latestBreakdown?.[key] !== undefined)
    .map((key) => {
      const raw = latestBreakdown[key];
      const percent = sectionPercent(raw);
      return {
        key,
        label: SECTION_LABELS[key] || key,
        icon: SECTION_ICON[key] || '📌',
        percent,
      };
    });

  const trendData = scores
    .slice(0, 5)
    .reverse()
    .map((item, index) => ({
      index: index + 1,
      score: Number(item?.overallPercent ?? item?.value ?? 0),
    }));

  const weakestSection = sectionCards.length ? [...sectionCards].sort((a, b) => a.percent - b.percent)[0] : null;
  const weakestPart = weakestSection?.key && latestBreakdown?.[weakestSection.key]?.weakestPart
    ? String(latestBreakdown[weakestSection.key].weakestPart)
    : '';
  const advisorFallbackText = weakestSection
    ? `${student.fullName}, bu hafta ${weakestSection.label}${weakestPart ? ` (${weakestPart})` : ''} bo‘yicha ko‘proq mashq qil!`
    : `${student.fullName}, yangi baholar kirishi bilan shaxsiy tavsiya chiqadi.`;

  const cefrBadge = isAcademic
    ? averageScore >= 85
      ? 'C1'
      : averageScore >= 70
        ? 'B2'
        : 'B1'
    : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-zinc-900">
      <header className="bg-black/90 border-b border-amber-300/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/student')}
              className="flex items-center space-x-2 text-amber-200 hover:text-amber-100 text-base"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>{t('back_to_dashboard')}</span>
            </button>
            <h1 className="text-2xl font-bold text-amber-200">{t('my_scores')}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-black via-zinc-900 to-zinc-800 rounded-2xl p-8 mb-8 text-amber-100 border border-amber-300/30"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-200/90 mb-2 text-base">{t('overall_average')}</p>
              <h2 className="text-5xl font-bold">{averageScore}%</h2>
              <p className="text-amber-200/90 mt-2 text-base">{t('keep_up_great_work')}</p>
            </div>
            <div className="text-right">
              {cefrBadge ? (
                <div className="inline-flex items-center px-5 py-3 rounded-2xl bg-amber-400 text-black text-3xl font-black">
                  {cefrBadge}
                </div>
              ) : null}
              <Award className="w-20 h-20 text-amber-300/30 ml-auto mt-3" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl border border-amber-300/30 bg-black/70 p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-amber-300" />
            <h3 className="text-xl font-bold text-amber-200">Kevin AI maslahati</h3>
          </div>
          <p className="text-2xl font-extrabold text-amber-100 tracking-wide">
            {advisorLoading ? 'Kevin AI maslahat tayyorlamoqda...' : (advisorText || advisorFallbackText)}
          </p>
        </motion.div>

        {trendData.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-2xl border border-amber-300/30 bg-black/70 p-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-amber-300" />
              <h3 className="text-xl font-bold text-amber-200">Weekly Trend (so‘nggi 5 dars)</h3>
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <Line type="monotone" dataKey="score" stroke="#fbbf24" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}

        {sectionCards.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {sectionCards.map((section, index) => (
              <motion.div
                key={section.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-2xl border border-amber-300/25 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold text-amber-100">{section.icon} {section.label}</p>
                  <ProgressRing value={section.percent} />
                </div>
              </motion.div>
            ))}
          </section>
        )}

        {scores.length === 0 ? (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-amber-100 mb-2">{t('no_scores_yet')}</h3>
            <p className="text-base text-amber-200/80">{t('teacher_no_scores_yet')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {scores.map((score, index) => (
              <motion.div
                key={score.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-lg border border-amber-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{score.subject || t('overall_score')}</h3>
                    <p className="text-base text-gray-600 mt-1 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full ${score.scoreType === 'mock' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {getWeekdayLabel(score)}
                      </span>
                      <span>{score.level || t('beginner')}</span>
                    </p>
                  </div>
                  <span className="text-base text-gray-500">{new Date(score.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-medium text-gray-700">{t('score')}</span>
                    <span className="text-base font-bold px-2 py-1 rounded text-amber-900 bg-amber-100">
                      {formatPercent(score.overallPercent ?? score.value)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400"
                      style={{ width: `${Math.max(0, Math.min(100, Number(score.overallPercent ?? score.value ?? 0)))}%` }}
                    />
                  </div>

                  {score.breakdown && typeof score.breakdown === 'object' && (
                    <div className="pt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(score.breakdown as Record<string, any>).map(([key, val]) => {
                        const percent = typeof val === 'object' && val !== null
                          ? Number((val as any).percent ?? (val as any).score ?? 0)
                          : Number(val || 0);
                        const sectionScore = typeof val === 'object' && val !== null
                          ? Number((val as any).score ?? 0)
                          : Number(val || 0);
                        const sectionMax = typeof val === 'object' && val !== null
                          ? Number((val as any).maxScore ?? 100)
                          : 100;
                        const sectionComment = typeof val === 'object' && val !== null && typeof (val as any).comment === 'string'
                          ? String((val as any).comment).trim()
                          : '';
                        const sectionWordList = typeof val === 'object' && val !== null && Array.isArray((val as any).wordList)
                          ? (val as any).wordList.map((item: any) => String(item || '').trim()).filter(Boolean)
                          : [];
                        const sectionCommentWithWords = sectionWordList.length > 0
                          ? `${sectionComment}${sectionComment ? ' · ' : ''}So'zlar: ${sectionWordList.join(', ')}`
                          : sectionComment;
                        return (
                          <div key={key} className="text-base text-gray-700 bg-amber-50 rounded-md px-3 py-2 border border-amber-100">
                            <div className="flex justify-between">
                              <span className="capitalize font-medium">{SECTION_ICON[key] || '📌'} {SECTION_LABELS[key] || key}</span>
                              <span className="font-semibold">{sectionScore}/{sectionMax} · {formatPercent(percent)}</span>
                            </div>
                            {sectionCommentWithWords ? (
                              <p className="mt-1 text-sm text-gray-600">{sectionCommentWithWords}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {score.comment && (
                    <div className="pt-2">
                      <p className="text-base text-gray-700 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
                        {score.comment}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
