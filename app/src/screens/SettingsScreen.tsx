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
import {ScrollView, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {Button, Card, Row, SectionTitle} from '../components/ui';
import {Slider} from '../components/Slider';
import {Toggle} from '../components/Toggle';
import {Settings} from '../native';
import {bentoIn} from '../anim';
import {colors, space} from '../theme';

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

export function SettingsScreen({
  settings,
  onChange,
  onApply,
  onSave,
  busy,
}: {
  settings: Settings;
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

      <Animated.View entering={bentoIn(3)} style={styles.actions}>
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
});
