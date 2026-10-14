import { createThirdwebClient, defineChain } from 'thirdweb'

// SAFETY: Vite injects .env VITE_* vars as strings; a missing var yields
// undefined, which createThirdwebClient rejects at construction time.
const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID
if (!clientId) {
  throw new Error('VITE_THIRDWEB_CLIENT_ID is not set. Add it to the Vercel environment and redeploy.')
}

export const client = createThirdwebClient({
  clientId,
})

export const celoSepolia = defineChain({
  id: 11142220,
  name: 'Celo Sepolia Testnet',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpc: 'https://forno.celo-sepolia.celo-testnet.org',
})