import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from './Typography';
import { colors, spacing, MIN_TOUCH_TARGET } from '@/theme';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /**
   * 'close' (✕) for screens that slide up over the app (add / pill detail);
   * 'back' (←) for pages pushed sideways (subscription, legal).
   */
  variant?: 'back' | 'close';
  /** Optional element pinned to the right edge (keeps the title centred). */
  right?: React.ReactNode;
}

/**
 * Shared top bar for every non-tab screen: one leading button, a centred
 * title, and an equal-width trailing slot. Keeps leaving a screen the same
 * gesture everywhere instead of a mix of "Cancel", "Back" and nothing.
 */
export function ScreenHeader({ title, onBack, variant = 'back', right }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={variant === 'close' ? 'Close' : 'Go back'}
        hitSlop={8}
      >
        <Ionicons
          name={variant === 'close' ? 'close' : 'arrow-back'}
          size={24}
          color={colors.onSurface}
        />
      </Pressable>
      <Typography variant="titleMd" color="primary" style={styles.title} numberOfLines={1}>
        {title}
      </Typography>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    height: 56,
  },
  iconButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: MIN_TOUCH_TARGET / 2,
  },
  pressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  side: {
    width: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
