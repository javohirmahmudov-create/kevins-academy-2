'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, TrendingUp, User, Trash2, Trophy } from 'lucide-react';
import { getScores, addScore, getStudents, getGroups } from '@/lib/storage';
import { useApp } from '@/lib/app-context';

type ScoreType = 'weekly' | 'mock';

const FOUNDATION_CATEGORIES = ['grammar', 'vocabulary', 'speed_reading', 'translation', 'attendance'] as const;
const ACADEMIC_CATEGORIES = ['listening', 'reading', 'writing', 'speaking', 'grammar', 'vocabulary', 'translation'] as const;
type CategoryKey = (typeof FOUNDATION_CATEGORIES)[number] | (typeof ACADEMIC_CATEGORIES)[number];
type BreakdownItemPayload = {
  score: number;
  comment: string;
  selected?: boolean;
  totalWords?: number;
  memorizedWords?: number;
  pronunciationBonus?: boolean;
  wordList?: string[];
  sourceWordList?: string[];
  sentenceStructure?: number;
  topicMastery?: number;
  toBeTenses?: number;
  spelling?: number;
  rawScore?: number;
  grammarTopic?: string;
  readingFlow?: number;
  accuracy?: number;
  pronunciation?: number;
  participationMode?: string;
  participationEmoji?: string;
  participationLabel?: string;
  totalQuestions?: number;
  correctAnswers?: number;
  timeSpentMinutes?: number;
  taskResponse?: number;
  cohesion?: number;
  grammar?: number;
  fluency?: number;
  lexical?: number;
  synonymBonus?: number;
  cefrScore75?: number;
  levelDetected?: string;
  listeningParts?: Record<string, number>;
  readingParts?: Record<string, number>;
  selectedParts?: Record<string, boolean>;
  selectedTasks?: Record<string, boolean>;
  weakestPart?: string;
  task11?: number;
  task12?: number;
  task2?: number;
  grammarAccuracy?: number;
  lexicalResource?: number;
  mistakeLogger?: string[];
};

