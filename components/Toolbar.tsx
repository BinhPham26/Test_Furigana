import React from 'react';
import { TextStyle } from '../types';

interface ToolbarProps {
  style: TextStyle;
  groupId?: string;
  groupSpacing?: number;
  onStyleChange: (newStyle: Partial<TextStyle>) => void;
  onGroupSpacingChange?: (newSpacing: number) => void;
  isEditing: boolean;
}

const StyleButton: React.FC<{onClick: () => void, isActive: boolean, children: React.ReactNode, title: string}> = ({ onClick, isActive, children, title }) => (
    <button
        title={title}
        onClick={onClick}
        className={`p-2 rounded-md ${isActive ? 'bg-brand-primary text-white' : 'bg-slate-700 hover:bg-slate-600'}`}
    >
        {children}
    </button>
);

const ValueControl: React.FC<{label: string, value: number, onchange?: (value: number) => void, unit?: string, step?: number, min?: number, max?: number}> = 
({label, value, onchange, unit, step = 1, min = -Infinity, max = Infinity}) => (
    <div className="flex items-center justify-between">
        <label className="font-medium text-slate-300">{label}</label>
        <div className="flex items-center gap-2">
            <button onClick={() => onchange && onchange(Math.max(min, value - step))} className="bg-slate-700 w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-600">-</button>
            <span className="bg-slate-900 w-16 text-center py-1 rounded-md tabular-nums">{value.toFixed(unit === '%' ? 0 : 1)}{unit}</span>
            <button onClick={() => onchange && onchange(Math.min(max, value + step))} className="bg-slate-700 w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-600">+</button>
        </div>
    </div>
);


