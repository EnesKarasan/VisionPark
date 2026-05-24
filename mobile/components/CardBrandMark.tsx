import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  brand: string;
  size?: number;
  fallbackIconColor?: string;
};

/** API / form farklı yazımları tek tipe indirger */
function normalizeBrand(raw: unknown): string {
  const s = String(raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');
  if (!s) return 'other';
  if (s === 'visa' || s.includes('visa')) return 'visa';
  if (s === 'mc' || s === 'mastercard' || s.includes('master')) return 'mastercard';
  if (s === 'amex' || s.includes('amex') || s.includes('americanexpress')) return 'amex';
  if (s === 'troy' || s.includes('troy')) return 'troy';
  return s;
}

export function CardBrandMark({ brand, size = 28, fallbackIconColor = '#153a5c' }: Props) {
  const b = normalizeBrand(brand);
  const box = Math.max(24, size);

  if (b === 'mastercard') {
    const d = Math.min(26, Math.round(box * 0.68));
    const overlap = Math.round(d * 0.42);
    return (
      <View style={[styles.markBox, styles.mcWrap, { minWidth: d * 2 - overlap + 4, minHeight: d + 4 }]}>
        <View
          style={[
            styles.mcCircle,
            {
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: '#EB001B',
              marginRight: -overlap,
            },
          ]}
        />
        <View
          style={[
            styles.mcCircle,
            {
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: '#F79E1B',
            },
          ]}
        />
      </View>
    );
  }

  if (b === 'visa') {
    const fontSize = Math.max(14, Math.round(box * 0.44));
    return (
      <View style={[styles.markBox, { minWidth: box, minHeight: Math.round(box * 0.75) }]}>
        <Text
          style={[
            styles.visaText,
            { fontSize, color: '#1434CB' },
            Platform.OS === 'web' ? { fontFamily: 'system-ui, "Segoe UI", sans-serif' } : null,
          ]}
        >
          VISA
        </Text>
      </View>
    );
  }

  if (b === 'amex') {
    const w = Math.max(38, Math.round(box * 1.2));
    const h = Math.max(24, Math.round(box * 0.78));
    return (
      <View style={[styles.markBox, { minHeight: h }]}>
        <View style={[styles.amexBox, { width: w, height: h, borderRadius: Math.max(4, box * 0.14) }]}>
          <Text style={[styles.amexText, { fontSize: Math.max(11, Math.round(box * 0.3)) }]}>AMEX</Text>
        </View>
      </View>
    );
  }

  if (b === 'troy') {
    const fs = Math.max(12, Math.round(box * 0.36));
    return (
      <View style={[styles.markBox, styles.troyWrap]}>
        <View style={[styles.troyBarRed, { height: Math.max(14, Math.round(box * 0.48)) }]} />
        <View
          style={[
            styles.troyBarBlue,
            { height: Math.max(14, Math.round(box * 0.48)), marginLeft: 2 },
          ]}
        />
        <Text style={[styles.troyText, { fontSize: fs }]}>TROY</Text>
      </View>
    );
  }

  const iconPx = Math.max(22, Math.round(box * 0.88));
  return (
    <View style={[styles.markBox, { minWidth: box, minHeight: box }]}>
      <Ionicons name="card-outline" size={iconPx} color={fallbackIconColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  markBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mcWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mcCircle: {},
  visaText: {
    fontWeight: '800',
    letterSpacing: 1.2,
    fontStyle: 'italic',
  },
  amexBox: {
    backgroundColor: '#016FD0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  amexText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  troyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  troyBarRed: {
    width: 3,
    borderRadius: 1,
    backgroundColor: '#E30613',
  },
  troyBarBlue: {
    width: 3,
    borderRadius: 1,
    backgroundColor: '#00529C',
  },
  troyText: {
    color: '#00529C',
    fontWeight: '900',
    letterSpacing: 0.5,
    marginLeft: 5,
  },
});
