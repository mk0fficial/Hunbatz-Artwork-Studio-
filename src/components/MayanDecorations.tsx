import React from 'react';

/**
 * 4-Corner L-shaped Mayan step-fret (xicalcoliuhqui) corner brackets
 */
export const MayanCornerBrackets: React.FC<{
  size?: number;
  color?: string;
  className?: string;
}> = ({ size = 18, color = '#b89058', className = '' }) => {
  return (
    <>
      {/* Top Left */}
      <div
        className={`absolute top-1.5 left-1.5 pointer-events-none opacity-80 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
          <path
            d="M2 14V2H14V6H6V10H10V14H2Z"
            fill={color}
            stroke="#1b140b"
            strokeWidth="0.5"
          />
        </svg>
      </div>

      {/* Top Right */}
      <div
        className={`absolute top-1.5 right-1.5 pointer-events-none opacity-80 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full scale-x-[-1]">
          <path
            d="M2 14V2H14V6H6V10H10V14H2Z"
            fill={color}
            stroke="#1b140b"
            strokeWidth="0.5"
          />
        </svg>
      </div>

      {/* Bottom Left */}
      <div
        className={`absolute bottom-1.5 left-1.5 pointer-events-none opacity-80 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full scale-y-[-1]">
          <path
            d="M2 14V2H14V6H6V10H10V14H2Z"
            fill={color}
            stroke="#1b140b"
            strokeWidth="0.5"
          />
        </svg>
      </div>

      {/* Bottom Right */}
      <div
        className={`absolute bottom-1.5 right-1.5 pointer-events-none opacity-80 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full scale-x-[-1] scale-y-[-1]">
          <path
            d="M2 14V2H14V6H6V10H10V14H2Z"
            fill={color}
            stroke="#1b140b"
            strokeWidth="0.5"
          />
        </svg>
      </div>
    </>
  );
};

/**
 * Elegant Carved Mayan Stone horizontal divider with ceremonial diamond medallion
 */
export const MayanFriezeDivider: React.FC<{
  className?: string;
  color?: string;
}> = ({ className = 'my-2', color = '#b89058' }) => {
  return (
    <div className={`w-full flex items-center justify-center gap-2 select-none py-1 ${className}`}>
      {/* Left carved grooved stone line */}
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#b89058]/30 to-[#b89058]/60" />
      {/* Center ceremonial Mayan diamond glyph medallion */}
      <div className="flex items-center gap-1.5 shrink-0 px-1 text-[#b89058]">
        <span className="text-[7px] text-[#5fd3ad] opacity-80">◆</span>
        <span className="text-[10px] text-[#e6c699] font-bold">❖</span>
        <span className="text-[7px] text-[#5fd3ad] opacity-80">◆</span>
      </div>
      {/* Right carved grooved stone line */}
      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-[#b89058]/30 to-[#b89058]/60" />
    </div>
  );
};

/**
 * Carved Mayan Eagle / Quetzal glyph icon (from image_ffb006eb.png Copy PNG button)
 */
export const MayanEagleGlyph: React.FC<{
  size?: number;
  color?: string;
  className?: string;
}> = ({ size = 16, color = '#e6c699', className = '' }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ width: size, height: size }}
    >
      {/* Mayan sacred bird/eagle profile */}
      <path
        d="M3 13C3 9 7 4 13 4C17 4 21 7 21 11C21 14 19 16 16 16C13 16 12 18 10 20H7L8 16C5 16 3 14 3 13Z"
        stroke={color}
        strokeWidth="1.6"
        fill={`${color}22`}
        strokeLinejoin="round"
      />
      <circle cx="16" cy="9" r="1.5" fill={color} />
      <path d="M18 10L22 11L18 13" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7 11C8.5 11 10 12.5 10 14" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M12 7C14 8 15 9 15 11" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
};

/**
 * Feathered Serpent (Kukulkan) circular dial ring frame (from image_456b4e0a.png)
 */
export const MayanKukulkanRing: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 260, className = '' }) => {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`pointer-events-none ${className}`}
      style={{ width: size, height: size }}
    >
      <circle cx="100" cy="100" r="96" fill="none" stroke="#2c3532" strokeWidth="6" />
      <circle cx="100" cy="100" r="92" fill="none" stroke="#b89058" strokeWidth="2" strokeDasharray="3 3" />
      <circle cx="100" cy="100" r="74" fill="none" stroke="#5fd3ad" strokeWidth="1.5" opacity="0.6" />
      <circle cx="100" cy="100" r="70" fill="none" stroke="#164435" strokeWidth="3" />
      
      {/* 8 Serpent scale medallions around ring */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const cx = 100 + Math.cos(rad) * 85;
        const cy = 100 + Math.sin(rad) * 85;
        return (
          <g key={angle}>
            <circle cx={cx} cy={cy} r="4" fill="#b89058" stroke="#141817" strokeWidth="1" />
            <circle cx={cx} cy={cy} r="2" fill="#5fd3ad" />
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Subtle low-opacity carved Mayan hieroglyph watermark for panel backgrounds
 */
export const MayanGlyphWatermark: React.FC<{
  size?: number;
  opacity?: number;
  className?: string;
}> = ({ size = 70, opacity = 0.12, className = '' }) => {
  return (
    <div
      className={`pointer-events-none select-none absolute ${className}`}
      style={{ width: size, height: size, opacity }}
    >
      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
        {/* Mayan solar day sign / cartouche glyph */}
        <rect x="10" y="10" width="80" height="80" rx="14" stroke="#e6c699" strokeWidth="3" fill="#141817" />
        <circle cx="50" cy="50" r="24" stroke="#b89058" strokeWidth="3" />
        <path d="M50 26V40M50 60V74M26 50H40M60 50H74" stroke="#b89058" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="50" r="8" fill="#5fd3ad" />
        <rect x="20" y="20" width="6" height="6" fill="#e6c699" />
        <rect x="74" y="20" width="6" height="6" fill="#e6c699" />
        <rect x="20" y="74" width="6" height="6" fill="#e6c699" />
        <rect x="74" y="74" width="6" height="6" fill="#e6c699" />
      </svg>
    </div>
  );
};

/**
 * Mayan Serpent Arrow for Undo / Redo
 */
export const MayanSerpentArrow: React.FC<{
  direction: 'left' | 'right';
  size?: number;
  color?: string;
}> = ({ direction, size = 16, color = '#e6c699' }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      style={{
        width: size,
        height: size,
        transform: direction === 'right' ? 'scaleX(-1)' : undefined,
      }}
    >
      <path
        d="M9 14L4 9L9 4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 20V13C20 10.7909 18.2091 9 16 9H4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="1.5" fill={color} />
    </svg>
  );
};
