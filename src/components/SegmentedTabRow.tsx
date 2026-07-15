import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SegmentedTabItem<K extends string = string> {
  key: K;
  label: string;
  /** Optional Ionicons name shown above the label. Omit for a text-only tab. */
  icon?: keyof typeof Ionicons.glyphMap;
}

interface SegmentedTabRowProps<K extends string> {
  items: SegmentedTabItem<K>[];
  activeKey: K;
  onSelect: (key: K) => void;
  colors: any;
  isDark: boolean;
  activeBackgroundColor: string;
  activeTextColor: string;
  fontSize?: number;
  style?: object;
  /**
   * Use for lists that can grow past a handful of items (e.g. content-driven
   * tabs). Fixed, small lists (like a 4-item status filter) should leave this
   * off — the default equal-width layout reads better for those.
   */
  scrollable?: boolean;
}

export default function SegmentedTabRow<K extends string>({
  items,
  activeKey,
  onSelect,
  colors,
  isDark,
  activeBackgroundColor,
  activeTextColor,
  fontSize = 12,
  style,
  scrollable = false,
}: SegmentedTabRowProps<K>) {
  const row = (
    <View
      style={[
        styles.row,
        scrollable && styles.rowScrollable,
        {
          backgroundColor: isDark ? colors.surfaceSubdued : colors.white,
          borderColor: colors.border,
        },
        !scrollable && style,
      ]}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onSelect(item.key)}
            activeOpacity={0.7}
            style={[
              styles.tab,
              scrollable && styles.tabScrollable,
              active && { backgroundColor: activeBackgroundColor },
            ]}
          >
            {item.icon && (
              <Ionicons
                name={item.icon}
                size={16}
                color={active ? activeTextColor : colors.textSecondary}
                style={styles.tabIcon}
              />
            )}
            <Text
              style={[
                styles.tabText,
                {
                  fontSize,
                  color: active ? activeTextColor : colors.textSecondary,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit={!scrollable}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (!scrollable) return row;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style}>
      {row}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  rowScrollable: {
    alignSelf: 'flex-start',
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabScrollable: {
    flex: 0,
    paddingHorizontal: 16,
  },
  tabIcon: {
    marginBottom: 2,
  },
  tabText: {
    fontFamily: 'Inter_600SemiBold',
  },
});
