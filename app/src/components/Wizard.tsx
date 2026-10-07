/**
 * First-run wizard — shown when config.sh has no UI_WIZARD_DONE flag
 * (or when config couldn't be read at all, e.g. root missing).
 *
 * Five explanatory steps, English copy, spring slide+fade transitions,
 * progress dots, Skip, and a big Next. Persisting is best-effort: the
 * finish path wraps cfgSet in try/catch so a missing su can never brick
 * startup — worst case the wizard shows again next launch.
 */
import React, {useEffect, useRef, useState} from 'react';
import {Modal, StyleSheet, Text, View, ViewStyle} from 'react-native';
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {Button, PressableScale} from './ui';
import {BoltIcon, ChevronIcon} from './icons';
import {cfgSet} from '../native';
import {colors, radii, shadow, space, type} from '../theme';

interface Step {
  kicker: string;
  title: string;
  body: string;
  note?: string;
}

const STEPS: Step[] = [
  {
    kicker: 'Welcome',
    title: 'Root-level charging control',
    body: 'VOLTRIX drives fast charging through the HyperCharge/VOLTRIX module — the Magisk / KernelSU module installed on this device. The app is the cockpit; the module writes kernel charging nodes over su so your charger actually runs at the speeds the hardware allows.',
    note: 'Everything in this app stays on your device.',
  },
  {
    kicker: 'Automatic',
    title: 'Fast charging applies itself',
    body: 'While your phone is charging, the active profile (Balanced, Performance or Battery saver) is applied automatically — no buttons to press. Plug in and VOLTRIX does the rest.',
    note: 'The gate rule: the fast profile only engages while your battery sits inside the configured temperature window. Cool battery, full speed; hot battery, throttled on purpose. You set that window in Settings.',
  },
  {
    kicker: 'The 67W unlock',
    title: 'Full power, on purpose',
    body: 'The 67W full-charge unlock triggers only when you open this app while charging. That gate is deliberate: maximum charge rate is never released silently in the background — you open VOLTRIX during a charge and the unlock engages for that session.',
    note: 'Nothing changes behind your back; opening the app is the switch.',
  },
  {
    kicker: 'Live notification',
    title: 'Heads-up charging status',
    body: 'VOLTRIX can show a custom heads-up notification while charging, with a toggle tile built right into it and a small activation animation when fast charging kicks in.',
    note: 'It is driven by the module through root and only reacts to charge events, so the standby battery cost stays minimal.',
  },
  {
    kicker: 'Two quick grants',
    title: 'Root + notifications',
    body: 'Allow notifications when Android asks — that is how the heads-up card can appear. If a superuser prompt pops up, grant it (accept the su request in KernelSU/Magisk).',
    note: 'Missed the prompt? Grant VOLTRIX in your root manager, then reopen the app.',
  },
];

const DOTS = STEPS.length;

function Dot({
  index,
  progress,
  active,
}: {
  index: number;
  progress: SharedValue<number>;
  active: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const near = Math.min(Math.max(1 - Math.abs(progress.value - index), 0), 1);
    return {
      width: 6 + near * 16,
      opacity: 0.3 + near * 0.7,
    };
  });
  return <Animated.View style={[styles.dot, active && styles.dotActive, style]} />;
}

function StepDots({step}: {step: number}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withSpring(step, {damping: 18, stiffness: 190});
  }, [step, p]);

  return (
    <View style={styles.dotsRow}>
      {Array.from({length: DOTS}, (_, i) => (
        <Dot key={i} index={i} progress={p} active={i === step} />
      ))}
    </View>
  );
}

