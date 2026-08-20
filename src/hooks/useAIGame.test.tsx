import { StrictMode } from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAIGame } from './useAIGame'
import { INIT_BLACK } from '../lib/othello'

function Harness() {
  const { state, startGame, playerMove } = useAIGame()
  return (
    <div>
      <div data-testid="status">{state.gameStatus}</div>
      <div data-testid="black">{state.blackBits.toString()}</div>
      <div data-testid="history">{state.moveHistory.join(',')}</div>
      <div data-testid="legal">{state.legalMoves.join(',')}</div>
      <button data-testid="start" onClick={() => startGame('easy')}>
        start
      </button>
      {Array.from({ length: 64 }, (_, i) => (
        <button key={i} data-testid={`cell-${i}`} onClick={() => playerMove(i)}>
          {i}
        </button>
      ))}
    </div>
  )
}

function legalMoves(): number[] {
  return (screen.getByTestId('legal').textContent ?? '')
    .split(',')
    .filter(Boolean)
    .map(Number)
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useAIGame', () => {
  it('places the player disc and the AI responds', () => {
    render(<Harness />)
    fireEvent.click(screen.getByTestId('start'))
    expect(screen.getByTestId('status').textContent).toBe('playing')

    const firstLegal = legalMoves()[0]
    expect(firstLegal).toBeDefined()
    fireEvent.click(screen.getByTestId(`cell-${firstLegal}`))

    act(() => vi.advanceTimersByTime(200))
    expect(screen.getByTestId('status').textContent).toBe('playing')
    expect(screen.getByTestId('history').textContent!.split(',').length).toBe(2)
    expect(screen.getByTestId('black').textContent).not.toBe(INIT_BLACK.toString())
  })

  it('allows repeated player moves across several turns', () => {
    render(<Harness />)
    fireEvent.click(screen.getByTestId('start'))

    for (let turn = 0; turn < 4; turn++) {
      const moves = legalMoves()
      if (moves.length === 0) break
      fireEvent.click(screen.getByTestId(`cell-${moves[0]}`))
      act(() => vi.advanceTimersByTime(200))
      expect(screen.getByTestId('status').textContent).toBe('playing')
      expect(screen.getByTestId('history').textContent!.split(',').length).toBe((turn + 1) * 2)
    }
  })

  it('works the same under StrictMode (dev)', () => {
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    )
    fireEvent.click(screen.getByTestId('start'))
    const firstLegal = legalMoves()[0]
    fireEvent.click(screen.getByTestId(`cell-${firstLegal}`))
    act(() => vi.advanceTimersByTime(200))
    expect(screen.getByTestId('status').textContent).toBe('playing')
    expect(screen.getByTestId('history').textContent!.split(',').length).toBe(2)
    expect(screen.getByTestId('black').textContent).not.toBe(INIT_BLACK.toString())
  })
})