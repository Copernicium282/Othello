# Othello.s

Fully on-chain Othello (Reversi) with wagering, ELO ratings, and seasonal treasury payouts. Every move is an on-chain transaction on [Sepolia CELO testnet](https://docs.celo.org/network/sepolia) .

## How to Play

1. **Connect Wallet:** Click Connect Wallet (auto-adds / switches to Sepolia CELO testnet: chainId `11142220`, RPC `https://forno.celo-sepolia.celo-testnet.org`).
2. **Wrap Tokens:** Convert testnet CELO into YYG tokens (1 CELO = 100,000 YYG).
3. **Challenge or Accept:** Challenge an opponent with a YYG stake, browse open pending games, or enter a Game ID to accept / resume.
4. **Play Othello:** Every move is a confirmed on-chain transaction with sub-second board updates.
5. **Win the Stake:** Winner takes 96% of the combined stake; 4% accumulates in the seasonal treasury.

**Sessions (zero-popup moves):**
Creating or accepting a game authorizes an in-browser session key and funds it with 0.1 CELO for gas in the same single transaction. Every subsequent move is signed by the session key with zero wallet popups. If a session key expires, you can renew it with one click or continue playing via seamless direct signing fallback.

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

## Contracts (Sepolia CELO Testnet)

| Contract | Address | Explorer |
|----------|--------|----------|
| YinYang (YYG) | `0x3AD9B60fAC0E2856a061D7A2322bb2805Afa2319` | [address](https://sepolia.celoscan.io/address/0x3AD9B60fAC0E2856a061D7A2322bb2805Afa2319) |
| OthelloELO | `0xD004ce5B8871Fb1DFc91517cB88538499480BE2E` | [address](https://sepolia.celoscan.io/address/0xD004ce5B8871Fb1DFc91517cB88538499480BE2E) |
| OthelloTreasury | `0x91CA09E43D3F12C2BBbAbd0c24De8E0798098fe6` | [address](https://sepolia.celoscan.io/address/0x91CA09E43D3F12C2BBbAbd0c24De8E0798098fe6) |
| OthelloGame | `0x6E883aa086386e6318aC81455Fc3598B583aa4fE` | [address](https://sepolia.celoscan.io/address/0x6E883aa086386e6318aC81455Fc3598B583aa4fE) |

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
- Pending games can be cancelled by their challenger for a full stake refund (no treasury fee)
- ELO updates gated by ±400/±800 rating bands and a 3-distinct-opponent anti-farming check
- One-hour same-opponent cooldown enforced at both create and accept time
- Seasonal treasury pays the top 3 players 50/30/20 every 30 days (permissionless settle after deadline)

## Gameplay & UX Highlights

- **Physical board housing:** each side has a disc rail tracking the 32-disc capacity as discs are placed.
- **Flip-count badges (toggleable, persisted):** optional per-move count of how many discs a legal move would flip.
- **Session renewal & direct fallback:** expired session keys renew in one click; direct wallet signing keeps moves unblocked.
- **Resume anywhere:** the active Game ID is persisted locally; browse open pending games or enter a Game ID to accept/resume.
- **Cancel pending games:** challengers can cancel unstarted games for a full stake refund with no treasury fee.
- **Guided onboarding:** Quick-play AI button plus automatic Sepolia CELO network add/switch and wallet auto-reconnect.
- **Resilient polling UX:** 1.2s game-state polling preserves the last board on transient RPC failures.
- **Clean feedback:** custom contract errors are decoded into user-facing toasts.
- **Browser wallet (opt-in):** MetaMask-free play using a password-encrypted keystore stored in localStorage (testnet only).
- **Spectator view (read-only):** open any Game ID without a wallet to follow a live game, browse active games, and copy shareable game links.

## Architecture

```
React Frontend -> ethers.js -> Sepolia CELO
  +-- YinYang.sol (ERC-20 wrap/unwrap)
  +-- OthelloGame.sol (bitboard game logic + escrow + contract-level sessions)
  +-- OthelloELO.sol (fixed-point ELO registry)
  +-- OthelloTreasury.sol (fee accumulator + seasonal payout)
```
