/** AI engine adapted from na-o-ys/othello-ai : TypeScript Othello AI with alpha-beta pruning and iterative deepening. */

import { getLegalMoves, makeMove, popcount } from './othello'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

export interface BestMove {
  position: number
  score: number
}

// Position weight table : corners are king, adjacent-to-corner is deadly
const WEIGHTS: number[] = [
   120, -20,  20,   5,   5,  20, -20,  120,
   -20, -40,  -5,  -5,  -5,  -5, -40,  -20,
    20,  -5,  15,   3,   3,  15,  -5,   20,
     5,  -5,   3,   3,   3,   3,  -5,   5,
     5,  -5,   3,   3,   3,   3,  -5,   5,
    20,  -5,  15,   3,   3,  15,  -5,  20,
   -20, -40,  -5,  -5,  -5,  -5, -40,  -20,
   120, -20,  20,   5,   5,  20, -20,  120,
]

const DIFFICULTY_CONFIG = {
  easy:   { maxDepth: 2,  timeLimit: 50,   randomFactor: 0.3 },
  medium: { maxDepth: 4,  timeLimit: 200,  randomFactor: 0.05 },
  hard:   { maxDepth: 8,  timeLimit: 1000, randomFactor: 0 },
  expert: { maxDepth: 10, timeLimit: 800, randomFactor: 0 },
} satisfies Record<Difficulty, { maxDepth: number; timeLimit: number; randomFactor: number }>

/** Static evaluation: position weights + mobility */
function evaluate(myBits: bigint, opBits: bigint): number {
  let score = 0
  for (let i = 0; i < 64; i++) {
    const bit = 1n << BigInt(i)
    if (myBits & bit) score += WEIGHTS[i]
    else if (opBits & bit) score -= WEIGHTS[i]
  }
  // Mobility bonus
  const myMoves = getLegalMoves(myBits, opBits).length
  const opMoves = getLegalMoves(opBits, myBits).length
  score += (myMoves - opMoves) * 10
  // Disc count in endgame (45+ stones)
  const total = popcount(myBits) + popcount(opBits)
  if (total > 45) {
    score += (popcount(myBits) - popcount(opBits)) * 50
  }
  return score
}

/** Minimax with alpha-beta pruning */
function alphaBeta(
  myBits: bigint,
  opBits: bigint,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number,
): number {
  if (Date.now() > deadline) throw new Error('timeout')

  const moves = getLegalMoves(myBits, opBits)

  // No moves : pass or game over
  if (moves.length === 0) {
    const opponentMoves = getLegalMoves(opBits, myBits)
    if (opponentMoves.length === 0) {
      // Game over : score by disc count
      const myScore = popcount(myBits)
      const opScore = popcount(opBits)
      if (myScore > opScore) return 10000 + (myScore - opScore)
      if (myScore < opScore) return -10000 - (opScore - myScore)
      return 0
    }
    // Pass : opponent's turn
    return -alphaBeta(opBits, myBits, depth - 1, -beta, -alpha, deadline)
  }

  if (depth <= 0) return evaluate(myBits, opBits)

  // Move ordering: sort by position weight (best first)
  moves.sort((a, b) => WEIGHTS[b] - WEIGHTS[a])

  for (const pos of moves) {
    const { myBits: newMy, opBits: newOp } = makeMove(myBits, opBits, pos)
    const score = -alphaBeta(newOp, newMy, depth - 1, -beta, -alpha, deadline)
    if (score >= beta) return beta
    if (score > alpha) alpha = score
  }

  return alpha
}

/** Iterative deepening search */
function search(myBits: bigint, opBits: bigint, config: { maxDepth: number; timeLimit: number }): BestMove[] {
  const moves = getLegalMoves(myBits, opBits)
  if (moves.length === 0) return []
  if (moves.length === 1) return [{ position: moves[0], score: 0 }]

  const deadline = Date.now() + config.timeLimit
  let results: BestMove[] = moves.map(p => ({ position: p, score: 0 }))

  for (let depth = 1; depth <= config.maxDepth; depth++) {
    try {
      const scores = moves.map(pos => {
        const { myBits: newMy, opBits: newOp } = makeMove(myBits, opBits, pos)
        const score = -alphaBeta(newOp, newMy, depth - 1, -10001, 10001, deadline)
        return { position: pos, score }
      })
      scores.sort((a, b) => b.score - a.score)
      results = scores
    } catch {
      break // Timeout : use results from previous depth
    }
  }

  return results
}

/** Get the best move for the AI */
export function getBestMove(
  myBits: bigint,
  opBits: bigint,
  difficulty: Difficulty = 'medium',
): BestMove | null {
  const config = DIFFICULTY_CONFIG[difficulty]
  const results = search(myBits, opBits, config)
  if (results.length === 0) return null

  const top = results[0]
  // For easy/medium: add some randomness
  if (config.randomFactor > 0 && results.length > 1) {
    const threshold = top.score - Math.abs(top.score) * config.randomFactor - 50
    const candidates = results.filter(r => r.score >= threshold)
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)]
    }
  }

  return top
}

/** Get the game result for the AI's perspective */
export function getResult(myBits: bigint, opBits: bigint): 'win' | 'loss' | 'draw' {
  const myCount = popcount(myBits)
  const opCount = popcount(opBits)
  if (myCount > opCount) return 'win'
  if (myCount < opCount) return 'loss'
  return 'draw'
}
