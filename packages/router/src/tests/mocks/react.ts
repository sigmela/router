// Minimal react mock for testing non-UI logic
export const useEffect = () => {};
export const useState = <T,>(init: T): [T, (v: T) => void] => [init, () => {}];
export const useMemo = <T,>(fn: () => T) => fn();
export const useCallback = <T extends (...args: any[]) => any>(fn: T) => fn;
export const memo = <T,>(c: T) => c;
export default { memo, useEffect, useState, useMemo, useCallback } as any;

