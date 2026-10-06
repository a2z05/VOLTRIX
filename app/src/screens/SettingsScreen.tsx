/**
 * Settings tab — every control maps 1:1 to a config.sh key; changes are
 * local until "Save settings" (writes keys, then auto-runs apply), while
 * "Apply now" simply re-runs charge.sh with whatever is already on disk.
 */
import React from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';
import {Button, Card, Row, SectionTitle} from '../components/ui';
import {Slider} from '../components/Slider';
import {Toggle} from '../components/Toggle';
import {Settings} from '../native';
import {colors} from '../theme';

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
      <View style={styles.section}>
        <SectionTitle>Thermal</SectionTitle>
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
      </View>

      <View style={styles.section}>
        <SectionTitle>Speed</SectionTitle>
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
      </View>

      <View style={styles.section}>
        <SectionTitle>Charging</SectionTitle>
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
      </View>

      <View style={styles.actions}>
        <Button label="Apply now" onPress={onApply} busy={busy} />
        <Button label="Save settings" variant="secondary" onPress={onSave} busy={busy} style={styles.actionGap} />
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
  section: {
    marginBottom: 22,
  },
  sliderRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  sliderRowLast: {
    paddingBottom: 14,
  },
  actions: {
    marginTop: 4,
  },
  actionGap: {
    marginTop: 10,
  },
});
