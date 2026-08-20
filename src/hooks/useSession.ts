import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Interface, Wallet } from 'ethers'
import type { BrowserProvider, JsonRpcSigner } from 'ethers'
import { prepareTransaction, sendTransaction, signAuthorization } from 'thirdweb'
import type { Chain, Hex, ThirdwebClient } from 'thirdweb'
import { autoConnect, createWallet } from 'thirdweb/wallets'
import type { Account } from 'thirdweb/wallets'
import { ADDRESSES } from '../lib/contracts'
import type { Contracts } from './useContracts'

const SESSION_KEY_STORAGE = 'sessionKey'
const SOMNIA_CHAIN_ID = 50312

const SESSION_ABI = [
  'function session() view returns (address game,uint256 gameId,address sessionKey,uint256 expiryBlock,bool active)',
] as const

const REGISTER_SESSION_ABI = [
  'function registerSession(address game,uint256 gameId,address sessionKey,uint256 durationBlocks)',
] as const

const EXECUTE_MOVE_ABI = ['function executeMove(uint8 position)'] as const

export interface SessionKeyInfo {
  address: string
  privateKey: string
}

export interface SessionStatus {
  active: boolean
  expired: boolean
  sessionKey: string | null
  expiryBlock: bigint | null
}

export interface SessionResult {
  ok: boolean
  hash?: string
  reason?: string
}

interface InjectedAccountRef {
  current: Account | null
}

export interface SessionActions {
  isSessionActive: (gameId: string) => Promise<SessionStatus>
  submitMove: (gameId: string, position: number) => Promise<SessionResult>
}

export interface SessionApi extends SessionActions {
  sessionKey: SessionKeyInfo
  registerSession: (request: { gameId: string; durationBlocks: number }) => Promise<SessionResult>
  renewSession: (request: { gameId: string; durationBlocks: number }) => Promise<SessionResult>
  revokeSession: () => Promise<SessionResult>
}

export interface UseSessionOptions {
  client: ThirdwebClient
  chain: Chain
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  contracts: Contracts | null
  account: string | null
  gameId: string | null
}

/** Load the persisted session key from sessionStorage, or create and persist a fresh one. */
export function makeSessionKey(): SessionKeyInfo {
  const existing = sessionStorage.getItem(SESSION_KEY_STORAGE)
  if (existing) {
    try {
      // SAFETY: Wallet throws on a malformed private key; fall back to a fresh
      // key so corrupt storage never crashes the hook.
      return { address: new Wallet(existing).address, privateKey: existing }
    } catch {
      sessionStorage.removeItem(SESSION_KEY_STORAGE)
    }
  }
  const fresh = Wallet.createRandom()
  sessionStorage.setItem(SESSION_KEY_STORAGE, fresh.privateKey)
  return { address: fresh.address, privateKey: fresh.privateKey }
}

