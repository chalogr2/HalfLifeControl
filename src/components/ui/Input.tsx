import React, { useState } from 'react';
import { View, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { Typography } from './Typography';
import { colors, typography, borderRadius, spacing } from '@/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

/**
 * Input field following the Stitch design system:
 * - Filled style with surfaceContainerHigh background
 * - 2px bottom-bar using primary on focus
 * - Error state uses error color + errorContainer background
 */
export function Input({ label, error, style, onFocus, onBlur, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && (
        <Typography
          variant="labelLg"
          color={error ? 'error' : focused ? 'primary' : 'onSurfaceVariant'}
          style={styles.label}
        >
          {label}
        </Typography>
      )}
      <TextInput
        style={[
          styles.input,
          focused && styles.focused,
          error && styles.error,
          style,
        ]}
        placeholderTextColor={colors.onSurfaceVariant}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
      {error && (
        <Typography variant="bodySm" color="error" style={styles.errorText}>
          {error}
        </Typography>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[1],
  },
  label: {
    marginLeft: spacing[2],
  },
  input: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontSize: typography.bodyLg.fontSize,
    fontFamily: typography.bodyLg.fontFamily,
    color: colors.onSurface,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minHeight: 56,
  },
  focused: {
    borderBottomColor: colors.primary,
  },
  error: {
    backgroundColor: colors.errorContainer,
    borderBottomColor: colors.error,
  },
  errorText: {
    marginLeft: spacing[2],
  },
});
