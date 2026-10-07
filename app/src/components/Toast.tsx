/**
 * Bottom toast — dark floating chip that springs up over the tab bar,
 * purely presentational (caller owns visibility timing).
 */
import React, {useEffect} from 'react';
import {StyleSheet, Text} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {colors, radii, shadow} from '../theme';

export function Toast({
  message,
  bottomOffset = 24,
}: {
  message: string | null;
  bottomOffset?: number;
}) {
  const visible = message != null;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(visible ? 1 : 0, {
      damping: 17,
      stiffness: 220,
      mass: 0.7,
    });
  }, [visible, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{translateY: (1 - progress.value) * 22}],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, {bottom: bottomOffset}, style]}>
      <Text style={styles.text} numberOfLines={3}>
        {message ?? ''}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '88%',
    backgroundColor: 'rgba(25,26,27,0.98)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: 11,
    paddingHorizontal: 18,
    zIndex: 60,
    ...shadow.float,
  },
  text: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
});
