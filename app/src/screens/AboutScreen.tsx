/**
 * About tab — identity, credit, repo link and the root requirement,
 * presented as a centered feature card with the bolt mark.
 */
import React from 'react';
import {Linking, ScrollView, StyleSheet, Text, View, ViewStyle} from 'react-native';
import Animated from 'react-native-reanimated';
import {Card, PressableScale, SectionTitle} from '../components/ui';
import {BoltIcon} from '../components/icons';
import {bentoIn} from '../anim';
import {colors, radii, space} from '../theme';

const REPO_URL = 'https://github.com/a2z05/VOLTRIX';

export function AboutScreen() {
  const openRepo = () => {
    Linking.openURL(REPO_URL).catch(() => {
      /* leave it silent — nothing to show in a static about screen */
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Animated.View entering={bentoIn(0)}>
        <SectionTitle>About</SectionTitle>
        <Card style={styles.card}>
          <View style={styles.orbit}>
            <View style={styles.icon}>
              <BoltIcon color="#ffffff" size={24} />
            </View>
          </View>
          <Text style={styles.title}>VOLTRIX</Text>
          <Text style={styles.version}>Version 1.0.10</Text>
          <Text style={styles.credit}>Crafted by a2z (Vnerxy)</Text>

          <PressableScale
            accessibilityRole="link"
            onPress={openRepo}
            style={styles.link}>
            <Text style={styles.linkText}>{REPO_URL}</Text>
          </PressableScale>
        </Card>
      </Animated.View>

      <Animated.View entering={bentoIn(1)} style={styles.section}>
        <SectionTitle>Requirements</SectionTitle>
        <Card style={styles.noteCard}>
          <Text style={styles.note}>
            Requires KernelSU or Magisk root. VOLTRIX applies charging profiles by
            writing kernel nodes through su — grant it in your root manager, then
            reopen the app.
          </Text>
        </Card>
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
  card: {
    alignItems: 'center',
    paddingVertical: 34,
    paddingHorizontal: space.xl,
  },
  orbit: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: 'rgba(113,112,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSofter,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...({
      shadowColor: '#7170ff',
      shadowOpacity: 0.55,
      shadowRadius: 18,
      shadowOffset: {width: 0, height: 6},
      elevation: 6,
    } as ViewStyle),
  },
  title: {
    fontSize: 25,
    fontWeight: '600',
    color: colors.text,
    letterSpacing: 4,
    marginTop: 20,
  },
  version: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text4,
    letterSpacing: 0.6,
    marginTop: 6,
  },
  credit: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accentHover,
    marginTop: 16,
    letterSpacing: -0.1,
  },
  link: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.text2,
  },
  section: {
    marginTop: space.xl,
  },
  noteCard: {
    padding: space.lg,
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text3,
    letterSpacing: -0.1,
  },
});
