import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useHelp } from '../src/help/HelpContext';
import type { HelpKey } from '../src/help/helpContent';

interface HelpButtonProps {
  entryKey: HelpKey;
  /** Header'da koyu zemin üstündeyse beyaz, açık zeminde lacivert vb. */
  color?: string;
  /** Header sağında biraz boşluk olsun diye varsayılan margin sağda. */
  marginRight?: number;
}

export default function HelpButton({ entryKey, color = '#ffffff', marginRight = 12 }: HelpButtonProps) {
  const { openHelp } = useHelp();
  return (
    <TouchableOpacity
      onPress={() => openHelp(entryKey)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Yardım"
      style={[styles.btn, { marginRight }]}
    >
      <Ionicons name="help-circle-outline" size={24} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 4,
  },
});
