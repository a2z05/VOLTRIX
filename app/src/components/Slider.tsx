/**
 * VOLTRIX slider — rebuilt on react-native-gesture-handler + reanimated.
 *
 * The old PanResponder version double-counted drag distance: onPanResponderMove
 * used CUMULATIVE dx from a base that emit() kept mutating, so every frame added
 * the whole delta again (drift + jumps). This version is drift-free by
 * construction:
 *
 *   - onBegin:  tap-to-position from ABSOLUTE x (immediate, exact)
 *   - onStart:  capture startValue exactly once; it is NEVER mutated again
 *   - onUpdate: live = startValue + (translationX / drawableWidth) * span
 *               then snap to step, clamped to [min, max]
 *
 * Feel: thumb springs up to 1.25x while dragging, the fill glows, a value
 * bubble rides the thumb and fades on release, and small ranges (0–16 style)
 * get subtle tick marks under the track.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {LayoutChangeEvent, StyleSheet, Text, View} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {colors, radii, space} from '../theme';

const THUMB = 22;
const GUTTER = 14;
const TRACK_H = 4;
const TOUCH_H = 44;
const BUBBLE_H = 26;

const DRAG_SPRING = {damping: 15, stiffness: 320};

function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return v < lo ? lo : v > hi ? hi : v;
}

function snapWorklet(v: number, min: number, max: number, step: number): number {
  'worklet';
  const stepped = Math.round((v - min) / step) * step + min;
  return clamp(Math.min(max, Math.max(min, stepped)), min, max);
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [trackW, setTrackW] = useState(0);
  const display = format ? format(value) : String(value);

  // --- refs: JS-side state reachable from worklets via stable references ---
  const onChangeRef = useRef(onChange);
  // Last value actually emitted (sync, JS-side): comparing against this —
  // not against the controlled prop, which only updates after a re-render —
  // means a drag that reverses before React commits still emits correctly.
  const lastEmitRef = useRef(value);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const emit = (v: number) => {
    if (v !== lastEmitRef.current) {
      lastEmitRef.current = v;
      onChangeRef.current(v);
    }
  };

  // --- shared values (UI thread) ------------------------------------------
  const wSV = useSharedValue(0); // full measured touch width
  const sv = useSharedValue(value); // live, snapped value
  const startValue = useSharedValue(value); // captured once per gesture
  const dragging = useSharedValue(0);
  const thumbScale = useSharedValue(1);
  const bubbleOpacity = useSharedValue(0);
  const bubbleW = useSharedValue(0); // measured bubble width, for clamping

  // Sync from the controlled prop while a gesture is not running.
  useEffect(() => {
    if (dragging.value === 0) {
      sv.value = value;
      startValue.value = value;
      lastEmitRef.current = value;
    }
  }, [value, dragging, sv, startValue]);

  const span = max - min;
  const showTicks = Number.isInteger(max - min) && max - min <= 16 && step >= 1;

  const gesture = useMemo(() => {
    const g = Gesture.Pan()
      .enabled(!disabled)
      .onBegin(e => {
        'worklet';
        const w = Math.max(wSV.value - GUTTER * 2, 1);
        const t = clamp((e.x - GUTTER) / w, 0, 1);
        const s = snapWorklet(min + t * span, min, max, step);
        // Tap-to-position lands exactly under the finger…
        startValue.value = s;
        sv.value = s;
        dragging.value = 1;
        thumbScale.value = withSpring(1.25, DRAG_SPRING);
        bubbleOpacity.value = withSpring(1, DRAG_SPRING);
        runOnJS(emit)(s);
      })
      .onStart(() => {
        'worklet';
        // …and the drag baseline is frozen here — never mutated again.
        startValue.value = sv.value;
      })
      .onUpdate(e => {
        'worklet';
        const w = Math.max(wSV.value - GUTTER * 2, 1);
        const raw = startValue.value + (e.translationX / w) * span;
        const s = snapWorklet(raw, min, max, step);
        if (s !== sv.value) {
          sv.value = s;
          runOnJS(emit)(s);
        }
      })
      .onFinalize(() => {
        'worklet';
        dragging.value = 0;
        thumbScale.value = withSpring(1, DRAG_SPRING);
        bubbleOpacity.value = withSpring(0, {damping: 18, stiffness: 260});
      });
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, min, max, step, span]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    wSV.value = w;
    setTrackW(w);
  };

  const t01 = (v: number) => (max > min ? Math.min(1, Math.max(0, (v - min) / span)) : 0);
  const pct = t01(value);

  // --- animated styles -----------------------------------------------------
  const fillStyle = useAnimatedStyle(() => {
    const w = Math.max(wSV.value - GUTTER * 2, 1);
    const t = max > min ? clamp((sv.value - min) / span, 0, 1) : 0;
    return {width: t * w};
  });

  const glowStyle = useAnimatedStyle(() => {
    const w = Math.max(wSV.value - GUTTER * 2, 1);
    const t = max > min ? clamp((sv.value - min) / span, 0, 1) : 0;
    return {width: t * w, opacity: 0.5 + dragging.value * 0.5};
  });

  const thumbStyle = useAnimatedStyle(() => {
    const w = Math.max(wSV.value - GUTTER * 2, 1);
    const t = max > min ? clamp((sv.value - min) / span, 0, 1) : 0;
    return {
      transform: [{translateX: t * Math.max(w - THUMB, 0)}, {scale: thumbScale.value}],
      shadowOpacity: 0.4 + dragging.value * 0.5,
    };
  });

  const bubbleStyle = useAnimatedStyle(() => {
    const w = Math.max(wSV.value - GUTTER * 2, 1);
    const t = max > min ? clamp((sv.value - min) / span, 0, 1) : 0;
    // exact thumb center inside the track box, minus half the bubble
    const thumbCenter = t * Math.max(w - THUMB, 0) + THUMB / 2;
    const shift = clamp(
      thumbCenter - bubbleW.value / 2,
      0,
      Math.max(w - bubbleW.value, 0),
    );
    return {
      transform: [{translateX: shift}],
      opacity: bubbleOpacity.value,
    };
  });

  const ticks = showTicks
    ? Array.from({length: max - min + 1}, (_, i) => min + i)
    : [];

  return (
    <View style={[styles.wrap, disabled && styles.disabled]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{display}</Text>
      </View>

      <GestureDetector gesture={gesture}>
        <View onLayout={onLayout} style={styles.touch} accessibilityRole="adjustable">
          {/* value bubble — rides the thumb, fades on release */}
          <Animated.View
            pointerEvents="none"
            onLayout={e => {
              bubbleW.value = e.nativeEvent.layout.width;
            }}
            style={[styles.bubble, bubbleStyle]}>
            <Text style={styles.bubbleText} numberOfLines={1}>
              {display}
            </Text>
            <View style={styles.bubbleTail} />
          </Animated.View>

          {/* track */}
          <View style={styles.trackBox}>
            <View style={styles.trackBg}>
              <Animated.View style={[styles.trackGlow, glowStyle]} />
              <Animated.View style={[styles.trackFill, fillStyle]} />
            </View>
            <Animated.View style={[styles.thumb, thumbStyle]} />
          </View>

          {/* tick marks for small ranges (0–16 style) */}
          {ticks.length > 0 && trackW > 0 ? (
            <View pointerEvents="none" style={styles.ticks}>
              {ticks.map((t, i) => (
                <View
                  key={t}
                  style={[
                    styles.tick,
                    i <= Math.round(pct * (ticks.length - 1)) && styles.tickOn,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: space.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -0.1,
  },
  value: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.accentHover,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.05,
  },
  touch: {
    height: TOUCH_H,
    justifyContent: 'center',
    paddingHorizontal: GUTTER,
  },
  trackBox: {
    height: THUMB + 4,
    justifyContent: 'center',
  },
  trackBg: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'visible',
  },
  trackGlow: {
    position: 'absolute',
    height: TRACK_H,
    top: 0,
    left: 0,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.accentGlow,
    opacity: 0.5,
  },
  trackFill: {
    position: 'absolute',
    height: TRACK_H,
    top: 0,
    left: 0,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.accentBright,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    top: (THUMB + 4 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.accentBright,
    shadowColor: colors.accentBright,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 2},
    elevation: 5,
  },
  bubble: {
    position: 'absolute',
    top: -(BUBBLE_H + 7),
    left: GUTTER,
    height: BUBBLE_H,
    paddingHorizontal: 9,
    borderRadius: radii.sm,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    opacity: 0,
  },
  bubbleText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    width: 8,
    height: 8,
    backgroundColor: colors.surface2,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    transform: [{rotate: '45deg'}],
  },
  ticks: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    bottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tick: {
    width: 2,
    height: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  tickOn: {
    backgroundColor: 'rgba(113,112,255,0.55)',
    height: 4,
  },
  disabled: {
    opacity: 0.5,
  },
});
