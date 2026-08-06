import { useState, useEffect, useMemo } from 'react'
import type { Contracts } from './useContracts'
import { getLegalMoves, popcount } from '../lib/othello'

export const STATUS = {
  PENDING: 0,
  ACTIVE: 1,
  FINISHED: 2,
} as const

export type GameStatus = (typeof STATUS)[keyof typeof STATUS]

export interface GameState {
  blackBits: bigint
  whiteBits: bigint
  blackToMove: boolean
  status: GameStatus
  p1Addr: string
  p2Addr: string
  blackCount: number
  whiteCount: number
  activeGame: boolean
  isMyTurn: boolean
  legalMoves: number[]
}

const DEFAULT_STATE: GameState = {
  blackBits: 0x0000000810000000n,
  whiteBits: 0x0000001008000000n,
  blackToMove: true,
  status: STATUS.PENDING,
  p1Addr: '',
  p2Addr: '',
  blackCount: 2,
  whiteCount: 2,
  activeGame: false,
  isMyTurn: false,
  legalMoves: [],
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContractResult = readonly any[]

function parseGameState(
  raw: ContractResult,
  account: string | null,
): GameState {
  const blackBits = BigInt(raw[0] as bigint)
  const whiteBits = BigInt(raw[1] as bigint)
  const p1 = raw[2] as readonly [string, bigint, bigint, bigint]
  const p2 = raw[3] as readonly [string, bigint, bigint, bigint]
  const status = Number(raw[4]) as GameStatus
  const blackToMove = Boolean(raw[5])

  const p1Addr = p1[0]
  const p2Addr = p2[0]
  const activeGame = status === STATUS.ACTIVE
  const isMyTurn =
    activeGame &&
    account !== null &&
    ((account.toLowerCase() === p1Addr.toLowerCase() && blackToMove) ||
      (account.toLowerCase() === p2Addr.toLowerCase() && !blackToMove))

  const legalMoves = activeGame && isMyTurn
    ? getLegalMoves(
        blackToMove ? blackBits : whiteBits,
        blackToMove ? whiteBits : blackBits,
      )
    : []

  return {
    blackBits,
    whiteBits,
    blackToMove,
    status,
    p1Addr,
    p2Addr,
    blackCount: popcount(blackBits),
    whiteCount: popcount(whiteBits),
    activeGame,
    isMyTurn,
    legalMoves,
  }
}

export function useGame(
  gameId: string | null,
  contracts: Contracts | null,
  account: string | null,
): GameState {
  const [state, setState] = useState<GameState>(DEFAULT_STATE)

  useEffect(() => {
    if (!gameId || !contracts) {
      setState(DEFAULT_STATE)
      return
    }

    let cancelled = false

    const fetchGame = async () => {
      try {
        const raw = await contracts.game.games(gameId)
        if (!cancelled) {
          setState(parseGameState(raw, account))
        }
      } catch {
        if (!cancelled) {
          setState(DEFAULT_STATE)
        }
      }
    }

    fetchGame()
    const id = setInterval(fetchGame, 5000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [gameId, contracts, account])

  return useMemo(() => state, [state])
}
