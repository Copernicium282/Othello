import { useCallback, useEffect, useMemo, useState } from 'react'
import { Contract, Interface, JsonRpcProvider, Wallet } from 'ethers'
import type { BrowserProvider, JsonRpcSigner } from 'ethers'
import { ADDRESSES } from '../lib/contracts'

const SESSIONS_ABI = [
  'function sessions(address player, address sessionKey) view returns (uint256 gameId, uint64 expiryBlock)',
] as const

const SESSION_FUND_WEI = 10n ** 17n // 0.1 STT
const SOMNIA_RPC_URL = 'https://dream-rpc.somnia.network'

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

const SESSION_KEY_STORAGE_PREFIX = 'othello_sessionKey_'

export function getSessionKeyForAccount(account: string | null): SessionKeyInfo {
  if (!account) return makeFreshKey()
  const key = `${SESSION_KEY_STORAGE_PREFIX}${account.toLowerCase()}`
  const existing = localStorage.getItem(key) || sessionStorage.getItem(key)
  if (existing) {
    try {
      return { address: new Wallet(existing).address, privateKey: existing }
    } catch {
      localStorage.removeItem(key)
      sessionStorage.removeItem(key)
    }
  }
  return makeFreshKey(account)
}

function makeFreshKey(account?: string | null): SessionKeyInfo {
  const fresh = Wallet.createRandom()
  if (account) {
    const storageKey = `${SESSION_KEY_STORAGE_PREFIX}${account.toLowerCase()}`
    localStorage.setItem(storageKey, fresh.privateKey)
  }
  return { address: fresh.address, privateKey: fresh.privateKey }
}

export function useSession(
  options: UseSessionOptions,
): SessionApi {
  const { provider, signer, account } = options
  const [sessionKey, setSessionKey] = useState<SessionKeyInfo>(() => getSessionKeyForAccount(account))

  // Sync session key whenever account changes
  useEffect(() => {
    if (account) {
      const current = getSessionKeyForAccount(account)
      setSessionKey(current)
    }
  }, [account])

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
        const gameContract = new Contract(
          ADDRESSES.game,
          ['function authorizeSession(uint256 gameId, address sessionKey, uint64 durationBlocks) external'],
          signer,
        )
        const tx = await gameContract.authorizeSession(
          BigInt(request.gameId),
          fresh.address,
          request.durationBlocks,
        )
        await tx.wait()

        // Directly fund the fresh session key with STT gas for zero-popup moves
        const fundTx = await signer.sendTransaction({
          to: fresh.address,
          value: SESSION_FUND_WEI,
        })
        await fundTx.wait()

        const freshInfo = { address: fresh.address, privateKey: fresh.privateKey }
        setSessionKey(freshInfo)
        const storageKey = `${SESSION_KEY_STORAGE_PREFIX}${account.toLowerCase()}`
        localStorage.setItem(storageKey, fresh.privateKey)
        return { ok: true, hash: tx.hash }
      } catch (err) {
        console.error('renewSession error:', err)
        const message = err instanceof Error ? err.message : String(err)
        return { ok: false, reason: message }
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
        const decoded = sessionsIface.decodeFunctionResult('sessions', result)
        const storedGameId = BigInt(decoded[0])
        const expiryBlock = BigInt(decoded[1])
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
        const sessionProvider = new JsonRpcProvider(SOMNIA_RPC_URL)
        const sessionKeyWallet = new Wallet(sessionKey.privateKey, sessionProvider)
        const moveData = new Interface(['function moveFor(address player, uint256 gameId, uint8 pos)']).encodeFunctionData(
          'moveFor',
          [account, BigInt(gameId), position],
        )
        const tx = await sessionKeyWallet.sendTransaction({
          to: ADDRESSES.game,
          data: moveData,
        })
        await tx.wait()
        return { ok: true, hash: tx.hash }
      } catch (err) {
        console.error('submitMove via session key error:', err)
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
        const freshInfo = { address: fresh.address, privateKey: fresh.privateKey }
        setSessionKey(freshInfo)
        const storageKey = `${SESSION_KEY_STORAGE_PREFIX}${account.toLowerCase()}`
        localStorage.setItem(storageKey, fresh.privateKey)
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
