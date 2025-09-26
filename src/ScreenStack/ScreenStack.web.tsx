import type { ReactElement, Key, ReactNode } from 'react';
import { Fragment, memo, useRef } from 'react';
import type {
  ScreenStackItemPhase,
  ScreenStackItemProps,
} from '../ScreenStackItem/ScreenStackItem.types';
import TransitionStack, {
  type TransitionStackType,
} from '../web/TransitionStack';
import {
  Children,
  cloneElement,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';

type RecordT = {
  key: Key;
  phase: ScreenStackItemPhase;
  element: ReactElement<ScreenStackItemProps>;
};

type ScreenStackProps = {
  children: ReactNode;
  transitionTime?: number;
  type?: TransitionStackType;
  animated?: boolean;
};

export const ScreenStack = memo<ScreenStackProps>((props) => {
  const { children, transitionTime = 250, type, animated = true } = props;
  const [records, setRecords] = useState<RecordT[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const transitionRef = useRef<
    ((id: number, animate?: boolean) => void | boolean) | null
  >(null);
  const prevSelectedRef = useRef<number>(-1);
  const lastExitingIndexRef = useRef<number | null>(null);
  const prevSignatureRef = useRef<string | null>(null);

  const childArray = useMemo(
    () =>
      Children.toArray(children).filter(
        Boolean
      ) as ReactElement<ScreenStackItemProps>[],
    [children]
  );
  const nextKeys = useMemo(
    () => childArray.map((c) => c.key as Key),
    [childArray]
  );
  useLayoutEffect(() => {
    setRecords((prev) => {
      const prevKeys = prev.map((r) => r.key);
      // Bail out early when keys are identical to avoid unnecessary state churn
      // that could incorrectly mark items as exiting on parent re-renders
      if (
        prevKeys.length === nextKeys.length &&
        prevKeys.every((k, i) => k === nextKeys[i])
      ) {
        return prev;
      }
      if (
        nextKeys.length === prevKeys.length + 1 &&
        prevKeys.every((k, i) => k === nextKeys[i])
      ) {
        const child = childArray[childArray.length - 1];
        if (!child) return prev;
        const key = child.key as Key;
        const element = cloneElement<ScreenStackItemProps>(child, {
          phase: 'active',
        });
        return [...prev, { key, phase: 'active', element }];
      }

      if (
        prevKeys.length === nextKeys.length + 1 &&
        nextKeys.every((k, i) => k === prevKeys[i])
      ) {
        const last = prev[prev.length - 1];
        if (!last) return prev;
        if (last.phase === 'exiting') return prev;
        return [
          ...prev.slice(0, -1),
          {
            key: last.key,
            phase: 'exiting',
            element: cloneElement<ScreenStackItemProps>(last.element, {
              phase: 'exiting',
            }),
          },
        ];
      }

      const nextByKey = new Map<Key, ReactElement<ScreenStackItemProps>>();
      for (const ch of childArray) nextByKey.set(ch.key as Key, ch);

      const prevByKey = new Map<Key, RecordT>();
      for (const r of prev) prevByKey.set(r.key, r);

      const result: RecordT[] = [];

      for (const ch of childArray) {
        const key = ch.key as Key;
        const existed = prevByKey.get(key);
        const nextEl = cloneElement<ScreenStackItemProps>(ch, {
          phase: 'active',
        });
        if (existed) {
          const sameActive = existed.phase === 'active';
          result.push(
            sameActive
              ? { key, phase: 'active', element: nextEl }
              : { key, phase: 'active', element: nextEl }
          );
        } else {
          result.push({ key, phase: 'active', element: nextEl });
        }
      }

      for (const r of prev) {
        if (!nextByKey.has(r.key)) {
          const exitingEl = cloneElement<ScreenStackItemProps>(r.element, {
            phase: 'exiting',
          });
          result.push({ key: r.key, phase: 'exiting', element: exitingEl });
        }
      }

      return result;
    });
  }, [childArray, nextKeys]);

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
      {records.map((r) => (
        <Fragment key={r.key}>{r.element}</Fragment>
      ))}
    </div>
  );
});
