import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../components/AppButton';
import ExerciseDetailModal from '../components/ExerciseDetailModal';
import {
  addExerciseToDay,
  getDayExercises,
  getExerciseCatalog,
  moveDayExercise,
  removeDayExercise,
} from '../db/queries';
import { colors, fonts, radius } from '../theme';

export default function CycleDayScreen() {
  const db = useSQLiteContext();
  const { dayId, dayName } = useLocalSearchParams();
  const numericDayId = Number(dayId);

  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detailExercise, setDetailExercise] = useState(null);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!numericDayId) {
      setLoading(false);
      return;
    }
    try {
      const rows = await getDayExercises(db, numericDayId);
      setExercises(rows);
    } catch (error) {
      console.error('No se pudieron cargar los ejercicios del día:', error);
      Alert.alert('Error', 'No pudimos leer los ejercicios del día.');
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, [db, numericDayId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const loadCatalog = useCallback(
    async (search = '') => {
      setCatalogLoading(true);
      try {
        const rows = await getExerciseCatalog(db, search);
        setCatalog(rows);
      } catch (error) {
        console.error('No se pudo cargar el catálogo:', error);
      } finally {
        setCatalogLoading(false);
      }
    },
    [db]
  );

  useEffect(() => {
    if (!pickerVisible) return;
    const timeout = setTimeout(() => {
      loadCatalog(query);
    }, 200);
    return () => clearTimeout(timeout);
  }, [pickerVisible, query, loadCatalog]);

  const assignedIds = new Set(exercises.map((item) => item.exerciseId));
  const available = catalog.filter((item) => !assignedIds.has(item.id));

  const handleMove = async (exercise, direction) => {
    setBusy(true);
    try {
      await moveDayExercise(db, exercise.dayExerciseId, direction);
      await load();
    } catch (error) {
      console.error('No se pudo mover el ejercicio:', error);
      Alert.alert('Error', 'No se pudo mover el ejercicio.');
      setBusy(false);
    }
  };

  const handleRemove = (exercise) => {
    Alert.alert(
      'Quitar ejercicio',
      `¿Quitar "${exercise.nombre}" de ${dayName ?? 'este día'}?\n\nLas sesiones ya registradas se conservan.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await removeDayExercise(db, exercise.dayExerciseId);
              await load();
            } catch (error) {
              console.error('No se pudo quitar el ejercicio:', error);
              Alert.alert('Error', 'No se pudo quitar el ejercicio.');
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleAdd = async (exercise) => {
    setBusy(true);
    try {
      await addExerciseToDay(db, numericDayId, exercise.id);
      setPickerVisible(false);
      setQuery('');
      await load();
    } catch (error) {
      console.error('No se pudo agregar el ejercicio:', error);
      Alert.alert('Error', 'No se pudo agregar el ejercicio.');
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: dayName || 'Día' }} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: dayName || 'Día' }} />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <Text style={styles.eyebrow}>Día del ciclo</Text>
            <Text style={styles.title}>{dayName || 'Día'}</Text>
            <Text style={styles.subtitle}>
              {exercises.length}{' '}
              {exercises.length === 1 ? 'ejercicio asignado' : 'ejercicios asignados'}
            </Text>
          </View>

          <View style={styles.hintRow}>
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={colors.textMuted}
            />
            <Text style={styles.hintText}>
              El orden de esta lista es el que vas a ver al entrenar. Podés
              reordenar con las flechas.
            </Text>
          </View>

          {exercises.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="albums-outline" size={28} color={colors.accent} />
              <Text style={styles.emptyTitle}>Este día está vacío</Text>
              <Text style={styles.emptyText}>
                Agregá ejercicios del catálogo para poder entrenar.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {exercises.map((exercise, index) => (
                <View key={exercise.dayExerciseId} style={styles.card}>
                  <View style={styles.cardMain}>
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderText}>
                        {String(index + 1).padStart(2, '0')}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => setDetailExercise(exercise)}
                      style={{ flex: 1 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Ver instrucciones de ${exercise.nombre}`}
                    >
                      <Text style={styles.exerciseName} numberOfLines={1}>
                        {exercise.nombre}
                      </Text>
                      <Text style={styles.exerciseGroup}>
                        {exercise.grupoMuscular || 'General'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setDetailExercise(exercise)}
                      hitSlop={8}
                      style={styles.infoButton}
                      accessibilityRole="button"
                      accessibilityLabel={`Ver instrucciones de ${exercise.nombre}`}
                    >
                      <Ionicons
                        name="help-circle-outline"
                        size={19}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  </View>

                  <View style={styles.cardActions}>
                    <Pressable
                      onPress={() => handleMove(exercise, -1)}
                      disabled={index === 0 || busy}
                      style={[
                        styles.actionButton,
                        (index === 0 || busy) && styles.actionDisabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Mover ${exercise.nombre} arriba`}
                    >
                      <Ionicons
                        name="arrow-up"
                        size={16}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => handleMove(exercise, 1)}
                      disabled={index === exercises.length - 1 || busy}
                      style={[
                        styles.actionButton,
                        (index === exercises.length - 1 || busy) &&
                          styles.actionDisabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Mover ${exercise.nombre} abajo`}
                    >
                      <Ionicons
                        name="arrow-down"
                        size={16}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => handleRemove(exercise)}
                      disabled={busy}
                      style={[styles.actionButton, styles.removeButton]}
                      accessibilityRole="button"
                      accessibilityLabel={`Quitar ${exercise.nombre}`}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={colors.danger}
                      />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <AppButton
            label="Agregar ejercicio"
            icon="add"
            iconPosition="left"
            onPress={() => {
              setQuery('');
              setPickerVisible(true);
            }}
            style={styles.addButton}
          />

          <Text style={styles.footnote}>
            Los cambios se aplican a la próxima sesión de este día. Las sesiones
            anteriores no se modifican.
          </Text>
        </ScrollView>

        <ExerciseDetailModal
          visible={!!detailExercise}
          exercise={detailExercise}
          onClose={() => setDetailExercise(null)}
        />

        <Modal
          visible={pickerVisible}
          transparent
          animationType="slide"
          statusBarTranslucent
          onRequestClose={() => setPickerVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable
              style={styles.backdrop}
              onPress={() => setPickerVisible(false)}
            />
            <View style={styles.sheet}>
              <View style={styles.handle} />

              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetEyebrow}>Catálogo</Text>
                  <Text style={styles.sheetTitle}>Agregar ejercicio</Text>
                </View>
                <Pressable
                  onPress={() => setPickerVisible(false)}
                  hitSlop={12}
                  style={styles.closeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar"
                >
                  <Ionicons
                    name="close"
                    size={20}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              <View style={styles.searchWrap}>
                <Ionicons name="search" size={17} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar en el catálogo"
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  autoCorrect={false}
                />
                {query.length > 0 ? (
                  <Pressable
                    onPress={() => setQuery('')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Limpiar búsqueda"
                  >
                    <Ionicons
                      name="close-circle"
                      size={17}
                      color={colors.textMuted}
                    />
                  </Pressable>
                ) : null}
              </View>

              <ScrollView
                style={styles.catalogScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {catalogLoading ? (
                  <ActivityIndicator
                    color={colors.accent}
                    style={{ marginVertical: 30 }}
                  />
                ) : available.length === 0 ? (
                  <View style={styles.catalogEmpty}>
                    <Ionicons
                      name="checkmark-done-outline"
                      size={26}
                      color={colors.steel}
                    />
                    <Text style={styles.catalogEmptyText}>
                      {query
                        ? 'No hay ejercicios que coincidan con la búsqueda.'
                        : 'Todos los ejercicios del catálogo ya están en este día.'}
                    </Text>
                  </View>
                ) : (
                  available.map((exercise) => (
                    <Pressable
                      key={exercise.id}
                      onPress={() => handleAdd(exercise)}
                      disabled={busy}
                      style={({ pressed }) => [
                        styles.catalogRow,
                        pressed && { opacity: 0.75 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Agregar ${exercise.nombre}`}
                    >
                      <View style={styles.catalogIcon}>
                        <Ionicons
                          name="barbell-outline"
                          size={16}
                          color={colors.accent}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.catalogName} numberOfLines={1}>
                          {exercise.nombre}
                        </Text>
                        <Text style={styles.catalogGroup}>
                          {exercise.grupo_muscular || 'General'}
                        </Text>
                      </View>
                      <Ionicons
                        name="add-circle"
                        size={22}
                        color={colors.accent}
                      />
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
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
    paddingBottom: 40,
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
    backgroundColor: colors.steelSoft,
    top: -100,
    right: -60,
  },
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.steel,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    color: colors.text,
    marginTop: 2,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
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
  list: {
    gap: 10,
    marginTop: 10,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
    paddingBottom: 10,
  },
  orderBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
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
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  actionButton: {
    width: 34,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: {
    opacity: 0.3,
  },
  removeButton: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(230, 57, 70, 0.35)',
  },
  addButton: {
    marginTop: 14,
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 12,
  },
  emptyCard: {
    marginTop: 18,
    padding: 26,
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
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetEyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  sheetTitle: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: colors.text,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
    paddingVertical: 0,
  },
  catalogScroll: {
    marginTop: 12,
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  catalogIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogName: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.text,
  },
  catalogGroup: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  catalogEmpty: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  catalogEmptyText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
