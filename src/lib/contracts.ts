// --- Contract addresses (Celo Sepolia Testnet) ---
export const ADDRESSES = {
  yyg: '0x3AD9B60fAC0E2856a061D7A2322bb2805Afa2319',
  elo: '0xD004ce5B8871Fb1DFc91517cB88538499480BE2E',
  treasury: '0x91CA09E43D3F12C2BBbAbd0c24De8E0798098fe6',
  game: '0x6E883aa086386e6318aC81455Fc3598B583aa4fE',
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
  'function totalMatchesPlayed(address player) view returns (uint256)',
  'function isBeginnerProtectionActive(address player) view returns (bool)',
  'function setBeginnerProtection(bool enabled)',
  'function beginnerProtectionDisabled(address player) view returns (bool)',
  'event BeginnerProtectionToggled(address indexed player, bool enabled)',
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

// Keyed by 4-byte revert selectors (keccak of the error signature, first 4 bytes).
const ERROR_MESSAGES = new Map<string, string>([
  ['0x17286dc4', 'Game is already active, completed, or cancelled.'],
  ['0xc561a2f1', 'You are not the designated opponent or challenger for this game.'],
  ['0xab02711d', 'You cannot play against yourself.'],
  ['0x047e14bb', 'Stake is below the minimum required amount (10 YYG).'],
  ['0x48c7b0bc', 'Failed to transfer YYG stake. Please check your YYG balance and allowance.'],
  ['0x975c58d9', 'Daily game cap exceeded for one of the players.'],
  ['0x2c9ba299', 'Game cooldown in progress. Please wait before challenging again.'],
  ['0x00a30971', 'Game is not in active state.'],
  ['0xe60c8f58', 'It is not your turn to move.'],
  ['0xab08fbe2', 'That move is not legal.'],
  ['0x82432057', 'That board position is already occupied.'],
  ['0x9b0056ac', 'Turn timeout not yet reached.'],
])

/**
 * Map a CALL_EXCEPTION revert to its human-readable message.
 * Callers must narrow caught values with ethers.isError(err, 'CALL_EXCEPTION')
 * before invoking this; that call is the I/O boundary parser. The narrowed
 * error carries `data?: null | string` with the raw revert payload.
 */
export function parseCustomError(error: { data?: null | string }): string | null {
  const selector = (error.data ?? '').slice(0, 10).toLowerCase()
  return ERROR_MESSAGES.get(selector) ?? null
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
