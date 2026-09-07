import { useRef, useCallback } from 'react';
import { Pencil, Trash2 } from 'lucide-react';

interface SwipeableListItemProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function SwipeableListItem({
  children,
  onEdit,
  onDelete,
  className = ''
}: SwipeableListItemProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    startX.current = e.touches[0].clientX;
    currentX.current = 0;
    if (contentRef.current) {
      contentRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || !contentRef.current) return;
    const deltaX = e.touches[0].clientX - startX.current;
    // Clamp between -80 (delete) and 80 (edit)
    const clamped = Math.max(-80, Math.min(80, deltaX));
    currentX.current = clamped;
    contentRef.current.style.transform = `translateX(${clamped}px)`;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current || !contentRef.current) return;
    isDragging.current = false;
    contentRef.current.style.transition = 'transform 200ms ease';

    if (currentX.current > 60 && onEdit) {
      contentRef.current.style.transform = 'translateX(80px)';
      setTimeout(() => {
        if (contentRef.current) contentRef.current.style.transform = '';
        onEdit();
      }, 200);
    } else if (currentX.current < -60 && onDelete) {
      contentRef.current.style.transform = 'translateX(-80px)';
      setTimeout(() => {
        if (contentRef.current) contentRef.current.style.transform = '';
        onDelete();
      }, 200);
    } else {
      contentRef.current.style.transform = '';
    }
    currentX.current = 0;
  }, [onEdit, onDelete]);

  return (
    <div className={`mobile-swipe-item ${className}`}>
      {/* Background actions */}
      <div className="mobile-swipe-actions">
        {onEdit && (
          <div className="mobile-swipe-action mobile-swipe-edit">
            <Pencil size={18} />
          </div>
        )}
        {onDelete && (
          <div className="mobile-swipe-action mobile-swipe-delete">
            <Trash2 size={18} />
          </div>
        )}
      </div>

      {/* Foreground content */}
      <div
        ref={contentRef}
        className="mobile-swipe-content"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
