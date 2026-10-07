/**
 * Floating bottom tab bar — a detached pill floating above the content edge.
 *
 * The active marker is a single indicator View that springs horizontally
 * between slots (never a per-tab hard swap), tab glyphs pop subtly when they
 * become active, and every tap dips the whole item. Icons are pure View
 * shapes (see icons.tsx) — no emoji glyphs anywhere in navigation.
 */
import React, {useEffect, useState} from 'react';
import {LayoutChangeEvent, Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {TabGlyph} from './icons';
import {colors, radii, shadow} from '../theme';

export interface TabDef {
  key: string;
  label: string;
}

const BAR_H = 60;
const PAD = 6;
const ITEM_SPRING = {damping: 18, stiffness: 210, mass: 0.85};

function TabItem({
  tab,
  active,
  onPress,
}: {
  tab: TabDef;
  active: boolean;
  onPress: () => void;
}) {
  const marker = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    marker.value = withSpring(active ? 1 : 0, ITEM_SPRING);
  }, [active, marker]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{translateY: -marker.value * 2}, {scale: 1 + marker.value * 0.1}],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + marker.value * 0.45,
  }));
  const itemStyle = useAnimatedStyle(() => ({transform: [{scale: press.value}]}));

  const tint = active ? colors.accentHover : colors.text3;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{selected: active}}
      accessibilityLabel={tab.label}
      onPress={onPress}
      onPressIn={() => {
        press.value = withSpring(0.94, {damping: 15, stiffness: 380});
      }}
      onPressOut={() => {
        press.value = withSpring(1, {damping: 15, stiffness: 300});
      }}
      style={styles.item}>
      <Animated.View style={[styles.itemInner, itemStyle]}>
        <Animated.View style={iconStyle}>
          <TabGlyph name={tab.key} color={tint} size={19} />
        </Animated.View>
        <Animated.Text
          style={[
            styles.label,
            {color: active ? colors.text : colors.text4},
            labelStyle,
          ]}
          numberOfLines={1}>
          {tab.label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

export function TabBar({
  tabs,
  active,
  onChange,
  bottomOffset = 12,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
  bottomOffset?: number;
}) {
  const [slotW, setSlotW] = useState(0);
  const activeIndex = Math.max(
    0,
    tabs.findIndex(t => t.key === active),
  );
  const indexSV = useSharedValue(activeIndex);

  useEffect(() => {
    indexSV.value = withSpring(activeIndex, ITEM_SPRING);
  }, [activeIndex, indexSV]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setSlotW((w - PAD * 2) / tabs.length);
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{translateX: indexSV.value * slotW}],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, {bottom: bottomOffset}]}>
      <View style={styles.bar} onLayout={onLayout}>
        {slotW > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, {width: slotW}, indicatorStyle]}
          />
        ) : null}
        {tabs.map(t => (
          <TabItem
            key={t.key}
            tab={t}
            active={t.key === active}
            onPress={() => onChange(t.key)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 40,
  },
  bar: {
    width: '100%',
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
    backgroundColor: 'rgba(15,16,17,0.97)',
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  indicator: {
    position: 'absolute',
    left: PAD,
    top: (BAR_H - (BAR_H - PAD * 2)) / 2,
    height: BAR_H - PAD * 2,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(113,112,255,0.22)',
  },
  item: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
  },
  label: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
