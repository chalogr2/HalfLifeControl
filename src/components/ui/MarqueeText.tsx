import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Typography } from './Typography';
import type { TypographyVariant, ColorToken } from '@/theme';

interface MarqueeTextProps {
  children: string;
  variant?: TypographyVariant;
  color?: ColorToken;
  style?: StyleProp<ViewStyle>;
  textStyle?: React.ComponentProps<typeof Typography>['style'];
  /** Pixels per second. Industry-standard ~30–60 px/s for readable scrolling. */
  speedPxPerSec?: number;
  /** Pause before scrolling away from the start (ms). */
  startPauseMs?: number;
  /** Pause at the end before scrolling back (ms). */
  endPauseMs?: number;
  accessibilityLabel?: string;
}

// Wide-enough sentinel so the Text inside the track is never width-constrained
// and reports its true one-line width via onLayout. The classic pattern used by
// react-native-marquee and friends — Yoga only truncates Text when its parent
// imposes a tight width, so we hand it a loose one.
const TRACK_WIDTH = 10000;

/**
 * Single-line text that scrolls horizontally when its content overflows the
 * container. Falls back to a plain one-line render when content fits.
 *
 * Timing matches the iOS MarqueeLabel convention: long pause at start, smooth
 * ping-pong scroll at ~50 px/s, shorter pause at the end.
 */
export function MarqueeText({
  children,
  variant,
  color,
  style,
  textStyle,
  speedPxPerSec = 50,
  startPauseMs = 1500,
  endPauseMs = 1000,
  accessibilityLabel,
}: MarqueeTextProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const overflow = textWidth > containerWidth + 1 && containerWidth > 0;
  const scrollDistance = Math.max(0, textWidth - containerWidth);

  useEffect(() => {
    translateX.stopAnimation();
    translateX.setValue(0);
    if (!overflow) return;

    let cancelled = false;
    const scrollMs = (scrollDistance / speedPxPerSec) * 1000;
    const cycle = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.delay(startPauseMs),
        Animated.timing(translateX, {
          toValue: -scrollDistance,
          duration: scrollMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(endPauseMs),
        Animated.timing(translateX, {
          toValue: 0,
          duration: scrollMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) cycle();
      });
    };
    cycle();

    return () => {
      cancelled = true;
      translateX.stopAnimation();
    };
  }, [overflow, scrollDistance, speedPxPerSec, startPauseMs, endPauseMs, translateX]);

  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={accessibilityLabel ?? children}
    >
      <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
        <Typography
          variant={variant}
          color={color}
          numberOfLines={1}
          style={textStyle}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
        >
          {children}
        </Typography>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  track: {
    // Row direction: the Text sizes to its natural content width on the main
    // axis instead of stretching to the track's cross-axis. Without this, the
    // Text fills the 10000pt track and onLayout reports 10000 for every label.
    flexDirection: 'row',
    width: TRACK_WIDTH,
  },
});
