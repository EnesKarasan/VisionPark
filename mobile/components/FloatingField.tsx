import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { spacing, fontSize, fontWeight, radius, type ThemeColors } from '../constants/Theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export type FloatingFieldProps = Omit<
  TextInputProps,
  'placeholder' | 'value' | 'onChangeText' | 'style'
> & {
  colors: ThemeColors;
  fieldLabel: string;
  value: string;
  onChangeText: (text: string) => void;
  marginBottom?: number;
};

const WEB_NO_FOCUS_RING: ViewStyle =
  Platform.OS === 'web'
    ? ({
        outlineWidth: 0,
        outlineStyle: 'solid',
        outlineColor: 'transparent',
      } as ViewStyle)
    : {};

const WEB_INPUT_NO_FOCUS_RING: TextStyle =
  Platform.OS === 'web'
    ? ({
        outlineWidth: 0,
        outlineStyle: 'solid',
        outlineColor: 'transparent',
      } as TextStyle)
    : {};

export function FloatingField({
  colors,
  fieldLabel,
  value,
  onChangeText,
  editable = true,
  marginBottom = spacing.md,
  onFocus,
  onBlur,
  ...rest
}: FloatingFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasContent = value.length > 0;
  const shouldFloat = focused || hasContent;
  const accent = colors.brandDeep;
  const borderColor = focused ? accent : colors.inputBorder;

  const progress = useRef(new Animated.Value(shouldFloat ? 1 : 0)).current;

  useEffect(() => {
    const to = shouldFloat ? 1 : 0;
    Animated.timing(progress, {
      toValue: to,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [shouldFloat, progress]);

  const labelTop = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [Platform.OS === 'ios' ? 15 : 13, Platform.OS === 'ios' ? 8 : 6],
  });
  const labelFontSize = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [fontSize.md, fontSize.xs],
  });
  const inputPaddingTop = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [Platform.OS === 'ios' ? 14 : 12, Platform.OS === 'ios' ? 20 : 18],
  });

  const labelColorStr = !shouldFloat
    ? colors.textTertiary
    : focused
      ? accent
      : colors.textSecondary;

  return (
    <View style={{ marginBottom }}>
      <View
        style={[
          styles.floatWrap,
          WEB_NO_FOCUS_RING,
          {
            borderColor,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.floatLabel,
            {
              top: labelTop,
              fontSize: labelFontSize,
              color: labelColorStr,
            },
          ]}
          pointerEvents="none"
        >
          {fieldLabel}
        </Animated.Text>
        <AnimatedTextInput
          {...rest}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          placeholder=""
          underlineColorAndroid="transparent"
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.floatInput,
            WEB_INPUT_NO_FOCUS_RING,
            {
              color: colors.text,
              paddingTop: inputPaddingTop,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatWrap: {
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  floatLabel: {
    position: 'absolute',
    left: spacing.md,
    fontWeight: fontWeight.semibold,
    zIndex: 1,
  },
  floatInput: {
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: fontSize.md,
    margin: 0,
  },
});
