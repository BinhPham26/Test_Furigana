import React, { useRef, useState, forwardRef, useEffect } from 'react';
import { Slide, TextStyle } from '../types';

interface DraggableTextProps {
  id: string;
  content: string;
  style: TextStyle;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (id: string) => void;
  onSetEditing: (id: string | null) => void;
  onContentChange: (id: string, newContent: string) => void;
  onStyleChange: (id: string, newStyle: Partial<TextStyle>) => void;
  parentRef: React.RefObject<HTMLDivElement>;
}

const DraggableText: React.FC<DraggableTextProps> = ({ id, content, style, isSelected, isEditing, onSelect, onSetEditing, onContentChange, onStyleChange, parentRef }) => {
  const [isDragging, setIsDragging] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialPosition = useRef(style.position);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSetEditing(id);
  };
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) {
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialPosition.current = style.position;
  };

  useEffect(() => {
    if (isEditing && textRef.current) {
        if (textRef.current.innerHTML !== content) {
          textRef.current.innerHTML = content;
        }

        textRef.current.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(textRef.current);
        range.collapse(false);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
    }
  }, [isEditing, content]);

  // Imperatively update styles to avoid re-render issues with contentEditable
  useEffect(() => {
    if (textRef.current) {
      const el = textRef.current;
      el.style.fontSize = `${style.fontSize}px`;
      el.style.fontWeight = style.fontWeight;
      el.style.fontStyle = style.fontStyle;
      el.style.color = style.color;
      el.style.textAlign = style.textAlign;
      el.style.fontFamily = style.fontFamily;
      el.style.letterSpacing = `${style.letterSpacing}px`;
      el.style.lineHeight = `${style.lineHeight}`;
    }
  }, [style]);


  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !parentRef.current) return;
    const parentRect = parentRef.current.getBoundingClientRect();
    const dy = e.clientY - dragStartPos.current.y;
    
    const newY = initialPosition.current.y + (dy / parentRect.height) * 100;
    
    onStyleChange(id, { position: { x: initialPosition.current.x, y: newY } });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if(isDragging) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);
  
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const newFocusedElement = e.relatedTarget as HTMLElement | null;
    
    // If focus is moving to an element within the toolbar, don't exit edit mode.
    if (newFocusedElement && newFocusedElement.closest('[data-editor-ui="toolbar"]')) {
      return;
    }

    // Otherwise, exit edit mode and save content.
    onSetEditing(null);
    onContentChange(id, e.currentTarget.innerHTML);
  };
  
  const handleResizeMouseDown = (direction: 'left' | 'right') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startWidth = style.width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!parentRef.current) return;
        const parentRect = parentRef.current.getBoundingClientRect();
        const dx = moveEvent.clientX - startX;
        
        const widthDelta = (direction === 'left' ? -dx : dx) * 2;
        const widthDeltaPercent = (widthDelta / parentRect.width) * 100;
        
        const newWidth = startWidth + widthDeltaPercent;
        
        onStyleChange(id, { width: Math.max(10, Math.min(100, newWidth)) });
    };

    const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const wrapperStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${style.position.y}%`,
    left: `${style.position.x}%`,
    transform: 'translate(-50%, 0)',
    width: `${style.width}%`,
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: isEditing ? 'auto' : 'none',
  };

  const contentStyle: React.CSSProperties = {
    pointerEvents: isEditing ? 'all' : 'none',
  };

  const uniqueId = `editor-${id}`;

  return (
    <div
      style={wrapperStyle}
      className={`p-2 transition-shadow duration-200 ${isSelected ? 'shadow-lg ring-2 ring-brand-primary ring-offset-2 ring-offset-transparent rounded-md' : ''}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
        {isSelected && !isEditing && (
          <>
            <div
                onMouseDown={handleResizeMouseDown('left')}
                className="absolute top-1/2 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full border-2 border-brand-primary cursor-ew-resize z-10"
            ></div>
            <div
                onMouseDown={handleResizeMouseDown('right')}
                className="absolute top-1/2 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2 bg-white rounded-full border-2 border-brand-primary cursor-ew-resize z-10"
            ></div>
          </>
        )}
        {style.furiganaOffset !== 0 && (
          <style>{`#${uniqueId} ruby rt { margin-bottom: ${style.furiganaOffset}px; }`}</style>
        )}
        <div 
            id={uniqueId}
            ref={textRef}
            contentEditable={isEditing}
            onBlur={handleBlur}
            suppressContentEditableWarning={true}
            dangerouslySetInnerHTML={!isEditing ? { __html: content } : undefined}
            className={`outline-none focus:ring-2 focus:ring-blue-400 rounded-sm ${isEditing ? 'cursor-text' : ''}`}
            style={contentStyle}
        />
    </div>
  );
};

interface EditorProps {
  slide: Slide;
  backgroundImage: string;
  selectedTextboxId: string | null;
  editingTextboxId: string | null;
  onSetEditingTextboxId: (id: string | null) => void;
  onTextboxSelect: (id: string | null) => void;
  onContentChange: (id:string, newContent: string) => void;
  onStyleChange: (id: string, newStyle: Partial<TextStyle>) => void;
}

const Editor = forwardRef<HTMLDivElement, EditorProps>(
  ({ slide, backgroundImage, onTextboxSelect, selectedTextboxId, editingTextboxId, onSetEditingTextboxId, onContentChange, onStyleChange }, ref) => {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const scaledContentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width } = entry.contentRect;
                setScale(width / 1280);
            }
        });

        if (wrapperRef.current) {
            observer.observe(wrapperRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
      <div 
        ref={wrapperRef}
        className="w-full aspect-[16/9] max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden relative"
      >
        <div 
            ref={ref}
            style={{
                width: '1280px',
                height: '720px',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
            }}
            tabIndex={0}
            className="outline-none focus:ring-2 focus:ring-brand-primary"
        >
            <div 
                ref={scaledContentRef}
                className="w-full h-full relative"
                onMouseDown={() => onTextboxSelect(null)}
            >
                <img src={backgroundImage} alt="background" className="w-full h-full object-cover absolute" />
                {slide.textBoxes.map((tb) => (
                    <DraggableText
                        key={tb.id}
                        id={tb.id}
                        content={tb.content}
                        style={tb.style}
                        isSelected={selectedTextboxId === tb.id}
                        isEditing={editingTextboxId === tb.id}
                        onSelect={onTextboxSelect}
                        onSetEditing={onSetEditingTextboxId}
                        onContentChange={onContentChange}
                        onStyleChange={onStyleChange}
                        parentRef={scaledContentRef}
                    />
                ))}
            </div>
        </div>
      </div>
    );
  }
);

Editor.displayName = 'Editor';
export default Editor;