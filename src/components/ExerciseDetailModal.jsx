import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';
import AppButton from './AppButton';

/**
 * Modal de detalle: imagen (o placeholder), grupo muscular e instrucciones.
 * Se reutiliza desde el entrenamiento y desde el catálogo. Si se pasan
 * `onPickImage` / `onRemoveImage`, muestra acciones para editar la foto.
 */
export default function ExerciseDetailModal({
  visible,
  exercise,
  onClose,
  onPickImage,
  onRemoveImage,
  imageBusy = false,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.groupChip}>
              <Text style={styles.groupText}>
                {exercise?.grupoMuscular || 'General'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar detalle"
              style={styles.closeButton}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {exercise?.rutaImagen ? (
              <Image
                source={{ uri: exercise.rutaImagen }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <View style={styles.imageIconWrap}>
                  <Ionicons name="barbell" size={34} color={colors.accent} />
                </View>
                <Text style={styles.placeholderText}>
                  Sin imagen cargada
                </Text>
              </View>
            )}

            {onPickImage ? (
              <View style={styles.imageActions}>
                <Pressable
                  onPress={() => onPickImage('library')}
                  disabled={imageBusy}
                  style={styles.imageAction}
                  accessibilityRole="button"
                  accessibilityLabel="Elegir foto de la galería"
                >
                  {imageBusy ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Ionicons
                      name="images-outline"
                      size={16}
                      color={colors.accent}
                    />
                  )}
                  <Text style={styles.imageActionText}>Galería</Text>
                </Pressable>

                <Pressable
                  onPress={() => onPickImage('camera')}
                  disabled={imageBusy}
                  style={styles.imageAction}
                  accessibilityRole="button"
                  accessibilityLabel="Sacar foto con la cámara"
                >
                  <Ionicons
                    name="camera-outline"
                    size={16}
                    color={colors.accent}
                  />
                  <Text style={styles.imageActionText}>Cámara</Text>
                </Pressable>

                {exercise?.rutaImagen && onRemoveImage ? (
                  <Pressable
                    onPress={onRemoveImage}
                    disabled={imageBusy}
                    style={[styles.imageAction, styles.imageActionDanger]}
                    accessibilityRole="button"
                    accessibilityLabel="Quitar foto"
                  >
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color={colors.danger}
                    />
                    <Text
                      style={[
                        styles.imageActionText,
                        { color: colors.danger },
                      ]}
                    >
                      Quitar
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.title}>{exercise?.nombre ?? 'Ejercicio'}</Text>

            <Text style={styles.sectionLabel}>Cómo realizarlo</Text>
            <Text style={styles.instructions}>
              {exercise?.instrucciones?.trim() ||
                'Todavía no agregaste instrucciones para este ejercicio.'}
            </Text>
          </ScrollView>

          <AppButton
            label="Entendido"
            onPress={onClose}
            style={styles.button}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    maxHeight: '88%',
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  groupChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.steelSoft,
    borderWidth: 1,
    borderColor: colors.steelBorder,
  },
  groupText: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.steel,
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
  scrollContent: {
    paddingBottom: 18,
  },
  image: {
    width: '100%',
    height: 190,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    marginBottom: 18,
  },
  imagePlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  imageIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  imageActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -8,
    marginBottom: 18,
  },
  imageAction: {
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
  imageActionDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(230, 57, 70, 0.4)',
  },
  imageActionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: colors.text,
    marginBottom: 18,
  },
  sectionLabel: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 8,
  },
  instructions: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 23,
    color: colors.textSecondary,
  },
  button: {
    marginTop: 4,
  },
});
