
export interface ImageSlide {
  japanese: string;
  japaneseWithFurigana: string;
  english: string;
  vietnamese: string;
}

export interface TextStyle {
  fontSize: number;
  fontWeight: string;
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  position: { x: number; y: number };
  width: number;
  fontFamily: string;
  letterSpacing: number;
  lineHeight: number;
  furiganaOffset: number; // For adjusting space between kanji and furigana
}

export interface TextBoxContent {
  id: string;
  type: 'japanese' | 'english' | 'vietnamese' | 'custom';
  content: string;
  style: TextStyle;
  groupId?: string;
}

export interface Slide {
  id: string;
  textBoxes: TextBoxContent[];
}
