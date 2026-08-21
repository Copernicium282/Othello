import { Signature } from 'ethers'
import type { BrowserProvider, Contract, JsonRpcSigner } from 'ethers'

const SOMNIA_CHAIN_ID = 50312

export interface BatchCall {
  to: string
  data: string
  value?: string
}

export interface PermitSignature {
  v: number
  r: string
  s: string
  deadline: number
}

/** Off-chain ERC-2612 permit signature against YinYang (EIP-712). */
export async function signPermit(
  yyg: Contract,
  signer: JsonRpcSigner,
  owner: string,
  spender: string,
  value: bigint,
): Promise<PermitSignature> {
  const [nonce, block, network] = await Promise.all([
    yyg.nonces(owner),
    signer.provider.getBlock('latest'),
    signer.provider.getNetwork(),
  ])
  // SAFETY: getBlock('latest') is non-null on a live network; wall clock + 1h is the fallback deadline.
  const now = block?.timestamp ?? Math.floor(Date.now() / 1000)
  const deadline = now + 3600

  const sig = await signer.signTypedData(
    {
      name: 'YinYang',
      version: '1',
      chainId: Number(network.chainId),
      // SAFETY: yyg.target is the deployed YinYang address (AddressLike);
      // it is the literal constructor address, never a lazy Addressable.
      verifyingContract: yyg.target as string,
    },
    {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    { owner, spender, value, nonce, deadline },
  )

  const parsed = Signature.from(sig)
  return { v: parsed.v, r: parsed.r, s: parsed.s, deadline }
}

export interface CallsStatus {
  status: 'PENDING' | 'CONFIRMED' | 'FAILED'
  receipts?: Array<{
    chainId: string
    receipt: {
      status?: string
      logs: Array<{ topics: string[]; data: string }>
    }
  }>
}

/** Submit a batch via wallet_sendCalls (EIP-5792); gas is paid by the EOA. */
export async function sendCallsBatch(
  provider: BrowserProvider,
  account: string,
  calls: BatchCall[],
): Promise<string> {
  // SAFETY: wallet_sendCalls (EIP-5792) returns the bundle id string. No
  // paymasterService capability: gas comes from the EOA balance, and an
  // unsupported sponsor URL makes wallets reject the whole bundle.
  const bundleId = (await provider.send('wallet_sendCalls', [
    {
      version: '1.0',
      chainId: `0x${SOMNIA_CHAIN_ID.toString(16)}`,
      from: account,
      calls,
    },
  ])) as string
  return bundleId
}

/** Poll wallet_getCallsStatus until the batch settles. */
export async function waitForCalls(
  provider: BrowserProvider,
  bundleId: string,
): Promise<NonNullable<CallsStatus['receipts']>> {
  for (let attempt = 0; attempt < 30; attempt++) {
    // SAFETY: wallet_getCallsStatus (EIP-5792) returns { status, receipts }.
    const result = (await provider.send('wallet_getCallsStatus', [bundleId])) as CallsStatus
    if (result.status === 'CONFIRMED') {
      const receipts = result.receipts ?? []
      for (const entry of receipts) {
        // SAFETY: per EIP-5792, receipt.status is '0x1' (success) or '0x0'
        // (reverted); wallets may omit the field, treat missing as success.
        if (entry.receipt.status === '0x0') {
          throw new Error('Batched transaction call reverted')
        }
      }
      return receipts
    }
    if (result.status === 'FAILED') throw new Error('Batched transaction failed')
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw new Error('Timed out waiting for batched transaction')
}

export interface RpcError {
  code?: number
  message?: string
}

/** True when the wallet lacks wallet_sendCalls (e.g. pre-EIP-5792 MetaMask). */
export function isMethodNotFound(err: RpcError): boolean {
  // SAFETY: -32601 is JSON-RPC "method not found", the standard signal for an
  // unsupported method; some wallets report it in the message string instead.
  return err.code === -32601 || (err.message ?? '').toLowerCase().includes('not found')
}