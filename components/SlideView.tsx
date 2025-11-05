
import React from 'react';
import { Slide } from '../types';

interface SlideViewProps {
  slide: Slide;
  backgroundImage: string;
  idPrefix?: string;
}

export const SlideView: React.FC<SlideViewProps> = ({ slide, backgroundImage, idPrefix = 'view' }) => {
  return (
    <div className="w-full h-full relative" style={{ width: '1280px', height: '720px' }}>
      <img src={backgroundImage} alt="background" className="w-full h-full object-cover absolute" />
      <div className="relative w-full h-full">
        {slide.textBoxes.map((tb) => {
          const style = tb.style;
          if (!style) return null;

          const textStyle: React.CSSProperties = {
            position: 'absolute',
            top: `${style.position.y}%`,
            left: `${style.position.x}%`,
            transform: 'translate(-50%, 0)', // Anchor to top
            width: `${style.width}%`,
            fontSize: `${style.fontSize}px`,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            color: style.color,
            textAlign: style.textAlign,
            fontFamily: style.fontFamily,
            letterSpacing: `${style.letterSpacing}px`,
            lineHeight: style.lineHeight,
          };

          const uniqueId = `${idPrefix}-${tb.id}`;

          return (
            <div key={tb.id} style={textStyle}>
              {tb.type === 'japanese' && style.furiganaOffset !== 0 && (
                <style>{`#${uniqueId} ruby rt { margin-bottom: ${style.furiganaOffset}px; }`}</style>
              )}
              <div
                id={uniqueId}
                dangerouslySetInnerHTML={{ __html: tb.content }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
