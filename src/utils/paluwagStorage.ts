import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

export interface PaluwagMember {
  id: string;
  name: string;
  payoutTurn: number; // 1-indexed rotation order
  payoutDate: string; // Expected payout date (YYYY-MM-DD)
  isPaidCurrentCycle: boolean; // Contribution status for current cycle
}

export interface PaluwagCycleLog {
  cycleNumber: number;
  recipientId: string;
  recipientName: string;
  payoutDate: string;
  totalCollected: number;
  isPaidOut: boolean;
  contributions: { [memberId: string]: boolean };
}

export interface PaluwagGroup {
  id: string;
  name: string;
  description: string;
  amountPerMember: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  startDate: string;
  members: PaluwagMember[];
  currentCycle: number; // 1-indexed
  cycleLogs: PaluwagCycleLog[];
  isCompleted: boolean;
  createdAt: string;
}

const STORAGE_KEY = '@fino:paluwag_groups';

function generateId(): string {
  return Crypto.randomUUID();
}

/**
 * Calculates dates based on start date and frequency
 */
export function calculateCycleDate(
  startDateStr: string,
  index: number,
  frequency: PaluwagGroup['frequency']
): string {
  const date = new Date(startDateStr);
  if (Number.isNaN(date.getTime())) {
    return startDateStr;
  }

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + index);
      break;
    case 'weekly':
      date.setDate(date.getDate() + index * 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + index * 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + index);
      break;
    default:
      break;
  }

  return date.toISOString().slice(0, 10);
}

export async function getPaluwagGroups(): Promise<PaluwagGroup[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('[paluwagStorage] getPaluwagGroups failed:', err);
    return [];
  }
}

export async function savePaluwagGroups(groups: PaluwagGroup[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch (err) {
    console.error('[paluwagStorage] savePaluwagGroups failed:', err);
  }
}

export async function createPaluwagGroup(
  input: Omit<
    PaluwagGroup,
    'id' | 'createdAt' | 'cycleLogs' | 'currentCycle' | 'isCompleted'
  >
): Promise<PaluwagGroup> {
  const groups = await getPaluwagGroups();

  // Create calculated members list
  const calculatedMembers: PaluwagMember[] = input.members.map((m, idx) => ({
    ...m,
    payoutDate: calculateCycleDate(input.startDate, idx, input.frequency),
    isPaidCurrentCycle: false,
  }));

  const newGroup: PaluwagGroup = {
    ...input,
    id: generateId(),
    members: calculatedMembers,
    currentCycle: 1,
    cycleLogs: [],
    isCompleted: false,
    createdAt: new Date().toISOString(),
  };

  groups.unshift(newGroup);
  await savePaluwagGroups(groups);
  return newGroup;
}

export async function updatePaluwagGroup(updated: PaluwagGroup): Promise<void> {
  const groups = await getPaluwagGroups();
  const index = groups.findIndex((g) => g.id === updated.id);
  if (index !== -1) {
    groups[index] = updated;
    await savePaluwagGroups(groups);
  }
}

export async function deletePaluwagGroup(id: string): Promise<void> {
  const groups = await getPaluwagGroups();
  const filtered = groups.filter((g) => g.id !== id);
  await savePaluwagGroups(filtered);
}
