import { BrowserProvider, Contract, JsonRpcSigner } from 'ethers'

// --- Chain config ---
const CHAIN_ID = 50312
const RPC_URL = 'https://rpc.ankr.com/somnia_testnet'

// --- Contract addresses ---
export const ADDRESSES = {
  yyg: '0x615e6F1e9706A481B97373ff5c87FB0cf744dd15',
  elo: '0x39125d25B352F064B943Ea9DA9C229bA0D3a69c1',
  treasury: '0x1Ddf8F5A66DcBEfFF4983C70b7eB9A82709Ef9F1',
  game: '0x2D0266830e6610e3dC7c00A3f8Bd7942936B130e',
} as const

// --- Human-readable ABIs ---
// Only functions you actually call from the frontend
// "view" = read-only, no gas. Without "view" = state-changing, costs gas.
export const YYG_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function wrap() payable',
  'function unwrap(uint256 amount)',
] as const

export const GAME_ABI = [
  'function createGame(address opponent, uint256 challengerStakeAmount)',
  'function cancelGame(uint256 gameId)',
  'function acceptGame(uint256 gameId, uint256 opponentStakeAmount)',
  'function makeMove(uint256 gameId, uint8 pos)',
  'function games(uint256 gameId) view returns (uint64 blackBits, uint64 whiteBits, tuple(address playerAddr, uint64 dailyCount, uint256 lastPlayed, uint256 stake) p1, tuple(address playerAddr, uint64 dailyCount, uint256 lastPlayed, uint256 stake) p2, uint8 status, bool blackToMove, uint256 lastMoveBlock)',
  'function nextGameId() view returns (uint256)',
  'event GameCreated(uint256 indexed gameId, address indexed challenger, uint256 stake)',
] as const

export const ELO_ABI = [
  'function getELO(address player) view returns (uint256)',
  'function currSeason() view returns (uint256)',
  'function verifyTopThree(address[3] candidates) view',
  'event ResultRecorded(address indexed winner, uint256 newWinnerElo, address indexed loser, uint256 newLoserElo)',
] as const

export const TREASURY_ABI = [
  'function seasonDeadline() view returns (uint256)',
  'function settleSeason(address[3] top3)',
] as const
