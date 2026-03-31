import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Typography } from '@/components/ui/Typography';
import { colors } from '@/theme';

interface ProgressRingProps {
  /** 0→1 (0 = full, 1 = depleted). */
  progress: number;
  /** Text shown inside the ring (e.g. "4h 23m"). */
  label: string;
  /** Ring diameter in px. */
  size?: number;
  /** Ring stroke width. */
  strokeWidth?: number;
  /** Ring color (defaults to primary). */
  color?: string;
}

export function ProgressRing({
  progress,
  label,
  size = 72,
  strokeWidth = 6,
  color = colors.primary,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Invert: progress=0 → full ring, progress=1 → empty ring
  const remaining = 1 - Math.min(1, Math.max(0, progress));
  const strokeDashoffset = circumference * (1 - remaining);

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} remaining`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round((1 - progress) * 100) }}
    >
      <Svg width={size} height={size}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceContainerHigh}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.label}>
        <Typography variant="labelSm" color="onSurface" align="center">
          {label}
        </Typography>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
