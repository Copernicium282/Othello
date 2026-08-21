import { useMemo } from "react";
import { Contract, BrowserProvider, JsonRpcSigner, JsonRpcProvider } from "ethers";
import { ADDRESSES, YYG_ABI, GAME_ABI, ELO_ABI, TREASURY_ABI } from "../lib/contracts";

export interface Contracts {
  yyg: Contract
  game: Contract
  elo: Contract
  treasury: Contract
  readOnlyGame: Contract
  readOnlyElo: Contract
}

const PUBLIC_RPC_URL = 'https://dream-rpc.somnia.network'
const defaultPublicProvider = new JsonRpcProvider(PUBLIC_RPC_URL)

export function useContracts(
  provider: BrowserProvider | null,
  signer: JsonRpcSigner | null,
): Contracts {
  return useMemo(() => {
    const activeProvider = provider || defaultPublicProvider
    const activeSignerOrProvider = signer || defaultPublicProvider

    return {
      yyg: new Contract(ADDRESSES.yyg, YYG_ABI, activeSignerOrProvider),
      game: new Contract(ADDRESSES.game, GAME_ABI, activeSignerOrProvider),
      elo: new Contract(ADDRESSES.elo, ELO_ABI, activeProvider),
      treasury: new Contract(ADDRESSES.treasury, TREASURY_ABI, activeSignerOrProvider),
      readOnlyGame: new Contract(ADDRESSES.game, GAME_ABI, defaultPublicProvider),
      readOnlyElo: new Contract(ADDRESSES.elo, ELO_ABI, defaultPublicProvider),
    }
  }, [provider, signer])
}
