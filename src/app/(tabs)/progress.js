import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';

import StatCard from '../../components/StatCard';
import { getMetricSnapshot, getWeightSeries } from '../../db/queries';
import {
  calcIMC,
  formatDelta,
  formatNumber,
  imcCategory,
} from '../../utils/body';
import { formatChartDate, formatShortDate } from '../../utils/date';
import { colors, fonts, radius } from '../../theme';

const PERIODS = [
  { key: 'week', label: 'Semana', days: 7 },
  { key: 'month', label: 'Mes', days: 30 },
  { key: 'year', label: 'Año', days: 365 },
];

const TONES = {
  success: colors.success,
  steel: colors.steel,
  accent: colors.accent,
  danger: colors.danger,
  muted: colors.textMuted,
};

export default function ProgressScreen() {
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState('month');
  const [series, setSeries] = useState([]);
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const activePeriod = PERIODS.find((item) => item.key === period) ?? PERIODS[1];

  const load = useCallback(
    async (days = activePeriod.days) => {
      try {
        const [weightSeries, metricSnapshot] = await Promise.all([
          getWeightSeries(db, days),
          getMetricSnapshot(db),
        ]);
        setSeries(weightSeries);
        setSnapshot(metricSnapshot);
      } catch (error) {
        console.error('No se pudo cargar el progreso:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [db, activePeriod.days]
  );

  useFocusEffect(
    useCallback(() => {
      load(activePeriod.days);
    }, [load, activePeriod.days])
  );

  const selectPeriod = (key) => {
    if (key === period) return;
    setPeriod(key);
    const next = PERIODS.find((item) => item.key === key);
    setLoading(true);
    load(next.days);
  };

  const latest = snapshot?.latest ?? null;
  const previous = snapshot?.previous ?? null;
  const imc = latest ? calcIMC(latest.peso, latest.estatura) : null;
  const imcInfo = imcCategory(imc);
  const weightDelta =
    latest?.peso != null && previous?.peso != null
      ? latest.peso - previous.peso
      : null;

  const chartWidth = Math.max(280, width - 76);
  const chartData = {
    labels: series.map((item) => formatChartDate(item.fecha)),
    datasets: [
      {
        data: series.map((item) => Number(item.peso)),
        color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

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
              load(activePeriod.days);
            }}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Progreso</Text>
            <Text style={styles.subtitle}>
              Tu evolución corporal, sin conexión.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/measurement-new')}
            style={styles.newMeasurementButton}
            accessibilityRole="button"
            accessibilityLabel="Nueva medición"
          >
            <Ionicons name="add" size={18} color={colors.textOnAccent} />
            <Text style={styles.newMeasurementText}>Medición</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <Text style={styles.eyebrow}>Peso actual</Text>
            {latest ? (
              <Text style={styles.date}>
                {formatShortDate(latest.fecha)}
              </Text>
            ) : null}
          </View>

          <View style={styles.weightRow}>
            <Text style={styles.weightValue}>
              {latest?.peso != null ? formatNumber(latest.peso) : '—'}
            </Text>
            <Text style={styles.weightUnit}>kg</Text>
          </View>

          <View style={styles.heroBadges}>
            <View style={styles.imcBadge}>
              <Text style={styles.imcLabel}>IMC</Text>
              <Text style={[styles.imcValue, { color: TONES[imcInfo.tone] }]}>
                {imc != null ? formatNumber(imc) : '—'}
              </Text>
              <Text style={[styles.imcCategory, { color: TONES[imcInfo.tone] }]}>
                {imcInfo.label}
              </Text>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroSide}>
              <Text style={styles.sideLabel}>Variación</Text>
              <Text
                style={[
                  styles.sideValue,
                  {
                    color:
                      weightDelta == null
                        ? colors.textMuted
                        : weightDelta <= 0
                          ? colors.success
                          : colors.accent,
                  },
                ]}
              >
                {weightDelta != null
                  ? `${formatDelta(weightDelta)} kg`
                  : '—'}
              </Text>
              <Text style={styles.sideHint}>vs. medición anterior</Text>
            </View>
          </View>

          <View style={styles.heroFooter}>
            <View style={styles.footerItem}>
              <Ionicons name="resize-outline" size={13} color={colors.steel} />
              <Text style={styles.footerText}>
                {latest?.estatura != null
                  ? `${formatNumber(latest.estatura, 0)} cm`
                  : 'Sin estatura'}
              </Text>
            </View>
            <View style={styles.footerDivider} />
            <View style={styles.footerItem}>
              <Ionicons name="water-outline" size={13} color={colors.steel} />
              <Text style={styles.footerText}>
                {latest?.grasa_corporal != null
                  ? `${formatNumber(latest.grasa_corporal)} % grasa`
                  : 'Sin % grasa'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.periodRow}>
          {PERIODS.map((item) => {
            const active = item.key === period;
            return (
              <Text
                key={item.key}
                onPress={() => selectPeriod(item.key)}
                style={[styles.periodPill, active && styles.periodPillActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                {item.label}
              </Text>
            );
          })}
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Evolución del peso</Text>
              <Text style={styles.chartSub}>
                {activePeriod.label} · {series.length}{' '}
                {series.length === 1 ? 'registro' : 'registros'}
              </Text>
            </View>
            <Ionicons name="trending-down" size={18} color={colors.accent} />
          </View>

          {loading ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : series.length >= 2 ? (
            <LineChart
              data={chartData}
              width={chartWidth}
              height={205}
              chartConfig={{
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                labelColor: () => colors.textMuted,
                propsForDots: {
                  r: '3.5',
                  strokeWidth: '2',
                  stroke: colors.surface,
                  fill: colors.accent,
                },
                propsForBackgroundLines: {
                  stroke: colors.border,
                  strokeDasharray: '',
                  strokeWidth: 1,
                },
                fillShadowGradientFrom: colors.accent,
                fillShadowGradientTo: colors.surface,
                fillShadowGradientFromOpacity: 0.26,
                fillShadowGradientToOpacity: 0,
              }}
              bezier
              fromZero={false}
              withInnerLines
              withOuterLines={false}
              withVerticalLines={false}
              yAxisLabel=""
              yAxisSuffix=""
              segments={4}
              formatYLabel={(value) => formatNumber(Number(value), 1)}
              style={styles.chart}
            />
          ) : (
            <View style={styles.chartEmpty}>
              <Ionicons
                name="analytics-outline"
                size={26}
                color={colors.steel}
              />
              <Text style={styles.chartEmptyText}>
                Necesitás al menos dos mediciones en este período para ver la
                tendencia.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Medidas</Text>
          <Text style={styles.sectionHint}>vs. medición anterior</Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard
            label="Cintura"
            value={
              snapshot?.metrics?.find((m) => m.nombre === 'Cintura')?.valor !=
              null
                ? formatNumber(
                    snapshot.metrics.find((m) => m.nombre === 'Cintura').valor
                  )
                : '—'
            }
            unit="cm"
            icon="contract-outline"
            tone={colors.steel}
            hint={metricHint(snapshot, 'Cintura')}
          />
          <StatCard
            label="Pecho"
            value={
              snapshot?.metrics?.find((m) => m.nombre === 'Pecho')?.valor != null
                ? formatNumber(
                    snapshot.metrics.find((m) => m.nombre === 'Pecho').valor
                  )
                : '—'
            }
            unit="cm"
            icon="fitness-outline"
            tone={colors.accent}
            hint={metricHint(snapshot, 'Pecho')}
          />
        </View>

        <View style={[styles.statsRow, { marginTop: 12 }]}>
          <StatCard
            label="Brazo"
            value={
              snapshot?.metrics?.find((m) => m.nombre === 'Brazo')?.valor != null
                ? formatNumber(
                    snapshot.metrics.find((m) => m.nombre === 'Brazo').valor
                  )
                : '—'
            }
            unit="cm"
            icon="barbell-outline"
            tone={colors.accent}
            hint={metricHint(snapshot, 'Brazo')}
          />
          <StatCard
            label="Muslo"
            value={
              snapshot?.metrics?.find((m) => m.nombre === 'Muslo')?.valor != null
                ? formatNumber(
                    snapshot.metrics.find((m) => m.nombre === 'Muslo').valor
                  )
                : '—'
            }
            unit="cm"
            icon="walk-outline"
            tone={colors.steel}
            hint={metricHint(snapshot, 'Muslo')}
          />
        </View>

        <Text style={styles.footnote}>
          IMC = peso / estatura². Los datos se guardan solo en este
          dispositivo.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function metricHint(snapshot, name) {
  const metric = snapshot?.metrics?.find((item) => item.nombre === name);
  if (!metric) return 'Sin registro';
  if (metric.delta == null) return 'Primera medición';
  return `${formatDelta(metric.delta)} ${metric.unidad}`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  newMeasurementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  newMeasurementText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.textOnAccent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 42,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
    marginBottom: 18,
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
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.accentSoft,
    top: -100,
    right: -50,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  date: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginTop: 2,
  },
  weightValue: {
    fontFamily: fonts.display,
    fontSize: 62,
    lineHeight: 66,
    color: colors.text,
  },
  weightUnit: {
    fontFamily: fonts.displaySemi,
    fontSize: 20,
    color: colors.accent,
    marginBottom: 10,
  },
  heroBadges: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 8,
    padding: 13,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imcBadge: {
    flex: 1,
  },
  imcLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  imcValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    marginTop: 1,
  },
  imcCategory: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
  },
  heroDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  heroSide: {
    flex: 1.25,
  },
  sideLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  sideValue: {
    fontFamily: fonts.displaySemi,
    fontSize: 20,
    marginTop: 2,
  },
  sideHint: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
  },
  footerDivider: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  periodPill: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  periodPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    color: colors.textOnAccent,
    fontFamily: fonts.bodySemi,
  },
  chartCard: {
    marginTop: 14,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  chartTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.text,
  },
  chartSub: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  chart: {
    marginLeft: -10,
    borderRadius: radius.md,
  },
  chartLoading: {
    height: 205,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmpty: {
    height: 205,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    gap: 10,
  },
  chartEmptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
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
  sectionHint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: 22,
    textAlign: 'center',
  },
});
