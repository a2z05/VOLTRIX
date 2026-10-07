/**
 * Log tab — tail -100 of /data/adb/voltrix/daemon.log in a monospace card,
 * with a copy-to-clipboard action and a refresh that reports its own state.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {Clipboard, ScrollView, StyleSheet, Text, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {Button, PressableScale, SectionTitle} from '../components/ui';
import {CopyIcon} from '../components/icons';
import {errMsg, readLog} from '../native';
import {bentoIn} from '../anim';
import {colors, font, radii, space} from '../theme';

export function LogScreen() {
  const [text, setText] = useState('Loading…');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // quiet=true keeps the button idle — used by the live auto-refresh so the
  // log keeps itself current without anyone tapping Refresh.
  const load = useCallback(async (quiet?: boolean) => {
    if (!quiet) {
      setLoading(true);
    }
    try {
      setText(await readLog());
    } catch (e) {
      setText(`Error: ${errMsg(e)}`);
    } finally {
      if (!quiet) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      load(true);
    }, 5000);
    return () => {
      clearInterval(id);
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    };
  }, [load]);

  const copy = useCallback(() => {
    try {
      Clipboard.setString(text);
      setCopied(true);
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard can be unavailable — stay silent */
    }
  }, [text]);

  return (
    <View style={styles.wrap}>
      <Animated.View entering={bentoIn(0)} style={styles.headerRow}>
        <SectionTitle hint="Live — last 100 lines">Daemon log</SectionTitle>
        <PressableScale
          accessibilityRole="button"
          onPress={copy}
          containerStyle={styles.copyHit}
          style={[styles.copyBtn, copied && styles.copyBtnOn]}>
          {copied ? null : <CopyIcon color={colors.text2} size={13} />}
          <Text style={[styles.copyText, copied && styles.copyTextOn]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </PressableScale>
      </Animated.View>

      <Animated.View entering={bentoIn(1)} style={styles.box}>
        <ScrollView
          contentContainerStyle={styles.boxContent}
          showsVerticalScrollIndicator
          nestedScrollEnabled>
          <Text style={styles.logText}>{text}</Text>
        </ScrollView>
      </Animated.View>

      <Animated.View entering={bentoIn(2)} style={styles.refresh}>
        <Button
          label={loading ? 'Refreshing…' : 'Refresh'}
          variant="secondary"
          busy={loading}
          onPress={() => {
            load();
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: space.gutter,
    paddingTop: space.xs,
    paddingBottom: 130,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  copyHit: {
    marginBottom: space.sm,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  copyBtnOn: {
    borderColor: 'rgba(39,166,68,0.5)',
    backgroundColor: colors.greenSoft,
  },
  copyText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.text2,
  },
  copyTextOn: {
    color: colors.emerald,
  },
  box: {
    flex: 1,
    minHeight: 240,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: space.md,
  },
  boxContent: {
    paddingBottom: 6,
  },
  logText: {
    fontFamily: font.mono,
    fontSize: 11,
    lineHeight: 18,
    color: colors.text3,
  },
  refresh: {
    marginTop: space.md,
  },
});
