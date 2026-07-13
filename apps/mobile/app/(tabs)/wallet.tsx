import {useCallback, useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {apiFetch} from '@/lib/api';
import {useAuth} from '@/lib/auth-context';
import {colors} from '@/constants/theme';
import {DepositTab} from '@/components/wallet/deposit-tab';
import {CryptoTab} from '@/components/wallet/crypto-tab';
import {WithdrawTab} from '@/components/wallet/withdraw-tab';
import {CardsTab} from '@/components/wallet/cards-tab';

const TABS = [
  {key: 'deposit', label: 'Deposit'},
  {key: 'crypto', label: 'Crypto'},
  {key: 'withdraw', label: 'Withdraw'},
  {key: 'cards', label: 'Cards'},
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function WalletScreen() {
  const {token} = useAuth();
  const [active, setActive] = useState<TabKey>('deposit');
  const [balanceCents, setBalanceCents] = useState(0);

  const loadWallet = useCallback(async () => {
    if (!token) return;
    const data = await apiFetch<{balanceCents: number}>('/api/wallet', {token});
    setBalanceCents(data.balanceCents);
  }, [token]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  if (!token) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyText}>Log in to view your wallet.</Text>
        <Pressable style={styles.loginButton} onPress={() => router.push('/login')}>
          <Text style={styles.loginButtonText}>Log in</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{padding: 16}}>
        <Text style={styles.header}>Wallet</Text>
        <Text style={styles.balance}>${(balanceCents / 100).toFixed(2)}</Text>

        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActive(tab.key)}
              style={[styles.tabButton, active === tab.key && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, active === tab.key && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {active === 'deposit' && <DepositTab onDeposited={loadWallet} />}
        {active === 'crypto' && <CryptoTab onDeposited={loadWallet} />}
        {active === 'withdraw' && <WithdrawTab balanceCents={balanceCents} />}
        {active === 'cards' && <CardsTab />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  center: {flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16},
  header: {fontSize: 28, fontWeight: '700', color: colors.foreground},
  balance: {fontSize: 36, fontWeight: '800', color: colors.foreground, marginTop: 4, marginBottom: 20},
  tabBar: {flexDirection: 'row', backgroundColor: colors.card, borderRadius: 10, padding: 4, marginBottom: 20, gap: 4},
  tabButton: {flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center'},
  tabButtonActive: {backgroundColor: colors.background},
  tabButtonText: {color: colors.muted, fontSize: 13, fontWeight: '600'},
  tabButtonTextActive: {color: colors.foreground},
  emptyText: {color: colors.muted},
  loginButton: {backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10},
  loginButtonText: {color: '#fff', fontWeight: '700'},
});
