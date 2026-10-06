/**
 * About tab — identity, credit and the root requirement.
 */
import React from 'react';
import {Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Card, SectionTitle} from '../components/ui';
import {colors, radii} from '../theme';

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
      <SectionTitle>About</SectionTitle>
      <Card style={styles.card}>
        <View style={styles.icon}>
          <Text style={styles.iconText}>⚡</Text>
        </View>
        <Text style={styles.title}>VOLTRIX</Text>
        <Text style={styles.version}>Version 1.0</Text>
        <Text style={styles.credit}>Crafted by a2z (Vnerxy)</Text>

        <Pressable
          accessibilityRole="link"
          onPress={openRepo}
          style={({pressed}) => [styles.link, pressed && styles.pressed]}>
          <Text style={styles.linkText}>{REPO_URL}</Text>
        </Pressable>

        <View style={styles.noteBox}>
          <Text style={styles.note}>
            Requires KernelSU or Magisk root. VOLTRIX applies charging profiles by
            writing kernel nodes through su — grant it in your root manager, then
            reopen the app.
          </Text>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 48,
  },
  card: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 22,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentGlow,
    shadowOpacity: 0.6,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 6},
    elevation: 5,
  },
  iconText: {
    fontSize: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 2,
    marginTop: 16,
  },
  version: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text3,
    marginTop: 4,
  },
  credit: {
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.gold,
    marginTop: 14,
  },
  link: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.surface3,
  },
  pressed: {
    opacity: 0.7,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  noteBox: {
    marginTop: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  note: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text2,
    textAlign: 'center',
  },
});
