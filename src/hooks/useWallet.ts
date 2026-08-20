import { useState, useEffect, useCallback } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";

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
    // SAFETY: EIP-3326: wallet_switchEthereumChain rejects with code 4902
    // when the chain is not in the wallet yet, then we add it explicitly.
    const chainId = '0xc488'
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      })
    } catch (err) {
      // SAFETY: EIP-3326 switch errors are JSON-RPC errors with a numeric code;
      // 4902 means the chain is not yet added to the wallet.
      const code = (err as { code?: number }).code
      if (code !== 4902) throw err
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId,
            chainName: 'Somnia Shannon',
            nativeCurrency: { name: 'Somnia', symbol: 'STT', decimals: 18 },
            rpcUrls: ['https://api.infra.testnet.somnia.network'],
          },
        ],
      })
    }
  }, [])

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      setState(s => ({ ...s, error: 'Metamask not installed' }))
      return
    }

    setState(s => ({ ...s, isConnecting: true, error: null }))

    try {
      // eth_requestAccounts prompts MetaMask popup
      // Returns an array of connected addresses
      // SAFETY: EIP-1193 request resolves eth_requestAccounts to an array of hex addresses.
      const accounts = await window.ethereum.request<string[]>({
        method: 'eth_requestAccounts',
      })

      await ensureSomniaNetwork(window.ethereum)

      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const network = await provider.getNetwork()

      // SAFETY: network.chainId is a bigint in ethers v6; Somnia Shannon is 50312.
      if (network.chainId !== 50312n) {
        setState({
          account: null,
          provider: null,
          signer: null,
          chainId: Number(network.chainId),
          isConnecting: false,
          error: 'Wrong network: switch MetaMask to Somnia Shannon (chainId 50312)',
        })
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
    } catch(err) {
      setState(s => ({
        ...s,
        isConnecting: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      }))
    }
  }, [ensureSomniaNetwork])

  // Listen for account/chain changes
  useEffect(() => {
    if(!window.ethereum) return

    const handleAccounts = (...args: unknown[]) => {
      // SAFETY: MetaMask emits accountsChanged with a single argument: an array of hex addresses.
      const accounts = args[0] as string[]
      if (accounts.length === 0) {
        setState({account: null, provider: null, signer: null, chainId: null, isConnecting: false, error: null})
      } else {
        // Re-init provider/signer with new account
        const provider = new BrowserProvider(window.ethereum!)
        provider.getSigner().then(signer => {
          setState(s => ({ ...s, account: accounts[0], provider, signer}))
        })
      }
    }

    const handleChain = (..._args: unknown[]) => {
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
