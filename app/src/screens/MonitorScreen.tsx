/**
 * Monitor tab — the face of the app, rebuilt as a bento grid.
 *
 * Hero card: ring gauge of battery fill (spring-swept dot arc) with live
 * power/temp/current cells. Below: profile chips (still drive runApply via
 * the parent), then charger + thermal-gate half cards, then the detail rows.
 * Every block enters with a staggered spring so hierarchy reads instantly.
 */
import React, {useEffect} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {Badge, Card, Pill, PressableScale, Row, SectionTitle} from '../components/ui';
import {RingGauge} from '../components/RingGauge';
import {VoltrixState} from '../native';
import {bentoIn} from '../anim';
import {colors, radii, shadow, space} from '../theme';

export type ProfileKey = 'balanced' | 'performance' | 'battery_saver';

const PROFILES: Array<{key: ProfileKey; name: string; subtitle: string}> = [
  {key: 'balanced', name: 'Balanced', subtitle: 'Everyday — quick charge without the heat'},
  {key: 'performance', name: 'Performance', subtitle: 'Fastest — full current for urgent top-ups'},
  {key: 'battery_saver', name: 'Battery saver', subtitle: 'Overnight & hot days — slowest and coolest'},
];

const PROFILE_NAMES: Record<ProfileKey, string> = {
  balanced: 'Balanced',
  performance: 'Performance',
  battery_saver: 'Battery saver',
};

/* --------------------------------------------------- view-drawn glyphs ---- */

function ProfileGlyph({kind, color}: {kind: ProfileKey; color: string}) {
  if (kind === 'performance') {
    const hs = [6, 10, 14];
    return (
      <View style={styles.glyphRow}>
        {hs.map((h, i) => (
          <View
            key={i}
            style={{width: 3, height: h, borderRadius: 2, backgroundColor: color}}
          />
        ))}
      </View>
    );
  }
  if (kind === 'battery_saver') {
    // crescent: filled circle with a bg-colored disc knocked out of it
    return (
      <View style={styles.glyphWrap}>
        <View style={[styles.moon, {backgroundColor: color}]} />
        <View style={[styles.moonCut, {backgroundColor: colors.card}]} />
      </View>
    );
  }
  // balanced: barbell / balance bar
  return (
    <View style={styles.glyphRow}>
      <View style={[styles.balDot, {backgroundColor: color}]} />
      <View style={[styles.balBar, {backgroundColor: color}]} />
      <View style={[styles.balDot, {backgroundColor: color}]} />
    </View>
  );
}

/* -------------------------------------------------------------- cells ----- */

function StatCell({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'hot';
}) {
  const valueColor =
    tone === 'accent' ? colors.accentHover : tone === 'hot' ? '#ebab44' : colors.text;
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellValue, {color: valueColor}]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.cellLabel}>{label}</Text>
    </View>
  );
}

function calibrationLabel(v: string | undefined): string {
  if (v === 'zero_is_fast') {
    return '0 = Fast';
  }
  if (v === 'sixteen_is_fast') {
    return '16 = Fast';
  }
  return 'Not calibrated yet';
}

/* -------------------------------------------------------------- screen ---- */

