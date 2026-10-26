import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import { getSessionSets, getSessionsByMonth } from '../../db/queries';
import {
  capitalizeFirst,
  formatLongDate,
  parseISODate,
  toISODate,
  todayISO,
} from '../../utils/date';
import { colors, fonts, radius } from '../../theme';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const MONTH_FORMATTER = new Intl.DateTimeFormat('es-AR', {
  month: 'long',
  year: 'numeric',
});

const VOLUME_FORMATTER = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
});

function monthLabel(date) {
  const label = MONTH_FORMATTER.format(date);
  return capitalizeFirst(label);
}

function buildCalendar(year, month) {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function groupSets(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.exerciseId)) {
      groups.set(row.exerciseId, { exerciseId: row.exerciseId, name: row.nombre, sets: [] });
    }
    groups.get(row.exerciseId).sets.push(row);
  }
  return Array.from(groups.values());
}

export default function HistoryScreen() {
  const db = useSQLiteContext();
  const now = new Date();

  const [monthDate, setMonthDate] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [setsBySession, setSetsBySession] = useState({});

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const load = useCallback(async () => {
    try {
      const rows = await getSessionsByMonth(db, year, month);
      setSessions(rows);
    } catch (error) {
      console.error('No se pudo cargar el historial:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, year, month]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const changeMonth = (offset) => {
    const next = new Date(year, month + offset, 1);
    setMonthDate(next);
    setSelectedDate(toISODate(next));
    setExpandedId(null);
    setLoading(true);
  };

  const toggleSession = async (session) => {
    if (expandedId === session.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(session.id);
    if (setsBySession[session.id]) return;

    try {
      const rows = await getSessionSets(db, session.id);
      setSetsBySession((prev) => ({ ...prev, [session.id]: rows }));
    } catch (error) {
      console.error('No se pudieron leer las series:', error);
    }
  };

  const sessionsByDate = new Map();
  for (const session of sessions) {
    if (!sessionsByDate.has(session.fecha)) {
      sessionsByDate.set(session.fecha, []);
    }
    sessionsByDate.get(session.fecha).push(session);
  }

  const completed = sessions.filter((item) => item.estado === 'completada');
  const rests = sessions.filter((item) => item.estado === 'descanso');
  const totalVolume = completed.reduce(
    (total, item) => total + Number(item.volumen || 0),
    0
  );
  const totalSeries = completed.reduce(
    (total, item) => total + Number(item.series || 0),
    0
  );

  const cells = buildCalendar(year, month);
  const today = todayISO();
  const selectedSessions = sessionsByDate.get(selectedDate) ?? [];

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
        <Text style={styles.title}>Historial</Text>
        <Text style={styles.subtitle}>
          Tus sesiones, ordenadas por día.
        </Text>

        <View style={styles.monthRow}>
          <Pressable
            onPress={() => changeMonth(-1)}
            style={styles.monthButton}
            accessibilityRole="button"
            accessibilityLabel="Mes anterior"
          >
            <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel(monthDate)}</Text>
          <Pressable
            onPress={() => changeMonth(1)}
            style={styles.monthButton}
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{completed.length}</Text>
            <Text style={styles.summaryLabel}>Sesiones</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.steel }]}>
              {rests.length}
            </Text>
            <Text style={styles.summaryLabel}>Descansos</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>
              {VOLUME_FORMATTER.format(totalVolume)}
            </Text>
            <Text style={styles.summaryLabel}>kg volumen</Text>
          </View>
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((day) => (
              <Text key={day} style={styles.weekDay}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, index) => {
              if (day == null) {
                return <View key={`empty-${index}`} style={styles.cell} />;
              }

              const iso = toISODate(new Date(year, month, day));
              const daySessions = sessionsByDate.get(iso) ?? [];
              const hasCompleted = daySessions.some(
                (item) => item.estado === 'completada'
              );
              const hasRest = daySessions.some(
                (item) => item.estado === 'descanso'
              );
              const selected = iso === selectedDate;
              const isToday = iso === today;

              return (
                <Pressable
                  key={iso}
                  onPress={() => {
                    setSelectedDate(iso);
                    setExpandedId(null);
                  }}
                  style={styles.cell}
                  accessibilityRole="button"
                  accessibilityLabel={`${day} de ${monthLabel(monthDate)}${
                    daySessions.length ? ', con registros' : ''
                  }`}
                  accessibilityState={{ selected }}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isToday && styles.dayCircleToday,
                      selected && styles.dayCircleSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        isToday && styles.dayNumberToday,
                        selected && styles.dayNumberSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                  <View style={styles.dotsRow}>
                    {hasCompleted ? (
                      <View style={[styles.dot, { backgroundColor: colors.accent }]} />
                    ) : null}
                    {hasRest ? (
                      <View style={[styles.dot, { backgroundColor: colors.steel }]} />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={styles.legendText}>Entrenamiento</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.steel }]} />
              <Text style={styles.legendText}>Descanso</Text>
            </View>
            <Text style={styles.legendSeries}>{totalSeries} series en el mes</Text>
          </View>
        </View>

        <View style={styles.selectedHeader}>
          <Text style={styles.selectedTitle}>
            {capitalizeFirst(formatLongDate(parseISODate(selectedDate)))}
          </Text>
          {selectedDate === today ? (
            <View style={styles.todayChip}>
              <Text style={styles.todayChipText}>Hoy</Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : selectedSessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="calendar-clear-outline"
              size={26}
              color={colors.textMuted}
            />
            <Text style={styles.emptyText}>
              No hay sesiones registradas este día.
            </Text>
          </View>
        ) : (
          <View style={styles.sessionList}>
            {selectedSessions.map((session) => {
              const isCompleted = session.estado === 'completada';
              const expanded = expandedId === session.id;
              const sets = setsBySession[session.id];
              const groups = sets ? groupSets(sets) : [];

              return (
                <View key={session.id} style={styles.sessionCard}>
                  <Pressable
                    onPress={() => toggleSession(session)}
                    style={styles.sessionHeader}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={`${session.dia ?? 'Sesión'}, ${
                      isCompleted ? 'completada' : 'descanso'
                    }`}
                  >
                    <View
                      style={[
                        styles.sessionIcon,
                        {
                          backgroundColor: isCompleted
                            ? colors.accentSoft
                            : colors.restSoft,
                        },
                      ]}
                    >
                      <Ionicons
                        name={isCompleted ? 'barbell' : 'moon'}
                        size={18}
                        color={isCompleted ? colors.accent : colors.steel}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionName}>
                        {session.dia ?? 'Día eliminado'}
                      </Text>
                      <View style={styles.sessionMetaRow}>
                        <Text
                          style={[
                            styles.sessionStatus,
                            {
                              color: isCompleted
                                ? colors.accent
                                : colors.steel,
                            },
                          ]}
                        >
                          {isCompleted ? 'Completado' : 'Descanso'}
                        </Text>
                        {isCompleted ? (
                          <>
                            <View style={styles.metaDot} />
                            <Text style={styles.sessionMeta}>
                              {session.series}{' '}
                              {Number(session.series) === 1 ? 'serie' : 'series'}
                            </Text>
                            <View style={styles.metaDot} />
                            <Text style={styles.sessionMeta}>
                              {VOLUME_FORMATTER.format(
                                Number(session.volumen || 0)
                              )}{' '}
                              kg
                            </Text>
                          </>
                        ) : null}
                      </View>
                    </View>

                    {isCompleted ? (
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={17}
                        color={colors.textMuted}
                      />
                    ) : null}
                  </Pressable>

                  {expanded && isCompleted ? (
                    <View style={styles.sessionBody}>
                      {!sets ? (
                        <ActivityIndicator
                          color={colors.accent}
                          style={{ marginVertical: 12 }}
                        />
                      ) : groups.length === 0 ? (
                        <Text style={styles.sessionEmpty}>
                          Esta sesión no tiene series guardadas.
                        </Text>
                      ) : (
                        groups.map((group) => (
                          <View key={group.exerciseId} style={styles.groupRow}>
                            <Text style={styles.groupName} numberOfLines={1}>
                              {group.name}
                            </Text>
                            <View style={styles.setsWrap}>
                              {group.sets.map((set) => (
                                <View
                                  key={`${group.exerciseId}-${set.numeroSerie}`}
                                  style={styles.setChip}
                                >
                                  <Text style={styles.setChipText}>
                                    {set.peso != null
                                      ? String(set.peso).replace('.', ',')
                                      : '—'}{' '}
                                    kg × {set.repeticiones ?? '—'}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.footnote}>
          El descanso queda registrado pero no avanza el ciclo ni cuenta como
          sesión de entrenamiento.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
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
    marginBottom: 16,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontFamily: fonts.displaySemi,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 0.3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.border,
  },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.text,
  },
  summaryLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  calendarCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 3,
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleToday: {
    borderWidth: 1,
    borderColor: colors.steel,
  },
  dayCircleSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dayNumber: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.textSecondary,
  },
  dayNumberToday: {
    color: colors.steel,
  },
  dayNumberSelected: {
    color: colors.textOnAccent,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  legendSeries: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
    marginBottom: 10,
  },
  selectedTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 19,
    color: colors.text,
    letterSpacing: 0.3,
  },
  todayChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  todayChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.accent,
  },
  sessionList: {
    gap: 10,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
  },
  sessionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionName: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.text,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  sessionStatus: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionMeta: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sessionBody: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 13,
    gap: 10,
  },
  groupRow: {
    gap: 6,
  },
  groupName: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  setsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setChipText: {
    fontFamily: fonts.displaySemi,
    fontSize: 12,
    color: colors.text,
  },
  sessionEmpty: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyCard: {
    padding: 24,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 10,
  },
});
