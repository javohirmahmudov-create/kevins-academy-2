'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ThemeLanguageToggle } from '@/components/theme-language-toggle';
import { useApp } from '@/lib/app-context';
import { getDataForAdmin, Student, Score, Attendance, Payment, Parent } from '@/lib/storage';
import {
  User,
  Calendar,
  DollarSign,
  CreditCard,
  Copy,
  Check,
  ExternalLink,
  LogOut,
  GraduationCap,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock3
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

type ParentSession = Parent & { adminId: string };

interface LinkedChildOption {
  id: string;
  fullName: string;
}

interface ChildSummary {
  name: string;
  group: string;
  attendanceRate: number;
  overallScore: number;
  paymentStatus: Payment['status'];
  nextPaymentDue: string;
  paymentStartDate?: string;
  paymentAmount?: number;
  paymentTotalDue?: number;
  paymentPenaltyAmount?: number;
  paymentPenaltyPerDay?: number;
  paymentOverdueDays?: number;
}

interface SkillBreakdown {
  key: string;
  label: string;
  score: number;
  comment?: string;
}

interface ActivityItem {
  type: 'score' | 'attendance';
  title: string;
  description: string;
  sectionDetails?: Array<{ label: string; score: number; comment?: string }>;
  date: string;
}

interface AttendanceHistoryItem {
  date: string;
  status: string;
  note?: string;
}

interface RankingSummary {
  weeklyRank: number;
  mockRank: number;
  totalInGroup: number;
}

interface LeaderboardRow {
  studentId: string;
  studentName: string;
  weeklyRank: number;
  weeklyScore: number;
  mockRank: number;
  mockScore: number;
  isChild: boolean;
}

interface RankingDetailRow {
  studentId: string;
  studentName: string;
  rank: number;
  score: number;
}

interface ScoreHistoryRow {
  id: string;
  date: string;
  weekday: string;
  score: number;
  scoreType: 'weekly' | 'mock';
  subject: string;
  comment?: string;
}

type LeaderboardMetric = 'weeklyRank' | 'weeklyScore' | 'mockRank' | 'mockScore';

interface ParticipationInsight {
  emoji: string;
  label: string;
  score: number;
  comment?: string;
}

interface TranslationInsight {
  score: number;
  readingFlow: number;
  accuracy: number;
  pronunciation: number;
  comment?: string;
}

export default function ParentDashboard() {
  const router = useRouter();
  const { currentParent, logoutParent, t, language } = useApp();
  const [parentSession, setParentSession] = useState<ParentSession | null>(null);
  const [childSummary, setChildSummary] = useState<ChildSummary | null>(null);
  const [linkedChildren, setLinkedChildren] = useState<LinkedChildOption[]>([]);
  const [activeChildId, setActiveChildId] = useState('');
  const [skills, setSkills] = useState<SkillBreakdown[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryItem[]>([]);
  const [ranking, setRanking] = useState<RankingSummary>({ weeklyRank: 0, mockRank: 0, totalInGroup: 0 });
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [weeklyRankingDetails, setWeeklyRankingDetails] = useState<RankingDetailRow[]>([]);
  const [mockRankingDetails, setMockRankingDetails] = useState<RankingDetailRow[]>([]);
  const [scoreHistoryByStudent, setScoreHistoryByStudent] = useState<Record<string, { weekly: ScoreHistoryRow[]; mock: ScoreHistoryRow[] }>>({});
  const [leaderboardDetail, setLeaderboardDetail] = useState<{ studentId: string; metric: LeaderboardMetric } | null>(null);
  const [trendData, setTrendData] = useState<Array<Record<string, any>>>([]);
  const [selectedTrendDateKey, setSelectedTrendDateKey] = useState('');
  const [participationInsight, setParticipationInsight] = useState<ParticipationInsight | null>(null);
  const [translationInsight, setTranslationInsight] = useState<TranslationInsight | null>(null);
  const [paymentCardCopied, setPaymentCardCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paymentCardNumber = process.env.NEXT_PUBLIC_PAYMENT_CARD_NUMBER || '9860 3501 4447 3575';
  const paymentCardExpires = process.env.NEXT_PUBLIC_PAYMENT_CARD_EXPIRES || '08/30';

  const copyPaymentCard = async () => {
    try {
      await navigator.clipboard.writeText(String(paymentCardNumber).replace(/\s+/g, ''));
      setPaymentCardCopied(true);
      setTimeout(() => setPaymentCardCopied(false), 1800);
    } catch {
      setPaymentCardCopied(false);
    }
  };

  const formatDisplayDate = (value?: string) => {
    if (!value) return t('not_available');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('not_available');
    return date.toLocaleDateString(language === 'uz' ? 'uz-UZ' : 'en-US');
  };

  const formatDisplayDateWithWeekday = (value?: string) => {
    if (!value) return t('not_available');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('not_available');
    const locale = language === 'uz' ? 'uz-UZ' : 'en-US';
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    const formattedDate = date.toLocaleDateString(locale);
    const normalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${normalizedWeekday}, ${formattedDate}`;
  };

  const getWeekdayOnly = (value?: string) => {
    if (!value) return t('not_available');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('not_available');
    const locale = language === 'uz' ? 'uz-UZ' : 'en-US';
    const weekday = date.toLocaleDateString(locale, { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  };

  const getStatusLabel = (status?: string) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'present') return t('present');
    if (normalized === 'late') return t('late');
    if (normalized === 'absent') return t('absent');
    return t('not_available');
  };

  const getAttendanceBadgeClass = (status?: string) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'present') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (normalized === 'late') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
  };

  const loadChildData = async (sessionParent: ParentSession, preferredChildId?: string) => {
    setLoading(true);
    setError(null);

    try {
      const parents = (await getDataForAdmin(sessionParent.adminId, 'parents') as Parent[] | null) || [];
      const parentRecord = parents.find(p => p.id === sessionParent.id) || sessionParent;

      const students = (await getDataForAdmin(sessionParent.adminId, 'students') as Student[] | null) || [];
      const rawStudentIds = Array.isArray((parentRecord as any).studentIds)
        ? (parentRecord as any).studentIds
        : ((parentRecord as any).studentId ? [(parentRecord as any).studentId] : []);
      const uniqueStudentIds = Array.from(new Set(rawStudentIds.map((item: any) => String(item || '').trim()).filter(Boolean)));
      const childOptions = uniqueStudentIds
        .map((studentId) => {
          const student = students.find((row) => String(row.id) === studentId);
          if (!student) return null;
          return { id: String(student.id), fullName: String(student.fullName || "O'quvchi") };
        })
        .filter(Boolean) as LinkedChildOption[];

      setLinkedChildren(childOptions);

      const effectiveChildId = childOptions.some((item) => item.id === String(preferredChildId || ''))
        ? String(preferredChildId)
        : (childOptions[0]?.id || '');

      setActiveChildId(effectiveChildId);

      const child = students.find(s => String(s.id) === effectiveChildId);

      if (!child) {
        setChildSummary(null);
        setSkills([]);
        setRecentActivity([]);
        setAttendanceHistory([]);
        setLeaderboardRows([]);
        setError(t('child_record_not_found'));
        return;
      }

      const scores = (await getDataForAdmin(sessionParent.adminId, 'scores') as Score[] | null) || [];
      const childScores = scores.filter(score =>
        String((score as any).studentId || '') === String(child.id) ||
        (score as any).studentName === child.fullName
      );

      const groupStudents = students.filter((student) => student.group === child.group);
      const groupStudentIds = new Set(groupStudents.map((student) => String(student.id)));
      const groupScores = scores.filter((score) => groupStudentIds.has(String((score as any).studentId || '')));

      const buildRanking = (type: 'weekly' | 'mock') => {
        const latestByStudent = new Map<string, number>();
        const rows = groupScores
          .filter((row: any) => (row.scoreType || 'weekly') === type)
          .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        rows.forEach((row: any) => {
          const sid = String(row.studentId || '');
          if (!sid || latestByStudent.has(sid)) return;
          latestByStudent.set(sid, Number(row.overallPercent ?? row.value ?? 0));
        });

        const ranked = groupStudents
          .map((student) => ({
            studentId: String(student.id),
            studentName: student.fullName,
            score: latestByStudent.get(String(student.id)) ?? 0
          }))
          .sort((a, b) => b.score - a.score);

        let lastScore: number | null = null;
        let currentRank = 0;

        return ranked.map((item, index) => {
          if (lastScore === null || item.score < lastScore) {
            currentRank = index + 1;
            lastScore = item.score;
          }
          return {
            ...item,
            rank: currentRank,
          };
        });
      };

      const weeklyRanking = buildRanking('weekly');
      const mockRanking = buildRanking('mock');
      setWeeklyRankingDetails(weeklyRanking.map((item) => ({
        studentId: item.studentId,
        studentName: item.studentName,
        rank: item.rank,
        score: Number(item.score || 0),
      })));
      setMockRankingDetails(mockRanking.map((item) => ({
        studentId: item.studentId,
        studentName: item.studentName,
        rank: item.rank,
        score: Number(item.score || 0),
      })));
      const weeklyRankMap = new Map(weeklyRanking.map((item) => [item.studentId, item.rank]));
      const mockRankMap = new Map(mockRanking.map((item) => [item.studentId, item.rank]));
      const weeklyScoreMap = new Map(weeklyRanking.map((item) => [item.studentId, item.score]));
      const mockScoreMap = new Map(mockRanking.map((item) => [item.studentId, item.score]));

      const historyMap: Record<string, { weekly: ScoreHistoryRow[]; mock: ScoreHistoryRow[] }> = {};
      groupScores
        .slice()
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .forEach((score: any) => {
          const sid = String(score.studentId || '');
          if (!sid) return;
          if (!historyMap[sid]) {
            historyMap[sid] = { weekly: [], mock: [] };
          }
          const scoreType = (score.scoreType || 'weekly') === 'mock' ? 'mock' : 'weekly';
          const dateValue = score.createdAt || new Date().toISOString();
          const row: ScoreHistoryRow = {
            id: String(score.id || `${sid}-${dateValue}`),
            date: dateValue,
            weekday: getWeekdayOnly(dateValue),
            score: Number(score.overallPercent ?? score.value ?? 0),
            scoreType,
            subject: String(score.subject || (scoreType === 'mock' ? 'MOCK EXAM' : 'WEEKLY SCORE')),
            comment: typeof score.comment === 'string' ? score.comment : '',
          };
          historyMap[sid][scoreType].push(row);
        });
      setScoreHistoryByStudent(historyMap);

      const rows: LeaderboardRow[] = groupStudents
        .map((student) => {
          const sid = String(student.id);
          return {
            studentId: sid,
            studentName: student.fullName,
            weeklyRank: weeklyRankMap.get(sid) || 0,
            weeklyScore: Number(weeklyScoreMap.get(sid) || 0),
            mockRank: mockRankMap.get(sid) || 0,
            mockScore: Number(mockScoreMap.get(sid) || 0),
            isChild: sid === String(child.id),
          };
        })
        .sort((a, b) => {
          if (a.weeklyRank === 0 && b.weeklyRank !== 0) return 1;
          if (a.weeklyRank !== 0 && b.weeklyRank === 0) return -1;
          if (a.weeklyRank !== b.weeklyRank) return a.weeklyRank - b.weeklyRank;
          return a.studentName.localeCompare(b.studentName);
        });

      setLeaderboardRows(rows);
      setRanking({
        weeklyRank: weeklyRankMap.get(String(child.id)) || 0,
        mockRank: mockRankMap.get(String(child.id)) || 0,
        totalInGroup: groupStudents.length,
      });

      const attendance = (await getDataForAdmin(sessionParent.adminId, 'attendance') as Attendance[] | null) || [];
      const childAttendance = attendance.filter(record =>
        String((record as any).studentId || '') === String(child.id) ||
        (record as any).studentName === child.fullName
      );

      const sortedAttendance = [...childAttendance].sort(
        (a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      );

      const payments = (await getDataForAdmin(sessionParent.adminId, 'payments') as Payment[] | null) || [];
      const childPayments = payments.filter(payment =>
        String((payment as any).studentId || '') === String(child.id) ||
        (payment as any).studentName === child.fullName
      );
      const latestPayment = [...childPayments].sort(
        (a: any, b: any) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime()
      )[0];

      const attendedCount = childAttendance.filter(record => record.status === 'present' || record.status === 'late').length;
      const attendanceRate = childAttendance.length > 0 ? Math.round((attendedCount / childAttendance.length) * 100) : 0;

      let overallScore = 0;
      const skillBreakdown: SkillBreakdown[] = [];

      if (childScores.length > 0) {
        const latestScore = childScores[childScores.length - 1];
        if (typeof (latestScore as any).value === 'number') {
          overallScore = Math.round(Number((latestScore as any).value));
          const breakdown = (latestScore as any).breakdown;

          if (breakdown && typeof breakdown === 'object') {
            Object.entries(breakdown as Record<string, any>).forEach(([key, value]) => {
              const normalizedLabel = key
                .split('_')
                .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
                .join(' ');

              const scoreValue = typeof value === 'object' && value !== null
                ? Number((value as any).percent ?? (value as any).score ?? 0)
                : Number(value || 0);

              const sectionComment = typeof value === 'object' && value !== null && typeof (value as any).comment === 'string'
                ? String((value as any).comment).trim()
                : '';
              const sectionWordList = typeof value === 'object' && value !== null && Array.isArray((value as any).wordList)
                ? (value as any).wordList.map((item: any) => String(item || '').trim()).filter(Boolean)
                : [];
              const sectionCommentWithWords = sectionWordList.length > 0
                ? `${sectionComment}${sectionComment ? ' · ' : ''}So'zlar: ${sectionWordList.join(', ')}`
                : sectionComment;

              skillBreakdown.push({
                key,
                label: normalizedLabel,
                score: Number.isFinite(scoreValue) ? Math.round(scoreValue) : 0,
                ...(sectionCommentWithWords ? { comment: sectionCommentWithWords } : {}),
              });
            });

            const attendanceSection = (breakdown as any).attendance;
            if (attendanceSection && typeof attendanceSection === 'object') {
              const emoji = String((attendanceSection as any).participationEmoji || '').trim() || '📌';
              const label = String((attendanceSection as any).participationLabel || 'Participation').trim();
              const rawScore = Number((attendanceSection as any).rawScore ?? 0);
              const comment = typeof (attendanceSection as any).comment === 'string'
                ? String((attendanceSection as any).comment).trim()
                : '';
              setParticipationInsight({
                emoji,
                label,
                score: Number.isFinite(rawScore) ? rawScore : 0,
                ...(comment ? { comment } : {}),
              });
            } else {
              setParticipationInsight(null);
            }

            const translationSection = (breakdown as any).translation;
            if (translationSection && typeof translationSection === 'object') {
              const translationPercent = Number((translationSection as any).percent ?? 0);
              const readingFlow = Number((translationSection as any).readingFlow ?? 0);
              const accuracy = Number((translationSection as any).accuracy ?? 0);
              const pronunciation = Number((translationSection as any).pronunciation ?? 0);
              const comment = typeof (translationSection as any).comment === 'string'
                ? String((translationSection as any).comment).trim()
                : '';
              setTranslationInsight({
                score: Number.isFinite(translationPercent) ? Math.max(0, Math.min(100, Math.round(translationPercent))) : 0,
                readingFlow: Number.isFinite(readingFlow) ? Math.max(0, Math.min(10, readingFlow)) : 0,
                accuracy: Number.isFinite(accuracy) ? Math.max(0, Math.min(10, accuracy)) : 0,
                pronunciation: Number.isFinite(pronunciation) ? Math.max(0, Math.min(10, pronunciation)) : 0,
                ...(comment ? { comment } : {}),
              });
            } else {
              setTranslationInsight(null);
            }
          }

          if (skillBreakdown.length === 0) {
          skillBreakdown.push({
            key: 'overall',
            label: (latestScore as any).subject ? `Subject: ${(latestScore as any).subject}` : 'Overall',
            score: overallScore,
          });
          }
        } else {
        const scoreFields = Object.keys(latestScore).filter(key =>
          !['id', 'studentId', 'studentName', 'createdAt'].includes(key) && typeof latestScore[key as keyof Score] === 'number'
        );

        const total = scoreFields.reduce((sum, field) => sum + Number(latestScore[field as keyof Score] || 0), 0);
        overallScore = scoreFields.length > 0 ? Math.round(total / scoreFields.length) : 0;

        skillBreakdown.push(
          ...scoreFields
            .map(field => ({
              key: field,
              label: field
                .split('_')
                .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
                .join(' '),
              score: Number(latestScore[field as keyof Score] || 0),
            }))
            .filter(skill => skill.score > 0)
        );
        }
      }
      if (childScores.length === 0) {
        setParticipationInsight(null);
        setTranslationInsight(null);
      }

      const latestRelevantScores = childScores
        .sort((a: any, b: any) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
        .slice(-8);

      const trend = latestRelevantScores.map((score: any) => {
        const createdAt = new Date(score.createdAt || Date.now());
        const dateKey = Number.isNaN(createdAt.getTime()) ? '' : createdAt.toISOString().slice(0, 10);
        const label = formatDisplayDate(createdAt.toISOString());
        const weekdayLabel = formatDisplayDateWithWeekday(createdAt.toISOString());
        const base: Record<string, any> = {
          label,
          weekdayLabel,
          dateKey,
          overall: Number(score.overallPercent ?? score.value ?? 0),
          type: score.scoreType || 'weekly',
        };

        if (score.breakdown && typeof score.breakdown === 'object') {
          Object.entries(score.breakdown as Record<string, any>).forEach(([key, value]) => {
            if (value && typeof value === 'object' && typeof (value as any).percent === 'number') {
              base[key] = Number((value as any).percent);
            } else if (typeof value === 'number') {
              base[key] = Number(value);
            }
          });
        }

        return base;
      });
      setTrendData(trend);

      const activities: ActivityItem[] = [];

      [...childScores]
        .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 3)
        .forEach(score => {
        const sectionDetails = (score as any).breakdown && typeof (score as any).breakdown === 'object'
          ? Object.entries((score as any).breakdown as Record<string, any>).map(([key, value]) => {
              const label = key
                .split('_')
                .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
                .join(' ');
              const sectionScore = typeof value === 'object' && value !== null
                ? Number((value as any).percent ?? (value as any).score ?? 0)
                : Number(value || 0);
              const sectionComment = typeof value === 'object' && value !== null && typeof (value as any).comment === 'string'
                ? String((value as any).comment).trim()
                : '';
              const sectionWordList = typeof value === 'object' && value !== null && Array.isArray((value as any).wordList)
                ? (value as any).wordList.map((item: any) => String(item || '').trim()).filter(Boolean)
                : [];
              const sectionCommentWithWords = sectionWordList.length > 0
                ? `${sectionComment}${sectionComment ? ' · ' : ''}So'zlar: ${sectionWordList.join(', ')}`
                : sectionComment;
              return {
                label,
                score: Math.round(Number.isFinite(sectionScore) ? sectionScore : 0),
                ...(sectionCommentWithWords ? { comment: sectionCommentWithWords } : {}),
              };
            })
          : [];

        const average = typeof (score as any).value === 'number'
          ? Math.round(Number((score as any).value))
          : (() => {
              const scoreFields = Object.keys(score).filter(key =>
                !['id', 'studentId', 'studentName', 'createdAt'].includes(key) && typeof score[key as keyof Score] === 'number'
              );
              return scoreFields.length > 0
                ? Math.round(scoreFields.reduce((sum, field) => sum + Number(score[field as keyof Score] || 0), 0) / scoreFields.length)
                : 0;
            })();
        activities.push({
          type: 'score',
          title: t('test_score_received'),
          description: `${(score as any).subject || t('overall_score')}: ${average}%${(score as any).comment ? ` · ${(score as any).comment}` : ''}`,
          sectionDetails,
          date: score.createdAt || new Date().toISOString(),
        });
      });

      sortedAttendance.slice(0, 3).forEach(record => {
        const recordStatus = String(record.status || 'unknown');
        const recordDate = record.date || new Date().toISOString();
        activities.push({
          type: 'attendance',
          title: t('attendance_marked'),
          description: `${getStatusLabel(recordStatus)}${record.note ? ` · ${record.note}` : ''}`,
          date: recordDate,
        });
      });

      setChildSummary({
        name: child.fullName,
        group: child.group,
        attendanceRate,
        overallScore,
        paymentStatus: latestPayment?.status || 'pending',
        nextPaymentDue: latestPayment?.dueDate || 'N/A',
        paymentStartDate: latestPayment?.startDate || undefined,
        paymentAmount: Number(latestPayment?.amount || 0),
        paymentTotalDue: Number(latestPayment?.totalDue || latestPayment?.amount || 0),
        paymentPenaltyAmount: Number(latestPayment?.penaltyAmount || 0),
        paymentPenaltyPerDay: Number(latestPayment?.penaltyPerDay || 10000),
        paymentOverdueDays: Number(latestPayment?.overdueDays || 0),
      });
      setSkills(skillBreakdown);
      setAttendanceHistory(
        sortedAttendance.slice(0, 8).map((record) => ({
          date: record.date || new Date().toISOString(),
          status: String(record.status || ''),
          note: record.note || undefined,
        }))
      );
      setRecentActivity(
        activities
          .slice(0, 5)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      );
    } catch (err) {
      console.error('Failed to load parent data', err);
      setError(t('failed_to_load_data'));
      setChildSummary(null);
      setSkills([]);
      setRecentActivity([]);
      setAttendanceHistory([]);
      setRanking({ weeklyRank: 0, mockRank: 0, totalInGroup: 0 });
      setLeaderboardRows([]);
      setWeeklyRankingDetails([]);
      setMockRankingDetails([]);
      setScoreHistoryByStudent({});
      setLeaderboardDetail(null);
      setTrendData([]);
      setParticipationInsight(null);
      setTranslationInsight(null);
      setLinkedChildren([]);
      setActiveChildId('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const resolveSession = async () => {
      if (currentParent) {
        const session = currentParent as ParentSession;
        setParentSession(session);
        const preferredChildId = String((session as any).studentId || (Array.isArray((session as any).studentIds) ? (session as any).studentIds[0] : '') || '');
        await loadChildData(session, preferredChildId);
        return;
      }

      const stored = localStorage.getItem('currentParent');
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as ParentSession;
          setParentSession(parsed);
          const preferredChildId = String((parsed as any).studentId || (Array.isArray((parsed as any).studentIds) ? (parsed as any).studentIds[0] : '') || '');
          await loadChildData(parsed, preferredChildId);
          return;
        } catch (err) {
          console.warn('Failed to parse stored parent session', err);
          localStorage.removeItem('currentParent');
        }
      }

      router.replace('/');
      setLoading(false);
    };

    resolveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParent, router]);

  useEffect(() => {
    if (!parentSession) return;
    const handleThemeChange = async () => await loadChildData(parentSession, activeChildId);
    window.addEventListener('themeChanged', handleThemeChange);
    return () => window.removeEventListener('themeChanged', handleThemeChange);
  }, [parentSession, activeChildId]);

  useEffect(() => {
    if (!parentSession) return;
    loadChildData(parentSession, activeChildId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const handleSelectChild = async (studentId: string) => {
    if (!parentSession) return;
    const nextId = String(studentId || '');
    if (!nextId || nextId === activeChildId) return;
    setActiveChildId(nextId);
    await loadChildData(parentSession, nextId);
  };

  useEffect(() => {
    if (!Array.isArray(trendData) || trendData.length === 0) {
      setSelectedTrendDateKey('');
      return;
    }

    const latest = trendData[trendData.length - 1];
    const nextKey = String(latest?.dateKey || '');
    if (!nextKey) return;
    setSelectedTrendDateKey((prev) => prev || nextKey);
  }, [trendData]);

  const handleLogout = () => {
    logoutParent();
    router.push('/');
  };

  if (loading) {
    return null;
  }

  if (!parentSession) {
    return null;
  }

  if (!childSummary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kevin&apos;s Academy</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('parent_portal')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="bg-white dark:bg-gray-800/80 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('parent_account_connected')}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {error || t('child_data_not_linked')}
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg"
            >
              {t('back_to_login')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const paymentIsPaid = childSummary.paymentStatus === 'paid';
  const paymentIsOverdue = childSummary.paymentStatus === 'overdue';
  const metricMeta = [
    { key: 'vocabulary', label: 'Vocabulary' },
    { key: 'grammar', label: 'Grammar' },
    { key: 'translation', label: 'Translation' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'listening', label: 'Listening' },
    { key: 'reading', label: 'Reading' },
    { key: 'speaking', label: 'Speaking' },
    { key: 'writing', label: 'Writing' },
  ];

  const selectedTrendPoint = trendData.find((item) => String(item?.dateKey || '') === selectedTrendDateKey)
    || trendData[trendData.length - 1]
    || null;

  const performancePieData = selectedTrendPoint
    ? metricMeta
      .map((metric) => ({
        name: metric.label,
        score: Number(selectedTrendPoint?.[metric.key] || 0),
      }))
      .filter((item) => Number.isFinite(item.score) && item.score > 0)
    : skills
      .map((skill) => ({
        name: skill.label,
        score: Number(skill.score || 0),
      }))
      .filter((item) => Number.isFinite(item.score));

  const skillsBySelectedDate = selectedTrendPoint
    ? metricMeta
      .map((metric) => ({
        key: metric.key,
        label: metric.label,
        score: Math.round(Number(selectedTrendPoint?.[metric.key] || 0)),
      }))
      .filter((item) => item.score > 0)
    : skills;

  const selectedTrendDateLabel = selectedTrendPoint?.label || t('not_available');
  const selectedTrendDateWithWeekday = selectedTrendPoint?.dateKey
    ? formatDisplayDateWithWeekday(selectedTrendPoint.dateKey)
    : (selectedTrendPoint?.weekdayLabel || t('not_available'));

  const selectedDetailStudent = leaderboardDetail
    ? leaderboardRows.find((row) => row.studentId === leaderboardDetail.studentId)
    : null;
  const selectedDetailMetric = leaderboardDetail?.metric || null;
  const selectedDetailScoreType: 'weekly' | 'mock' = selectedDetailMetric && selectedDetailMetric.startsWith('mock') ? 'mock' : 'weekly';
  const selectedDetailHistory = selectedDetailStudent
    ? (scoreHistoryByStudent[selectedDetailStudent.studentId]?.[selectedDetailScoreType] || [])
    : [];
  const selectedDetailRanking = selectedDetailScoreType === 'weekly' ? weeklyRankingDetails : mockRankingDetails;
  const selectedDetailTitle = selectedDetailMetric === 'weeklyRank'
    ? "Haftalik o'rin tafsiloti"
    : selectedDetailMetric === 'weeklyScore'
      ? 'Haftalik ball tafsiloti'
      : selectedDetailMetric === 'mockRank'
        ? "Mock imtihon o'rni tafsiloti"
        : selectedDetailMetric === 'mockScore'
          ? 'Mock imtihon bali tafsiloti'
          : 'Tafsilot';
  const pieColors = ['#2563eb', '#8b5cf6', '#14b8a6', '#f97316', '#eab308', '#ec4899', '#22c55e', '#0ea5e9'];

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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kevin&apos;s Academy</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('parent_portal')}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <ThemeLanguageToggle />
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{parentSession?.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('parent_role')}</p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Welcome Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500 to-purple-600 dark:from-slate-800 dark:via-indigo-800 dark:to-purple-900 rounded-2xl p-8 text-white mb-8"
        >
          <h2 className="text-3xl font-bold mb-2">{t('hello_parent')}, {parentSession.fullName}!</h2>
          <p className="text-blue-100">{t('child_progress_intro')}: {childSummary.name}</p>

          {linkedChildren.length > 1 && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-xs uppercase tracking-wide text-blue-100 mb-2">Farzandlar</p>
              <div className="flex flex-wrap gap-2">
                {linkedChildren.map((child) => {
                  const isActive = String(child.id) === String(activeChildId);
                  return (
                    <button
                      key={child.id}
                      onClick={() => handleSelectChild(child.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${isActive ? 'bg-white text-blue-700 font-semibold' : 'bg-white/20 text-white hover:bg-white/30'}`}
                    >
                      {child.fullName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.58 }}
          className="bg-gradient-to-br from-black via-zinc-900 to-zinc-800 rounded-2xl p-6 shadow-lg border border-amber-300/40 mb-8"
        >
          <h3 className="text-xl font-semibold text-amber-200 mb-4">Darsdagi faollik</h3>
          {participationInsight ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-amber-300/30 bg-black/30 px-4 py-3">
                <p className="text-lg font-semibold text-amber-100">{participationInsight.emoji} {participationInsight.label}</p>
                <p className="text-sm text-amber-300">{participationInsight.score}/20</p>
              </div>
              {participationInsight.comment ? (
                <p className="text-sm text-amber-100/90">{participationInsight.comment}</p>
              ) : null}
              <div className="w-full bg-amber-900/40 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(0, Math.min(100, (participationInsight.score / 20) * 100))}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-2.5 bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-100/70">Hozircha participation ma'lumoti mavjud emas.</p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.59 }}
          className="bg-gradient-to-br from-black via-zinc-900 to-zinc-800 rounded-2xl p-6 shadow-lg border border-amber-300/40 mb-8"
        >
          <h3 className="text-xl font-semibold text-amber-200 mb-4">Translation progress</h3>
          {translationInsight ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-amber-100">
                <span>Umumiy translation</span>
                <span className="font-semibold text-amber-300">{translationInsight.score}%</span>
              </div>
              <div className="w-full bg-amber-900/40 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${translationInsight.score}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-2.5 bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-amber-100">
                <div className="rounded-lg border border-amber-300/30 bg-black/30 px-3 py-2">Reading Flow: {translationInsight.readingFlow}/10</div>
                <div className="rounded-lg border border-amber-300/30 bg-black/30 px-3 py-2">Accuracy: {translationInsight.accuracy}/10</div>
                <div className="rounded-lg border border-amber-300/30 bg-black/30 px-3 py-2">Pronunciation: {translationInsight.pronunciation}/10</div>
              </div>
              <div className="rounded-lg border border-amber-300/30 bg-black/25 px-3 py-2">
                <p className="text-xs text-amber-300 mb-1">AI feedback</p>
                <p className="text-sm text-amber-50">
                  {translationInsight.comment || "Farzandingiz matnni o'qishda va tarjima qilishda biroz qiynaldi, uyda darslikdagi matnlarni baland ovozda o'qish tavsiya etiladi."}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-100/70">Hozircha translation ma'lumoti mavjud emas.</p>
          )}
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('child_name')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{childSummary.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('group_label')}: {childSummary.group}</p>
              </div>
              <User className="w-8 h-8 text-blue-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('attendance_rate')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{childSummary.attendanceRate}%</p>
              </div>
              <Calendar className="w-8 h-8 text-green-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('overall_score')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{childSummary.overallScore}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('payment_status')}</p>
                <div className="flex items-center space-x-2">
                  {paymentIsPaid ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <span className="text-lg font-semibold text-green-600">{t('paid')}</span>
                    </>
                  ) : (
                    <>
                      {paymentIsOverdue ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                      <span className="text-lg font-semibold text-red-600">{paymentIsOverdue ? t('overdue') : t('pending')}</span>
                    </>
                  )}
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-orange-500" />
            </div>

            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('next_due')}: {childSummary.nextPaymentDue === 'N/A' ? t('not_available') : formatDisplayDate(childSummary.nextPaymentDue)}</p>
              {childSummary.paymentStartDate ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">Boshlanish: {formatDisplayDate(childSummary.paymentStartDate)}</p>
              ) : null}
              <p className="text-xs text-gray-500 dark:text-gray-400">Asosiy summa: {Number(childSummary.paymentAmount || 0).toLocaleString('uz-UZ')} so'm</p>
            </div>

            {paymentIsOverdue ? (
              <div className="mt-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 space-y-1">
                <p className="text-xs text-red-700 dark:text-red-300 flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> Kechikish: {Number(childSummary.paymentOverdueDays || 0)} kun</p>
                <p className="text-xs text-red-700 dark:text-red-300">Kunlik jarima: {Number(childSummary.paymentPenaltyPerDay || 0).toLocaleString('uz-UZ')} so'm</p>
                <p className="text-xs text-red-700 dark:text-red-300">Jarima: {Number(childSummary.paymentPenaltyAmount || 0).toLocaleString('uz-UZ')} so'm</p>
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">Jami: {Number(childSummary.paymentTotalDue || childSummary.paymentAmount || 0).toLocaleString('uz-UZ')} so'm</p>
              </div>
            ) : null}

            <div className="mt-4 rounded-xl border border-blue-200 dark:border-blue-700 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wide">Karta orqali to'lash</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">{paymentCardNumber}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Amal qilish: {paymentCardExpires}</p>
                </div>
                <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>

              <div className="grid grid-cols-1 gap-2 mt-3">
                <button
                  type="button"
                  onClick={copyPaymentCard}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                >
                  {paymentCardCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {paymentCardCopied ? 'Karta nusxalandi' : 'Karta raqamini nusxalash'}
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/pay')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-white/80 dark:bg-blue-950/30 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Kartaga o'tish va to'lash
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('group_ranking')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('weekly_rank')}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">
                {ranking.weeklyRank > 0 ? `#${ranking.weeklyRank}` : t('not_available')}
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-2">
                  / {ranking.totalInGroup || 0}
                </span>
              </p>
            </div>
            <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('mock_exam_rank')}</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-300">
                {ranking.mockRank > 0 ? `#${ranking.mockRank}` : t('not_available')}
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 ml-2">
                  / {ranking.totalInGroup || 0}
                </span>
              </p>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('group_size')}</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-300">{ranking.totalInGroup || 0}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('group_leaderboard')}</h3>

          {leaderboardRows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('no_ranking_data')}</p>
          ) : (
            <div className="space-y-4">
              {leaderboardRows.filter((row) => row.isChild).map((row) => (
                <div
                  key={`child-${row.studentId}`}
                  className="rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/80 dark:bg-blue-900/20 px-4 py-3"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-2">
                    {t('your_child_position')}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-sm">
                    <p className="font-semibold text-gray-900 dark:text-white self-center">{row.studentName}</p>
                    <button
                      type="button"
                      onClick={() => setLeaderboardDetail({ studentId: row.studentId, metric: 'weeklyRank' })}
                      className="group rounded-xl border border-blue-200 dark:border-blue-700 bg-white/80 dark:bg-blue-950/30 px-3 py-2 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-blue-600 dark:text-blue-300">{t('weekly_rank')}</p>
                      <p className="text-base font-semibold text-blue-800 dark:text-blue-200">{row.weeklyRank > 0 ? `#${row.weeklyRank}` : t('not_available')}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaderboardDetail({ studentId: row.studentId, metric: 'mockRank' })}
                      className="group rounded-xl border border-purple-200 dark:border-purple-700 bg-white/80 dark:bg-purple-950/30 px-3 py-2 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-purple-600 dark:text-purple-300">{t('mock_exam_rank')}</p>
                      <p className="text-base font-semibold text-purple-800 dark:text-purple-200">{row.mockRank > 0 ? `#${row.mockRank}` : t('not_available')}</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaderboardDetail({ studentId: row.studentId, metric: 'weeklyScore' })}
                      className="group rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white/80 dark:bg-emerald-950/30 px-3 py-2 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-300">{t('weekly_score')}</p>
                      <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">{Math.round(row.weeklyScore)}%</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaderboardDetail({ studentId: row.studentId, metric: 'mockScore' })}
                      className="group rounded-xl border border-orange-200 dark:border-orange-700 bg-white/80 dark:bg-orange-950/30 px-3 py-2 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-orange-600 dark:text-orange-300">{t('mock_score')}</p>
                      <p className="text-base font-semibold text-orange-800 dark:text-orange-200">{Math.round(row.mockScore)}%</p>
                    </button>
                  </div>
                </div>
              ))}

              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{t('all_students_ranking')}</p>
                <div className="space-y-2">
                  {leaderboardRows.map((row) => (
                    <div
                      key={row.studentId}
                      className={`grid grid-cols-1 md:grid-cols-5 gap-2 rounded-xl px-4 py-3 border ${row.isChild ? 'border-blue-300 dark:border-blue-700 bg-blue-50/60 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30'}`}
                    >
                      <p className="font-medium text-gray-900 dark:text-white self-center">{row.studentName}</p>
                      <button
                        type="button"
                        onClick={() => setLeaderboardDetail({ studentId: row.studentId, metric: 'weeklyRank' })}
                        className="group rounded-xl border border-blue-200 dark:border-blue-700 bg-white/80 dark:bg-blue-950/30 px-3 py-2 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
                      >
                        <p className="text-[11px] uppercase tracking-wide text-blue-600 dark:text-blue-300">{t('weekly_rank')}</p>
                        <p className="text-base font-semibold text-blue-800 dark:text-blue-200">{row.weeklyRank > 0 ? `#${row.weeklyRank}` : t('not_available')}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaderboardDetail({ studentId: row.studentId, metric: 'mockRank' })}
                        className="group rounded-xl border border-purple-200 dark:border-purple-700 bg-white/80 dark:bg-purple-950/30 px-3 py-2 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
                      >
                        <p className="text-[11px] uppercase tracking-wide text-purple-600 dark:text-purple-300">{t('mock_exam_rank')}</p>
                        <p className="text-base font-semibold text-purple-800 dark:text-purple-200">{row.mockRank > 0 ? `#${row.mockRank}` : t('not_available')}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaderboardDetail({ studentId: row.studentId, metric: 'weeklyScore' })}
                        className="group rounded-xl border border-emerald-200 dark:border-emerald-700 bg-white/80 dark:bg-emerald-950/30 px-3 py-2 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
                      >
                        <p className="text-[11px] uppercase tracking-wide text-emerald-600 dark:text-emerald-300">{t('weekly_score')}</p>
                        <p className="text-base font-semibold text-emerald-800 dark:text-emerald-200">{Math.round(row.weeklyScore)}%</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeaderboardDetail({ studentId: row.studentId, metric: 'mockScore' })}
                        className="group rounded-xl border border-orange-200 dark:border-orange-700 bg-white/80 dark:bg-orange-950/30 px-3 py-2 text-left hover:shadow-sm hover:-translate-y-0.5 transition-all"
                      >
                        <p className="text-[11px] uppercase tracking-wide text-orange-600 dark:text-orange-300">{t('mock_score')}</p>
                        <p className="text-base font-semibold text-orange-800 dark:text-orange-200">{Math.round(row.mockScore)}%</p>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {leaderboardDetail && selectedDetailStudent ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-700 mb-8"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedDetailTitle}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedDetailStudent.studentName}</p>
              </div>
              <button
                type="button"
                onClick={() => setLeaderboardDetail(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Yopish
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div className="rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/70 dark:bg-blue-900/20 px-4 py-3">
                <p className="text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wide">Joriy o‘rin</p>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                  {selectedDetailScoreType === 'weekly'
                    ? (selectedDetailStudent.weeklyRank > 0 ? `#${selectedDetailStudent.weeklyRank}` : t('not_available'))
                    : (selectedDetailStudent.mockRank > 0 ? `#${selectedDetailStudent.mockRank}` : t('not_available'))}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-900/20 px-4 py-3">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">Joriy ball</p>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200">
                  {selectedDetailScoreType === 'weekly'
                    ? `${Math.round(selectedDetailStudent.weeklyScore)}%`
                    : `${Math.round(selectedDetailStudent.mockScore)}%`}
                </p>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Reyting jadvali</p>
              {selectedDetailRanking.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('not_available')}</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">O‘rin</th>
                        <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">O‘quvchi</th>
                        <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">Ball</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDetailRanking.map((item) => (
                        <tr key={`${item.studentId}-${item.rank}`} className={item.studentId === selectedDetailStudent.studentId ? 'bg-blue-50 dark:bg-blue-900/20' : 'border-t border-gray-100 dark:border-gray-800'}>
                          <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">#{item.rank}</td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.studentName}</td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{Math.round(item.score)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Ball tarixi (hafta kuni bilan)</p>
              {selectedDetailHistory.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Bu bo‘lim uchun hali ball kiritilmagan.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">Sana</th>
                        <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">Hafta kuni</th>
                        <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">Ball</th>
                        <th className="text-left px-3 py-2 text-gray-600 dark:text-gray-300">Izoh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDetailHistory.map((item) => (
                        <tr key={item.id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatDisplayDate(item.date)}</td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{item.weekday}</td>
                          <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white">{Math.round(item.score)}%</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{item.comment || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('criteria_trend')}</h3>
          {trendData.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('not_enough_score_data')}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {trendData.map((point, index) => {
                  const dateKey = String(point?.dateKey || `idx-${index}`);
                  const active = selectedTrendDateKey === dateKey;
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedTrendDateKey(dateKey)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-blue-400'}`}
                    >
                      {point.weekdayLabel || point.label}
                    </button>
                  );
                })}
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="overall" name={t('overall_score')} fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="vocabulary" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="grammar" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="translation" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="attendance" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="listening" fill="#f97316" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="reading" fill="#eab308" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="speaking" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="writing" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{t('skills_progress')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Sana bo'yicha: {selectedTrendDateWithWeekday}</p>
          {performancePieData.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('not_enough_score_data')}</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={performancePieData}
                    dataKey="score"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    label={({ name, value }) => `${name}: ${Math.round(Number(value || 0))}%`}
                    isAnimationActive
                  >
                    {performancePieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${Math.round(Number(value || 0))}%`, t('overall_score')]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{t('attendance_history')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Davomat yozuvlari sana bo'yicha eng so'nggisidan boshlab ko'rsatiladi.</p>
          {attendanceHistory.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('attendance_empty')}</p>
          ) : (
            <div className="space-y-3">
              {attendanceHistory.map((item, index) => (
                <div key={`${item.date}-${index}`} className="rounded-xl border-l-4 border-l-blue-500 border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-900/30 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getAttendanceBadgeClass(item.status)}`}>
                        {getStatusLabel(item.status)}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{formatDisplayDate(item.date)}</span>
                    </div>
                    {item.note ? <span className="text-sm text-gray-600 dark:text-gray-400">{item.note}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Skills Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 mb-8"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Ko'nikmalar taqsimoti</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Tanlangan sana: {selectedTrendDateWithWeekday}</p>
          {skillsBySelectedDate.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('not_enough_score_data')}</p>
          ) : (
            <div className="space-y-4">
              {skillsBySelectedDate.map((skill, index) => (
                <div key={skill.key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{skill.label}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{skill.score}%</span>
                  </div>
                  {skill.comment ? (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{skill.comment}</p>
                  ) : null}
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${skill.score}%` }}
                      transition={{ delay: 0.7 + index * 0.1, duration: 0.8 }}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700"
        >
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">{t('recent_activity')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">So'nggi baholash va davomat belgilari aniq, ketma-ket ko'rinishda.</p>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('not_available')}</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity, index) => (
                <div key={index} className={`p-4 rounded-xl border-l-4 ${
                  activity.type === 'score'
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500'
                    : 'bg-purple-50 dark:bg-purple-900/20 border-l-purple-500'
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{activity.title}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{activity.description}</p>
                      {activity.type === 'score' && Array.isArray(activity.sectionDetails) && activity.sectionDetails.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {activity.sectionDetails.map((detail, idx) => (
                            <div key={`${detail.label}-${idx}`} className="text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium text-gray-700 dark:text-gray-300">{detail.label}:</span> {detail.score}%
                              {detail.comment ? ` · ${detail.comment}` : ''}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDisplayDateWithWeekday(activity.date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
