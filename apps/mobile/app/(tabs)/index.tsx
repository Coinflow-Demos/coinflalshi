import {useCallback, useEffect, useState} from 'react';
import {FlatList, Pressable, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {apiFetch} from '@/lib/api';
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
  imageEmoji: string | null;
  volumeCents: number;
  outcomes: Outcome[];
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={markets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={<Text style={styles.header}>Trending markets</Text>}
        renderItem={({item}) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push({pathname: '/market/[slug]', params: {slug: item.slug}})}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.emoji}>{item.imageEmoji ?? '🔮'}</Text>
              <View style={{flex: 1}}>
                <Text style={styles.category}>{item.category}</Text>
                <Text style={styles.title}>{item.title}</Text>
              </View>
            </View>
            <View style={styles.outcomes}>
              {item.outcomes.map((outcome) => (
                <View key={outcome.id} style={styles.outcomeRow}>
                  <Text style={styles.outcomeLabel}>{outcome.label}</Text>
                  <Text style={styles.outcomePrice}>{outcome.priceCents}¢</Text>
                </View>
              ))}
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  list: {padding: 16, gap: 12},
  header: {fontSize: 28, fontWeight: '700', color: colors.foreground, marginBottom: 12},
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginBottom: 12,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12},
  emoji: {fontSize: 24},
  category: {color: colors.muted, fontSize: 11, textTransform: 'uppercase', fontWeight: '600'},
  title: {color: colors.foreground, fontSize: 16, fontWeight: '600'},
  outcomes: {gap: 6},
  outcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  outcomeLabel: {color: colors.foreground, fontSize: 14, fontWeight: '500'},
  outcomePrice: {color: colors.foreground, fontSize: 14, fontWeight: '700'},
});
