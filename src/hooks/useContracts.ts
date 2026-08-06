import { useMemo } from "react";
import { Contract, BrowserProvider, JsonRpcSigner } from "ethers";
import { ADDRESSES, YYG_ABI, GAME_ABI, ELO_ABI, TREASURY_ABI } from "../lib/contracts";

export interface Contracts {
  yyg: Contract
  game: Contract
  elo: Contract
  treasury: Contract
}

export function useContracts(
  provider: BrowserProvider | null,
  signer: JsonRpcSigner | null,
): Contracts | null {
  return useMemo(() => {
    if (!signer || !provider) return null

    return {
      yyg: new Contract(ADDRESSES.yyg, YYG_ABI, signer),
      game: new Contract(ADDRESSES.game, GAME_ABI, signer),
      elo: new Contract(ADDRESSES.elo, ELO_ABI, provider),
      treasury: new Contract(ADDRESSES.treasury, TREASURY_ABI, signer),
    }
  }, [provider, signer])
}
