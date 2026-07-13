import {useCallback, useEffect, useMemo, useState} from 'react';
import {FlatList, Pressable, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {Plus} from 'lucide-react-native';
import {apiFetch} from '@/lib/api';
import {colors, getOutcomeColor} from '@/constants/theme';

interface PricePoint {
  priceCents: number;
  at: string;
}

interface Outcome {
  id: string;
  label: string;
  priceCents: number;
  pricePoints: PricePoint[];
}

interface Market {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  category: string;
  imageEmoji: string | null;
  status: string;
  volumeCents: number;
  closesAt: string;
  outcomes: Outcome[];
}

function formatVolume(cents: number) {
  const dollars = cents / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

export default function MarketsScreen() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await apiFetch<{markets: Market[]}>('/api/markets?status=OPEN');
    setMarkets(data.markets);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const categories = useMemo(() => Array.from(new Set(markets.map((m) => m.category))), [markets]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={categories}
        keyExtractor={(category) => category}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.header}>Trending markets</Text>
            <Pressable style={styles.createButton} onPress={() => router.push('/markets/create')}>
              <Plus color="#fff" size={16} />
            </Pressable>
          </View>
        }
        renderItem={({item: category}) => (
          <View style={{marginBottom: 20}}>
            <Text style={styles.categoryHeader}>{category}</Text>
            {markets
              .filter((m) => m.category === category)
              .map((market) => {
                const outcome = market.outcomes[0];
                const priceCents = outcome?.pricePoints.at(-1)?.priceCents ?? outcome?.priceCents ?? 0;
                const firstCents = outcome?.pricePoints[0]?.priceCents ?? priceCents;
                const delta = priceCents - firstCents;
                const color = getOutcomeColor(0);
                return (
                  <Pressable
                    key={market.id}
                    style={styles.card}
                    onPress={() => router.push({pathname: '/market/[slug]', params: {slug: market.slug}})}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.emoji}>{market.imageEmoji ?? '🔮'}</Text>
                      <View style={{flex: 1}}>
                        <Text style={styles.title} numberOfLines={2}>
                          {market.title}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={[styles.price, {color}]}>{priceCents}¢</Text>
                      <Text style={[styles.delta, {color: delta >= 0 ? colors.success : colors.destructive}]}>
                        {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}¢
                      </Text>
                    </View>
                    <View style={styles.outcomes}>
                      {market.outcomes.map((o, index) => (
                        <View key={o.id} style={styles.outcomeRow}>
                          <Text style={styles.outcomeLabel}>{o.label}</Text>
                          <Text style={[styles.outcomePrice, {color: getOutcomeColor(index)}]}>
                            {o.pricePoints.at(-1)?.priceCents ?? o.priceCents}¢
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.volume}>{formatVolume(market.volumeCents)} volume</Text>
                  </Pressable>
                );
              })}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No open markets right now.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  list: {padding: 16},
  headerRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16},
  header: {fontSize: 26, fontWeight: '700', color: colors.foreground},
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHeader: {color: colors.foreground, fontSize: 16, fontWeight: '700', marginBottom: 10},
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10},
  emoji: {fontSize: 22},
  title: {color: colors.foreground, fontSize: 16, fontWeight: '600'},
  priceRow: {flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10},
  price: {fontSize: 26, fontWeight: '800'},
  delta: {fontSize: 13, fontWeight: '600'},
  outcomes: {gap: 6, marginBottom: 8},
  outcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  outcomeLabel: {color: colors.foreground, fontSize: 14, fontWeight: '500'},
  outcomePrice: {fontSize: 14, fontWeight: '700'},
  volume: {color: colors.muted, fontSize: 12},
  emptyText: {color: colors.muted, textAlign: 'center', marginTop: 40},
});
