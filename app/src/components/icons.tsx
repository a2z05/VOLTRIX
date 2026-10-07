/**
 * View-drawn icon set — no emoji, no SVG, no image assets.
 * Every glyph is composed from plain Views (bars, rings, dots) so it can be
 * tinted by a single `color` prop and stay crisp at any density.
 */
import React, {useEffect} from 'react';
import {StyleSheet, View, ViewStyle} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export interface IconProps {
  color: string;
  size?: number;
  strokeWidth?: number;
}

const SPRING = {damping: 15, stiffness: 240};

/* ------------------------------------------------------------------ bolt -- */
/**
 * VOLTRIX bolt: two parallel slanted bars, offset diagonally so they meet
 * with a kink — the classic broken-flash silhouette, geometric and minimal.
 */
export function BoltIcon({color, size = 16, strokeWidth}: IconProps) {
  const w = strokeWidth ?? Math.max(2, Math.round(size * 0.18));
  const len = size * 0.56;
  const bar = (extra: ViewStyle): ViewStyle => ({
    position: 'absolute',
    width: w,
    height: len,
    borderRadius: w / 2,
    backgroundColor: color,
    transform: [{rotate: '22deg'}],
    ...extra,
  });
  return (
    <View style={{width: size, height: size}} accessibilityElementsHidden>
      <View
        style={bar({
          top: size * 0.02,
          left: size * 0.56 - w / 2,
        })}
      />
      <View
        style={bar({
          top: size * 0.42,
          left: size * 0.2 - w / 2,
        })}
      />
    </View>
  );
}

/* --------------------------------------------------------- tab-bar icons -- */

/** Monitor → live activity bars (a rising chart). */
export function ActivityIcon({color, size = 20}: IconProps) {
  const heights = [0.35, 0.7, 1, 0.55];
  const bw = Math.max(2, Math.round(size * 0.13));
  const gap = Math.max(2, Math.round(size * 0.1));
  const h = size;
  return (
    <View
      accessibilityElementsHidden
      style={{width: size, height: h, flexDirection: 'row', alignItems: 'flex-end', gap}}>
      {heights.map((f, i) => (
        <View
          key={i}
          style={{
            width: bw,
            height: Math.max(bw, Math.round(h * f * 0.8)),
            borderRadius: bw / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

/** Settings → slider rows with knobs. */
export function SlidersIcon({color, size = 20}: IconProps) {
  const rows: Array<{top: number; knobLeft: number}> = [
    {top: 0.16, knobLeft: 0.55},
    {top: 0.48, knobLeft: 0.2},
    {top: 0.8, knobLeft: 0.42},
  ];
  const lineH = Math.max(1.5, size * 0.08);
  const knob = Math.max(5, size * 0.26);
  return (
    <View accessibilityElementsHidden style={{width: size, height: size}}>
      {rows.map((r, i) => (
        <View key={i} style={{position: 'absolute', left: 0, right: 0, top: size * r.top}}>
          <View
            style={{
              height: lineH,
              borderRadius: lineH,
              backgroundColor: color,
              opacity: 0.45,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: (size - knob) * r.knobLeft,
              top: -(knob - lineH) / 2,
              width: knob,
              height: knob,
              borderRadius: knob / 2,
              backgroundColor: color,
              borderWidth: Math.max(1.5, size * 0.07),
              borderColor: '#0f1011',
            }}
          />
        </View>
      ))}
    </View>
  );
}

/** Log → terminal window with a prompt chevron. */
export function TerminalIcon({color, size = 20, strokeWidth}: IconProps) {
  const sw = Math.max(1.5, strokeWidth ?? size * 0.09);
  const cw = Math.max(4, size * 0.2); // chevron arm
  return (
    <View accessibilityElementsHidden style={{width: size, height: size * 0.82}}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: size * 0.18,
          borderWidth: sw,
          borderColor: color,
          opacity: 0.85,
        }}
      />
      {/* title bar rule */}
      <View
        style={{
          position: 'absolute',
          left: sw,
          right: sw,
          top: size * 0.24,
          height: sw,
          backgroundColor: color,
          opacity: 0.35,
        }}
      />
      {/* ">" prompt */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.2,
          top: size * 0.44,
          width: cw,
          height: sw,
          borderRadius: sw,
          backgroundColor: color,
          transform: [{rotate: '45deg'}, {translateY: -cw * 0.32}],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.2,
          top: size * 0.44,
          width: cw,
          height: sw,
          borderRadius: sw,
          backgroundColor: color,
          transform: [{rotate: '-45deg'}, {translateY: cw * 0.32}],
        }}
      />
      {/* underscore */}
      <View
        style={{
          position: 'absolute',
          left: size * 0.48,
          top: size * 0.6,
          width: size * 0.26,
          height: sw,
          borderRadius: sw,
          backgroundColor: color,
          opacity: 0.7,
        }}
      />
    </View>
  );
}

/** About → info ring with an "i". */
export function InfoIcon({color, size = 20, strokeWidth}: IconProps) {
  const sw = Math.max(1.5, strokeWidth ?? size * 0.09);
  return (
    <View accessibilityElementsHidden style={{width: size, height: size}}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: size / 2,
          borderWidth: sw,
          borderColor: color,
          opacity: 0.85,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: (size - (sw + 0.5)) / 2,
          top: size * 0.24,
          width: sw + 0.5,
          height: sw + 0.5,
          borderRadius: sw,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: (size - (sw + 0.5)) / 2,
          top: size * 0.44,
          width: sw + 0.5,
          height: size * 0.3,
          borderRadius: sw,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** Tab icons keyed by tab id — keeps the bar free of screen imports. */
export function TabGlyph({name, color, size = 20}: {name: string; color: string; size?: number}) {
  switch (name) {
    case 'settings':
      return <SlidersIcon color={color} size={size} />;
    case 'log':
      return <TerminalIcon color={color} size={size} />;
    case 'about':
      return <InfoIcon color={color} size={size} />;
    default:
      return <ActivityIcon color={color} size={size} />;
  }
}

/* ---------------------------------------------------------- utility glyphs -- */

/** Copy → two overlapping rounded frames. */
export function CopyIcon({color, size = 14}: IconProps) {
  const sw = Math.max(1.5, size * 0.13);
  return (
    <View accessibilityElementsHidden style={{width: size, height: size}}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: size * 0.7,
          height: size * 0.7,
          borderRadius: size * 0.16,
          borderWidth: sw,
          borderColor: color,
          opacity: 0.6,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: size * 0.7,
          height: size * 0.7,
          borderRadius: size * 0.16,
          borderWidth: sw,
          borderColor: color,
          backgroundColor: 'transparent',
        }}
      />
    </View>
  );
}

/** Check → single tick arm. */
export function CheckIcon({color, size = 14}: IconProps) {
  const sw = Math.max(1.5, size * 0.16);
  const arm = size * 0.42;
  return (
    <View accessibilityElementsHidden style={{width: size, height: size}}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.1,
          top: size * 0.48,
          width: arm,
          height: sw,
          borderRadius: sw,
          backgroundColor: color,
          transform: [{rotate: '45deg'}],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.34,
          top: size * 0.62,
          width: arm * 1.35,
          height: sw,
          borderRadius: sw,
          backgroundColor: color,
          transform: [{rotate: '-50deg'}],
        }}
      />
    </View>
  );
}

/** Chevron → used for Next / back affordances. */
export function ChevronIcon({color, size = 14, direction = 'right'}: IconProps & {direction?: 'left' | 'right'}) {
  const sw = Math.max(1.5, size * 0.16);
  const arm = size * 0.58;
  const spin = direction === 'right' ? 45 : -45;
  return (
    <View accessibilityElementsHidden style={{width: size, height: size}}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.18,
          top: size * 0.2,
          width: arm,
          height: sw,
          borderRadius: sw,
          backgroundColor: color,
          transform: [{rotate: `${spin}deg`}],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.18,
          top: size * 0.2,
          width: arm,
          height: sw,
          borderRadius: sw,
          backgroundColor: color,
          transform: [{rotate: `${-spin}deg`}],
        }}
      />
    </View>
  );
}

