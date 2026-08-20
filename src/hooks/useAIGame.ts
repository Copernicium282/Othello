import { useState, useEffect, useCallback, useRef } from 'react'
import { getLegalMoves, makeMove, popcount, INIT_BLACK, INIT_WHITE } from '../lib/othello'
import { getBestMove, getResult, type Difficulty } from '../lib/ai'

export interface AIGameState {
  blackBits: bigint
  whiteBits: bigint
  playerIsBlack: boolean // player always goes first as black
  difficulty: Difficulty
  gameStatus: 'idle' | 'thinking' | 'playing' | 'gameover'
  result: 'win' | 'loss' | 'draw' | null
  moveHistory: number[]
  legalMoves: number[]
  playerCount: number
  aiCount: number
}

export function useAIGame() {
  const [state, setState] = useState<AIGameState>({
    blackBits: INIT_BLACK,
    whiteBits: INIT_WHITE,
    playerIsBlack: true,
    difficulty: 'medium',
    gameStatus: 'idle',
    result: null,
    moveHistory: [],
    legalMoves: getLegalMoves(INIT_BLACK, INIT_WHITE),
    playerCount: 2,
    aiCount: 2,
  })
  const thinkingRef = useRef(false)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const startGame = useCallback((difficulty: Difficulty = state.difficulty) => {
    const black = INIT_BLACK
    const white = INIT_WHITE
    setState({
      blackBits: black,
      whiteBits: white,
      playerIsBlack: true,
      difficulty,
      gameStatus: 'playing',
      result: null,
      moveHistory: [],
      legalMoves: getLegalMoves(black, white),
      playerCount: 2,
      aiCount: 2,
    })
    thinkingRef.current = false
  }, [state.difficulty])

  // Schedule the AI's move 100ms after a state transition so 'thinking'
  // renders first. Runs outside any updater (avoids StrictMode double-invoke
  // and lets 'thinking' render before the search starts).
  const runAIMove = useCallback(() => {
    setTimeout(() => {
      const prev = stateRef.current
      if (prev.gameStatus !== 'thinking') return

      const playerBits = prev.playerIsBlack ? prev.blackBits : prev.whiteBits
      const aiBits = prev.playerIsBlack ? prev.whiteBits : prev.blackBits
      const best = getBestMove(aiBits, playerBits, prev.difficulty)

      if (!best) {
        // AI has no moves : pass back to the player or end the game
        const playerMoves = getLegalMoves(playerBits, aiBits)
        thinkingRef.current = false
        if (playerMoves.length === 0) {
          const r = getResult(prev.blackBits, prev.whiteBits)
          setState({ ...prev, gameStatus: 'gameover', result: r, legalMoves: [] })
        } else {
          setState({ ...prev, gameStatus: 'playing', legalMoves: playerMoves })
        }
        return
      }

      const { myBits: newAi, opBits: newPlayer } = makeMove(aiBits, playerBits, best.position)
      const newBlack = prev.playerIsBlack ? newPlayer : newAi
      const newWhite = prev.playerIsBlack ? newAi : newPlayer
      const newBlackCount = popcount(newBlack)
      const newWhiteCount = popcount(newWhite)

      // Check if game over after AI move
      const nextPlayerMoves = getLegalMoves(newBlack, newWhite)
      const nextAiMoves = getLegalMoves(newWhite, newBlack)

      thinkingRef.current = false

      if (nextPlayerMoves.length === 0 && nextAiMoves.length === 0) {
        const r = getResult(newBlack, newWhite)
        setState({
          ...prev,
          blackBits: newBlack,
          whiteBits: newWhite,
          moveHistory: [...prev.moveHistory, best.position],
          legalMoves: [],
          gameStatus: 'gameover',
          result: r,
          playerCount: newBlackCount,
          aiCount: newWhiteCount,
        })
        return
      }

      setState({
        ...prev,
        blackBits: newBlack,
        whiteBits: newWhite,
        moveHistory: [...prev.moveHistory, best.position],
        legalMoves: nextPlayerMoves.length > 0 ? nextPlayerMoves : [],
        gameStatus: 'playing',
        playerCount: newBlackCount,
        aiCount: newWhiteCount,
      })
    }, 100) // Small delay to show thinking state
  }, [])

  const playerMove = useCallback((pos: number) => {
    const prev = stateRef.current
    if (prev.gameStatus !== 'playing') return
    if (thinkingRef.current) return

    // Player is always black (playerIsBlack = true)
    const myBits = prev.playerIsBlack ? prev.blackBits : prev.whiteBits
    const opBits = prev.playerIsBlack ? prev.whiteBits : prev.blackBits
    const moves = getLegalMoves(myBits, opBits)
    if (!moves.includes(pos)) return

    const { myBits: newMy, opBits: newOp } = makeMove(myBits, opBits, pos)
    const newBlack = prev.playerIsBlack ? newMy : newOp
    const newWhite = prev.playerIsBlack ? newOp : newMy
    const newBlackCount = popcount(newBlack)
    const newWhiteCount = popcount(newWhite)

    const aiMy = !prev.playerIsBlack ? newBlack : newWhite
    const aiOp = prev.playerIsBlack ? newBlack : newWhite
    const aiMoves = getLegalMoves(aiMy, aiOp)
    const playerMovesAfterAi = getLegalMoves(aiOp, aiMy)

    if (aiMoves.length === 0 && playerMovesAfterAi.length === 0) {
      setState({
        ...prev,
        blackBits: newBlack,
        whiteBits: newWhite,
        moveHistory: [...prev.moveHistory, pos],
        legalMoves: [],
        gameStatus: 'gameover',
        result: getResult(newBlack, newWhite),
        playerCount: prev.playerIsBlack ? newBlackCount : newWhiteCount,
        aiCount: prev.playerIsBlack ? newWhiteCount : newBlackCount,
      })
      return
    }

    thinkingRef.current = true
    setState({
      ...prev,
      blackBits: newBlack,
      whiteBits: newWhite,
      moveHistory: [...prev.moveHistory, pos],
      legalMoves: [],
      gameStatus: 'thinking',
      playerCount: prev.playerIsBlack ? newBlackCount : newWhiteCount,
      aiCount: prev.playerIsBlack ? newWhiteCount : newBlackCount,
    })
    runAIMove()
  }, [runAIMove])

  // Auto-pass: Othello passes the turn to the opponent when a player has no
  // legal moves. When it is the player's turn and they have none, flip the
  // turn to the AI (runAIMove). If the AI also has no moves, the game is over.
  useEffect(() => {
    const s = stateRef.current
    if (s.gameStatus !== 'playing') return
    if (thinkingRef.current) return

    const myBits = s.playerIsBlack ? s.blackBits : s.whiteBits
    const opBits = s.playerIsBlack ? s.whiteBits : s.blackBits
    if (getLegalMoves(myBits, opBits).length > 0) return

    if (getLegalMoves(opBits, myBits).length === 0) {
      const r = getResult(s.blackBits, s.whiteBits)
      setState({ ...s, gameStatus: 'gameover', result: r, legalMoves: [] })
      return
    }

    thinkingRef.current = true
    setState({ ...s, gameStatus: 'thinking', legalMoves: [] })
    runAIMove()
  }, [state, runAIMove])

  const setDifficulty = useCallback((d: Difficulty) => {
    setState(prev => ({ ...prev, difficulty: d }))
  }, [])

  return { state, startGame, playerMove, setDifficulty }
}
