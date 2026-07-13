import {useCallback, useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';
import {apiFetch} from '@/lib/api';
import {useAuth} from '@/lib/auth-context';
import {colors, getOutcomeColor} from '@/constants/theme';
import {PriceChart, type PricePoint} from '@/components/price-chart';

interface Outcome {
  id: string;
  label: string;
  priceCents: number;
  pricePoints: PricePoint[];
}

interface Activity {
  id: string;
  traderName: string;
  outcomeId: string;
  shares: number;
  priceCents: number;
  at: string;
}

interface Position {
  id: string;
  shares: number;
  entryPriceCents: number;
  createdAt: string;
  user: {name: string};
  outcome: {label: string};
}

interface Market {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  status: 'OPEN' | 'RESOLVING' | 'RESOLVED';
  closesAt: string;
  resolvedOutcomeId: string | null;
  volumeCents: number;
  outcomes: Outcome[];
  activity: Activity[];
  positions: Position[];
}

interface FeedItem {
  id: string;
  traderName: string;
  outcomeLabel: string;
  shares: number;
  priceCents: number;
  at: number;
}

function timeAgo(atMs: number, nowMs: number) {
  const seconds = Math.max(0, Math.round((nowMs - atMs) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}

export default function MarketDetailScreen() {
  const {slug} = useLocalSearchParams<{slug: string}>();
  const {token} = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [amount, setAmount] = useState('10');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{market: Market}>(`/api/markets/${slug}`);
    setMarket(data.market);
    setSelectedOutcomeId((current) => current ?? data.market.outcomes[0]?.id ?? null);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (!market) return null;

  const now = Date.now();
  const isOpen = market.status === 'OPEN' && new Date(market.closesAt).getTime() > now;
  const resolvedOutcome = market.outcomes.find((o) => o.id === market.resolvedOutcomeId);
  const selectedOutcome = market.outcomes.find((outcome) => outcome.id === selectedOutcomeId);
  const amountCents = Math.round(Number(amount) * 100);
  const shares =
    selectedOutcome && amountCents > 0 ? Math.floor(amountCents / selectedOutcome.priceCents) : 0;

  const feed: FeedItem[] = [
    ...market.activity.map((trade) => ({
      id: trade.id,
      traderName: trade.traderName,
      outcomeLabel: market.outcomes.find((o) => o.id === trade.outcomeId)?.label ?? '',
      shares: trade.shares,
      priceCents: trade.priceCents,
      at: new Date(trade.at).getTime(),
    })),
    ...market.positions.map((position) => ({
      id: position.id,
      traderName: position.user.name,
      outcomeLabel: position.outcome.label,
      shares: position.shares,
      priceCents: position.entryPriceCents,
      at: new Date(position.createdAt).getTime(),
    })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 15);

  async function placeBet() {
    if (!token) {
      router.push('/login');
      return;
    }
    if (!selectedOutcomeId || shares < 1) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await apiFetch(`/api/markets/${slug}/bet`, {
        method: 'POST',
        token,
        body: {outcomeId: selectedOutcomeId, amountCents},
      });
      setStatus(`Bought ${shares} shares of ${selectedOutcome?.label}`);
      await load();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{padding: 16}}>
      <Text style={styles.category}>{market.category}</Text>
      <Text style={styles.title}>{market.title}</Text>
      {market.subtitle && <Text style={styles.subtitle}>{market.subtitle}</Text>}

      <View style={styles.chartCard}>
        <PriceChart
          series={market.outcomes.map((o, index) => ({
            id: o.id,
            label: o.label,
            color: getOutcomeColor(index),
            points: o.pricePoints,
          }))}
        />
      </View>

      <View style={{marginTop: 16, gap: 8}}>
        {market.outcomes.map((outcome, index) => {
          const color = getOutcomeColor(index);
          const selected = selectedOutcomeId === outcome.id;
          const currentPrice = outcome.pricePoints.at(-1)?.priceCents ?? outcome.priceCents;
          return (
            <Pressable
              key={outcome.id}
              onPress={() => setSelectedOutcomeId(outcome.id)}
              style={[
                styles.outcomeButton,
                selected && {borderColor: color, backgroundColor: `${color}22`},
              ]}
            >
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                <View style={[styles.dot, {backgroundColor: color}]} />
                <Text style={styles.outcomeLabel}>{outcome.label}</Text>
              </View>
              <Text style={[styles.outcomePrice, {color}]}>{currentPrice}¢</Text>
            </Pressable>
          );
        })}
      </View>

      {isOpen ? (
        <>
          <Text style={styles.fieldLabel}>Amount (USD)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholderTextColor={colors.muted}
          />

          <View style={styles.summary}>
            <Text style={styles.summaryText}>Shares / payout if correct</Text>
            <Text style={styles.summaryValue}>
              {shares} shares · ${(shares).toFixed(2)}
            </Text>
          </View>

          {status && <Text style={styles.status}>{status}</Text>}

          <Pressable
            style={[styles.buyButton, (submitting || shares < 1) && {opacity: 0.6}]}
            onPress={placeBet}
            disabled={submitting || shares < 1}
          >
            <Text style={styles.buyButtonText}>
              {submitting ? 'Placing bet…' : token ? 'Buy shares' : 'Log in to trade'}
            </Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.closedBanner}>
          <Text style={styles.closedText}>
            {market.status === 'RESOLVED'
              ? `Resolved: ${resolvedOutcome?.label ?? '—'}`
              : 'This market has closed and is awaiting resolution.'}
          </Text>
        </View>
      )}

      {feed.length > 0 && (
        <View style={styles.feedCard}>
          <Text style={styles.feedHeader}>Recent activity</Text>
          {feed.map((item) => (
            <View key={item.id} style={styles.feedRow}>
              <Text style={styles.feedText} numberOfLines={1}>
                <Text style={{fontWeight: '600'}}>{item.traderName}</Text> bought {item.shares}{' '}
                {item.outcomeLabel} @ {item.priceCents}¢
              </Text>
              <Text style={styles.feedTime}>{timeAgo(item.at, now)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  category: {color: colors.muted, fontSize: 12, textTransform: 'uppercase', fontWeight: '600'},
  title: {color: colors.foreground, fontSize: 24, fontWeight: '700', marginTop: 4},
  subtitle: {color: colors.muted, fontSize: 14, marginTop: 4},
  chartCard: {
    marginTop: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  outcomeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {width: 8, height: 8, borderRadius: 4},
  outcomeLabel: {color: colors.foreground, fontSize: 15, fontWeight: '500'},
  outcomePrice: {fontSize: 16, fontWeight: '700'},
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
  summaryText: {color: colors.muted, flexShrink: 1},
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
  closedBanner: {backgroundColor: colors.card, borderRadius: 12, padding: 14, marginTop: 20},
  closedText: {color: colors.muted, fontSize: 14, textAlign: 'center'},
  feedCard: {
    marginTop: 24,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  feedHeader: {color: colors.foreground, fontWeight: '700', fontSize: 15, marginBottom: 10},
  feedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 8,
  },
  feedText: {color: colors.foreground, fontSize: 13, flex: 1},
  feedTime: {color: colors.muted, fontSize: 11},
});
