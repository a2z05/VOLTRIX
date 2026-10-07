/**
 * RingGauge — the hero status arc, drawn entirely from View dots.
 *
 * A ring of small dots around the circumference; each dot lights up as the
 * animated progress value sweeps past it, so the arc edge glides rather than
 * jumps. Progress lives in a shared value (spring-synced from the polled
 * prop), which keeps the whole ring animating on the UI thread.
 */
import React, {useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {colors} from '../theme';

const DOTS = 46;
const DOT = 5;

function RingDot({
  index,
  progress,
  size,
  radius,
}: {
  index: number;
  progress: SharedValue<number>;
  size: number;
  radius: number;
}) {
  const angle = (index / DOTS) * Math.PI * 2 - Math.PI / 2;
  const cx = size / 2 + radius * Math.cos(angle) - DOT / 2;
  const cy = size / 2 + radius * Math.sin(angle) - DOT / 2;

  const dotStyle = useAnimatedStyle(() => {
    const lit = Math.min(Math.max(progress.value * DOTS - index, 0), 1);
    return {
      opacity: 0.14 + lit * 0.86,
      transform: [{scale: 0.72 + lit * 0.5}],
    };
  });

  const haloStyle = useAnimatedStyle(() => {
    const lit = Math.min(Math.max(progress.value * DOTS - index, 0), 1);
    return {opacity: lit * 0.4};
  });

  return (
    <View style={[styles.slot, {left: cx, top: cy}]} pointerEvents="none">
      <Animated.View style={[styles.halo, haloStyle]} />
      <Animated.View style={[styles.dot, dotStyle]} />
    </View>
  );
}

export function RingGauge({
  progress,
  size = 150,
  children,
}: {
  /** 0..1 — battery fill, charge-limit position, etc. */
  progress: number;
  size?: number;
  children?: React.ReactNode;
}) {
  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = withSpring(Math.min(Math.max(progress, 0), 1), {
      damping: 20,
      stiffness: 110,
      mass: 0.8,
    });
  }, [progress, prog]);

  const radius = size / 2 - DOT * 1.4;

  return (
    <View style={{width: size, height: size}}>
      {/* base orbit — the unfilled track */}
      <View
        pointerEvents="none"
        style={[
          styles.orbit,
          {
            width: size - DOT * 4,
            height: size - DOT * 4,
            borderRadius: (size - DOT * 4) / 2,
          },
        ]}
      />
      {Array.from({length: DOTS}, (_, i) => (
        <RingDot key={i} index={i} progress={prog} size={size} radius={radius} />
      ))}
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orbit: {
    position: 'absolute',
    left: DOT * 2,
    top: DOT * 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  slot: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.accentBright,
  },
  halo: {
    position: 'absolute',
    left: -(DOT * 3.2 - DOT) / 2,
    top: -(DOT * 3.2 - DOT) / 2,
    width: DOT * 3.2,
    height: DOT * 3.2,
    borderRadius: DOT * 1.6,
    backgroundColor: colors.accentGlow,
    opacity: 0,
  },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
