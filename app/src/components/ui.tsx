/**
 * Shared building blocks — Linear-style precision edition.
 * PressableScale is the feedback primitive: every tappable surface in the
 * app springs down slightly on touch and back on release, so the whole UI
 * feels physically responsive without random bouncing.
 */
import React, {useCallback} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {colors, radii, space, type} from '../theme';

const TAP_SPRING = {damping: 16, stiffness: 340};

/* ------------------------------------------------------------ pressable --- */

export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  containerStyle,
  disabled = false,
  scaleTo = 0.965,
  hitSlop,
  accessibilityRole,
  accessibilityState,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleTo?: number;
  hitSlop?: number;
  accessibilityRole?: 'button' | 'link' | 'tab' | 'switch';
  accessibilityState?: {selected?: boolean; checked?: boolean; disabled?: boolean};
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{scale: scale.value}],
    opacity: 1 - pressed.value * 0.06,
  }));

  const onPressIn = useCallback(() => {
    'worklet';
    scale.value = withSpring(scaleTo, TAP_SPRING);
    pressed.value = withTiming(1, {duration: 90});
  }, [scale, pressed, scaleTo]);

  const onPressOut = useCallback(() => {
    'worklet';
    scale.value = withSpring(1, TAP_SPRING);
    pressed.value = withTiming(0, {duration: 160});
  }, [scale, pressed]);

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={containerStyle}>
      <Animated.View style={[style, animStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/* ---------------------------------------------------------- section title -- */

export function SectionTitle({children, hint}: {children: React.ReactNode; hint?: string}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTick} />
      <Text style={styles.sectionTitle}>{children}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ card -- */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ----------------------------------------------------------------- badge -- */

export type BadgeTone = 'default' | 'ok' | 'bad' | 'accent' | 'warn';

export function Badge({text, tone = 'default'}: {text: string; tone?: BadgeTone}) {
  return (
    <View style={[styles.badge, toneStyle(tone)]}>
      <Text style={[styles.badgeText, toneTextStyle(tone)]}>{text}</Text>
    </View>
  );
}

function toneStyle(tone: BadgeTone): ViewStyle {
  switch (tone) {
    case 'ok':
      return {backgroundColor: colors.greenSoft};
    case 'bad':
      return {backgroundColor: colors.redSoft};
    case 'warn':
      return {backgroundColor: 'rgba(235,171,68,0.14)'};
    case 'accent':
      return {backgroundColor: colors.accentSoft};
    default:
      return {backgroundColor: colors.cardInset};
  }
}

function toneTextStyle(tone: BadgeTone): {color: string} {
  switch (tone) {
    case 'ok':
      return {color: colors.emerald};
    case 'bad':
      return {color: colors.red};
    case 'warn':
      return {color: '#ebab44'};
    case 'accent':
      return {color: colors.accentHover};
    default:
      return {color: colors.text2};
  }
}

/* ------------------------------------------------------------------- row -- */

/** Label + optional subtitle on the left, any node (badge/toggle) on the right. */
export function Row({
  title,
  subtitle,
  right,
  last = false,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.rowLabel}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/* ---------------------------------------------------------------- button -- */

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isOff = disabled || busy;
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      disabled={isOff}
      containerStyle={style}
      style={[
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        isOff && styles.buttonDisabled,
      ]}>
      <View style={styles.buttonInner}>
        {busy ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? colors.white : colors.text2}
            style={styles.buttonSpinner}
          />
        ) : null}
        <Text
          style={[
            styles.buttonLabel,
            variant === 'primary' ? styles.buttonLabelPrimary : styles.buttonLabelSecondary,
          ]}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}

/* ------------------------------------------------------------- chip pill -- */

/** Neutral pill (tags, live indicators) — no press feedback by design. */
export function Pill({
  text,
  tone = 'default',
  dot = false,
  style,
}: {
  text: string;
  tone?: BadgeTone;
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const dotColor =
    tone === 'ok' ? colors.emerald : tone === 'bad' ? colors.red : colors.accentHover;
  return (
    <View style={[styles.pill, tone === 'default' ? null : toneStyle(tone), style]}>
      {dot ? <View style={[styles.pillDot, {backgroundColor: dotColor}]} /> : null}
      <Text
        style={[
          styles.pillText,
          tone === 'default' ? {color: colors.text3} : toneTextStyle(tone),
        ]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: space.sm,
    marginTop: space.lg,
  },
  sectionTick: {
    width: 3,
    height: 11,
    borderRadius: 2,
    backgroundColor: colors.accentBright,
    opacity: 0.85,
  },
  sectionTitle: {
    ...type.label,
    color: colors.text3,
  },
  sectionHint: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '500',
    color: colors.text4,
    letterSpacing: -0.05,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  badge: {
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minWidth: 58,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.1,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 13,
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -0.1,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.text4,
    marginTop: 1,
    letterSpacing: -0.05,
  },
  button: {
    borderRadius: radii.sm,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: colors.border,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonSpinner: {
    marginRight: 2,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  buttonLabelPrimary: {
    color: colors.white,
  },
  buttonLabelSecondary: {
    color: colors.text2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.card,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
