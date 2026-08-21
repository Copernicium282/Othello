import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { toast } from "../components/Toast";

declare global {
  interface Window {
    ethereum?: {
      request: <T>(args: { method: string; params?: unknown[] }) => Promise<T>
      on: (event: string, cb: (...args: unknown[]) => void) => void
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void
    }
  }
}

export interface WalletState {
  account: string | null
  provider: BrowserProvider | null
  signer: JsonRpcSigner | null
  chainId: number | null
  isConnecting: boolean
  error: string | null
}

export const SOMNIA_CHAIN_ID_HEX = '0xc488' // 50312
export const SOMNIA_CHAIN_ID_DEC = 50312

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    account: null,
    provider: null,
    signer: null,
    chainId: null,
    isConnecting: false,
    error: null,
  })

  const ensureSomniaNetwork = useCallback(async (ethereum: Exclude<Window['ethereum'], undefined>) => {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SOMNIA_CHAIN_ID_HEX }],
      })
    } catch (err) {
      const errorObj = err as { code?: number; message?: string }
      // Standard 4902: Unrecognized chain ID
      // -32603: Internal error / chain not found in some custom provider implementations
      // Or check message if code is generic
      const isMissingChain =
        errorObj.code === 4902 ||
        errorObj.code === -32603 ||
        (typeof errorObj.message === 'string' &&
          (errorObj.message.toLowerCase().includes('unrecognized') ||
           errorObj.message.toLowerCase().includes('not added') ||
           errorObj.message.toLowerCase().includes('unknown chain')))

      if (!isMissingChain) {
        throw err
      }

      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: SOMNIA_CHAIN_ID_HEX,
            chainName: 'Somnia Shannon Testnet',
            nativeCurrency: { name: 'Somnia Test Token', symbol: 'STT', decimals: 18 },
            rpcUrls: [
              'https://dream-rpc.somnia.network',
              'https://api.infra.testnet.somnia.network',
            ],
            blockExplorerUrls: ['https://shannon-explorer.somnia.network'],
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

      await ensureSomniaNetwork(window.ethereum)

      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()

      if (Number(network.chainId) !== SOMNIA_CHAIN_ID_DEC) {
        const errorMsg = 'Wrong network: Please switch MetaMask to Somnia Shannon (Chain ID 50312)'
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
  }, [ensureSomniaNetwork])

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
          if (Number(network.chainId) === SOMNIA_CHAIN_ID_DEC) {
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

    const handleAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[]
      if (!accounts || accounts.length === 0) {
        setState({ account: null, provider: null, signer: null, chainId: null, isConnecting: false, error: null })
      } else {
        const provider = new BrowserProvider(window.ethereum!)
        provider.getSigner().then(signer => {
          provider.getNetwork().then(network => {
            if (Number(network.chainId) === SOMNIA_CHAIN_ID_DEC) {
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
