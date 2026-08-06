/** Pure Othello bitboard logic — mirrors Solidity flip-direction logic. */

export const INIT_BLACK = 0x0000000810000000n
export const INIT_WHITE = 0x0000001008000000n

const NO_EAST_WRAP = 0x7F7F7F7F7F7F7F7Fn
const NO_WEST_WRAP = 0xFEFEFEFEFEFEFEFEn
const NO_MASK = 0xFFFFFFFFFFFFFFFFn

function flipsInDirection(
  myBits: bigint,
  opBits: bigint,
  pos: number,
  shift: number,
  wrapMask: bigint,
): bigint {
  let cursor = 1n << BigInt(pos)
  let candidates = 0n
  for (let i = 0; i < 8; i++) {
    if (shift > 0) {
      cursor = (cursor & wrapMask) << BigInt(shift)
    } else {
      cursor = (cursor & wrapMask) >> BigInt(-shift)
    }
    if (cursor === 0n) return 0n
    if ((cursor & opBits) !== 0n) {
      candidates |= cursor
      continue
    }
    if ((cursor & myBits) !== 0n) return candidates
    return 0n
  }
  return 0n
}

function getFlips(myBits: bigint, opBits: bigint, pos: number): bigint {
  let flipMask = 0n
  flipMask |= flipsInDirection(myBits, opBits, pos, 8, NO_MASK)    // S
  flipMask |= flipsInDirection(myBits, opBits, pos, -8, NO_MASK)   // N
  flipMask |= flipsInDirection(myBits, opBits, pos, 1, NO_EAST_WRAP)   // E
  flipMask |= flipsInDirection(myBits, opBits, pos, -1, NO_WEST_WRAP)  // W
  flipMask |= flipsInDirection(myBits, opBits, pos, 9, NO_EAST_WRAP)   // SE
  flipMask |= flipsInDirection(myBits, opBits, pos, -9, NO_WEST_WRAP)  // NW
  flipMask |= flipsInDirection(myBits, opBits, pos, 7, NO_WEST_WRAP)   // SW
  flipMask |= flipsInDirection(myBits, opBits, pos, -7, NO_EAST_WRAP)  // NE
  return flipMask
}

/** Returns array of legal position indices (0-63) for the current player. */
export function getLegalMoves(myBits: bigint, opBits: bigint): number[] {
  const empty = ~(myBits | opBits) & 0xFFFFFFFFFFFFFFFFn
  const moves: number[] = []
  for (let pos = 0; pos < 64; pos++) {
    const bit = 1n << BigInt(pos)
    if ((empty & bit) !== 0n && getFlips(myBits, opBits, pos) !== 0n) {
      moves.push(pos)
    }
  }
  return moves
}

/** Count set bits in a 64-bit board. */
export function popcount(bits: bigint): number {
  let count = 0
  let v = bits & 0xFFFFFFFFFFFFFFFFn
  while (v !== 0n) {
    v &= v - 1n
    count++
  }
  return count
}
