import { StyleSheet } from 'react-native-unistyles';

const lightTheme = {
  colors: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    card: '#f6f6f6',
    typography: '#111827',
    muted: '#666666',
    tint: '#0A84FF',
  },
  gap: (v: number) => v * 8,
};

const darkTheme = {
  colors: {
    background: '#10161F',
    surface: '#0B1220',
    card: '#1C2333',
    typography: '#E5E7EB',
    muted: '#9CA3AF',
    tint: '#0A84FF',
  },
  gap: (v: number) => v * 8,
};

const breakpoints = {
  xs: 0,
  sm: 360,
  md: 600,
  lg: 900,
  xl: 1200,
};

export const appThemes = {
  light: lightTheme,
  dark: darkTheme,
};

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;
export type AppThemeName = keyof typeof appThemes;

declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}

StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: {
    initialTheme: 'light',
  },
});
