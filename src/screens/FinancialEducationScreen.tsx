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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { spacing, radius } from '../constants/theme';
import {
  FINANCIAL_EDUCATION_TOPICS,
  type EduTopic,
} from '../constants/financialEducationContent';

// Scoped per user (matches ProfileSidebar's `fino_deferred_${userId}_...`
// convention) — a bare global key would leak one account's quiz results to
// the next person signed into a shared/handed-down device.
const SCORES_STORAGE_KEY_PREFIX = '@fino_edu_quiz_scores';

type ScoresMap = Record<string, { score: number; total: number }>;

type AnswersState = (number | null)[];

function emptyAnswers(topic: EduTopic): AnswersState {
  return new Array(topic.quiz.length).fill(null);
}

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
    setAnswersByTopic((prev) => ({
      ...prev,
      [activeTopicId]: emptyAnswers(activeTopic),
    }));
    setSubmittedTopics((prev) => ({ ...prev, [activeTopicId]: false }));
  }, [activeTopicId, activeTopic]);

  const scoreForActive = savedScores[activeTopicId];
  // scoreForActive is the single source of truth once submitted — handleSubmit
  // writes it synchronously, so there's no need to re-run the same reduce here.
  const currentScore = submitted ? (scoreForActive?.score ?? 0) : 0;

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
      </View>

      <View
        style={[
          styles.tabRow,
          {
            backgroundColor: isDark ? colors.surfaceSubdued : colors.white,
            borderColor: colors.border,
          },
        ]}
      >
        {FINANCIAL_EDUCATION_TOPICS.map((topic) => {
          const active = topic.id === activeTopicId;
          return (
            <TouchableOpacity
              key={topic.id}
              onPress={() => setActiveTopicId(topic.id)}
              activeOpacity={0.7}
              style={[
                styles.tab,
                active && { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.accentOn : colors.textSecondary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {topic.tabLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.topicSummary}>{activeTopic.summary}</Text>

        <View style={styles.lessonCard}>
          {activeTopic.lesson.map((line, i) => (
            <View key={i} style={styles.lessonRow}>
              <View style={styles.lessonDot} />
              <Text style={styles.lessonText}>{line}</Text>
            </View>
          ))}
        </View>

        <View style={styles.quizHeaderRow}>
          <Text style={styles.quizHeader}>Quick Check</Text>
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
                <TouchableOpacity
                  key={oi}
                  onPress={() => selectOption(qi, oi)}
                  activeOpacity={0.7}
                  disabled={submitted}
                  style={optionStyle}
                >
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    {selected && !submitted ? (
                      <View
                        style={[
                          styles.radioDot,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    ) : null}
                    {submitted && isCorrect ? (
                      <Ionicons
                        name="checkmark"
                        size={12}
                        color={colors.incomeGreen}
                      />
                    ) : null}
                    {submitted && selected && !isCorrect ? (
                      <Ionicons
                        name="close"
                        size={12}
                        color={colors.expenseRed}
                      />
                    ) : null}
                  </View>
                  <Text style={[styles.optionText, { color: textColor }]}>
                    {opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {submitted ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultText}>
              You scored {currentScore} out of {activeTopic.quiz.length}
            </Text>
            <TouchableOpacity
              onPress={handleRetake}
              activeOpacity={0.8}
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
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
    tabRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.screenPadding,
      marginBottom: 16,
      borderRadius: 12,
      padding: 4,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 2,
    },
    tab: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 9,
      alignItems: 'center',
    },
    tabText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11.5,
    },
    body: {
      paddingHorizontal: spacing.screenPadding,
      paddingBottom: 48,
      gap: 16,
    },
    topicSummary: {
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    lessonCard: {
      backgroundColor: colors.surfaceSubdued,
      borderRadius: radius.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    lessonRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    lessonDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginTop: 7,
    },
    lessonText: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 13.5,
      lineHeight: 19,
      color: colors.textPrimary,
    },
    quizHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    quizHeader: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 16,
      color: colors.textPrimary,
      letterSpacing: -0.2,
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
    optionText: {
      flex: 1,
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      lineHeight: 18,
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
      gap: 12,
      alignItems: 'center',
    },
    resultText: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 16,
      color: colors.textPrimary,
    },
  });
