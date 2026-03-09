import { useCallback, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  getScrollTop: () => number;
  disabled?: boolean;
  threshold?: number;
  maxPull?: number;
}

export const usePullToRefresh = ({
  onRefresh,
  getScrollTop,
  disabled = false,
  threshold = 72,
  maxPull = 132,
}: UsePullToRefreshOptions) => {
  const startYRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);

  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const setDistance = (value: number) => {
    pullDistanceRef.current = value;
    setPullDistance(value);
  };

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (disabled || isRefreshingRef.current) return;
      if (event.touches.length !== 1) return;
      if (getScrollTop() > 0) return;

      startYRef.current = event.touches[0].clientY;
      isTrackingRef.current = true;
    },
    [disabled, getScrollTop]
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!isTrackingRef.current || startYRef.current === null || disabled || isRefreshingRef.current) return;

      const delta = event.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        setDistance(0);
        return;
      }

      if (event.cancelable) event.preventDefault();
      const easedDistance = Math.min(maxPull, delta * 0.55);
      setDistance(easedDistance);
    },
    [disabled, maxPull]
  );

  const finishTracking = useCallback(async () => {
    if (!isTrackingRef.current) return;

    const shouldRefresh = pullDistanceRef.current >= threshold;
    isTrackingRef.current = false;
    startYRef.current = null;
    setDistance(0);

    if (!shouldRefresh || isRefreshingRef.current || disabled) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    try {
      await onRefresh();
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [disabled, onRefresh, threshold]);

  return {
    bindPullToRefresh: {
      onTouchStart,
      onTouchMove,
      onTouchEnd: () => void finishTracking(),
      onTouchCancel: () => void finishTracking(),
    },
    pullDistance,
    isRefreshing,
    readyToRefresh: pullDistance >= threshold,
  };
};
