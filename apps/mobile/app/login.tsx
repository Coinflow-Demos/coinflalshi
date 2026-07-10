import {useState} from 'react';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {router, Link} from 'expo-router';
import {useAuth} from '@/lib/auth-context';
import {colors} from '@/constants/theme';

export default function LoginScreen() {
  const {login} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    try {
      await login({email, password});
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid email or password');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholderTextColor={colors.muted}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Log in</Text>
      </Pressable>
      <Link href="/register" style={styles.link}>
        Don&apos;t have an account? Sign up
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background, padding: 20, justifyContent: 'center', gap: 4},
  label: {color: colors.muted, fontSize: 13, marginTop: 12, marginBottom: 4},
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.foreground,
    fontSize: 16,
  },
  error: {color: colors.destructive, marginTop: 10},
  button: {backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20},
  buttonText: {color: '#fff', fontWeight: '700', fontSize: 16},
  link: {color: colors.primary, textAlign: 'center', marginTop: 16},
});