/** One slide+fade spring step; remounts on step change via key. */
function StepBody({step, dir}: {step: Step; dir: number}) {
  const enter = useSharedValue(0);

  useEffect(() => {
    enter.value = 0;
    enter.value = withSpring(1, {damping: 20, stiffness: 150, mass: 0.9});
  }, [enter]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{translateX: (1 - enter.value) * 34 * (dir >= 0 ? 1 : -1)}],
  }));

  return (
    <Animated.View style={[styles.stepBody, style]}>
      <View style={styles.kickerRow}>
        <View style={styles.kickerTick} />
        <Text style={styles.kicker}>{step.kicker}</Text>
      </View>
      <Text style={styles.title}>{step.title}</Text>
      <Text style={styles.body}>{step.body}</Text>
      {step.note ? (
        <View style={styles.noteBox}>
          <Text style={styles.note}>{step.note}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

export function FirstRunWizard({onFinish}: {onFinish: () => void}) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const dismiss = useSharedValue(1);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  });

  const last = step === STEPS.length - 1;

  // Stable JS entry point the dismiss worklet can schedule back onto JS.
  const notifyFinished = () => {
    onFinishRef.current();
  };

  const finish = () => {
    // Best-effort persistence — root may be missing; never brick startup.
    try {
      cfgSet('UI_WIZARD_DONE', 'true').catch(() => {});
    } catch {
      /* ignore */
    }
    dismiss.value = withTiming(0, {duration: 240}, finished => {
      if (finished) {
        runOnJS(notifyFinished)();
      }
    });
  };

  const next = () => {
    if (last) {
      finish();
      return;
    }
    setDir(1);
    setStep(s => s + 1);
  };

  const back = () => {
    if (step === 0) {
      return;
    }
    setDir(-1);
    setStep(s => s - 1);
  };

  const overlayStyle = useAnimatedStyle(() => ({opacity: dismiss.value}));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: dismiss.value,
    transform: [{scale: 0.94 + dismiss.value * 0.06}],
  }));

  const current = STEPS[step];

  return (
    <Modal transparent visible statusBarTranslucent animationType="none">
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, overlayStyle]} />
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.headerRow}>
            <View style={styles.mark}>
              <BoltIcon color={colors.accentHover} size={15} />
            </View>
            <Text style={styles.brand}>VOLTRIX</Text>
            <Text style={styles.counter}>
              {step + 1}/{DOTS}
            </Text>
            <PressableScale
              accessibilityRole="button"
              onPress={finish}
              containerStyle={styles.skipHit}
              style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </PressableScale>
          </View>

          <StepDots step={step} />

          <StepBody key={step} step={current} dir={dir} />

          <View style={styles.footer}>
            {step > 0 ? (
              <PressableScale
                accessibilityRole="button"
                onPress={back}
                style={styles.backBtn}
                containerStyle={styles.backHit}>
                <ChevronIcon color={colors.text3} size={13} direction="left" />
                <Text style={styles.backText}>Back</Text>
              </PressableScale>
            ) : (
              <View style={styles.backHit} />
            )}
            <View style={styles.nextWrap}>
              <Button
                label={last ? 'Get started' : 'Next'}
                onPress={next}
                style={styles.nextBtn}
              />
              <View style={styles.nextChevron}>
                <ChevronIcon color="#ffffff" size={13} />
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(1,1,2,0.88)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.panel,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    ...shadow.float,
  } as ViewStyle,
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mark: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSofter,
    borderWidth: 1,
    borderColor: 'rgba(113,112,255,0.3)',
  },
  brand: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    color: colors.text2,
  },
  counter: {
    marginLeft: 'auto',
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.text4,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  skipHit: {
    marginLeft: 10,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  skipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text3,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    height: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text4,
  },
  dotActive: {
    backgroundColor: colors.accentBright,
  },
  stepBody: {
    marginTop: 22,
    minHeight: 250,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  kickerTick: {
    width: 3,
    height: 10,
    borderRadius: 2,
    backgroundColor: colors.accentBright,
  },
  kicker: {
    ...type.label,
    color: colors.accentHover,
  },
  title: {
    ...type.h1,
    fontSize: 24,
    lineHeight: 30,
    marginBottom: 12,
  },
  body: {
    ...type.body,
    fontSize: 15,
    lineHeight: 23,
    color: colors.text2,
  },
  noteBox: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  note: {
    ...type.small,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    gap: 12,
  },
  backHit: {
    minWidth: 74,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
  },
  backText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.text3,
  },
  nextWrap: {
    flex: 1,
    maxWidth: 230,
  },
  nextBtn: {
    width: '100%',
  },
  nextChevron: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
