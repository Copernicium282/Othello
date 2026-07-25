# Othello.s

On-chain Othello wager game on Base Sepolia. Every move is a transaction; the board fits in 128 bits (two uint64 bitboards). Winners earn ETH from the pot; top ELO players share the monthly treasury pool.

## Architecture

```
├── contracts/          Foundry + Solidity
│   ├── src/
│   │   ├── YinYang.sol           ERC-20 wrap token (1:100000 ETH)
│   │   ├── OthelloGame.sol       Bitboard game logic + escrow
│   │   ├── OthelloELO.sol        Fixed-point ELO ratings
│   │   └── OthelloTreasury.sol   Fee accumulator + seasonal payout
│   └── test/
├── src/                React + TypeScript + Vite frontend
├── .specs/             Spec and build plan
```

## Stack

- Solidity + Foundry (forge, anvil, cast)
- React + Vite + TypeScript
- ethers.js v6
- Base Sepolia

## Quick Start

```bash
npm install
cd contracts && forge build
```
