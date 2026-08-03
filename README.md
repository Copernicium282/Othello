# Othello.s

Fully on-chain 2-player Othello (Reversi) on Somnia Shannon testnet. Every move is a transaction, the board is two `uint64` bitboards, and the winner gets 96% of the combined stake. A 4% fee flows into a seasonal treasury that pays top-ranked players by ELO monthly.

## Contracts (Somnia Shannon)

| Contract | Address |
|----------|---------|
| YinYang (ERC-20 wrap) | `0x602E38982c6115C533b3762e24EDd8740458F1b0` |
| OthelloELO | `0xD14564264F47a0756713467Bc7C36CF174566Db1` |
| OthelloTreasury | `0xEF60391672aBc91DB1c9E21a1E23FBA33153dF76` |
| OthelloGame | `0xAbC9F69426F2eCDC0cC5149F71fE6b76af007028` |

Compiler 0.8.35, EVM target Cancun. Chain ID: `50312`.

## How it works

1. Wrap ETH into YinYang (YYG) tokens at 1:100,000
2. Player A creates a game and stakes YYG
3. Player B accepts, matches the stake
4. Players alternate moves, each move is an on-chain tx
5. When the board is full or neither player can move, the game settles
6. Winner gets 96% of the pot, treasury takes 4%
7. ELO ratings update on-chain after each game

Anti-farming: per-address daily cap (20 games), same-opponent cooldown (1 hour), opponent diversity requirement (3 distinct opponents in last 10 games before ELO counts), and a +/-400 ELO matchmaking band.

## Why Somnia Shannon?

Originally deployed on ETH Sepolia. Migrated to Somnia Shannon testnet (chain 50312) because:

- **100ms block times** vs Sepolia's 12s. Every move is a tx, at 12s blocks a 60-move game takes ~12 minutes of wait. At 100ms, it feels instant.
- **Fully EVM-compatible.** Same Solidity, same Foundry, same toolchain. Migration = change RPC + redeploy.
- **Gas costs are manageable.** Base fee ~6 Gwei. A full game (~60 moves) costs ~0.06 STT. 1 STT/day from the Google Cloud faucet covers ~14 games/day.
- **Minimized event payloads.** Somnia charges 13x more per log topic than Ethereum. Events emit only `gameId`, `position`, and `player`, no board state.

## Stack

- Solidity 0.8.35 + Foundry (forge, anvil, cast)
- OpenZeppelin, PRBMath (SD59x18 fixed-point)
- React + Vite + TypeScript
- ethers.js v6

## Project structure

```
contracts/
  src/
    OthelloGame.sol       Bitboard game logic, move validation, settlement
    OthelloELO.sol        On-chain ELO ratings with PRBMath
    OthelloTreasury.sol   4% fee accumulator, seasonal top-3 payout
    YinYang.sol           ERC-20 wrap/unwrap ETH
    Interfaces.sol        Shared interface definitions
  script/
    Deploy.s.sol          Deploy all 4 contracts + wire setters
  test/
    OthelloGame.t.sol     7 tests (move validation, settlement, anti-farming)
    OthelloELO.t.sol      6 fuzz tests (ELO math, bounds, reset)
    OthelloTreasury.t.sol 8 tests (fees, settlement, access control)
    YinYang.t.sol         3 fuzz tests (wrap, unwrap, edge cases)
    Deploy.t.sol          6 tests (deploy, wiring, access control, e2e)
  deployments/
    sepolia.json          Deployed addresses + verification status
src/                      React + TypeScript frontend (WIP)
```

## Install

```bash
# Root (frontend)
npm install

# Contracts
cd contracts
forge install
forge build
```

## Test

```bash
cd contracts
forge test -vv
```

30 tests across 5 suites. All passing.

## Deploy

Requires a `.env` in `contracts/`:

```
PRIVATE_KEY=0x...
SOMNIA_RPC_URL=https://rpc.ankr.com/somnia_testnet
```

```bash
cd contracts
source .env

# Deploy each contract individually (vm.startBroadcast has gas estimation issues on Somnia)
forge create --broadcast --rpc-url $SOMNIA_RPC_URL --private-key $PRIVATE_KEY src/YinYang.sol:YinYang
forge create --broadcast --rpc-url $SOMNIA_RPC_URL --private-key $PRIVATE_KEY src/OthelloELO.sol:OthelloELO --constructor-args <DEPLOYER>
forge create --broadcast --rpc-url $SOMNIA_RPC_URL --private-key $PRIVATE_KEY src/OthelloTreasury.sol:OthelloTreasury --constructor-args <YYG> <ELO> <DEPLOYER>
forge create --broadcast --rpc-url $SOMNIA_RPC_URL --private-key $PRIVATE_KEY src/OthelloGame.sol:OthelloGame --constructor-args <YYG> <ELO> <TREASURY> <DEPLOYER>

# Wire contracts
cast send --rpc-url $SOMNIA_RPC_URL --private-key $PRIVATE_KEY <ELO> "setGame(address)" <GAME>
cast send --rpc-url $SOMNIA_RPC_URL --private-key $PRIVATE_KEY <ELO> "setTreasury(address)" <TREASURY>
cast send --rpc-url $SOMNIA_RPC_URL --private-key $PRIVATE_KEY <TREASURY> "setGame(address)" <GAME>
cast send --rpc-url $SOMNIA_RPC_URL --private-key $PRIVATE_KEY <GAME> "approveTreasury()"
```

## License

MIT
