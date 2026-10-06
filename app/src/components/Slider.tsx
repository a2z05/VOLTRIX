/**
 * Touch slider built on PanResponder (no extra dependencies).
 * Header row shows label + live value; track has a 14px thumb gutter so the
 * knob never clips and tap-to-position maps 1:1 with the drawn track.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {colors} from '../theme';

const THUMB = 24;
const GUTTER = 14;

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
  const trackWRef = useRef(0);
  const onChangeRef = useRef(onChange);
  const anchorRef = useRef(value);
  const draggingRef = useRef(false);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onChangeRef.current = onChange;
    disabledRef.current = disabled;
  });

  // Keep the drag anchor in sync with the controlled value while idle.
  useEffect(() => {
    if (!draggingRef.current) {
      anchorRef.current = value;
    }
  }, [value]);

  const innerW = Math.max(trackW - GUTTER * 2, 1);

  const snap = (v: number): number => {
    const stepped = Math.round((v - min) / step) * step + min;
    return Math.min(max, Math.max(min, stepped));
  };

  const emit = (v: number) => {
    const s = snap(v);
    if (s !== anchorRef.current) {
      anchorRef.current = s;
      onChangeRef.current(s);
    }
  };

  // Reads the live width from the ref so the memoized PanResponder closure
  // never works with a stale (pre-layout) track width.
  const fromLocalX = (x: number): number => {
    const w = Math.max(trackWRef.current - GUTTER * 2, 1);
    const t = Math.min(1, Math.max(0, (x - GUTTER) / w));
    return min + t * (max - min);
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          draggingRef.current = true;
          emit(fromLocalX(e.nativeEvent.locationX));
        },
        onPanResponderMove: (_e: GestureResponderEvent, g: {dx: number}) => {
          const span = max - min;
          const trackWidth = Math.max(trackWRef.current - GUTTER * 2, 1);
          emit(anchorRef.current + (g.dx / trackWidth) * span);
        },
        onPanResponderRelease: () => {
          draggingRef.current = false;
        },
        onPanResponderTerminate: () => {
          draggingRef.current = false;
        },
      }),
    // min/max/step are constant per slider instance; emit only touches refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [min, max, step],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    trackWRef.current = e.nativeEvent.layout.width;
    setTrackW(e.nativeEvent.layout.width);
  };

  const pct =
    max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  const display = format ? format(value) : String(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{display}</Text>
      </View>
      <View
        onLayout={onLayout}
        style={[styles.touch, disabled && styles.disabled]}
        {...responder.panHandlers}>
        <View style={styles.trackBg}>
          <View
            style={[
              styles.trackFill,
              {width: trackW === 0 ? 0 : pct * Math.max(trackW - GUTTER * 2, 0)},
            ]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            {left: trackW === 0 ? 0 : GUTTER + pct * Math.max(innerW - THUMB, 0)},
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  label: {
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.text,
  },
  value: {
    fontSize: 12.5,
    color: colors.text3,
    fontVariant: ['tabular-nums'],
  },
  touch: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: GUTTER,
  },
  trackBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface3,
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.bg,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 4,
    top: 6,
  },
  disabled: {
    opacity: 0.5,
  },
});
