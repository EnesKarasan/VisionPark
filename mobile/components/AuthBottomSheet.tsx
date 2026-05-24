import { useCallback, useEffect, useMemo, useRef, useState, createElement } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  Keyboard,
  ScrollView,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import DateTimePicker from './PlatformDateTimePicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../src/auth';

WebBrowser.maybeCompleteAuthSession();

// ── Google OAuth Client ID'leri ──────────────────────────────────────────────
// Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs
// Android: "Android" tipi client (SHA-1 fingerprint + package name gerekir)
// iOS: "iOS" tipi client (bundle ID gerekir)
// Web: "Web application" tipi client (Expo Go ve web için)
const GOOGLE_ANDROID_CLIENT_ID = '';  // örn: 123456789-abc.apps.googleusercontent.com
const GOOGLE_IOS_CLIENT_ID = '';      // örn: 123456789-xyz.apps.googleusercontent.com
const GOOGLE_WEB_CLIENT_ID = '';      // örn: 123456789-web.apps.googleusercontent.com
// ─────────────────────────────────────────────────────────────────────────────
import {
  checkEmailExists,
  requestSignupCode,
  verifySignupCode,
  requestPasswordResetCode,
  verifyPasswordResetCode,
  type CompleteSignupProfile,
} from '../src/api';
import { spacing, radius, fontSize, fontWeight, type ThemeColors } from '../constants/Theme';
import { useTheme } from '../constants/useTheme';

type Step =
  | 'methods'
  | 'email'
  | 'confirmNewAccount'
  | 'password'
  | 'signupCode'
  | 'signupPassword'
  | 'forgotCode'
  | 'forgotNewPassword';

type FocusField =
  | 'email'
  | 'password'
  | 'regFirstName'
  | 'regLastName'
  | 'regBirth'
  | 'regPass'
  | 'regPass2'
  | 'forgotPass'
  | 'forgotPass2';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Şifre ile giriş, kayıt veya şifre sıfırlama sonrası oturum açıldığında (örn. ana sayfaya git) */
  onAuthenticated?: () => void;
};

function GoogleGlyph() {
  return <Ionicons name="logo-google" size={22} color="#4285F4" style={styles.btnIcon} />;
}

const SPRING = { damping: 22, stiffness: 260, mass: 0.85 } as const;

const methodsEntering = FadeIn.duration(200);
const methodsExiting = FadeOut.duration(160);
const stepEntering = FadeIn.duration(220);
const stepExitingBack = FadeOut.duration(160);

const EXPAND_SPRING = { damping: 19, stiffness: 200, mass: 0.75 } as const;
const SHRINK_MS = 340;

const OTP_LEN = 6;
const OTP_CELL_GAP = 10;
const OTP_CELL_SIZE = 48;

const PASSWORD_HINT =
  'En az 8 karakter; en az bir büyük harf, bir küçük harf ve bir rakam.';

function passwordPolicyError(password: string): string | null {
  if (password.length < 8) {
    return 'Şifre en az 8 karakter olmalı.';
  }
  const chars = [...password];
  if (!chars.some((c) => c === c.toUpperCase() && c !== c.toLowerCase())) {
    return 'Şifre en az bir büyük harf içermeli.';
  }
  if (!chars.some((c) => c === c.toLowerCase() && c !== c.toUpperCase())) {
    return 'Şifre en az bir küçük harf içermeli.';
  }
  if (!chars.some((c) => /\d/.test(c))) {
    return 'Şifre en az bir rakam içermeli.';
  }
  return null;
}

const SIGNUP_GENDERS: { key: CompleteSignupProfile['gender']; label: string }[] = [
  { key: 'female', label: 'Kadın' },
  { key: 'male', label: 'Erkek' },
  { key: 'other', label: 'Diğer' },
  { key: 'unspecified', label: 'Belirtmek istemiyorum' },
];

