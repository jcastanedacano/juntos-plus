import { useEffect, useRef, useCallback } from 'react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapHeight?: 'auto' | 'half' | 'full';
}

export function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  children,
  snapHeight = 'auto'
}: MobileBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.mobile-bs-handle-area')) {
      isDragging.current = true;
      startY.current = e.touches[0].clientY;
      currentY.current = 0;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !sheetRef.current) return;
    const deltaY = e.touches[0].clientY - startY.current;
    if (deltaY > 0) {
      currentY.current = deltaY;
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current || !sheetRef.current) return;
    isDragging.current = false;
    if (currentY.current > 100) {
      onClose();
    }
    sheetRef.current.style.transform = '';
    currentY.current = 0;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const heightClass = snapHeight === 'full' ? 'mobile-bs-full' : snapHeight === 'half' ? 'mobile-bs-half' : '';

  return (
    <div className="mobile-bs-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className={`mobile-bs-sheet ${heightClass}`}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mobile-bs-handle-area">
          <div className="mobile-bs-handle" />
        </div>
        {title && <div className="mobile-bs-title">{title}</div>}
        <div className="mobile-bs-content">
          {children}
        </div>
      </div>
    </div>
  );
}
