/**
 * Switch control — reanimated rebuild of the old 48x28 web toggle.
 * Knob springs across the track, the track crossfades between idle and
 * accent fills (two stacked layers, so no color interpolation), and the
 * whole control dips slightly under the finger.
 */
import React, {useEffect} from 'react';
import {Pressable, StyleSheet} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {colors} from '../theme';

const TRACK_W = 46;
const TRACK_H = 26;
const KNOB = 20;
const TRAVEL = TRACK_W - KNOB - 3;

const SPRING = {damping: 16, stiffness: 260};

export function Toggle({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const on = useSharedValue(value ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    on.value = withSpring(value ? 1 : 0, SPRING);
  }, [value, on]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{scale: press.value}],
  }));

  const activeFillStyle = useAnimatedStyle(() => ({opacity: on.value}));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      {translateX: 3 + on.value * TRAVEL},
      {scale: press.value},
    ],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{checked: value, disabled}}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      onPressIn={() => {
        press.value = withTiming(0.93, {duration: 80});
      }}
      onPressOut={() => {
        press.value = withTiming(1, {duration: 140});
      }}
      style={disabled ? styles.disabled : undefined}>
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.fillActive, activeFillStyle]} />
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fillActive: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.accent,
    borderRadius: TRACK_H / 2,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.white,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: {width: 0, height: 1},
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
