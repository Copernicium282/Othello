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
  'error NotYourTurn()',
  'error IllegalMove()',
  'error GameNotActive()',
  'error PositionOccupied()',
  'error MinimumStake()',
  'error StakeTransferFailed()',
  'error GameStatusInvalid()',
  'error WrongOpponent()',
  'error ReentrancyGuard()',
  'error FailedSendEth()',
  'error InvalidOpponent()',
  'error TimeoutNotReached()',
  'error ZeroAddress()',
  'error NotAuthorizedSession()',
  'error SessionExpired()',
  'error SessionWrongGame()',
  'error Exceeded_Daily_Cap(uint256 waitTime)',
  'error Cooldown_Valid(uint256 waitTime)',
  'error SessionNotActive()',
  'error NotOwner()',
] as const

export const ERROR_MESSAGES: Record<string, string> = {
  GameStatusInvalid: 'Game is already active, completed, or cancelled.',
  WrongOpponent: 'You are not the designated opponent or challenger for this game.',
  InvalidOpponent: 'You cannot play against yourself.',
  MinimumStake: 'Stake is below the minimum required amount (10 YYG).',
  StakeTransferFailed: 'Failed to transfer YYG stake. Please check your YYG balance and allowance.',
  Exceeded_Daily_Cap: 'Daily game cap exceeded for one of the players.',
  Cooldown_Valid: 'Game cooldown in progress. Please wait before challenging again.',
  GameNotActive: 'Game is not in active state.',
  NotYourTurn: 'It is not your turn to move.',
  IllegalMove: 'That move is not legal.',
  PositionOccupied: 'That board position is already occupied.',
  TimeoutNotReached: 'Turn timeout not yet reached.',
}

export function parseCustomError(err: unknown): string | null {
  if (!err) return null
  const errObj = err as { data?: string; error?: { data?: string }; info?: { error?: { data?: string } } }
  const data = errObj.data || errObj.error?.data || errObj.info?.error?.data
  if (typeof data === 'string' && data.startsWith('0x')) {
    const selector = data.slice(0, 10).toLowerCase()
    if (selector === '0x17286dc4') return ERROR_MESSAGES.GameStatusInvalid
    if (selector === '0xc561a2f1') return ERROR_MESSAGES.WrongOpponent
    if (selector === '0xab02711d') return ERROR_MESSAGES.InvalidOpponent
    if (selector === '0x047e14bb') return ERROR_MESSAGES.MinimumStake
    if (selector === '0x48c7b0bc') return ERROR_MESSAGES.StakeTransferFailed
    if (selector === '0x975c58d9') return ERROR_MESSAGES.Exceeded_Daily_Cap
    if (selector === '0x2c9ba299') return ERROR_MESSAGES.Cooldown_Valid
    if (selector === '0x00a30971') return ERROR_MESSAGES.GameNotActive
    if (selector === '0xe60c8f58') return ERROR_MESSAGES.NotYourTurn
    if (selector === '0xab08fbe2') return ERROR_MESSAGES.IllegalMove
    if (selector === '0x82432057') return ERROR_MESSAGES.PositionOccupied
    if (selector === '0x9b0056ac') return ERROR_MESSAGES.TimeoutNotReached
  }
  return null
}

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
