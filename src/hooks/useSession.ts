import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Interface, JsonRpcProvider, Wallet } from 'ethers'
import type { BrowserProvider, JsonRpcSigner } from 'ethers'
import { ADDRESSES } from '../lib/contracts'

const SESSION_KEY_STORAGE = 'sessionKey'

const SESSIONS_ABI = [
  'function sessions(address player, address sessionKey) view returns (uint256 gameId, uint64 expiryBlock)',
] as const

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
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  account: string | null
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
  const { provider, signer, account } = options
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

  const registerSession = useCallback(
    async (request: { gameId: string; durationBlocks: number }): Promise<SessionResult> => {
      if (!signer || !account) return { ok: false, reason: 'no-wallet' }
      try {
        const tx = await signer.sendTransaction({
          // SAFETY: game target is the deployed OthelloGame literal address; the
          // ABI string matches the on-chain authorizeSession selector.
          to: ADDRESSES.game,
          data: new Interface(['function authorizeSession(uint256 gameId, address sessionKey, uint64 durationBlocks)']).encodeFunctionData(
            'authorizeSession',
            [BigInt(request.gameId), sessionKey.address, request.durationBlocks],
          ),
        })
        await tx.wait()
        return { ok: true, hash: tx.hash }
      } catch {
        return { ok: false, reason: 'unsupported' }
      }
    },
    [signer, account, sessionKey],
  )

  const renewSession = useCallback(
    async (request: { gameId: string; durationBlocks: number }): Promise<SessionResult> => {
      if (!signer || !account) return { ok: false, reason: 'no-wallet' }
      const fresh = Wallet.createRandom()
      try {
        const tx = await signer.sendTransaction({
          // SAFETY: same selector as registerSession; fresh key was just generated.
          to: ADDRESSES.game,
          data: new Interface(['function authorizeSession(uint256 gameId, address sessionKey, uint64 durationBlocks)']).encodeFunctionData(
            'authorizeSession',
            [BigInt(request.gameId), fresh.address, request.durationBlocks],
          ),
        })
        await tx.wait()
        setSessionKey({ address: fresh.address, privateKey: fresh.privateKey })
        sessionStorage.setItem(SESSION_KEY_STORAGE, fresh.privateKey)
        return { ok: true, hash: tx.hash }
      } catch {
        return { ok: false, reason: 'unsupported' }
      }
    },
    [signer, account],
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
        const sessionsIface = new Interface(SESSIONS_ABI)
        const data = sessionsIface.encodeFunctionData('sessions', [account, sessionKey.address])
        const result = await provider.call({ to: ADDRESSES.game, data })
        // SAFETY: sessions() returns (gameId uint256, expiryBlock uint64) in
        // that exact order per the on-chain Sessions mapping.
        const rawDecoded: unknown = sessionsIface.decodeFunctionResult('sessions', result)
        // SAFETY: rawDecoded is the two-element tuple from the sessions() view.
        const decoded = rawDecoded as [bigint, bigint]
        const storedGameId = decoded[0]
        const expiryBlock = decoded[1]
        if (expiryBlock === 0n) return inactive
        const blockNumber = BigInt(await provider.getBlockNumber())
        const active = storedGameId === BigInt(gameId) && blockNumber <= expiryBlock
        const expired = storedGameId === BigInt(gameId) && blockNumber > expiryBlock
        return {
          active,
          expired,
          sessionKey: sessionKey.address,
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
        const sessionKeyWallet = new Wallet(sessionKey.privateKey, new JsonRpcProvider('https://api.infra.testnet.somnia.network'))
        const moveData = new Interface(['function moveFor(address player, uint256 gameId, uint8 pos)']).encodeFunctionData(
          'moveFor',
          [account, BigInt(gameId), position],
        )
        const tx = await sessionKeyWallet.sendTransaction({
          to: ADDRESSES.game,
          data: moveData,
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
      if (!signer || !account) return { ok: false, reason: 'no-wallet' }
      try {
        const revokeData = new Interface(['function revokeSessionKey(address sessionKey)']).encodeFunctionData(
          'revokeSessionKey',
          [sessionKey.address],
        )
        const tx = await signer.sendTransaction({
          to: ADDRESSES.game,
          data: revokeData,
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
    [signer, account, sessionKey],
  )

  return useMemo(
    () => ({ sessionKey, registerSession, renewSession, isSessionActive, submitMove, revokeSession }),
    [sessionKey, registerSession, renewSession, isSessionActive, submitMove, revokeSession],
  )
}