export const Toolbar: React.FC<ToolbarProps> = ({ style, groupId, groupSpacing, onStyleChange, onGroupSpacingChange, isEditing }) => {

  const applyStyleToSelection = (styleToApply: React.CSSProperties) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const span = document.createElement('span');
    Object.entries(styleToApply).forEach(([key, value]) => {
        // @ts-ignore
        span.style[key] = value;
    });

    try {
        range.surroundContents(span);
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (e) {
        console.warn("surroundContents failed, falling back.", e);
        document.execCommand('styleWithCSS', false, 'true');
        if (styleToApply.fontWeight) document.execCommand('bold', false);
        if (styleToApply.fontStyle) document.execCommand('italic', false);
        if (styleToApply.color) document.execCommand('foreColor', false, styleToApply.color as string);
        if (styleToApply.fontFamily) document.execCommand('fontName', false, styleToApply.fontFamily as string);
    }
  };

  const handleGenericStyleChange = (prop: keyof TextStyle, value: any) => {
    const selection = window.getSelection();
    // Only apply to selection if in edit mode AND there is a non-collapsed selection.
    if (isEditing && selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
        let cssStyle: React.CSSProperties = {};
        if (prop === 'fontWeight' || prop === 'fontStyle' || prop === 'color' || prop === 'fontFamily') {
            cssStyle = { [prop]: value };
        } else if (prop === 'fontSize') {
            cssStyle = { fontSize: `${value}px` };
        }
        
        if (Object.keys(cssStyle).length > 0) {
          applyStyleToSelection(cssStyle);
        }
    } else {
        // If not editing, or if editing but no text is selected, apply to the whole box.
        onStyleChange({ [prop]: value });
    }
  };

  return (
    <div className="space-y-6 text-sm" data-editor-ui="toolbar">
      <div className="space-y-3">
        <ValueControl 
            label="Font Size" 
            value={style.fontSize}
            onchange={(v) => handleGenericStyleChange('fontSize', v)}
            unit="px"
            min={8}
            max={200}
        />
        <ValueControl 
            label="Width" 
            value={style.width}
            onchange={(v) => onStyleChange({ 'width': v })}
            unit="%"
            step={1}
            min={10}
            max={100}
        />
        <ValueControl 
            label="Line Height" 
            value={style.lineHeight}
            onchange={(v) => onStyleChange({ 'lineHeight': v })}
            unit=""
            step={0.1}
            min={0.5}
            max={3}
        />
        <ValueControl 
            label="Letter Spacing" 
            value={style.letterSpacing}
            onchange={(v) => onStyleChange({ 'letterSpacing': v })}
            unit="px"
            step={0.5}
            min={-10}
            max={50}
        />
        {style.furiganaOffset !== undefined && (
            <ValueControl 
                label="Furigana Offset" 
                value={style.furiganaOffset}
                onchange={(v) => onStyleChange({ 'furiganaOffset': v })}
                unit="px"
                min={-20}
                max={20}
            />
        )}
        {groupId && groupSpacing !== undefined && onGroupSpacingChange && (
            <ValueControl 
                label="Group Spacing" 
                value={groupSpacing}
                onchange={onGroupSpacingChange}
                unit="px"
                min={-50}
                max={150}
            />
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="fontFamily" className="font-medium">Font Family</label>
        <select
          id="fontFamily"
          value={style.fontFamily}
          onChange={(e) => handleGenericStyleChange('fontFamily', e.target.value)}
          className="w-full bg-slate-700 text-slate-300 font-semibold py-2 px-3 rounded-lg transition-colors duration-200 focus:ring-2 focus:ring-brand-primary focus:outline-none"
        >
          <optgroup label="Japanese">
            <option value='"M PLUS Rounded 1c", sans-serif'>M PLUS Rounded 1c</option>
            <option value='"Noto Sans JP", sans-serif'>Noto Sans JP</option>
            <option value='"Zen Kaku Gothic New", sans-serif'>Zen Kaku Gothic New</option>
            <option value='"Kosugi Maru", sans-serif'>Kosugi Maru</option>
            <option value='"Sawarabi Mincho", serif'>Sawarabi Mincho (Serif)</option>
            <option value='"Shippori Mincho", serif'>Shippori Mincho (Serif)</option>
            <option value='"Yuji Syuku", cursive'>Yuji Syuku (Brush)</option>
          </optgroup>
          <optgroup label="Standard">
            <option value='Arial, sans-serif'>Arial</option>
            <option value='Verdana, sans-serif'>Verdana</option>
            <option value='Georgia, serif'>Georgia</option>
            <option value='"Times New Roman", Times, serif'>Times New Roman</option>
            <option value='"Courier New", Courier, monospace'>Courier New</option>
          </optgroup>
        </select>
      </div>

      <div className="space-y-2">
          <label className="font-medium">Style</label>
          <div className="grid grid-cols-2 gap-2">
             <select
                id="fontWeight"
                title="Font Weight"
                value={style.fontWeight}
                onChange={(e) => handleGenericStyleChange('fontWeight', e.target.value)}
                className="w-full bg-slate-700 text-slate-300 font-semibold p-2 rounded-md transition-colors duration-200 focus:ring-2 focus:ring-brand-primary focus:outline-none"
             >
                <option value="100">100 (Thin)</option>
                <option value="200">200 (Extra Light)</option>
                <option value="300">300 (Light)</option>
                <option value="400">400 (Normal)</option>
                <option value="500">500 (Medium)</option>
                <option value="600">600 (Semi Bold)</option>
                <option value="700">700 (Bold)</option>
                <option value="800">800 (Extra Bold)</option>
                <option value="900">900 (Black)</option>
             </select>
             <StyleButton onClick={() => handleGenericStyleChange('fontStyle', style.fontStyle === 'italic' ? 'normal' : 'italic')} isActive={style.fontStyle === 'italic'} title="Italic">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
             </StyleButton>
          </div>
      </div>

      <div className="space-y-2">
          <label className="font-medium">Alignment</label>
          <div className="grid grid-cols-3 gap-2">
              <StyleButton onClick={() => onStyleChange({ 'textAlign': 'left' })} isActive={style.textAlign === 'left'} title="Align Left">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/></svg>
              </StyleButton>
              <StyleButton onClick={() => onStyleChange({ 'textAlign': 'center' })} isActive={style.textAlign === 'center'} title="Align Center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="17" x2="7" y1="12" y2="12"/><line x1="19" x2="5" y1="18" y2="18"/></svg>
              </StyleButton>
              <StyleButton onClick={() => onStyleChange({ 'textAlign': 'right' })} isActive={style.textAlign === 'right'} title="Align Right">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" x2="3" y1="6" y2="6"/><line x1="21" x2="9" y1="12" y2="12"/><line x1="21" x2="7" y1="18" y2="18"/></svg>
              </StyleButton>
          </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="color" className="font-medium">Color</label>
        <div className="relative">
            <input
            id="color"
            type="color"
            value={style.color}
            onChange={(e) => handleGenericStyleChange('color', e.target.value)}
            className="w-full p-0 h-10 appearance-none bg-transparent border-none cursor-pointer"
            />
        </div>
      </div>
    </div>
  );
};