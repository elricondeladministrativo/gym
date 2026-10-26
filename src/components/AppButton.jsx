import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../theme';

const VARIANTS = {
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    textColor: colors.textOnAccent,
    iconColor: colors.textOnAccent,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.steelBorder,
    textColor: colors.text,
    iconColor: colors.steel,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    textColor: colors.textSecondary,
    iconColor: colors.textSecondary,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(230, 57, 70, 0.45)',
    textColor: colors.danger,
    iconColor: colors.danger,
  },
};

export default function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconPosition = 'right',
  disabled = false,
  loading = false,
  style,
}) {
  const palette = VARIANTS[variant] ?? VARIANTS.primary;
  const contentColor = disabled ? colors.textMuted : palette.textColor;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      onPress={disabled || loading ? undefined : onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={contentColor} />
      ) : (
        <>
          {icon && iconPosition === 'left' ? (
            <Ionicons name={icon} size={20} color={contentColor} />
          ) : null}
          <Text style={[styles.label, { color: contentColor }]}>{label}</Text>
          {icon && iconPosition === 'right' ? (
            <Ionicons name={icon} size={20} color={contentColor} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
