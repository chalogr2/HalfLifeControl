import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { typography, colors, TypographyVariant, ColorToken } from '@/theme';

interface TypographyProps extends TextProps {
  variant?: TypographyVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
}

export function Typography({
  variant = 'bodyLg',
  color = 'onSurface',
  align = 'left',
  style,
  children,
  ...props
}: TypographyProps) {
  return (
    <Text
      style={[
        typography[variant],
        { color: colors[color], textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}
