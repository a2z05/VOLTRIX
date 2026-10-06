/**
 * Segmented tab bar (old web .tabs): pill container, active segment on
 * surface3.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors, radii} from '../theme';

export interface TabDef {
  key: string;
  label: string;
}

export function SegmentedTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.bar}>
      {tabs.map(tab => {
        const on = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{selected: on}}
            onPress={() => onChange(tab.key)}
            style={({pressed}) => [styles.tab, on && styles.tabOn, pressed && styles.pressed]}>
            <Text style={[styles.label, on && styles.labelOn]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 2,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 3,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: {
    backgroundColor: colors.surface3,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text2,
  },
  labelOn: {
    color: colors.text,
  },
});
