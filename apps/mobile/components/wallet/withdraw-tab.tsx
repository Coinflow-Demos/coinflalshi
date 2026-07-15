import {useCallback, useEffect, useRef, useState} from 'react';
import {Linking, Modal, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import {apiFetch} from '@/lib/api';
import {useAuth} from '@/lib/auth-context';
import {colors} from '@/constants/theme';

interface LinkedPayoutMethod {
  token: string;
  speed: string;
  label: string;
}

type AccountsState =
  | {status: 'loading'}
  | {status: 'error'; message: string}
  | {status: 'verification_required'; verificationLink: string}
  | {status: 'ok'; methods: LinkedPayoutMethod[]};

export function WithdrawTab({balanceCents}: {balanceCents: number}) {
  const {token} = useAuth();
  const [accounts, setAccounts] = useState<AccountsState>({status: 'loading'});
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Reused across retries of the same amount/account so a network-level retry
  // hits Coinflow's own idempotency dedup instead of risking a second payout.
  const lastAttemptRef = useRef<{amountCents: number; token: string; idempotencyKey: string} | null>(null);

  const loadAccounts = useCallback(
    async (silent = false) => {
      if (!silent) setAccounts({status: 'loading'});
      try {
        const data = await apiFetch<
          {status: 'ok'; methods: LinkedPayoutMethod[]} | {status: 'verification_required'; verificationLink: string}
        >('/api/wallet/withdraw/accounts', {token});
        if (data.status === 'verification_required') {
          setAccounts(data);
          return;
        }
        setAccounts(data);
        setSelectedToken((current) => current ?? data.methods[0]?.token ?? null);
      } catch (e) {
        setAccounts({status: 'error', message: e instanceof Error ? e.message : 'Could not load linked accounts'});
      }
    },
    [token]
  );

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (accounts.status !== 'verification_required') return;
    const interval = setInterval(() => loadAccounts(true), 8000);
    return () => clearInterval(interval);
  }, [accounts.status, loadAccounts]);

  async function handleStartLinking() {
    setError(null);
    try {
      const data = await apiFetch<{url: string}>('/api/wallet/withdraw/link', {token});
      setLinkUrl(data.url);
      setLinking(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start account linking');
    }
  }

  async function handleSubmit() {
    if (!selectedToken || accounts.status !== 'ok') return;
    const method = accounts.methods.find((m) => m.token === selectedToken);
    if (!method) return;

    const amountCents = Math.round(Number(amount) * 100);
    const last = lastAttemptRef.current;
    const idempotencyKey =
      last && last.amountCents === amountCents && last.token === method.token
        ? last.idempotencyKey
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    lastAttemptRef.current = {amountCents, token: method.token, idempotencyKey};

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/wallet/withdraw/request', {
        method: 'POST',
        token,
        body: {
          amountCents,
          token: method.token,
          speed: method.speed,
          idempotencyKey,
        },
      });
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit payout request');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <View style={styles.center}>
        <Text style={styles.successTitle}>Payout requested</Text>
        <Text style={styles.successSubtitle}>
          Your funds are on the way — payouts typically settle in 1-3 business days.
        </Text>
      </View>
    );
  }

  return (
    <View style={{gap: 14}}>
      {linking && linkUrl && (
        <Modal visible animationType="slide" onRequestClose={() => setLinking(false)}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderText}>Link a payout method</Text>
              <Pressable onPress={() => setLinking(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </Pressable>
            </View>
            <WebView
              source={{uri: linkUrl}}
              style={{flex: 1}}
              onMessage={(event) => {
                try {
                  const parsed = JSON.parse(event.nativeEvent.data);
                  if (parsed.method === 'accountLinked') {
                    setLinking(false);
                    setLinkUrl(null);
                    loadAccounts();
                  }
                } catch {
                  // not JSON — ignore
                }
              }}
            />
          </SafeAreaView>
        </Modal>
      )}

      <Text style={styles.balanceText}>
        Available balance: <Text style={{fontWeight: '700'}}>${(balanceCents / 100).toFixed(2)}</Text>
      </Text>

      {accounts.status === 'loading' && <Text style={styles.muted}>Loading linked accounts…</Text>}
      {accounts.status === 'error' && <Text style={styles.error}>{accounts.message}</Text>}

      {accounts.status === 'verification_required' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Verification required</Text>
          <Text style={styles.muted}>
            Coinflow needs a bit more information before you can withdraw funds. This checks
            automatically once you're done — or refresh manually below.
          </Text>
          <View style={{flexDirection: 'row', gap: 16, marginTop: 8}}>
            <Pressable onPress={() => Linking.openURL(accounts.verificationLink)}>
              <Text style={styles.link}>Complete verification</Text>
            </Pressable>
            <Pressable onPress={() => loadAccounts()}>
              <Text style={styles.linkMuted}>Refresh</Text>
            </Pressable>
          </View>
        </View>
      )}

      {accounts.status === 'ok' && (
        <>
          {accounts.methods.length === 0 ? (
            <Text style={styles.muted}>No payout methods linked yet — link a bank account or card to withdraw.</Text>
          ) : (
            <View style={{gap: 8}}>
              <Text style={styles.label}>Payout method</Text>
              {accounts.methods.map((method) => (
                <Pressable
                  key={method.token}
                  onPress={() => setSelectedToken(method.token)}
                  style={[styles.methodRow, selectedToken === method.token && styles.methodRowSelected]}
                >
                  <Text style={styles.methodText}>{method.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Pressable style={styles.linkButton} onPress={handleStartLinking}>
            <Text style={styles.linkButtonText}>+ Link a bank account or card</Text>
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}

          {accounts.methods.length > 0 && (
            <>
              <View>
                <Text style={styles.label}>Amount (USD)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  placeholderTextColor={colors.muted}
                />
              </View>
              <Pressable
                style={[styles.button, (submitting || !selectedToken) && {opacity: 0.6}]}
                onPress={handleSubmit}
                disabled={submitting || !selectedToken}
              >
                <Text style={styles.buttonText}>{submitting ? 'Submitting…' : 'Request payout'}</Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40},
  successTitle: {color: colors.foreground, fontSize: 18, fontWeight: '700'},
  successSubtitle: {color: colors.muted, fontSize: 13, textAlign: 'center'},
  balanceText: {color: colors.muted, fontSize: 14},
  muted: {color: colors.muted, fontSize: 13},
  error: {color: colors.destructive, fontSize: 13},
  label: {color: colors.muted, fontSize: 13, marginBottom: 4},
  card: {backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 6},
  cardTitle: {color: colors.foreground, fontWeight: '600', fontSize: 14},
  link: {color: colors.primary, fontWeight: '600', fontSize: 13},
  linkMuted: {color: colors.muted, fontWeight: '600', fontSize: 13},
  methodRow: {borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12},
  methodRowSelected: {borderColor: colors.primary, backgroundColor: `${colors.primary}22`},
  methodText: {color: colors.foreground, fontWeight: '500', fontSize: 14},
  linkButton: {borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, alignItems: 'center'},
  linkButtonText: {color: colors.foreground, fontSize: 13, fontWeight: '600'},
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.foreground,
    fontSize: 16,
  },
  button: {backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center'},
  buttonText: {color: '#fff', fontWeight: '700', fontSize: 16},
  modalContainer: {flex: 1, backgroundColor: '#fff'},
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  modalHeaderText: {fontSize: 15, fontWeight: '600', color: '#111827'},
  modalClose: {color: colors.primary, fontWeight: '600'},
});
