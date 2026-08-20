# Othello.s

Fully on-chain Othello (Reversi) with wagering, ELO ratings, and seasonal treasury payouts. Every move is an on-chain transaction on [Somnia Shannon testnet](https://testnet.somnia.network/) (sub-second finality).

## How to Play

1. Connect MetaMask to Somnia Shannon testnet (chainId 50312)
2. Wrap STT into YYG tokens (1 STT = 100,000 YYG)
3. Challenge an opponent by staking YYG
4. Opponent accepts and matches your stake
5. Play Othello, each move is a confirmed on-chain tx
6. Winner takes 96% of the combined pot, 4% goes to the seasonal treasury

**Gasless sessions (EIP-7702):** accepting a game also sets up a browser-side session key
(one extra confirmation), so every move afterwards needs zero MetaMask confirmations.
Game entry uses EIP-5792 batched transactions (permit + game call) through a thirdweb
paymaster, so no gas is needed on the account for create/accept either. Sessions are
revoked when the game ends and can be renewed when they expire.

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

Set `VITE_THIRDWEB_CLIENT_ID` in `.env` (see `.env.example`) for the thirdweb
paymaster/bundler; thirdweb allowed domains must include `localhost:5173`,
`localhost:4173`, and `*.vercel.app`.

## Contracts (Somnia Shannon Testnet)

| Contract | Address | Explorer |
|----------|--------|----------|
| YinYang (YYG) | `0x86E9D0284Af16761AD1C3Ab0dbC5ddA6877eA51E` | [address](https://shannon-explorer.somnia.network/address/0x86E9D0284Af16761AD1C3Ab0dbC5ddA6877eA51E) |
| OthelloELO | `0x423FBEf43A8de868758753f3E04c2733D3466099` | [address](https://shannon-explorer.somnia.network/address/0x423FBEf43A8de868758753f3E04c2733D3466099) |
| OthelloTreasury | `0x713915Cc2ddB0E45622a7FC35E2A8c364784092A` | [address](https://shannon-explorer.somnia.network/address/0x713915Cc2ddB0E45622a7FC35E2A8c364784092A) |
| OthelloGame | `0xfE8366E6Dd3b3D47eF899fd63c0b979d2b80A7f2` | [address](https://shannon-explorer.somnia.network/address/0xfE8366E6Dd3b3D47eF899fd63c0b979d2b80A7f2) |
| OthelloSessionDelegate | `0x1438bd445364d04354e0d831e29702d8c6eea534` | [address](https://shannon-explorer.somnia.network/address/0x1438bd445364d04354e0d831e29702d8c6eea534) |

## Stack

- Solidity ^0.8.27 + Foundry
- React 19 + Vite 8 + TypeScript 6
- ethers.js v6
- thirdweb v5 (EIP-5792 sendCalls, EIP-7702 signAuthorization, paymaster)
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
  +-- YinYang.sol (ERC-20 wrap/unwrap + ERC-2612 permit)
  +-- OthelloGame.sol (bitboard game logic + escrow)
  +-- OthelloELO.sol (fixed-point ELO registry)
  +-- OthelloTreasury.sol (fee accumulator + seasonal payout)
  +-- OthelloSessionDelegate.sol (EIP-7702 session key for gasless moves)
```
