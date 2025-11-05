
import React, { forwardRef } from 'react';
import { Slide } from '../types';
import { SlideView } from './SlideView';

interface ThumbnailProps {
  slide: Slide;
  backgroundImage: string;
  isSelected: boolean;
}

export const Thumbnail = forwardRef<HTMLDivElement, ThumbnailProps>(
  ({ slide, backgroundImage, isSelected }, ref) => {
    const baseWidth = 1280;
    const thumbWidth = 192;
    const thumbHeight = 108;
    const scale = thumbWidth / baseWidth;

    return (
      <div
        ref={ref}
        className={`bg-slate-900 rounded-lg shadow-md overflow-hidden relative flex-shrink-0 transition-all duration-200 ${
          isSelected ? 'ring-4 ring-brand-primary' : 'ring-2 ring-transparent hover:ring-slate-500'
        }`}
        style={{
          width: `${thumbWidth}px`,
          height: `${thumbHeight}px`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${baseWidth}px`,
            height: `${baseWidth * 9 / 16}px`, // 720px
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <SlideView 
            slide={slide} 
            backgroundImage={backgroundImage} 
            idPrefix={`thumb-${slide.id}`}
          />
        </div>
      </div>
    );
  }
);
Thumbnail.displayName = 'Thumbnail';
