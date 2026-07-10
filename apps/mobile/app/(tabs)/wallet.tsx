import {useEffect, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {CoinflowPurchase, PaymentMethods, SettlementType} from '@coinflowlabs/react-native';
import {apiFetch} from '@/lib/api';
import {useAuth} from '@/lib/auth-context';
import {colors} from '@/constants/theme';

interface DepositSession {
  sessionKey: string;
  jwtToken: string;
  pendingTransactionId: string;
  merchantId: string;
  applePayEnabled: boolean;
  googlePayEnabled: boolean;
}

export default function WalletScreen() {
  const {token, user} = useAuth();
  const [balanceCents, setBalanceCents] = useState(0);
  const [amount, setAmount] = useState('25');
  const [checkout, setCheckout] = useState<DepositSession | null>(null);

  async function loadWallet() {
    if (!token) return;
    const data = await apiFetch<{balanceCents: number}>('/api/wallet', {token});
    setBalanceCents(data.balanceCents);
  }

  useEffect(() => {
    loadWallet();
  }, [token]);

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

  async function startDeposit() {
    const amountCents = Math.round(Number(amount) * 100);
    const data = await apiFetch<DepositSession>('/api/wallet/deposit/init', {
      method: 'POST',
      token,
      body: {amountCents},
    });
    setCheckout(data);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{padding: 16}}>
        <Text style={styles.header}>Wallet</Text>
        <Text style={styles.balance}>${(balanceCents / 100).toFixed(2)}</Text>

        <Text style={styles.fieldLabel}>Deposit amount (USD)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          placeholderTextColor={colors.muted}
        />
        <Pressable style={styles.actionButton} onPress={startDeposit}>
          <Text style={styles.actionButtonText}>Add funds</Text>
        </Pressable>

        <Text style={styles.hint}>
          Crypto deposit addresses and bank payouts are available on the Coinflalshi website.
        </Text>
      </ScrollView>

      <Modal visible={!!checkout} animationType="slide">
        <SafeAreaView style={{flex: 1, backgroundColor: '#fff'}}>
          <Pressable style={styles.closeModal} onPress={() => setCheckout(null)}>
            <Text style={{color: colors.primary, fontWeight: '600'}}>Close</Text>
          </Pressable>
          {checkout && (
            <CoinflowPurchase
              style={{flex: 1}}
              env="sandbox"
              merchantId={checkout.merchantId}
              blockchain="user"
              sessionKey={checkout.sessionKey}
              jwtToken={checkout.jwtToken}
              subtotal={{cents: Math.round(Number(amount) * 100)}}
              email={user?.email}
              webhookInfo={{pendingTransactionId: checkout.pendingTransactionId}}
              settlementType={SettlementType.USDC}
              allowedPaymentMethods={[
                PaymentMethods.card,
                ...(checkout.applePayEnabled ? [PaymentMethods.applePay] : []),
                ...(checkout.googlePayEnabled ? [PaymentMethods.googlePay] : []),
              ]}
              theme={{
                primary: colors.primary,
                ctaColor: colors.primary,
                background: '#ffffff',
                backgroundAccent: '#F3F4F6',
                backgroundAccent2: '#E4E7EB',
                textColor: '#05092E',
                textColorAccent: '#030712',
                textColorAction: '#ffffff',
                font: 'Inter',
              }}
              onSuccess={() => {
                setCheckout(null);
                loadWallet();
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  center: {flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16},
  header: {fontSize: 28, fontWeight: '700', color: colors.foreground},
  balance: {fontSize: 36, fontWeight: '800', color: colors.foreground, marginTop: 4, marginBottom: 20},
  fieldLabel: {color: colors.muted, fontSize: 13, marginBottom: 6},
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.foreground,
    fontSize: 16,
  },
  actionButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  actionButtonText: {color: '#fff', fontWeight: '700', fontSize: 16},
  hint: {color: colors.muted, fontSize: 12, marginTop: 20, textAlign: 'center'},
  emptyText: {color: colors.muted},
  loginButton: {backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10},
  loginButtonText: {color: '#fff', fontWeight: '700'},
  closeModal: {padding: 16, alignItems: 'flex-end'},
});
