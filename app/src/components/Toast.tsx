/**
 * Compact bottom toast (old web .toast): dark pill, fades + slides in,
 * auto-hidden by the caller. Purely presentational.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text} from 'react-native';
import {colors, radii} from '../theme';

export function Toast({
  message,
  bottomOffset = 24,
}: {
  message: string | null;
  bottomOffset?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const visible = message != null;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {bottom: bottomOffset},
        {
          opacity: anim,
          transform: [
            {translateY: anim.interpolate({inputRange: [0, 1], outputRange: [12, 0]})},
          ],
        },
      ]}>
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
    backgroundColor: 'rgba(22,24,38,0.97)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 20,
    zIndex: 50,
    elevation: 8,
  },
  text: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    borderRadius: radii.md,
  },
});
