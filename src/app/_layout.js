import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { BarlowCondensed_400Regular } from '@expo-google-fonts/barlow-condensed/400Regular';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

import { migrateDbIfNeeded } from '../db/migrate';
import { colors, fonts } from '../theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_400Regular,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName="gymapp.db" onInit={migrateDbIfNeeded}>
        <StatusBar style="light" backgroundColor={colors.bg} />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.bg },
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: {
              fontFamily: fonts.displaySemi,
              fontSize: 22,
            },
            headerShadowVisible: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="workout"
            options={{
              headerShown: true,
              title: 'Entrenamiento',
              headerBackTitle: 'Volver',
            }}
          />
          <Stack.Screen
            name="cycle"
            options={{
              headerShown: true,
              title: 'Editar ciclo',
              headerBackTitle: 'Volver',
            }}
          />
          <Stack.Screen
            name="cycle-day"
            options={{
              headerShown: true,
              title: 'Día',
              headerBackTitle: 'Ciclo',
            }}
          />
          <Stack.Screen
            name="measurement-new"
            options={{
              headerShown: true,
              title: 'Nueva medición',
              headerBackTitle: 'Volver',
            }}
          />
        </Stack>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
