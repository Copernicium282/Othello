export interface PieceYangProps {
  size?: string;
}

export function PieceYang({ size = '100%' }: PieceYangProps) {
  return (
    <svg
      className="piece-yang"
      width={size}
      height={size}
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
      style={{ imageRendering: 'pixelated' }}
    >
      {/* Solid white pixel-art disc — 12x12, no gradients */}
      {/* Row 0:  _ _ X X X X X X _ _ */}
      <rect x="2" y="0" width="8" height="1" fill="#F5F5F5" />
      {/* Row 1:  _ X X X X X X X X _ */}
      <rect x="1" y="1" width="10" height="1" fill="#F5F5F5" />
      {/* Rows 2-9: X X X X X X X X X X */}
      <rect x="0" y="2" width="12" height="8" fill="#F5F5F5" />
      {/* Row 10: _ X X X X X X X X _ */}
      <rect x="1" y="10" width="10" height="1" fill="#F5F5F5" />
      {/* Row 11: _ _ X X X X X X _ _ */}
      <rect x="2" y="11" width="8" height="1" fill="#F5F5F5" />
    </svg>
  );
}

export default PieceYang;
