import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../components/AppButton';
import ExerciseDetailModal from '../components/ExerciseDetailModal';
import { completeWorkout, getDayExercises } from '../db/queries';
import { todayISO } from '../utils/date';
import { colors, fonts, radius } from '../theme';

let setKeySeed = 0;
function createSet() {
  setKeySeed += 1;
  return { key: `set-${setKeySeed}`, peso: '', reps: '' };
}

function parseDecimal(value) {
  if (typeof value !== 'string') return NaN;
  return Number.parseFloat(value.replace(',', '.'));
}

export default function WorkoutScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const { dayId, dayName } = useLocalSearchParams();
  const numericDayId = Number(dayId);

  const [exercises, setExercises] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [detailExercise, setDetailExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  const loadExercises = useCallback(async () => {
    if (!numericDayId) {
      setLoading(false);
      return;
    }
    try {
      const rows = await getDayExercises(db, numericDayId);
      const withSets = rows.map((row, index) => ({
        ...row,
        sets: [createSet()],
      }));
      setExercises(withSets);
      if (withSets.length > 0) {
        setExpanded({ [withSets[0].dayExerciseId]: true });
      }
    } catch (error) {
      console.error('No se pudieron cargar los ejercicios:', error);
      Alert.alert('Error', 'No pudimos cargar los ejercicios del día.');
    } finally {
      setLoading(false);
    }
  }, [db, numericDayId]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadExercises();
  }, [loadExercises]);

  const toggle = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const addSet = (exerciseId) => {
    setExercises((prev) =>
      prev.map((exercise) =>
        exercise.dayExerciseId === exerciseId
          ? { ...exercise, sets: [...exercise.sets, createSet()] }
          : exercise
      )
    );
  };

  const removeSet = (exerciseId, setKey) => {
    setExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.dayExerciseId !== exerciseId) return exercise;
        if (exercise.sets.length <= 1) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.filter((item) => item.key !== setKey),
        };
      })
    );
  };

  const updateSet = (exerciseId, setKey, field, value) => {
    setExercises((prev) =>
      prev.map((exercise) => {
        if (exercise.dayExerciseId !== exerciseId) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((item) =>
            item.key === setKey ? { ...item, [field]: value } : item
          ),
        };
      })
    );
  };

  const validSetsPerExercise = exercises.map((exercise) => {
    const valid = exercise.sets
      .map((item) => ({
        peso: parseDecimal(item.peso),
        repeticiones: Number.parseInt(item.reps, 10),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.peso) &&
          item.peso > 0 &&
          Number.isFinite(item.repeticiones) &&
          item.repeticiones > 0
      );
    return { exercise, valid };
  });

  const totalValidSets = validSetsPerExercise.reduce(
    (total, item) => total + item.valid.length,
    0
  );
  const trainedExercises = validSetsPerExercise.filter(
    (item) => item.valid.length > 0
  ).length;

  const handleFinish = () => {
    if (totalValidSets === 0) {
      Alert.alert(
        'Faltan datos',
        'Cargá al menos una serie con peso y repeticiones mayores a cero.'
      );
      return;
    }

    Alert.alert(
      'Finalizar entrenamiento',
      `Vas a guardar ${totalValidSets} ${
        totalValidSets === 1 ? 'serie' : 'series'
      } de ${trainedExercises} ${
        trainedExercises === 1 ? 'ejercicio' : 'ejercicios'
      }.\n\nAl confirmar, la sesión se marca como completada y el ciclo avanza al siguiente día.`,
      [
        { text: 'Seguir entrenando', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            setSaving(true);
            try {
              const sets = [];
              for (const { exercise, valid } of validSetsPerExercise) {
                valid.forEach((item, index) => {
                  sets.push({
                    exerciseId: exercise.exerciseId,
                    numeroSerie: index + 1,
                    peso: item.peso,
                    repeticiones: item.repeticiones,
                  });
                });
              }
              await completeWorkout(db, {
                dayTemplateId: numericDayId,
                sets,
                fecha: todayISO(),
              });
              router.back();
            } catch (error) {
              console.error('No se pudo guardar la sesión:', error);
              Alert.alert(
                'Error',
                error?.message || 'No se pudo guardar el entrenamiento.'
              );
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: dayName || 'Entrenamiento' }} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: dayName || 'Entrenamiento' }} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={88}
        >
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: 150 + insets.bottom },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerCard}>
              <Text style={styles.eyebrow}>Sesión en curso</Text>
              <Text style={styles.title}>{dayName || 'Entrenamiento'}</Text>
              <View style={styles.headerMeta}>
                <View style={styles.metaItem}>
                  <Ionicons
                    name="barbell-outline"
                    size={14}
                    color={colors.steel}
                  />
                  <Text style={styles.metaText}>
                    {exercises.length}{' '}
                    {exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
                  </Text>
                </View>
                <View style={styles.metaDivider} />
                <View style={styles.metaItem}>
                  <Ionicons
                    name="layers-outline"
                    size={14}
                    color={colors.steel}
                  />
                  <Text style={styles.metaText}>
                    {totalValidSets}{' '}
                    {totalValidSets === 1 ? 'serie válida' : 'series válidas'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.hintRow}>
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={colors.textMuted}
              />
              <Text style={styles.hintText}>
                Cargá peso y repeticiones en cada serie. Las series vacías se
                ignoran al finalizar.
              </Text>
            </View>

            {exercises.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons
                  name="albums-outline"
                  size={28}
                  color={colors.accent}
                />
                <Text style={styles.emptyTitle}>
                  Este día no tiene ejercicios
                </Text>
                <Text style={styles.emptyText}>
                  Asigná ejercicios desde el editor de ciclo para poder
                  entrenar.
                </Text>
              </View>
            ) : (
              exercises.map((exercise, index) => {
                const isOpen = !!expanded[exercise.dayExerciseId];
                return (
                  <View key={exercise.dayExerciseId} style={styles.exerciseCard}>
                    <Pressable
                      onPress={() => toggle(exercise.dayExerciseId)}
                      style={styles.exerciseHeader}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                    >
                      <View style={styles.indexBadge}>
                        <Text style={styles.indexText}>
                          {String(index + 1).padStart(2, '0')}
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.exerciseName} numberOfLines={1}>
                          {exercise.nombre}
                        </Text>
                        <Text style={styles.exerciseGroup}>
                          {exercise.grupoMuscular || 'General'} ·{' '}
                          {exercise.sets.length}{' '}
                          {exercise.sets.length === 1 ? 'serie' : 'series'}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => setDetailExercise(exercise)}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver instrucciones de ${exercise.nombre}`}
                        style={styles.infoButton}
                      >
                        <Ionicons
                          name="help-circle-outline"
                          size={20}
                          color={colors.textSecondary}
                        />
                      </Pressable>

                      <Ionicons
                        name={isOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.textMuted}
                      />
                    </Pressable>

                    {isOpen ? (
                      <View style={styles.exerciseBody}>
                        <View style={styles.columnHeader}>
                          <Text style={[styles.columnLabel, styles.serieCol]}>
                            Serie
                          </Text>
                          <Text style={styles.columnLabel}>Peso (kg)</Text>
                          <Text style={styles.columnLabel}>Reps</Text>
                          <View style={{ width: 28 }} />
                        </View>

                        {exercise.sets.map((set, setIndex) => (
                          <View key={set.key} style={styles.setRow}>
                            <View style={styles.serieChip}>
                              <Text style={styles.serieChipText}>
                                {setIndex + 1}
                              </Text>
                            </View>

                            <View style={styles.inputWrap}>
                              <TextInput
                                value={set.peso}
                                onChangeText={(value) =>
                                  updateSet(
                                    exercise.dayExerciseId,
                                    set.key,
                                    'peso',
                                    value
                                  )
                                }
                                keyboardType="decimal-pad"
                                placeholder="0"
                                placeholderTextColor={colors.textMuted}
                                style={styles.input}
                                maxLength={6}
                                accessibilityLabel={`Peso serie ${
                                  setIndex + 1
                                } de ${exercise.nombre}`}
                              />
                              <Text style={styles.inputUnit}>kg</Text>
                            </View>

                            <TextInput
                              value={set.reps}
                              onChangeText={(value) =>
                                updateSet(
                                  exercise.dayExerciseId,
                                  set.key,
                                  'reps',
                                  value
                                )
                              }
                              keyboardType="number-pad"
                              placeholder="0"
                              placeholderTextColor={colors.textMuted}
                              style={[styles.input, styles.repsInput]}
                              maxLength={3}
                              accessibilityLabel={`Repeticiones serie ${
                                setIndex + 1
                              } de ${exercise.nombre}`}
                            />

                            <Pressable
                              onPress={() =>
                                removeSet(exercise.dayExerciseId, set.key)
                              }
                              disabled={exercise.sets.length <= 1}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`Eliminar serie ${setIndex + 1}`}
                              style={[
                                styles.removeButton,
                                exercise.sets.length <= 1 && { opacity: 0.25 },
                              ]}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color={colors.textMuted}
                              />
                            </Pressable>
                          </View>
                        ))}

                        <Pressable
                          onPress={() => addSet(exercise.dayExerciseId)}
                          style={styles.addSetButton}
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name="add-circle-outline"
                            size={18}
                            color={colors.accent}
                          />
                          <Text style={styles.addSetText}>Agregar serie</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 14) },
            ]}
          >
            <View style={styles.footerTop}>
              <View>
                <Text style={styles.footerLabel}>Series cargadas</Text>
                <Text style={styles.footerValue}>
                  {totalValidSets}
                  <Text style={styles.footerValueMuted}>
                    {' '}
                    / {exercises.reduce((n, e) => n + e.sets.length, 0)}
                  </Text>
                </Text>
              </View>
              <Text style={styles.footerHint}>
                {trainedExercises > 0
                  ? `${trainedExercises} ${
                      trainedExercises === 1 ? 'ejercicio' : 'ejercicios'
                    } con datos`
                  : 'Cargá tu primera serie'}
              </Text>
            </View>
            <AppButton
              label="Finalizar entrenamiento"
              icon="checkmark"
              onPress={handleFinish}
              loading={saving}
              disabled={exercises.length === 0}
            />
          </View>
        </KeyboardAvoidingView>

        <ExerciseDetailModal
          visible={!!detailExercise}
          exercise={detailExercise}
          onClose={() => setDetailExercise(null)}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    paddingTop: 12,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 46,
    color: colors.text,
    marginTop: 2,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  hintText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  exerciseCard: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  indexBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.accent,
  },
  exerciseName: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.text,
  },
  exerciseGroup: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  infoButton: {
    padding: 2,
  },
  exerciseBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  columnLabel: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textMuted,
    textAlign: 'center',
  },
  serieCol: {
    flex: 0,
    width: 34,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  serieChip: {
    width: 34,
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serieChipText: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    color: colors.textSecondary,
  },
  inputWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    height: 42,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: fonts.displaySemi,
    fontSize: 17,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  repsInput: {
    flex: 1,
  },
  inputUnit: {
    position: 'absolute',
    right: 8,
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
  },
  removeButton: {
    width: 28,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accentBorder,
    backgroundColor: colors.accentSoft,
  },
  addSetText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.accent,
  },
  emptyCard: {
    marginTop: 20,
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
    fontSize: 15,
    color: colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  footerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  footerValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.accent,
    lineHeight: 24,
  },
  footerValueMuted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  footerHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
