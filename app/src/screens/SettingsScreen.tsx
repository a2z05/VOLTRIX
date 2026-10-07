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
  canDrawOverlays,
  requestOverlayPermission,
} from '../native';
import {bentoIn} from '../anim';
import {colors, radii, space} from '../theme';

/** Floating-overlay permission status + grant shortcut (opens system screen). */
function OverlayRow() {
  const [granted, setGranted] = React.useState<boolean | null>(null);

  const check = () => {
    canDrawOverlays()
      .then(setGranted)
      .catch(() => setGranted(false));
  };

  React.useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const request = async () => {
    try {
      await requestOverlayPermission();
    } catch {
      // System screen unavailable — the hint text explains the manual path.
    }
    // The toggle flips while we are backgrounded — re-check on return.
    setTimeout(check, 900);
    setTimeout(check, 2800);
  };

  return (
    <>
      <Text style={styles.styleChipText}>
        {granted === null
          ? 'Checking…'
          : granted
            ? 'Overlay active'
            : 'Overlay off'}
      </Text>
      {granted === false ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Enable overlay permission"
          onPress={request}
          style={[styles.styleChip, styles.styleChipActive]}>
          <Text style={[styles.styleChipText, styles.styleChipTextActive]}>
            Enable
          </Text>
        </PressableScale>
      ) : null}
    </>
  );
}

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

/** Minutes-after-midnight -> "07:00" (night charge deadline picker). */
const fmtTime = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

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
        <SectionTitle hint="Land on target by morning">Night charge</SectionTitle>
        <Card>
          <Row
            title="Night charge"
            subtitle="Slow cruise overnight — land on target instead of finishing early"
            right={
              <Toggle
                value={settings.nightEnabled}
                onValueChange={v => onChange({nightEnabled: v})}
                disabled={busy}
                accessibilityLabel="Night charge"
              />
            }
          />
          <SliderRow>
            <Slider
              label="Land on"
              value={settings.nightTarget}
              min={50}
              max={100}
              step={5}
              format={v => `${v}%`}
              disabled={!settings.nightEnabled || busy}
              onChange={v => onChange({nightTarget: v})}
            />
          </SliderRow>
          <SliderRow last>
            <Slider
              label={`Reach it by ${fmtTime(settings.nightBy)}`}
              value={settings.nightBy}
              min={0}
              max={1435}
              step={5}
              format={fmtTime}
              disabled={!settings.nightEnabled || busy}
              onChange={v => onChange({nightBy: v})}
            />
          </SliderRow>
        </Card>
      </Animated.View>

      <Animated.View entering={bentoIn(4)}>
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

      <Animated.View entering={bentoIn(4)}>
        <SectionTitle hint="Card drawn above every app">Overlay</SectionTitle>
        <Card>
          <View style={styles.styleRow}>
            <OverlayRow />
          </View>
          <Text style={styles.styleHint}>
            Shows the live charging card over any app the moment the charger
            connects — independent of floating-alert, notification and DND
            settings.
          </Text>
        </Card>
      </Animated.View>

      <Animated.View entering={bentoIn(5)} style={styles.actions}>
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
