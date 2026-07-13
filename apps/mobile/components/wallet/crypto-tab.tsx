import {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {apiFetch} from '@/lib/api';
import {useAuth} from '@/lib/auth-context';
import {colors} from '@/constants/theme';

const CHAIN_LABELS: Record<string, string> = {
  solana: 'Solana',
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  base: 'Base',
  arbitrum: 'Arbitrum',
  stellar: 'Stellar',
};

const POLL_INTERVAL_MS = 4000;

export function CryptoTab({onDeposited}: {onDeposited: () => void}) {
  const {token} = useAuth();
  const [chains, setChains] = useState<string[]>([]);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creditedCents, setCreditedCents] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiFetch<{chains: string[]}>('/api/wallet/crypto/chains')
      .then((data) => setChains(data.chains ?? []))
      .catch(() => {});
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startWatchingForDeposit(startingBalanceCents: number) {
    if (pollRef.current) clearInterval(pollRef.current);
    setCreditedCents(null);

    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch<{balanceCents: number}>('/api/wallet', {token});
        if (data.balanceCents > startingBalanceCents) {
          setCreditedCents(data.balanceCents - startingBalanceCents);
          if (pollRef.current) clearInterval(pollRef.current);
          onDeposited();
        }
      } catch {
        // transient — next poll will retry
      }
    }, POLL_INTERVAL_MS);
  }

  async function selectChain(chain: string) {
    setSelectedChain(chain);
    setAddress(null);
    setError(null);
    setLoading(true);
    if (pollRef.current) clearInterval(pollRef.current);
    setCreditedCents(null);
    try {
      const data = await apiFetch<{address: string}>('/api/wallet/crypto/address', {
        method: 'POST',
        token,
        body: {chain, token: 'usdc'},
      });
      setAddress(data.address);

      const walletData = await apiFetch<{balanceCents: number}>('/api/wallet', {token});
      startWatchingForDeposit(walletData.balanceCents ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a deposit address');
    } finally {
      setLoading(false);
    }
  }

  async function copyAddress() {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={{gap: 14}}>
      <View>
        <Text style={styles.label}>Choose a network</Text>
        <View style={styles.chipGrid}>
          {chains.map((chain) => (
            <Pressable
              key={chain}
              onPress={() => selectChain(chain)}
              style={[styles.chip, selectedChain === chain && styles.chipSelected]}
            >
              <Text style={styles.chipText}>{CHAIN_LABELS[chain] ?? chain}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading && <Text style={styles.muted}>Generating your deposit address…</Text>}
      {error && <Text style={styles.error}>{error}</Text>}

      {creditedCents !== null && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>
            Deposit received — ${(creditedCents / 100).toFixed(2)} added to your balance!
          </Text>
        </View>
      )}

      {address && selectedChain && (
        <View style={styles.addressBox}>
          <Text style={styles.muted}>
            Send USDC on {CHAIN_LABELS[selectedChain] ?? selectedChain} to this address. Your balance
            updates automatically once the deposit confirms.
          </Text>
          <Text selectable style={styles.addressText}>
            {address}
          </Text>
          <Pressable style={styles.copyButton} onPress={copyAddress}>
            <Text style={styles.copyButtonText}>{copied ? 'Copied!' : 'Copy address'}</Text>
          </Pressable>
          {creditedCents === null && <Text style={styles.watchingText}>Watching for your deposit…</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {color: colors.muted, fontSize: 13, marginBottom: 6},
  chipGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12},
  chipSelected: {borderColor: colors.primary, backgroundColor: `${colors.primary}22`},
  chipText: {color: colors.foreground, fontSize: 13, fontWeight: '500'},
  muted: {color: colors.muted, fontSize: 12},
  error: {color: colors.destructive, fontSize: 13},
  successBox: {backgroundColor: `${colors.success}22`, borderRadius: 10, padding: 12},
  successText: {color: colors.success, fontSize: 13, fontWeight: '600'},
  addressBox: {backgroundColor: colors.card, borderRadius: 10, padding: 14, gap: 8},
  addressText: {color: colors.foreground, fontSize: 13, backgroundColor: colors.background, padding: 10, borderRadius: 8},
  copyButton: {backgroundColor: colors.background, borderRadius: 8, paddingVertical: 10, alignItems: 'center'},
  copyButtonText: {color: colors.foreground, fontWeight: '600', fontSize: 13},
  watchingText: {color: colors.muted, fontSize: 11},
});
