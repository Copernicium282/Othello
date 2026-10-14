import { useCallback, useMemo, useState } from 'react'
import { JsonRpcProvider, Wallet } from 'ethers'
import type { AbstractProvider } from 'ethers'
import type { WalletState } from './useWallet'

const PUBLIC_RPC_URL = 'https://forno.celo-sepolia.celo-testnet.org'
const CELO_SEPOLIA_CHAIN_ID_DEC = 11142220
const KEYSTORE_STORAGE_KEY = 'othello:localWalletKeystore'
const ADDRESS_STORAGE_KEY = 'othello:localWalletAddress'

function hasStoredKeystore(): boolean {
  try {
    return !!localStorage.getItem(KEYSTORE_STORAGE_KEY)
  } catch {
    return false
  }
}

function readAddress(): string | null {
  try {
    return localStorage.getItem(ADDRESS_STORAGE_KEY)
  } catch {
    return null
  }
}

export function useLocalWallet() {
  const provider = useMemo(() => new JsonRpcProvider(PUBLIC_RPC_URL), [])

  const [state, setState] = useState<WalletState>({
    account: null,
    provider: null,
    signer: null,
    chainId: null,
    isConnecting: false,
    error: null,
  })

  const [keystorePresent, setKeystorePresent] = useState<boolean>(() => hasStoredKeystore())

  const unlock = useCallback(
    async (password: string): Promise<{ ok: boolean; reason?: string }> => {
      let json: string | null = null
      try {
        json = localStorage.getItem(KEYSTORE_STORAGE_KEY)
      } catch {
        json = null
      }
      if (!json) {
        const reason = 'No browser wallet found. Create or import one first.'
        setState(s => ({ ...s, error: reason }))
        return { ok: false, reason }
      }

      setState(s => ({ ...s, isConnecting: true, error: null }))
      try {
        const wallet = await Wallet.fromEncryptedJson(json, password)
        const signer = wallet.connect(provider)
        const account = wallet.address
        localStorage.setItem(ADDRESS_STORAGE_KEY, account)
        setState({
          account,
          provider,
          signer,
          chainId: CELO_SEPOLIA_CHAIN_ID_DEC,
          isConnecting: false,
          error: null,
        })
        setKeystorePresent(true)
        return { ok: true }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not unlock browser wallet. Check your password.'
        setState(s => ({ ...s, isConnecting: false, error: message }))
        return { ok: false, reason: message }
      }
    },
    [provider],
  )

  const create = useCallback(
    async (password: string): Promise<{ ok: boolean; reason?: string; address?: string }> => {
      if (!password || password.length < 6) {
        const reason = 'Use a password of at least 6 characters.'
        setState(s => ({ ...s, error: reason }))
        return { ok: false, reason }
      }

      setState(s => ({ ...s, isConnecting: true, error: null }))
      try {
        const wallet = Wallet.createRandom()
        const keystore = await wallet.encrypt(password)
        localStorage.setItem(KEYSTORE_STORAGE_KEY, keystore)
        localStorage.setItem(ADDRESS_STORAGE_KEY, wallet.address)
        const signer = wallet.connect(provider)
        setState({
          account: wallet.address,
          provider,
          signer,
          chainId: CELO_SEPOLIA_CHAIN_ID_DEC,
          isConnecting: false,
          error: null,
        })
        setKeystorePresent(true)
        return { ok: true, address: wallet.address }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create browser wallet.'
        setState(s => ({ ...s, isConnecting: false, error: message }))
        return { ok: false, reason: message }
      }
    },
    [provider],
  )

  const importPrivateKey = useCallback(
    async (privateKey: string, password: string): Promise<{ ok: boolean; reason?: string; address?: string }> => {
      if (!password || password.length < 6) {
        const reason = 'Use a password of at least 6 characters.'
        setState(s => ({ ...s, error: reason }))
        return { ok: false, reason }
      }

      setState(s => ({ ...s, isConnecting: true, error: null }))
      try {
        const wallet = new Wallet(privateKey.trim())
        const keystore = await wallet.encrypt(password)
        localStorage.setItem(KEYSTORE_STORAGE_KEY, keystore)
        localStorage.setItem(ADDRESS_STORAGE_KEY, wallet.address)
        const signer = wallet.connect(provider)
        setState({
          account: wallet.address,
          provider,
          signer,
          chainId: CELO_SEPOLIA_CHAIN_ID_DEC,
          isConnecting: false,
          error: null,
        })
        setKeystorePresent(true)
        return { ok: true, address: wallet.address }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to import private key.'
        setState(s => ({ ...s, isConnecting: false, error: message }))
        return { ok: false, reason: message }
      }
    },
    [provider],
  )

  const disconnect = useCallback(() => {
    setState({
      account: null,
      provider: null,
      signer: null,
      chainId: null,
      isConnecting: false,
      error: null,
    })
  }, [])

  const deleteWallet = useCallback(() => {
    try {
      localStorage.removeItem(KEYSTORE_STORAGE_KEY)
      localStorage.removeItem(ADDRESS_STORAGE_KEY)
    } catch {
      // ignore storage errors
    }
    setKeystorePresent(false)
    disconnect()
  }, [disconnect])

  const readonlyAddress = readAddress()

  return {
    ...state,
    provider: state.provider ?? (state.account ? provider : null),
    hasKeystore: keystorePresent,
    storedAddress: readonlyAddress,
    unlock,
    create,
    importPrivateKey,
    disconnect,
    deleteWallet,
    // SAFETY: `provider` is created once as JsonRpcProvider and never reassigned,
    // so casting to the shared AbstractProvider interface is sound.
    providerInstance: provider as AbstractProvider,
  }
}