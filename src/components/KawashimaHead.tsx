interface KawashimaHeadProps {
  talking?: boolean;
  className?: string;
}

// Points du contour du visage (viewBox 64×64).
const OUTLINE = '32,7 46,15 51,30 45,44 38,54 32,58 26,54 19,44 13,30 18,15';
const OUTLINE_PTS: [number, number][] = [
  [32, 7], [46, 15], [51, 30], [45, 44], [38, 54],
  [32, 58], [26, 54], [19, 44], [13, 30], [18, 15],
];
const NOSE: [number, number] = [32, 38];

/**
 * Hommage « à la manière de » Dr Kawashima : tête low-poly filaire verte,
 * flottante, qui cligne des yeux et anime la bouche quand `talking` est vrai.
 * 100 % SVG/CSS, aucun asset (pas de souci de droits).
 */
export function KawashimaHead({ talking = false, className = '' }: KawashimaHeadProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      style={{ filter: 'drop-shadow(0 0 2px rgba(52,211,153,0.7))' }}
      aria-hidden="true"
    >
      <g className="kawashima-float">
        {/* Facette de fond */}
        <polygon points={OUTLINE} fill="rgba(16,185,129,0.10)" />

        {/* Maillage : éventail depuis le nez vers chaque sommet du contour */}
        {OUTLINE_PTS.map(([x, y], i) => (
          <line
            key={i}
            x1={NOSE[0]}
            y1={NOSE[1]}
            x2={x}
            y2={y}
            stroke="rgba(52,211,153,0.45)"
            strokeWidth="0.6"
          />
        ))}

        {/* Contour du visage */}
        <polygon
          points={OUTLINE}
          fill="none"
          stroke="#34d399"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />

        {/* Yeux (diamants) qui clignent */}
        <polygon className="kawashima-eye" points="24,27 27,29 24,31 21,29" fill="#34d399" />
        <polygon className="kawashima-eye" points="40,27 43,29 40,31 37,29" fill="#34d399" />

        {/* Bouche (s'anime quand il parle) */}
        <polygon
          className={`kawashima-mouth${talking ? ' talking' : ''}`}
          points="27,47 37,47 35,50 29,50"
          fill="#34d399"
        />
      </g>
    </svg>
  );
}
