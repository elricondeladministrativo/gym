import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

/**
 * Riel del ciclo: muestra todos los días y resalta el actual.
 * El orden refleja `day_template.orden`; el puntero solo avanza al completar.
 */
export default function CycleRail({ days = [], activeIndex = 0 }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {days.map((day, index) => {
        const active = index === activeIndex;
        return (
          <View
            key={day.id}
            style={[styles.pill, active && styles.pillActive]}
            accessibilityLabel={`Día ${index + 1}: ${day.nombre}${
              active ? ', día actual' : ''
            }`}
          >
            <Text style={[styles.index, active && styles.indexActive]}>
              {String(index + 1).padStart(2, '0')}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.name, active && styles.nameActive]}
            >
              {day.nombre}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
    paddingRight: 4,
  },
  pill: {
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  pillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  index: {
    fontFamily: fonts.displaySemi,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  indexActive: {
    color: 'rgba(13,13,13,0.65)',
  },
  name: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.textSecondary,
  },
  nameActive: {
    color: colors.textOnAccent,
  },
});
