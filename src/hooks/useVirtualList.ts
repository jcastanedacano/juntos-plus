import { RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface UseVirtualListOptions {
  count: number;
  parentRef: RefObject<HTMLDivElement | null>;
  compact?: boolean;
  overscan?: number;
}

export function useVirtualList({ count, parentRef, compact = false, overscan = 10 }: UseVirtualListOptions) {
  const rowHeight = compact ? 40 : 48;

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan,
  });

  return {
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    rowHeight,
  };
}
