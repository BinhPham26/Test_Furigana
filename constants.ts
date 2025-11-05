
import { TextStyle } from './types';

export const DEFAULT_TEXT_STYLES: Record<string, TextStyle> = {
  japanese: {
    fontSize: 26,
    fontWeight: '700',
    fontStyle: 'normal',
    textAlign: 'center',
    color: '#2d3748',
    position: { x: 50, y: 25 },
    width: 80,
    fontFamily: '"Kosugi Maru", sans-serif',
    letterSpacing: 0.5,
    lineHeight: 2.2,
    furiganaOffset: 1,
  },
  english: {
    fontSize: 20,
    fontWeight: '400',
    fontStyle: 'normal',
    textAlign: 'center',
    color: '#000000',
    position: { x: 50, y: 58 },
    width: 80,
    fontFamily: 'Verdana, sans-serif',
    letterSpacing: 0.5,
    lineHeight: 1.5,
    furiganaOffset: 0,
  },
  vietnamese: {
    fontSize: 20,
    fontWeight: '400',
    fontStyle: 'normal',
    textAlign: 'center',
    color: '#000000',
    position: { x: 50, y: 72 },
    width: 80,
    fontFamily: 'Verdana, sans-serif',
    letterSpacing: 0.5,
    lineHeight: 1.5,
    furiganaOffset: 0,
  },
};
