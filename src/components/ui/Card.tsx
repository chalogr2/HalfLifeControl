import React from 'react';
import { View, ViewProps, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing } from '@/theme';

type CardVariant = 'elevated' | 'outlined' | 'scheduled' | 'random';

interface CardProps extends ViewProps {
  variant?: CardVariant;
  accentColor?: string;
}

/**
 * Card component following the Stitch design system:
 * - "scheduled" = solid 6px left accent border (for pill stack cards)
 * - "random" = 1.5px dashed border at 40% opacity (for one-time pills)
 * - "elevated" = standard card on surfaceContainerLowest
 * - "outlined" = subtle outline
 */
export function Card({
  variant = 'elevated',
  accentColor = colors.primary,
  style,
  children,
  ...props
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'scheduled' && [styles.scheduled, { borderLeftColor: accentColor }],
        variant === 'random' && styles.random,
        variant === 'outlined' && styles.outlined,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: borderRadius.lg,
    padding: spacing[4],
  },
  scheduled: {
    borderLeftWidth: 6,
    borderLeftColor: colors.primary,
  },
  random: {
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant + '66', // 40% opacity
    borderStyle: 'dashed',
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
});
