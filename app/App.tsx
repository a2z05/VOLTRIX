/**
 * VOLTRIX — root-aware charging control app.
 *
 * Responsibilities of this root component:
 *  - POST_NOTIFICATIONS runtime request (API 33+)
 *  - root probe via exec('id') + persistent banner on failure
 *  - first-run wizard gate (UI_WIZARD_DONE in config.sh; a failed config
 *    read also shows the wizard — it must never brick startup)
 *  - one-shot apply on mount, then state polling every 4s while foreground
 *  - settings/profile/log orchestration passed down to the screens
 *
 * Layout: animated app header on top, spring-entered screen content in the
 * middle, floating bottom tab bar with a sliding indicator, toast above it.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AppState,
  AppStateStatus,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {TabBar, TabDef} from './src/components/TabBar';
import {Toast} from './src/components/Toast';
import {BoltTile} from './src/components/icons';
import {Pill} from './src/components/ui';
import {FirstRunWizard} from './src/components/Wizard';
import {AboutScreen} from './src/screens/AboutScreen';
import {LogScreen} from './src/screens/LogScreen';
import {MonitorScreen, ProfileKey} from './src/screens/MonitorScreen';
import {SettingsScreen} from './src/screens/SettingsScreen';
import {chromeIn, screenIn} from './src/anim';
import {
  DEFAULT_SETTINGS,
  Settings,
  VoltrixState,
  cfgSet,
  checkRoot,
  errMsg,
  loadConfig,
  readState,
  runApplyScript,
  settingsFromConfig,
  writeSettings,
} from './src/native';
import {colors, space} from './src/theme';

const TABS: TabDef[] = [
  {key: 'monitor', label: 'Monitor'},
  {key: 'settings', label: 'Settings'},
  {key: 'log', label: 'Log'},
  {key: 'about', label: 'About'},
];

const POLL_MS = 4000;
const PROFILE_KEYS: ProfileKey[] = ['balanced', 'performance', 'battery_saver'];

const PROFILE_LABELS: Record<ProfileKey, string> = {
  balanced: 'Balanced',
  performance: 'Performance',
  battery_saver: 'Battery saver',
};

async function requestNotificationPermission(): Promise<void> {
  try {
    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0;
    if (Platform.OS === 'android' && apiLevel >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    }
  } catch (e) {
    console.warn('POST_NOTIFICATIONS request failed:', errMsg(e));
  }
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.fill}>
        <AppInner />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function AppInner() {
  const insets = useSafeAreaInsets();

  const [rootState, setRootState] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [state, setState] = useState<VoltrixState | null>(null);
  const [stateOffline, setStateOffline] = useState(false);
  const [profile, setProfile] = useState<ProfileKey>('performance');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [tab, setTab] = useState<string>('monitor');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const [, setTick] = useState(0);

  const settingsRef = useRef(settings);
  const profileOverrideRef = useRef<ProfileKey | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initedRef = useRef(false);

  useEffect(() => {
    settingsRef.current = settings;
  });

  // --- toast ---------------------------------------------------------------
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    [],
  );

  // --- state polling -------------------------------------------------------
  const refresh = useCallback(async () => {
    try {
      const s = await readState();
      if (s) {
        setState(s);
        setStateOffline(false);
        if (s.profile && !profileOverrideRef.current) {
          const p = s.profile;
          if (PROFILE_KEYS.some(k => k === p)) {
            setProfile(p as ProfileKey);
          }
        }
      } else {
        setStateOffline(true);
      }
    } catch (e) {
      setStateOffline(true);
      console.warn('state refresh failed:', errMsg(e));
    }
  }, []);

  // AppState.currentState is loosely typed (string | null | undefined) here,
  // so normalize it to a concrete status before storing it.
  const [appState, setAppState] = useState<AppStateStatus>(
    () => (AppState.currentState ?? 'active') as AppStateStatus,
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (rootState !== 'ok' || appState !== 'active') {
      return;
    }
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [rootState, appState, refresh]);

  // "Updated Xs ago" ticker — only ticks while a state with ts exists.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // --- apply / save --------------------------------------------------------
  const runApply = useCallback(
    async (opts?: {silent?: boolean}) => {
      setBusy(true);
      try {
        await runApplyScript();
        await refresh();
        if (!opts?.silent) {
          showToast('✓ Applied');
        }
      } catch (e) {
        showToast(`⚠ ${errMsg(e)}`);
      } finally {
        setBusy(false);
      }
    },
    [refresh, showToast],
  );

  const saveSettings = useCallback(async () => {
    setBusy(true);
    try {
      await writeSettings(settingsRef.current);
      await runApplyScript();
      await refresh();
      showToast('✓ Saved & applied');
    } catch (e) {
      showToast(`⚠ ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }, [refresh, showToast]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => ({...prev, ...patch}));
  }, []);

  const selectProfile = useCallback(
    async (p: ProfileKey) => {
      if (busy) {
        return;
      }
      profileOverrideRef.current = p;
      setProfile(p);
      setBusy(true);
      try {
        await cfgSet('PROFILE', p);
        await runApplyScript();
        await refresh();
        showToast(`Profile: ${PROFILE_LABELS[p]}`);
      } catch (e) {
        showToast(`⚠ ${errMsg(e)}`);
      } finally {
        profileOverrideRef.current = null;
        setBusy(false);
      }
    },
    [busy, refresh, showToast],
  );

  // --- boot: permission, root check, config load, wizard gate, apply -------
  useEffect(() => {
    if (initedRef.current) {
      return;
    }
    initedRef.current = true;

    (async () => {
      await requestNotificationPermission();
      const ok = await checkRoot();
      setRootState(ok ? 'ok' : 'denied');

      // Wizard gate: run even when root is missing — a failed config read
      // means we cannot know whether the user has seen onboarding, so show it.
      try {
        const cfg = await loadConfig();
        setSettings(settingsFromConfig(cfg));
        const p = cfg.PROFILE;
        if (p && PROFILE_KEYS.some(k => k === p)) {
          setProfile(p as ProfileKey);
        }
        setWizard(cfg.UI_WIZARD_DONE !== 'true');
      } catch (e) {
        console.warn('config load failed:', errMsg(e));
        setWizard(true);
      }

      if (!ok) {
        return;
      }
      await runApply({silent: true});
    })();
  }, [runApply]);

  // --- header subtitle -----------------------------------------------------
  const subtitle = useMemo(() => {
    if (!state?.ts) {
      return stateOffline ? 'Waiting for state — tap Apply now' : 'Reading state…';
    }
    const ago = Math.max(0, Math.floor(Date.now() / 1000) - state.ts);
    const m = Math.floor(ago / 60);
    return m > 0 ? `Updated ${m}m ago` : `Updated ${ago}s ago`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, stateOffline, toast, busy, tab]);

  const isCharging = (state?.status ?? '').toLowerCase() === 'charging';
  const live = rootState === 'ok' && !stateOffline && state != null;

  let screen: React.ReactNode;
  switch (tab) {
    case 'settings':
      screen = (
        <SettingsScreen
          settings={settings}
          onChange={updateSettings}
          onApply={() => {
            runApply();
          }}
          onSave={saveSettings}
          busy={busy}
        />
      );
      break;
    case 'log':
      screen = <LogScreen />;
      break;
    case 'about':
      screen = <AboutScreen />;
      break;
    default:
      screen = (
        <MonitorScreen
          state={state}
          profile={profile}
          busy={busy}
          onSelectProfile={selectProfile}
        />
      );
  }

  return (
    <View style={[styles.root, {paddingTop: insets.top}]}>
      {/* targetSdk 36 => edge-to-edge: the status bar is transparent and our
          root View paints #08090a behind it, so only barStyle is needed. */}
      <StatusBar barStyle="light-content" />

      {/* animated app header */}
      <Animated.View entering={chromeIn()} style={styles.header}>
        <BoltTile size={42} active={isCharging} />
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>VOLTRIX</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Pill
          text={live ? 'Live' : 'Idle'}
          tone={live ? 'ok' : 'default'}
          dot
        />
      </Animated.View>

      {rootState === 'denied' ? (
        <Animated.View entering={chromeIn(80)} style={styles.errorBanner}>
          <Text style={styles.errorText}>
            Root access required — grant VOLTRIX in KernelSU/Magisk, then reopen
          </Text>
        </Animated.View>
      ) : null}
      {rootState === 'ok' && stateOffline ? (
        <Animated.View entering={chromeIn(80)} style={styles.errorBanner}>
          <Text style={styles.errorText}>
            Module offline — state unreadable. Run “Apply now” in Settings.
          </Text>
        </Animated.View>
      ) : null}

      <View style={styles.content}>
        <Animated.View key={tab} entering={screenIn()} style={styles.fill}>
          {screen}
        </Animated.View>
      </View>

      <TabBar
        tabs={TABS}
        active={tab}
        onChange={setTab}
        bottomOffset={10 + insets.bottom}
      />

      <Toast message={toast} bottomOffset={86 + insets.bottom} />

      {wizard ? <FirstRunWizard onFinish={() => setWizard(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.gutter,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 3,
  },
  headerSub: {
    fontSize: 12.5,
    color: colors.text3,
    marginTop: 1,
    letterSpacing: -0.1,
  },
  errorBanner: {
    marginHorizontal: space.gutter,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: 10,
    backgroundColor: colors.redSoft,
    borderWidth: 1,
    borderColor: 'rgba(235,87,87,0.35)',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#f08a8a',
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  content: {
    flex: 1,
  },
});
