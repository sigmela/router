// Minimal react-native mock for non-UI tests
export type ColorValue = string | number;
export const StyleSheet = { create: (s: any) => s, absoluteFill: {} } as any;
export const View: any = function MockView() {};
export const Text: any = function MockText() {};
export const Button: any = function MockButton() {};
export const Platform = { OS: 'test' } as const;
export type ViewStyle = any;
export type TextStyle = any;
export type ImageStyle = any;

