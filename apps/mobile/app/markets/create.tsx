import {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {router} from 'expo-router';
import {apiFetch} from '@/lib/api';
import {useAuth} from '@/lib/auth-context';
import {colors} from '@/constants/theme';

const CATEGORIES = ['Sports', 'Crypto', 'Culture', 'Weather', 'Economics', 'Space', 'Other'];
const DURATIONS = [5, 10, 15, 30];
const EMOJI_SUGGESTIONS = ['❓', '🔥', '🎯', '⚡', '🎲', '🚀', '💡'];

export default function CreateMarketScreen() {
  const {token} = useAuth();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('Sports');
  const [imageEmoji, setImageEmoji] = useState('❓');
  const [outcomeA, setOutcomeA] = useState('Yes');
  const [outcomeB, setOutcomeB] = useState('No');
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!token) {
      router.push('/login');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<{market: {slug: string}}>('/api/markets/create', {
        method: 'POST',
        token,
        body: {
          title,
          subtitle: subtitle || undefined,
          category,
          imageEmoji,
          outcomeLabels: [outcomeA, outcomeB],
          durationMinutes,
        },
      });
      router.replace({pathname: '/market/[slug]', params: {slug: data.market.slug}});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create market');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{padding: 16}}>
      <Text style={styles.header}>Create a market</Text>
      <Text style={styles.subheader}>
        Ask anything. It goes live immediately and settles automatically.
      </Text>

      <Text style={styles.label}>Question</Text>
      <TextInput
        style={styles.input}
        placeholder="Will it snow in Chicago this week?"
        placeholderTextColor={colors.muted}
        value={title}
        onChangeText={setTitle}
        maxLength={140}
      />

      <Text style={styles.label}>Subtitle (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="A little extra context"
        placeholderTextColor={colors.muted}
        value={subtitle}
        onChangeText={setSubtitle}
        maxLength={140}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.chip, category === c && styles.chipSelected]}
          >
            <Text style={styles.chipText}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Icon</Text>
      <View style={styles.chipRow}>
        {EMOJI_SUGGESTIONS.map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => setImageEmoji(emoji)}
            style={[styles.emojiChip, imageEmoji === emoji && styles.chipSelected]}
          >
            <Text style={{fontSize: 18}}>{emoji}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{flexDirection: 'row', gap: 10}}>
        <View style={{flex: 1}}>
          <Text style={styles.label}>Outcome A</Text>
          <TextInput
            style={styles.input}
            value={outcomeA}
            onChangeText={setOutcomeA}
            placeholderTextColor={colors.muted}
            maxLength={40}
          />
        </View>
        <View style={{flex: 1}}>
          <Text style={styles.label}>Outcome B</Text>
          <TextInput
            style={styles.input}
            value={outcomeB}
            onChangeText={setOutcomeB}
            placeholderTextColor={colors.muted}
            maxLength={40}
          />
        </View>
      </View>

      <Text style={styles.label}>Resolves in</Text>
      <View style={styles.chipRow}>
        {DURATIONS.map((minutes) => (
          <Pressable
            key={minutes}
            onPress={() => setDurationMinutes(minutes)}
            style={[styles.chip, durationMinutes === minutes && styles.chipSelected]}
          >
            <Text style={styles.chipText}>{minutes}m</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (submitting || title.trim().length < 4) && {opacity: 0.6}]}
        onPress={handleSubmit}
        disabled={submitting || title.trim().length < 4}
      >
        <Text style={styles.buttonText}>{submitting ? 'Creating…' : 'Create market'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {fontSize: 26, fontWeight: '700', color: colors.foreground},
  subheader: {color: colors.muted, fontSize: 13, marginTop: 4, marginBottom: 16},
  label: {color: colors.muted, fontSize: 13, marginTop: 16, marginBottom: 6},
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.foreground,
    fontSize: 16,
  },
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  emojiChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {borderColor: colors.primary, backgroundColor: `${colors.primary}22`},
  chipText: {color: colors.foreground, fontSize: 14, fontWeight: '500'},
  error: {color: colors.destructive, marginTop: 16},
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  buttonText: {color: '#fff', fontWeight: '700', fontSize: 16},
});
