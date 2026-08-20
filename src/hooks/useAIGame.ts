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

  const playerMove = useCallback((pos: number) => {
    setState(prev => {
      if (prev.gameStatus !== 'playing') return prev
      if (thinkingRef.current) return prev
      
      // Player is always black (playerIsBlack = true)
      const myBits = prev.playerIsBlack ? prev.blackBits : prev.whiteBits
      const opBits = prev.playerIsBlack ? prev.whiteBits : prev.blackBits
      const moves = getLegalMoves(myBits, opBits)
      if (!moves.includes(pos)) return prev
      
      const { myBits: newMy, opBits: newOp } = makeMove(myBits, opBits, pos)
      const newBlack = prev.playerIsBlack ? newMy : newOp
      const newWhite = prev.playerIsBlack ? newOp : newMy
      const newBlackCount = popcount(newBlack)
      const newWhiteCount = popcount(newWhite)
      
      // Check if game is over
      const aiMy = !prev.playerIsBlack ? newBlack : newWhite
      const aiOp = prev.playerIsBlack ? newBlack : newWhite
      const aiMoves = getLegalMoves(aiMy, aiOp)
      const playerMovesAfterAi = getLegalMoves(aiOp, aiMy)
      
      if (aiMoves.length === 0 && playerMovesAfterAi.length === 0) {
        const r = getResult(newBlack, newWhite)
        return {
          ...prev,
          blackBits: newBlack,
          whiteBits: newWhite,
          moveHistory: [...prev.moveHistory, pos],
          legalMoves: [],
          gameStatus: 'gameover',
          result: r,
          playerCount: prev.playerIsBlack ? newBlackCount : newWhiteCount,
          aiCount: prev.playerIsBlack ? newWhiteCount : newBlackCount,
        }
      }
      
      thinkingRef.current = true
      return {
        ...prev,
        blackBits: newBlack,
        whiteBits: newWhite,
        moveHistory: [...prev.moveHistory, pos],
        legalMoves: [],
        gameStatus: 'thinking',
        playerCount: prev.playerIsBlack ? newBlackCount : newWhiteCount,
        aiCount: prev.playerIsBlack ? newWhiteCount : newBlackCount,
      }
    })
    
    // Trigger AI move after state update
    setTimeout(() => {
      const prev = stateRef.current
      if (prev.gameStatus !== 'thinking') return

      // AI is white (player is black)
      const aiBits = prev.whiteBits
      const playerBits = prev.blackBits
      // SAFETY: computed before setState so the search never runs inside an
      // updater (avoids StrictMode double-invoke and lets 'thinking' render first).
      const best = getBestMove(aiBits, playerBits, prev.difficulty)

      if (!best) {
        // AI has no moves : check if player can go again or game over
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
      const newBlack = newPlayer // player is black
      const newWhite = newAi   // AI is white
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

  const setDifficulty = useCallback((d: Difficulty) => {
    setState(prev => ({ ...prev, difficulty: d }))
  }, [])

  return { state, startGame, playerMove, setDifficulty }
}
