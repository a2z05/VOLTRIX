/**
 * Monitor tab — the face of the app: big battery card, live stats,
 * profile selector and the charger/thermal info rows.
 */
import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Badge, Card, Row, SectionTitle} from '../components/ui';
import {VoltrixState} from '../native';
import {colors, radii} from '../theme';

export type ProfileKey = 'balanced' | 'performance' | 'battery_saver';

const PROFILES: Array<{key: ProfileKey; icon: string; name: string}> = [
  {key: 'balanced', icon: '⚖️', name: 'Balanced'},
  {key: 'performance', icon: '🚀', name: 'Performance'},
  {key: 'battery_saver', icon: '🌿', name: 'Saver'},
];

const PROFILE_NAMES: Record<ProfileKey, string> = {
  balanced: 'Balanced',
  performance: 'Performance',
  battery_saver: 'Battery saver',
};

function StatTile({value, label}: {value: string; label: string}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Battery hero card */}
      <View style={[styles.batteryCard, isCharging && styles.batteryCardCharging]}>
        <Text style={styles.capacity}>{capacity != null ? `${capacity}%` : '—%'}</Text>
        <Text style={styles.statusLine}>
          {status}
          {' · '}
          {profile in PROFILE_NAMES
            ? PROFILE_NAMES[profile as ProfileKey]
            : String(profile)}
        </Text>
        <View style={styles.statsRow}>
          <StatTile value={state?.temp_c != null ? `${state.temp_c}°C` : '—'} label="Temp" />
          <StatTile value={state?.power_w != null ? `${state.power_w}W` : '—'} label="Power" />
          <StatTile
            value={state?.current_ma != null ? `${state.current_ma}mA` : '—'}
            label="Current"
          />
        </View>
        {isCharging ? <Text style={styles.chargingHint}>⚡ Charging</Text> : null}
      </View>

      {/* Profile selector */}
      <View style={styles.section}>
        <SectionTitle>Profile</SectionTitle>
        <View style={styles.profilesRow}>
          {PROFILES.map(p => {
            const on = p.key === profile;
            return (
              <Pressable
                key={p.key}
                accessibilityRole="button"
                accessibilityState={{selected: on}}
                disabled={busy}
                onPress={() => onSelectProfile(p.key)}
                style={({pressed}) => [
                  styles.profileCard,
                  on && styles.profileCardOn,
                  busy && styles.profileBusy,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.profileIcon}>{p.icon}</Text>
                <Text style={[styles.profileName, on && styles.profileNameOn]}>
                  {p.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Charger / thermal info */}
      <View style={styles.section}>
        <SectionTitle>Charger</SectionTitle>
        <Card>
          <Row
            title="Type"
            right={
              <Badge
                text={(chargerType ?? '—').toUpperCase()}
                tone={chargerType && chargerType !== 'unknown' ? 'accent' : 'default'}
              />
            }
          />
          <Row
            title="Thermal Gate"
            subtitle="Live state"
            right={
              gateActive == null ? (
                <Badge text="—" />
              ) : (
                <Badge text={gateActive ? 'Fast' : 'Protected'} tone={gateActive ? 'bad' : 'ok'} />
              )
            }
          />
          <Row
            title="Charge Level"
            subtitle="0–16 step"
            right={<Badge text={state?.charge_level != null ? `${state.charge_level}/16` : '—'} />}
          />
          <Row title="Speed Calibration" right={<Badge text={calibrationLabel(state?.level_calibration)} />} />
          <Row
            title="Writable Nodes"
            right={<Badge text={state?.avail_total != null ? `${state.avail_total}/7` : '—'} />}
            last
          />
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 48,
  },
  batteryCard: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radii.xl,
    padding: 26,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 10},
    elevation: 5,
  },
  batteryCardCharging: {
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 22,
  },
  capacity: {
    fontSize: 52,
    fontWeight: '800',
    lineHeight: 56,
    letterSpacing: -1.2,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statusLine: {
    fontSize: 13.5,
    fontWeight: '500',
    color: colors.text2,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.gold,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.text3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 3,
  },
  chargingHint: {
    marginTop: 14,
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.accent,
  },
  section: {
    marginTop: 22,
  },
  profilesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  profileCard: {
    flex: 1,
    backgroundColor: 'rgba(30,33,51,0.6)',
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  profileCardOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(94,124,255,0.18)',
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  profileBusy: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.75,
  },
  profileIcon: {
    fontSize: 23,
    marginBottom: 6,
  },
  profileName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text2,
    textAlign: 'center',
  },
  profileNameOn: {
    color: colors.text,
  },
});
