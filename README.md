# Othello.s

Fully on-chain Othello (Reversi) with wagering, ELO ratings, and seasonal treasury payouts. Every move is an on-chain transaction on [Somnia Shannon testnet](https://testnet.somnia.network/) (sub-second finality).

## How to Play

1. Connect MetaMask to Somnia Shannon testnet (chainId 50312)
2. Wrap STT into YYG tokens (1 STT = 100,000 YYG)
3. Challenge an opponent by staking YYG
4. Opponent accepts and matches your stake
5. Play Othello, each move is a confirmed on-chain tx
6. Winner takes 96% of the combined pot, 4% goes to the seasonal treasury

No wallet? The **AI tab** lets you play locally against a built-in AI (alpha-beta search, 4 difficulty levels), no chain calls required.

## Running Locally

```bash
# Contracts
cd contracts && forge install && forge build && forge test -vv

# Frontend
npm install && npm run dev

# Lint (oxlint)
npm run lint
```

The lint config loads a vendored rule plugin from `tools/oxlint/anti-slop` (see `.oxlintrc.json`). The plugin is not committed to this repo; restore it from the upstream source and install its dependency if you want the full lint setup:

```bash
git clone https://github.com/dmmulroy/anti-slop.git .specs/anti-slop
mkdir -p tools/oxlint
cp -r .specs/anti-slop/src tools/oxlint/anti-slop
npm install -D @oxlint/plugins
```

## Contracts (Somnia Shannon Testnet)

| Contract | Address | Explorer |
|----------|--------|----------|
| YinYang (YYG) | `0x06441a070Ef37B3aC4a6D1C23522C95D036Ee873` | [tx](https://shannon-explorer.somnia.network/tx/0xb47cd4760d082d2bf94c5a6e89a110ea303bfedf9b50ad10d84f3df8fc73f6d7) |
| OthelloELO | `0x1e5187E2ebBa511924c1392aC2E9e298F78aC266` | [tx](https://shannon-explorer.somnia.network/tx/0x0b3d162c4b62e249599751443f4c702c4b67aa95eb0736ea536a6f8644bf1f2d) |
| OthelloTreasury | `0x49240E7DBFd8de70200a3C3A7a76719D2669bCd5` | [tx](https://shannon-explorer.somnia.network/tx/0x3f345040284a05297e6dcd792816a6452eb1023d316a13136233bad9fdc35f07) |
| OthelloGame | `0x35f2025701453EA0EF03Fb104323d8363630001B` | [tx](https://shannon-explorer.somnia.network/tx/0x4d99cb97793937d4406de30b8c5e595dee973dc465845a221db1127643030eda) |

## Stack

- Solidity ^0.8.27 + Foundry
- React 19 + Vite 8 + TypeScript 6
- ethers.js v6
- PRBMath SD59x18 (fixed-point ELO math)
- OpenZeppelin ERC-20 + Ownable
- oxlint

## Contract Security

- `settleSeason` enforces `verifyTopThree` before any payout, arbitrary top-3 arrays revert
- Permissionless `resolveTimeout` (24h inactivity) prevents stakes from being locked in abandoned games
- `MIN_STAKE` (10 YYG) enforced on create and accept; `unwrap` reverts on dust amounts
- Challenger daily cap (20 games/day) enforced at both create and accept time

## Architecture

```
React Frontend -> ethers.js -> Somnia Shannon
  +-- YinYang.sol (ERC-20 wrap/unwrap)
  +-- OthelloGame.sol (bitboard game logic + escrow)
  +-- OthelloELO.sol (fixed-point ELO registry)
  +-- OthelloTreasury.sol (fee accumulator + seasonal payout)
```
