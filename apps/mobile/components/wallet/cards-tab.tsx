import {useEffect, useRef, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {CoinflowCardForm, type CardFormNativeRef} from '@coinflowlabs/react-native';
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

interface ChallengeState {
  transactionId: string;
  creq: string;
  url: string;
  cardToken: string;
  expMonth: string;
  expYear: string;
}

export function CardsTab() {
  const {token, user} = useAuth();
  const cardFormRef = useRef<CardFormNativeRef>(null);

  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [adding, setAdding] = useState(false);
  const [billing, setBilling] = useState<Billing>({...EMPTY_BILLING, email: user?.email ?? ''});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);

  function loadSavedMethods() {
    if (!token) return;
    apiFetch<{savedPaymentMethods: SavedPaymentMethod[]}>('/api/wallet/payment-methods', {token})
      .then((data) => setSavedMethods(data.savedPaymentMethods))
      .catch(() => {});
  }

  useEffect(() => {
    loadSavedMethods();
  }, [token]);

  function updateBilling<K extends keyof Billing>(key: K, value: Billing[K]) {
    setBilling((prev) => ({...prev, [key]: value}));
  }

  async function handleRemove(id: string) {
    await apiFetch(`/api/wallet/payment-methods/${id}`, {method: 'DELETE', token});
    loadSavedMethods();
  }

  async function handleSaveCard() {
    setError(null);
    setSubmitting(true);
    try {
      const {token: cardToken, expMonth, expYear} = (await cardFormRef.current?.tokenize()) ?? {};
      if (!cardToken || !expMonth || !expYear) {
        setError('Enter your card details before continuing');
        return;
      }

      const data = await apiFetch<{status: string; transactionId?: string; creq?: string; url?: string}>(
        '/api/wallet/payment-methods/save',
        {
          method: 'POST',
          token,
          body: {
            cardToken,
            expMonth,
            expYear,
            billing,
            authentication3DS: get3DsBrowserParams(),
          },
        }
      );

      if (data.status === 'challenge') {
        setChallenge({
          transactionId: data.transactionId!,
          creq: data.creq!,
          url: data.url!,
          cardToken,
          expMonth,
          expYear,
        });
        return;
      }

      setAdding(false);
      loadSavedMethods();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save card');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChallengeComplete(threeDsTransactionId: string) {
    if (!challenge) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/wallet/payment-methods/save/complete', {
        method: 'POST',
        token,
        body: {
          threeDsTransactionId,
          cardToken: challenge.cardToken,
          expMonth: challenge.expMonth,
          expYear: challenge.expYear,
          billing,
        },
      });
      setChallenge(null);
      setAdding(false);
      loadSavedMethods();
    } catch (e) {
      setChallenge(null);
      setError(e instanceof Error ? e.message : 'Could not save card after verification');
    } finally {
      setSubmitting(false);
    }
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

      {savedMethods.length === 0 && !adding && <Text style={styles.muted}>No saved cards yet.</Text>}

      {savedMethods.map((method) => (
        <View key={method.id} style={styles.methodRow}>
          <Text style={styles.methodText}>
            {method.brand} •••• {method.last4}{' '}
            <Text style={styles.muted}>
              exp {method.expMonth}/{method.expYear}
            </Text>
          </Text>
          <Pressable onPress={() => handleRemove(method.id)}>
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      ))}

      {adding ? (
        <>
          <BillingFields billing={billing} onChange={updateBilling} />
          <View>
            <Text style={styles.label}>Card</Text>
            <View style={styles.cardFormBox}>
              <CoinflowCardForm ref={cardFormRef} merchantId={MERCHANT_ID} env="sandbox" theme={COINFLOW_CHECKOUT_THEME} />
            </View>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={{flexDirection: 'row', gap: 10}}>
            <Pressable style={styles.secondaryButton} onPress={() => setAdding(false)} disabled={submitting}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.button, {flex: 1}]} onPress={handleSaveCard} disabled={submitting}>
              <Text style={styles.buttonText}>{submitting ? 'Saving…' : 'Save card (no charge)'}</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Pressable style={styles.addButton} onPress={() => setAdding(true)}>
          <Text style={styles.addButtonText}>+ Add card</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  muted: {color: colors.muted, fontSize: 12},
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  methodText: {color: colors.foreground, fontWeight: '600', fontSize: 14},
  removeText: {color: colors.destructive, fontSize: 13, fontWeight: '600'},
  label: {color: colors.muted, fontSize: 13, marginBottom: 6},
  cardFormBox: {borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.background, padding: 4},
  error: {color: colors.destructive, fontSize: 13},
  button: {backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center'},
  buttonText: {color: '#fff', fontWeight: '700', fontSize: 15},
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  secondaryButtonText: {color: colors.foreground, fontWeight: '600', fontSize: 15},
  addButton: {borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 14, alignItems: 'center'},
  addButtonText: {color: colors.foreground, fontWeight: '600', fontSize: 15},
});
