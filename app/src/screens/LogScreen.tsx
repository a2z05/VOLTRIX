/**
 * Log tab — tail -100 of /data/adb/voltrix/daemon.log in a monospace box.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Button, SectionTitle} from '../components/ui';
import {errMsg, readLog} from '../native';
import {colors, font, radii} from '../theme';

export function LogScreen() {
  const [text, setText] = useState('Loading…');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setText(await readLog());
    } catch (e) {
      setText(`Error: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.wrap}>
      <SectionTitle>Daemon Log</SectionTitle>
      <View style={styles.box}>
        <ScrollView
          contentContainerStyle={styles.boxContent}
          showsVerticalScrollIndicator
          nestedScrollEnabled>
          <Text style={styles.logText}>{text}</Text>
        </ScrollView>
      </View>
      <Button
        label={loading ? 'Refreshing…' : '↻ Refresh'}
        variant="secondary"
        busy={loading}
        onPress={() => {
          load();
        }}
        style={styles.refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 48,
  },
  box: {
    flex: 1,
    minHeight: 240,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 14,
  },
  boxContent: {
    paddingBottom: 6,
  },
  logText: {
    fontFamily: font.mono,
    fontSize: 11,
    lineHeight: 19,
    color: colors.text2,
  },
  refresh: {
    marginTop: 12,
  },
});
