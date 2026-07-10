import {useEffect, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
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
  outcome: {label: string};
}

export default function PortfolioScreen() {
  const {token} = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    if (!token) return;
    apiFetch<{positions: Position[]}>('/api/positions', {token}).then((data) =>
      setPositions(data.positions)
    );
  }, [token]);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={positions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.header}>Portfolio</Text>}
        ListEmptyComponent={<Text style={styles.emptyText}>No trades yet.</Text>}
        renderItem={({item}) => (
          <View style={styles.card}>
            <View style={{flex: 1}}>
              <Text style={styles.marketTitle}>{item.market.title}</Text>
              <Text style={styles.detail}>
                {item.outcome.label} · {item.shares} shares @ {item.entryPriceCents}¢
              </Text>
            </View>
            <Text style={styles.status}>{item.status}</Text>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  marketTitle: {color: colors.foreground, fontWeight: '600'},
  detail: {color: colors.muted, fontSize: 13, marginTop: 2},
  status: {color: colors.primary, fontWeight: '700', fontSize: 12},
  emptyText: {color: colors.muted},
  loginButton: {backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10},
  loginButtonText: {color: '#fff', fontWeight: '700'},
});