export function useSession(
  options: UseSessionOptions,
): SessionApi {
  const { client, chain, provider, signer, contracts, account } = options
  const [sessionKey, setSessionKey] = useState<SessionKeyInfo>(makeSessionKey)
  const previousAccountRef = useRef<string | null>(null)

  // Rotate the session key whenever the account switches to a different
  // address, or when sessionStorage holds a stale key from a prior session.
  useEffect(() => {
    const accountChanged =
      account !== null &&
      previousAccountRef.current !== null &&
      account !== previousAccountRef.current
    const persisted = sessionStorage.getItem(SESSION_KEY_STORAGE)
    const staleStorage = persisted !== null && persisted !== sessionKey.privateKey
    if (accountChanged || staleStorage) {
      const fresh = Wallet.createRandom()
      setSessionKey({ address: fresh.address, privateKey: fresh.privateKey })
      sessionStorage.setItem(SESSION_KEY_STORAGE, fresh.privateKey)
    }
    previousAccountRef.current = account
  }, [account, sessionKey.privateKey])

  /** Shared type-4 registration path: authorize the EOA, then register the given session key. */
  const runRegistration = useCallback(
    async (request: {
      gameId: string
      durationBlocks: number
      key: Wallet
    }): Promise<SessionResult> => {
      if (!ADDRESSES.sessionDelegate) return { ok: false, reason: 'not-deployed' }
      if (!provider || !contracts || !account) return { ok: false, reason: 'no-wallet' }
      try {
        const wallet = createWallet('io.metamask')
        const connected: InjectedAccountRef = { current: null }
        await autoConnect({
          client,
          chain,
          wallets: [wallet],
          onConnect: connectedWallet => {
            // SAFETY: an injected wallet that just auto-connected exposes its
            // account; the eth_requestAccounts permission was granted at connect.
            connected.current = connectedWallet.getAccount() ?? null
          },
        })
        if (!connected.current) return { ok: false, reason: 'unsupported' }
        const eoaAddress = connected.current.address
        const nonce = await provider.getTransactionCount(eoaAddress, 'latest')
        const authorization = await signAuthorization({
          account: connected.current,
          request: {
            address: ADDRESSES.sessionDelegate,
            chainId: SOMNIA_CHAIN_ID,
            nonce: BigInt(nonce),
          },
        })
        const registerIface = new Interface(REGISTER_SESSION_ABI)
        // SAFETY: encodeFunctionData always yields a 0x-prefixed hex string,
        // which is thirdweb's Hex type for transaction calldata.
        const data = registerIface.encodeFunctionData('registerSession', [
          ADDRESSES.game,
          BigInt(request.gameId),
          request.key.address,
          request.durationBlocks,
        ]) as Hex
        const transaction = prepareTransaction({
          chain,
          client,
          to: eoaAddress,
          data,
          authorizationList: [authorization],
        })
        await sendTransaction({ account: connected.current, transaction })
        return { ok: true }
      } catch {
        return { ok: false, reason: 'unsupported' }
      }
    },
    [client, chain, provider, contracts, account],
  )

  const registerSession = useCallback(
    async (request: { gameId: string; durationBlocks: number }): Promise<SessionResult> => {
      return runRegistration({
        gameId: request.gameId,
        durationBlocks: request.durationBlocks,
        key: new Wallet(sessionKey.privateKey),
      })
    },
    [sessionKey, runRegistration],
  )

  const renewSession = useCallback(
    async (request: { gameId: string; durationBlocks: number }): Promise<SessionResult> => {
      const fresh = Wallet.createRandom()
      setSessionKey({ address: fresh.address, privateKey: fresh.privateKey })
      sessionStorage.setItem(SESSION_KEY_STORAGE, fresh.privateKey)
      return runRegistration({
        gameId: request.gameId,
        durationBlocks: request.durationBlocks,
        // SAFETY: Wallet.createRandom() returns an HDNodeWallet; re-wrapping the
        // private key yields a plain Wallet matching runRegistration's key type.
        key: new Wallet(fresh.privateKey),
      })
    },
    [runRegistration],
  )

  const isSessionActive = useCallback(
    async (gameId: string): Promise<SessionStatus> => {
      const inactive: SessionStatus = {
        active: false,
        expired: false,
        sessionKey: null,
        expiryBlock: null,
      }
      if (!provider || !account) return inactive
      try {
        const sessionIface = new Interface(SESSION_ABI)
        const sessionSig = sessionIface.encodeFunctionData('session')
        const result = await provider.call({ to: account, data: sessionSig })
        const decoded = sessionIface.decodeFunctionResult('session', result)
        // SAFETY: session() returns (game, gameId, sessionKey, expiryBlock,
        // active) in that exact order per the delegate ABI.
        const registeredGame = decoded[0] as string
        // SAFETY: gameId is the second uint256 field of the session() tuple.
        const registeredGameId = decoded[1] as bigint
        // SAFETY: sessionKey is the third address field of the session() tuple.
        const registeredKey = decoded[2] as string
        // SAFETY: expiryBlock is the fourth uint256 field of the session() tuple.
        const expiryBlock = decoded[3] as bigint
        // SAFETY: active is the final bool field of the session() tuple.
        const active = decoded[4] as boolean
        const blockNumber = await provider.getBlockNumber()
        const sessionActive =
          active === true &&
          BigInt(gameId) === registeredGameId &&
          registeredGame.toLowerCase() === ADDRESSES.game.toLowerCase() &&
          blockNumber <= Number(expiryBlock) &&
          registeredKey.toLowerCase() === sessionKey.address.toLowerCase()
        return {
          active: sessionActive,
          expired: active === true && blockNumber > Number(expiryBlock),
          sessionKey: registeredKey,
          expiryBlock,
        }
      } catch {
        return inactive
      }
    },
    [provider, account, sessionKey],
  )

  const submitMove = useCallback(
    async (gameId: string, position: number): Promise<SessionResult> => {
      if (!provider || !account) return { ok: false, reason: 'no-wallet' }
      const status = await isSessionActive(gameId)
      if (!status.active) return { ok: false, reason: 'no-session' }
      try {
        const sessionKeyWallet = new Wallet(sessionKey.privateKey, provider)
        const moveIface = new Interface(EXECUTE_MOVE_ABI)
        const data = moveIface.encodeFunctionData('executeMove', [position])
        const tx = await sessionKeyWallet.sendTransaction({
          to: account,
          data,
          chainId: SOMNIA_CHAIN_ID,
        })
        // SAFETY: tx.wait() resolves only for mined successes; ethers rejects
        // on revert or timeout, which the catch below maps to 'reverted'.
        await tx.wait()
        return { ok: true, hash: tx.hash }
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        if (/insufficient funds|out of gas/i.test(message)) return { ok: false, reason: 'funds' }
        return { ok: false, reason: 'reverted' }
      }
    },
    [provider, account, sessionKey, isSessionActive],
  )

  const revokeSession = useCallback(
    async (): Promise<SessionResult> => {
      if (!ADDRESSES.sessionDelegate) return { ok: false, reason: 'not-deployed' }
      if (!signer || !account) return { ok: false, reason: 'no-wallet' }
      try {
        const revokeIface = new Interface(['function revokeSession()'])
        const data = revokeIface.encodeFunctionData('revokeSession')
        const tx = await signer.sendTransaction({
          to: account,
          data,
          chainId: SOMNIA_CHAIN_ID,
        })
        await tx.wait()
        const fresh = Wallet.createRandom()
        setSessionKey({ address: fresh.address, privateKey: fresh.privateKey })
        sessionStorage.setItem(SESSION_KEY_STORAGE, fresh.privateKey)
        return { ok: true }
      } catch {
        return { ok: false, reason: 'unsupported' }
      }
    },
    [signer, account],
  )

  return useMemo(
    () => ({ sessionKey, registerSession, renewSession, isSessionActive, submitMove, revokeSession }),
    [sessionKey, registerSession, renewSession, isSessionActive, submitMove, revokeSession],
  )
}