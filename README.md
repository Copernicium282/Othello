# Othello.s

Fully on-chain 2-player Othello (Reversi) on ETH Sepolia. Every move is a transaction, the board is two `uint64` bitboards, and the winner gets 96% of the combined stake. A 4% fee flows into a seasonal treasury that pays top-ranked players by ELO monthly.

## Contracts (Sepolia)

| Contract | Address |
|----------|---------|
| YinYang (ERC-20 wrap) | `0x3e42135A7eDaE76eeF8Bc29F1E9B500D3F2Cb8D0` |
| OthelloELO | `0x1D6a0eA1f7E68E4B0B0421cbb1e4b63c0A1df23b` |
| OthelloTreasury | `0x8b34c28e0B0B7c1C90B690fEdA9d673CFB54b790` |
| OthelloGame | `0x06441a070Ef37B3aC4a6D1C23522C95D036Ee873` |

All verified on Sourcify (exact match). Compiler 0.8.35.

## How it works

1. Wrap ETH into YinYang (YYG) tokens at 1:100,000
2. Player A creates a game and stakes YYG
3. Player B accepts, matches the stake
4. Players alternate moves, each move is an on-chain tx
5. When the board is full or neither player can move, the game settles
6. Winner gets 96% of the pot, treasury takes 4%
7. ELO ratings update on-chain after each game

Anti-farming: per-address daily cap (20 games), same-opponent cooldown (1 hour), opponent diversity requirement (3 distinct opponents in last 10 games before ELO counts), and a +/-400 ELO matchmaking band.

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
SEPOLIA_RPC_URL=https://rpc.sepolia.org
```

```bash
cd contracts
source .env
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify --private-key $PRIVATE_KEY
```

## License

MIT
