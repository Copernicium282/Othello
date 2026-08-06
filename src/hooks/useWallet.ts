import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
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

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    account: null,
    provider: null,
    signer: null,
    chainId: null,
    isConnecting: false,
    error: null,
  })

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState(s => ({ ...s, error: 'Metamask not installed' }))
      return
    }

    setState(s => ({ ...s, isConnecting: true, error: null }))

    try {
      // eth_requestAccounts prompts MetaMask popup
      // Returns an array of connected addresses
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      }) as string[]

      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()

      setState({
        account: accounts[0],
        provider,
        signer,
        chainId: Number(network.chainId),
        isConnecting: false,
        error: null,
      })
    } catch(err) {
      setState(s => ({
        ...s,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      }))
    }
  }, [])

  // Listen for account/chain changes
  useEffect(() => {
    if(!window.ethereum) return

    const handleAccounts = (accounts: unknown[]) => {
      if (accounts.length === 0) {
        setState({account: null, provider: null, signer: null, chainId: null, isConnecting: false, error: null})
      } else {
        // Re-init provider/signer with new account
        const provider = new BrowserProvider(window.ethereum!)
        provider.getSigner().then(signer => {
          setState(s => ({ ...s, account: accounts[0] as string, provider, signer}))
        })
      }
    }

    const handleChain = () => {
      // Reload on chain change, simplest approach
      window.location.reload()
    }

    window.ethereum.on('accountsChanged', handleAccounts)
    window.ethereum.on('chainChanged', handleChain)

    return () => {
      window.ethereum!.removeListener('accountsChanged', handleAccounts)
      window.ethereum!.removeListener('chainChanged', handleChain)
    }
  }, [])

  return { ...state, connect}
}
