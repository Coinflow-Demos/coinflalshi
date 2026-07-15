import {useEffect, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View} from 'react-native';
import {CoinflowCardForm, CoinflowCvvForm, type CardFormNativeRef} from '@coinflowlabs/react-native';
import {apiFetch} from '@/lib/api';
import {useAuth} from '@/lib/auth-context';
import {colors} from '@/constants/theme';
import {COINFLOW_CHECKOUT_THEME} from '@/constants/coinflow-theme';
import {get3DsBrowserParams} from '@/lib/browser-signals';
import {BillingFields, EMPTY_BILLING, type Billing} from './billing-fields';
import {ThreeDsChallengeModal} from './three-ds-challenge-modal';

const MERCHANT_ID = 'predictionmarketmoon';

interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: string;
  expYear: string;
}

interface NewCardChallengeState {
  kind: 'new-card';
  transactionId: string;
  creq: string;
  url: string;
  pendingTransactionId: string;
}

interface SavedCardChallengeState {
  kind: 'saved-card';
  transactionId: string;
  creq: string;
  url: string;
  pendingTransactionId: string;
}

interface CardOnFileChallengeState {
  kind: 'card-on-file';
  transactionId: string;
  creq: string;
  url: string;
  pendingTransactionId: string;
}

type ChallengeState = NewCardChallengeState | SavedCardChallengeState | CardOnFileChallengeState;

