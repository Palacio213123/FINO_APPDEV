import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Reanimated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { spacing, radius } from '../constants/theme';
import SegmentedTabRow from '../components/SegmentedTabRow';
import {
  FINANCIAL_EDUCATION_TOPICS,
  type EduTopic,
} from '../constants/financialEducationContent';

// Scoped per user (matches ProfileSidebar's `fino_deferred_${userId}_...`
// convention) — a bare global key would leak one account's quiz results to
// the next person signed into a shared/handed-down device.
const SCORES_STORAGE_KEY_PREFIX = '@fino_edu_quiz_scores';

const topicTabItems = FINANCIAL_EDUCATION_TOPICS.map((t) => ({
  key: t.id,
  label: t.tabLabel,
  icon: t.icon as any,
}));

// The "Standard" spring preset from DESIGN_LANGUAGE.md, used app-wide for
// chip/selection bounce.
const STANDARD_SPRING = { damping: 16, stiffness: 220, mass: 0.55 };

type ScoresMap = Record<string, { score: number; total: number }>;

type AnswersState = (number | null)[];

function emptyAnswers(topic: EduTopic): AnswersState {
  return new Array(topic.quiz.length).fill(null);
}

// ~20s per lesson bullet, rounded up to whole minutes.
function estimateReadMinutes(topic: EduTopic): number {
  return Math.max(1, Math.ceil((topic.lesson.length * 20) / 60));
}

