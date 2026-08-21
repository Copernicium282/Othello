// --- Contract addresses ---
export const ADDRESSES = {
  yyg: '0x86E9D0284Af16761AD1C3Ab0dbC5ddA6877eA51E',
  elo: '0x423FBEf43A8de868758753f3E04c2733D3466099',
  treasury: '0x713915Cc2ddB0E45622a7FC35E2A8c364784092A',
  game: '0xf8B227247e432709438619a70Bf60710065239f9',
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
  'function createGameWithSession(address opponent, uint256 challengerStakeAmount, address sessionKey, uint64 durationBlocks) payable',
  'function cancelGame(uint256 gameId)',
  'function acceptGame(uint256 gameId, uint256 opponentStakeAmount)',
  'function acceptGameWithSession(uint256 gameId, uint256 opponentStakeAmount, address sessionKey, uint64 durationBlocks) payable',
  'function makeMove(uint256 gameId, uint8 pos)',
  'function moveFor(address player, uint256 gameId, uint8 pos)',
  'function authorizeSession(uint256 gameId, address sessionKey, uint64 durationBlocks)',
  'function revokeSessionKey(address sessionKey)',
  'function sessions(address player, address sessionKey) view returns (uint256 gameId, uint64 expiryBlock)',
  'function games(uint256 gameId) view returns (uint64 blackBits, uint64 whiteBits, tuple(address playerAddr, uint64 dailyCount, uint256 lastPlayed, uint256 stake) p1, tuple(address playerAddr, uint64 dailyCount, uint256 lastPlayed, uint256 stake) p2, uint8 status, bool blackToMove, uint256 lastMoveBlock)',
  'function nextGameId() view returns (uint256)',
  'event GameCreated(uint256 indexed gameId, address indexed challenger, uint256 stake)',
  'event SessionAuthorized(address indexed player, uint256 indexed gameId, address indexed key, uint64 expiryBlock)',
  'event SessionRevoked(address indexed player, address indexed key)',
] as const

export const ELO_ABI = [
  'function getELO(address player) view returns (uint256)',
  'function currSeason() view returns (uint256)',
  'function verifyTopThree(address[3] candidates) view',
  'event ELOUpdated(address indexed winner, uint256 newWinnerElo, address indexed loser, uint256 newLoserElo)',
] as const

export const TREASURY_ABI = [
  'function seasonDeadline() view returns (uint256)',
  'function settleSeason(address[3] top3)',
] as const
