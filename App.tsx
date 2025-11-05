
import React, { useState, useCallback, useRef, useEffect, forwardRef } from 'react';
import { generateSlides } from './services/geminiService';
import { TextStyle, TextBoxContent, Slide } from './types';
import Editor from './components/Editor';
import { DEFAULT_TEXT_STYLES } from './constants';
import { Toolbar } from './components/Toolbar';
import { Thumbnail } from './components/Thumbnail';
import { SlideView } from './components/SlideView';
import { v4 as uuidv4 } from 'uuid';


declare global {
  interface Window {
    htmlToImage: any;
    JSZip: any;
  }
}

interface AppState {
  slides: Slide[];
  groupSpacings: Record<string, number>;
}

interface ExportPreviewProps {
  slide: Slide;
  backgroundImage: string;
}


const PreviewModal: React.FC<{
  slide: Slide;
  backgroundImage: string;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}> = ({ slide, backgroundImage, onClose, onNavigate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'ArrowLeft') {
        onNavigate('prev');
      }
      if (e.key === 'ArrowRight') {
        onNavigate('next');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate]);

  useEffect(() => {
    const calculateScale = () => {
        if (containerRef.current) {
            const { clientWidth: containerWidth, clientHeight: containerHeight } = containerRef.current;
            const baseWidth = 1280;
            const baseHeight = 720;
            const scaleX = containerWidth / baseWidth;
            const scaleY = containerHeight / baseHeight;
            setScale(Math.min(scaleX, scaleY) * 0.95); // Add some padding
        }
    };
    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="relative bg-white overflow-hidden shadow-2xl"
        style={{
            width: '1280px',
            height: '720px',
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <SlideView
          slide={slide}
          backgroundImage={backgroundImage}
          idPrefix="preview"
        />
      </div>
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-5xl hover:text-gray-300 transition-colors"
        aria-label="Close preview"
      >
        &times;
      </button>
    </div>
  );
};

const ExportProgressModal: React.FC<{ progress: number; total: number; message: string }> = ({ progress, total, message }) => {
  const percent = total > 0 ? (progress / total) * 100 : 0;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-slate-800 p-8 rounded-lg shadow-xl text-white w-full max-w-md text-center">
        <h3 className="text-2xl font-bold mb-4">Export in Progress</h3>
        <p className="mb-6 min-h-[1.5em]">{message}</p>
        <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-brand-primary to-brand-secondary h-4 rounded-full transition-all duration-300 ease-linear"
            style={{ width: `${percent}%` }}
          ></div>
        </div>
        <p className="mt-4 text-lg font-semibold">{`${Math.round(percent)}% Complete`}</p>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [japaneseText, setJapaneseText] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<{ active: boolean; message: string }>({ active: false, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [selectedTextboxId, setSelectedTextboxId] = useState<string | null>(null);
  const [editingTextboxId, setEditingTextboxId] = useState<string | null>(null);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isExportingCurrent, setIsExportingCurrent] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{width: number, height: number} | null>(null);
  const [exportingSlideIndex, setExportingSlideIndex] = useState<number | null>(null);
  const [exportStatusMessage, setExportStatusMessage] = useState<string>('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [exportFileName, setExportFileName] = useState('furigana_slides');
  
  const [history, setHistory] = useState<{
    past: AppState[];
    present: AppState;
    future: AppState[];
  }>({
    past: [],
    present: { slides: [], groupSpacings: {} },
    future: [],
  });

  const { slides, groupSpacings } = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const thumbnailsContainerRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<(HTMLDivElement | null)[]>([]);
  const exportNodeRef = useRef<HTMLDivElement>(null);
  const zipRef = useRef<any>(null);

  const setStateAndHistory = useCallback((newState: Partial<AppState>) => {
    setHistory(current => {
      const newPresent = { ...current.present, ...newState };
      if (JSON.stringify(newPresent) === JSON.stringify(current.present)) {
        return current;
      }
      return {
        past: [...current.past, current.present],
        present: newPresent,
        future: [],
      };
    });
  }, []);

  const resetHistory = useCallback((present: AppState) => {
    setHistory({ past: [], present, future: [] });
  }, []);

  const undo = useCallback(() => {
    if (!canUndo) return;
    setHistory(current => {
      const previous = current.past[current.past.length - 1];
      const newPast = current.past.slice(0, current.past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;
    setHistory(current => {
      const next = current.future[0];
      const newFuture = current.future.slice(1);
      return {
        past: [...current.past, current.present],
        present: next,
        future: newFuture,
      };
    });
  }, [canRedo]);


  useEffect(() => {
    const fontUrl = 'https://fonts.googleapis.com/css2?family=Kosugi+Maru&family=M+PLUS+Rounded+1c:wght@400;700;800&family=Noto+Sans+JP:wght@400;700&family=Sawarabi+Mincho&family=Shippori+Mincho:wght@400;700&family=Yuji+Syuku&family=Zen+Kaku+Gothic+New:wght@400;700&display=swap';

    const inlineFontStyles = async () => {
      try {
        const response = await fetch(fontUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch font CSS: ${response.statusText}`);
        }
        const cssText = await response.text();
        const style = document.createElement('style');
        style.id = 'google-fonts-inline';
        style.textContent = cssText;
        document.head.appendChild(style);
      } catch (error) {
        console.error('Could not inline Google Fonts:', error);
        setError('Failed to load custom fonts. Exported images may not look correct.');
      }
    };
    
    if (!document.getElementById('google-fonts-inline')) {
        inlineFontStyles();
    }
  }, []);
  
  const handleStyleChange = (textboxId: string, newStyle: Partial<TextStyle>) => {
    const sourceSlideIndex = currentSlideIndex;
    const sourceSlide = slides[sourceSlideIndex];
    if (!sourceSlide) return;

    const sourceTextbox = sourceSlide.textBoxes.find(tb => tb.id === textboxId);
    if (!sourceTextbox) return;

    const textboxType = sourceTextbox.type;
    
    const finalSourceStyle = { ...sourceTextbox.style, ...newStyle };

    const newSlides = slides.map((slide, index) => {
        if (index < sourceSlideIndex) {
            return slide;
        }

        let newTextBoxes = slide.textBoxes;

        if (index === sourceSlideIndex) {
            let dy = 0;
            if (newStyle.position) {
                dy = finalSourceStyle.position.y - sourceTextbox.style.position.y;
            }

            newTextBoxes = slide.textBoxes.map(tb => {
                if (tb.id === textboxId) {
                    return { ...tb, style: finalSourceStyle };
                }
                
                if (sourceTextbox.groupId && tb.groupId === sourceTextbox.groupId && dy !== 0) {
                    return {
                        ...tb,
                        style: {
                            ...tb.style,
                            position: {
                                ...tb.style.position,
                                y: tb.style.position.y + dy,
                            },
                        },
                    };
                }

                return tb;
            });
        }
        
        if (index > sourceSlideIndex) {
            newTextBoxes = slide.textBoxes.map(tb => {
                if (tb.type === textboxType) {
                    return { ...tb, style: { ...tb.style, ...newStyle } };
                }
                return tb;
            });
        }
        
        return { ...slide, textBoxes: newTextBoxes };
    });

    setStateAndHistory({ slides: newSlides });
  };


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModifier = isMac ? e.metaKey : e.ctrlKey;

      if (isModifier && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (isModifier && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      
      const activeElement = document.activeElement;
      
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const isNavigating = editorRef.current === activeElement || thumbnailsContainerRef.current === activeElement;
        if (isNavigating) {
            e.preventDefault();
            const direction = e.key === 'ArrowLeft' ? -1 : 1;
            const newIndex = currentSlideIndex + direction;
            if (newIndex >= 0 && newIndex < slides.length) {
                setCurrentSlideIndex(newIndex);
            }
            return;
        }
      }
      
      if (selectedTextboxId && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const selectedTextbox = slides[currentSlideIndex]?.textBoxes.find(tb => tb.id === selectedTextboxId);
        if (selectedTextbox) {
            const step = e.shiftKey ? 2.5 : 0.5;
            const direction = e.key === 'ArrowUp' ? -1 : 1;
            const currentStyle = selectedTextbox.style;
            const newPosition = { ...currentStyle.position, y: currentStyle.position.y + direction * step };
            handleStyleChange(selectedTextboxId, { position: newPosition });
        }
        return;
      }

      if (slides.length === 0 || isPreviewing) return;

      if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const slideToDuplicate = slides[currentSlideIndex];
        const newSlide: Slide = {
            ...slideToDuplicate,
            id: uuidv4(),
            textBoxes: slideToDuplicate.textBoxes.map(tb => ({
                ...tb,
                id: uuidv4()
            }))
        };
        const newSlides = [...slides];
        newSlides.splice(currentSlideIndex + 1, 0, newSlide);
        setStateAndHistory({ slides: newSlides });
        setCurrentSlideIndex(currentSlideIndex + 1);
      }

      if (e.key === 'Delete') {
        e.preventDefault();
        const newSlides = slides.filter((_, index) => index !== currentSlideIndex);
        setStateAndHistory({ slides: newSlides });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    };
}, [slides, currentSlideIndex, isPreviewing, undo, redo, setStateAndHistory, selectedTextboxId]);


  useEffect(() => {
    if (currentSlideIndex >= slides.length && slides.length > 0) {
        setCurrentSlideIndex(slides.length - 1);
    }
  }, [slides, currentSlideIndex]);


  useEffect(() => {
    if (isPreviewing) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = 'auto';
    }
    return () => {
        document.body.style.overflow = 'auto';
    };
  }, [isPreviewing]);


  const ExportPreview = forwardRef<HTMLDivElement, ExportPreviewProps>(({ slide, backgroundImage }, ref) => {
    const scaleFactor = imageDimensions ? imageDimensions.width / 1280 : 1;

    return (
      <div ref={ref} className="w-full h-full bg-white overflow-hidden relative">
        <img src={backgroundImage} alt="background" className="w-full h-full object-cover absolute" />
        <div className="relative w-full h-full">
          {slide.textBoxes.map((tb) => {
            const style = tb.style;
            const scaledFontSize = style.fontSize * scaleFactor;
            const textStyle: React.CSSProperties = {
              position: 'absolute',
              top: `${style.position.y}%`,
              left: `${style.position.x}%`,
              transform: 'translate(-50%, 0)',
              width: `${style.width}%`,
              fontSize: `${scaledFontSize}px`,
              fontWeight: style.fontWeight,
              fontStyle: style.fontStyle,
              color: style.color,
              textAlign: style.textAlign,
              fontFamily: style.fontFamily,
              letterSpacing: `${style.letterSpacing * scaleFactor}px`,
              lineHeight: style.lineHeight,
            };
            const uniqueId = `export-${tb.id}`;
            return (
              <div key={tb.id} style={textStyle}>
                {tb.type === 'japanese' && style.furiganaOffset !== 0 && (
                  <style>{`#${uniqueId} ruby rt { margin-bottom: ${style.furiganaOffset * scaleFactor}px; }`}</style>
                )}
                <div id={uniqueId} dangerouslySetInnerHTML={{ __html: tb.content }} />
              </div>
            );
          })}
        </div>
      </div>
    );
  });
  ExportPreview.displayName = 'ExportPreview';

  useEffect(() => {
    thumbnailRefs.current = thumbnailRefs.current.slice(0, slides.length);
  }, [slides]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setBackgroundImage(imageUrl);
        const img = new Image();
        img.onload = () => {
          setImageDimensions({ width: img.width, height: img.height });
        };
        img.src = imageUrl;
      };
      reader.readAsDataURL(event.target.files[0]);
    }
  };

  const handleApiKeysChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const keys = e.target.value.split(/[\n,]+/).map(k => k.trim()).filter(Boolean);
    setApiKeys(keys);
  };

  const handleGenerateClick = useCallback(async () => {
    if (!japaneseText.trim()) {
      setError('Please enter Japanese text.');
      return;
    }
    if (!backgroundImage) {
      setError('Please upload a background image.');
      return;
    }
    if (apiKeys.length === 0) {
        setError('Please enter at least one Gemini API key.');
        return;
    }

    setError(null);
    
    const textChunks = japaneseText.trim().split(/\n\s*\n/).filter(chunk => chunk.trim() !== '');
    const totalChunks = textChunks.length;

    if (totalChunks === 0) {
        setError('Please enter some Japanese text.');
        return;
    }

    setIsLoading({ active: true, message: 'Starting generation...'});

    try {
      const allGeneratedSlides: Slide[] = [];
      let apiKeyIndex = 0;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = textChunks[i];
        setIsLoading({ active: true, message: `Processing part ${i + 1} of ${totalChunks}...` });

        const currentApiKey = apiKeys[apiKeyIndex];
        apiKeyIndex = (apiKeyIndex + 1) % apiKeys.length;

        const generatedSlidesData = await generateSlides(chunk, currentApiKey);
        
        const newSlides: Slide[] = generatedSlidesData.map((slideData) => ({
            id: uuidv4(),
            textBoxes: [
              { id: uuidv4(), type: 'japanese', content: slideData.japaneseWithFurigana, style: DEFAULT_TEXT_STYLES.japanese },
              { id: uuidv4(), type: 'english', content: slideData.english, style: DEFAULT_TEXT_STYLES.english },
              { id: uuidv4(), type: 'vietnamese', content: slideData.vietnamese, style: DEFAULT_TEXT_STYLES.vietnamese },
            ],
        }));

        allGeneratedSlides.push(...newSlides);

        if (i < totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      resetHistory({ slides: allGeneratedSlides, groupSpacings: {} });
      setCurrentSlideIndex(0);
      setSelectedTextboxId(null);
    } catch (e) {
      console.error(e);
      setError(`Failed to generate content: ${(e as Error).message}`);
    } finally {
      setIsLoading({ active: false, message: '' });
    }
  }, [japaneseText, backgroundImage, apiKeys, resetHistory]);

  const handleTextboxContentChange = (slideIndex: number, textboxId: string, newContent: string) => {
    const newSlides = slides.map((slide, index) => {
        if (index !== slideIndex) return slide;
        return {
            ...slide,
            textBoxes: slide.textBoxes.map(tb =>
                tb.id === textboxId ? { ...tb, content: newContent } : tb
            )
        };
    });
    setStateAndHistory({ slides: newSlides });
  };
  
  const handleSelectAndFocus = (id: string | null) => {
    setSelectedTextboxId(id);
    if (editorRef.current) {
        editorRef.current.focus();
    }
    setEditingTextboxId(null);
  };
  
  const addTextGroup = () => {
    if (currentSlideIndex < 0 || currentSlideIndex >= slides.length) return;
    const groupId = uuidv4();
    const newTextBoxes: TextBoxContent[] = [
        { id: uuidv4(), type: 'japanese', content: 'テキストグループ', groupId, style: { ...DEFAULT_TEXT_STYLES.japanese, color: '#f7504f', fontSize: 24, fontFamily: '"Kosugi Maru", sans-serif', position: { x: 50, y: 25 } } },
        { id: uuidv4(), type: 'english', content: 'Text Group', groupId, style: { ...DEFAULT_TEXT_STYLES.english, color: '#000000', fontSize: 17, fontFamily: 'Verdana, sans-serif', position: { x: 50, y: 33.5 } } },
        { id: uuidv4(), type: 'vietnamese', content: 'Nhóm văn bản', groupId, style: { ...DEFAULT_TEXT_STYLES.vietnamese, color: '#000000', fontSize: 17, fontFamily: 'Verdana, sans-serif', position: { x: 50, y: 38.5 } } },
    ];
    const newSlides = slides.map((slide, index) => index === currentSlideIndex ? { ...slide, textBoxes: [...slide.textBoxes, ...newTextBoxes] } : slide);
    const newGroupSpacings = { ...groupSpacings, [groupId]: 6 };
    setStateAndHistory({ slides: newSlides, groupSpacings: newGroupSpacings });
  };

  const handleGroupSpacingChange = (groupId: string, newSpacing: number) => {
    const oldSpacing = groupSpacings[groupId] ?? 6;
    const dy_px = newSpacing - oldSpacing;
    const dy_percent = (dy_px / 720) * 100; // Canvas height is 720px

    const newSlides = slides.map(slide => {
        const groupExistsInSlide = slide.textBoxes.some(tb => tb.groupId === groupId);
        if (!groupExistsInSlide) return slide;
        
        return {
            ...slide,
            textBoxes: slide.textBoxes.map(tb => {
                if (tb.groupId !== groupId) return tb;
                let yOffsetPercent = 0;
                if (tb.type === 'english') yOffsetPercent = dy_percent;
                if (tb.type === 'vietnamese') yOffsetPercent = dy_percent * 2;
                return {
                    ...tb,
                    style: {
                        ...tb.style,
                        position: { ...tb.style.position, y: tb.style.position.y + yOffsetPercent }
                    }
                }
            })
        }
    });
    setStateAndHistory({ slides: newSlides, groupSpacings: { ...groupSpacings, [groupId]: newSpacing } });
  };

  useEffect(() => {
    if (exportingSlideIndex === null || !imageDimensions || !zipRef.current || !isExportingAll) return;
    const captureAndProceed = async () => {
      const nodeToCapture = exportNodeRef.current;
      if (!nodeToCapture) {
        console.error("Export node not found");
        setError("Export failed: could not render slide for capture.");
        setIsExportingAll(false);
        setExportingSlideIndex(null);
        zipRef.current = null;
        return;
      }
      try {
        const dataUrl = await window.htmlToImage.toPng(nodeToCapture, { quality: 1.0, pixelRatio: 1 });
        const blob = await (await fetch(dataUrl)).blob();
        const finalExportName = exportFileName.trim() || 'slide';
        zipRef.current.file(`${finalExportName}_${String(exportingSlideIndex + 1).padStart(3, '0')}.png`, blob);

        if (exportingSlideIndex < slides.length - 1) {
          setExportStatusMessage(`Processing slide ${exportingSlideIndex + 2} of ${slides.length}...`);
          setExportingSlideIndex(exportingSlideIndex + 1);
        } else {
          setExportStatusMessage("Compressing files...");
          const zipBlob = await zipRef.current.generateAsync({ type: "blob" });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(zipBlob);
          const finalZipName = exportFileName.trim() || 'furigana_slides';
          link.download = `${finalZipName}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setIsExportingAll(false);
          setExportingSlideIndex(null);
          zipRef.current = null;
          setExportStatusMessage('');
        }
      } catch(e) {
        console.error("Capture failed:", e);
        setError("Failed to capture slide. Please try again.");
        setIsExportingAll(false);
        setExportingSlideIndex(null);
        zipRef.current = null;
        setExportStatusMessage('');
      }
    };
    const timer = setTimeout(captureAndProceed, 100);
    return () => clearTimeout(timer);
  }, [exportingSlideIndex, slides, imageDimensions, exportFileName, isExportingAll]);

  const handleExportAll = async () => {
    if (slides.length === 0 || !window.htmlToImage || !window.JSZip) {
      setError("Nothing to export.");
      return;
    }
    if (!imageDimensions) {
      setError("Background image dimensions not loaded. Please try re-uploading the image.");
      return;
    }
    setIsExportingAll(true);
    setError(null);
    setExportStatusMessage(`Processing slide 1 of ${slides.length}...`);
    zipRef.current = new window.JSZip();
    setExportingSlideIndex(0);
  };

  const handleExportCurrent = async () => {
    if (slides.length === 0 || !window.htmlToImage || currentSlideIndex < 0) {
      setError("Nothing to export.");
      return;
    }
    if (!imageDimensions) {
      setError("Background image dimensions not loaded. Please try re-uploading the image.");
      return;
    }
    setIsExportingCurrent(true);
    setError(null);

    setExportingSlideIndex(currentSlideIndex);

    setTimeout(async () => {
      const nodeToCapture = exportNodeRef.current;
      if (!nodeToCapture) {
        setError("Export failed: could not render slide for capture.");
        setIsExportingCurrent(false);
        setExportingSlideIndex(null);
        return;
      }

      try {
        const dataUrl = await window.htmlToImage.toPng(nodeToCapture, { quality: 1.0, pixelRatio: 1 });
        const link = document.createElement('a');
        const finalExportName = exportFileName.trim() || 'slide';
        link.download = `${finalExportName}_${String(currentSlideIndex + 1).padStart(3, '0')}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        console.error("Single slide capture failed:", e);
        setError("Failed to capture slide. Please try again.");
      } finally {
        setIsExportingCurrent(false);
        setExportingSlideIndex(null);
      }
    }, 150);
  };

  const currentSlide = slides[currentSlideIndex];
  const selectedTextbox = currentSlide?.textBoxes.find(tb => tb.id === selectedTextboxId);
  const exportingSlide = exportingSlideIndex !== null ? slides[exportingSlideIndex] : null;

  return (
    <div className="bg-brand-bg-dark min-h-screen text-brand-text-dark font-sans flex flex-col items-center p-4">
      <header className="w-full max-w-6xl text-center mb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-500">
          Furigana Image Generator
        </h1>
        <p className="text-slate-400 mt-2">AI-powered tool to create beautiful Japanese learning materials.</p>
      </header>

      {slides.length === 0 ? (
        <div className="w-full max-w-2xl bg-slate-800 p-8 rounded-2xl shadow-lg flex flex-col gap-6">
          <div className="space-y-2">
            <label htmlFor="bg-upload" className="font-bold text-slate-300">1. Upload Background Image</label>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold py-3 px-4 rounded-lg transition-colors duration-200"
            >
              {backgroundImage ? 'Change Image' : 'Select Image'}
            </button>
            <input
              id="bg-upload"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            {backgroundImage && <img src={backgroundImage} alt="Background preview" className="mt-4 rounded-lg max-h-40 mx-auto" />}
          </div>
          <div className="space-y-2">
            <label htmlFor="jp-text" className="font-bold text-slate-300">2. Paste Japanese Text</label>
            <textarea
              id="jp-text"
              value={japaneseText}
              onChange={(e) => setJapaneseText(e.target.value)}
              placeholder="ここに日本語の文章を入力してください..."
              className="w-full h-48 p-4 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none transition-all duration-200 text-brand-text-dark resize-none"
            />
          </div>
           <div className="space-y-2">
            <label htmlFor="api-keys" className="font-bold text-slate-300">3. Paste Your Gemini API Keys</label>
            <textarea
                id="api-keys"
                value={apiKeys.join('\n')}
                onChange={handleApiKeysChange}
                placeholder="Enter 5-10 Gemini API keys, one per line..."
                className="w-full h-32 p-4 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-brand-primary focus:outline-none transition-all duration-200 text-brand-text-dark resize-none"
            />
           </div>
          <button
            onClick={handleGenerateClick}
            disabled={isLoading.active || !backgroundImage || !japaneseText || apiKeys.length === 0}
            className="w-full bg-gradient-to-r from-brand-primary to-brand-secondary text-white font-bold py-4 px-4 rounded-lg shadow-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200 flex items-center justify-center gap-2"
          >
            {isLoading.active ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isLoading.message}
              </>
            ) : 'Generate Images'}
          </button>
          {error && <p className="text-red-400 text-center">{error}</p>}
        </div>
      ) : (
        <main className="w-full flex flex-col items-center gap-6">
          <div className="flex flex-col lg:flex-row w-full max-w-6xl gap-6">
            <div className="flex-grow flex flex-col items-center gap-4">
               {currentSlide && (
                 <Editor
                  ref={editorRef}
                  slide={currentSlide}
                  backgroundImage={backgroundImage!}
                  onTextboxSelect={handleSelectAndFocus}
                  selectedTextboxId={selectedTextboxId}
                  onContentChange={(textboxId, newContent) => handleTextboxContentChange(currentSlideIndex, textboxId, newContent)}
                  onStyleChange={handleStyleChange}
                  editingTextboxId={editingTextboxId}
                  onSetEditingTextboxId={setEditingTextboxId}
                />
              )}
               {currentSlide && (
                <div className="w-full max-w-4xl flex justify-end">
                    <button
                        onClick={() => setIsPreviewing(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md flex items-center gap-2 transition-colors duration-200"
                        title="Fullscreen Preview (Esc to close)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5M.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5m15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5"/>
                        </svg>
                        Preview
                    </button>
                </div>
               )}
            </div>
            <div className="lg:w-80 flex-shrink-0 bg-slate-800 p-4 rounded-2xl shadow-lg">
              <h2 className="text-lg font-bold mb-4 border-b border-slate-700 pb-2">Styling Tools</h2>
              <button onClick={addTextGroup} className="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md flex items-center justify-center gap-2 transition-colors duration-200">
                Add Text Group
              </button>
              {selectedTextbox ? (
                <Toolbar
                  key={selectedTextbox.id}
                  style={selectedTextbox.style}
                  groupId={selectedTextbox.groupId}
                  groupSpacing={selectedTextbox.groupId ? groupSpacings[selectedTextbox.groupId] : undefined}
                  onStyleChange={(newStyle) => handleStyleChange(selectedTextbox.id, newStyle)}
                  onGroupSpacingChange={(newSpacing) => selectedTextbox.groupId && handleGroupSpacingChange(selectedTextbox.groupId, newSpacing)}
                  isEditing={!!editingTextboxId}
                />
              ) : (
                <p className="text-slate-400 text-center py-8">Select a text box to edit its style.</p>
              )}
            </div>
          </div>
          <div className="w-full max-w-6xl">
             <div className="flex justify-between items-center mb-2">
                <div>
                    <h3 className="text-xl font-bold">Slides</h3>
                    <p className="text-sm text-slate-400">Use Arrow keys to move text, Ctrl+D to duplicate, Delete to remove.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        title="Undo (Cmd+Z)"
                        className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466z"/>
                        </svg>
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        title="Redo (Cmd+Y)"
                        className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966a.25.25 0 0 1 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                        </svg>
                    </button>
                    <div className="flex items-center gap-2 bg-slate-700/50 p-1 rounded-lg">
                      <input
                          type="text"
                          value={exportFileName}
                          onChange={(e) => setExportFileName(e.target.value)}
                          placeholder="Export file name"
                          className="bg-slate-700 h-10 text-white px-3 py-2 rounded-md shadow-inner focus:ring-2 focus:ring-brand-primary focus:outline-none transition-colors duration-200 w-48"
                          aria-label="Export file name"
                      />
                      <button
                          onClick={handleExportCurrent}
                          disabled={isExportingAll || isExportingCurrent}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 px-4 rounded-md shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2 whitespace-nowrap"
                      >
                          {isExportingCurrent ? 'Exporting...' : 'Export Current'}
                      </button>
                      <button
                          onClick={handleExportAll}
                          disabled={isExportingAll || isExportingCurrent}
                          className="bg-green-600 hover:bg-green-700 text-white font-bold h-10 px-4 rounded-md shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2 whitespace-nowrap"
                      >
                          {isExportingAll ? 'Exporting...' : 'Export All (.zip)'}
                      </button>
                    </div>
                </div>
            </div>
            {error && <p className="text-red-400 text-center mb-2">{error}</p>}
            <div ref={thumbnailsContainerRef} tabIndex={0} className="bg-slate-800 p-4 rounded-2xl shadow-lg w-full outline-none focus:ring-2 focus:ring-brand-primary">
              <div className="flex gap-4 overflow-x-auto pb-2">
                {slides.map((slide, index) => (
                    <div key={slide.id} onClick={() => {
                        setCurrentSlideIndex(index);
                        thumbnailsContainerRef.current?.focus();
                    }} className="cursor-pointer">
                      <Thumbnail
                        ref={el => { thumbnailRefs.current[index] = el; }}
                        slide={slide}
                        backgroundImage={backgroundImage!}
                        isSelected={index === currentSlideIndex}
                      />
                    </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}
       {exportingSlide && imageDimensions && (
          <div style={{
              position: 'absolute',
              left: '-9999px',
              top: 0,
              width: `${imageDimensions.width}px`,
              height: `${imageDimensions.height}px`,
          }}>
              <ExportPreview
                  ref={exportNodeRef}
                  slide={exportingSlide}
                  backgroundImage={backgroundImage!}
              />
          </div>
        )}
      {isPreviewing && currentSlide && backgroundImage && (
          <PreviewModal 
              slide={currentSlide}
              backgroundImage={backgroundImage}
              onClose={() => setIsPreviewing(false)}
              onNavigate={(direction) => {
                const d = direction === 'prev' ? -1 : 1;
                const newIndex = currentSlideIndex + d;
                if (newIndex >= 0 && newIndex < slides.length) {
                    setCurrentSlideIndex(newIndex);
                }
              }}
          />
      )}
      {isExportingAll && (
          <ExportProgressModal 
            progress={exportingSlideIndex !== null ? exportingSlideIndex + 1 : slides.length}
            total={slides.length}
            message={exportStatusMessage}
          />
      )}
    </div>
  );
};

export default App;
