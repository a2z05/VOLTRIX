/**
 * Settings tab — every control maps 1:1 to a config.sh key; changes are
 * local until "Save settings" (writes keys, then auto-runs apply), while
 * "Apply now" simply re-runs charge.sh with whatever is already on disk.
 *
 * Redesigned as stacked section cards: caption headers with a tick, hairline
 * row rhythm, and the rebuilt sliders sitting inline where the old controls
 * were — same props, new feel. Sections spring in staggered.
 */
import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {Button, Card, PressableScale, Row, SectionTitle} from '../components/ui';
import {Slider} from '../components/Slider';
import {Toggle} from '../components/Toggle';
import {
  NOTIF_STYLES,
  NOTIF_STYLE_LABELS,
  NotifStyle,
  Settings,
} from '../native';
import {bentoIn} from '../anim';
import {colors, radii, space} from '../theme';

function SliderRow({
  children,
  last = false,
}: {
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.sliderRow, last && styles.sliderRowLast]}>{children}</View>
  );
}

const STYLE_HINTS: Record<NotifStyle, string> = {
  ISLAND: 'Centered capsule — lives until you swipe it away, accent rim when 67W runs',
  CARD: 'The original two-line card with title, state and switch',
  SLIM: 'Low-profile single line: bolt, status, switch',
  CLASSIC: 'Stock Android text with a Toggle action button — lightest option',
};

export function SettingsScreen({
  settings,
  notifStyle,
  onNotifStyle,
  onChange,
  onApply,
  onSave,
  busy,
}: {
  settings: Settings;
  notifStyle: NotifStyle;
  onNotifStyle: (v: NotifStyle) => void;
  onChange: (patch: Partial<Settings>) => void;
  onApply: () => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Animated.View entering={bentoIn(0)}>
        <SectionTitle hint="Temperature window">Thermal</SectionTitle>
        <Card>
          <Row
            title="Thermal management enabled"
            subtitle="Temperature-gated fast charging"
            right={
              <Toggle
                value={settings.disableThermal}
                onValueChange={v => onChange({disableThermal: v})}
                accessibilityLabel="Thermal management enabled"
              />
            }
          />
          <SliderRow>
            <Slider
              label="Speed up below"
              value={settings.thermalCoolC}
              min={30}
              max={48}
              format={v => `${v}°C`}
              onChange={v => onChange({thermalCoolC: v})}
            />
          </SliderRow>
          <SliderRow last>
            <Slider
              label="Slow down at"
              value={settings.thermalHotC}
              min={38}
              max={55}
              format={v => `${v}°C`}
              onChange={v => onChange({thermalHotC: v})}
            />
          </SliderRow>
        </Card>
      </Animated.View>

      <Animated.View entering={bentoIn(1)}>
        <SectionTitle hint="Profile tuning">Speed</SectionTitle>
        <Card>
          <Row
            title="Disable Xiaomi throttles"
            subtitle="night charging · smart chg · restrict"
            right={
              <Toggle
                value={settings.throttlesDisabled}
                onValueChange={v => onChange({throttlesDisabled: v})}
                accessibilityLabel="Disable Xiaomi throttles"
              />
            }
          />
          <SliderRow>
            <Slider
              label="Performance level"
              value={settings.performanceLevel}
              min={0}
              max={16}
              format={v => `${v}/16`}
              onChange={v => onChange({performanceLevel: v})}
            />
          </SliderRow>
          <SliderRow last>
            <Slider
              label="Performance current"
              value={settings.performanceMa}
              min={1000}
              max={13400}
              step={100}
              format={v => `${v}mA`}
              onChange={v => onChange({performanceMa: v})}
            />
          </SliderRow>
        </Card>
      </Animated.View>

      <Animated.View entering={bentoIn(2)}>
        <SectionTitle hint="Limits & hold">Charging</SectionTitle>
        <Card>
          <Row
            title="Always keep fast charge"
            subtitle="Hold the thermal gate open while charging"
            right={
              <Toggle
                value={settings.alwaysFast}
                onValueChange={v => onChange({alwaysFast: v})}
                accessibilityLabel="Always keep fast charge"
              />
            }
          />
          <SliderRow last>
            <Slider
              label="Charge limit"
              value={settings.chargeLimit}
              min={0}
              max={100}
              format={v => (v === 0 ? 'Off' : `${v}%`)}
              onChange={v => onChange({chargeLimit: v})}
            />
          </SliderRow>
        </Card>
      </Animated.View>

      <Animated.View entering={bentoIn(3)}>
        <SectionTitle hint="Charging card style">Notification</SectionTitle>
        <Card>
          <View style={styles.styleRow}>
            {NOTIF_STYLES.map(s => {
              const active = s === notifStyle;
              return (
                <PressableScale
                  key={s}
                  accessibilityRole="tab"
                  accessibilityState={{selected: active}}
                  accessibilityLabel={`Notification style ${NOTIF_STYLE_LABELS[s]}`}
                  onPress={() => onNotifStyle(s)}
                  style={[styles.styleChip, active && styles.styleChipActive]}>
                  <Text
                    style={[styles.styleChipText, active && styles.styleChipTextActive]}>
                    {NOTIF_STYLE_LABELS[s]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
          <Text style={styles.styleHint}>{STYLE_HINTS[notifStyle]}</Text>
        </Card>
      </Animated.View>

      <Animated.View entering={bentoIn(4)} style={styles.actions}>
        <Button label="Apply now" onPress={onApply} busy={busy} />
        <Button
          label="Save settings"
          variant="secondary"
          onPress={onSave}
          busy={busy}
          style={styles.actionGap}
        />
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.gutter,
    paddingTop: space.xs,
    paddingBottom: 130,
  },
  sliderRow: {
    paddingHorizontal: space.lg,
    paddingTop: 2,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  sliderRowLast: {
    paddingBottom: space.md,
  },
  actions: {
    marginTop: space.xl,
    gap: space.sm,
  },
  actionGap: {
    marginTop: 0,
  },
  styleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  styleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.cardInset,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  styleChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBright,
  },
  styleChipText: {
    color: colors.text3,
    fontSize: 13,
    fontWeight: '500',
  },
  styleChipTextActive: {
    color: colors.text,
  },
  styleHint: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
    color: colors.text4,
    fontSize: 12,
    lineHeight: 16,
  },
});
