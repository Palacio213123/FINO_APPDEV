import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAccounts } from '@/hooks/useAccounts';
import { createTransaction } from '@/services/localMutations';
import {
  getPaluwagGroups,
  updatePaluwagGroup,
  deletePaluwagGroup,
  createPaluwagGroup,
  type PaluwagGroup,
  type PaluwagMember,
  type PaluwagCycleLog,
} from '@/utils/paluwagStorage';
import {
  AccountPickerModal,
  type AccountItem,
} from '@/components/AccountPickerModal';

// Colors for member avatars
const MEMBER_COLORS = [
  '#E07A5F',
  '#3A7BD5',
  '#7B5EA7',
  '#5B8C6E',
  '#B87A20',
  '#C96B8A',
  '#2A9D8F',
  '#E9C46A',
];

const fmt = (n: number) =>
  `₱${n.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtShort = (n: number) => {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
};

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function PaluwagScreen() {
  const { colors, isDark } = useTheme();
  const { currentUserId } = useAuth();
  const userId = currentUserId;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { accounts } = useAccounts();
  const mappedAccounts = useMemo(
    () =>
      accounts.map((a) => ({
        id: a.id,
        name: a.name,
        letter_avatar: a.letter_avatar,
        brand_colour: a.brand_colour,
        balance: a.balance,
      })),
    [accounts]
  );
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Screen state
  const [groups, setGroups] = useState<PaluwagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [selectedGroup, setSelectedGroup] = useState<PaluwagGroup | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Create Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [formFrequency, setFormFrequency] =
    useState<PaluwagGroup['frequency']>('weekly');
  const [newMemberName, setNewMemberName] = useState('');
  const [formMembers, setFormMembers] = useState<
    { id: string; name: string }[]
  >([{ id: 'me', name: 'Me' }]);

  // Account Logging Picker Modal State
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [pickerPurpose, setPickerPurpose] = useState<
    'contribution' | 'payout' | null
  >(null);
  const [pendingLogAmount, setPendingLogAmount] = useState(0);

  // Load Paluwag groups
  const loadData = async () => {
    setLoading(true);
    const data = await getPaluwagGroups();
    setGroups(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeGroups = useMemo(
    () => groups.filter((g) => !g.isCompleted),
    [groups]
  );
  const completedGroups = useMemo(
    () => groups.filter((g) => g.isCompleted),
    [groups]
  );
  const currentTabGroups =
    activeTab === 'active' ? activeGroups : completedGroups;

  // Dashboard Stats
  const totalPooledFunds = useMemo(
    () =>
      activeGroups.reduce(
        (acc, g) =>
          acc + g.amountPerMember * g.members.length * g.members.length,
        0
      ),
    [activeGroups]
  );

  // nextPayoutDetail is reserved for future integration with home proactive alerts

  // Member Avatar Color map
  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % MEMBER_COLORS.length;
    return MEMBER_COLORS[idx];
  };

  // Add Member to Form list
  const addMemberToForm = () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    if (
      formMembers.some((m) => m.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      Alert.alert(
        'Duplicate Name',
        'A member with this name is already in the list.'
      );
      return;
    }
    setFormMembers([...formMembers, { id: `m_${Date.now()}`, name: trimmed }]);
    setNewMemberName('');
  };

  // Remove Member from Form list
  const removeMemberFromForm = (id: string) => {
    if (id === 'me') {
      Alert.alert('Cannot Remove', 'You must be part of the Paluwag group.');
      return;
    }
    setFormMembers(formMembers.filter((m) => m.id !== id));
  };

  // Shuffle Members order
  const shuffleMembersOrder = () => {
    if (formMembers.length < 2) return;
    const shuffled = [...formMembers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setFormMembers(shuffled);
  };

  // Submit new Paluwag group
  const handleCreateGroup = async () => {
    if (!formName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name for the Paluwag group.');
      return;
    }
    const amountNum = parseFloat(formAmount.replace(/,/g, ''));
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      Alert.alert(
        'Invalid Amount',
        'Please enter a valid contribution amount.'
      );
      return;
    }
    if (formMembers.length < 2) {
      Alert.alert(
        'Not Enough Members',
        'A Paluwag cycle requires at least 2 members.'
      );
      return;
    }

    const membersPayload = formMembers.map((m, index) => ({
      id: m.id,
      name: m.name,
      payoutTurn: index + 1,
      payoutDate: '', // calculated in createPaluwagGroup helper
      isPaidCurrentCycle: false,
    }));

    try {
      await createPaluwagGroup({
        name: formName.trim(),
        description: formDesc.trim(),
        amountPerMember: amountNum,
        frequency: formFrequency,
        startDate: formStartDate,
        members: membersPayload,
      });

      setShowAddModal(false);
      // Reset form
      setFormName('');
      setFormDesc('');
      setFormAmount('');
      setFormMembers([{ id: 'me', name: 'Me' }]);
      // Reload lists
      loadData();
    } catch {
      Alert.alert('Error', 'Could not create the Paluwag group.');
    }
  };

  // Toggle member paid status for the current cycle
  const toggleMemberPaid = async (memberId: string) => {
    if (!selectedGroup) return;

    const updatedMembers = selectedGroup.members.map((m) => {
      if (m.id === memberId) {
        const nextPaidStatus = !m.isPaidCurrentCycle;
        // Prompt for transaction log if it's the user checking "Me" as Paid
        if (memberId === 'me' && nextPaidStatus && accounts.length > 0) {
          Alert.alert(
            'Log Transaction',
            `Would you like to log your contribution of ${fmt(selectedGroup.amountPerMember)} as a transaction in your budget?`,
            [
              { text: 'No' },
              {
                text: 'Log Expense',
                onPress: () => {
                  setPendingLogAmount(selectedGroup.amountPerMember);
                  setPickerPurpose('contribution');
                  setShowAccountPicker(true);
                },
              },
            ]
          );
        }
        return { ...m, isPaidCurrentCycle: nextPaidStatus };
      }
      return m;
    });

    const updatedGroup = { ...selectedGroup, members: updatedMembers };
    setSelectedGroup(updatedGroup);
    await updatePaluwagGroup(updatedGroup);
    loadData();
  };

  // Disburse the payout pool and advance cycle / complete group
  const handleDisbursePool = async () => {
    if (!selectedGroup) return;

    const currentRecipient = selectedGroup.members.find(
      (m) => m.payoutTurn === selectedGroup.currentCycle
    );
    if (!currentRecipient) return;

    const totalCollected =
      selectedGroup.amountPerMember * selectedGroup.members.length;

    // Check if everyone has contributed
    const unpaidCount = selectedGroup.members.filter(
      (m) => !m.isPaidCurrentCycle
    ).length;
    if (unpaidCount > 0) {
      Alert.alert(
        'Incomplete Collections',
        `There are still ${unpaidCount} unpaid contribution(s) for this cycle. Are you sure you want to disburse the pool early?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Proceed',
            onPress: () => finalizePayout(currentRecipient, totalCollected),
          },
        ]
      );
    } else {
      finalizePayout(currentRecipient, totalCollected);
    }
  };

  const finalizePayout = async (
    recipient: PaluwagMember,
    totalAmount: number
  ) => {
    if (!selectedGroup || !userId) return;

    // Prompt user to log income if the user is receiving the payout
    if (recipient.id === 'me' && accounts.length > 0) {
      Alert.alert(
        'Log Income',
        `You are receiving the payout pool of ${fmt(totalAmount)}! Would you like to log this as an income transaction?`,
        [
          {
            text: 'No',
            onPress: () => completeCycleWrite(recipient, totalAmount),
          },
          {
            text: 'Log Income',
            onPress: () => {
              setPendingLogAmount(totalAmount);
              setPickerPurpose('payout');
              setShowAccountPicker(true);
            },
          },
        ]
      );
    } else {
      completeCycleWrite(recipient, totalAmount);
    }
  };

  const completeCycleWrite = async (
    recipient: PaluwagMember,
    totalAmount: number
  ) => {
    if (!selectedGroup) return;

    const currentContributions = selectedGroup.members.reduce(
      (acc, m) => {
        acc[m.id] = m.isPaidCurrentCycle;
        return acc;
      },
      {} as { [key: string]: boolean }
    );

    const newLog: PaluwagCycleLog = {
      cycleNumber: selectedGroup.currentCycle,
      recipientId: recipient.id,
      recipientName: recipient.name,
      payoutDate: new Date().toISOString().slice(0, 10),
      totalCollected: totalAmount,
      isPaidOut: true,
      contributions: currentContributions,
    };

    const isLastCycle =
      selectedGroup.currentCycle >= selectedGroup.members.length;
    const updatedCycle = selectedGroup.currentCycle + 1;
    const updatedMembers = selectedGroup.members.map((m) => ({
      ...m,
      isPaidCurrentCycle: false, // reset payments for next cycle
    }));

    const updatedGroup: PaluwagGroup = {
      ...selectedGroup,
      members: updatedMembers,
      currentCycle: isLastCycle ? selectedGroup.currentCycle : updatedCycle,
      cycleLogs: [...selectedGroup.cycleLogs, newLog],
      isCompleted: isLastCycle,
    };

    setSelectedGroup(updatedGroup);
    await updatePaluwagGroup(updatedGroup);

    if (isLastCycle) {
      Alert.alert(
        'Cycle Completed',
        `Congratulations! The Paluwag cycle "${selectedGroup.name}" is completed.`
      );
      setShowDetailModal(false);
    } else {
      Alert.alert(
        'Payout Disbursed',
        `Successfully advanced to Cycle ${updatedCycle}.`
      );
    }

    loadData();
  };

  // Perform actual transaction logging when account is picked
  const handleAccountPicked = async (accountId: string) => {
    if (!selectedGroup || !userId || !pickerPurpose) return;

    const account = accounts.find((a) => a.id === accountId);
    const accountName = account ? account.name : 'Account';

    try {
      if (pickerPurpose === 'contribution') {
        // Log contribution expense
        await createTransaction({
          userId,
          accountId,
          amount: pendingLogAmount,
          type: 'expense',
          category: 'Other',
          merchantName: `Paluwag: ${selectedGroup.name}`,
          displayName: `Paluwag Pay: ${selectedGroup.name}`,
          date: new Date().toISOString().slice(0, 10),
          signalSource: 'manual',
        });
        Alert.alert(
          'Logged Expense',
          `Logged contribution of ${fmt(pendingLogAmount)} to ${accountName}.`
        );
      } else if (pickerPurpose === 'payout') {
        // Log payout income
        await createTransaction({
          userId,
          accountId,
          amount: pendingLogAmount,
          type: 'income',
          category: 'Other',
          merchantName: `Paluwag Payout: ${selectedGroup.name}`,
          displayName: `Paluwag Payout: ${selectedGroup.name}`,
          date: new Date().toISOString().slice(0, 10),
          signalSource: 'manual',
        });

        // Finalize state cycle update
        const currentRecipient = selectedGroup.members.find(
          (m) => m.payoutTurn === selectedGroup.currentCycle
        );
        if (currentRecipient) {
          await completeCycleWrite(currentRecipient, pendingLogAmount);
        }
      }
    } catch {
      Alert.alert('Logging Failed', 'Could not create transaction record.');
    } finally {
      setShowAccountPicker(false);
      setPickerPurpose(null);
      setPendingLogAmount(0);
    }
  };

  // Delete Group
  const handleDeleteGroup = (id: string) => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to permanently delete this Paluwag group? All cycle history will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePaluwagGroup(id);
            setShowDetailModal(false);
            setSelectedGroup(null);
            loadData();
          },
        },
      ]
    );
  };

  // Group card progress computations
  const getGroupProgress = (g: PaluwagGroup) => {
    const cycleTotal = g.members.length;
    const paidCount = g.members.filter((m) => m.isPaidCurrentCycle).length;
    const progress = paidCount / cycleTotal;
    return { paidCount, cycleTotal, progress };
  };

  // Render items
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Paluwag Coordinator</Text>
          <Text style={styles.headerSub}>Rotating group savings manager</Text>
        </View>
      </View>

      {/* STATS OVERVIEW */}
      {activeTab === 'active' && activeGroups.length > 0 && (
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statsCard,
              { backgroundColor: isDark ? '#1C1C24' : '#F4F7F6' },
            ]}
          >
            <Text style={styles.statsLabel}>ACTIVE GROUPS</Text>
            <Text style={styles.statsVal}>{activeGroups.length}</Text>
          </View>
          <View
            style={[
              styles.statsCard,
              { backgroundColor: isDark ? '#1C1C24' : '#F4F7F6' },
            ]}
          >
            <Text style={styles.statsLabel}>TOTAL POOLED FUNDS</Text>
            <Text style={styles.statsVal}>{fmtShort(totalPooledFunds)}</Text>
          </View>
        </View>
      )}

      {/* TABS */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('active')}
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'active' && {
                color: colors.primary,
                fontWeight: '700',
              },
            ]}
          >
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('completed')}
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'completed' && {
                color: colors.primary,
                fontWeight: '700',
              },
            ]}
          >
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Text style={styles.emptyText}>Loading Paluwag records...</Text>
        ) : currentTabGroups.length === 0 ? (
          <View style={styles.emptyView}>
            <Ionicons
              name="sync-outline"
              size={48}
              color={colors.textSecondary}
              style={{ opacity: 0.5 }}
            />
            <Text style={styles.emptyTitle}>No {activeTab} Paluwags</Text>
            <Text style={styles.emptySub}>
              {activeTab === 'active'
                ? 'Create a rotating savings group to coordinate payments among friends.'
                : "No completed cycles yet. Once a group finishes all turns, it'll show up here."}
            </Text>
          </View>
        ) : (
          currentTabGroups.map((g) => {
            const { paidCount, cycleTotal, progress } = getGroupProgress(g);
            const currentRecipient = g.members.find(
              (m) => m.payoutTurn === g.currentCycle
            );

            return (
              <TouchableOpacity
                key={g.id}
                style={[styles.groupCard, { borderColor: colors.border }]}
                onPress={() => {
                  setSelectedGroup(g);
                  setShowDetailModal(true);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{g.name}</Text>
                    {g.description ? (
                      <Text style={styles.cardDesc} numberOfLines={1}>
                        {g.description}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: g.isCompleted
                          ? colors.catTileEmptyBg
                          : '#FCE7F3',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        {
                          color: g.isCompleted
                            ? colors.textSecondary
                            : '#DB2777',
                        },
                      ]}
                    >
                      {g.isCompleted
                        ? 'Completed'
                        : `Cycle ${g.currentCycle}/${cycleTotal}`}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                {!g.isCompleted && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressText}>
                        Current Cycle Collections
                      </Text>
                      <Text style={styles.progressText}>
                        {paidCount}/{cycleTotal} Paid
                      </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${progress * 100}%` },
                        ]}
                      />
                    </View>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <View>
                    <Text style={styles.cardMetaLabel}>POOL AMOUNT</Text>
                    <Text style={styles.cardMetaVal}>
                      {fmt(g.amountPerMember * cycleTotal)}
                    </Text>
                  </View>
                  {!g.isCompleted && currentRecipient && (
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardMetaLabel}>NEXT RECIPIENT</Text>
                      <Text style={styles.cardMetaVal} numberOfLines={1}>
                        {currentRecipient.name}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FAB TO ADD */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ADD GROUP MODAL */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Paluwag Group</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.formScroll}
            >
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>GROUP NAME</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: colors.textPrimary, borderColor: colors.border },
                  ]}
                  placeholder="e.g. Office Payday Pool"
                  placeholderTextColor={colors.textSecondary}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DESCRIPTION (OPTIONAL)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    { color: colors.textPrimary, borderColor: colors.border },
                  ]}
                  placeholder="e.g. 15th/30th rotating savings"
                  placeholderTextColor={colors.textSecondary}
                  value={formDesc}
                  onChangeText={setFormDesc}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>SLOT CONTRIBUTION (₱)</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      { color: colors.textPrimary, borderColor: colors.border },
                    ]}
                    placeholder="1,000"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={formAmount}
                    onChangeText={setFormAmount}
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>FREQUENCY</Text>
                  <View style={styles.pickerContainer}>
                    {['weekly', 'monthly', 'biweekly'].map((f) => (
                      <TouchableOpacity
                        key={f}
                        style={[
                          styles.freqBtn,
                          formFrequency === f && {
                            backgroundColor: colors.primary,
                          },
                        ]}
                        onPress={() =>
                          setFormFrequency(f as PaluwagGroup['frequency'])
                        }
                      >
                        <Text
                          style={[
                            styles.freqBtnText,
                            formFrequency === f && { color: '#fff' },
                          ]}
                        >
                          {f === 'weekly'
                            ? 'Weekly'
                            : f === 'biweekly'
                              ? 'Bi-weekly'
                              : 'Monthly'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Members additions */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  MEMBERS ROTATION ORDER ({formMembers.length})
                </Text>
                <Text style={styles.sectionHint}>
                  Add participants. You can shuffle to randomize payout turn
                  order.
                </Text>
                <View style={styles.addMemberRow}>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        flex: 1,
                        color: colors.textPrimary,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="Enter member name"
                    placeholderTextColor={colors.textSecondary}
                    value={newMemberName}
                    onChangeText={setNewMemberName}
                    onSubmitEditing={addMemberToForm}
                  />
                  <TouchableOpacity
                    style={[
                      styles.addMemberBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={addMemberToForm}
                  >
                    <Ionicons name="add" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Shuffler */}
                {formMembers.length >= 2 && (
                  <TouchableOpacity
                    style={styles.shuffleBtn}
                    onPress={shuffleMembersOrder}
                  >
                    <Ionicons name="shuffle" size={16} color={colors.primary} />
                    <Text
                      style={[styles.shuffleBtnText, { color: colors.primary }]}
                    >
                      Shuffle Rotation Turns
                    </Text>
                  </TouchableOpacity>
                )}

                {/* List of members entered */}
                <View style={styles.membersList}>
                  {formMembers.map((m, index) => (
                    <View
                      key={m.id}
                      style={[
                        styles.memberFormRow,
                        { borderBottomColor: colors.border },
                      ]}
                    >
                      <Text style={styles.turnLabel}>Slot #{index + 1}</Text>
                      <View
                        style={[
                          styles.miniAvatar,
                          { backgroundColor: getAvatarColor(m.name) },
                        ]}
                      >
                        <Text style={styles.miniAvatarText}>
                          {m.name === 'Me'
                            ? 'ME'
                            : m.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.memberNameText}>{m.name}</Text>
                      {m.id !== 'me' && (
                        <TouchableOpacity
                          style={styles.deleteMemberBtn}
                          onPress={() => removeMemberFromForm(m.id)}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color="#EF4444"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={handleCreateGroup}
            >
              <Text style={styles.submitBtnText}>Create Paluwag Cycle</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DETAIL VIEW MODAL */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        {selectedGroup && (
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: colors.background, flex: 0.95 },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{selectedGroup.name}</Text>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {selectedGroup.description || 'Rotating Savings Group'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowDetailModal(false);
                    setSelectedGroup(null);
                  }}
                >
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.detailScroll}
              >
                {/* Stats grid */}
                <View style={styles.detailStatsGrid}>
                  <View
                    style={[
                      styles.detailStatsBox,
                      { backgroundColor: colors.catTileEmptyBg },
                    ]}
                  >
                    <Text style={styles.detailStatsLabel}>SLOT DUES</Text>
                    <Text style={styles.detailStatsVal}>
                      {fmt(selectedGroup.amountPerMember)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.detailStatsBox,
                      { backgroundColor: colors.catTileEmptyBg },
                    ]}
                  >
                    <Text style={styles.detailStatsLabel}>CYCLE POOL</Text>
                    <Text style={styles.detailStatsVal}>
                      {fmt(
                        selectedGroup.amountPerMember *
                          selectedGroup.members.length
                      )}
                    </Text>
                  </View>
                </View>

                {/* Progress summary */}
                {!selectedGroup.isCompleted ? (
                  <View
                    style={[
                      styles.payoutTargetSection,
                      { borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.recipientHeaderRow}>
                      <Ionicons name="star" size={20} color="#F59E0B" />
                      <Text style={styles.recipientSectionTitle}>
                        Current Cycle Payout recipient
                      </Text>
                    </View>
                    {(() => {
                      const currentRecipient = selectedGroup.members.find(
                        (m) => m.payoutTurn === selectedGroup.currentCycle
                      );
                      if (!currentRecipient) return null;
                      return (
                        <View style={styles.recipientCardBody}>
                          <View
                            style={[
                              styles.avatarBig,
                              {
                                backgroundColor: getAvatarColor(
                                  currentRecipient.name
                                ),
                              },
                            ]}
                          >
                            <Text style={styles.avatarBigText}>
                              {currentRecipient.name === 'Me'
                                ? 'ME'
                                : currentRecipient.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.recipientName}>
                              {currentRecipient.name === 'Me'
                                ? 'Me (You)'
                                : currentRecipient.name}
                            </Text>
                            <Text style={styles.payoutLabelDate}>
                              Expected Payout:{' '}
                              {fmtDate(currentRecipient.payoutDate)}
                            </Text>
                          </View>
                        </View>
                      );
                    })()}

                    {/* Collection Checklist */}
                    <Text style={styles.checklistTitle}>
                      Contribution Checklist
                    </Text>
                    <View style={styles.checklistContainer}>
                      {selectedGroup.members.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.checkItemRow,
                            { borderBottomColor: colors.border },
                          ]}
                          onPress={() => toggleMemberPaid(m.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={
                              m.isPaidCurrentCycle
                                ? 'checkbox'
                                : 'square-outline'
                            }
                            size={22}
                            color={
                              m.isPaidCurrentCycle
                                ? colors.primary
                                : colors.textSecondary
                            }
                          />
                          <Text
                            style={[
                              styles.checkItemName,
                              m.isPaidCurrentCycle && {
                                color: colors.textPrimary,
                                fontWeight: '600',
                              },
                            ]}
                          >
                            {m.name}
                          </Text>
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: m.isPaidCurrentCycle
                                  ? '#D1FAE5'
                                  : '#F3F4F6',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusBadgeText,
                                {
                                  color: m.isPaidCurrentCycle
                                    ? '#065F46'
                                    : '#374151',
                                },
                              ]}
                            >
                              {m.isPaidCurrentCycle ? 'Paid' : 'Unpaid'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Disburse Action */}
                    <TouchableOpacity
                      style={[
                        styles.disburseBtn,
                        { backgroundColor: colors.primary },
                        selectedGroup.members.filter(
                          (m) => !m.isPaidCurrentCycle
                        ).length > 0 && { opacity: 0.7 },
                      ]}
                      onPress={handleDisbursePool}
                    >
                      <Text style={styles.disburseBtnText}>
                        Disburse Payout & Next Cycle
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.completedNotice}>
                    <Ionicons
                      name="checkmark-circle"
                      size={48}
                      color="#10B981"
                    />
                    <Text style={styles.completedNoticeTitle}>
                      Completed Cycle
                    </Text>
                    <Text style={styles.completedNoticeSub}>
                      All payouts have been successfully disbursed for this
                      Paluwag group.
                    </Text>
                  </View>
                )}

                {/* Timeline / Rotation Schedule */}
                <Text style={styles.detailSectionTitle}>
                  Payout Timeline Schedule
                </Text>
                <View style={styles.timelineContainer}>
                  {selectedGroup.members.map((m) => {
                    const isPassed =
                      m.payoutTurn < selectedGroup.currentCycle ||
                      selectedGroup.isCompleted;
                    const isCurrent =
                      m.payoutTurn === selectedGroup.currentCycle &&
                      !selectedGroup.isCompleted;

                    return (
                      <View key={m.id} style={styles.timelineRow}>
                        <View style={styles.timelineConnectorCol}>
                          <View
                            style={[
                              styles.timelineDot,
                              isPassed && { backgroundColor: '#10B981' },
                              isCurrent && { backgroundColor: '#F59E0B' },
                            ]}
                          />
                          <View style={styles.timelineLine} />
                        </View>
                        <View style={styles.timelineBody}>
                          <Text
                            style={[
                              styles.timelineMemberName,
                              isCurrent && {
                                fontWeight: '700',
                                color: '#D97706',
                              },
                            ]}
                          >
                            Turn #{m.payoutTurn}: {m.name}
                          </Text>
                          <Text style={styles.timelineDate}>
                            Payout Date: {fmtDate(m.payoutDate)}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: isPassed
                                ? '#D1FAE5'
                                : isCurrent
                                  ? '#FEF3C7'
                                  : colors.catTileEmptyBg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              {
                                color: isPassed
                                  ? '#065F46'
                                  : isCurrent
                                    ? '#B45309'
                                    : colors.textSecondary,
                              },
                            ]}
                          >
                            {isPassed
                              ? 'Collected'
                              : isCurrent
                                ? 'Active recipient'
                                : 'Queued'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* History logs */}
                {selectedGroup.cycleLogs.length > 0 && (
                  <View>
                    <Text style={styles.detailSectionTitle}>
                      Disbursement Payout History
                    </Text>
                    {selectedGroup.cycleLogs.map((log) => (
                      <View
                        key={log.cycleNumber}
                        style={[
                          styles.historyCard,
                          { borderColor: colors.border },
                        ]}
                      >
                        <View style={styles.historyCardHeader}>
                          <Text style={styles.historyCardTitle}>
                            Cycle {log.cycleNumber} Disbursed
                          </Text>
                          <Text style={styles.historyCardDate}>
                            {fmtDate(log.payoutDate)}
                          </Text>
                        </View>
                        <Text style={styles.historyCardBodyText}>
                          Recipient:{' '}
                          <Text
                            style={{
                              fontWeight: '600',
                              color: colors.textPrimary,
                            }}
                          >
                            {log.recipientName}
                          </Text>
                        </Text>
                        <Text style={styles.historyCardBodyText}>
                          Total Pool Disbursed:{' '}
                          <Text style={{ fontWeight: '600', color: '#10B981' }}>
                            {fmt(log.totalCollected)}
                          </Text>
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Delete button */}
                <TouchableOpacity
                  style={styles.deleteGroupBtn}
                  onPress={() => handleDeleteGroup(selectedGroup.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text style={styles.deleteGroupText}>
                    Delete Paluwag Group
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>

      {/* ACCOUNT PICKER MODAL FOR LOGGING */}
      {selectedGroup && (
        <AccountPickerModal
          visible={showAccountPicker}
          accounts={mappedAccounts as AccountItem[]}
          pendingTx={null}
          onSelect={handleAccountPicked}
          onDismiss={() => {
            setShowAccountPicker(false);
            setPickerPurpose(null);
          }}
          colors={colors}
          isDark={isDark}
          insetBottom={insets.bottom}
        />
      )}
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
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      marginVertical: 12,
    },
    statsCard: {
      flex: 1,
      padding: 14,
      borderRadius: 14,
      gap: 4,
    },
    statsLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 9,
      color: colors.textSecondary,
      letterSpacing: 0.6,
    },
    statsVal: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 20,
      color: colors.textPrimary,
    },
    tabsRow: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      marginHorizontal: 16,
      marginTop: 6,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: colors.textSecondary,
    },
    scrollContainer: {
      padding: 16,
      gap: 12,
    },
    groupCard: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      gap: 14,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    cardTitle: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 16,
      color: colors.textPrimary,
    },
    cardDesc: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    badgeText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
    },
    progressContainer: {
      gap: 6,
    },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    progressText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    progressBarBg: {
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? colors.border : '#E5E7EB',
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 3,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    cardMetaLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 8,
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    cardMetaVal: {
      fontFamily: 'Nunito_700Bold',
      fontSize: 14,
      color: colors.textPrimary,
    },
    fab: {
      position: 'absolute',
      right: 16,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 5,
    },
    emptyView: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
      paddingHorizontal: 24,
      gap: 12,
    },
    emptyTitle: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 18,
      color: colors.textPrimary,
    },
    emptySub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 18,
    },
    emptyText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginVertical: 40,
    },
    // Form styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 20,
      color: colors.textPrimary,
    },
    modalSubtitle: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    formScroll: {
      paddingBottom: 24,
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      color: colors.textSecondary,
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    textInput: {
      height: 48,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
    },
    formRow: {
      flexDirection: 'row',
      gap: 12,
    },
    pickerContainer: {
      flexDirection: 'row',
      gap: 6,
    },
    freqBtn: {
      flex: 1,
      height: 48,
      borderRadius: 12,
      backgroundColor: isDark ? '#2D2D3D' : '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    freqBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: colors.textSecondary,
    },
    sectionHint: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    addMemberRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    addMemberBtn: {
      width: 48,
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shuffleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      marginBottom: 14,
      paddingVertical: 6,
      paddingRight: 10,
    },
    shuffleBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
    },
    membersList: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 14,
      overflow: 'hidden',
    },
    memberFormRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 10,
    },
    turnLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      color: colors.textSecondary,
      width: 50,
    },
    miniAvatar: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    miniAvatarText: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 11,
      color: '#fff',
    },
    memberNameText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: colors.textPrimary,
      flex: 1,
    },
    deleteMemberBtn: {
      padding: 6,
    },
    submitBtn: {
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    submitBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
      color: '#fff',
    },
    // Details modal styles
    detailScroll: {
      paddingBottom: 40,
    },
    detailStatsGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 18,
    },
    detailStatsBox: {
      flex: 1,
      padding: 14,
      borderRadius: 12,
      gap: 4,
    },
    detailStatsLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 8,
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    detailStatsVal: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 18,
      color: colors.textPrimary,
    },
    payoutTargetSection: {
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
    },
    recipientHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    recipientSectionTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: colors.textPrimary,
    },
    recipientCardBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: isDark ? '#2A2A35' : '#F9FAFB',
      padding: 12,
      borderRadius: 12,
      marginBottom: 16,
    },
    avatarBig: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarBigText: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 18,
      color: '#fff',
    },
    recipientName: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 16,
      color: colors.textPrimary,
    },
    payoutLabelDate: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    checklistTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    checklistContainer: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
    },
    checkItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 10,
    },
    checkItemName: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: colors.textSecondary,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    statusBadgeText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
    },
    disburseBtn: {
      height: 48,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disburseBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
      color: '#fff',
    },
    detailSectionTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: colors.textSecondary,
      letterSpacing: 0.5,
      marginTop: 10,
      marginBottom: 10,
    },
    timelineContainer: {
      backgroundColor: isDark ? '#1C1C24' : '#F9FAFB',
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: 12,
    },
    timelineConnectorCol: {
      alignItems: 'center',
      width: 14,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#9CA3AF',
      zIndex: 2,
    },
    timelineLine: {
      position: 'absolute',
      top: 10,
      bottom: -18,
      width: 2,
      backgroundColor: colors.border,
      zIndex: 1,
    },
    timelineBody: {
      flex: 1,
    },
    timelineMemberName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: colors.textPrimary,
    },
    timelineDate: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    historyCard: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      gap: 4,
    },
    historyCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    historyCardTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: colors.textPrimary,
    },
    historyCardDate: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: colors.textSecondary,
    },
    historyCardBodyText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: colors.textSecondary,
    },
    completedNotice: {
      alignItems: 'center',
      padding: 24,
      borderRadius: 16,
      backgroundColor: '#E6F7F0',
      marginBottom: 20,
      gap: 8,
    },
    completedNoticeTitle: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 18,
      color: '#065F46',
    },
    completedNoticeSub: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: '#047857',
      textAlign: 'center',
      lineHeight: 16,
    },
    deleteGroupBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 24,
      paddingVertical: 12,
    },
    deleteGroupText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: '#EF4444',
    },
  });