const CATEGORY_LABELS: Record<string, string> = {
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

const normalizeLevel = (raw?: string | null) => {
  const level = String(raw || '').trim().toLowerCase();
  if (level.includes('ielts')) return 'ielts';
  if (level.includes('advanced')) return 'advanced';
  if (level.includes('intermediate')) return 'intermediate';
  if (level.includes('elementary')) return 'elementary';
  return 'beginner';
};

const getCategoriesForLevel = (level: string): CategoryKey[] => {
  const normalized = normalizeLevel(level);
  return normalized === 'intermediate' || normalized === 'advanced' || normalized === 'ielts'
    ? [...ACADEMIC_CATEGORIES]
    : [...FOUNDATION_CATEGORIES];
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  elementary: 'Elementary',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  ielts: 'IELTS',
};

const LISTENING_PART_META = [
  { key: 'part1', label: 'Part 1: Multiple Choice (Short texts)', max: 8 },
  { key: 'part2', label: 'Part 2: Matching (Opinions/People)', max: 6 },
  { key: 'part3', label: 'Part 3: Multiple Choice (Long interview/text)', max: 4 },
  { key: 'part4', label: 'Part 4: Multiple Choice (Monologue/Professional context)', max: 5 },
  { key: 'part5', label: 'Part 5: Gap Filling (Sentence completion)', max: 6 },
  { key: 'part6', label: 'Part 6: Multiple Choice (Multiple speakers)', max: 6 },
] as const;

const READING_PART_META = [
  { key: 'part1', label: 'Part 1: Matching (Heading/Information)', max: 6 },
  { key: 'part2', label: 'Part 2: Multiple Choice (Detailed understanding)', max: 8 },
  { key: 'part3', label: 'Part 3: Gapped Text (Sentence insertion)', max: 6 },
  { key: 'part4', label: 'Part 4: Multiple Choice (A, B, C, D - Deep analysis)', max: 9 },
  { key: 'part5', label: 'Part 5: Gap Filling (One word/Number)', max: 6 },
] as const;

const WRITING_EXPERT_TO_STANDARD: Record<string, number> = {
  '0': 0,
  '0.5': 6,
  '1': 11,
  '1.5': 13,
  '2': 15,
  '2.5': 18,
  '3': 21,
  '3.5': 23,
  '4': 26,
  '4.5': 29,
  '5': 32,
  '5.5': 35,
  '6': 38,
  '6.5': 40,
  '7': 42,
  '7.5': 43,
  '8': 45,
  '8.5': 47,
  '9': 49,
  '9.5': 50,
  '10': 51,
  '10.5': 53,
  '11': 54,
  '11.5': 56,
  '12': 57,
  '12.5': 59,
  '13': 61,
  '13.5': 62,
  '14': 63,
  '14.5': 65,
  '15': 67,
  '15.5': 69,
  '16': 72,
  '16.5': 74,
  '17': 75,
};

export default function ScoresPage() {
  const router = useRouter();
  const { t } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [scores, setScores] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedPanelLevel, setSelectedPanelLevel] = useState('');
  const [modalSelectedGroup, setModalSelectedGroup] = useState('');
  const [modalStudentSearchTerm, setModalStudentSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    studentId: '',
    scoreType: 'weekly' as ScoreType,
    maxScore: 100,
    examDate: new Date().toISOString().split('T')[0],
    examTime: '10:00',
    comment: '',
    sections: {} as Record<string, number>,
    sectionComments: {} as Record<string, string>,
    vocabularyTotalWords: 0,
    vocabularyMemorizedWords: 0,
    vocabularyPronunciationBonus: false,
    vocabularyWordList: [] as string[],
    vocabularySourceWordList: [] as string[],
    grammarSentenceStructure: 0,
    grammarTopicMastery: 0,
    grammarSpelling: 0,
    grammarTopic: '',
    translationReadingFlow: 0,
    translationAccuracy: 0,
    translationPronunciation: 0,
    participationMode: '',
    intermediateSelectedVocabulary: true,
    intermediateSelectedGrammar: true,
    intermediateSelectedTranslation: true,
    intermediateSelectedListening: true,
    intermediateSelectedReading: true,
    intermediateSelectedWriting: true,
    intermediateSelectedSpeaking: true,
    selectedSpeedReading: true,
    selectedAttendance: true,
    certificateSelected: false,
    intermediateListeningTotalQuestions: 35,
    intermediateListeningCorrectAnswers: 0,
    intermediateListeningPart1: 0,
    intermediateListeningPart2: 0,
    intermediateListeningPart3: 0,
    intermediateListeningPart4: 0,
    intermediateListeningPart5: 0,
    intermediateListeningPart6: 0,
    intermediateListeningSelectedPart1: true,
    intermediateListeningSelectedPart2: true,
    intermediateListeningSelectedPart3: true,
    intermediateListeningSelectedPart4: true,
    intermediateListeningSelectedPart5: true,
    intermediateListeningSelectedPart6: true,
    intermediateReadingTotalQuestions: 35,
    intermediateReadingCorrectAnswers: 0,
    intermediateReadingPart1: 0,
    intermediateReadingPart2: 0,
    intermediateReadingPart3: 0,
    intermediateReadingPart4: 0,
    intermediateReadingPart5: 0,
    intermediateReadingSelectedPart1: true,
    intermediateReadingSelectedPart2: true,
    intermediateReadingSelectedPart3: true,
    intermediateReadingSelectedPart4: true,
    intermediateReadingSelectedPart5: true,
    intermediateGrammarTotalQuestions: 0,
    intermediateGrammarCorrectAnswers: 0,
    intermediateTranslationTotalQuestions: 0,
    intermediateTranslationCorrectAnswers: 0,
    intermediateTimeSpentMinutes: 0,
    intermediateWritingTask11: 0,
    intermediateWritingTask12: 0,
    intermediateWritingTask2: 0,
    intermediateWritingSelectedTask11: true,
    intermediateWritingSelectedTask12: true,
    intermediateWritingSelectedTask2: true,
    intermediateWritingTaskResponse: 0,
    intermediateWritingCohesion: 0,
    intermediateWritingGrammar: 0,
    intermediateSpeakingFluency: 0,
    intermediateSpeakingLexical: 0,
    intermediateSpeakingGrammar: 0,
    intermediateSpeakingPronunciation: 0,
    intermediateSpeakingSynonymBonus: 0,
  });
  const [vocabularyWordOptions, setVocabularyWordOptions] = useState<string[]>([]);
  const [wordScanLoading, setWordScanLoading] = useState(false);
  const [wordScanError, setWordScanError] = useState('');
  const [isWordDropActive, setIsWordDropActive] = useState(false);
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificateUploadError, setCertificateUploadError] = useState('');
  const [certificateUploadSuccess, setCertificateUploadSuccess] = useState('');
  const [disconnectedStudentIds, setDisconnectedStudentIds] = useState<Set<number>>(new Set());

  const loadData = async () => {
    try {
      const [scoresData, studentsData, groupsData] = await Promise.all([getScores(), getStudents(), getGroups()]);
      setScores(Array.isArray(scoresData) ? scoresData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);

      try {
        const rawAdmin = localStorage.getItem('currentAdmin');
        const admin = rawAdmin ? JSON.parse(rawAdmin) : null;
        if (admin?.id) {
          const response = await fetch('/api/admin/alerts/disconnected-parents', {
            headers: {
              'x-admin-id': String(admin.id),
            },
          });
          const data = await response.json();
          if (response.ok) {
            const ids = new Set<number>();
            const rows = Array.isArray(data?.rows) ? data.rows : [];
            for (const row of rows) {
              const studentId = Number(row?.studentId || 0);
              if (Number.isFinite(studentId) && studentId > 0) ids.add(studentId);
            }
            setDisconnectedStudentIds(ids);
          }
        }
      } catch {
        // no-op
      }
    } catch {
      setScores([]);
      setStudents([]);
      setGroups([]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStudentName = (score: any) => {
    if (score.studentName) return score.studentName;
    const student = students.find((s: any) => String(s.id) === String(score.studentId));
    return student?.fullName || `${t('student')} #${score.studentId ?? t('unknown_student')}`;
  };

  const getStudentGroup = (score: any) => {
    const student = students.find((s: any) => String(s.id) === String(score.studentId));
    return student?.group || 'Not Assigned';
  };

  const getWeekdayLabel = (score: any) => {
    const dateValue = score?.examDateTime || score?.createdAt;
    const date = new Date(dateValue || Date.now());
    if (Number.isNaN(date.getTime())) return t('not_available');
    const weekday = date.toLocaleDateString('uz-UZ', { weekday: 'long' });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  };

  const getLevelForStudent = (studentId: string) => {
    const student = students.find((s: any) => String(s.id) === String(studentId));
    if (!student?.group) return 'beginner';
    const group = groups.find((g: any) => g.name === student.group);
    return normalizeLevel(group?.level || 'beginner');
  };

  const getLevelForStudentRow = (student: any) => {
    if (!student?.group) return 'beginner';
    const group = groups.find((g: any) => g.name === student.group);
    return normalizeLevel(group?.level || 'beginner');
  };

  const currentLevel = getLevelForStudent(formData.studentId);
  const currentCategories: CategoryKey[] = getCategoriesForLevel(currentLevel) as CategoryKey[];
  const categorySelectionStateKey: Record<CategoryKey, string> = {
    vocabulary: 'intermediateSelectedVocabulary',
    grammar: 'intermediateSelectedGrammar',
    translation: 'intermediateSelectedTranslation',
    listening: 'intermediateSelectedListening',
    reading: 'intermediateSelectedReading',
    writing: 'intermediateSelectedWriting',
    speaking: 'intermediateSelectedSpeaking',
    speed_reading: 'selectedSpeedReading',
    attendance: 'selectedAttendance',
  };
  const sectionSelectionByCategory: Record<CategoryKey, boolean> = {
    vocabulary: Boolean((formData as any).intermediateSelectedVocabulary),
    grammar: Boolean((formData as any).intermediateSelectedGrammar),
    translation: Boolean((formData as any).intermediateSelectedTranslation),
    listening: Boolean((formData as any).intermediateSelectedListening),
    reading: Boolean((formData as any).intermediateSelectedReading),
    writing: Boolean((formData as any).intermediateSelectedWriting),
    speaking: Boolean((formData as any).intermediateSelectedSpeaking),
    speed_reading: Boolean((formData as any).selectedSpeedReading),
    attendance: Boolean((formData as any).selectedAttendance),
  };
  const isSelectableLevel = currentLevel !== 'ielts';
  const activeSelectedCategories = currentCategories
    .filter((category) => sectionSelectionByCategory[category] !== false);
  const effectiveCategories: CategoryKey[] = isSelectableLevel
    ? activeSelectedCategories
    : currentCategories;
  const filteredStudentsForModal = (students || []).filter((student: any) => {
    const studentLevel = getLevelForStudentRow(student);
    const studentGroup = student.group || 'Not Assigned';
    const query = modalStudentSearchTerm.trim().toLowerCase();
    const matchesLevel = !selectedPanelLevel || studentLevel === selectedPanelLevel;
    const matchesGroup = !modalSelectedGroup || studentGroup === modalSelectedGroup;
    const matchesSearch = !query
      || String(student.fullName || '').toLowerCase().includes(query)
      || String(studentGroup).toLowerCase().includes(query);
    return matchesLevel && matchesGroup && matchesSearch;
  });

  useEffect(() => {
    if (!formData.studentId) return;
    const isSelectedStudentVisible = filteredStudentsForModal
      .some((student: any) => String(student.id) === String(formData.studentId));
    if (!isSelectedStudentVisible) {
      setFormData((prev) => ({ ...prev, studentId: '' }));
    }
  }, [filteredStudentsForModal, formData.studentId]);

  useEffect(() => {
    setFormData((prev) => {
      const nextSections: Record<string, number> = {};
      const nextSectionComments: Record<string, string> = {};
      currentCategories.forEach((category) => {
        nextSections[category] = Number(prev.sections?.[category] || 0);
        nextSectionComments[category] = String(prev.sectionComments?.[category] || '');
      });
      return { ...prev, sections: nextSections, sectionComments: nextSectionComments };
    });
  }, [formData.studentId]);

  const vocabularyTotalWords = Math.max(0, Number(formData.vocabularyTotalWords || 0));
  const vocabularyMemorizedWords = Math.max(0, Number(formData.vocabularyMemorizedWords || 0));
  const hasVocabularyCategory = (currentCategories as string[]).includes('vocabulary');
  const hasGrammarCategory = (currentCategories as string[]).includes('grammar');
  const vocabularyValidationError =
    hasVocabularyCategory && vocabularyMemorizedWords > vocabularyTotalWords
      ? "Xatolik: Yodlangan so'zlar jami so'zlardan ko'p bo'lishi mumkin emas"
      : '';
  const vocabularyPercent =
    hasVocabularyCategory && vocabularyTotalWords > 0
      ? Number(((Math.min(vocabularyMemorizedWords, vocabularyTotalWords) / vocabularyTotalWords) * 100).toFixed(2))
      : 0;
  const pronunciationBonus = formData.vocabularyPronunciationBonus ? 5 : 0;
  const vocabularyAutoComment =
    hasVocabularyCategory && vocabularyTotalWords > 0
      ? `Bugungi ${vocabularyTotalWords} ta yangi so'zdan ${Math.min(vocabularyMemorizedWords, vocabularyTotalWords)} tasini xatosiz yozdi.`
      : '';
  const grammarSentenceStructure = Math.max(0, Math.min(40, Number(formData.grammarSentenceStructure || 0)));
  const grammarTopicMastery = Math.max(0, Math.min(40, Number((formData as any).grammarTopicMastery || 0)));
  const grammarSpelling = Math.max(0, Math.min(20, Number(formData.grammarSpelling || 0)));
  const grammarTopic = String(formData.grammarTopic || '').trim();
  const grammarRawScore = grammarSentenceStructure + grammarTopicMastery + grammarSpelling;
  const grammarTopicLabel = grammarTopic || 'Tanlangan mavzu';
  const grammarAutoCommentParts = [
    grammarSentenceStructure < 20 ? `${grammarTopicLabel} mavzusida gap tuzishda xatoliklar bor.` : `${grammarTopicLabel} mavzusida gap tuzish yaxshi.`,
    grammarTopicMastery < 20 ? `${grammarTopicLabel} qoidalarini chuqurroq mustahkamlash kerak.` : `${grammarTopicLabel} qoidasi yaxshi o‘zlashtirilgan.`,
    grammarSpelling < 10 ? "So'zlarni yozishda imlo xatolariga e'tiborli bo'lish kerak." : 'Imlo holati yaxshi.',
  ].filter(Boolean);
  const grammarAutoComment = grammarAutoCommentParts.join(' ');

  const translationReadingFlow = Math.max(0, Math.min(10, Number((formData as any).translationReadingFlow || 0)));
  const translationAccuracy = Math.max(0, Math.min(10, Number((formData as any).translationAccuracy || 0)));
  const translationPronunciation = Math.max(0, Math.min(10, Number((formData as any).translationPronunciation || 0)));
  const translationRawScore = translationReadingFlow + translationAccuracy + translationPronunciation;
  const translationPercent = Number(((translationRawScore / 30) * 100).toFixed(2));
  const translationReadingFlowComment = translationReadingFlow <= 3
    ? 'Matnni ravon o‘qishda qiynaldi.'
    : translationReadingFlow <= 7
      ? 'Matnni o‘qish ravonligi o‘rtacha, yana mashq kerak.'
      : 'Matnni ravon o‘qishi yaxshi.';
  const translationAccuracyComment = translationAccuracy <= 3
    ? 'Tarjimada ma’no xatolari ko‘p bo‘ldi.'
    : translationAccuracy <= 7
      ? 'Tarjima aniqligi o‘rtacha, diqqat bilan ishlash kerak.'
      : 'Tarjima aniqligi yaxshi.';
  const translationPronunciationComment = translationPronunciation <= 3
    ? 'Talaffuz ustida ko‘proq ishlash kerak.'
    : translationPronunciation <= 7
      ? 'Talaffuz o‘rtacha, mashq bilan tez yaxshilanadi.'
      : 'Talaffuz yaxshi.';
  const translationAutoComment = [
    translationPercent < 65
      ? "Farzandingiz matnni o‘qishda va tarjima qilishda biroz qiynaldi, uyda darslikdagi matnlarni baland ovozda o‘qish tavsiya etiladi."
      : 'Tarjima va o‘qish bo‘yicha yaxshi holat, mashqni shu ritmda davom ettiring.',
    translationReadingFlowComment,
    translationAccuracyComment,
    translationPronunciationComment,
  ].join(' ');

  const participationMode = String((formData as any).participationMode || '').trim();
  const participationModeMap: Record<string, { score: number; emoji: string; label: string; comment: string }> = {
    super_active: {
      score: 20,
      emoji: '🔥',
      label: 'Super Active',
      comment: 'Darsda juda faol qatnashdi va ko‘p savollarga javob berdi.',
    },
    active: {
      score: 15,
      emoji: '✅',
      label: 'Active',
      comment: 'Vazifalarni bajardi va darsda faol bo‘ldi.',
    },
    passive: {
      score: 5,
      emoji: '💤',
      label: 'Passive',
      comment: 'Darsda e’tibor pasaydi, qo‘shimcha rag‘bat kerak.',
    },
  };
  const participationSelection = participationModeMap[participationMode] || null;
  const participationRawScore = participationSelection?.score || 0;
  const participationPercent = Number(((participationRawScore / 20) * 100).toFixed(2));
  const speedReadingScore = Math.max(0, Math.min(Number(formData.maxScore || 100), Number(formData.sections?.speed_reading || 0)));
  const speedReadingPercent = Number(((speedReadingScore / Math.max(1, Number(formData.maxScore || 100))) * 100).toFixed(2));
  const speedReadingAutoComment = speedReadingPercent >= 85
    ? 'Matnni tez va to‘g‘ri o‘qish ko‘rsatkichi juda yaxshi.'
    : speedReadingPercent >= 65
      ? 'Tez o‘qish ko‘rsatkichi yaxshi, stabil mashq bilan tez o‘sadi.'
      : 'Tez o‘qish bo‘yicha qo‘shimcha kundalik mashq kerak.';

  const isIntermediateLevel = currentLevel === 'intermediate' || currentLevel === 'advanced';
  const isFoundationLevel = currentLevel === 'beginner' || currentLevel === 'elementary';
  const certificateSelected = Boolean((formData as any).certificateSelected);
  const listeningPartRows = LISTENING_PART_META.map((part, index) => {
    const key = `intermediateListeningPart${index + 1}` as keyof typeof formData;
    const selectionKey = `intermediateListeningSelectedPart${index + 1}` as keyof typeof formData;
    const raw = Number((formData as any)[key] || 0);
    const isSelected = Boolean((formData as any)[selectionKey]);
    return {
      ...part,
      value: Math.max(0, Math.min(part.max, raw)),
      isSelected,
    };
  });
  const selectedListeningParts = listeningPartRows.filter((part) => part.isSelected);
  const intermediateListeningSelectedTotalQuestions = selectedListeningParts.reduce((sum, part) => sum + part.max, 0);
  const intermediateListeningCorrectAnswers = selectedListeningParts.reduce((sum, part) => sum + part.value, 0);
  const intermediateListeningPercent = intermediateListeningSelectedTotalQuestions > 0
    ? Number(((intermediateListeningCorrectAnswers / intermediateListeningSelectedTotalQuestions) * 100).toFixed(2))
    : 0;

  const readingPartRows = READING_PART_META.map((part, index) => {
    const key = `intermediateReadingPart${index + 1}` as keyof typeof formData;
    const selectionKey = `intermediateReadingSelectedPart${index + 1}` as keyof typeof formData;
    const raw = Number((formData as any)[key] || 0);
    const isSelected = Boolean((formData as any)[selectionKey]);
    return {
      ...part,
      value: Math.max(0, Math.min(part.max, raw)),
      isSelected,
    };
  });
  const selectedReadingParts = readingPartRows.filter((part) => part.isSelected);
  const intermediateReadingSelectedTotalQuestions = selectedReadingParts.reduce((sum, part) => sum + part.max, 0);
  const intermediateReadingCorrectAnswers = selectedReadingParts.reduce((sum, part) => sum + part.value, 0);
  const intermediateReadingPercent = intermediateReadingSelectedTotalQuestions > 0
    ? Number(((intermediateReadingCorrectAnswers / intermediateReadingSelectedTotalQuestions) * 100).toFixed(2))
    : 0;

  const intermediateGrammarTotalQuestions = Math.max(0, Number((formData as any).intermediateGrammarTotalQuestions || 0));
  const intermediateGrammarCorrectAnswersRaw = Math.max(0, Number((formData as any).intermediateGrammarCorrectAnswers || 0));
  const intermediateGrammarCorrectAnswers = Math.min(intermediateGrammarTotalQuestions, intermediateGrammarCorrectAnswersRaw);
  const intermediateGrammarPercent = intermediateGrammarTotalQuestions > 0
    ? Number(((intermediateGrammarCorrectAnswers / intermediateGrammarTotalQuestions) * 100).toFixed(2))
    : 0;

  const intermediateTranslationTotalQuestions = Math.max(0, Number((formData as any).intermediateTranslationTotalQuestions || 0));
  const intermediateTranslationCorrectAnswersRaw = Math.max(0, Number((formData as any).intermediateTranslationCorrectAnswers || 0));
  const intermediateTranslationCorrectAnswers = Math.min(intermediateTranslationTotalQuestions, intermediateTranslationCorrectAnswersRaw);
  const intermediateTranslationPercent = intermediateTranslationTotalQuestions > 0
    ? Number(((intermediateTranslationCorrectAnswers / intermediateTranslationTotalQuestions) * 100).toFixed(2))
    : 0;

  const intermediateTimeSpentMinutes = Math.max(0, Number((formData as any).intermediateTimeSpentMinutes || 0));

  const intermediateWritingTask11 = Math.max(0, Math.min(5, Number((formData as any).intermediateWritingTask11 || 0)));
  const intermediateWritingTask12 = Math.max(0, Math.min(5, Number((formData as any).intermediateWritingTask12 || 0)));
  const intermediateWritingTask2 = Math.max(0, Math.min(7, Number((formData as any).intermediateWritingTask2 || 0)));
  const intermediateWritingSelectedTask11 = Boolean((formData as any).intermediateWritingSelectedTask11);
  const intermediateWritingSelectedTask12 = Boolean((formData as any).intermediateWritingSelectedTask12);
  const intermediateWritingSelectedTask2 = Boolean((formData as any).intermediateWritingSelectedTask2);
  const selectedWritingTasks = [
    { key: 'task11', label: 'Task 1.1', value: intermediateWritingTask11, max: 5, selected: intermediateWritingSelectedTask11 },
    { key: 'task12', label: 'Task 1.2', value: intermediateWritingTask12, max: 5, selected: intermediateWritingSelectedTask12 },
    { key: 'task2', label: 'Task 2', value: intermediateWritingTask2, max: 7, selected: intermediateWritingSelectedTask2 },
  ].filter((task) => task.selected);
  const intermediateWritingSelectedExpertMax = selectedWritingTasks.reduce((sum, task) => sum + task.max, 0);
  const intermediateWritingSelectedExpertMark = Number(selectedWritingTasks.reduce((sum, task) => sum + task.value, 0).toFixed(1));
  const intermediateWritingSelectedRatio = intermediateWritingSelectedExpertMax > 0
    ? intermediateWritingSelectedExpertMark / intermediateWritingSelectedExpertMax
    : 0;
  const intermediateWritingTaskResponse = Number(((intermediateWritingTask11 / 5) * 100).toFixed(2));
  const intermediateWritingCohesion = Number(((intermediateWritingTask12 / 5) * 100).toFixed(2));
  const intermediateWritingGrammar = Number(((intermediateWritingTask2 / 7) * 100).toFixed(2));
  const intermediateWritingExpertMark = Number((intermediateWritingTask11 + intermediateWritingTask12 + intermediateWritingTask2).toFixed(1));
  const normalizedWritingExpertMark = Number((intermediateWritingSelectedRatio * 17).toFixed(1));
  const intermediateWritingStandardScore = intermediateWritingSelectedExpertMax > 0
    ? WRITING_EXPERT_TO_STANDARD[normalizedWritingExpertMark.toFixed(1)]
      ?? WRITING_EXPERT_TO_STANDARD[String(Math.round(normalizedWritingExpertMark))]
      ?? Math.round(intermediateWritingSelectedRatio * 75)
    : 0;
  const intermediateWritingPercent = Number(((intermediateWritingStandardScore / 75) * 100).toFixed(2));
  const writingTask11Options = Array.from({ length: 11 }, (_, idx) => Number((idx * 0.5).toFixed(1)));
  const writingTask2Options = Array.from({ length: 15 }, (_, idx) => Number((idx * 0.5).toFixed(1)));

  const intermediateSpeakingFluency = Math.max(0, Math.min(25, Number((formData as any).intermediateSpeakingFluency || 0)));
  const intermediateSpeakingLexical = Math.max(0, Math.min(25, Number((formData as any).intermediateSpeakingLexical || 0)));
  const intermediateSpeakingGrammar = Math.max(0, Math.min(25, Number((formData as any).intermediateSpeakingGrammar || 0)));
  const intermediateSpeakingPronunciation = Math.max(0, Math.min(25, Number((formData as any).intermediateSpeakingPronunciation || 0)));
  const intermediateSpeakingSynonymBonus = Math.max(0, Math.min(10, Number((formData as any).intermediateSpeakingSynonymBonus || 0)));
  const intermediateSpeakingRaw100 = intermediateSpeakingFluency + intermediateSpeakingLexical + intermediateSpeakingGrammar + intermediateSpeakingPronunciation;
  const intermediateSpeakingScore75 = Math.max(0, Math.min(75, Math.round((intermediateSpeakingRaw100 / 100) * 75)));
  const intermediateSpeakingLevel = intermediateSpeakingScore75 >= 65
    ? 'C1 🏆'
    : intermediateSpeakingScore75 >= 51
      ? 'B2 ✅'
      : 'B1/A2 (Improvement needed)';
  const intermediateSpeakingPercent = Number(((intermediateSpeakingScore75 / 75) * 100).toFixed(2));

  const listeningWeakestPart = selectedListeningParts.find((part) => part.value < part.max * 0.5);
  const listeningWeakestPartLabel = listeningWeakestPart?.label || '';
  const readingWeakestPart = selectedReadingParts.find((part) => part.value < part.max * 0.5);
  const readingWeakestPartLabel = readingWeakestPart?.label || '';

  const intermediateWritingAutoComment = [
    `Task 1.1: ${intermediateWritingTask11}/5${intermediateWritingSelectedTask11 ? '' : ' (not selected)'}`,
    `Task 1.2: ${intermediateWritingTask12}/5${intermediateWritingSelectedTask12 ? '' : ' (not selected)'}`,
    `Task 2: ${intermediateWritingTask2}/7${intermediateWritingSelectedTask2 ? '' : ' (not selected)'}`,
    `Selected expert mark: ${intermediateWritingSelectedExpertMark}/${intermediateWritingSelectedExpertMax}`,
    `All tasks mark: ${intermediateWritingExpertMark}/17`,
    `Standard score: ${intermediateWritingStandardScore}/75 (${Math.round(intermediateWritingPercent)}%)`,
    'Kevin AI yozuvdagi Grammar accuracy va Lexical resource bo‘yicha alohida tahlil beradi.',
  ].join(' · ');
  const intermediateSpeakingAutoComment = [
    `Fluency: ${intermediateSpeakingFluency}/25`,
    `Lexical: ${intermediateSpeakingLexical}/25`,
    `Grammar: ${intermediateSpeakingGrammar}/25`,
    `Pronunciation: ${intermediateSpeakingPronunciation}/25`,
    `CEFR score: ${intermediateSpeakingScore75}/75`,
    `Level: ${intermediateSpeakingLevel}`,
    `Synonym bonus: +${intermediateSpeakingSynonymBonus}`,
  ].join(' · ');

  function getEffectiveSectionScore(category: string) {
    const max = Number(formData.maxScore || 100) || 100;
    if (category === 'vocabulary' && hasVocabularyCategory) {
      return Number(((vocabularyPercent / 100) * max).toFixed(2));
    }
    if (category === 'grammar' && isFoundationLevel) {
      return Number(((grammarRawScore / 100) * max).toFixed(2));
    }
    if (category === 'translation' && isFoundationLevel) {
      return Number(((translationPercent / 100) * max).toFixed(2));
    }
    if (category === 'attendance' && isFoundationLevel) {
      return Number(((participationPercent / 100) * max).toFixed(2));
    }
    if (category === 'speed_reading' && isFoundationLevel) {
      return Number(speedReadingScore.toFixed(2));
    }
    if (isIntermediateLevel && category === 'listening') {
      return Number(((intermediateListeningPercent / 100) * max).toFixed(2));
    }
    if (isIntermediateLevel && category === 'reading') {
      return Number(((intermediateReadingPercent / 100) * max).toFixed(2));
    }
    if (isIntermediateLevel && category === 'grammar') {
      return Number(((intermediateGrammarPercent / 100) * max).toFixed(2));
    }
    if (isIntermediateLevel && category === 'translation') {
      return Number(((intermediateTranslationPercent / 100) * max).toFixed(2));
    }
    if (isIntermediateLevel && category === 'writing') {
      return Number(((intermediateWritingPercent / 100) * max).toFixed(2));
    }
    if (isIntermediateLevel && category === 'speaking') {
      return Number(((intermediateSpeakingPercent / 100) * max).toFixed(2));
    }
    return Number(formData.sections?.[category] || 0);
  }

  const isSupportedWordScanFile = (file: File) => {
    const fileName = String(file.name || '').toLowerCase();
    const mime = String(file.type || '').toLowerCase();
    return mime.startsWith('image/') || mime === 'application/pdf' || fileName.endsWith('.pdf');
  };

  const extractWordsFromText = (rawText: string): string[] => {
    const tokens = String(rawText || '')
      .toLowerCase()
      .match(/[a-z][a-z'\-]{1,24}/g) || [];

    const unique: string[] = [];
    const seen = new Set<string>();
    for (const token of tokens) {
      const normalized = token.replace(/^'+|'+$/g, '');
      if (!normalized || normalized.length < 2) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      unique.push(normalized);
      if (unique.length >= 200) break;
    }

    return unique;
  };

  const applyScannedWords = (rawWords: string[]) => {
    const replacedWords: string[] = Array.from(new Set<string>(rawWords.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)));
    setVocabularyWordOptions(replacedWords);
    setFormData((prev) => ({
      ...prev,
      vocabularyWordList: [],
      vocabularySourceWordList: replacedWords,
    }));

    if (replacedWords.length === 0) {
      setWordScanError('Fayldan so‘z topilmadi, boshqa aniqroq rasm/PDF yuklang');
    }
  };

  const runLocalImageOcr = async (file: File): Promise<string[]> => {
    const tesseractModule = await import('tesseract.js');
    const recognize = tesseractModule.recognize;
    const result = await recognize(file, 'eng');
    const text = String(result?.data?.text || '');
    return extractWordsFromText(text);
  };

  const toggleWordSelection = (word: string) => {
    setFormData((prev) => {
      const isSelected = prev.vocabularyWordList.includes(word);
      return {
        ...prev,
        vocabularyWordList: isSelected
          ? prev.vocabularyWordList.filter((item) => item !== word)
          : [...prev.vocabularyWordList, word],
      };
    });
  };

  const removeWordFromList = (word: string) => {
    setVocabularyWordOptions((prev) => prev.filter((item) => item !== word));
    setFormData((prev) => ({
      ...prev,
      vocabularyWordList: prev.vocabularyWordList.filter((item) => item !== word),
      vocabularySourceWordList: prev.vocabularySourceWordList.filter((item) => item !== word),
    }));
  };

  const overallPercent = (() => {
    if (effectiveCategories.length === 0) return 0;
    const max = Number(formData.maxScore || 100) || 100;
    const percents = effectiveCategories.map((category) => {
      const score = getEffectiveSectionScore(category);
      return (Math.max(0, Math.min(score, max)) / max) * 100;
    });
    return Math.round((percents.reduce((sum, value) => sum + value, 0) / effectiveCategories.length) * 100) / 100;
  })();
  const finalOverallPercent = Number(Math.min(100, overallPercent + pronunciationBonus).toFixed(2));
  const overallPerformanceComment = finalOverallPercent >= 85
    ? 'Natija juda yaxshi, shu tempni davom ettiring.'
    : finalOverallPercent >= 65
      ? 'Natija yaxshi, ayrim joylarda qo‘shimcha mashq bilan yanada oshadi.'
      : 'Natijani ko‘tarish uchun uyda muntazam qisqa mashqlar tavsiya etiladi.';

  const autoOverallComment = [
    hasVocabularyCategory && vocabularyAutoComment ? vocabularyAutoComment : '',
    hasGrammarCategory && isFoundationLevel ? grammarAutoComment : '',
    (effectiveCategories as string[]).includes('speed_reading') && isFoundationLevel ? speedReadingAutoComment : '',
    (effectiveCategories as string[]).includes('translation') && isFoundationLevel ? translationAutoComment : '',
    (effectiveCategories as string[]).includes('attendance') && isFoundationLevel && participationSelection
      ? `${participationSelection.emoji} ${participationSelection.label}: ${participationSelection.comment}`
      : '',
    isIntermediateLevel
      ? [
          (effectiveCategories as string[]).includes('listening') ? `Listening ${intermediateListeningCorrectAnswers}/${intermediateListeningSelectedTotalQuestions} (${Math.round(intermediateListeningPercent)}%)` : '',
          (effectiveCategories as string[]).includes('reading') ? `Reading ${intermediateReadingCorrectAnswers}/${intermediateReadingSelectedTotalQuestions} (${Math.round(intermediateReadingPercent)}%)` : '',
          (effectiveCategories as string[]).includes('grammar') ? `Grammar ${intermediateGrammarCorrectAnswers}/${intermediateGrammarTotalQuestions} (${Math.round(intermediateGrammarPercent)}%)` : '',
          (effectiveCategories as string[]).includes('translation') ? `Translation ${intermediateTranslationCorrectAnswers}/${intermediateTranslationTotalQuestions} (${Math.round(intermediateTranslationPercent)}%)` : '',
          (effectiveCategories as string[]).includes('writing') ? `Writing ${intermediateWritingStandardScore}/75 (${Math.round(intermediateWritingPercent)}%)` : '',
          (effectiveCategories as string[]).includes('speaking') ? `Speaking ${intermediateSpeakingScore75}/75 (${intermediateSpeakingLevel})` : '',
        ].filter(Boolean).join(', ')
      : '',
    `Umumiy natija: ${finalOverallPercent.toFixed(1)}%. ${overallPerformanceComment}`,
  ].filter(Boolean).join(' ');

  const certificateCriteriaSummary = isIntermediateLevel
    ? [
        `Listening: ${intermediateListeningCorrectAnswers}/${intermediateListeningSelectedTotalQuestions} (${Math.round(intermediateListeningPercent)}%)`,
        `Reading: ${intermediateReadingCorrectAnswers}/${intermediateReadingSelectedTotalQuestions} (${Math.round(intermediateReadingPercent)}%)`,
        `Grammar: ${intermediateGrammarCorrectAnswers}/${intermediateGrammarTotalQuestions} (${Math.round(intermediateGrammarPercent)}%)`,
        `Translation: ${intermediateTranslationCorrectAnswers}/${intermediateTranslationTotalQuestions} (${Math.round(intermediateTranslationPercent)}%)`,
        `Writing: ${intermediateWritingStandardScore}/75 (${Math.round(intermediateWritingPercent)}%)`,
        `Speaking: ${intermediateSpeakingScore75}/75 (${intermediateSpeakingLevel})`,
      ].join(' · ')
    : [
        `Vocabulary: ${Math.round(vocabularyPercent)}%`,
        `Grammar: ${Math.round((grammarRawScore / 100) * 100)}%`,
        `Translation: ${Math.round(translationPercent)}%`,
        `Participation: ${Math.round(participationPercent)}%`,
      ].join(' · ');

  const resolvedOverallComment = String(formData.comment || '').trim() || autoOverallComment;

  const handleScanWordList = async (file?: File | null) => {
    if (!file) return;
    if (!isSupportedWordScanFile(file)) {
      setWordScanError('Faqat PDF yoki image fayl yuklang');
      return;
    }

    setVocabularyWordOptions([]);
    setFormData((prev) => ({
      ...prev,
      vocabularyWordList: [],
      vocabularySourceWordList: [],
    }));
    setWordScanError('');
    setWordScanLoading(true);
    try {
      const payload = new FormData();
      payload.append('file', file);
      const response = await fetch('/api/ai/word-scanner', {
        method: 'POST',
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(String(data?.error || 'Word scan failed'));
      }
      const scannedWords = Array.isArray(data?.words)
        ? data.words.map((item: any) => String(item?.word || '').trim()).filter(Boolean)
        : [];
      applyScannedWords(scannedWords);
    } catch (error) {
      const mime = String(file.type || '').toLowerCase();
      const canUseLocalOcr = mime.startsWith('image/');

      if (!canUseLocalOcr) {
        setWordScanError(error instanceof Error ? error.message : 'Word scan failed');
      } else {
        try {
          const localWords = await runLocalImageOcr(file);
          applyScannedWords(localWords);
          if (localWords.length > 0) {
            setWordScanError('Gemini ishlamadi, local OCR bilan so‘zlar olindi');
          }
        } catch (ocrError) {
          const baseError = error instanceof Error ? error.message : 'Word scan failed';
          const localError = ocrError instanceof Error ? ocrError.message : 'Local OCR failed';
          setWordScanError(`${baseError}. ${localError}`);
        }
      }
    } finally {
      setWordScanLoading(false);
    }
  };

  const handleWordDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsWordDropActive(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      void handleScanWordList(droppedFile);
    }
  };

  const formatPercent = (value: unknown) => {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return '0.0%';
    return `${numeric.toFixed(1)}%`;
  };

  const isFormValid = (() => {
    const selectedCategories = effectiveCategories as string[];
    const requiresVocabulary = selectedCategories.includes('vocabulary');
    const requiresGrammarFoundation = isFoundationLevel && selectedCategories.includes('grammar');
    const requiresTranslationFoundation = isFoundationLevel && selectedCategories.includes('translation');
    const requiresAttendanceFoundation = isFoundationLevel && selectedCategories.includes('attendance');

    const hasStudent = Boolean(formData.studentId);
    const validMaxScore = Number(formData.maxScore || 0) > 0;
    const validMockDateTime =
      formData.scoreType !== 'mock' || (Boolean(formData.examDate) && Boolean(formData.examTime));

    const allSectionsValid =
      effectiveCategories.length > 0 &&
      effectiveCategories.every((category) => {
        const raw = Number(formData.sections?.[category]);
        if (category === 'grammar' && isFoundationLevel) {
          return grammarRawScore >= 0 && grammarRawScore <= 100;
        }
        if (category === 'translation' && isFoundationLevel) {
          return translationRawScore >= 0 && translationRawScore <= 30;
        }
        if (category === 'attendance' && isFoundationLevel) {
          return participationRawScore >= 0 && participationRawScore <= 20;
        }
        if (isIntermediateLevel && category === 'listening') {
          return intermediateListeningPercent >= 0 && intermediateListeningPercent <= 100;
        }
        if (isIntermediateLevel && category === 'reading') {
          return intermediateReadingPercent >= 0 && intermediateReadingPercent <= 100;
        }
        if (isIntermediateLevel && category === 'grammar') {
          return intermediateGrammarPercent >= 0 && intermediateGrammarPercent <= 100;
        }
        if (isIntermediateLevel && category === 'translation') {
          return intermediateTranslationPercent >= 0 && intermediateTranslationPercent <= 100;
        }
        if (isIntermediateLevel && category === 'writing') {
          return intermediateWritingPercent >= 0 && intermediateWritingPercent <= 100;
        }
        if (isIntermediateLevel && category === 'speaking') {
          return intermediateSpeakingPercent >= 0 && intermediateSpeakingPercent <= 100;
        }
        return Number.isFinite(raw) && raw >= 0 && raw <= Number(formData.maxScore || 100);
      });

    const hasPositiveScore = finalOverallPercent > 0;

    const vocabularyValid = !requiresVocabulary || (
      vocabularyTotalWords > 0 &&
      vocabularyMemorizedWords >= 0 &&
      vocabularyMemorizedWords <= vocabularyTotalWords
    );

    const grammarValid = !requiresGrammarFoundation || grammarRawScore > 0;
    const translationValid = !requiresTranslationFoundation || translationRawScore > 0;
    const attendanceValid = !requiresAttendanceFoundation || participationRawScore > 0;
    const intermediateListeningValid = !isIntermediateLevel || !(effectiveCategories as string[]).includes('listening') || intermediateListeningSelectedTotalQuestions > 0;
    const intermediateReadingValid = !isIntermediateLevel || !(effectiveCategories as string[]).includes('reading') || intermediateReadingSelectedTotalQuestions > 0;
    const intermediateGrammarValid = !isIntermediateLevel || !(effectiveCategories as string[]).includes('grammar') || intermediateGrammarTotalQuestions > 0;
    const intermediateTranslationValid = !isIntermediateLevel || !(effectiveCategories as string[]).includes('translation') || intermediateTranslationTotalQuestions > 0;
    const intermediateWritingValid = !isIntermediateLevel || !(effectiveCategories as string[]).includes('writing') || intermediateWritingSelectedExpertMax > 0;
    const intermediateSpeakingValid = !isIntermediateLevel || !(effectiveCategories as string[]).includes('speaking') || intermediateSpeakingScore75 > 0;
    const intermediateMockTimeValid = !isIntermediateLevel || formData.scoreType !== 'mock' || intermediateTimeSpentMinutes > 0;

    const certificateValid = !certificateSelected || Boolean(certificateFile);

    return hasStudent && validMaxScore && validMockDateTime && allSectionsValid && hasPositiveScore && vocabularyValid && grammarValid && translationValid && attendanceValid && intermediateListeningValid && intermediateReadingValid && intermediateGrammarValid && intermediateTranslationValid && intermediateWritingValid && intermediateSpeakingValid && intermediateMockTimeValid && certificateValid && !vocabularyValidationError;
  })();

  const groupOptions = Array.from(new Set((students || []).map((student: any) => student.group || 'Not Assigned'))).sort((a, b) => a.localeCompare(b));

  const filteredScores = (scores || []).filter((score: any) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || getStudentName(score).toLowerCase().includes(query);
    const matchesGroup = !selectedGroup || getStudentGroup(score) === selectedGroup;
    return matchesSearch && matchesGroup;
  }).sort((a: any, b: any) => {
    const groupA = getStudentGroup(a);
    const groupB = getStudentGroup(b);
    if (groupA !== groupB) return groupA.localeCompare(groupB);
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const handleAddScore = async () => {
    if (!formData.studentId) {
      alert(t('please_select_student'));
      return;
    }

    const student = students.find((s: any) => String(s.id) === String(formData.studentId));
    const level = getLevelForStudent(formData.studentId);
    const maxScore = Number(formData.maxScore || 100);

    if (maxScore <= 0) {
      alert('Max score must be greater than 0');
      return;
    }

    if (finalOverallPercent <= 0) {
      alert('Kamida bitta bo‘limga 0 dan katta ball kiriting');
      return;
    }

    if ((effectiveCategories as string[]).includes('vocabulary')) {
      if (vocabularyTotalWords <= 0) {
        alert("Vocabulary uchun Total Words 0 dan katta bo'lishi kerak");
        return;
      }
      if (vocabularyMemorizedWords > vocabularyTotalWords) {
        alert("Xatolik: Yodlangan so'zlar jami so'zlardan ko'p bo'lishi mumkin emas");
        return;
      }
    }

    if (isFoundationLevel && (effectiveCategories as string[]).includes('grammar') && grammarRawScore <= 0) {
      alert('Grammar bo‘limida kamida bitta mezon uchun ball tanlang');
      return;
    }

    if (isFoundationLevel && (effectiveCategories as string[]).includes('translation') && translationRawScore <= 0) {
      alert('Translation bo‘limida kamida bitta mezon uchun ball tanlang');
      return;
    }

    if (isFoundationLevel && (effectiveCategories as string[]).includes('attendance') && participationRawScore <= 0) {
      alert('Participation bo‘limida emoji tanlang');
      return;
    }

    if (isIntermediateLevel && formData.scoreType === 'mock' && intermediateTimeSpentMinutes <= 0) {
      alert('Mock Exam uchun Time Spent (minutes) kiriting');
      return;
    }

    if (isIntermediateLevel && (effectiveCategories as string[]).includes('listening') && intermediateListeningSelectedTotalQuestions <= 0) {
      alert('Listening uchun kamida bitta partni Select qiling');
      return;
    }

    if (isIntermediateLevel && (effectiveCategories as string[]).includes('reading') && intermediateReadingSelectedTotalQuestions <= 0) {
      alert('Reading uchun kamida bitta partni Select qiling');
      return;
    }

    if (isIntermediateLevel && (effectiveCategories as string[]).includes('writing') && intermediateWritingSelectedExpertMax <= 0) {
      alert('Writing uchun kamida bitta taskni Select qiling');
      return;
    }

    if (isIntermediateLevel && (effectiveCategories as string[]).includes('grammar') && intermediateGrammarTotalQuestions <= 0) {
      alert('Grammar uchun jami savollar sonini kiriting');
      return;
    }

    if (isIntermediateLevel && (effectiveCategories as string[]).includes('translation') && intermediateTranslationTotalQuestions <= 0) {
      alert('Translation uchun jami savollar sonini kiriting');
      return;
    }

    if (isSelectableLevel && effectiveCategories.length === 0) {
      alert('Kamida bitta bo‘limni Selected qiling');
      return;
    }

    if (certificateSelected && !certificateFile) {
      alert('Sertifikat Selected bo‘lsa, fayl yuklang');
      return;
    }

    const getCurrentAdminId = () => {
      try {
        const raw = localStorage.getItem('currentAdmin');
        const admin = raw ? JSON.parse(raw) : null;
        return admin?.id ? String(admin.id) : '';
      } catch {
        return '';
      }
    };

    const uploadSelectedCertificate = async () => {
      if (!certificateSelected || !certificateFile) return;
      const adminId = getCurrentAdminId();
      if (!adminId) throw new Error('Admin aniqlanmadi');

      const certificatePayload = new FormData();
      certificatePayload.set('file', certificateFile);
      certificatePayload.set('studentId', String(formData.studentId));
      certificatePayload.set('level', String(currentLevel));
      certificatePayload.set('scoreType', String(formData.scoreType));
      certificatePayload.set('overallPercent', String(finalOverallPercent));
      certificatePayload.set('criteriaSummary', certificateCriteriaSummary);

      const certificateResponse = await fetch('/api/certificates', {
        method: 'POST',
        headers: {
          'x-admin-id': adminId,
        },
        body: certificatePayload,
      });
      const certificateData = await certificateResponse.json();
      if (!certificateResponse.ok) {
        throw new Error(String(certificateData?.error || 'Sertifikat yuklashda xatolik'));
      }
      setCertificateUploadSuccess('Sertifikat ham muvaffaqiyatli yuklandi ✅');
    };

    try {
      setCertificateUploadError('');
      setCertificateUploadSuccess('');
      await addScore({
        studentId: Number(formData.studentId),
        studentName: student?.fullName || '',
        subject: formData.scoreType === 'mock' ? 'MOCK imtihon' : 'Baholash',
        comment: resolvedOverallComment,
        value: Number(finalOverallPercent),
        overallPercent: Number(finalOverallPercent),
        level,
        category: 'overall',
        scoreType: formData.scoreType,
        maxScore,
        mockScore: formData.scoreType === 'mock' ? Number(finalOverallPercent) : null,
        examDate: formData.examDate,
        examTime: formData.examTime,
        breakdown: effectiveCategories.reduce((acc, category: CategoryKey) => {
          if (category === 'vocabulary') {
            const max = Number(formData.maxScore || 100) || 100;
            const scaledVocabularyScore = Number(((vocabularyPercent / 100) * max).toFixed(2));
            acc[category] = {
              score: scaledVocabularyScore,
              comment: vocabularyAutoComment || String(formData.sectionComments?.[category] || '').trim(),
              totalWords: vocabularyTotalWords,
              memorizedWords: Math.min(vocabularyMemorizedWords, vocabularyTotalWords),
              pronunciationBonus: formData.vocabularyPronunciationBonus,
              wordList: formData.vocabularyWordList,
              sourceWordList: formData.vocabularySourceWordList.length > 0 ? formData.vocabularySourceWordList : vocabularyWordOptions,
            };
            return acc;
          }

          if (category === 'grammar' && isFoundationLevel) {
            const max = Number(formData.maxScore || 100) || 100;
            const scaledGrammarScore = Number(((grammarRawScore / 100) * max).toFixed(2));
            const manualComment = String(formData.sectionComments?.[category] || '').trim();
            acc[category] = {
              score: scaledGrammarScore,
              comment: [grammarAutoComment, manualComment].filter(Boolean).join(' '),
              sentenceStructure: grammarSentenceStructure,
              topicMastery: grammarTopicMastery,
              toBeTenses: grammarTopicMastery,
              spelling: grammarSpelling,
              grammarTopic,
              rawScore: grammarRawScore,
            };
            return acc;
          }

          if (category === 'translation' && isFoundationLevel) {
            const max = Number(formData.maxScore || 100) || 100;
            const scaledTranslationScore = Number(((translationPercent / 100) * max).toFixed(2));
            const manualComment = String(formData.sectionComments?.[category] || '').trim();
            acc[category] = {
              score: scaledTranslationScore,
              comment: [translationAutoComment, manualComment].filter(Boolean).join(' '),
              readingFlow: translationReadingFlow,
              accuracy: translationAccuracy,
              pronunciation: translationPronunciation,
              rawScore: translationRawScore,
            };
            return acc;
          }

          if (category === 'attendance' && isFoundationLevel) {
            const max = Number(formData.maxScore || 100) || 100;
            const scaledParticipationScore = Number(((participationPercent / 100) * max).toFixed(2));
            const manualComment = String(formData.sectionComments?.[category] || '').trim();
            acc[category] = {
              score: scaledParticipationScore,
              comment: [participationSelection ? `${participationSelection.emoji} ${participationSelection.label}: ${participationSelection.comment}` : '', manualComment].filter(Boolean).join(' '),
              participationMode,
              participationEmoji: participationSelection?.emoji,
              participationLabel: participationSelection?.label,
              rawScore: participationRawScore,
            };
            return acc;
          }

          if (category === 'speed_reading' && isFoundationLevel) {
            const manualComment = String(formData.sectionComments?.[category] || '').trim();
            acc[category] = {
              score: speedReadingScore,
              comment: [speedReadingAutoComment, manualComment].filter(Boolean).join(' '),
              rawScore: speedReadingScore,
            };
            return acc;
          }

          if (isIntermediateLevel && category === 'listening') {
            const max = Number(formData.maxScore || 100) || 100;
            const scaled = Number(((intermediateListeningPercent / 100) * max).toFixed(2));
            acc[category] = {
              score: scaled,
              comment: [
                `Correct: ${intermediateListeningCorrectAnswers}/${intermediateListeningSelectedTotalQuestions}`,
                listeningWeakestPartLabel ? `Weakest: ${listeningWeakestPartLabel}` : '',
              ].filter(Boolean).join(' · '),
              totalQuestions: intermediateListeningSelectedTotalQuestions,
              correctAnswers: intermediateListeningCorrectAnswers,
              listeningParts: {
                part1: listeningPartRows[0]?.value || 0,
                part2: listeningPartRows[1]?.value || 0,
                part3: listeningPartRows[2]?.value || 0,
                part4: listeningPartRows[3]?.value || 0,
                part5: listeningPartRows[4]?.value || 0,
                part6: listeningPartRows[5]?.value || 0,
              },
              selectedParts: {
                part1: Boolean(listeningPartRows[0]?.isSelected),
                part2: Boolean(listeningPartRows[1]?.isSelected),
                part3: Boolean(listeningPartRows[2]?.isSelected),
                part4: Boolean(listeningPartRows[3]?.isSelected),
                part5: Boolean(listeningPartRows[4]?.isSelected),
                part6: Boolean(listeningPartRows[5]?.isSelected),
              },
              weakestPart: listeningWeakestPartLabel,
              selected: true,
              timeSpentMinutes: intermediateTimeSpentMinutes,
            };
            return acc;
          }

          if (isIntermediateLevel && category === 'reading') {
            const max = Number(formData.maxScore || 100) || 100;
            const scaled = Number(((intermediateReadingPercent / 100) * max).toFixed(2));
            acc[category] = {
              score: scaled,
              comment: [
                `Correct: ${intermediateReadingCorrectAnswers}/${intermediateReadingSelectedTotalQuestions}`,
                readingWeakestPartLabel ? `Weakest: ${readingWeakestPartLabel}` : '',
              ].filter(Boolean).join(' · '),
              totalQuestions: intermediateReadingSelectedTotalQuestions,
              correctAnswers: intermediateReadingCorrectAnswers,
              readingParts: {
                part1: readingPartRows[0]?.value || 0,
                part2: readingPartRows[1]?.value || 0,
                part3: readingPartRows[2]?.value || 0,
                part4: readingPartRows[3]?.value || 0,
                part5: readingPartRows[4]?.value || 0,
              },
              selectedParts: {
                part1: Boolean(readingPartRows[0]?.isSelected),
                part2: Boolean(readingPartRows[1]?.isSelected),
                part3: Boolean(readingPartRows[2]?.isSelected),
                part4: Boolean(readingPartRows[3]?.isSelected),
                part5: Boolean(readingPartRows[4]?.isSelected),
              },
              weakestPart: readingWeakestPartLabel,
              selected: true,
              timeSpentMinutes: intermediateTimeSpentMinutes,
            };
            return acc;
          }

          if (isIntermediateLevel && category === 'grammar') {
            const max = Number(formData.maxScore || 100) || 100;
            const scaled = Number(((intermediateGrammarPercent / 100) * max).toFixed(2));
            const manualComment = String(formData.sectionComments?.[category] || '').trim();
            acc[category] = {
              score: scaled,
              comment: [`Correct: ${intermediateGrammarCorrectAnswers}/${intermediateGrammarTotalQuestions}`, manualComment].filter(Boolean).join(' · '),
              totalQuestions: intermediateGrammarTotalQuestions,
              correctAnswers: intermediateGrammarCorrectAnswers,
              rawScore: intermediateGrammarCorrectAnswers,
              selected: true,
            };
            return acc;
          }

          if (isIntermediateLevel && category === 'translation') {
            const max = Number(formData.maxScore || 100) || 100;
            const scaled = Number(((intermediateTranslationPercent / 100) * max).toFixed(2));
            const manualComment = String(formData.sectionComments?.[category] || '').trim();
            acc[category] = {
              score: scaled,
              comment: [`Correct: ${intermediateTranslationCorrectAnswers}/${intermediateTranslationTotalQuestions}`, manualComment].filter(Boolean).join(' · '),
              totalQuestions: intermediateTranslationTotalQuestions,
              correctAnswers: intermediateTranslationCorrectAnswers,
              rawScore: intermediateTranslationCorrectAnswers,
              selected: true,
            };
            return acc;
          }

          if (isIntermediateLevel && category === 'writing') {
            const max = Number(formData.maxScore || 100) || 100;
            const scaled = Number(((intermediateWritingPercent / 100) * max).toFixed(2));
            const manualComment = String(formData.sectionComments?.[category] || '').trim();
            acc[category] = {
              score: scaled,
              comment: [intermediateWritingAutoComment, manualComment].filter(Boolean).join(' '),
              taskResponse: intermediateWritingTaskResponse,
              cohesion: intermediateWritingCohesion,
              grammar: intermediateWritingGrammar,
              task11: intermediateWritingTask11,
              task12: intermediateWritingTask12,
              task2: intermediateWritingTask2,
              selectedTasks: {
                task11: intermediateWritingSelectedTask11,
                task12: intermediateWritingSelectedTask12,
                task2: intermediateWritingSelectedTask2,
              },
              selected: true,
              timeSpentMinutes: intermediateTimeSpentMinutes,
            };
            return acc;
          }

          if (isIntermediateLevel && category === 'speaking') {
            const max = Number(formData.maxScore || 100) || 100;
            const scaled = Number(((intermediateSpeakingPercent / 100) * max).toFixed(2));
            const manualComment = String(formData.sectionComments?.[category] || '').trim();
            acc[category] = {
              score: scaled,
              comment: [intermediateSpeakingAutoComment, manualComment].filter(Boolean).join(' '),
              fluency: intermediateSpeakingFluency,
              lexical: intermediateSpeakingLexical,
              grammar: intermediateSpeakingGrammar,
              pronunciation: intermediateSpeakingPronunciation,
              cefrScore75: intermediateSpeakingScore75,
              levelDetected: intermediateSpeakingLevel,
              synonymBonus: intermediateSpeakingSynonymBonus,
              selected: true,
              timeSpentMinutes: intermediateTimeSpentMinutes,
            };
            return acc;
          }

          acc[category] = {
            score: getEffectiveSectionScore(category),
            comment: String(formData.sectionComments?.[category] || '').trim(),
          };
          return acc;
        }, {} as Record<string, BreakdownItemPayload>),
      });

      await uploadSelectedCertificate();

      await loadData();
      setFormData({
        studentId: '',
        scoreType: 'weekly',
        maxScore: 100,
        examDate: new Date().toISOString().split('T')[0],
        examTime: '10:00',
        comment: '',
        sections: {},
        sectionComments: {},
        vocabularyTotalWords: 0,
        vocabularyMemorizedWords: 0,
        vocabularyPronunciationBonus: false,
        vocabularyWordList: [],
        vocabularySourceWordList: [],
        grammarSentenceStructure: 0,
        grammarTopicMastery: 0,
        grammarSpelling: 0,
        grammarTopic: '',
        translationReadingFlow: 0,
        translationAccuracy: 0,
        translationPronunciation: 0,
        participationMode: '',
        intermediateListeningTotalQuestions: 35,
        intermediateListeningCorrectAnswers: 0,
        intermediateListeningPart1: 0,
        intermediateListeningPart2: 0,
        intermediateListeningPart3: 0,
        intermediateListeningPart4: 0,
        intermediateListeningPart5: 0,
        intermediateListeningPart6: 0,
        intermediateListeningSelectedPart1: true,
        intermediateListeningSelectedPart2: true,
        intermediateListeningSelectedPart3: true,
        intermediateListeningSelectedPart4: true,
        intermediateListeningSelectedPart5: true,
        intermediateListeningSelectedPart6: true,
        intermediateReadingTotalQuestions: 35,
        intermediateReadingCorrectAnswers: 0,
        intermediateReadingPart1: 0,
        intermediateReadingPart2: 0,
        intermediateReadingPart3: 0,
        intermediateReadingPart4: 0,
        intermediateReadingPart5: 0,
        intermediateReadingSelectedPart1: true,
        intermediateReadingSelectedPart2: true,
        intermediateReadingSelectedPart3: true,
        intermediateReadingSelectedPart4: true,
        intermediateReadingSelectedPart5: true,
        intermediateGrammarTotalQuestions: 0,
        intermediateGrammarCorrectAnswers: 0,
        intermediateTranslationTotalQuestions: 0,
        intermediateTranslationCorrectAnswers: 0,
        intermediateSelectedVocabulary: true,
        intermediateSelectedGrammar: true,
        intermediateSelectedTranslation: true,
        intermediateSelectedListening: true,
        intermediateSelectedReading: true,
        intermediateSelectedWriting: true,
        intermediateSelectedSpeaking: true,
        selectedSpeedReading: true,
        selectedAttendance: true,
        certificateSelected: false,
        intermediateTimeSpentMinutes: 0,
        intermediateWritingTask11: 0,
        intermediateWritingTask12: 0,
        intermediateWritingTask2: 0,
        intermediateWritingSelectedTask11: true,
        intermediateWritingSelectedTask12: true,
        intermediateWritingSelectedTask2: true,
        intermediateWritingTaskResponse: 0,
        intermediateWritingCohesion: 0,
        intermediateWritingGrammar: 0,
        intermediateSpeakingFluency: 0,
        intermediateSpeakingLexical: 0,
        intermediateSpeakingGrammar: 0,
        intermediateSpeakingPronunciation: 0,
        intermediateSpeakingSynonymBonus: 0,
      });
      setVocabularyWordOptions([]);
      setWordScanError('');
      setCertificateFile(null);
      setShowAddModal(false);
      setModalSelectedGroup('');
      setModalStudentSearchTerm('');
    } catch (error) {
      console.error('Score save error:', error);
      setCertificateUploadError(error instanceof Error ? error.message : t('failed_save_score'));
      alert(t('failed_save_score'));
    }
  };

  const handleDeleteScore = async (id: string | number) => {
    if (!confirm(t('delete_score_confirm'))) return;
    await fetch(`/api/scores?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' });
    await loadData();
  };

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
                <h1 className="text-2xl font-bold text-gray-900">{t('scores_management')}</h1>
                <p className="text-sm text-gray-500">{t('track_student_performance')}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedPanelLevel('');
                setModalSelectedGroup('');
                setModalStudentSearchTerm('');
                setShowAddModal(true);
              }}
              className="flex items-center space-x-2 bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-xl hover:shadow-lg transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>{t('add_score')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder={t('search_by_student_name')}
          />
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
          >
            <option value="">{t('all_groups')}</option>
            {groupOptions.map((group) => (
              <option key={group} value={group}>{group === 'Not Assigned' ? t('not_assigned') : group}</option>
            ))}
          </select>
        </div>
        <div className="space-y-4">
          {filteredScores.map((score, index) => (
            <motion.div key={score.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <span>{getStudentName(score)}</span>
                      {disconnectedStudentIds.has(Number(score.studentId || 0)) ? (
                        <span className="text-red-600 text-lg leading-none" title="Ota-ona bot aloqasi uzilgan">🛑</span>
                      ) : null}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {getStudentGroup(score) === 'Not Assigned' ? t('not_assigned') : getStudentGroup(score)} · {score.level || 'beginner'} · {new Date(score.createdAt || Date.now()).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${score.scoreType === 'mock' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {score.scoreType === 'mock' ? 'MOCK EXAM' : getWeekdayLabel(score)}
                      </span>
                      {score.examDateTime && (
                        <span className="text-xs text-gray-500">{new Date(score.examDateTime).toLocaleString()}</span>
                      )}
                    </div>
                    {score.comment && (
                      <p className="text-xs text-gray-600 mt-2 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 max-w-xl">
                        {score.comment}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-green-600">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-semibold">{formatPercent(score.overallPercent ?? score.value)}</span>
                  </div>
                  {score.scoreType === 'mock' && <Trophy className="w-5 h-5 text-purple-600" />}
                  <button
                    onClick={() => handleDeleteScore(score.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {score.breakdown && typeof score.breakdown === 'object' && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(score.breakdown as Record<string, any>).map(([key, val]) => {
                    const sectionScore = typeof val === 'object' && val !== null ? Number((val as any).score ?? 0) : Number(val || 0);
                    const sectionMax = typeof val === 'object' && val !== null ? Number((val as any).maxScore ?? 100) : 100;
                    const sectionPercent = typeof val === 'object' && val !== null
                      ? Number((val as any).percent ?? 0)
                      : sectionMax > 0
                        ? Number(((sectionScore / sectionMax) * 100).toFixed(2))
                        : 0;
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
                      <div key={key} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="flex items-center justify-between text-xs text-gray-700">
                          <span className="capitalize font-medium">{CATEGORY_LABELS[key] || key}</span>
                          <span>{sectionScore}/{sectionMax} · {formatPercent(sectionPercent)}</span>
                        </div>
                        {sectionCommentWithWords ? <p className="mt-1 text-[11px] text-gray-500">{sectionCommentWithWords}</p> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-2 sm:p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[94vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-5 sm:px-7 pt-5 sm:pt-7 pb-4 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('add_student_score')}</h2>
              <p className="text-sm text-gray-500">Level-based scoring + MOCK EXAM support</p>
            </div>

            <div className="px-5 sm:px-7 py-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setFormData((prev) => ({ ...prev, scoreType: 'weekly' }))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-300 ${formData.scoreType === 'weekly' ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-gray-700 border-gray-300 hover:bg-orange-50'}`}
              >
                WEEKLY SCORE
              </button>
              <button
                onClick={() => setFormData((prev) => ({ ...prev, scoreType: 'mock' }))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-300 ${formData.scoreType === 'mock' ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-gray-700 border-gray-300 hover:bg-purple-50'}`}
              >
                MOCK EXAM
              </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Panel Level Filter</label>
                  <select
                    value={selectedPanelLevel}
                    onChange={(e) => setSelectedPanelLevel(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="">All levels</option>
                    <option value="beginner">Beginner</option>
                    <option value="elementary">Elementary</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="ielts">IELTS</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Teacher faqat tanlangan level o‘quvchilarini ko‘radi.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Group Filter</label>
                    <select
                      value={modalSelectedGroup}
                      onChange={(e) => setModalSelectedGroup(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                    >
                      <option value="">{t('all_groups')}</option>
                      {groupOptions.map((group) => (
                        <option key={group} value={group}>{group === 'Not Assigned' ? t('not_assigned') : group}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('search')}</label>
                    <input
                      type="text"
                      value={modalStudentSearchTerm}
                      onChange={(e) => setModalStudentSearchTerm(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder={t('search_by_student_name')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('student')} *</label>
                  <select
                    value={formData.studentId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, studentId: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  >
                    <option value="">{t('select_student')}</option>
                    {filteredStudentsForModal.map((student: any) => (
                      <option key={student.id} value={student.id}>
                        {disconnectedStudentIds.has(Number(student.id)) ? '🛑 ' : ''}{student.fullName} ({student.group || t('no_group')}) — {LEVEL_LABELS[getLevelForStudentRow(student)] || 'Beginner'}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Topildi: {filteredStudentsForModal.length} ta o‘quvchi</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Level</label>
                  <input
                    type="text"
                    value={LEVEL_LABELS[currentLevel] || 'Beginner'}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-700"
                  />
                </div>

                <div className={`rounded-xl border px-4 py-3 ${isIntermediateLevel ? 'border-indigo-300 bg-indigo-50/70' : 'border-amber-300 bg-amber-50/70'}`}>
                  <p className={`text-sm font-semibold ${isIntermediateLevel ? 'text-indigo-700' : 'text-amber-700'}`}>
                    {isIntermediateLevel ? 'Intermediate / Advanced Panel' : 'Beginner / Elementary Panel'}
                  </p>
                  <p className={`text-xs mt-1 ${isIntermediateLevel ? 'text-indigo-600' : 'text-amber-600'}`}>
                    {isIntermediateLevel
                      ? 'Listening/Reading/Writing/Speaking smart criteria ishlatiladi.'
                      : 'Vocabulary/Grammar/Translation/Participation beginner mezonlari ishlatiladi.'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max score (each section)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.maxScore}
                    onChange={(e) => setFormData((prev) => ({ ...prev, maxScore: Number(e.target.value || 100) }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                {formData.scoreType === 'mock' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Mock Date</label>
                      <input
                        type="date"
                        value={formData.examDate}
                        onChange={(e) => setFormData((prev) => ({ ...prev, examDate: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Mock Time</label>
                      <input
                        type="time"
                        value={formData.examTime}
                        onChange={(e) => setFormData((prev) => ({ ...prev, examTime: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    {isIntermediateLevel && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Time Spent (minutes)</label>
                        <input
                          type="number"
                          min="0"
                          value={intermediateTimeSpentMinutes}
                          onChange={(e) => setFormData((prev) => ({ ...prev, intermediateTimeSpentMinutes: Math.max(0, Number(e.target.value || 0)) }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="Masalan: 95"
                        />
                      </div>
                    )}
                  </div>
                )}

                {isSelectableLevel ? (
                  <div className="rounded-xl border border-amber-300/40 bg-gradient-to-r from-black via-zinc-900 to-zinc-800 p-3 mb-3 text-amber-100">
                    <p className="text-xs uppercase tracking-wide text-amber-300 mb-2">Select sections to grade</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        ...currentCategories.map((category) => ({
                          key: categorySelectionStateKey[category],
                          label: CATEGORY_LABELS[category],
                        })),
                        ...(isIntermediateLevel ? [{ key: 'certificateSelected', label: 'Certificate Upload' }] : []),
                      ].map((item) => {
                        const active = Boolean((formData as any)[item.key]);
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, [item.key]: !Boolean((prev as any)[item.key]) }))}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${active ? 'bg-amber-400 text-black border-amber-300' : 'bg-black/25 text-amber-100 border-amber-300/40 hover:bg-black/40'}`}
                          >
                            {active ? '✅' : '⬜'} {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {isIntermediateLevel && certificateSelected ? (
                  <div className="rounded-xl border border-emerald-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-emerald-100 shadow-lg">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold tracking-wide text-emerald-200">CEFR Certificate Upload</label>
                      <span className="text-xs text-emerald-300">{formData.scoreType === 'mock' ? 'MOCK EXAM' : 'WEEKLY'}</span>
                    </div>

                    <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-emerald-300/40 bg-black/25 px-3 py-4 text-sm text-emerald-100 hover:bg-black/35">
                      {certificateFile ? `Tanlandi: ${certificateFile.name}` : 'Sertifikat faylini tanlang (.pdf/.jpg/.jpeg/.png)'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setCertificateFile(file);
                          setCertificateUploadError('');
                        }}
                      />
                    </label>

                    <p className="text-xs text-emerald-300 mt-2">Upload bo‘lgach botga baholash mezoni bilan yuboriladi.</p>
                    <p className="text-xs text-emerald-200/90 mt-1">Mezon: {certificateCriteriaSummary}</p>
                    {certificateUploadError ? <p className="text-xs text-red-300 mt-2">{certificateUploadError}</p> : null}
                    {certificateUploadSuccess ? <p className="text-xs text-emerald-300 mt-2">{certificateUploadSuccess}</p> : null}
                  </div>
                ) : null}

                <div className={`space-y-3 rounded-xl p-2 ${isIntermediateLevel ? 'bg-indigo-50/40 border border-indigo-100' : 'bg-amber-50/40 border border-amber-100'}`}>
                  {currentCategories.map((category) => {
                    if (isSelectableLevel && !sectionSelectionByCategory[category]) {
                      return (
                        <div key={category} className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                          {CATEGORY_LABELS[category]} bo‘limi Selected emas, bugungi hisobotga kirmaydi.
                        </div>
                      );
                    }

                    if (category === 'vocabulary') {
                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">Vocabulary</label>
                            <span className="text-sm text-amber-300">{formatPercent(vocabularyPercent)}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-xs mb-1 text-amber-200">Total Words</label>
                              <input
                                type="number"
                                min="0"
                                value={formData.vocabularyTotalWords}
                                onChange={(e) => {
                                  const nextTotal = Math.max(0, Number(e.target.value || 0));
                                  setFormData((prev) => ({
                                    ...prev,
                                    vocabularyTotalWords: nextTotal,
                                    vocabularyMemorizedWords: Math.min(prev.vocabularyMemorizedWords, nextTotal),
                                  }));
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-amber-300/40 bg-black/30 text-amber-50 focus:ring-2 focus:ring-amber-400 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1 text-amber-200">Memorized Words</label>
                              <input
                                type="number"
                                min="0"
                                value={formData.vocabularyMemorizedWords}
                                onChange={(e) => {
                                  const nextMemorized = Math.max(0, Number(e.target.value || 0));
                                  setFormData((prev) => ({
                                    ...prev,
                                    vocabularyMemorizedWords: nextMemorized,
                                  }));
                                }}
                                className={`w-full px-3 py-2 rounded-lg border bg-black/30 text-amber-50 focus:ring-2 outline-none ${vocabularyValidationError ? 'border-red-400 focus:ring-red-400' : 'border-amber-300/40 focus:ring-amber-400'}`}
                              />
                            </div>
                          </div>

                          {vocabularyValidationError ? (
                            <p className="text-xs text-red-300 mb-2">{vocabularyValidationError}</p>
                          ) : null}

                          <div className="flex items-center justify-between rounded-lg border border-amber-300/30 bg-black/20 px-3 py-2 mb-3">
                            <label className="text-sm text-amber-100 flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={formData.vocabularyPronunciationBonus}
                                onChange={(e) => setFormData((prev) => ({ ...prev, vocabularyPronunciationBonus: e.target.checked }))}
                                className="accent-amber-400"
                              />
                              Pronunciation ✅
                            </label>
                            <span className="text-xs text-amber-300">+5 bonus</span>
                          </div>

                          <div className="mb-3">
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <label className="block text-xs text-amber-200">Word List (multi-select)</label>
                              <label className="text-[11px] text-amber-300 cursor-pointer underline underline-offset-2">
                                {wordScanLoading ? 'Scanning...' : 'PDF/Image Upload'}
                                <input
                                  type="file"
                                  accept=".pdf,image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    void handleScanWordList(file);
                                    e.currentTarget.value = '';
                                  }}
                                />
                              </label>
                            </div>
                            <label
                              className={`mb-2 flex w-full cursor-pointer items-center justify-center rounded-lg border border-dashed px-3 py-3 text-xs transition-all ${isWordDropActive ? 'border-amber-300 bg-amber-300/10 text-amber-100' : 'border-amber-300/40 bg-black/25 text-amber-300 hover:bg-black/35'}`}
                              onDragEnter={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setIsWordDropActive(true);
                              }}
                              onDragOver={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setIsWordDropActive(true);
                              }}
                              onDragLeave={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setIsWordDropActive(false);
                              }}
                              onDrop={handleWordDrop}
                            >
                              {wordScanLoading ? 'Scanning file...' : 'Faylni shu yerga sudrab tashlang yoki bosib tanlang'}
                              <input
                                type="file"
                                accept=".pdf,image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  void handleScanWordList(file);
                                  e.currentTarget.value = '';
                                }}
                              />
                            </label>
                            <div className="w-full min-h-[96px] max-h-[220px] overflow-y-auto rounded-lg border border-amber-300/40 bg-black/30 p-2">
                              {vocabularyWordOptions.length === 0 ? (
                                <p className="px-2 py-4 text-sm text-amber-200/70">Hozircha so‘z yo‘q, rasm yoki PDF yuklang</p>
                              ) : (
                                <div className="space-y-2">
                                  {vocabularyWordOptions.map((word) => {
                                    const isSelected = formData.vocabularyWordList.includes(word);
                                    return (
                                      <div key={word} className="flex items-center justify-between gap-2 rounded-md border border-amber-300/30 bg-black/30 px-2 py-1.5">
                                        <span className="text-amber-50 text-base leading-none">{word}</span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => toggleWordSelection(word)}
                                            className={`px-2.5 py-1 rounded-md text-xs border transition-all ${isSelected ? 'bg-amber-400 text-black border-amber-300' : 'bg-black/30 text-amber-100 border-amber-300/40 hover:bg-black/45'}`}
                                          >
                                            {isSelected ? 'Selected' : 'Select'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => removeWordFromList(word)}
                                            className="px-2.5 py-1 rounded-md text-xs border border-red-400/40 text-red-200 hover:bg-red-500/10 transition-all"
                                          >
                                            Delete
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {wordScanError ? <p className="text-xs text-red-300 mt-1">{wordScanError}</p> : null}
                          </div>

                          <div className="rounded-lg border border-amber-400/30 bg-black/25 px-3 py-2">
                            <p className="text-xs text-amber-300 mb-1">Auto-comment</p>
                            <p className="text-sm text-amber-50">{vocabularyAutoComment || "Total Words va Memorized Words kiriting"}</p>
                          </div>
                        </div>
                      );
                    }

                    if (category === 'grammar' && isFoundationLevel) {
                      const grammarOptionButtonClass = (active: boolean) =>
                        `px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-all duration-200 ${active
                          ? 'bg-amber-400 text-black border-amber-300 shadow'
                          : 'bg-black/25 text-amber-100 border-amber-300/40 hover:bg-black/40'}`;

                      const renderQuickOptions = (current: number, max: number, onPick: (value: number) => void) => {
                        const step = max === 20 ? 5 : 10;
                        const options = Array.from({ length: Math.floor(max / step) + 1 }, (_, idx) => idx * step);
                        return (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {options.map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => onPick(value)}
                                className={grammarOptionButtonClass(current === value)}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        );
                      };

                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">Grammar — Quick-select</label>
                            <span className="text-sm text-amber-300">{grammarRawScore}/100</span>
                          </div>

                          <div className="space-y-3">
                            <div className="rounded-lg border border-amber-300/30 bg-black/20 px-3 py-2">
                              <label className="block text-xs mb-1 text-amber-200">Grammar Topic</label>
                              <input
                                list="grammar-topic-options"
                                type="text"
                                value={grammarTopic}
                                onChange={(e) => setFormData((prev) => ({ ...prev, grammarTopic: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg border border-amber-300/40 bg-black/30 text-amber-50 focus:ring-2 focus:ring-amber-400 outline-none"
                                placeholder="Masalan: Present Continuous"
                              />
                              <datalist id="grammar-topic-options">
                                <option value="Present Simple" />
                                <option value="Present Continuous" />
                                <option value="Past Simple" />
                                <option value="Future Simple" />
                                <option value="Articles (a/an/the)" />
                                <option value="Prepositions" />
                                <option value="Word Order" />
                              </datalist>
                            </div>

                            <div className="rounded-lg border border-amber-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Sentence Structure</span>
                                <span>{grammarSentenceStructure}/40</span>
                              </div>
                              {renderQuickOptions(grammarSentenceStructure, 40, (value) => setFormData((prev) => ({ ...prev, grammarSentenceStructure: value })))}
                            </div>

                            <div className="rounded-lg border border-amber-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Topic Mastery</span>
                                <span>{grammarTopicMastery}/40</span>
                              </div>
                              {renderQuickOptions(grammarTopicMastery, 40, (value) => setFormData((prev) => ({ ...prev, grammarTopicMastery: value })))}
                            </div>

                            <div className="rounded-lg border border-amber-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Spelling</span>
                                <span>{grammarSpelling}/20</span>
                              </div>
                              {renderQuickOptions(grammarSpelling, 20, (value) => setFormData((prev) => ({ ...prev, grammarSpelling: value })))}
                            </div>

                            <div className="rounded-lg border border-amber-400/30 bg-black/25 px-3 py-2">
                              <p className="text-xs text-amber-300 mb-1">Auto-comment</p>
                              <p className="text-sm text-amber-50">{grammarAutoComment || "Grammar holatiga qarab izoh avtomatik qo'shiladi"}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (category === 'speed_reading' && isFoundationLevel) {
                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">Speed Reading</label>
                            <span className="text-sm text-amber-300">{speedReadingScore}/{formData.maxScore}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max={Math.max(1, Number(formData.maxScore || 100))}
                            value={speedReadingScore}
                            onChange={(e) => setFormData((prev) => ({ ...prev, sections: { ...prev.sections, speed_reading: Number(e.target.value || 0) } }))}
                            className="w-full accent-amber-400"
                          />
                          <div className="mt-3 rounded-lg border border-amber-400/30 bg-black/25 px-3 py-2">
                            <p className="text-xs text-amber-300 mb-1">Auto-comment</p>
                            <p className="text-sm text-amber-50">{speedReadingAutoComment}</p>
                          </div>
                        </div>
                      );
                    }

                    if (category === 'translation' && isFoundationLevel) {
                      const translationOptionButtonClass = (active: boolean) =>
                        `px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-all ${active
                          ? 'bg-amber-400 text-black border-amber-300 shadow'
                          : 'bg-black/25 text-amber-100 border-amber-300/40 hover:bg-black/40'}`;

                      const renderTranslationOptions = (current: number, onPick: (value: number) => void) => {
                        const options = Array.from({ length: 11 }, (_, idx) => idx);
                        return (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {options.map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => onPick(value)}
                                className={translationOptionButtonClass(current === value)}
                              >
                                {value}
                              </button>
                            ))}
                          </div>
                        );
                      };

                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">Translation — Quick-select</label>
                            <span className="text-sm text-amber-300">{translationRawScore}/30</span>
                          </div>

                          <div className="space-y-3">
                            <div className="rounded-lg border border-amber-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Reading Flow</span>
                                <span>{translationReadingFlow}/10</span>
                              </div>
                              {renderTranslationOptions(translationReadingFlow, (value) => setFormData((prev) => ({ ...prev, translationReadingFlow: value })))}
                            </div>

                            <div className="rounded-lg border border-amber-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Accuracy</span>
                                <span>{translationAccuracy}/10</span>
                              </div>
                              {renderTranslationOptions(translationAccuracy, (value) => setFormData((prev) => ({ ...prev, translationAccuracy: value })))}
                            </div>

                            <div className="rounded-lg border border-amber-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span>Pronunciation</span>
                                <span>{translationPronunciation}/10</span>
                              </div>
                              {renderTranslationOptions(translationPronunciation, (value) => setFormData((prev) => ({ ...prev, translationPronunciation: value })))}
                            </div>

                            <div className="rounded-lg border border-amber-400/30 bg-black/25 px-3 py-2">
                              <p className="text-xs text-amber-300 mb-1">Auto-comment</p>
                              <p className="text-sm text-amber-50">{translationAutoComment}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (category === 'attendance' && isFoundationLevel) {
                      const participationOptions: Array<{ key: string; emoji: string; title: string; subtitle: string }> = [
                        { key: 'super_active', emoji: '🔥', title: 'Super Active', subtitle: 'Darsda hamma savollarga javob berdi' },
                        { key: 'active', emoji: '✅', title: 'Active', subtitle: 'Vazifalarni bajardi' },
                        { key: 'passive', emoji: '💤', title: 'Passive', subtitle: 'Darsda biroz charchagan yoki e’tiborsiz' },
                      ];

                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">Participation — Emoji Select</label>
                            <span className="text-sm text-amber-300">{participationRawScore}/20</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {participationOptions.map((option) => {
                              const isActive = participationMode === option.key;
                              return (
                                <button
                                  key={option.key}
                                  type="button"
                                  onClick={() => setFormData((prev) => ({ ...prev, participationMode: option.key }))}
                                  className={`text-left rounded-lg border px-3 py-3 transition-all ${isActive ? 'border-amber-300 bg-amber-400/20' : 'border-amber-300/40 bg-black/20 hover:bg-black/35'}`}
                                >
                                  <p className="text-base font-semibold">{option.emoji} {option.title}</p>
                                  <p className="text-xs text-amber-200 mt-1">{option.subtitle}</p>
                                  <p className="text-xs text-amber-300 mt-2">Ball: {participationModeMap[option.key].score}/20</p>
                                </button>
                              );
                            })}
                          </div>

                          <div className="rounded-lg border border-amber-400/30 bg-black/25 px-3 py-2 mt-3">
                            <p className="text-xs text-amber-300 mb-1">Auto-comment</p>
                            <p className="text-sm text-amber-50">{participationSelection ? `${participationSelection.emoji} ${participationSelection.label}: ${participationSelection.comment}` : 'Emoji tanlang, izoh avtomatik chiqadi.'}</p>
                          </div>
                        </div>
                      );
                    }

                    if (isIntermediateLevel && category === 'listening') {
                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">Listening — 6 Parts (35 questions)</label>
                            <span className="text-sm text-amber-300">{intermediateListeningCorrectAnswers}/{intermediateListeningSelectedTotalQuestions} · {Math.round(intermediateListeningPercent)}%</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {listeningPartRows.map((part, index) => {
                              const fieldKey = `intermediateListeningPart${index + 1}`;
                              const selectedKey = `intermediateListeningSelectedPart${index + 1}`;
                              return (
                                <div key={part.key} className={`rounded-lg border px-3 py-2 ${part.isSelected ? 'border-amber-300/30 bg-black/20' : 'border-zinc-600/40 bg-black/10 opacity-85'}`}>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <label className="block text-xs text-amber-200">{part.label}</label>
                                    <button
                                      type="button"
                                      onClick={() => setFormData((prev) => ({ ...prev, [selectedKey]: !(prev as any)[selectedKey] }))}
                                      className={`px-2 py-1 rounded-md border text-[11px] font-semibold transition-all ${part.isSelected ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100' : 'border-zinc-500 bg-zinc-700/40 text-zinc-200 hover:bg-zinc-700/60'}`}
                                    >
                                      {part.isSelected ? 'Selected' : 'Select'}
                                    </button>
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    max={part.max}
                                    value={part.value}
                                    disabled={!part.isSelected}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, [fieldKey]: Math.max(0, Math.min(part.max, Number(e.target.value || 0))) }))}
                                    className="w-full px-3 py-2 rounded-lg border border-amber-300/40 bg-black/30 text-amber-50 focus:ring-2 focus:ring-amber-400 outline-none"
                                  />
                                  <p className="text-[11px] text-amber-300 mt-1">Max: {part.max}{part.isSelected ? '' : ' · hisobga olinmaydi'}</p>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-amber-200/90 mt-2">Auto convert: {intermediateListeningCorrectAnswers}/{intermediateListeningSelectedTotalQuestions || 0} → {Math.round(intermediateListeningPercent)}/100</p>
                          {listeningWeakestPartLabel ? <p className="text-xs text-red-300 mt-1">Diagnostic focus: {listeningWeakestPartLabel}</p> : null}
                        </div>
                      );
                    }

                    if (isIntermediateLevel && category === 'reading') {
                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">Reading — 5 Parts (35 questions)</label>
                            <span className="text-sm text-amber-300">{intermediateReadingCorrectAnswers}/{intermediateReadingSelectedTotalQuestions} · {Math.round(intermediateReadingPercent)}%</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {readingPartRows.map((part, index) => {
                              const fieldKey = `intermediateReadingPart${index + 1}`;
                              const selectedKey = `intermediateReadingSelectedPart${index + 1}`;
                              return (
                                <div key={part.key} className={`rounded-lg border px-3 py-2 ${part.isSelected ? 'border-amber-300/30 bg-black/20' : 'border-zinc-600/40 bg-black/10 opacity-85'}`}>
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <label className="block text-xs text-amber-200">{part.label}</label>
                                    <button
                                      type="button"
                                      onClick={() => setFormData((prev) => ({ ...prev, [selectedKey]: !(prev as any)[selectedKey] }))}
                                      className={`px-2 py-1 rounded-md border text-[11px] font-semibold transition-all ${part.isSelected ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100' : 'border-zinc-500 bg-zinc-700/40 text-zinc-200 hover:bg-zinc-700/60'}`}
                                    >
                                      {part.isSelected ? 'Selected' : 'Select'}
                                    </button>
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    max={part.max}
                                    value={part.value}
                                    disabled={!part.isSelected}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, [fieldKey]: Math.max(0, Math.min(part.max, Number(e.target.value || 0))) }))}
                                    className="w-full px-3 py-2 rounded-lg border border-amber-300/40 bg-black/30 text-amber-50 focus:ring-2 focus:ring-amber-400 outline-none"
                                  />
                                  <p className="text-[11px] text-amber-300 mt-1">Max: {part.max}{part.isSelected ? '' : ' · hisobga olinmaydi'}</p>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-amber-200/90 mt-2">Auto convert: {intermediateReadingCorrectAnswers}/{intermediateReadingSelectedTotalQuestions || 0} → {Math.round(intermediateReadingPercent)}/100</p>
                          {readingWeakestPartLabel ? <p className="text-xs text-red-300 mt-1">Diagnostic focus: {readingWeakestPartLabel}</p> : null}
                        </div>
                      );
                    }

                    if (isIntermediateLevel && category === 'grammar') {
                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">Grammar — Savollar bo‘yicha</label>
                            <span className="text-sm text-amber-300">{intermediateGrammarCorrectAnswers}/{intermediateGrammarTotalQuestions} · {Math.round(intermediateGrammarPercent)}%</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs mb-1 text-amber-200">Jami savollar</label>
                              <input
                                type="number"
                                min="0"
                                value={intermediateGrammarTotalQuestions}
                                onChange={(e) => setFormData((prev) => ({ ...prev, intermediateGrammarTotalQuestions: Math.max(0, Number(e.target.value || 0)) }))}
                                className="w-full px-3 py-2 rounded-lg border border-amber-300/40 bg-black/30 text-amber-50 focus:ring-2 focus:ring-amber-400 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1 text-amber-200">To‘g‘ri javoblar</label>
                              <input
                                type="number"
                                min="0"
                                max={Math.max(0, intermediateGrammarTotalQuestions)}
                                value={intermediateGrammarCorrectAnswers}
                                onChange={(e) => setFormData((prev) => ({ ...prev, intermediateGrammarCorrectAnswers: Math.max(0, Number(e.target.value || 0)) }))}
                                className="w-full px-3 py-2 rounded-lg border border-amber-300/40 bg-black/30 text-amber-50 focus:ring-2 focus:ring-amber-400 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (isIntermediateLevel && category === 'translation') {
                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">Translation — Savollar bo‘yicha</label>
                            <span className="text-sm text-amber-300">{intermediateTranslationCorrectAnswers}/{intermediateTranslationTotalQuestions} · {Math.round(intermediateTranslationPercent)}%</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs mb-1 text-amber-200">Jami savollar</label>
                              <input
                                type="number"
                                min="0"
                                value={intermediateTranslationTotalQuestions}
                                onChange={(e) => setFormData((prev) => ({ ...prev, intermediateTranslationTotalQuestions: Math.max(0, Number(e.target.value || 0)) }))}
                                className="w-full px-3 py-2 rounded-lg border border-amber-300/40 bg-black/30 text-amber-50 focus:ring-2 focus:ring-amber-400 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs mb-1 text-amber-200">To‘g‘ri javoblar</label>
                              <input
                                type="number"
                                min="0"
                                max={Math.max(0, intermediateTranslationTotalQuestions)}
                                value={intermediateTranslationCorrectAnswers}
                                onChange={(e) => setFormData((prev) => ({ ...prev, intermediateTranslationCorrectAnswers: Math.max(0, Number(e.target.value || 0)) }))}
                                className="w-full px-3 py-2 rounded-lg border border-amber-300/40 bg-black/30 text-amber-50 focus:ring-2 focus:ring-amber-400 outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (isIntermediateLevel && category === 'writing') {
                      const writingButtonClass = (active: boolean) =>
                        `px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-all ${active ? 'bg-emerald-400 text-black border-emerald-300 shadow' : 'bg-black/25 text-emerald-100 border-emerald-300/40 hover:bg-black/40'}`;
                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">Writing — Task Split</label>
                            <span className="text-sm text-amber-300">Overall: {Math.round(intermediateWritingPercent)}/100 · Selected {intermediateWritingSelectedExpertMark}/{intermediateWritingSelectedExpertMax}</span>
                          </div>

                          <div className="space-y-3">
                            <div className="rounded-lg border border-emerald-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1 gap-2">
                                <span>Task 1.1</span>
                                <div className="flex items-center gap-2">
                                  <span>{intermediateWritingTask11}/5</span>
                                  <button
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, intermediateWritingSelectedTask11: !(prev as any).intermediateWritingSelectedTask11 }))}
                                    className={`px-2 py-1 rounded-md border text-[11px] font-semibold transition-all ${intermediateWritingSelectedTask11 ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100' : 'border-zinc-500 bg-zinc-700/40 text-zinc-200 hover:bg-zinc-700/60'}`}
                                  >
                                    {intermediateWritingSelectedTask11 ? 'Selected' : 'Select'}
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {writingTask11Options.map((value) => (
                                  <button key={`wt-${value}`} type="button" disabled={!intermediateWritingSelectedTask11} onClick={() => setFormData((prev) => ({ ...prev, intermediateWritingTask11: value }))} className={`${writingButtonClass(intermediateWritingTask11 === value)} ${!intermediateWritingSelectedTask11 ? 'opacity-40 cursor-not-allowed' : ''}`}>{value}</button>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-lg border border-emerald-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1 gap-2">
                                <span>Task 1.2</span>
                                <div className="flex items-center gap-2">
                                  <span>{intermediateWritingTask12}/5</span>
                                  <button
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, intermediateWritingSelectedTask12: !(prev as any).intermediateWritingSelectedTask12 }))}
                                    className={`px-2 py-1 rounded-md border text-[11px] font-semibold transition-all ${intermediateWritingSelectedTask12 ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100' : 'border-zinc-500 bg-zinc-700/40 text-zinc-200 hover:bg-zinc-700/60'}`}
                                  >
                                    {intermediateWritingSelectedTask12 ? 'Selected' : 'Select'}
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {writingTask11Options.map((value) => (
                                  <button key={`wc-${value}`} type="button" disabled={!intermediateWritingSelectedTask12} onClick={() => setFormData((prev) => ({ ...prev, intermediateWritingTask12: value }))} className={`${writingButtonClass(intermediateWritingTask12 === value)} ${!intermediateWritingSelectedTask12 ? 'opacity-40 cursor-not-allowed' : ''}`}>{value}</button>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-lg border border-emerald-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1 gap-2">
                                <span>Task 2</span>
                                <div className="flex items-center gap-2">
                                  <span>{intermediateWritingTask2}/7</span>
                                  <button
                                    type="button"
                                    onClick={() => setFormData((prev) => ({ ...prev, intermediateWritingSelectedTask2: !(prev as any).intermediateWritingSelectedTask2 }))}
                                    className={`px-2 py-1 rounded-md border text-[11px] font-semibold transition-all ${intermediateWritingSelectedTask2 ? 'border-emerald-300 bg-emerald-400/20 text-emerald-100' : 'border-zinc-500 bg-zinc-700/40 text-zinc-200 hover:bg-zinc-700/60'}`}
                                  >
                                    {intermediateWritingSelectedTask2 ? 'Selected' : 'Select'}
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {writingTask2Options.map((value) => (
                                  <button key={`wg-${value}`} type="button" disabled={!intermediateWritingSelectedTask2} onClick={() => setFormData((prev) => ({ ...prev, intermediateWritingTask2: value }))} className={`${writingButtonClass(intermediateWritingTask2 === value)} ${!intermediateWritingSelectedTask2 ? 'opacity-40 cursor-not-allowed' : ''}`}>{value}</button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-emerald-400/30 bg-black/25 px-3 py-2 mt-3">
                            <p className="text-xs text-emerald-300 mb-1">Auto-comment</p>
                            <p className="text-sm text-emerald-50">{intermediateWritingAutoComment}</p>
                          </div>
                        </div>
                      );
                    }

                    if (isIntermediateLevel && category === 'speaking') {
                      const speakingButtonClass = (active: boolean) =>
                        `px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-all ${active ? 'bg-amber-400 text-black border-amber-300 shadow' : 'bg-black/25 text-amber-100 border-amber-300/40 hover:bg-black/40'}`;
                      const scoreOptions = [0, 5, 10, 15, 20, 25];
                      const synonymOptions = [0, 5, 10];
                      return (
                        <div key={category} className="rounded-xl border border-amber-300/40 bg-gradient-to-br from-black via-zinc-900 to-zinc-800 p-4 text-amber-100 shadow-lg">
                          <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-semibold tracking-wide text-amber-200">CEFR Speaking — 75 ballik tizim</label>
                            <span className="text-sm text-amber-300">{intermediateSpeakingScore75}/75 · {intermediateSpeakingLevel}</span>
                          </div>

                          <div className="space-y-3">
                            <div className="rounded-lg border border-cyan-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1"><span>Fluency</span><span>{intermediateSpeakingFluency}</span></div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {scoreOptions.map((value) => (
                                  <button key={`sf-${value}`} type="button" onClick={() => setFormData((prev) => ({ ...prev, intermediateSpeakingFluency: value }))} className={speakingButtonClass(intermediateSpeakingFluency === value)}>{value}</button>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-lg border border-amber-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1"><span>Lexical Resource</span><span>{intermediateSpeakingLexical}</span></div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {scoreOptions.map((value) => (
                                  <button key={`sl-${value}`} type="button" onClick={() => setFormData((prev) => ({ ...prev, intermediateSpeakingLexical: value }))} className={speakingButtonClass(intermediateSpeakingLexical === value)}>{value}</button>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-lg border border-amber-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1"><span>Grammar</span><span>{intermediateSpeakingGrammar}</span></div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {scoreOptions.map((value) => (
                                  <button key={`sg-${value}`} type="button" onClick={() => setFormData((prev) => ({ ...prev, intermediateSpeakingGrammar: value }))} className={speakingButtonClass(intermediateSpeakingGrammar === value)}>{value}</button>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-lg border border-cyan-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1"><span>Pronunciation</span><span>{intermediateSpeakingPronunciation}</span></div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {scoreOptions.map((value) => (
                                  <button key={`sp-${value}`} type="button" onClick={() => setFormData((prev) => ({ ...prev, intermediateSpeakingPronunciation: value }))} className={speakingButtonClass(intermediateSpeakingPronunciation === value)}>{value}</button>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-lg border border-cyan-300/30 bg-black/20 px-3 py-2">
                              <div className="flex items-center justify-between text-xs mb-1"><span>Synonym Check bonus</span><span>+{intermediateSpeakingSynonymBonus}</span></div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {synonymOptions.map((value) => (
                                  <button key={`sb-${value}`} type="button" onClick={() => setFormData((prev) => ({ ...prev, intermediateSpeakingSynonymBonus: value }))} className={speakingButtonClass(intermediateSpeakingSynonymBonus === value)}>+{value}</button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-cyan-400/30 bg-black/25 px-3 py-2 mt-3">
                            <p className="text-xs text-cyan-300 mb-1">Auto-comment</p>
                            <p className="text-sm text-cyan-50">{intermediateSpeakingAutoComment}</p>
                          </div>
                        </div>
                      );
                    }

                    const currentValue = Number(formData.sections?.[category] || 0);
                    return (
                      <div key={category} className="rounded-xl border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">{CATEGORY_LABELS[category]}</label>
                          <span className="text-sm text-gray-500">{currentValue}/{formData.maxScore}</span>
                        </div>
                        <div className="grid grid-cols-[1fr,88px] gap-3 items-center">
                          <input
                            type="range"
                            min="0"
                            max={Math.max(1, Number(formData.maxScore || 100))}
                            value={currentValue}
                            onChange={(e) => {
                              const next = Number(e.target.value || 0);
                              setFormData((prev) => ({
                                ...prev,
                                sections: { ...prev.sections, [category]: next },
                              }));
                            }}
                            className="w-full accent-orange-500"
                          />
                          <input
                            type="number"
                            min="0"
                            max={Math.max(1, Number(formData.maxScore || 100))}
                            value={currentValue}
                            onChange={(e) => {
                              const next = Number(e.target.value || 0);
                              setFormData((prev) => ({
                                ...prev,
                                sections: { ...prev.sections, [category]: next },
                              }));
                            }}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                          />
                        </div>
                        <textarea
                          value={String(formData.sectionComments?.[category] || '')}
                          onChange={(e) => {
                            const nextComment = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              sectionComments: { ...prev.sectionComments, [category]: nextComment },
                            }));
                          }}
                          className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                          rows={2}
                          placeholder={`${CATEGORY_LABELS[category]} izohi (nima uchun shu ball qo'yildi)`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">% Overall (auto)</span>
                  <span className="text-lg font-bold text-gray-900">{formatPercent(finalOverallPercent)}</span>
                </div>

                {formData.vocabularyPronunciationBonus && (
                  <p className="text-xs text-amber-700 font-medium">Pronunciation bonus qo‘shildi: +5%</p>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('comment')}</label>
                  <textarea
                    value={resolvedOverallComment}
                    onChange={(e) => setFormData((prev) => ({ ...prev, comment: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                    rows={3}
                    placeholder={t('score_comment_placeholder')}
                  />
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-7 py-4 border-t border-gray-100 bg-white sticky bottom-0">
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setSelectedPanelLevel('');
                    setModalSelectedGroup('');
                    setModalStudentSearchTerm('');
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleAddScore}
                  disabled={!isFormValid}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('add_score')}
                </button>
              </div>
              {!isFormValid && (
                <p className="text-xs text-gray-500 mt-2">
                  O‘quvchi tanlanib, bo‘lim ballari to‘g‘ri kiritilgan, Vocabulary valid bo‘lsa va umumiy foiz 0%dan katta bo‘lsa qo‘shish tugmasi aktiv bo‘ladi.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
