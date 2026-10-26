import React, { useCallback, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../components/AppButton';
import {
  createCycleDay,
  deleteCycleDay,
  getEditableCycle,
  moveCycleDay,
  renameCycle,
  renameCycleDay,
} from '../db/queries';
import { colors, fonts, radius } from '../theme';

export default function CycleEditorScreen() {
  const db = useSQLiteContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editor, setEditor] = useState(null);
  const [editorValue, setEditorValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const cycleData = await getEditableCycle(db);
      setData(cycleData);
    } catch (error) {
      console.error('No se pudo cargar el ciclo:', error);
      Alert.alert('Error', 'No pudimos leer el ciclo.');
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const days = data?.days ?? [];
  const cycle = data?.cycle ?? null;
  const currentIndex = cycle
    ? Math.max(
        0,
        days.findIndex((day) => day.orden === cycle.posicion_actual)
      )
    : 0;

  const openEditor = (mode, { day = null, value = '' } = {}) => {
    setEditor({ mode, day });
    setEditorValue(value);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
    setEditorValue('');
  };

  const saveEditor = async () => {
    if (!editor || !cycle) return;
    if (!editorValue.trim()) {
      Alert.alert('Falta el nombre', 'Escribí un nombre para continuar.');
      return;
    }

    setSaving(true);
    try {
      if (editor.mode === 'cycle') {
        await renameCycle(db, cycle.id, editorValue);
      } else if (editor.mode === 'new') {
        await createCycleDay(db, { cycleId: cycle.id, nombre: editorValue });
      } else if (editor.mode === 'day' && editor.day) {
        await renameCycleDay(db, editor.day.id, editorValue);
      }
      setEditor(null);
      setEditorValue('');
      await load();
    } catch (error) {
      console.error('No se pudo guardar:', error);
      Alert.alert('Error', error?.message || 'No se pudo guardar el cambio.');
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (day, direction) => {
    setBusy(true);
    try {
      await moveCycleDay(db, day.id, direction);
      await load();
    } catch (error) {
      console.error('No se pudo mover el día:', error);
      Alert.alert('Error', 'No se pudo mover el día.');
      setBusy(false);
    }
  };

  const handleDelete = (day) => {
    if (days.length <= 1) {
      Alert.alert(
        'No se puede borrar',
        'El ciclo necesita al menos un día. Creá otro antes de borrar este.'
      );
      return;
    }
    Alert.alert(
      'Borrar día',
      `¿Borrar "${day.nombre}" del ciclo?\n\nSi tenía ejercicios asignados, también se quitan del día. Las sesiones ya registradas se conservan.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteCycleDay(db, day.id);
              await load();
            } catch (error) {
              console.error('No se pudo borrar el día:', error);
              Alert.alert(
                'Error',
                error?.message || 'No se pudo borrar el día.'
              );
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!cycle) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.emptyCard}>
          <Ionicons name="git-branch-outline" size={28} color={colors.accent} />
          <Text style={styles.emptyTitle}>No hay un ciclo activo</Text>
          <Text style={styles.emptyText}>
            No encontramos un ciclo para editar en la base local.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <Text style={styles.eyebrow}>Ciclo activo</Text>
            <Pressable
              onPress={() =>
                openEditor('cycle', { value: cycle.nombre })
              }
              hitSlop={8}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Renombrar ciclo"
            >
              <Ionicons name="pencil" size={15} color={colors.accent} />
            </Pressable>
          </View>
          <Text style={styles.cycleName}>{cycle.nombre}</Text>
          <Text style={styles.cycleMeta}>
            {days.length} {days.length === 1 ? 'día' : 'días'} · Día actual{' '}
            {currentIndex + 1} de {days.length}
          </Text>

          <View style={styles.ruleNote}>
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={colors.steel}
            />
            <Text style={styles.ruleText}>
              El orden define la rotación. El descanso no avanza el ciclo; solo
              lo hace una sesión completada.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Días</Text>
          <Text style={styles.sectionHint}>Tocá un día para editar sus ejercicios</Text>
        </View>

        <View style={styles.list}>
          {days.map((day, index) => {
            const active = index === currentIndex;
            return (
              <View key={day.id} style={styles.dayCard}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/cycle-day',
                      params: {
                        dayId: String(day.id),
                        dayName: day.nombre,
                      },
                    })
                  }
                  style={styles.dayMain}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar ejercicios de ${day.nombre}`}
                >
                  <View
                    style={[
                      styles.orderBadge,
                      active && styles.orderBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderText,
                        active && styles.orderTextActive,
                      ]}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={styles.dayNameRow}>
                      <Text style={styles.dayName} numberOfLines={1}>
                        {day.nombre}
                      </Text>
                      {active ? (
                        <View style={styles.currentChip}>
                          <Text style={styles.currentChipText}>Actual</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.dayMeta}>
                      {day.exerciseCount}{' '}
                      {day.exerciseCount === 1 ? 'ejercicio' : 'ejercicios'}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={17}
                    color={colors.textMuted}
                  />
                </Pressable>

                <View style={styles.dayActions}>
                  <Pressable
                    onPress={() => handleMove(day, -1)}
                    disabled={index === 0 || busy}
                    style={[
                      styles.actionButton,
                      (index === 0 || busy) && styles.actionDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Mover ${day.nombre} arriba`}
                  >
                    <Ionicons
                      name="arrow-up"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => handleMove(day, 1)}
                    disabled={index === days.length - 1 || busy}
                    style={[
                      styles.actionButton,
                      (index === days.length - 1 || busy) &&
                        styles.actionDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Mover ${day.nombre} abajo`}
                  >
                    <Ionicons
                      name="arrow-down"
                      size={16}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      openEditor('day', { day, value: day.nombre })
                    }
                    style={styles.actionButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Renombrar ${day.nombre}`}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={16}
                      color={colors.steel}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDelete(day)}
                    disabled={days.length <= 1 || busy}
                    style={[
                      styles.actionButton,
                      days.length <= 1 && styles.actionDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Borrar ${day.nombre}`}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={colors.danger}
                    />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        <AppButton
          label="Agregar día"
          icon="add"
          iconPosition="left"
          variant="secondary"
          onPress={() => openEditor('new')}
          style={styles.addButton}
        />

        <View style={styles.footerNote}>
          <Ionicons name="layers-outline" size={15} color={colors.textMuted} />
          <Text style={styles.footerText}>
            Las sesiones y medidas ya guardadas no se modifican al editar el
            ciclo.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={!!editor}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={closeEditor} />
          <View style={styles.dialog}>
            <Text style={styles.dialogEyebrow}>
              {editor?.mode === 'cycle'
                ? 'Ciclo'
                : editor?.mode === 'new'
                  ? 'Nuevo día'
                  : 'Día'}
            </Text>
            <Text style={styles.dialogTitle}>
              {editor?.mode === 'cycle'
                ? 'Renombrar ciclo'
                : editor?.mode === 'new'
                  ? 'Nombre del día'
                  : 'Renombrar día'}
            </Text>

            <TextInput
              value={editorValue}
              onChangeText={setEditorValue}
              placeholder={
                editor?.mode === 'cycle' ? 'Ej. PPL + Full Body' : 'Ej. Empuje'
              }
              placeholderTextColor={colors.textMuted}
              style={styles.dialogInput}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={saveEditor}
            />

            <View style={styles.dialogActions}>
              <Pressable
                onPress={closeEditor}
                style={[styles.dialogButton, styles.dialogCancel]}
                accessibilityRole="button"
              >
                <Text style={styles.dialogCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={saveEditor}
                disabled={saving}
                style={[styles.dialogButton, styles.dialogSave]}
                accessibilityRole="button"
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
                ) : (
                  <Text style={styles.dialogSaveText}>Guardar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: colors.accentSoft,
    top: -100,
    right: -60,
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
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cycleName: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 42,
    color: colors.text,
    marginTop: 4,
  },
  cycleMeta: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ruleNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    marginTop: 14,
    padding: 11,
    borderRadius: radius.md,
    backgroundColor: colors.steelSoft,
    borderWidth: 1,
    borderColor: colors.steelBorder,
  },
  ruleText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.steel,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 10,
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
    marginTop: 2,
  },
  list: {
    gap: 10,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  dayMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingBottom: 10,
  },
  orderBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  orderText: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.textMuted,
  },
  orderTextActive: {
    color: colors.textOnAccent,
  },
  dayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dayName: {
    flexShrink: 1,
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    color: colors.text,
  },
  currentChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  currentChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  dayMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  dayActions: {
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
  addButton: {
    marginTop: 14,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 2,
  },
  footerText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },
  emptyCard: {
    margin: 20,
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  dialogEyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  dialogTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
    marginTop: 2,
    marginBottom: 14,
  },
  dialogInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  dialogButton: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dialogCancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  dialogSave: {
    backgroundColor: colors.accent,
  },
  dialogSaveText: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.textOnAccent,
  },
});
