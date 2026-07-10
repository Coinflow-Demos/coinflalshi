import {NextResponse} from 'next/server';
import {getCoinflowSupportedChains} from '@/lib/coinflow/server';

// Fallback list mirrors Coinflow's documented passive-deposit-address chains,
// used if the live supported-chains lookup fails (e.g. credentials not yet configured).
const FALLBACK_CHAINS = ['solana', 'ethereum', 'polygon', 'base', 'arbitrum', 'stellar'];

export async function GET() {
  try {
    const {chains} = await getCoinflowSupportedChains();
    return NextResponse.json({chains});
  } catch {
    return NextResponse.json({chains: FALLBACK_CHAINS, fallback: true});
  }
}
