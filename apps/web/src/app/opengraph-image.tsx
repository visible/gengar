import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { COLUMNS, LETTERS, ROWS, WORD } from '@/components/grid';

export const alt = 'Gengar, a Twitch ad blocker';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const font = (weight: number) => readFile(join(process.cwd(), `assets/inter-tight-${weight}.ttf`));

export default async function Image() {
  const [regular, bold] = await Promise.all([font(400), font(700)]);

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#9146ff',
          color: '#ffffff',
          fontFamily: 'Inter Tight'
        }}
      >
        <div style={{ position: 'absolute', top: 60, right: 72, bottom: 52, left: 72, display: 'flex' }}>
          {[...LETTERS, WORD].map(([col, row, text], k) => (
            <div
              key={k}
              style={{
                position: 'absolute',
                left: `${(col / COLUMNS) * 100}%`,
                top: `${(row / ROWS) * 100}%`,
                fontSize: 24,
                fontWeight: 700,
                opacity: text === WORD[2] ? 1 : 0.35,
                lineHeight: 1,
                letterSpacing: -0.36,
                whiteSpace: 'pre'
              }}
            >
              {text}
            </div>
          ))}

          <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', fontSize: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', marginRight: 28, lineHeight: 1.35 }}>
              <span style={{ fontWeight: 700 }}>Gengar</span>
              <span>Twitch ad blocker</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                height: 37,
                marginTop: 6,
                padding: '0 14px',
                border: '2px solid #ffffff',
                fontWeight: 700,
                lineHeight: 1
              }}
            >
              geng.ar
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter Tight', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter Tight', data: bold, weight: 700, style: 'normal' }
      ]
    }
  );
}