export function DepositTab({onDeposited}: {onDeposited: () => void}) {
  const {token, user} = useAuth();
  const cardFormRef = useRef<CardFormNativeRef>(null);
  const cvvFormRef = useRef<CardFormNativeRef>(null);

  const [amount, setAmount] = useState('25');
  const [billing, setBilling] = useState<Billing>({...EMPTY_BILLING, email: user?.email ?? ''});
  const [saveCard, setSaveCard] = useState(false);

  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [mode, setMode] = useState<'new' | string>('new');
  const [savedCardToken, setSavedCardToken] = useState<string | null>(null);
  // null while checking — treated as "not authorized" so the CVV form stays
  // the default until we know a no-CVV charge is actually possible.
  const [cardOnFileAuthorized, setCardOnFileAuthorized] = useState<boolean | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);

  const amountCents = Math.round(Number(amount) * 100);

  useEffect(() => {
    if (!token) return;
    apiFetch<{savedPaymentMethods: SavedPaymentMethod[]}>('/api/wallet/payment-methods', {token})
      .then((data) => setSavedMethods(data.savedPaymentMethods))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (mode === 'new' || !token) {
      setSavedCardToken(null);
      setCardOnFileAuthorized(null);
      return;
    }
    setSavedCardToken(null);
    setCardOnFileAuthorized(null);
    apiFetch<{cardToken: string}>(`/api/wallet/payment-methods/${mode}`, {token})
      .then((data) => setSavedCardToken(data.cardToken))
      .catch(() => {});
    // Coinflow recommends checking this before offering a no-CVV charge —
    // it can be false for reasons ranging from an expired verification
    // window to the feature not being enabled on the merchant yet.
    apiFetch<{authorized: boolean}>(`/api/wallet/payment-methods/${mode}/card-on-file-authorized`, {token})
      .then((data) => setCardOnFileAuthorized(Boolean(data.authorized)))
      .catch(() => setCardOnFileAuthorized(false));
  }, [mode, token]);

  function updateBilling<K extends keyof Billing>(key: K, value: Billing[K]) {
    setBilling((prev) => ({...prev, [key]: value}));
  }

  async function handlePayNewCard() {
    const {token: cardToken, expMonth, expYear, forterToken} = (await cardFormRef.current?.tokenize()) ?? {};
    if (!cardToken || !expMonth || !expYear) {
      setError('Enter your card details before continuing');
      return;
    }

    const data = await apiFetch<{
      status: string;
      transactionId?: string;
      creq?: string;
      url?: string;
      pendingTransactionId: string;
    }>('/api/wallet/deposit/charge', {
      method: 'POST',
      token,
      body: {
        amountCents,
        cardToken,
        expMonth,
        expYear,
        billing,
        authentication3DS: get3DsBrowserParams(),
        forterToken,
        saveCard,
      },
    });

    if (data.status === 'challenge') {
      setChallenge({
        kind: 'new-card',
        transactionId: data.transactionId!,
        creq: data.creq!,
        url: data.url!,
        pendingTransactionId: data.pendingTransactionId,
      });
      return;
    }

    setSuccess(true);
  }

  async function handlePaySavedCard() {
    if (!savedCardToken) {
      setError('Loading card — try again in a moment');
      return;
    }
    const {token: cvvVerifiedToken, forterToken} = (await cvvFormRef.current?.tokenize()) ?? {};
    if (!cvvVerifiedToken) {
      setError('Enter your CVV before continuing');
      return;
    }

    const data = await apiFetch<{
      status: string;
      transactionId?: string;
      creq?: string;
      url?: string;
      pendingTransactionId: string;
    }>('/api/wallet/deposit/charge-saved', {
      method: 'POST',
      token,
      body: {
        amountCents,
        cvvVerifiedToken,
        authentication3DS: get3DsBrowserParams(),
        forterToken,
      },
    });

    if (data.status === 'challenge') {
      setChallenge({
        kind: 'saved-card',
        transactionId: data.transactionId!,
        creq: data.creq!,
        url: data.url!,
        pendingTransactionId: data.pendingTransactionId,
      });
      return;
    }

    setSuccess(true);
  }

  async function handlePayCardOnFile() {
    const data = await apiFetch<{
      status: string;
      transactionId?: string;
      creq?: string;
      url?: string;
      pendingTransactionId: string;
    }>('/api/wallet/deposit/charge-card-on-file', {
      method: 'POST',
      token,
      body: {
        amountCents,
        savedPaymentMethodId: mode,
        authentication3DS: get3DsBrowserParams(),
      },
    });

    if (data.status === 'challenge') {
      setChallenge({
        kind: 'card-on-file',
        transactionId: data.transactionId!,
        creq: data.creq!,
        url: data.url!,
        pendingTransactionId: data.pendingTransactionId,
      });
      return;
    }

    setSuccess(true);
  }

  async function handlePay() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'new') {
        await handlePayNewCard();
      } else if (cardOnFileAuthorized) {
        await handlePayCardOnFile();
      } else {
        await handlePaySavedCard();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChallengeComplete(threeDsTransactionId: string) {
    if (!challenge) return;
    setSubmitting(true);
    setError(null);
    try {
      const completeUrl = {
        'new-card': '/api/wallet/deposit/charge/complete',
        'saved-card': '/api/wallet/deposit/charge-saved/complete',
        'card-on-file': '/api/wallet/deposit/charge-card-on-file/complete',
      }[challenge.kind];
      await apiFetch(completeUrl, {
        method: 'POST',
        token,
        body: {
          pendingTransactionId: challenge.pendingTransactionId,
          threeDsTransactionId,
        },
      });
      setChallenge(null);
      setSuccess(true);
    } catch (e) {
      setChallenge(null);
      setError(e instanceof Error ? e.message : 'Payment failed after verification');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <View style={styles.center}>
        <Text style={styles.successTitle}>Deposit received</Text>
        <Text style={styles.successSubtitle}>Your balance will update in a few seconds.</Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            setSuccess(false);
            onDeposited();
          }}
        >
          <Text style={styles.buttonText}>Refresh balance</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{gap: 14, paddingBottom: 24}}>
      {challenge && (
        <ThreeDsChallengeModal
          url={challenge.url}
          creq={challenge.creq}
          transactionId={challenge.transactionId}
          onComplete={handleChallengeComplete}
          onClose={() => setChallenge(null)}
        />
      )}

      <View>
        <Text style={styles.label}>Amount to deposit (USD)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          placeholderTextColor={colors.muted}
        />
      </View>
      <View style={styles.presetRow}>
        {[10, 25, 100, 250].map((preset) => (
          <Pressable key={preset} style={styles.presetButton} onPress={() => setAmount(String(preset))}>
            <Text style={styles.presetText}>${preset}</Text>
          </Pressable>
        ))}
      </View>

      {savedMethods.length > 0 && (
        <View style={styles.chipRow}>
          {savedMethods.map((method) => (
            <Pressable
              key={method.id}
              onPress={() => setMode(method.id)}
              style={[styles.chip, mode === method.id && styles.chipSelected]}
            >
              <Text style={styles.chipText}>
                {method.brand} •••• {method.last4}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setMode('new')} style={[styles.chip, mode === 'new' && styles.chipSelected]}>
            <Text style={styles.chipText}>+ New card</Text>
          </Pressable>
        </View>
      )}

      {mode === 'new' ? (
        <>
          <BillingFields billing={billing} onChange={updateBilling} />
          <View>
            <Text style={styles.label}>Card</Text>
            <View style={styles.cardFormBox}>
              <CoinflowCardForm ref={cardFormRef} merchantId={MERCHANT_ID} env="sandbox" theme={COINFLOW_CHECKOUT_THEME} />
            </View>
          </View>
          <View style={styles.switchRow}>
            <Switch value={saveCard} onValueChange={setSaveCard} trackColor={{true: colors.primary}} />
            <Text style={styles.switchLabel}>Save this card for future deposits</Text>
          </View>
        </>
      ) : cardOnFileAuthorized ? (
        <Text style={styles.switchLabel}>This card is on file — no need to re-enter your CVV.</Text>
      ) : (
        <View>
          <Text style={styles.label}>Re-enter your CVV to confirm</Text>
          <View style={styles.cardFormBox}>
            {savedCardToken ? (
              <CoinflowCvvForm
                ref={cvvFormRef}
                token={savedCardToken}
                merchantId={MERCHANT_ID}
                env="sandbox"
                theme={COINFLOW_CHECKOUT_THEME}
              />
            ) : (
              <Text style={{color: colors.muted, padding: 8}}>Loading…</Text>
            )}
          </View>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, (submitting || amountCents < 100) && {opacity: 0.6}]}
        onPress={handlePay}
        disabled={submitting || amountCents < 100}
      >
        <Text style={styles.buttonText}>{submitting ? 'Processing…' : 'Pay'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40},
  successTitle: {color: colors.foreground, fontSize: 18, fontWeight: '700'},
  successSubtitle: {color: colors.muted, fontSize: 13},
  label: {color: colors.muted, fontSize: 13, marginBottom: 6},
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    color: colors.foreground,
    fontSize: 16,
  },
  presetRow: {flexDirection: 'row', gap: 8},
  presetButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  presetText: {color: colors.foreground, fontSize: 14, fontWeight: '600'},
  chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12},
  chipSelected: {borderColor: colors.primary, backgroundColor: `${colors.primary}22`},
  chipText: {color: colors.foreground, fontSize: 13, fontWeight: '500'},
  cardFormBox: {borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.background, padding: 4},
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  switchLabel: {color: colors.muted, fontSize: 13, flex: 1},
  error: {color: colors.destructive, fontSize: 13},
  button: {backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center'},
  buttonText: {color: '#fff', fontWeight: '700', fontSize: 16},
});
