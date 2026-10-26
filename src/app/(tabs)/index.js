import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import Logo from '../../components/Logo';
import AppButton from '../../components/AppButton';
import CycleRail from '../../components/CycleRail';
import StatCard from '../../components/StatCard';
import {
  getCycleState,
  getMetricSnapshot,
  getSessionsByDate,
  markRestDay,
} from '../../db/queries';
import { calcIMC, formatDelta, formatNumber, imcCategory } from '../../utils/body';
import { capitalizeFirst, formatLongDate, todayISO } from '../../utils/date';
import { colors, fonts, radius } from '../../theme';

const IMC_TONES = {
  success: colors.success,
  steel: colors.steel,
  accent: colors.accent,
  danger: colors.danger,
  muted: colors.textMuted,
};

export default function HomeScreen() {
  const db = useSQLiteContext();
  const [cycleState, setCycleState] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restLoading, setRestLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [state, metricSnapshot, todaySessions] = await Promise.all([
        getCycleState(db),
        getMetricSnapshot(db),
        getSessionsByDate(db, todayISO()),
      ]);
      setCycleState(state);
      setSnapshot(metricSnapshot);
      setSessions(todaySessions);
    } catch (error) {
      console.error('No se pudo cargar el inicio:', error);
      Alert.alert('Error', 'No pudimos leer los datos locales.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const currentDay = cycleState?.currentDay ?? null;
  const latest = snapshot?.latest ?? null;
  const previous = snapshot?.previous ?? null;
  const imc = latest ? calcIMC(latest.peso, latest.estatura) : null;
  const imcInfo = imcCategory(imc);
  const weightDelta =
    latest?.peso != null && previous?.peso != null
      ? latest.peso - previous.peso
      : null;

  const hasCompletedToday = sessions.some(
    (session) => session.estado === 'completada'
  );
  const hasRestToday = sessions.some(
    (session) => session.estado === 'descanso'
  );

  const status = hasCompletedToday
    ? {
        label: 'Entrenado hoy',
        color: colors.success,
        background: colors.successSoft,
      }
    : hasRestToday
      ? {
          label: 'Descanso hoy',
          color: colors.steel,
          background: colors.restSoft,
        }
      : {
          label: 'Pendiente',
          color: colors.accent,
          background: colors.accentSoft,
        };

  const goToWorkout = () => {
    if (!currentDay) return;
    router.push({
      pathname: '/workout',
      params: { dayId: String(currentDay.id), dayName: currentDay.nombre },
    });
  };

  const confirmRest = () => {
    if (!currentDay || hasRestToday || hasCompletedToday) return;
    Alert.alert(
      'Marcar descanso',
      `¿Marcar "${currentDay.nombre}" como día de descanso?\n\nEl ciclo NO avanza: mañana vas a seguir con el mismo día.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, descansar',
          onPress: async () => {
            setRestLoading(true);
            try {
              await markRestDay(db, { dayTemplateId: currentDay.id });
              await load();
            } catch (error) {
              console.error('No se pudo marcar el descanso:', error);
              Alert.alert('Error', 'No se pudo guardar el descanso.');
            } finally {
              setRestLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading && !cycleState) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Logo size={72} />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <View style={styles.brandRow}>
          <View style={styles.brandLeft}>
            <Logo size={46} />
            <View>
              <Text style={styles.brand}>GYMAPP</Text>
              <Text style={styles.brandSub}>Entrenamiento y progreso</Text>
            </View>
          </View>
          <Pressable
            style={styles.logoBadge}
            onPress={() => router.push('/(tabs)/progress')}
            accessibilityRole="button"
            accessibilityLabel="Ir a progreso"
          >
            <Ionicons name="pulse" size={18} color={colors.steel} />
          </Pressable>
        </View>

        <Text style={styles.dateLabel}>
          {capitalizeFirst(formatLongDate())}
        </Text>

        {currentDay ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroGlow} />

              <View style={styles.heroTop}>
                <Text style={styles.eyebrow}>Día actual</Text>
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: status.background },
                  ]}
                >
                  <View
                    style={[styles.statusDot, { backgroundColor: status.color }]}
                  />
                  <Text style={[styles.statusText, { color: status.color }]}>
                    {status.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.dayName}>{currentDay.nombre}</Text>
              <Text style={styles.dayMeta}>
                {cycleState.cycle.nombre} · Día {cycleState.index + 1} de{' '}
                {cycleState.count}
              </Text>

              <Pressable
                onPress={() => router.push('/cycle')}
                style={styles.editCycleLink}
                accessibilityRole="button"
                accessibilityLabel="Editar ciclo"
              >
                <Ionicons
                  name="options-outline"
                  size={13}
                  color={colors.textMuted}
                />
                <Text style={styles.editCycleText}>Editar ciclo</Text>
              </Pressable>

              <View style={styles.rail}>
                <CycleRail
                  days={cycleState.days}
                  activeIndex={cycleState.index}
                />
              </View>

              <AppButton
                label="Empezar entrenamiento"
                icon="arrow-forward"
                onPress={goToWorkout}
                style={styles.primaryButton}
              />

              <AppButton
                label={
                  hasRestToday
                    ? 'Descanso registrado'
                    : hasCompletedToday
                      ? 'Sesión de hoy completada'
                      : 'Marcar descanso'
                }
                variant="secondary"
                icon="moon-outline"
                iconPosition="left"
                onPress={confirmRest}
                disabled={hasRestToday || hasCompletedToday}
                loading={restLoading}
                style={styles.secondaryButton}
              />

              {hasRestToday ? (
                <View style={styles.restNote}>
                  <Ionicons
                    name="information-circle-outline"
                    size={15}
                    color={colors.steel}
                  />
                  <Text style={styles.restNoteText}>
                    El descanso no avanza el ciclo: seguís en{' '}
                    {currentDay.nombre}.
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Resumen</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/progress')}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.sectionLink}>Ver progreso</Text>
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <StatCard
                label="Último peso"
                value={latest?.peso != null ? formatNumber(latest.peso) : '—'}
                unit="kg"
                icon="scale-outline"
                tone={colors.accent}
                hint={
                  weightDelta != null
                    ? `${formatDelta(weightDelta)} kg vs. medición anterior`
                    : 'Registrá tu peso para ver la tendencia'
                }
                hintTone={
                  weightDelta != null && weightDelta <= 0
                    ? colors.success
                    : colors.textMuted
                }
                onPress={() => router.push('/(tabs)/progress')}
              />
              <StatCard
                label="IMC"
                value={imc != null ? formatNumber(imc) : '—'}
                icon="body-outline"
                tone={IMC_TONES[imcInfo.tone]}
                hint={
                  latest
                    ? `${imcInfo.label} · ${formatNumber(
                        latest.estatura,
                        0
                      )} cm`
                    : 'Sin datos corporales'
                }
                hintTone={IMC_TONES[imcInfo.tone]}
                onPress={() => router.push('/(tabs)/progress')}
              />
            </View>

            {cycleState.count > 1 ? (
              <View style={styles.nextCard}>
                <View style={styles.nextIcon}>
                  <Ionicons
                    name="play-forward-outline"
                    size={18}
                    color={colors.steel}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextLabel}>Después sigue</Text>
                  <Text style={styles.nextName}>
                    {cycleState.nextDay?.nombre}
                  </Text>
                </View>
                <Text style={styles.nextHint}>Al completar hoy</Text>
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons
              name="alert-circle-outline"
              size={28}
              color={colors.accent}
            />
            <Text style={styles.emptyTitle}>No hay un ciclo activo</Text>
            <Text style={styles.emptyText}>
              Creá un ciclo con sus días para empezar a entrenar.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: 3,
    color: colors.text,
  },
  brandSub: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -2,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.steelSoft,
    borderWidth: 1,
    borderColor: colors.steelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabel: {
    marginTop: 20,
    marginBottom: 12,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'capitalize',
    color: colors.textMuted,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.accentSoft,
    top: -110,
    right: -70,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  dayName: {
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 58,
    color: colors.text,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  dayMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editCycleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingVertical: 3,
  },
  editCycleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textMuted,
  },
  rail: {
    marginTop: 16,
    marginBottom: 2,
  },
  primaryButton: {
    marginTop: 18,
  },
  secondaryButton: {
    marginTop: 10,
  },
  restNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  restNoteText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.steel,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 0.4,
  },
  sectionLink: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.accent,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 14,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.steelSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  nextName: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: colors.text,
    marginTop: 1,
  },
  nextHint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    maxWidth: 70,
    textAlign: 'right',
  },
  emptyCard: {
    marginTop: 24,
    padding: 24,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    color: colors.text,
    marginTop: 4,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
