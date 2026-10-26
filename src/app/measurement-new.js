import React, { useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '../components/AppButton';
import {
  createMeasurement,
  getMetricSnapshot,
  getMetricTypes,
  getProfile,
  updateProfileHeight,
} from '../db/queries';
import {
  capitalizeFirst,
  formatLongDate,
  parseISODate,
  toISODate,
  todayISO,
} from '../utils/date';
import { formatNumber } from '../utils/body';
import { colors, fonts, radius } from '../theme';

function parseDecimal(value) {
  if (typeof value !== 'string' || !value.trim()) return NaN;
  return Number.parseFloat(value.replace(',', '.'));
}

function FormField({ label, value, onChangeText, unit, placeholder, style }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder ?? '0'}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={6}
          accessibilityLabel={label}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

export default function NewMeasurementScreen() {
  const db = useSQLiteContext();
  const [fecha, setFecha] = useState(todayISO());
  const [peso, setPeso] = useState('');
  const [estatura, setEstatura] = useState('');
  const [grasa, setGrasa] = useState('');
  const [metricTypes, setMetricTypes] = useState([]);
  const [values, setValues] = useState({});
  const [lastPeso, setLastPeso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    (async () => {
      try {
        const [profile, snapshot, types] = await Promise.all([
          getProfile(db),
          getMetricSnapshot(db),
          getMetricTypes(db),
        ]);

        setMetricTypes(types);
        setLastPeso(snapshot?.latest?.peso ?? null);
        setEstatura(
          String(snapshot?.latest?.estatura ?? profile?.estatura_cm ?? '')
        );

        const initialValues = {};
        for (const metric of snapshot?.metrics ?? []) {
          initialValues[metric.id] =
            metric.valor != null ? String(metric.valor).replace('.', ',') : '';
        }
        setValues(initialValues);
      } catch (error) {
        console.error('No se pudo preparar la medición:', error);
        Alert.alert('Error', 'No pudimos leer tus datos anteriores.');
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  const today = todayISO();
  const isToday = fecha === today;

  const shiftDate = (days) => {
    const current = parseISODate(fecha);
    current.setDate(current.getDate() + days);
    const next = toISODate(current);
    if (next > today) return;
    setFecha(next);
  };

  const handleSave = async () => {
    const pesoNum = parseDecimal(peso);
    const estaturaNum = parseDecimal(estatura);
    const grasaNum = grasa.trim() ? parseDecimal(grasa) : null;

    if (!Number.isFinite(pesoNum) || pesoNum <= 0) {
      Alert.alert('Falta el peso', 'Ingresá tu peso en kilogramos.');
      return;
    }
    if (!Number.isFinite(estaturaNum) || estaturaNum <= 0) {
      Alert.alert('Falta la estatura', 'Ingresá tu estatura en centímetros.');
      return;
    }
    if (grasaNum != null && (!Number.isFinite(grasaNum) || grasaNum <= 0)) {
      Alert.alert(
        'Grasa corporal inválida',
        'Ingresá un porcentaje mayor a cero o dejá el campo vacío.'
      );
      return;
    }

    const metrics = metricTypes
      .map((type) => ({
        metricTypeId: type.id,
        valor: parseDecimal(values[type.id] ?? ''),
      }))
      .filter((metric) => Number.isFinite(metric.valor) && metric.valor > 0);

    setSaving(true);
    try {
      await createMeasurement(db, {
        fecha,
        peso: pesoNum,
        estatura: estaturaNum,
        grasaCorporal: grasaNum,
        metrics,
      });
      await updateProfileHeight(db, estaturaNum);
      router.back();
    } catch (error) {
      console.error('No se pudo guardar la medición:', error);
      Alert.alert('Error', 'No pudimos guardar la medición.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroGlow} />
            <Text style={styles.eyebrow}>Registro corporal</Text>
            <Text style={styles.title}>Nueva medición</Text>
            <Text style={styles.subtitle}>
              Guardá tu peso, estatura y medidas. Todo queda en este
              dispositivo.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Datos generales</Text>

            <Text style={styles.label}>Fecha</Text>
            <View style={styles.dateRow}>
              <Pressable
                onPress={() => shiftDate(-1)}
                style={styles.dateButton}
                accessibilityRole="button"
                accessibilityLabel="Día anterior"
              >
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>

              <View style={styles.dateValue}>
                <Text style={styles.dateText}>
                  {capitalizeFirst(formatLongDate(parseISODate(fecha)))}
                </Text>
                <Text style={styles.dateHint}>
                  {isToday ? 'Hoy' : 'Registro pasado'}
                </Text>
              </View>

              <Pressable
                onPress={() => shiftDate(1)}
                disabled={isToday}
                style={[
                  styles.dateButton,
                  isToday && styles.dateButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Día siguiente"
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.row}>
              <FormField
                label="Peso"
                value={peso}
                onChangeText={setPeso}
                unit="kg"
                placeholder={
                  lastPeso != null ? String(lastPeso).replace('.', ',') : '0'
                }
                style={{ flex: 1 }}
              />
              <FormField
                label="Estatura"
                value={estatura}
                onChangeText={setEstatura}
                unit="cm"
                style={{ flex: 1 }}
              />
            </View>

            <FormField
              label="Grasa corporal (opcional)"
              value={grasa}
              onChangeText={setGrasa}
              unit="%"
              style={{ marginTop: 12 }}
            />

            {lastPeso != null ? (
              <Text style={styles.lastHint}>
                Último peso registrado: {formatNumber(lastPeso)} kg
              </Text>
            ) : null}
          </View>

          {metricTypes.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Medidas</Text>
              <Text style={styles.cardHint}>
                Completá solo las que quieras registrar. Los valores anteriores
                aparecen precargados.
              </Text>

              <View style={styles.metricsGrid}>
                {metricTypes.map((type) => (
                  <FormField
                    key={type.id}
                    label={type.nombre}
                    value={values[type.id] ?? ''}
                    onChangeText={(value) =>
                      setValues((prev) => ({ ...prev, [type.id]: value }))
                    }
                    unit={type.unidad}
                    style={styles.metricField}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <AppButton
            label="Guardar medición"
            icon="checkmark"
            onPress={handleSave}
            loading={saving}
            style={styles.saveButton}
          />

          <Text style={styles.footnote}>
            El IMC se calcula automáticamente con el peso y la estatura.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginBottom: 14,
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.accentSoft,
    top: -110,
    right: -60,
  },
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.accent,
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
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 4,
    maxWidth: '90%',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: fonts.displaySemi,
    fontSize: 19,
    color: colors.text,
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  cardHint: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: -6,
    marginBottom: 12,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 52,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.displaySemi,
    fontSize: 22,
    paddingVertical: 0,
  },
  unit: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 6,
  },
  field: {
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  dateButton: {
    width: 44,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateButtonDisabled: {
    opacity: 0.35,
  },
  dateValue: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    color: colors.text,
  },
  dateHint: {
    fontFamily: fonts.body,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  lastHint: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricField: {
    width: '47%',
    flexGrow: 1,
  },
  saveButton: {
    marginTop: 4,
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
});
