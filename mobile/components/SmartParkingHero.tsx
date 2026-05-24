import React, { useMemo } from 'react';
import { SvgXml } from 'react-native-svg';

import { useTheme } from '@/constants/useTheme';

import { OTOPARK_ALANI_2_XML } from './otoparkAlani2Svg';

type Props = {
  width: number;
  height: number;
};

/** P harfi: mavi levha üzerinde her temada okunaklı beyaz */
const SIGN_INNER = '#ffffff';

export function SmartParkingHero({ width, height }: Props) {
  const colors = useTheme();
  const xml = useMemo(
    () =>
      OTOPARK_ALANI_2_XML.replace(/__BODY__/g, colors.textSecondary)
        .replace(/__SIGN__/g, colors.brandDeep)
        .replace(/__SIGN_INNER__/g, SIGN_INNER),
    [colors.textSecondary, colors.brandDeep],
  );

  return (
    <SvgXml
      xml={xml}
      width={width}
      height={height}
      accessibilityRole="image"
      accessibilityLabel="Otopark alanı illüstrasyonu"
    />
  );
}
