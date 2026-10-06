/**
 * 48x28 switch matching the old web .tgl control (accent track, white knob).
 * Hand-rolled so we don't add any dependency beyond react-native.
 */
import React, {useEffect, useRef} from 'react';
import {Animated, Easing, Pressable, StyleSheet} from 'react-native';
import {colors} from '../theme';

const TRACK_W = 48;
const TRACK_H = 28;
const KNOB = 22;
const TRAVEL = TRACK_W - KNOB - 6;

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
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surface3, colors.accent],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{checked: value, disabled}}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange(!value)}
      style={disabled ? styles.disabled : undefined}>
      <Animated.View style={[styles.track, {backgroundColor: trackColor}]}>
        <Animated.View
          style={[
            styles.knob,
            {
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [3, 3 + TRAVEL],
                  }),
                },
              ],
            },
          ]}
        />
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
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.white,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    shadowOffset: {width: 0, height: 2},
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
