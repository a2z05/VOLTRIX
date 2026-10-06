/**
 * Shared building blocks: section titles, cards, rows, badges and buttons —
 * the pieces the old web UI called .stitle / .card / .row / .bdg / .btn.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {colors, layout, radii} from '../theme';

export function SectionTitle({children}: {children: React.ReactNode}) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export type BadgeTone = 'default' | 'ok' | 'bad' | 'accent';

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
    case 'accent':
      return {backgroundColor: colors.accentSoft};
    default:
      return {backgroundColor: colors.surface3};
  }
}

function toneTextStyle(tone: BadgeTone): {color: string} {
  switch (tone) {
    case 'ok':
      return {color: colors.green};
    case 'bad':
      return {color: colors.red};
    case 'accent':
      return {color: colors.accent};
    default:
      return {color: colors.text2};
  }
}

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
  variant?: 'primary' | 'secondary';
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isOff = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isOff}
      style={({pressed}) => [
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        isOff && styles.buttonDisabled,
        pressed && !isOff && styles.buttonPressed,
        style,
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.text3,
    marginBottom: 9,
  },
  card: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.xl,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 6},
    elevation: 4,
  },
  badge: {
    borderRadius: radii.sm,
    paddingVertical: 5,
    paddingHorizontal: 11,
    minWidth: 64,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
    fontWeight: '600',
    color: colors.text,
  },
  rowSubtitle: {
    fontSize: 12.5,
    color: colors.text3,
    marginTop: 1,
  },
  button: {
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
    shadowColor: colors.accentGlow,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  buttonSecondary: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.8,
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
    fontSize: 15.5,
    fontWeight: '700',
  },
  buttonLabelPrimary: {
    color: colors.white,
  },
  buttonLabelSecondary: {
    color: colors.text,
  },
});

export const pageSection = StyleSheet.create({
  section: {
    marginBottom: layout.sectionGap,
  },
});
