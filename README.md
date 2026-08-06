# Othello.s

Fully on-chain Othello (Reversi) with wagering, ELO ratings, and seasonal treasury payouts. Every move is an on-chain transaction on [Somnia Shannon testnet](https://testnet.somnia.network/) (sub-second finality).

## How to Play

1. Connect MetaMask to Somnia Shannon testnet (chainId 50312)
2. Wrap STT into YYG tokens (1 STT = 100,000 YYG)
3. Challenge an opponent by staking YYG
4. Opponent accepts and matches your stake
5. Play Othello — each move is a confirmed on-chain tx
6. Winner takes 96% of the combined pot, 4% goes to the seasonal treasury

## Running Locally

```bash
# Contracts
cd contracts && forge install && forge build && forge test -vv

# Frontend
npm install && npm run dev
```

## Contracts (Somnia Shannon Testnet)

| Contract | Address | Explorer |
|----------|--------|----------|
| YinYang (YYG) | `0x615e6F1e9706A481B97373ff5c87FB0cf744dd15` | [tx](https://shannon-explorer.somnia.network/tx/0x8ba672824d10fbf63763b347730f313b25747604d9c2c72e2164d47133b1d927) |
| OthelloELO | `0x39125d25B352F064B943Ea9DA9C229bA0D3a69c1` | [tx](https://shannon-explorer.somnia.network/tx/0xfadddb2ad66cc4d4efb0d82bbd015603d325ee7492f5aef723bace854145c6f9) |
| OthelloTreasury | `0x1Ddf8F5A66DcBEfFF4983C70b7eB9A82709Ef9F1` | [tx](https://shannon-explorer.somnia.network/tx/0xeb3ae0669b9478ceef3263e1783d21030e4983871985ace7127e115f73420c32) |
| OthelloGame | `0x2D0266830e6610e3dC7c00A3f8Bd7942936B130e` | [tx](https://shannon-explorer.somnia.network/tx/0x730d433c8ae29248aac46ba963fd9f453cf5c1e014306c0a4f591d5c04e5610a) |

## Stack

- Solidity ^0.8.27 + Foundry
- React 19 + Vite 8 + TypeScript 6
- ethers.js v6
- PRBMath SD59x18 (fixed-point ELO math)
- OpenZeppelin ERC-20 + Ownable

## Architecture

```
React Frontend -> ethers.js -> Somnia Shannon
  +-- YinYang.sol (ERC-20 wrap/unwrap)
  +-- OthelloGame.sol (bitboard game logic + escrow)
  +-- OthelloELO.sol (fixed-point ELO registry)
  +-- OthelloTreasury.sol (fee accumulator + seasonal payout)
```
