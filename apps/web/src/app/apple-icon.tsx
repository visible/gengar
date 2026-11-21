import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#9146ff' }}>
        <svg width="180" height="180" viewBox="0 0 16 16">
          <path
            fill="#ffffff"
            fillRule="evenodd"
            d="M13 2V10H7A4 4 0 0 1 7 2ZM10 5V7H7.5A1 1 0 0 1 7.5 5ZM10 11H13V11.5A2.5 2.5 0 0 1 10.5 14H4V11Z"
          />
        </svg>
      </div>
    ),
    size
  );
}
