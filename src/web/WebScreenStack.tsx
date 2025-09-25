import TransitionStack, { type TransitionStackType } from './TransitionStack';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import type { ReactElement, Key } from 'react';
import { useRef } from 'react';

export const WebScreenStackItem = React.memo(
  ({
    children,
    phase = 'active',
  }: {
    children: React.ReactNode;
    phase?: 'active' | 'exiting';
  }) => {
    return (
      <div className="screen-stack-item" data-phase={phase}>
        {children}
      </div>
    );
  }
);

export type Phase = 'active' | 'exiting';
type RecordT<T> = { key: Key; item: T; phase: Phase; element: ReactElement };

export function WebScreenStack<T>({
  items = [] as T[],
  getKey,
  renderItem,
  transitionTime = 250,
  type,
  animated = true,
}: {
  items: T[];
  getKey: (it: T) => Key;
  renderItem: (it: T, phase: Phase) => ReactElement;
  transitionTime?: number;
  type?: TransitionStackType;
  animated?: boolean;
}) {
  const [records, setRecords] = useState<RecordT<T>[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transitionRef = useRef<
    ((id: number, animate?: boolean) => void | boolean) | null
  >(null);
  const prevSelectedRef = useRef<number>(-1);
  const lastExitingIndexRef = useRef<number | null>(null);
  const prevSignatureRef = useRef<string | null>(null);

  const nextKeys = useMemo(() => items.map(getKey), [items, getKey]);
  useLayoutEffect(() => {
    setRecords((prev) => {
      const prevKeys = prev.map((r) => r.key);
      if (
        nextKeys.length === prevKeys.length + 1 &&
        prevKeys.every((k, i) => k === nextKeys[i])
      ) {
        const it = items[items.length - 1];
        if (it === undefined) return prev;
        const key = getKey(it);
        const element = renderItem(it, 'active');
        return [...prev, { key, item: it, phase: 'active', element }];
      }

      if (
        prevKeys.length === nextKeys.length + 1 &&
        nextKeys.every((k, i) => k === prevKeys[i])
      ) {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        if (last.phase === 'exiting') return prev;
        return [...prev.slice(0, -1), { ...last, phase: 'exiting' }];
      }

      const nextByKey = new Map<Key, T>();
      for (const it of items) nextByKey.set(getKey(it), it);

      const result: RecordT<T>[] = [];

      for (const it of items) {
        const key = getKey(it);
        const existed = prev.find((r) => r.key === key);
        if (existed) {
          const sameItem = existed.item === it && existed.phase === 'active';
          result.push(
            sameItem
              ? existed
              : {
                  key,
                  item: it,
                  phase: 'active',
                  element: renderItem(it, 'active'),
                }
          );
        } else {
          result.push({
            key,
            item: it,
            phase: 'active',
            element: renderItem(it, 'active'),
          });
        }
      }

      for (const r of prev) {
        if (!nextByKey.has(r.key)) {
          result.push(r.phase === 'exiting' ? r : { ...r, phase: 'exiting' });
        }
      }

      return result;
    });
  }, [items, nextKeys, getKey, renderItem]);

  useLayoutEffect(() => {
    if (!containerRef.current || transitionRef.current) return;
    transitionRef.current = TransitionStack({
      content: containerRef.current,
      type: type as TransitionStackType,
      transitionTime,
      withAnimationListener: animated,
      onTransitionEnd: () => {
        setRecords((prev) => {
          const idx = lastExitingIndexRef.current ?? -1;
          if (idx < 0 || idx >= prev.length) return prev;
          const candidate = prev[idx];
          if (candidate?.phase !== 'exiting') return prev;
          return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        });
      },
    });
  }, [type, transitionTime, animated]);

  useLayoutEffect(() => {
    if (!transitionRef.current) return;
    const targetIndex = (() => {
      for (let i = records.length - 1; i >= 0; i--) {
        const rec = records[i];
        if (rec && rec.phase === 'active') return i;
      }
      return -1;
    })();
    if (targetIndex === -1) return;
    const outgoingIndex = records.findIndex((it) => it.phase === 'exiting');
    lastExitingIndexRef.current = outgoingIndex !== -1 ? outgoingIndex : null;

    const signature = records
      .map((r) => `${String(r.key)}:${r.phase}`)
      .join('|');
    const stackChanged =
      prevSignatureRef.current !== null &&
      prevSignatureRef.current !== signature;

    const animate = animated && stackChanged;

    transitionRef.current(targetIndex, animate);
    prevSignatureRef.current = signature;
    prevSelectedRef.current = targetIndex;
  }, [records, animated]);

  return (
    <div ref={containerRef} className={`screen-stack${type ? ` ${type}` : ''}`}>
      {records.map((r) => {
        const el =
          r.phase === 'active' ? renderItem(r.item, 'active') : r.element;
        return <React.Fragment key={r.key}>{el}</React.Fragment>;
      })}
    </div>
  );
}
