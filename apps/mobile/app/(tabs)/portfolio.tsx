import {useCallback, useEffect, useState} from 'react';
import {FlatList, Pressable, RefreshControl, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {apiFetch} from '@/lib/api';
import {useAuth} from '@/lib/auth-context';
import {colors} from '@/constants/theme';

interface Position {
  id: string;
  shares: number;
  entryPriceCents: number;
  costCents: number;
  payoutCents: number | null;
  status: 'OPEN' | 'WON' | 'LOST' | 'REFUNDED';
  market: {title: string};
  outcome: {label: string; priceCents: number; pricePoints: {priceCents: number}[]};
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function PortfolioScreen() {
  const {token} = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const data = await apiFetch<{positions: Position[]}>('/api/positions', {token});
    setPositions(data.positions);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyText}>Log in to see your positions.</Text>
        <Pressable style={styles.loginButton} onPress={() => router.push('/login')}>
          <Text style={styles.loginButtonText}>Log in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const rows = positions.map((position) => {
    const currentPriceCents = position.outcome.pricePoints[0]?.priceCents ?? position.outcome.priceCents;
    const currentValueCents =
      position.status === 'WON'
        ? position.payoutCents ?? 0
        : position.status === 'LOST'
          ? 0
          : position.shares * currentPriceCents;
    const pnlCents = currentValueCents - position.costCents;
    return {position, currentPriceCents, pnlCents};
  });

  const totalCostCents = rows.reduce((sum, r) => sum + r.position.costCents, 0);
  const totalPnlCents = rows.reduce((sum, r) => sum + r.pnlCents, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={rows}
        keyExtractor={({position}) => position.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.muted} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.header}>Portfolio</Text>
            {positions.length > 0 && (
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>INVESTED</Text>
                  <Text style={styles.statValue}>{formatCents(totalCostCents)}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>TOTAL P&L</Text>
                  <Text
                    style={[
                      styles.statValue,
                      {color: totalPnlCents >= 0 ? colors.success : colors.destructive},
                    ]}
                  >
                    {totalPnlCents >= 0 ? '+' : ''}
                    {formatCents(totalPnlCents)}
                  </Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>POSITIONS</Text>
                  <Text style={styles.statValue}>{positions.length}</Text>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            You haven't placed any trades yet — head to the markets tab to get started.
          </Text>
        }
        renderItem={({item: {position, currentPriceCents, pnlCents}}) => (
          <View style={styles.card}>
            <View style={{flex: 1}}>
              <Text style={styles.marketTitle} numberOfLines={1}>
                {position.market.title}
              </Text>
              <Text style={styles.detail}>
                {position.outcome.label} · {position.shares} shares @ {position.entryPriceCents}¢
                {position.status === 'OPEN' ? ` · now ${currentPriceCents}¢` : ''}
              </Text>
            </View>
            <View style={{alignItems: 'flex-end', gap: 2}}>
              <Text style={styles.amount}>
                {position.status === 'WON'
                  ? `+${formatCents(position.payoutCents ?? 0)}`
                  : formatCents(position.costCents)}
              </Text>
              {position.status !== 'LOST' && (
                <Text style={[styles.pnl, {color: pnlCents >= 0 ? colors.success : colors.destructive}]}>
                  {pnlCents >= 0 ? '▲ +' : '▼ '}
                  {formatCents(Math.abs(pnlCents))}
                </Text>
              )}
              <Text style={styles.status}>{position.status}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  center: {flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16},
  list: {padding: 16},
  header: {fontSize: 28, fontWeight: '700', color: colors.foreground, marginBottom: 12},
  statsRow: {flexDirection: 'row', gap: 8, marginBottom: 16},
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statLabel: {color: colors.muted, fontSize: 10, fontWeight: '600'},
  statValue: {color: colors.foreground, fontSize: 16, fontWeight: '700', marginTop: 2},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  marketTitle: {color: colors.foreground, fontWeight: '600'},
  detail: {color: colors.muted, fontSize: 13, marginTop: 2},
  amount: {color: colors.foreground, fontWeight: '700', fontSize: 13},
  pnl: {fontSize: 11, fontWeight: '700'},
  status: {color: colors.muted, fontWeight: '700', fontSize: 10, marginTop: 2},
  emptyText: {color: colors.muted},
  loginButton: {backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10},
  loginButtonText: {color: '#fff', fontWeight: '700'},
});
