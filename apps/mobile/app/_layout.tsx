import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider} from '@/lib/auth-context';
import {colors} from '@/constants/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: {backgroundColor: colors.background},
              headerTintColor: colors.foreground,
              contentStyle: {backgroundColor: colors.background},
            }}
          >
            <Stack.Screen name="(tabs)" options={{headerShown: false}} />
            <Stack.Screen name="login" options={{title: 'Log in'}} />
            <Stack.Screen name="register" options={{title: 'Sign up'}} />
            <Stack.Screen name="market/[slug]" options={{title: 'Market'}} />
            <Stack.Screen name="markets/create" options={{title: 'Create market'}} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