export function MonitorScreen({
  state,
  profile,
  busy,
  onSelectProfile,
}: {
  state: VoltrixState | null;
  profile: ProfileKey | string;
  busy: boolean;
  onSelectProfile: (p: ProfileKey) => void;
}) {
  const status = state?.status ?? '—';
  const isCharging = status.toLowerCase() === 'charging';
  const capacity = state?.capacity;
  const gateActive = state?.thermal_gate_active;
  const chargerType = state?.charger_type_detected;
  const temp = state?.temp_c;

  const breathe = useSharedValue(0.25);
  useEffect(() => {
    if (isCharging) {
      breathe.value = withRepeat(
        withSequence(
          withTiming(1, {duration: 1150}),
          withTiming(0.3, {duration: 1150}),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(breathe);
      breathe.value = withTiming(0.18, {duration: 400});
    }
  }, [isCharging, breathe]);

  const haloStyle = useAnimatedStyle(() => ({opacity: breathe.value}));

  const profileName =
    profile in PROFILE_NAMES ? PROFILE_NAMES[profile as ProfileKey] : String(profile);
  const tempTone: 'default' | 'accent' | 'hot' =
    temp == null ? 'default' : temp >= 45 ? 'hot' : temp >= 41 ? 'accent' : 'default';

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* ------------------------------------------------ hero status card */}
      <Animated.View entering={bentoIn(0)}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Pill
              text={state ? status : 'Waiting'}
              tone={isCharging ? 'accent' : 'default'}
              dot={isCharging}
            />
            <Pill text={profileName} tone="default" />
          </View>

          <View style={styles.heroMain}>
            <View style={styles.gaugeBox}>
              <Animated.View style={[styles.gaugeHalo, haloStyle]} />
              <RingGauge progress={capacity != null ? capacity / 100 : 0} size={158}>
                <Text style={styles.capacity}>
                  {capacity != null ? `${capacity}%` : '—%'}
                </Text>
                <Text style={styles.capacityLabel}>Battery</Text>
              </RingGauge>
            </View>

            <View style={styles.heroCells}>
              <StatCell
                label="Power"
                value={state?.power_w != null ? `${state.power_w}W` : '—'}
                tone={isCharging ? 'accent' : 'default'}
              />
              <View style={styles.cellRow}>
                <StatCell
                  label="Temp"
                  value={temp != null ? `${temp}°C` : '—'}
                  tone={tempTone}
                />
                <StatCell
                  label="Current"
                  value={state?.current_ma != null ? `${state.current_ma}mA` : '—'}
                />
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* -------------------------------------------------------- profiles */}
      <Animated.View entering={bentoIn(1)} style={styles.section}>
        <SectionTitle hint={busy ? 'Applying…' : 'What each one is for'}>Profile</SectionTitle>
        <Card>
          {PROFILES.map((p, idx) => {
            const on = p.key === profile;
            return (
              <PressableScale
                key={p.key}
                accessibilityRole="button"
                accessibilityState={{selected: on, disabled: busy}}
                accessibilityLabel={`${p.name} — ${p.subtitle}`}
                disabled={busy}
                onPress={() => onSelectProfile(p.key)}
                style={[
                  styles.profileRow,
                  idx < PROFILES.length - 1 && styles.profileRowBorder,
                  on && styles.profileRowOn,
                  busy && styles.busyDim,
                ]}>
                <ProfileGlyph kind={p.key} color={on ? colors.accentHover : colors.text3} />
                <View style={styles.profileTexts}>
                  <Text style={[styles.profileName, on && styles.profileNameOn]}>
                    {p.name}
                  </Text>
                  <Text style={styles.profileDesc} numberOfLines={2}>
                    {p.subtitle}
                  </Text>
                </View>
                <View style={[styles.profileCheck, on && styles.profileCheckOn]}>
                  {on ? <Text style={styles.profileCheckMark}>✓</Text> : null}
                </View>
              </PressableScale>
            );
          })}
        </Card>
      </Animated.View>

      {/* -------------------------------------------- charger + gate (bento) */}
      <View style={styles.halfRow}>
        <Animated.View entering={bentoIn(2)} style={styles.half}>
          <Card style={styles.halfCard}>
            <Text style={styles.halfLabel}>Charger</Text>
            <Text style={styles.halfValue} numberOfLines={1}>
              {(chargerType ?? '—').toUpperCase()}
            </Text>
            <Text style={styles.halfSub}>Detected type</Text>
          </Card>
        </Animated.View>
        <Animated.View entering={bentoIn(3)} style={styles.half}>
          <Card style={styles.halfCard}>
            <Text style={styles.halfLabel}>Thermal gate</Text>
            <Text
              style={[
                styles.halfValue,
                {color: gateActive ? colors.accentHover : colors.emerald},
              ]}>
              {gateActive == null ? '—' : gateActive ? 'Fast' : 'Protected'}
            </Text>
            <Text style={styles.halfSub}>Live state</Text>
          </Card>
        </Animated.View>
      </View>

      {/* -------------------------------------------------- details card */}
      <Animated.View entering={bentoIn(4)} style={styles.section}>
        <SectionTitle>Details</SectionTitle>
        <Card>
          <Row
            title="Charge level"
            subtitle="0–16 step"
            right={
              <Badge text={state?.charge_level != null ? `${state.charge_level}/16` : '—'} />
            }
          />
          <Row
            title="Speed calibration"
            right={<Badge text={calibrationLabel(state?.level_calibration)} />}
          />
          <Row
            title="Writable nodes"
            right={
              <Badge text={state?.avail_total != null ? `${state.avail_total}/7` : '—'} />
            }
            last
          />
        </Card>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    paddingBottom: 130, // clears the floating tab bar
  },
  hero: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: space.lg,
    ...shadow.hero,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  heroMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  gaugeBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeHalo: {
    position: 'absolute',
    left: -10,
    top: -10,
    width: 178,
    height: 178,
    borderRadius: 89,
    borderWidth: 2,
    borderColor: colors.accentGlow,
    opacity: 0.25,
  },
  capacity: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '600',
    letterSpacing: -1.4,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  capacityLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.text4,
    marginTop: 4,
  },
  heroCells: {
    flex: 1,
    gap: space.sm,
    minWidth: 0,
  },
  cellRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  cell: {
    flex: 1,
    backgroundColor: colors.cardInset,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    minWidth: 0,
  },
  cellValue: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  cellLabel: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.text4,
    marginTop: 3,
  },
  section: {
    marginTop: space.xl,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm + 2,
    paddingVertical: 13,
    paddingHorizontal: space.md,
    borderRadius: radii.md,
  },
  profileRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    borderRadius: 0,
  },
  profileRowOn: {
    backgroundColor: colors.accentSofter,
    borderRadius: radii.md,
  },
  profileTexts: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  busyDim: {
    opacity: 0.55,
  },
  profileName: {
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.2,
  },
  profileNameOn: {
    color: colors.accentHover,
  },
  profileDesc: {
    fontSize: 11.5,
    lineHeight: 15.5,
    color: colors.text3,
  },
  profileCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCheckOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  profileCheckMark: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  halfRow: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xl,
  },
  half: {
    flex: 1,
    minWidth: 0,
  },
  halfCard: {
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  halfLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: colors.text4,
  },
  halfValue: {
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.text,
    marginTop: 7,
    fontVariant: ['tabular-nums'],
  },
  halfSub: {
    fontSize: 11.5,
    color: colors.text3,
    marginTop: 3,
  },
  /* --- glyphs ---------------------------------------------------------- */
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 14,
  },
  glyphWrap: {
    width: 14,
    height: 14,
  },
  moon: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  moonCut: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    left: 5,
    top: -1,
  },
  balDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  balBar: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
});
