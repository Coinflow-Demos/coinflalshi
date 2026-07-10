import {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';
import {apiFetch} from '@/lib/api';
import {useAuth} from '@/lib/auth-context';
import {colors} from '@/constants/theme';

interface Outcome {
  id: string;
  label: string;
  priceCents: number;
}

interface Market {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  status: string;
  outcomes: Outcome[];
}

export default function MarketDetailScreen() {
  const {slug} = useLocalSearchParams<{slug: string}>();
  const {token} = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [amount, setAmount] = useState('10');
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{market: Market}>(`/api/markets/${slug}`).then((data) => {
      setMarket(data.market);
      setSelectedOutcomeId(data.market.outcomes[0]?.id ?? null);
    });
  }, [slug]);

  if (!market) return null;

  const selectedOutcome = market.outcomes.find((outcome) => outcome.id === selectedOutcomeId);
  const amountCents = Math.round(Number(amount) * 100);
  const shares = selectedOutcome ? Math.floor(amountCents / selectedOutcome.priceCents) : 0;

  async function placeBet() {
    if (!token) {
      router.push('/login');
      return;
    }
    if (!selectedOutcomeId) return;
    setStatus('Placing bet…');
    try {
      await apiFetch(`/api/markets/${slug}/bet`, {
        method: 'POST',
        token,
        body: {outcomeId: selectedOutcomeId, amountCents},
      });
      setStatus(`Bought ${shares} shares of ${selectedOutcome?.label}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something went wrong');
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{padding: 16}}>
      <Text style={styles.category}>{market.category}</Text>
      <Text style={styles.title}>{market.title}</Text>
      {market.subtitle && <Text style={styles.subtitle}>{market.subtitle}</Text>}

      <View style={{marginTop: 20, gap: 8}}>
        {market.outcomes.map((outcome) => (
          <Pressable
            key={outcome.id}
            onPress={() => setSelectedOutcomeId(outcome.id)}
            style={[styles.outcomeButton, selectedOutcomeId === outcome.id && styles.outcomeButtonSelected]}
          >
            <Text style={styles.outcomeLabel}>{outcome.label}</Text>
            <Text style={styles.outcomePrice}>{outcome.priceCents}¢</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.fieldLabel}>Amount (USD)</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        placeholderTextColor={colors.muted}
      />

      <View style={styles.summary}>
        <Text style={styles.summaryText}>Shares</Text>
        <Text style={styles.summaryValue}>{shares}</Text>
      </View>

      {status && <Text style={styles.status}>{status}</Text>}

      <Pressable style={styles.buyButton} onPress={placeBet}>
        <Text style={styles.buyButtonText}>{token ? 'Buy shares' : 'Log in to trade'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  category: {color: colors.muted, fontSize: 12, textTransform: 'uppercase', fontWeight: '600'},
  title: {color: colors.foreground, fontSize: 24, fontWeight: '700', marginTop: 4},
  subtitle: {color: colors.muted, fontSize: 14, marginTop: 4},
  outcomeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outcomeButtonSelected: {borderColor: colors.primary, backgroundColor: `${colors.primary}22`},
  outcomeLabel: {color: colors.foreground, fontSize: 15, fontWeight: '500'},
  outcomePrice: {color: colors.foreground, fontSize: 16, fontWeight: '700'},
  fieldLabel: {color: colors.muted, fontSize: 13, marginTop: 20, marginBottom: 6},
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.foreground,
    fontSize: 16,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  summaryText: {color: colors.muted},
  summaryValue: {color: colors.foreground, fontWeight: '700'},
  status: {color: colors.foreground, marginTop: 12, textAlign: 'center'},
  buyButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buyButtonText: {color: '#fff', fontWeight: '700', fontSize: 16},
});
