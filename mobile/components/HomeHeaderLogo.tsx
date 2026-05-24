import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SvgXml } from 'react-native-svg';

import {
  HEADER_LOGO_HEIGHT,
  HEADER_LOGO_SVG_XML,
  HEADER_LOGO_WIDTH,
} from './headerLogoAsset';

type Props = {
  /** Lacivert header üzerinde okunaklılık için varsayılan beyaz */
  color?: string;
};

/**
 * Ana sayfa header’ında gösterilen logo.
 * SVG’nizi düzenlemek için `headerLogoAsset.ts` dosyasına bakın.
 */
export function HomeHeaderLogo({ color = '#ffffff' }: Props) {
  const xml = HEADER_LOGO_SVG_XML.replace(/__LOGO_COLOR__/g, color);

  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="VisionPark">
      <SvgXml xml={xml} width={HEADER_LOGO_WIDTH} height={HEADER_LOGO_HEIGHT} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    maxWidth: '100%',
  },
});