/**
 * Animated bolt tile — the app mark. The bolt "charges" (pulse scale)
 * whenever `active` is true, e.g. while the module reports charging.
 */
export function BoltTile({
  size = 40,
  active = false,
  tone = 'accent',
}: {
  size?: number;
  active?: boolean;
  tone?: 'accent' | 'ghost';
}) {
  const pulse = useSharedValue(1);
  const glow = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    glow.value = withSpring(active ? 1 : 0, {damping: 16, stiffness: 140});
  }, [active, glow]);

  useEffect(() => {
    if (!active) {
      pulse.value = withSpring(1, {damping: 14, stiffness: 160});
      return;
    }
    const id = setInterval(() => {
      pulse.value = withSpring(1.12, {damping: 9, stiffness: 260}, () => {
        'worklet';
        pulse.value = withSpring(1, {damping: 12, stiffness: 200});
      });
    }, 2200);
    return () => clearInterval(id);
  }, [active, pulse]);

  const tileStyle = useAnimatedStyle(() => ({
    transform: [{scale: 1 + (pulse.value - 1) * 0.5}],
    borderColor: `rgba(113,112,255,${0.25 + glow.value * 0.5})`,
    shadowOpacity: glow.value * 0.6,
  }));

  const boltStyle = useAnimatedStyle(() => ({
    transform: [{scale: pulse.value}],
  }));

  const isAccent = tone === 'accent';
  return (
    <Animated.View
      style={[
        styles.tile,
        {width: size, height: size, borderRadius: size * 0.32},
        isAccent ? styles.tileAccent : styles.tileGhost,
        tileStyle,
      ]}>
      <Animated.View style={boltStyle}>
        <BoltIcon color={isAccent ? '#f7f8f8' : '#7170ff'} size={size * 0.5} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#7170ff',
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  tileAccent: {
    backgroundColor: '#5e6ad2',
  },
  tileGhost: {
    backgroundColor: 'rgba(113,112,255,0.08)',
    shadowOpacity: 0,
  },
});
