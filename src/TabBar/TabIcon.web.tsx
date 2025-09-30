import { memo, type CSSProperties } from 'react';
import { Image, type ImageSourcePropType } from 'react-native';

export interface TabIconProps {
  source: ImageSourcePropType;
  tintColor?: string;
}

const resolveImageUri = (
  source: ImageSourcePropType | undefined
): string | undefined => {
  if (!source) return undefined;
  const resolved =
    typeof Image.resolveAssetSource === 'function'
      ? Image.resolveAssetSource(source)
      : undefined;
  if (resolved?.uri) return resolved.uri as string;
  if (Array.isArray(source)) {
    const first = source[0] as any;
    if (first && typeof first === 'object' && 'uri' in first)
      return first.uri as string;
  }
  if (typeof source === 'object' && source && 'uri' in (source as any))
    return (source as any).uri as string;
  return undefined;
};

export const TabIcon = memo(({ source, tintColor }: TabIconProps) => {
  const iconUri = resolveImageUri(source);
  const useMask = Boolean(tintColor && iconUri);
  if (useMask && iconUri) {
    const maskStyle = {
      backgroundColor: tintColor,
      WebkitMaskImage: `url(${iconUri})`,
      maskImage: `url(${iconUri})`,
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
    } as unknown as CSSProperties;

    return <div style={maskStyle} />;
  }

  return <Image source={source} />;
});
