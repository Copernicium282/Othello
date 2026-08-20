import { useMemo } from 'react';
import { PieceYin } from './PieceYin';
import { PieceYang } from './PieceYang';
import { popcount, getFlips } from '../lib/othello';
import './board.css';

export interface BoardProps {
  blackBits: bigint;
  whiteBits: bigint;
  onCellClick?: (position: number) => void;
  legalMoves?: number[];
  isMyTurn?: boolean;
  txPending?: boolean;
  blackToMove?: boolean;
  showFlipCounts?: boolean;
}

function DiscRail({
  position,
  color,
  remainingDiscs,
}: {
  position: 'top' | 'bottom';
  color: 'black' | 'white';
  remainingDiscs: number;
}) {
  const maxCapacity = 32;
  // Standard Othello: 32 discs per player total. Initially 2 on board, so 30 in rail.
  const count = Math.max(0, Math.min(maxCapacity, remainingDiscs));

  return (
    <div className={`disc-rail-container disc-rail-container--${position}`} aria-hidden="true">
      <div className="disc-rail-bezel">
        <div className="disc-rail-channel">
          <div className="disc-rail-stack">
            {Array.from({ length: maxCapacity }, (_, i) => {
              const hasDisc = i < count;
              return (
                <div
                  key={i}
                  className={`rail-chip-slot ${hasDisc ? 'rail-chip-slot--filled' : 'rail-chip-slot--empty'} ${
                    color === 'black' ? 'rail-chip-slot--black' : 'rail-chip-slot--white'
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Board({
  blackBits,
  whiteBits,
  onCellClick,
  legalMoves = [],
  isMyTurn = false,
  txPending = false,
  blackToMove = true,
  showFlipCounts = false,
}: BoardProps) {
  const legalSet = useMemo(() => new Set(legalMoves), [legalMoves]);
  
  // Total discs in standard game = 32 black, 32 white
  // Placed pieces = popcount(blackBits) and popcount(whiteBits)
  const remainingBlack = Math.max(0, 32 - popcount(blackBits));
  const remainingWhite = Math.max(0, 32 - popcount(whiteBits));

  // Compute flip counts for legal moves if available
  const moveFlipCounts = useMemo(() => {
    const map = new Map<number, number>();
    if (!showFlipCounts || !isMyTurn || legalMoves.length === 0) return map;
    const myBits = blackToMove ? blackBits : whiteBits;
    const opBits = blackToMove ? whiteBits : blackBits;
    for (const pos of legalMoves) {
      const flips = getFlips(myBits, opBits, pos);
      map.set(pos, popcount(flips));
    }
    return map;
  }, [showFlipCounts, isMyTurn, legalMoves, blackToMove, blackBits, whiteBits]);

  const cells = Array.from({ length: 64 }, (_, i) => {
    const hasBlack = (blackBits >> BigInt(i)) & 1n;
    const hasWhite = (whiteBits >> BigInt(i)) & 1n;
    const isLegal = legalSet.has(i);
    const flipCount = moveFlipCounts.get(i);

    const classNames = [
      'board-cell',
      isLegal && isMyTurn ? 'board-cell--legal' : '',
      !txPending && isMyTurn && onCellClick && isLegal ? 'board-cell--clickable' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div
        key={i}
        className={classNames}
        onClick={
          !txPending && isMyTurn && onCellClick && isLegal
            ? () => onCellClick(i)
            : undefined
        }
      >
        <div className="board-cell__inner">
          {hasBlack ? (
            <div className="piece-wrapper">
              <PieceYin />
            </div>
          ) : hasWhite ? (
            <div className="piece-wrapper">
              <PieceYang />
            </div>
          ) : isLegal && isMyTurn ? (
            <div className="legal-move-indicator">
              {showFlipCounts && flipCount !== undefined && flipCount > 0 ? (
                <span className="legal-move-badge">{flipCount}</span>
              ) : (
                <span className="legal-move-dot" />
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  });

  return (
    <div className={`board-housing${txPending ? ' board-housing--pending' : ''}`}>
      <DiscRail position="top" color="white" remainingDiscs={remainingWhite} />
      <div className="board-mat">
        <div className="board-grid">{cells}</div>
      </div>
      <DiscRail position="bottom" color="black" remainingDiscs={remainingBlack} />
    </div>
  );
}

export default Board;


