import { useState, useEffect, useCallback } from "react";
import { AbstractProvider, BrowserProvider } from "ethers";
import type { Signer } from "ethers";
import { toast } from "../lib/toastBus";

declare global {
  interface Window {
    ethereum?: {
      request: <T>(args: { method: string; params?: unknown[] }) => Promise<T>
      on: <T>(event: string, cb: (payload: T, ...rest: unknown[]) => void) => void
      removeListener: <T>(event: string, cb: (payload: T, ...rest: unknown[]) => void) => void
    }
  }
}

export interface WalletState {
  account: string | null
  provider: AbstractProvider | null
  signer: Signer | null
  chainId: number | null
  isConnecting: boolean
  error: string | null
}

export const CELO_SEPOLIA_CHAIN_ID_HEX = '0xaa044c' // 11142220
export const CELO_SEPOLIA_CHAIN_ID_DEC = 11142220

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    account: null,
    provider: null,
    signer: null,
    chainId: null,
    isConnecting: false,
    error: null,
  })

  const ensureCeloNetwork = useCallback(async (ethereum: Exclude<Window['ethereum'], undefined>) => {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CELO_SEPOLIA_CHAIN_ID_HEX }],
      })
    } catch (err) {
      // SAFETY: EIP-1193 switch errors are objects carrying a numeric `code`
      // and a string `message`; optional chaining tolerates either missing.
      const errorObj = err as { code?: number; message?: string }
      // Standard 4902: Unrecognized chain ID
      // -32603: Internal error / chain not found in some custom provider implementations
      const lowerMessage = errorObj.message?.toLowerCase() ?? ''
      const isMissingChain =
        errorObj.code === 4902 ||
        errorObj.code === -32603 ||
        lowerMessage.includes('unrecognized') ||
        lowerMessage.includes('not added') ||
        lowerMessage.includes('unknown chain')

      if (!isMissingChain) {
        throw err
      }

      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: CELO_SEPOLIA_CHAIN_ID_HEX,
            chainName: 'Celo Sepolia Testnet',
            nativeCurrency: { name: 'Celo', symbol: 'CELO', decimals: 18 },
            rpcUrls: [
              'https://forno.celo-sepolia.celo-testnet.org',
            ],
            blockExplorerUrls: ['https://celo-sepolia.blockscout.com'],
          },
        ],
      })
    }
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      const msg = 'MetaMask not detected. Please install MetaMask to connect.'
      setState(s => ({ ...s, error: msg }))
      toast('error', msg)
      return
    }

    setState(s => ({ ...s, isConnecting: true, error: null }))

    try {
      // Prompt MetaMask connection
      const accounts = await window.ethereum.request<string[]>({
        method: 'eth_requestAccounts',
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found. Please unlock MetaMask.')
      }

      await ensureCeloNetwork(window.ethereum)

      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()

      if (Number(network.chainId) !== CELO_SEPOLIA_CHAIN_ID_DEC) {
        const errorMsg = 'Wrong network: Please switch MetaMask to Celo Sepolia (Chain ID 11142220)'
        setState({
          account: null,
          provider: null,
          signer: null,
          chainId: Number(network.chainId),
          isConnecting: false,
          error: errorMsg,
        })
        toast('error', errorMsg)
        return
      }

      setState({
        account: accounts[0],
        provider,
        signer,
        chainId: Number(network.chainId),
        isConnecting: false,
        error: null,
      })
    } catch (err) {
      // SAFETY: EIP-1193 provider rejections are objects with a numeric
      // `code` (4001 user rejection, -32002 request already pending).
      const errorObj = err as { code?: number; message?: string }
      let message = 'Connection failed'

      if (errorObj.code === 4001) {
        message = 'Connection request was rejected in MetaMask.'
      } else if (errorObj.code === -32002) {
        message = 'A connection request is already pending in MetaMask. Please open your extension icon.'
      } else if (err instanceof Error) {
        message = err.message
      }

      setState(s => ({
        ...s,
        isConnecting: false,
        error: message,
      }))
      toast('error', message.slice(0, 150))
    }
  }, [ensureCeloNetwork])

  // Auto-connect if already authorized
  useEffect(() => {
    if (!window.ethereum) return

    const checkExistingConnection = async () => {
      try {
        const accounts = await window.ethereum!.request<string[]>({
          method: 'eth_accounts',
        })
        if (accounts && accounts.length > 0) {
          const provider = new BrowserProvider(window.ethereum!)
          const network = await provider.getNetwork()
          if (Number(network.chainId) === CELO_SEPOLIA_CHAIN_ID_DEC) {
            const signer = await provider.getSigner()
            setState({
              account: accounts[0],
              provider,
              signer,
              chainId: Number(network.chainId),
              isConnecting: false,
              error: null,
            })
          }
        }
      } catch {
        // Silently fail auto-connect
      }
    }

    checkExistingConnection()
  }, [])

  // Listen for account/chain changes
  useEffect(() => {
    if (!window.ethereum) return

    // EIP-1193 contract: 'accountsChanged' emits the new accounts array
    // (empty when disconnected); 'chainChanged' emits a chainId we ignore.
    const handleAccounts = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        setState({ account: null, provider: null, signer: null, chainId: null, isConnecting: false, error: null })
      } else {
        const provider = new BrowserProvider(window.ethereum!)
        provider.getSigner().then(signer => {
          provider.getNetwork().then(network => {
            if (Number(network.chainId) === CELO_SEPOLIA_CHAIN_ID_DEC) {
              setState(s => ({ ...s, account: accounts[0], provider, signer, chainId: Number(network.chainId), error: null }))
            } else {
              setState(s => ({ ...s, account: null, provider: null, signer: null, chainId: Number(network.chainId), error: 'Wrong network' }))
            }
          })
        }).catch(() => {
          setState({ account: null, provider: null, signer: null, chainId: null, isConnecting: false, error: null })
        })
      }
    }

    const handleChain = () => {
      window.location.reload()
    }

    window.ethereum.on('accountsChanged', handleAccounts)
    window.ethereum.on('chainChanged', handleChain)

    return () => {
      window.ethereum!.removeListener('accountsChanged', handleAccounts)
      window.ethereum!.removeListener('chainChanged', handleChain)
    }
  }, [])

  return { ...state, connect }
}
