import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../../components/AppButton';
import ExerciseDetailModal from '../../components/ExerciseDetailModal';
import { createExercise, getExerciseCatalog, updateExerciseImage } from '../../db/queries';
import { deleteExerciseImage, pickExerciseImage } from '../../utils/images';
import { colors, fonts, radius } from '../../theme';

const GROUPS = [
  'Pecho',
  'Espalda',
  'Piernas',
  'Hombros',
  'Bíceps',
  'Tríceps',
  'Core',
  'Isquios',
  'Gemelos',
  'General',
];

export default function ExercisesScreen() {
  const db = useSQLiteContext();
  const [catalog, setCatalog] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailExercise, setDetailExercise] = useState(null);

  const [formVisible, setFormVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState('');
  const [grupo, setGrupo] = useState('Pecho');
  const [instrucciones, setInstrucciones] = useState('');
  const [foto, setFoto] = useState(null);
  const [formImageBusy, setFormImageBusy] = useState(false);
  const [detailImageBusy, setDetailImageBusy] = useState(false);

  const load = useCallback(
    async (search = query) => {
      try {
        const rows = await getExerciseCatalog(db, search);
        setCatalog(rows);
      } catch (error) {
        console.error('No se pudo cargar el catálogo:', error);
        Alert.alert('Error', 'No pudimos leer el catálogo de ejercicios.');
      } finally {
        setLoading(false);
      }
    },
    [db, query]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      load(query);
    }, 220);
    return () => clearTimeout(timeout);
  }, [query, load]);

  const resetForm = ({ discardImage = true } = {}) => {
    if (discardImage && foto) {
      deleteExerciseImage(foto);
    }
    setNombre('');
    setGrupo('Pecho');
    setInstrucciones('');
    setFoto(null);
  };

  const closeForm = () => {
    if (saving) return;
    setFormVisible(false);
    resetForm();
  };

  const handleFormPick = async (source) => {
    setFormImageBusy(true);
    try {
      const uri = await pickExerciseImage(source);
      if (!uri) return;
      if (foto) await deleteExerciseImage(foto);
      setFoto(uri);
    } catch (error) {
      Alert.alert('No se pudo agregar la foto', error?.message ?? 'Intentá de nuevo.');
    } finally {
      setFormImageBusy(false);
    }
  };

  const handleDetailPick = async (source) => {
    if (!detailExercise) return;
    setDetailImageBusy(true);
    try {
      const uri = await pickExerciseImage(source);
      if (!uri) return;
      const previous = await updateExerciseImage(db, detailExercise.id, uri);
      if (previous && previous !== uri) {
        await deleteExerciseImage(previous);
      }
      setDetailExercise({ ...detailExercise, ruta_imagen: uri });
      await load(query);
    } catch (error) {
      Alert.alert('No se pudo actualizar la foto', error?.message ?? 'Intentá de nuevo.');
    } finally {
      setDetailImageBusy(false);
    }
  };

  const handleDetailRemove = () => {
    if (!detailExercise) return;
    Alert.alert('Quitar foto', 'La imagen se borrará del ejercicio.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          setDetailImageBusy(true);
          try {
            const previous = await updateExerciseImage(db, detailExercise.id, null);
            await deleteExerciseImage(previous);
            setDetailExercise({ ...detailExercise, ruta_imagen: null });
            await load(query);
          } catch (error) {
            console.error('No se pudo quitar la foto:', error);
            Alert.alert('Error', 'No pudimos quitar la foto.');
          } finally {
            setDetailImageBusy(false);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!nombre.trim()) {
      Alert.alert('Falta el nombre', 'Poné un nombre para el ejercicio.');
      return;
    }
    setSaving(true);
    try {
      await createExercise(db, {
        nombre,
        grupoMuscular: grupo,
        instrucciones,
        rutaImagen: foto,
      });
      await load('');
      setQuery('');
      setFormVisible(false);
      resetForm({ discardImage: false });
    } catch (error) {
      console.error('No se pudo crear el ejercicio:', error);
      Alert.alert('Error', 'No pudimos guardar el ejercicio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Ejercicios</Text>
            <Text style={styles.subtitle}>
              {catalog.length}{' '}
              {catalog.length === 1 ? 'ejercicio' : 'ejercicios'} en tu
              catálogo
            </Text>
          </View>
          <Pressable
            onPress={() => setFormVisible(true)}
            style={styles.newButton}
            accessibilityRole="button"
            accessibilityLabel="Nuevo ejercicio"
          >
            <Ionicons name="add" size={18} color={colors.textOnAccent} />
            <Text style={styles.newButtonText}>Nuevo</Text>
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nombre o grupo muscular"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
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

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : catalog.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="search-outline" size={28} color={colors.steel} />
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptyText}>
              Probá con otro término o creá un ejercicio nuevo.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {catalog.map((exercise) => (
              <Pressable
                key={exercise.id}
                onPress={() => setDetailExercise(exercise)}
                style={({ pressed }) => [
                  styles.card,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Ver ${exercise.nombre}`}
              >
                {exercise.ruta_imagen ? (
                  <Image
                    source={{ uri: exercise.ruta_imagen }}
                    style={styles.thumb}
                  />
                ) : (
                  <View style={styles.thumbPlaceholder}>
                    <Ionicons
                      name="barbell-outline"
                      size={20}
                      color={colors.accent}
                    />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {exercise.nombre}
                  </Text>
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardGroup}>
                      {exercise.grupo_muscular || 'General'}
                    </Text>
                    {exercise.instrucciones ? (
                      <>
                        <View style={styles.dot} />
                        <Text style={styles.cardMeta}>
                          Con instrucciones
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={colors.textMuted}
                />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <ExerciseDetailModal
        visible={!!detailExercise}
        exercise={
          detailExercise
            ? {
                nombre: detailExercise.nombre,
                grupoMuscular: detailExercise.grupo_muscular,
                rutaImagen: detailExercise.ruta_imagen,
                instrucciones: detailExercise.instrucciones,
              }
            : null
        }
        onClose={() => setDetailExercise(null)}
        onPickImage={handleDetailPick}
        onRemoveImage={handleDetailRemove}
        imageBusy={detailImageBusy}
      />

      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.backdrop} onPress={closeForm} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>Catálogo</Text>
                <Text style={styles.sheetTitle}>Nuevo ejercicio</Text>
              </View>
              <Pressable
                onPress={closeForm}
                hitSlop={12}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Cerrar formulario"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej. Press inclinado"
                placeholderTextColor={colors.textMuted}
                style={styles.fieldInput}
                maxLength={60}
              />

              <Text style={styles.fieldLabel}>Grupo muscular</Text>
              <View style={styles.groupGrid}>
                {GROUPS.map((group) => {
                  const active = group === grupo;
                  return (
                    <Pressable
                      key={group}
                      onPress={() => setGrupo(group)}
                      style={[styles.groupPill, active && styles.groupPillActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[
                          styles.groupPillText,
                          active && styles.groupPillTextActive,
                        ]}
                      >
                        {group}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Instrucciones</Text>
              <TextInput
                value={instrucciones}
                onChangeText={setInstrucciones}
                placeholder="Explicá la técnica, la postura y los errores comunes..."
                placeholderTextColor={colors.textMuted}
                style={[styles.fieldInput, styles.textArea]}
                multiline
                textAlignVertical="top"
                maxLength={1200}
              />

              <Text style={styles.fieldLabel}>Foto (opcional)</Text>
              <View style={styles.photoRow}>
                {foto ? (
                  <Image source={{ uri: foto }} style={styles.photoPreview} />
                ) : (
                  <View style={styles.photoPreviewEmpty}>
                    <Ionicons
                      name="camera-outline"
                      size={24}
                      color={colors.textMuted}
                    />
                    <Text style={styles.photoPreviewText}>Sin foto</Text>
                  </View>
                )}

                <View style={styles.photoActions}>
                  <Pressable
                    onPress={() => handleFormPick('library')}
                    disabled={formImageBusy}
                    style={styles.photoAction}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="images-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <Text style={styles.photoActionText}>Galería</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleFormPick('camera')}
                    disabled={formImageBusy}
                    style={styles.photoAction}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name="camera-outline"
                      size={16}
                      color={colors.accent}
                    />
                    <Text style={styles.photoActionText}>Cámara</Text>
                  </Pressable>
                  {foto ? (
                    <Pressable
                      onPress={() => {
                        deleteExerciseImage(foto);
                        setFoto(null);
                      }}
                      disabled={formImageBusy}
                      style={[styles.photoAction, styles.photoActionDanger]}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={colors.danger}
                      />
                      <Text
                        style={[
                          styles.photoActionText,
                          { color: colors.danger },
                        ]}
                      >
                        Quitar
                      </Text>
                    </Pressable>
                  ) : null}
                  {formImageBusy ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.accent}
                      style={{ marginTop: 4 }}
                    />
                  ) : null}
                </View>
              </View>
            </ScrollView>

            <AppButton
              label="Guardar ejercicio"
              icon="checkmark"
              onPress={handleSave}
              loading={saving}
            />
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  newButtonText: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.textOnAccent,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 18,
    marginBottom: 16,
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
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  thumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: fonts.bodySemi,
    fontSize: 14,
    color: colors.text,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 4,
  },
  cardGroup: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.steel,
  },
  cardMeta: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  emptyCard: {
    marginTop: 20,
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
    maxHeight: '90%',
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
    marginBottom: 14,
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
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  fieldInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 14,
  },
  textArea: {
    minHeight: 120,
    lineHeight: 21,
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  groupPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  groupPillActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  groupPillText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  groupPillTextActive: {
    color: colors.accent,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 6,
  },
  photoPreview: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoPreviewEmpty: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoPreviewText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  photoActions: {
    flex: 1,
    gap: 7,
  },
  photoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoActionDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(230, 57, 70, 0.4)',
  },
  photoActionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