function QuizOptionRow({
  label,
  selected,
  submitted,
  isCorrect,
  colors,
  style,
  textColor,
  onPress,
}: {
  label: string;
  selected: boolean;
  submitted: boolean;
  isCorrect: boolean;
  colors: any;
  style: object;
  textColor: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (submitted) return;
    Haptics.selectionAsync().catch(() => {});
    scale.value = withSequence(
      withSpring(1.04, STANDARD_SPRING),
      withSpring(1, STANDARD_SPRING)
    );
    onPress();
  };

  return (
    <Reanimated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={submitted}
        style={style}
      >
        <View
          style={[
            optionStyles.radio,
            { borderColor: selected ? colors.primary : colors.border },
          ]}
        >
          {selected && !submitted ? (
            <View
              style={[
                optionStyles.radioDot,
                { backgroundColor: colors.primary },
              ]}
            />
          ) : null}
          {submitted && isCorrect ? (
            <Ionicons name="checkmark" size={12} color={colors.incomeGreen} />
          ) : null}
          {submitted && selected && !isCorrect ? (
            <Ionicons name="close" size={12} color={colors.expenseRed} />
          ) : null}
        </View>
        <Text style={[optionStyles.text, { color: textColor }]}>{label}</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

const optionStyles = StyleSheet.create({
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  text: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
});

export default function FinancialEducationScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const { currentUserId } = useAuth();
  const scoresKey = currentUserId
    ? `${SCORES_STORAGE_KEY_PREFIX}_${currentUserId}`
    : null;

  const [activeTopicId, setActiveTopicId] = useState(
    FINANCIAL_EDUCATION_TOPICS[0].id
  );
  const [answersByTopic, setAnswersByTopic] = useState<
    Record<string, AnswersState>
  >({});
  const [submittedTopics, setSubmittedTopics] = useState<
    Record<string, boolean>
  >({});
  const [savedScores, setSavedScores] = useState<ScoresMap>({});
  // Gates the persist effect below so it never fires before the initial load
  // resolves — writing the empty default state first would wipe out
  // whatever was already on disk.
  const scoresLoadedRef = useRef(false);

  useEffect(() => {
    scoresLoadedRef.current = false;
    setSavedScores({});
    if (!scoresKey) return undefined;
    let cancelled = false;
    AsyncStorage.getItem(scoresKey)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const stored = JSON.parse(raw) as ScoresMap;
            // Merge rather than replace: a quiz submitted while this read was
            // still in flight must not be clobbered by the older on-disk copy.
            setSavedScores((prev) => ({ ...stored, ...prev }));
          } catch {
            // ignore corrupt cache
          }
        }
      })
      .finally(() => {
        if (!cancelled) scoresLoadedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [scoresKey]);

  // Persists whenever scores change, always from the latest committed state
  // (not a closure snapshot) — this is what actually fixes the race: no
  // matter when a submission lands relative to the load above, this effect
  // only ever writes what React currently has, never a stale copy.
  useEffect(() => {
    if (!scoresKey || !scoresLoadedRef.current) return;
    AsyncStorage.setItem(scoresKey, JSON.stringify(savedScores)).catch(
      (err) => {
        if (__DEV__)
          console.warn('[FinancialEducation] failed to persist scores:', err);
      }
    );
  }, [savedScores, scoresKey]);

  const activeTopic = useMemo(
    () =>
      FINANCIAL_EDUCATION_TOPICS.find((t) => t.id === activeTopicId) ??
      FINANCIAL_EDUCATION_TOPICS[0],
    [activeTopicId]
  );

  const answers = answersByTopic[activeTopicId] ?? emptyAnswers(activeTopic);
  const submitted = !!submittedTopics[activeTopicId];
  const allAnswered = answers.every((a) => a !== null);

  const handleTopicSelect = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveTopicId(id);
  }, []);

  const selectOption = useCallback(
    (questionIndex: number, optionIndex: number) => {
      if (submittedTopics[activeTopicId]) return;
      setAnswersByTopic((prev) => {
        const current = prev[activeTopicId] ?? emptyAnswers(activeTopic);
        const next = [...current];
        next[questionIndex] = optionIndex;
        return { ...prev, [activeTopicId]: next };
      });
    },
    [activeTopicId, activeTopic, submittedTopics]
  );

  const handleSubmit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const score = activeTopic.quiz.reduce(
      (acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0),
      0
    );
    setSubmittedTopics((prev) => ({ ...prev, [activeTopicId]: true }));
    // Functional update — always merges onto the latest committed state, so
    // this can never clobber another topic's score no matter how it races
    // with the initial-load effect above.
    setSavedScores((prev) => ({
      ...prev,
      [activeTopicId]: { score, total: activeTopic.quiz.length },
    }));
  }, [activeTopic, activeTopicId, answers]);

  const handleRetake = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAnswersByTopic((prev) => ({
      ...prev,
      [activeTopicId]: emptyAnswers(activeTopic),
    }));
    setSubmittedTopics((prev) => ({ ...prev, [activeTopicId]: false }));
  }, [activeTopicId, activeTopic]);

  const rawScoreForActive = savedScores[activeTopicId];
  // A saved score's `total` was stamped against the quiz's question count at
  // submit time. If the quiz content is edited later (question added/removed),
  // an old score's total no longer matches — treat it as stale rather than
  // display a result that can't be true of the quiz as it exists now.
  const scoreForActive =
    rawScoreForActive && rawScoreForActive.total === activeTopic.quiz.length
      ? rawScoreForActive
      : undefined;
  // scoreForActive is the single source of truth once submitted — handleSubmit
  // writes it synchronously, so there's no need to re-run the same reduce here.
  const currentScore = submitted ? (scoreForActive?.score ?? 0) : 0;
  const scoreRatio =
    activeTopic.quiz.length > 0 ? currentScore / activeTopic.quiz.length : 0;
  const isGoodScore = scoreRatio >= 2 / 3;

  const completedCount = useMemo(
    () =>
      FINANCIAL_EDUCATION_TOPICS.reduce((count, t) => {
        const s = savedScores[t.id];
        return count + (s && s.total === t.quiz.length ? 1 : 0);
      }, 0),
    [savedScores]
  );

  const getOptionVisual = (
    isSubmitted: boolean,
    isSelected: boolean,
    isCorrect: boolean
  ): { style: object; textColor: string } => {
    if (isSubmitted && isCorrect) {
      return {
        style: { ...styles.option, ...styles.optionCorrect },
        textColor: colors.incomeGreen,
      };
    }
    if (isSubmitted && isSelected) {
      return {
        style: { ...styles.option, ...styles.optionWrong },
        textColor: colors.expenseRed,
      };
    }
    if (!isSubmitted && isSelected) {
      return {
        style: { ...styles.option, ...styles.optionSelected },
        textColor: colors.textPrimary,
      };
    }
    return { style: styles.option, textColor: colors.textPrimary };
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Financial Education</Text>
          <Text style={styles.headerSub}>
            Bite-sized money literacy modules
          </Text>
        </View>
        <View style={styles.progressPill}>
          <Ionicons name="school-outline" size={13} color={colors.primary} />
          <Text style={styles.progressPillText}>
            {completedCount}/{FINANCIAL_EDUCATION_TOPICS.length}
          </Text>
        </View>
      </View>

      <SegmentedTabRow
        items={topicTabItems}
        activeKey={activeTopicId}
        onSelect={handleTopicSelect}
        colors={colors}
        isDark={isDark}
        activeBackgroundColor={colors.primary}
        activeTextColor={colors.accentOn}
        fontSize={11.5}
        style={styles.tabRow}
        // Today's 5 topics fill the row evenly (unchanged look); this only
        // switches to a horizontally-scrolling strip if more get added later,
        // so labels never get squeezed illegibly by adjustsFontSizeToFit.
        scrollable={topicTabItems.length > 5}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Reanimated.View key={activeTopicId} entering={FadeIn.duration(200)}>
          <View style={styles.topicHeaderCard}>
            <View style={styles.topicIconWrap}>
              <Ionicons
                name={activeTopic.icon as any}
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.topicHeaderTitle}>{activeTopic.title}</Text>
              <Text style={styles.topicHeaderSummary}>
                {activeTopic.summary}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Key Takeaways</Text>
            <Text style={styles.readTime}>
              ~{estimateReadMinutes(activeTopic)} min read
            </Text>
          </View>

          <View style={styles.lessonCard}>
            {activeTopic.lesson.map((line, i) => (
              <View key={i} style={styles.lessonRow}>
                <View style={styles.lessonBadge}>
                  <Text style={styles.lessonBadgeText}>{i + 1}</Text>
                </View>
                <Text style={styles.lessonText}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Quick Check</Text>
            {scoreForActive ? (
              <View style={styles.scoreChip}>
                <Text style={styles.scoreChipText}>
                  Last score: {scoreForActive.score}/{scoreForActive.total}
                </Text>
              </View>
            ) : null}
          </View>

          {activeTopic.quiz.map((q, qi) => (
            <View key={qi} style={styles.questionCard}>
              <Text style={styles.questionText}>
                {qi + 1}. {q.question}
              </Text>
              {q.options.map((opt, oi) => {
                const selected = answers[qi] === oi;
                const isCorrect = oi === q.correctIndex;
                const { style: optionStyle, textColor } = getOptionVisual(
                  submitted,
                  selected,
                  isCorrect
                );
                return (
                  <QuizOptionRow
                    key={oi}
                    label={opt}
                    selected={selected}
                    submitted={submitted}
                    isCorrect={isCorrect}
                    colors={colors}
                    style={optionStyle}
                    textColor={textColor}
                    onPress={() => selectOption(qi, oi)}
                  />
                );
              })}
            </View>
          ))}

          {submitted ? (
            <View
              style={[
                styles.resultCard,
                {
                  backgroundColor: isGoodScore
                    ? styles.resultCardGood.backgroundColor
                    : styles.resultCardBad.backgroundColor,
                  borderColor: isGoodScore
                    ? colors.incomeGreen
                    : colors.expenseRed,
                },
              ]}
            >
              <Ionicons
                name={isGoodScore ? 'trophy' : 'refresh-outline'}
                size={26}
                color={isGoodScore ? colors.incomeGreen : colors.expenseRed}
              />
              <Text style={styles.resultText}>
                You scored {currentScore} out of {activeTopic.quiz.length}
              </Text>
              <Text style={styles.resultSubtext}>
                {isGoodScore
                  ? 'Nice work — you know this topic well.'
                  : 'Give it another shot to lock it in.'}
              </Text>
              <TouchableOpacity
                onPress={handleRetake}
                activeOpacity={0.8}
                style={[
                  styles.submitBtn,
                  { backgroundColor: colors.primary, marginTop: 4 },
                ]}
              >
                <Text style={styles.submitBtnText}>Retake Quiz</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={!allAnswered}
              style={[
                styles.submitBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: allAnswered ? 1 : 0.4,
                },
              ]}
            >
              <Text style={styles.submitBtnText}>Submit Answers</Text>
            </TouchableOpacity>
          )}
        </Reanimated.View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.catTileEmptyBg,
    },
    headerTitle: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 22,
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    headerSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 1,
    },
    progressPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.primaryLight,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    progressPillText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: colors.primaryDark,
    },
    tabRow: {
      marginHorizontal: spacing.screenPadding,
      marginBottom: 16,
    },
    body: {
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: 48,
      gap: 16,
    },
    topicHeaderCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.white,
      borderRadius: radius.cardLg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
    },
    topicIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryLight,
    },
    topicHeaderTitle: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 17,
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    topicHeaderSummary: {
      fontFamily: 'Inter_500Medium',
      fontSize: 12.5,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 17,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    sectionHeader: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 16,
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    readTime: {
      fontFamily: 'Inter_500Medium',
      fontSize: 11.5,
      color: colors.textSecondary,
    },
    lessonCard: {
      backgroundColor: colors.surfaceSubdued,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
      marginBottom: 16,
    },
    lessonRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    lessonBadge: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    lessonBadgeText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: colors.primaryDark,
    },
    lessonText: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 13.5,
      lineHeight: 19,
      color: colors.textPrimary,
    },
    scoreChip: {
      backgroundColor: colors.primaryLight,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    scoreChipText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: colors.primaryDark,
    },
    questionCard: {
      backgroundColor: colors.white,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 14,
      gap: 10,
      marginBottom: 12,
    },
    questionText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 19,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    optionSelected: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    optionCorrect: {
      backgroundColor: isDark ? 'rgba(63,107,82,0.18)' : 'rgba(63,107,82,0.1)',
      borderColor: colors.incomeGreen,
    },
    optionWrong: {
      backgroundColor: isDark ? 'rgba(192,80,58,0.18)' : 'rgba(192,80,58,0.1)',
      borderColor: colors.expenseRed,
    },
    submitBtn: {
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
      color: '#fff',
    },
    resultCard: {
      gap: 6,
      alignItems: 'center',
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      padding: 20,
    },
    resultCardGood: {
      backgroundColor: isDark ? 'rgba(63,107,82,0.18)' : 'rgba(63,107,82,0.1)',
    },
    resultCardBad: {
      backgroundColor: isDark ? 'rgba(192,80,58,0.18)' : 'rgba(192,80,58,0.1)',
    },
    resultText: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 16,
      color: colors.textPrimary,
      marginTop: 4,
    },
    resultSubtext: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12.5,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });
