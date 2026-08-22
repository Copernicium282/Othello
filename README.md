# Othello.s

Fully on-chain Othello (Reversi) with wagering, ELO ratings, and seasonal treasury payouts. Every move is an on-chain transaction on [Somnia Shannon testnet](https://testnet.somnia.network/) (sub-second finality).

## How to Play

1. **Connect Wallet:** Click Connect Wallet (auto-adds / switches to Somnia Shannon testnet: chainId `50312`, RPC `https://dream-rpc.somnia.network` or `https://api.infra.testnet.somnia.network`).
2. **Wrap Tokens:** Convert testnet STT into YYG tokens (1 STT = 100,000 YYG).
3. **Challenge or Accept:** Challenge an opponent with a YYG stake, browse open pending games, or enter a Game ID to accept / resume.
4. **Play Othello:** Every move is a confirmed on-chain transaction with sub-second board updates.
5. **Win the Stake:** Winner takes 96% of the combined stake; 4% accumulates in the seasonal treasury.

**Sessions (zero-popup moves):**
Creating or accepting a game authorizes an in-browser session key and funds it with 0.1 STT for gas in the same single transaction. Every subsequent move is signed by the session key with zero wallet popups. If a session key expires, you can renew it with one click or continue playing via seamless direct signing fallback.

**AI Mode:**
No wallet or funds? Jump straight into the **AI tab** to play locally against a built-in AI (alpha-beta search with 4 difficulty levels).

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

Set `VITE_THIRDWEB_CLIENT_ID` in `.env` (see `.env.example`); Vercel deployments need it as an environment variable. Thirdweb allowed domains must include `localhost:5173`, `localhost:4173`, and `*.vercel.app`.

## Contracts (Somnia Shannon Testnet)

| Contract | Address | Explorer |
|----------|--------|----------|
| YinYang (YYG) | `0x86E9D0284Af16761AD1C3Ab0dbC5ddA6877eA51E` | [address](https://shannon-explorer.somnia.network/address/0x86E9D0284Af16761AD1C3Ab0dbC5ddA6877eA51E) |
| OthelloELO | `0x423FBEf43A8de868758753f3E04c2733D3466099` | [address](https://shannon-explorer.somnia.network/address/0x423FBEf43A8de868758753f3E04c2733D3466099) |
| OthelloTreasury | `0x713915Cc2ddB0E45622a7FC35E2A8c364784092A` | [address](https://shannon-explorer.somnia.network/address/0x713915Cc2ddB0E45622a7FC35E2A8c364784092A) |
| OthelloGame | `0xf8B227247e432709438619a70Bf60710065239f9` | [address](https://shannon-explorer.somnia.network/address/0xf8B227247e432709438619a70Bf60710065239f9) |

## Stack

- Solidity ^0.8.27 + Foundry
- React 19 + Vite 8 + TypeScript 6
- ethers.js v6
- thirdweb v5 (env-gated client; chain config)
- PRBMath SD59x18 (fixed-point ELO math)
- OpenZeppelin ERC-20 + Ownable
- oxlint

## Contract Security & UX Features

- `settleSeason` enforces `verifyTopThree` before any payout; arbitrary top-3 arrays revert
- Permissionless `resolveTimeout` (24h inactivity) prevents stakes from being locked in abandoned games
- `MIN_STAKE` (10 YYG) enforced on create and accept; `unwrap` reverts on dust amounts
- Challenger daily cap (20 games/day) enforced at both create and accept time
- Custom error decoding across all contract reverts for clean user feedback
- Resilient public fallback RPCs for game queries, leaderboard, and pending games list

## Architecture

```
React Frontend -> ethers.js -> Somnia Shannon
  +-- YinYang.sol (ERC-20 wrap/unwrap)
  +-- OthelloGame.sol (bitboard game logic + escrow + contract-level sessions)
  +-- OthelloELO.sol (fixed-point ELO registry)
  +-- OthelloTreasury.sol (fee accumulator + seasonal payout)
```
