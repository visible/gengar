import type { CSSProperties } from 'react';

export const COLUMNS = 32;
export const ROWS = 20;

type Letter = [col: number, row: number, text: string];

export const WORD: Letter = [14, 9, 'gengar'];

export const LETTERS: Letter[] = [
  [0, 0, 'g'],
  [7, 0, 'e'],
  [14, 0, 'g'],
  [3, 1, 'r'],
  [14, 1, 'e'],
  [27, 1, 'a'],
  [10, 2, 'a'],
  [20, 2, 'g'],
  [30, 2, 'n'],
  [6, 3, 'n'],
  [14, 3, 'g'],
  [24, 3, 'e'],
  [2, 4, 'a'],
  [17, 4, 'a'],
  [28, 4, 'g'],
  [9, 5, 'r'],
  [21, 5, 'n'],
  [4, 6, 'e'],
  [12, 6, 'g'],
  [25, 6, 'r'],
  [19, 7, 'a'],
  [29, 7, 'e'],
  [7, 8, 'r'],
  [16, 8, 'e'],
  [0, 9, 'g e n'],
  [22, 9, 'g a'],
  [5, 10, 'n'],
  [15, 10, 'a'],
  [26, 10, 'g'],
  [1, 11, 'a'],
  [15, 11, 'r'],
  [21, 11, 'e'],
  [9, 12, 'g'],
  [30, 12, 'a'],
  [3, 13, 'e'],
  [18, 13, 'r'],
  [6, 14, 'g'],
  [12, 14, 'a'],
  [20, 14, 'e'],
  [26, 14, 'n'],
  [10, 15, 'r'],
  [29, 15, 'e'],
  [0, 16, 'g'],
  [7, 16, 'e'],
  [14, 16, 'n'],
  [23, 16, 'g a'],
  [3, 17, 'n'],
  [14, 17, 'a'],
  [22, 17, 'e'],
  [28, 17, 'r'],
  [9, 18, 'a'],
  [19, 18, 'g'],
  [30, 18, 'g'],
  [5, 19, 'r'],
  [14, 19, 'g']
];

export const delay = (seed: number) => `${(((seed * 2654435761) >>> 0) % 900) / 1000}s`;

const place = ([col, row]: Letter): CSSProperties => ({
  left: `${(col / COLUMNS) * 100}%`,
  top: `${(row / ROWS) * 100}%`
});

export function Grid() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 text-[clamp(13px,min(1.9vw,3.4dvh),34px)] leading-[1.05] font-bold tracking-[-0.015em]"
    >
      {[...LETTERS, WORD].map((letter, k) => (
        <div
          key={k}
          className={`absolute whitespace-pre ${letter === WORD ? '' : 'opacity-35'}`}
          style={place(letter)}
        >
          {[...letter[2]].map((char, j) =>
            char.trim() ? (
              <span key={j} className="set" style={{ animationDelay: delay(k * 31 + j + 1) }}>
                {char}
              </span>
            ) : (
              char
            )
          )}
        </div>
      ))}
    </div>
  );
}