function formatIsoDateToTR(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y}`;
}

function ageFromIso(iso: string): number {
  const [ys, ms, ds] = iso.split('-');
  const y = parseInt(ys, 10);
  const m = parseInt(ms, 10) - 1;
  const d = parseInt(ds, 10);
  const birth = new Date(y, m, d);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function WebBirthDateInput({
  valueIso,
  onChangeIso,
  disabled,
  colors,
  focused,
  onFocus,
  onBlur,
}: {
  valueIso: string;
  onChangeIso: (iso: string) => void;
  disabled: boolean;
  colors: ThemeColors;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  if (Platform.OS !== 'web') return null;
  const maxIso = new Date().toISOString().slice(0, 10);
  return (
    <View
      style={[
        styles.input,
        {
          borderColor: focused ? colors.inputFocusBorder : colors.inputBorder,
          borderWidth: focused ? 2 : 1,
          backgroundColor: colors.inputBg,
        },
        Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
      ]}
    >
      {createElement('input', {
        type: 'date',
        value: valueIso || '',
        max: maxIso,
        min: '1900-01-01',
        disabled,
        onFocus,
        onBlur,
        onChange: (e: { target: { value: string } }) => onChangeIso((e.target as HTMLInputElement).value || ''),
        style: {
          width: '100%',
          fontSize: 16,
          paddingVertical: 14,
          paddingHorizontal: 4,
          border: 'none',
          outline: 'none',
          backgroundColor: 'transparent',
          color: colors.text,
          boxSizing: 'border-box',
        },
      } as Record<string, unknown>)}
    </View>
  );
}

export function AuthBottomSheet({ visible, onClose, onAuthenticated }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const c = useTheme();
  const { login, loginWithGoogle, completeSignup, completePasswordReset } = useAuth();

  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || 'placeholder',
    iosClientId: GOOGLE_IOS_CLIENT_ID || 'placeholder',
    webClientId: GOOGLE_WEB_CLIENT_ID || 'placeholder',
  });

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const accessToken = googleResponse.authentication?.accessToken;
    if (!accessToken) return;
    setLoading(true);
    loginWithGoogle(accessToken)
      .then(() => {
        onClose();
        onAuthenticated?.();
      })
      .catch((e: unknown) => {
        Alert.alert('Hata', (e as Error).message);
      })
      .finally(() => setLoading(false));
  }, [googleResponse]); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState<Step>('methods');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [signupToken, setSignupToken] = useState<string | null>(null);
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');
  /** YYYY-MM-DD (takvim / web date input) */
  const [regBirthIso, setRegBirthIso] = useState('');
  const [birthPickerOpen, setBirthPickerOpen] = useState(false);
  const [genderPickerOpen, setGenderPickerOpen] = useState(false);
  const [signupGender, setSignupGender] = useState<CompleteSignupProfile['gender'] | null>(null);
  const [forgotOtpCode, setForgotOtpCode] = useState('');
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(null);
  const [forgotNewPass, setForgotNewPass] = useState('');
  const [forgotNewPass2, setForgotNewPass2] = useState('');
  const [regPassInvalid, setRegPassInvalid] = useState(false);
  const [regPass2Invalid, setRegPass2Invalid] = useState(false);
  const [forgotPassInvalid, setForgotPassInvalid] = useState(false);
  const [forgotPass2Invalid, setForgotPass2Invalid] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusField | null>(null);
  const [loading, setLoading] = useState(false);
  /** Modal RN'de kapanırken exit animasyonu için mount state */
  const [modalMounted, setModalMounted] = useState(false);
  const sheetOpenRef = useRef(false);
  const otpInputRefs = useRef<Array<TextInput | null>>([]);
  const otpVerifySeqRef = useRef(0);
  const otpVerifyInflightRef = useRef(0);
  const stepRef = useRef<Step>('methods');
  const [otpFocusIndex, setOtpFocusIndex] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  stepRef.current = step;

  const sheetProgress = useSharedValue(0);
  const expandProgress = useSharedValue(0);
  const dragY = useSharedValue(0);
  const dragPanStart = useSharedValue(0);
  /** 1 = yalnızca `methods` adımında aşağı kaydırınca sheet kapanır */
  const canSwipeDismissSheetSV = useSharedValue(1);

  const slideDistance = Math.min(windowH * 0.55, 520);
  const dismissThresholdPx = Math.min(130, windowH * 0.16);
  const expandedSheetH = windowH * 0.92;
  const compactSheetH = Math.max(360, Math.min(windowH * 0.44, 420));

  useEffect(() => {
    canSwipeDismissSheetSV.value = step === 'methods' ? 1 : 0;
    if (step !== 'methods') {
      dragY.value = withSpring(0, SPRING);
    }
  }, [step, canSwipeDismissSheetSV, dragY]);

  useEffect(() => {
    const showEv = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEv = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEv, () => setKeyboardOpen(true));
    const subHide = Keyboard.addListener(hideEv, () => setKeyboardOpen(false));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) setKeyboardOpen(false);
  }, [visible]);

  const kbLayout = useMemo(() => {
    const c = keyboardOpen && step !== 'methods';
    return {
      headerRow: [styles.sheetHeaderRow, c && styles.sheetHeaderRowKb],
      iconSlot: [styles.headerIconSlot, c && styles.headerIconSlotKb],
      handleFlex: [styles.headerHandleFlex, c && styles.headerHandleFlexKb],
      headerIconSize: c ? 20 : 24,
      heroWrap: [styles.mailHeroCircle, c && styles.mailHeroCircleKb],
      heroIcon: c ? 28 : 48,
      stepTitle: [styles.stepTitle, c && styles.stepTitleKb],
      stepSubtitle: [styles.stepSubtitle, c && styles.stepSubtitleKb],
      handleBar: c ? styles.handleKb : undefined,
    };
  }, [keyboardOpen, step]);

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetProgress.value, [0, 1], [0, 1]) * 0.48,
  }));

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          interpolate(sheetProgress.value, [0, 1], [slideDistance, 0]) + dragY.value,
      },
    ],
  }), [slideDistance]);

  const sheetExpandStyle = useAnimatedStyle(() => {
    const h = interpolate(expandProgress.value, [0, 1], [compactSheetH, expandedSheetH]);
    return {
      maxHeight: h,
      overflow: 'hidden' as const,
    };
  }, [compactSheetH, expandedSheetH]);

  const reset = useCallback(() => {
    expandProgress.value = 0;
    dragY.value = 0;
    setStep('methods');
    setEmail('');
    setPassword('');
    setVerificationCode('');
    setSignupToken(null);
    setRegPassword('');
    setRegPasswordConfirm('');
    setRegFirstName('');
    setRegLastName('');
    setRegBirthIso('');
    setBirthPickerOpen(false);
    setGenderPickerOpen(false);
    setSignupGender(null);
    setForgotOtpCode('');
    setPasswordResetToken(null);
    setForgotNewPass('');
    setForgotNewPass2('');
    setRegPassInvalid(false);
    setRegPass2Invalid(false);
    setForgotPassInvalid(false);
    setForgotPass2Invalid(false);
    setFocusedField(null);
    setLoading(false);
    setOtpFocusIndex(0);
  }, [expandProgress, dragY]);

  useEffect(() => {
    setFocusedField(null);
    if (step !== 'signupCode' && step !== 'forgotCode') setOtpFocusIndex(0);
  }, [step]);

  useEffect(() => {
    if (step !== 'signupCode' && step !== 'forgotCode') return;
    const t = setTimeout(() => {
      setOtpFocusIndex(0);
      otpInputRefs.current[0]?.focus();
    }, 280);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (step !== 'signupPassword') {
      setBirthPickerOpen(false);
      setGenderPickerOpen(false);
    }
  }, [step]);

  const fieldStyle = (key: FocusField, tight?: boolean, invalid?: boolean) => {
    const focused = focusedField === key;
    return [
      styles.input,
      tight ? styles.inputTight : null,
      {
        borderColor: invalid ? c.danger : focused ? c.inputFocusBorder : c.inputBorder,
        borderWidth: invalid || focused ? 2 : 1,
        backgroundColor: c.inputBg,
        color: c.text,
      },
      Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
    ];
  };

  useEffect(() => {
    if (visible) {
      sheetOpenRef.current = true;
      setModalMounted(true);
      dragY.value = 0;
      sheetProgress.value = 0;
      requestAnimationFrame(() => {
        sheetProgress.value = withSpring(1, SPRING);
      });
      return;
    }
    if (sheetOpenRef.current) {
      dragY.value = 0;
      sheetProgress.value = withTiming(
        0,
        { duration: 220, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) {
            sheetOpenRef.current = false;
            runOnJS(setModalMounted)(false);
          }
        },
      );
    }
  }, [visible, sheetProgress]);

  useEffect(() => {
    if (!visible && !modalMounted) {
      reset();
    }
  }, [visible, modalMounted, reset]);

  useEffect(() => {
    if (step === 'methods') return;
    expandProgress.value = withSpring(1, EXPAND_SPRING);
  }, [step, expandProgress]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const onGooglePress = () => {
    if (!GOOGLE_WEB_CLIENT_ID && !GOOGLE_ANDROID_CLIENT_ID && !GOOGLE_IOS_CLIENT_ID) {
      Alert.alert('Yapılandırma Eksik', 'Google Client ID\'leri henüz ayarlanmamış.');
      return;
    }
    void promptGoogleAsync();
  };

  const sendSignupCodeForNewAccount = useCallback(async (trimmed: string) => {
    setLoading(true);
    try {
      const sent = await requestSignupCode(trimmed);
      if (sent.debug_code) {
        Alert.alert('Geliştirme', `Doğrulama kodu: ${sent.debug_code}`);
      }
      setVerificationCode('');
      setStep('signupCode');
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const onEmailContinue = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Hata', 'Lütfen e-posta adresinizi girin.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      Alert.alert('Hata', 'Geçerli bir e-posta adresi girin.');
      return;
    }
    setLoading(true);
    try {
      const exists = await checkEmailExists(trimmed);
      if (exists) {
        setStep('password');
        return;
      }
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error).message);
      return;
    } finally {
      setLoading(false);
    }

    setStep('confirmNewAccount');
  };

  const onLogin = async () => {
    if (!password) {
      Alert.alert('Hata', 'Şifrenizi girin.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      onAuthenticated?.();
      handleClose();
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const goBackFromEmail = useCallback(() => {
    expandProgress.value = withTiming(
      0,
      { duration: SHRINK_MS, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setStep)('methods');
      },
    );
  }, [expandProgress]);

  const goBackFromConfirmNewAccount = () => setStep('email');

  const goBackFromPassword = () => setStep('email');

  const goBackFromSignupCode = () => {
    setVerificationCode('');
    setStep('email');
  };

  const goBackFromSignupPassword = () => setStep('signupCode');

  const goBackFromForgotCode = () => {
    setForgotOtpCode('');
    setPasswordResetToken(null);
    setStep('password');
  };

  const goBackFromForgotNewPassword = () => {
    setForgotNewPass('');
    setForgotNewPass2('');
    setPasswordResetToken(null);
    setStep('forgotCode');
  };

  const onForgotPasswordPress = async () => {
    const em = email.trim();
    if (!em) {
      Alert.alert('Hata', 'Önce e-posta adresini gir.');
      return;
    }
    setLoading(true);
    try {
      const sent = await requestPasswordResetCode(em);
      if (sent.debug_code) {
        Alert.alert('Geliştirme', `Şifre sıfırlama kodu: ${sent.debug_code}`);
      }
      setForgotOtpCode('');
      setPasswordResetToken(null);
      setForgotNewPass('');
      setForgotNewPass2('');
      setStep('forgotCode');
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const focusOtpCell = (index: number) => {
    const i = Math.max(0, Math.min(index, OTP_LEN - 1));
    setOtpFocusIndex(i);
    otpInputRefs.current[i]?.focus();
  };

  const handleOtpCellChange = (index: number, text: string) => {
    const digitsOnly = text.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      const pasted = digitsOnly.slice(0, OTP_LEN);
      setVerificationCode(pasted);
      const nextFocus = Math.min(pasted.length, OTP_LEN - 1);
      setOtpFocusIndex(nextFocus);
      setTimeout(() => otpInputRefs.current[nextFocus]?.focus(), 0);
      return;
    }
    if (text === '') {
      setVerificationCode((prev) => prev.slice(0, index) + prev.slice(index + 1));
      if (index > 0) {
        setOtpFocusIndex(index - 1);
        setTimeout(() => otpInputRefs.current[index - 1]?.focus(), 0);
      }
      return;
    }
    const digit = digitsOnly.slice(-1);
    setVerificationCode((prev) =>
      (prev.slice(0, index) + digit + prev.slice(index + 1)).slice(0, OTP_LEN),
    );
    if (index < OTP_LEN - 1) {
      setOtpFocusIndex(index + 1);
      setTimeout(() => otpInputRefs.current[index + 1]?.focus(), 0);
    }
  };

  const handleOtpKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (verificationCode[index]) return;
    if (index === 0) return;
    setVerificationCode((prev) => prev.slice(0, index - 1) + prev.slice(index));
    setOtpFocusIndex(index - 1);
    otpInputRefs.current[index - 1]?.focus();
  };

  const handleForgotOtpCellChange = (index: number, text: string) => {
    const digitsOnly = text.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      const pasted = digitsOnly.slice(0, OTP_LEN);
      setForgotOtpCode(pasted);
      const nextFocus = Math.min(pasted.length, OTP_LEN - 1);
      setOtpFocusIndex(nextFocus);
      setTimeout(() => otpInputRefs.current[nextFocus]?.focus(), 0);
      return;
    }
    if (text === '') {
      setForgotOtpCode((prev) => prev.slice(0, index) + prev.slice(index + 1));
      if (index > 0) {
        setOtpFocusIndex(index - 1);
        setTimeout(() => otpInputRefs.current[index - 1]?.focus(), 0);
      }
      return;
    }
    const digit = digitsOnly.slice(-1);
    setForgotOtpCode((prev) =>
      (prev.slice(0, index) + digit + prev.slice(index + 1)).slice(0, OTP_LEN),
    );
    if (index < OTP_LEN - 1) {
      setOtpFocusIndex(index + 1);
      setTimeout(() => otpInputRefs.current[index + 1]?.focus(), 0);
    }
  };

  const handleForgotOtpKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key !== 'Backspace') return;
    if (forgotOtpCode[index]) return;
    if (index === 0) return;
    setForgotOtpCode((prev) => prev.slice(0, index - 1) + prev.slice(index));
    setOtpFocusIndex(index - 1);
    otpInputRefs.current[index - 1]?.focus();
  };

  const runVerifySignupCode = useCallback(async (codeRaw: string) => {
    const code = codeRaw.replace(/\s/g, '');
    const seq = ++otpVerifySeqRef.current;
    otpVerifyInflightRef.current += 1;
    setLoading(true);
    try {
      const { signup_token } = await verifySignupCode(email.trim(), code);
      if (stepRef.current !== 'signupCode') return;
      setSignupToken(signup_token);
      setRegPassword('');
      setRegPasswordConfirm('');
      setRegFirstName('');
      setRegLastName('');
      setRegBirthIso('');
      setBirthPickerOpen(false);
      setGenderPickerOpen(false);
      setSignupGender(null);
      setVerificationCode('');
      setStep('signupPassword');
    } catch {
      if (seq !== otpVerifySeqRef.current) return;
      if (stepRef.current !== 'signupCode') return;
      Alert.alert(
        'Yanlış kod',
        'Doğrulama kodu hatalı veya süresi dolmuş. Lütfen tekrar dene.',
      );
      setVerificationCode('');
      setOtpFocusIndex(0);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 0);
    } finally {
      otpVerifyInflightRef.current -= 1;
      if (otpVerifyInflightRef.current <= 0) {
        otpVerifyInflightRef.current = 0;
        setLoading(false);
      }
    }
  }, [email]);

  const runVerifyForgotCode = useCallback(async (codeRaw: string) => {
    const code = codeRaw.replace(/\s/g, '');
    const seq = ++otpVerifySeqRef.current;
    otpVerifyInflightRef.current += 1;
    setLoading(true);
    try {
      const { reset_token } = await verifyPasswordResetCode(email.trim(), code);
      if (stepRef.current !== 'forgotCode') return;
      setPasswordResetToken(reset_token);
      setForgotNewPass('');
      setForgotNewPass2('');
      setForgotOtpCode('');
      setStep('forgotNewPassword');
    } catch {
      if (seq !== otpVerifySeqRef.current) return;
      if (stepRef.current !== 'forgotCode') return;
      Alert.alert(
        'Yanlış kod',
        'Doğrulama kodu hatalı veya süresi dolmuş. Lütfen tekrar dene.',
      );
      setForgotOtpCode('');
      setOtpFocusIndex(0);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 0);
    } finally {
      otpVerifyInflightRef.current -= 1;
      if (otpVerifyInflightRef.current <= 0) {
        otpVerifyInflightRef.current = 0;
        setLoading(false);
      }
    }
  }, [email]);

  const onVerifyCodeContinue = useCallback(() => {
    const code = verificationCode.replace(/\s/g, '');
    if (code.length !== OTP_LEN || !/^\d+$/.test(code)) {
      Alert.alert('Hata', '6 haneli kodu girin.');
      return;
    }
    void runVerifySignupCode(code);
  }, [verificationCode, runVerifySignupCode]);

  useEffect(() => {
    if (step !== 'signupCode') return;
    const code = verificationCode.replace(/\s/g, '');
    if (code.length !== OTP_LEN || !/^\d+$/.test(code)) return;
    void runVerifySignupCode(code);
  }, [step, verificationCode, runVerifySignupCode]);

  const onVerifyForgotCodeContinue = useCallback(() => {
    const code = forgotOtpCode.replace(/\s/g, '');
    if (code.length !== OTP_LEN || !/^\d+$/.test(code)) {
      Alert.alert('Hata', '6 haneli kodu girin.');
      return;
    }
    void runVerifyForgotCode(code);
  }, [forgotOtpCode, runVerifyForgotCode]);

  useEffect(() => {
    if (step !== 'forgotCode') return;
    const code = forgotOtpCode.replace(/\s/g, '');
    if (code.length !== OTP_LEN || !/^\d+$/.test(code)) return;
    void runVerifyForgotCode(code);
  }, [step, forgotOtpCode, runVerifyForgotCode]);

  const onCompleteSignup = async () => {
    if (!signupToken) {
      Alert.alert('Hata', 'Oturum süresi doldu. Tekrar kod isteyin.');
      return;
    }
    const regPwdErr = passwordPolicyError(regPassword);
    if (regPwdErr) {
      setRegPassInvalid(true);
      setRegPass2Invalid(false);
      Alert.alert('Hata', regPwdErr);
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setRegPassInvalid(true);
      setRegPass2Invalid(true);
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    const fn = regFirstName.trim();
    const ln = regLastName.trim();
    if (!fn || !ln) {
      Alert.alert('Hata', 'Ad ve soyad zorunludur.');
      return;
    }
    if (!regBirthIso) {
      Alert.alert('Hata', 'Doğum tarihini seç.');
      return;
    }
    if (ageFromIso(regBirthIso) < 18) {
      Alert.alert('Yaş sınırı', 'Kayıt için en az 18 yaşında olmalısın.');
      return;
    }
    if (!signupGender) {
      Alert.alert('Hata', 'Lütfen cinsiyet seç.');
      return;
    }
    setLoading(true);
    try {
      await completeSignup(signupToken, regPassword, {
        first_name: fn,
        last_name: ln,
        birth_date: regBirthIso,
        gender: signupGender,
      });
      onAuthenticated?.();
      handleClose();
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onCompletePasswordReset = async () => {
    if (!passwordResetToken) {
      Alert.alert('Hata', 'Oturum süresi doldu. Tekrar kod isteyin.');
      return;
    }
    const forgotPwdErr = passwordPolicyError(forgotNewPass);
    if (forgotPwdErr) {
      setForgotPassInvalid(true);
      setForgotPass2Invalid(false);
      Alert.alert('Hata', forgotPwdErr);
      return;
    }
    if (forgotNewPass !== forgotNewPass2) {
      setForgotPassInvalid(true);
      setForgotPass2Invalid(true);
      Alert.alert('Hata', 'Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      await completePasswordReset(passwordResetToken, forgotNewPass);
      setPassword('');
      setForgotNewPass('');
      setForgotNewPass2('');
      setPasswordResetToken(null);
      setForgotOtpCode('');
      setStep('email');
      Alert.alert(
        'Şifre güncellendi',
        'Yeni şifrenle giriş yapmak için e-postanı doğrulayıp devam edebilirsin.',
      );
    } catch (e: unknown) {
      Alert.alert('Hata', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onStepClosePress = () => {
    if (step === 'email') goBackFromEmail();
    else if (step === 'confirmNewAccount') goBackFromConfirmNewAccount();
    else if (step === 'password') goBackFromPassword();
    else if (step === 'signupCode') goBackFromSignupCode();
    else if (step === 'signupPassword') goBackFromSignupPassword();
    else if (step === 'forgotCode') goBackFromForgotCode();
    else if (step === 'forgotNewPassword') goBackFromForgotNewPassword();
  };

  const onRequestCloseModal = () => {
    if (step === 'methods') handleClose();
    else onStepClosePress();
  };

  const sheetPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(14)
        .failOffsetX([-32, 32])
        .onStart(() => {
          dragPanStart.value = dragY.value;
        })
        .onUpdate((e) => {
          let next = dragPanStart.value + e.translationY;
          if (next < 0) {
            next *= 0.32;
          }
          dragY.value = next;
        })
        .onEnd((e) => {
          if (
            canSwipeDismissSheetSV.value === 1 &&
            (dragY.value > dismissThresholdPx || e.velocityY > 720)
          ) {
            runOnJS(handleClose)();
            return;
          }
          dragY.value = withSpring(0, SPRING);
        }),
    [dismissThresholdPx, handleClose],
  );

  return (
    <Modal
      visible={modalMounted}
      transparent
      animationType="none"
      onRequestClose={onRequestCloseModal}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View
            style={[styles.backdrop, backdropAnimStyle, { pointerEvents: 'box-none' }]}
          >
            {step === 'methods' ? (
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
              />
            ) : (
              <View
                style={[StyleSheet.absoluteFill, { pointerEvents: 'auto' }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            )}
          </Animated.View>

          <GestureDetector gesture={sheetPanGesture}>
            <Animated.View
              style={[
                styles.sheet,
                { backgroundColor: c.surface },
                sheetAnimStyle,
                sheetExpandStyle,
                { paddingBottom: Math.max(insets.bottom, spacing.lg) },
                Platform.OS === 'web' ? ({ cursor: 'default' } as object) : null,
              ]}
            >
              <View style={styles.stepStack}>
                {step === 'methods' && (
                  <Animated.View
                    entering={methodsEntering}
                    exiting={methodsExiting}
                    style={styles.stepPane}
                  >
                    <View style={kbLayout.headerRow}>
                      <View style={kbLayout.iconSlot}>
                        <TouchableOpacity
                          onPress={handleClose}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel="Kapat"
                        >
                          <Ionicons name="close" size={kbLayout.headerIconSize} color={c.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={kbLayout.handleFlex}>
                        <View style={[styles.handle, kbLayout.handleBar, { backgroundColor: c.border }]} />
                      </View>
                      <View style={kbLayout.iconSlot} />
                    </View>
                    <Text style={[styles.title, { color: c.primary }]}>Başlayalım!</Text>
                    <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                      Hesap oluşturmak veya oturum açmak için bir yöntem seç
                    </Text>

                    <TouchableOpacity
                      style={[styles.outlineBtn, { borderColor: c.primary, backgroundColor: c.surface }]}
                      onPress={() => setStep('email')}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="E-posta ile devam et"
                    >
                      <Ionicons name="mail-outline" size={22} color={c.primary} style={styles.btnIcon} />
                      <Text style={[styles.outlineBtnText, { color: c.primary }]}>E-posta ile devam et</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.outlineBtn, { borderColor: c.primary, backgroundColor: c.surface }]}
                      onPress={onGooglePress}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Google ile devam et"
                    >
                      <GoogleGlyph />
                      <Text style={[styles.outlineBtnText, { color: c.primary }]}>Google ile devam et</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {step === 'email' && (
                  <Animated.View
                    entering={stepEntering}
                    exiting={stepExitingBack}
                    style={[styles.stepPane, styles.stepInner]}
                  >
                    <View style={kbLayout.headerRow}>
                      <View style={kbLayout.iconSlot}>
                        <TouchableOpacity
                          onPress={onStepClosePress}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel="Geri"
                        >
                          <Ionicons name="chevron-back" size={kbLayout.headerIconSize} color={c.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={kbLayout.handleFlex} />
                      <View style={kbLayout.iconSlot} />
                    </View>

                    <View style={[...kbLayout.heroWrap, { backgroundColor: c.surfaceAlt }]}>
                      <Ionicons name="mail-outline" size={kbLayout.heroIcon} color={c.primary} />
                    </View>

                    <Text style={[...kbLayout.stepTitle, { color: c.primary }]}>E-posta adresini gir</Text>
                    <Text style={[...kbLayout.stepSubtitle, { color: c.textSecondary }]}>
                      Kayıtlı hesabın varsa şifre adımına, yoksa e-postana gönderilen kod ile devam edeceksin.
                    </Text>
                    <TextInput
                      style={fieldStyle('email')}
                      placeholder="E-posta"
                      placeholderTextColor={c.textTertiary}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: c.primary },
                        loading && styles.primaryBtnDisabled,
                      ]}
                      onPress={onEmailContinue}
                      disabled={loading}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Devam"
                    >
                      {loading ? (
                        <ActivityIndicator color={c.textInverse} />
                      ) : (
                        <Text style={[styles.primaryBtnText, { color: c.textInverse }]}>Devam</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {step === 'confirmNewAccount' && (
                  <Animated.View
                    entering={stepEntering}
                    exiting={stepExitingBack}
                    style={[styles.stepPane, styles.stepInner]}
                  >
                    <View style={kbLayout.headerRow}>
                      <View style={kbLayout.iconSlot}>
                        <TouchableOpacity
                          onPress={onStepClosePress}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel="Geri"
                        >
                          <Ionicons name="chevron-back" size={kbLayout.headerIconSize} color={c.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={kbLayout.handleFlex} />
                      <View style={kbLayout.iconSlot} />
                    </View>

                    <View style={[...kbLayout.heroWrap, { backgroundColor: c.surfaceAlt }]}>
                      <Ionicons name="person-add-outline" size={kbLayout.heroIcon} color={c.primary} />
                    </View>

                    <Text style={[...kbLayout.stepTitle, { color: c.primary }]}>Yeni hesap</Text>
                    <Text style={[...kbLayout.stepSubtitle, { color: c.textSecondary }]}>
                      <Text style={{ fontWeight: fontWeight.bold, color: c.text }}>{email.trim()}</Text>
                      <Text style={{ color: c.textSecondary }}>
                        {' '}
                        adresi ile kayıt yok. Bu e-posta için yeni hesap oluşturulsun mu?
                      </Text>
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.outlineBtn,
                        { borderColor: c.primary, backgroundColor: c.surface },
                        loading && styles.primaryBtnDisabled,
                      ]}
                      onPress={() => setStep('email')}
                      disabled={loading}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel="Hayır"
                    >
                      <Text style={[styles.outlineBtnText, { color: c.primary }]}>Hayır</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: c.primary },
                        loading && styles.primaryBtnDisabled,
                      ]}
                      onPress={() => void sendSignupCodeForNewAccount(email.trim())}
                      disabled={loading}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Evet, kod gönder"
                    >
                      {loading ? (
                        <ActivityIndicator color={c.textInverse} />
                      ) : (
                        <Text style={[styles.primaryBtnText, { color: c.textInverse }]}>Evet</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {step === 'password' && (
                  <Animated.View
                    entering={stepEntering}
                    exiting={stepExitingBack}
                    style={[styles.stepPane, styles.stepInner]}
                  >
                    <View style={kbLayout.headerRow}>
                      <View style={kbLayout.iconSlot}>
                        <TouchableOpacity
                          onPress={onStepClosePress}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel="Geri"
                        >
                          <Ionicons name="chevron-back" size={kbLayout.headerIconSize} color={c.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={kbLayout.handleFlex} />
                      <View style={kbLayout.iconSlot} />
                    </View>

                    <View style={[...kbLayout.heroWrap, { backgroundColor: c.surfaceAlt }]}>
                      <Ionicons name="lock-closed-outline" size={kbLayout.heroIcon} color={c.primary} />
                    </View>

                    <Text style={[...kbLayout.stepTitle, { color: c.primary }]}>Şifreni gir</Text>
                    <Text style={[...kbLayout.stepSubtitle, { color: c.textSecondary }]}>
                      <Text style={{ fontWeight: fontWeight.bold, color: c.text }}>{email.trim()}</Text>
                      <Text style={{ color: c.textSecondary }}> hesabı için şifreni gir.</Text>
                    </Text>
                    <TextInput
                      style={fieldStyle('password')}
                      placeholder="Şifre"
                      placeholderTextColor={c.textTertiary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      editable={!loading}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity
                      onPress={onForgotPasswordPress}
                      disabled={loading}
                      style={styles.forgotLinkWrap}
                      accessibilityRole="button"
                      accessibilityLabel="Şifremi unuttum"
                    >
                      <Text style={[styles.forgotLink, { color: c.primary }]}>Şifremi unuttum</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: c.primary },
                        loading && styles.primaryBtnDisabled,
                      ]}
                      onPress={onLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Giriş yap"
                    >
                      {loading ? (
                        <ActivityIndicator color={c.textInverse} />
                      ) : (
                        <Text style={[styles.primaryBtnText, { color: c.textInverse }]}>Giriş Yap</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {step === 'forgotCode' && (
                  <Animated.View
                    entering={stepEntering}
                    exiting={stepExitingBack}
                    style={[styles.stepPane, styles.stepInner]}
                  >
                    <View style={kbLayout.headerRow}>
                      <View style={kbLayout.iconSlot}>
                        <TouchableOpacity
                          onPress={onStepClosePress}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel="Geri"
                        >
                          <Ionicons name="chevron-back" size={kbLayout.headerIconSize} color={c.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={kbLayout.handleFlex} />
                      <View style={kbLayout.iconSlot} />
                    </View>

                    <View style={[...kbLayout.heroWrap, { backgroundColor: c.surfaceAlt }]}>
                      <Ionicons name="keypad-outline" size={kbLayout.heroIcon} color={c.primary} />
                    </View>

                    <Text style={[...kbLayout.stepTitle, { color: c.primary }]}>Şifre sıfırlama kodu</Text>
                    <Text style={[...kbLayout.stepSubtitle, { color: c.textSecondary }]}>
                      {email.trim()} adresine gönderilen 6 haneli kodu gir. (Geliştirmede kod sunucu
                      günlüğünde görünebilir.)
                    </Text>
                    <Pressable
                      style={styles.otpRow}
                      onPress={() => {
                        const next = Math.min(forgotOtpCode.length, OTP_LEN - 1);
                        focusOtpCell(next);
                      }}
                      accessibilityRole="none"
                    >
                      {Array.from({ length: OTP_LEN }, (_, i) => {
                        const focused = otpFocusIndex === i;
                        return (
                          <TextInput
                            key={i}
                            ref={(el) => {
                              otpInputRefs.current[i] = el;
                            }}
                            style={[
                              styles.otpCell,
                              i < OTP_LEN - 1 ? { marginRight: OTP_CELL_GAP } : null,
                              {
                                width: OTP_CELL_SIZE,
                                height: OTP_CELL_SIZE + 4,
                                borderColor: focused ? c.inputFocusBorder : c.inputBorder,
                                borderWidth: focused ? 2 : 1,
                                backgroundColor: c.inputBg,
                                color: c.text,
                              },
                              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                            ]}
                            value={forgotOtpCode[i] ?? ''}
                            onChangeText={(t) => handleForgotOtpCellChange(i, t)}
                            onKeyPress={(e) => handleForgotOtpKeyPress(i, e)}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            maxLength={1}
                            selectTextOnFocus
                            caretHidden
                            editable={!loading}
                            onFocus={() => setOtpFocusIndex(i)}
                            accessibilityLabel={`Sıfırlama kodu ${i + 1}. hane`}
                          />
                        );
                      })}
                    </Pressable>
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: c.primary },
                        loading && styles.primaryBtnDisabled,
                      ]}
                      onPress={onVerifyForgotCodeContinue}
                      disabled={loading}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Devam"
                    >
                      {loading ? (
                        <ActivityIndicator color={c.textInverse} />
                      ) : (
                        <Text style={[styles.primaryBtnText, { color: c.textInverse }]}>Devam</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {step === 'signupCode' && (
                  <Animated.View
                    entering={stepEntering}
                    exiting={stepExitingBack}
                    style={[styles.stepPane, styles.stepInner]}
                  >
                    <View style={kbLayout.headerRow}>
                      <View style={kbLayout.iconSlot}>
                        <TouchableOpacity
                          onPress={onStepClosePress}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel="Geri"
                        >
                          <Ionicons name="chevron-back" size={kbLayout.headerIconSize} color={c.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={kbLayout.handleFlex} />
                      <View style={kbLayout.iconSlot} />
                    </View>

                    <View style={[...kbLayout.heroWrap, { backgroundColor: c.surfaceAlt }]}>
                      <Ionicons name="keypad-outline" size={kbLayout.heroIcon} color={c.primary} />
                    </View>

                    <Text style={[...kbLayout.stepTitle, { color: c.primary }]}>Doğrulama kodu</Text>
                    <Text style={[...kbLayout.stepSubtitle, { color: c.textSecondary }]}>
                      {email.trim()} adresine gönderilen 6 haneli kodu gir. (Geliştirmede kod sunucu
                      günlüğünde görünebilir.)
                    </Text>
                    <Pressable
                      style={styles.otpRow}
                      onPress={() => {
                        const next = Math.min(verificationCode.length, OTP_LEN - 1);
                        focusOtpCell(next);
                      }}
                      accessibilityRole="none"
                    >
                      {Array.from({ length: OTP_LEN }, (_, i) => {
                        const focused = otpFocusIndex === i;
                        return (
                          <TextInput
                            key={i}
                            ref={(el) => {
                              otpInputRefs.current[i] = el;
                            }}
                            style={[
                              styles.otpCell,
                              i < OTP_LEN - 1 ? { marginRight: OTP_CELL_GAP } : null,
                              {
                                width: OTP_CELL_SIZE,
                                height: OTP_CELL_SIZE + 4,
                                borderColor: focused ? c.inputFocusBorder : c.inputBorder,
                                borderWidth: focused ? 2 : 1,
                                backgroundColor: c.inputBg,
                                color: c.text,
                              },
                              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
                            ]}
                            value={verificationCode[i] ?? ''}
                            onChangeText={(t) => handleOtpCellChange(i, t)}
                            onKeyPress={(e) => handleOtpKeyPress(i, e)}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            maxLength={1}
                            selectTextOnFocus
                            caretHidden
                            editable={!loading}
                            onFocus={() => setOtpFocusIndex(i)}
                            accessibilityLabel={`Kod ${i + 1}. hane`}
                          />
                        );
                      })}
                    </Pressable>
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: c.primary },
                        loading && styles.primaryBtnDisabled,
                      ]}
                      onPress={onVerifyCodeContinue}
                      disabled={loading}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Devam"
                    >
                      {loading ? (
                        <ActivityIndicator color={c.textInverse} />
                      ) : (
                        <Text style={[styles.primaryBtnText, { color: c.textInverse }]}>Devam</Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                )}

                {step === 'signupPassword' && (
                  <Animated.View
                    entering={stepEntering}
                    exiting={stepExitingBack}
                    style={[styles.stepPane, styles.stepInner, styles.signupPasswordRoot]}
                  >
                    <View style={kbLayout.headerRow}>
                      <View style={kbLayout.iconSlot}>
                        <TouchableOpacity
                          onPress={onStepClosePress}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel="Geri"
                        >
                          <Ionicons name="chevron-back" size={kbLayout.headerIconSize} color={c.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={kbLayout.handleFlex} />
                      <View style={kbLayout.iconSlot} />
                    </View>

                    <ScrollView
                      style={styles.signupScroll}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                      nestedScrollEnabled
                      contentContainerStyle={[
                        styles.signupFormScroll,
                        {
                          paddingBottom: Math.max(insets.bottom, 16) + spacing.xl * 2,
                        },
                      ]}
                    >
                      <View style={[...kbLayout.heroWrap, { backgroundColor: c.surfaceAlt }]}>
                        <Ionicons name="person-outline" size={kbLayout.heroIcon} color={c.primary} />
                      </View>

                      <Text style={[...kbLayout.stepTitle, { color: c.primary }]}>Hesabını oluştur</Text>
                      <Text style={[...kbLayout.stepSubtitle, { color: c.textSecondary }]}>
                        Bilgilerini doldur ve şifreni belirle. Hesabın yalnızca «Kayıt ol»a bastığında
                        oluşturulur.
                      </Text>

                      <TextInput
                        style={fieldStyle('regFirstName', true)}
                        placeholder="Ad"
                        placeholderTextColor={c.textTertiary}
                        value={regFirstName}
                        onChangeText={setRegFirstName}
                        autoCapitalize="words"
                        editable={!loading}
                        onFocus={() => setFocusedField('regFirstName')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <TextInput
                        style={fieldStyle('regLastName', true)}
                        placeholder="Soyad"
                        placeholderTextColor={c.textTertiary}
                        value={regLastName}
                        onChangeText={setRegLastName}
                        autoCapitalize="words"
                        editable={!loading}
                        onFocus={() => setFocusedField('regLastName')}
                        onBlur={() => setFocusedField(null)}
                      />

                      <Text style={[styles.genderLabel, { color: c.textSecondary }]}>Doğum tarihi</Text>
                      {Platform.OS === 'web' ? (
                        <WebBirthDateInput
                          valueIso={regBirthIso}
                          onChangeIso={setRegBirthIso}
                          disabled={loading}
                          colors={c}
                          focused={focusedField === 'regBirth'}
                          onFocus={() => setFocusedField('regBirth')}
                          onBlur={() => setFocusedField(null)}
                        />
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.input,
                            styles.dropdownRow,
                            {
                              borderColor:
                                focusedField === 'regBirth' ? c.inputFocusBorder : c.inputBorder,
                              borderWidth: focusedField === 'regBirth' ? 2 : 1,
                              backgroundColor: c.inputBg,
                            },
                          ]}
                          onPress={() => {
                            if (!loading) {
                              setFocusedField('regBirth');
                              setBirthPickerOpen(true);
                            }
                          }}
                          disabled={loading}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel="Doğum tarihi seç"
                        >
                          <Text
                            style={{
                              flex: 1,
                              fontSize: fontSize.md,
                              color: regBirthIso ? c.text : c.textTertiary,
                            }}
                          >
                            {regBirthIso ? formatIsoDateToTR(regBirthIso) : 'Takvimden seç'}
                          </Text>
                          <Ionicons name="calendar-outline" size={22} color={c.primary} />
                        </TouchableOpacity>
                      )}

                      <Text style={[styles.genderLabel, { color: c.textSecondary }]}>Cinsiyet</Text>
                      <TouchableOpacity
                        style={[
                          styles.input,
                          styles.dropdownRow,
                          {
                            borderColor: c.inputBorder,
                            borderWidth: 1,
                            backgroundColor: c.inputBg,
                          },
                        ]}
                        onPress={() => !loading && setGenderPickerOpen(true)}
                        disabled={loading}
                        activeOpacity={0.75}
                        accessibilityRole="button"
                        accessibilityLabel="Cinsiyet seç"
                      >
                        <Text
                          style={{
                            flex: 1,
                            fontSize: fontSize.md,
                            color: signupGender ? c.text : c.textTertiary,
                          }}
                        >
                          {signupGender
                            ? SIGNUP_GENDERS.find((g) => g.key === signupGender)?.label
                            : 'Seçin'}
                        </Text>
                        <Ionicons name="chevron-down" size={22} color={c.primary} />
                      </TouchableOpacity>

                      <TextInput
                        style={fieldStyle('regPass', true, regPassInvalid)}
                        placeholder="Şifre"
                        placeholderTextColor={c.textTertiary}
                        value={regPassword}
                        onChangeText={(t) => {
                          setRegPassInvalid(false);
                          setRegPass2Invalid(false);
                          setRegPassword(t);
                        }}
                        secureTextEntry
                        editable={!loading}
                        onFocus={() => setFocusedField('regPass')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <Text style={[styles.passwordHint, { color: c.textTertiary }]}>{PASSWORD_HINT}</Text>
                      <TextInput
                        style={fieldStyle('regPass2', false, regPass2Invalid)}
                        placeholder="Şifre tekrar"
                        placeholderTextColor={c.textTertiary}
                        value={regPasswordConfirm}
                        onChangeText={(t) => {
                          setRegPassInvalid(false);
                          setRegPass2Invalid(false);
                          setRegPasswordConfirm(t);
                        }}
                        secureTextEntry
                        editable={!loading}
                        onFocus={() => setFocusedField('regPass2')}
                        onBlur={() => setFocusedField(null)}
                      />
                      <TouchableOpacity
                        style={[
                          styles.primaryBtn,
                          { backgroundColor: c.primary },
                          loading && styles.primaryBtnDisabled,
                        ]}
                        onPress={onCompleteSignup}
                        disabled={loading}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel="Kayıt ol"
                      >
                        {loading ? (
                          <ActivityIndicator color={c.textInverse} />
                        ) : (
                          <Text style={[styles.primaryBtnText, { color: c.textInverse }]}>Kayıt ol</Text>
                        )}
                      </TouchableOpacity>
                    </ScrollView>

                    <Modal
                      visible={genderPickerOpen}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setGenderPickerOpen(false)}
                    >
                      <View style={styles.pickerModalRoot}>
                        <Pressable
                          style={StyleSheet.absoluteFill}
                          onPress={() => setGenderPickerOpen(false)}
                          accessibilityLabel="Kapat"
                        />
                        <View style={[styles.pickerModalSheet, { backgroundColor: c.surface }]}>
                          <Text style={[styles.pickerModalTitle, { color: c.primary }]}>
                            Cinsiyet seç
                          </Text>
                          {SIGNUP_GENDERS.map((opt, idx) => (
                            <TouchableOpacity
                              key={opt.key}
                              style={[
                                styles.pickerModalRow,
                                idx < SIGNUP_GENDERS.length - 1 && {
                                  borderBottomWidth: StyleSheet.hairlineWidth,
                                  borderBottomColor: c.border,
                                },
                              ]}
                              onPress={() => {
                                setSignupGender(opt.key);
                                setGenderPickerOpen(false);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={opt.label}
                            >
                              <Text style={[styles.pickerModalRowText, { color: c.text }]}>
                                {opt.label}
                              </Text>
                              {signupGender === opt.key ? (
                                <Ionicons name="checkmark" size={22} color={c.primary} />
                              ) : null}
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </Modal>

                    {Platform.OS === 'ios' ? (
                      <Modal
                        visible={birthPickerOpen}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setBirthPickerOpen(false)}
                      >
                        <View style={styles.dateModalRoot}>
                          <Pressable
                            style={StyleSheet.absoluteFill}
                            onPress={() => setBirthPickerOpen(false)}
                          />
                          <View style={[styles.dateModalSheet, { backgroundColor: c.surface }]}>
                            <View style={[styles.dateModalBar, { borderBottomColor: c.border }]}>
                              <TouchableOpacity
                                onPress={() => setBirthPickerOpen(false)}
                                hitSlop={12}
                                accessibilityRole="button"
                                accessibilityLabel="İptal"
                              >
                                <Text style={{ color: c.textSecondary, fontSize: fontSize.md }}>
                                  İptal
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => setBirthPickerOpen(false)}
                                hitSlop={12}
                                accessibilityRole="button"
                                accessibilityLabel="Tamam"
                              >
                                <Text
                                  style={{
                                    color: c.primary,
                                    fontSize: fontSize.md,
                                    fontWeight: fontWeight.bold,
                                  }}
                                >
                                  Tamam
                                </Text>
                              </TouchableOpacity>
                            </View>
                            <DateTimePicker
                              value={
                                regBirthIso
                                  ? new Date(`${regBirthIso}T12:00:00`)
                                  : new Date(2000, 0, 15)
                              }
                              mode="date"
                              display="spinner"
                              themeVariant="light"
                              maximumDate={new Date()}
                              minimumDate={new Date(1900, 0, 1)}
                              onChange={(_e: { type?: string }, d?: Date) => {
                                if (d) setRegBirthIso(d.toISOString().slice(0, 10));
                              }}
                            />
                          </View>
                        </View>
                      </Modal>
                    ) : null}
                    {Platform.OS === 'android' && birthPickerOpen ? (
                      <DateTimePicker
                        value={
                          regBirthIso
                            ? new Date(`${regBirthIso}T12:00:00`)
                            : new Date(2000, 0, 15)
                        }
                        mode="date"
                        display="default"
                        maximumDate={new Date()}
                        minimumDate={new Date(1900, 0, 1)}
                        onChange={(event: { type: string }, date?: Date) => {
                          setBirthPickerOpen(false);
                          if (event.type === 'set' && date) {
                            setRegBirthIso(date.toISOString().slice(0, 10));
                          }
                        }}
                      />
                    ) : null}
                  </Animated.View>
                )}

                {step === 'forgotNewPassword' && (
                  <Animated.View
                    entering={stepEntering}
                    exiting={stepExitingBack}
                    style={[styles.stepPane, styles.stepInner]}
                  >
                    <View style={kbLayout.headerRow}>
                      <View style={kbLayout.iconSlot}>
                        <TouchableOpacity
                          onPress={onStepClosePress}
                          hitSlop={12}
                          accessibilityRole="button"
                          accessibilityLabel="Geri"
                        >
                          <Ionicons name="chevron-back" size={kbLayout.headerIconSize} color={c.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={kbLayout.handleFlex} />
                      <View style={kbLayout.iconSlot} />
                    </View>

                    <View style={[...kbLayout.heroWrap, { backgroundColor: c.surfaceAlt }]}>
                      <Ionicons name="lock-closed-outline" size={kbLayout.heroIcon} color={c.primary} />
                    </View>

                    <Text style={[...kbLayout.stepTitle, { color: c.primary }]}>Yeni şifre</Text>
                    <Text style={[...kbLayout.stepSubtitle, { color: c.textSecondary }]}>
                      {email.trim()} hesabı için yeni şifreni belirle.
                    </Text>
                    <TextInput
                      style={fieldStyle('forgotPass', true, forgotPassInvalid)}
                      placeholder="Yeni şifre"
                      placeholderTextColor={c.textTertiary}
                      value={forgotNewPass}
                      onChangeText={(t) => {
                        setForgotPassInvalid(false);
                        setForgotPass2Invalid(false);
                        setForgotNewPass(t);
                      }}
                      secureTextEntry
                      editable={!loading}
                      onFocus={() => setFocusedField('forgotPass')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <Text style={[styles.passwordHint, { color: c.textTertiary }]}>{PASSWORD_HINT}</Text>
                    <TextInput
                      style={fieldStyle('forgotPass2', false, forgotPass2Invalid)}
                      placeholder="Yeni şifre tekrar"
                      placeholderTextColor={c.textTertiary}
                      value={forgotNewPass2}
                      onChangeText={(t) => {
                        setForgotPassInvalid(false);
                        setForgotPass2Invalid(false);
                        setForgotNewPass2(t);
                      }}
                      secureTextEntry
                      editable={!loading}
                      onFocus={() => setFocusedField('forgotPass2')}
                      onBlur={() => setFocusedField(null)}
                    />
                    <TouchableOpacity
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: c.primary },
                        loading && styles.primaryBtnDisabled,
                      ]}
                      onPress={onCompletePasswordReset}
                      disabled={loading}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel="Şifreyi güncelle"
                    >
                      {loading ? (
                        <ActivityIndicator color={c.textInverse} />
                      ) : (
                        <Text style={[styles.primaryBtnText, { color: c.textInverse }]}>
                          Şifreyi güncelle
                        </Text>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </View>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  stepStack: {
    width: '100%',
    flexGrow: 1,
    flex: 1,
    minHeight: 0,
  },
  stepPane: {
    width: '100%',
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  headerIconSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerHandleFlex: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  sheetHeaderRowKb: {
    minHeight: 30,
    marginBottom: spacing.xs,
  },
  headerIconSlotKb: {
    width: 32,
    height: 32,
  },
  headerHandleFlexKb: {
    minHeight: 30,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  handleKb: {
    width: 30,
    height: 3,
    borderRadius: 2,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 4,
    marginBottom: spacing.md,
  },
  btnIcon: {
    marginRight: spacing.sm,
  },
  outlineBtnText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
  },
  stepInner: {
    paddingBottom: spacing.md,
    flex: 1,
    minHeight: 0,
  },
  signupPasswordRoot: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  signupScroll: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  signupFormScroll: {
    flexGrow: 1,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  genderLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  pickerModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pickerModalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '55%',
  },
  pickerModalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pickerModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
  },
  pickerModalRowText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    flex: 1,
  },
  dateModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dateModalSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
  },
  dateModalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mailHeroCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  mailHeroCircleKb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: spacing.md,
  },
  stepTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  stepTitleKb: {
    fontSize: fontSize.lg,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: fontSize.md,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    paddingHorizontal: spacing.xs,
  },
  stepSubtitleKb: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  passwordHint: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  forgotLinkWrap: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.xs,
  },
  forgotLink: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textDecorationLine: 'underline',
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.md + 2 : spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.xl,
  },
  inputTight: {
    marginBottom: spacing.md,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '100%',
    marginBottom: spacing.xl,
  },
  otpCell: {
    borderRadius: radius.md,
    textAlign: 'center',
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    paddingHorizontal: 0,
    paddingVertical: 0,
    ...Platform.select({
      android: { textAlignVertical: 'center' as const },
      default: {},
    }),
  },
  primaryBtn: {
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
});
