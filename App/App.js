import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ---- Configuration -------------------------------------------------------------------------
// Production builds MUST set EXPO_PUBLIC_API_URL (https). localhost is only a development fallback.
const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://192.168.1.4:4000' : '');
const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '');
const CONFIG_ERROR = !API_BASE_URL
  ? 'The app is missing its server address (EXPO_PUBLIC_API_URL).'
  : (!__DEV__ && !/^https:\/\//i.test(API_BASE_URL) ? 'The server address must use https:// in production builds.' : null);
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || `${API_BASE_URL}/privacy`;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL || `${API_BASE_URL}/terms`;
const HEALTH_DISCLAIMER = 'Sugar Detox is a habit-tracking and wellness tool. It is not medical advice and does not replace your doctor or care plan. Sugar amounts are estimates.';

const TOKEN_KEY = 'sugar-detox-auth-token';
// The session token lives in the OS keychain/keystore, not in plain AsyncStorage.
const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY).catch(() => null),
  set: (value) => SecureStore.setItemAsync(TOKEN_KEY, value),
  remove: () => SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
};

function openLink(url) {
  Linking.openURL(url).catch(() => Alert.alert('Unable to open link', url));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Keep in sync with backend/src/lib.js
function passwordProblem(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain at least one letter and one number.';
  return null;
}
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';

const C = {
  bg: '#FBF7FF',
  ink: '#18151D',
  muted: '#716B79',
  purple: '#5D2EE8',
  purpleDark: '#35127F',
  lav: '#E9D9FF',
  lav2: '#F2E7FF',
  mint: '#DFF7D7',
  mintStrong: '#8ED36E',
  peach: '#FFDCD3',
  yellow: '#FFE99A',
  card: '#FFFFFF',
  line: '#E8E0EF',
  red: '#E9504F',
};

const STORAGE_KEY = 'sugar-detox-data-v2';

const INITIAL_DATA = {
  onboarded: false,
  authed: false,
  name: '',
  email: '',
  password: '',
  goals: [],
  logs: [],
  checkins: {},
  challenges: {},
  points: 0,
  rewards: [],
  reminders: { morning: true, meal: true, evening: true },
};

const goals = [
  'Reduce added sugar',
  'Control cravings',
  'Build healthier habits',
  'Improve my eating routine',
  'Manage my blood sugar alongside my care plan',
  'Just become more aware of my sugar intake',
];

const foods = [
  { name: 'Chocolate chip cookie', sugar: 12, barcode: '049000028904' },
  { name: 'Chocolate', sugar: 12, barcode: '012345678901' },
  { name: 'Soda / Cola', sugar: 39, barcode: '049000000001' },
  { name: 'Ice cream', sugar: 21, barcode: '012345678902' },
  { name: 'Fruit juice', sugar: 24, barcode: '012345678903' },
  { name: 'Sweetened coffee', sugar: 16, barcode: '012345678904' },
  { name: 'Donut', sugar: 10, barcode: '012345678905' },
  { name: 'Yogurt', sugar: 9, barcode: '012345678906' },
  { name: 'Granola bar', sugar: 8, barcode: '012345678907' },
  { name: 'Ketchup', sugar: 4, barcode: '012345678908' },
];

const challenges = [
  { id: 'sweet', title: 'Bye sweet tooth!', subtitle: '3-day no sweet consumption challenge', days: 3, points: 100, icon: '🍪', bg: C.peach },
  { id: 'fizz', title: 'Let it fizz out!', subtitle: '7-Day No Sugary Drinks Challenge', days: 7, points: 250, icon: '🥤', bg: C.lav },
  { id: 'aware', title: 'Know what you eat!', subtitle: '30-Day Sugar Awareness Challenge', days: 30, points: 500, icon: '🔎', bg: C.mint },
];

const recipes = [
  { name: 'Frozen Berry Yogurt', craving: 'ice cream', time: '5 min', sugar: '8g', emoji: '🍓', items: ['Greek yogurt', 'frozen berries', 'cinnamon'], method: 'Mix Greek yogurt with frozen berries and a pinch of cinnamon. Chill for a few minutes and serve.' },
  { name: 'Banana Cocoa Bites', craving: 'chocolate', time: '8 min', sugar: '9g', emoji: '🍌', items: ['banana', 'unsweetened cocoa', 'peanut butter'], method: 'Slice banana, add a small amount of cocoa and peanut butter, then chill before serving.' },
  { name: 'Sparkling Citrus Cooler', craving: 'soda', time: '3 min', sugar: '4g', emoji: '🍊', items: ['sparkling water', 'lime', 'orange slices'], method: 'Add citrus slices and lime to sparkling water. Serve cold over ice.' },
];

const rewardCatalog = [
  { id: 'starter', name: 'Wellness starter gift', points: 300, emoji: '🎁' },
  { id: 'snack', name: 'Healthy snack box', points: 600, emoji: '🥜' },
  { id: 'kitchen', name: 'Sugar-free kitchen kit', points: 1000, emoji: '🍽️' },
];

const notificationIds = {
  morning: 'sugar-detox-morning',
  meal: 'sugar-detox-meal',
  evening: 'sugar-detox-evening',
};

const AppCtx = React.createContext(null);

function useApp() {
  return React.useContext(AppCtx);
}

// Local calendar date (NOT UTC) so "today" is correct in every timezone.
function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return localDateKey();
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

async function apiRequest(path, options = {}, token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (cause) {
    const error = new Error(cause?.name === 'AbortError' ? 'The server took too long to respond. Please try again.' : 'Cannot reach the server. Check your internet connection and try again.');
    error.network = true;
    throw error;
  } finally {
    clearTimeout(timer);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

// ---- Reminders (local notifications) ---------------------------------------------------------
// expo-notifications is loaded lazily: importing it at module load crashes Expo Go (SDK 53+).
let notificationsModule = null;
// Expo Go (executionEnvironment 'storeClient') cannot run expo-notifications, so skip it there entirely.
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';
function getNotifications() {
  if (IS_EXPO_GO) return null;
  if (notificationsModule) return notificationsModule;
  const mod = require('expo-notifications');
  try {
    mod.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
  } catch (_) {}
  notificationsModule = mod;
  return mod;
}

const reminderContent = {
  morning: { hour: 8, minute: 0, title: 'Good morning 👋', body: 'Start today with your Sugar Detox check-in.' },
  meal: { hour: 14, minute: 0, title: 'After-meal check-in', body: 'Did you consume added sugar? Log it in Sugar Detox.' },
  evening: { hour: 20, minute: 0, title: 'How did you do today?', body: 'Take a minute to complete your evening check-in.' },
};

async function ensureNotificationPermission(N) {
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('reminders', { name: 'Daily reminders', importance: N.AndroidImportance.DEFAULT });
  }
  const current = await N.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const asked = await N.requestPermissionsAsync();
  return asked.status === 'granted';
}

async function setReminderNotification(type, enabled) {
  const id = notificationIds[type];
  try {
    const N = getNotifications();
    if (!N) return;
    await N.cancelScheduledNotificationAsync(id);
    if (!enabled) return;
    if (!(await ensureNotificationPermission(N))) return;
    const item = reminderContent[type];
    await N.scheduleNotificationAsync({
      identifier: id,
      content: { title: item.title, body: item.body, sound: 'default' },
      trigger: { type: N.SchedulableTriggerInputTypes.DAILY, hour: item.hour, minute: item.minute, channelId: 'reminders' },
    });
  } catch (error) {
    console.log('notification setup', error?.message || error);
  }
}

async function syncAllReminders(reminders) {
  for (const key of Object.keys(reminderContent)) {
    // eslint-disable-next-line no-await-in-loop
    await setReminderNotification(key, !!(reminders && reminders[key]));
  }
}

async function cancelAllReminders() {
  try {
    const N = getNotifications();
    if (N) await N.cancelAllScheduledNotificationsAsync();
  } catch (_) {}
}

function normalizeState(raw) {
  const { _version, ...rest } = raw || {};
  return { ...INITIAL_DATA, ...rest, password: '', reminders: { ...INITIAL_DATA.reminders, ...(rest.reminders || {}) } };
}

function Provider({ children }) {
  const [data, setDataState] = useState(INITIAL_DATA);
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('offline');
  const dataRef = useRef(INITIAL_DATA);
  const tokenRef = useRef(null);
  const versionRef = useRef(undefined);
  const syncing = useRef(false);
  const dirty = useRef(false);
  const needsSync = useRef(false);
  const remindersSynced = useRef(false);

  const commit = useCallback((next) => {
    dataRef.current = next;
    setDataState(next);
  }, []);

  const clearSession = useCallback(async () => {
    tokenRef.current = null;
    versionRef.current = undefined;
    needsSync.current = false;
    await tokenStore.remove();
    await cancelAllReminders();
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    commit({ ...INITIAL_DATA, onboarded: true });
    setSyncStatus('offline');
  }, [commit]);

  // Push local state to the server. Serialised + coalesced so requests can never race each other.
  const flush = useCallback(async () => {
    if (!tokenRef.current || !dataRef.current.authed) return;
    if (syncing.current) { dirty.current = true; return; }
    syncing.current = true;
    setSyncStatus('syncing');
    try {
      do {
        dirty.current = false;
        // eslint-disable-next-line no-await-in-loop
        const result = await apiRequest('/api/me/state', { method: 'PUT', body: JSON.stringify({ state: dataRef.current, baseVersion: versionRef.current }) }, tokenRef.current);
        versionRef.current = result.state._version;
        if (result.merged && !dirty.current) commit({ ...normalizeState(result.state), authed: true });
      } while (dirty.current);
      needsSync.current = false;
      setSyncStatus('synced');
    } catch (error) {
      if (error.status === 401) { await clearSession(); } else { needsSync.current = true; setSyncStatus('offline'); }
    } finally {
      syncing.current = false;
    }
  }, [commit, clearSession]);

  useEffect(() => {
    (async () => {
      try {
        const [value, savedToken] = await Promise.all([AsyncStorage.getItem(STORAGE_KEY), tokenStore.get()]);
        let local = INITIAL_DATA;
        if (value) {
          try {
            const saved = JSON.parse(value);
            versionRef.current = saved._version;
            local = normalizeState(saved);
          } catch (_) {}
        }
        if (!savedToken) local = { ...local, authed: false };
        commit(local);
        if (savedToken) {
          tokenRef.current = savedToken;
          try {
            const result = await apiRequest('/api/me/state', {}, savedToken);
            versionRef.current = result.state._version;
            commit({ ...normalizeState(result.state), authed: true });
            setSyncStatus('synced');
          } catch (error) {
            // Only a real 401 means the session ended. Being offline must never log the user out.
            if (error.status === 401) await clearSession();
            else { needsSync.current = true; setSyncStatus('offline'); }
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, [commit, clearSession]);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, password: '', _version: versionRef.current })).catch(() => {});
  }, [data, ready, syncStatus]);

  // Retry failed syncs and pull changes made on another device when the app returns to the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state !== 'active' || !tokenRef.current || !dataRef.current.authed || syncing.current) return;
      if (needsSync.current) { flush(); return; }
      try {
        const result = await apiRequest('/api/me/state', {}, tokenRef.current);
        if (result.state._version !== versionRef.current && !syncing.current && !needsSync.current) {
          versionRef.current = result.state._version;
          commit({ ...normalizeState(result.state), authed: true });
        }
      } catch (error) {
        if (error.status === 401) await clearSession();
      }
    });
    return () => subscription.remove();
  }, [flush, commit, clearSession]);

  // Schedule the reminders the user has enabled (once per signed-in session, and on a new device).
  useEffect(() => {
    if (!ready) return;
    if (!data.authed) { remindersSynced.current = false; return; }
    if (!remindersSynced.current) {
      remindersSynced.current = true;
      syncAllReminders(dataRef.current.reminders);
    }
  }, [ready, data.authed]);

  const setData = useCallback((next) => {
    const resolved = typeof next === 'function' ? next(dataRef.current) : next;
    commit({ ...resolved, password: '' });
    flush();
  }, [commit, flush]);

  const startSession = async (result) => {
    await tokenStore.set(result.token);
    tokenRef.current = result.token;
    versionRef.current = result.state._version;
    needsSync.current = false;
    commit({ ...normalizeState(result.state), authed: true, onboarded: true });
    setSyncStatus('synced');
  };

  const register = async (payload) => startSession(await apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }));
  const login = async (payload) => startSession(await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }));
  const forgotPassword = (email) => apiRequest('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) });
  const resetPassword = (payload) => apiRequest('/api/auth/reset', { method: 'POST', body: JSON.stringify(payload) });
  const logout = () => clearSession();

  // Clears sugar logs/check-ins/challenges/points on the server and this device but keeps the account.
  const resetData = async () => {
    const result = await apiRequest('/api/me/state', { method: 'DELETE' }, tokenRef.current);
    versionRef.current = result.state._version;
    commit({ ...normalizeState(result.state), authed: true });
    setSyncStatus('synced');
    syncAllReminders(dataRef.current.reminders);
  };

  // Permanently deletes the account and all server data, then wipes this device.
  const deleteAccount = async (password) => {
    await apiRequest('/api/me', { method: 'DELETE', body: JSON.stringify({ password }) }, tokenRef.current);
    await clearSession();
  };

  return (
    <AppCtx.Provider value={{ data, setData, ready, register, login, logout, forgotPassword, resetPassword, resetData, deleteAccount, syncStatus }}>
      {children}
    </AppCtx.Provider>
  );
}

function Logo({ small = false }) {
  return (
    <View style={styles.logoWrap}>
      <View style={[styles.logoMark, small && styles.logoMarkSmall]}><Text style={styles.logoStar}>✦</Text></View>
      <Text style={[styles.logoText, small && styles.logoTextSmall]}>sugarcut</Text>
    </View>
  );
}

function Button({ title, onPress, variant = 'primary', disabled = false }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        disabled && styles.buttonDisabled,
        pressed && { opacity: 0.82 },
      ]}
    >
      <Text style={[styles.buttonText, variant !== 'primary' && styles.buttonTextDark]}>{title}</Text>
    </Pressable>
  );
}

function Header({ title, back = false }) {
  const nav = useNavigation();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable onPress={() => nav.goBack()} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
      ) : <Logo small />}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Pill({ children, bg = C.lav }) {
  return <View style={[styles.pill, { backgroundColor: bg }]}><Text style={styles.pillText}>{children}</Text></View>;
}

function Splash({ navigation }) {
  const { data, ready } = useApp();
  useEffect(() => {
    if (!ready) return undefined;
    const target = data.authed ? 'Main' : data.onboarded ? 'Auth' : 'Intro';
    const timer = setTimeout(() => navigation.replace(target), 900);
    return () => clearTimeout(timer);
  }, [ready, data.authed, data.onboarded, navigation]);

  return (
    <SafeAreaView style={styles.splash}>
      <Logo />
      <View style={styles.splashOrb}><Text style={styles.splashOrbStar}>✦</Text></View>
      <Text style={styles.splashTitle}>A sweeter life{`\n`}starts with less sugar.</Text>
      <Text style={styles.splashSub}>Break the habit. Build better days.</Text>
    </SafeAreaView>
  );
}

function Intro({ navigation }) {
  return (
    <SafeAreaView style={styles.centerPage}>
      <View style={styles.heroOrb}><Text style={{ fontSize: 56 }}>◌</Text></View>
      <Text style={styles.h1}>Your sugar-free journey{`\n`}starts here.</Text>
      <Text style={styles.body}>Track sugar, understand your habits, handle cravings and build streaks that last.</Text>
      <View style={{ width: '100%', marginTop: 28 }}>
        <Button title="Get started" onPress={() => navigation.replace('Goals')} />
        <Button title="I already have an account" variant="secondary" onPress={() => navigation.replace('Auth', { mode: 'login' })} />
      </View>
    </SafeAreaView>
  );
}

function Goals({ navigation }) {
  const { data, setData } = useApp();
  const [selected, setSelected] = useState(data.goals || []);
  const continueToAuth = () => {
    if (!selected.length) return;
    setData({ ...data, goals: selected, onboarded: true });
    navigation.replace('Auth', { mode: 'signup' });
  };
  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={styles.eyebrow}>PERSONAL GOALS</Text>
        <Text style={styles.h1}>What do you want{`\n`}to improve?</Text>
        <Text style={styles.body}>Choose one or more goals. You can change these later in your settings.</Text>
        {goals.map((goal) => {
          const active = selected.includes(goal);
          return (
            <Pressable key={goal} onPress={() => setSelected((items) => active ? items.filter((item) => item !== goal) : [...items, goal])} style={[styles.goalRow, active && styles.goalRowActive]}>
              <View style={[styles.check, active && styles.checkActive]}>{active && <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text>}</View>
              <Text style={styles.goalText}>{goal}</Text>
            </Pressable>
          );
        })}
        <Button title="Continue" disabled={!selected.length} onPress={continueToAuth} />
        <Text style={styles.smallNote}>{HEALTH_DISCLAIMER}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Auth({ navigation, route }) {
  const { data, register, login } = useApp();
  const [signup, setSignup] = useState(route?.params?.mode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return Alert.alert('Missing details', 'Enter your email and password.');
    if (!isValidEmail(cleanEmail)) return Alert.alert('Check your email', 'Enter a valid email address.');
    if (signup) {
      if (!name.trim()) return Alert.alert('Add your name', 'Enter your name to create the account.');
      const problem = passwordProblem(password);
      if (problem) return Alert.alert('Choose a stronger password', problem);
      if (!agreed) return Alert.alert('Please accept to continue', 'Accept the Terms of Use and Privacy Policy to create your account.');
    }
    setBusy(true);
    try {
      if (signup) {
        await register({ email: cleanEmail, password, name: name.trim(), goals: data.goals || [] });
      } else {
        await login({ email: cleanEmail, password });
      }
      navigation.replace('Main');
    } catch (error) {
      Alert.alert(signup ? 'Could not create account' : 'Could not sign in', error.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Logo />
          <Text style={[styles.h1, { marginTop: 36 }]}>{signup ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.body}>{signup ? 'Create a secure account so your progress follows you across devices.' : 'Sign in to continue your journey.'}</Text>
          {signup && <TextInput placeholder="Your name" placeholderTextColor={C.muted} value={name} onChangeText={setName} autoComplete="name" textContentType="name" maxLength={80} style={styles.input} />}
          <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder="Email" placeholderTextColor={C.muted} value={email} onChangeText={setEmail} style={styles.input} />
          <TextInput secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete={signup ? 'new-password' : 'current-password'} textContentType={signup ? 'newPassword' : 'password'} placeholder={signup ? 'Password (8+ characters, letters and numbers)' : 'Password'} placeholderTextColor={C.muted} value={password} onChangeText={setPassword} style={styles.input} />
          {signup && (
            <Pressable onPress={() => setAgreed((value) => !value)} style={styles.consentRow} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
              <View style={[styles.check, agreed && styles.checkActive]}>{agreed && <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text>}</View>
              <Text style={styles.consentText}>
                I agree to the <Text style={styles.linkInline} onPress={() => openLink(TERMS_URL)}>Terms of Use</Text> and <Text style={styles.linkInline} onPress={() => openLink(PRIVACY_URL)}>Privacy Policy</Text>, and I understand this app is not medical advice.
              </Text>
            </Pressable>
          )}
          <Button title={busy ? 'Please wait…' : (signup ? 'Create account' : 'Sign in')} disabled={busy} onPress={submit} />
          {!signup && <Button title="Forgot password?" variant="ghost" onPress={() => navigation.navigate('ForgotPassword')} />}
          <Button title={signup ? 'I already have an account' : 'Create a new account'} variant="ghost" onPress={() => setSignup((value) => !value)} />
          {!signup && (
            <Text style={styles.smallNote}>
              <Text style={styles.linkInline} onPress={() => openLink(TERMS_URL)}>Terms of Use</Text> · <Text style={styles.linkInline} onPress={() => openLink(PRIVACY_URL)}>Privacy Policy</Text>
            </Text>
          )}
          <Text style={styles.smallNote}>{HEALTH_DISCLAIMER}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ForgotPassword({ navigation }) {
  const { forgotPassword, resetPassword } = useApp();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) return Alert.alert('Check your email', 'Enter the email you used to sign up.');
    setBusy(true);
    try {
      await forgotPassword(cleanEmail);
      setEmail(cleanEmail);
      setStep(2);
      Alert.alert('Check your inbox', 'If an account exists for that email, we sent a 6-digit code. It expires in 15 minutes.');
    } catch (error) {
      Alert.alert('Could not send code', error.message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (!/^\d{6}$/.test(code.trim())) return Alert.alert('Enter the code', 'The code has 6 digits.');
    const problem = passwordProblem(password);
    if (problem) return Alert.alert('Choose a stronger password', problem);
    setBusy(true);
    try {
      await resetPassword({ email, code: code.trim(), password });
      Alert.alert('Password updated', 'You can now sign in with your new password.');
      navigation.replace('Auth', { mode: 'login' });
    } catch (error) {
      Alert.alert('Could not reset password', error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
          <Header title="Reset password" back />
          <Text style={styles.h1}>{step === 1 ? 'Forgot your password?' : 'Enter your code'}</Text>
          <Text style={styles.body}>{step === 1 ? 'Enter your email and we will send you a 6-digit code.' : `We sent a code to ${email}. Enter it below with a new password.`}</Text>
          {step === 1 ? (
            <>
              <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="Email" placeholderTextColor={C.muted} value={email} onChangeText={setEmail} style={styles.input} />
              <Button title={busy ? 'Please wait…' : 'Send code'} disabled={busy} onPress={sendCode} />
            </>
          ) : (
            <>
              <TextInput keyboardType="number-pad" maxLength={6} placeholder="6-digit code" placeholderTextColor={C.muted} value={code} onChangeText={setCode} style={styles.input} />
              <TextInput secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" placeholder="New password (8+ characters, letters and numbers)" placeholderTextColor={C.muted} value={password} onChangeText={setPassword} style={styles.input} />
              <Button title={busy ? 'Please wait…' : 'Update password'} disabled={busy} onPress={changePassword} />
              <Button title="Send a new code" variant="ghost" disabled={busy} onPress={sendCode} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Home() {
  const nav = useNavigation();
  const { data } = useApp();
  const today = todayKey();
  const todayLogs = data.logs.filter((log) => log.date === today);
  const total = todayLogs.reduce((sum, log) => sum + log.sugar, 0);
  const streak = calcStreak(data);
  const doneToday = !!data.checkins[today];
  const firstName = data.name ? data.name.split(' ')[0] : 'there';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 130 }}>
      <View style={styles.homeTop}>
        <View><Text style={styles.eyebrow}>TODAY</Text><Text style={styles.homeTitle}>{greeting()}, {firstName} 👋</Text></View>
        <Pressable onPress={() => nav.navigate('Settings')} style={styles.avatar}><Text style={styles.avatarText}>{initials(data.name)}</Text></Pressable>
      </View>

      <Card style={styles.progressCard}>
        <View style={styles.rowBetween}>
          <View><Text style={styles.darkMuted}>SUGAR-FREE STREAK</Text><Text style={styles.bigNumber}>{streak} <Text style={styles.unit}>days</Text></Text></View>
          <View style={styles.streakOrb}><Text style={{ fontSize: 25 }}>✦</Text></View>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, (streak / 30) * 100)}%` }]} /></View>
        <Text style={styles.darkCaption}>{streak ? `${Math.max(0, 30 - streak)} days to your 30-day challenge.` : 'Start today and make day 1 count.'}</Text>
      </Card>

      <View style={styles.rowBetween}><Text style={styles.sectionTitle}>Today’s check-in</Text><Pill bg={doneToday ? C.mint : C.yellow}>{doneToday ? 'Completed' : 'Required'}</Pill></View>
      <Card><Text style={styles.cardTitle}>How did you do today?</Text><Text style={styles.body}>A mandatory daily check-in keeps your habit visible.</Text><View style={styles.twoButtons}><Button title="Complete check-in" onPress={() => nav.navigate('CheckIn')} /><Button title="Log sugar" variant="secondary" onPress={() => nav.navigate('LogSugar')} /></View></Card>

      <View style={styles.rowBetween}><Text style={styles.sectionTitle}>Today’s sugar</Text><Text style={styles.link}>{Math.round(total)}g</Text></View>
      <Card><View style={styles.metricRow}><View><Text style={styles.muted}>TOTAL CONSUMED</Text><Text style={styles.metric}>{Math.round(total)}g</Text><Text style={styles.caption}>{todayLogs.length} entries today</Text></View><MiniBars logs={todayLogs} /></View></Card>

      <View style={styles.featureGrid}>
        <Feature title="Sugar Swap" icon="↔" bg={C.lav} onPress={() => nav.navigate('SugarSwap')} />
        <Feature title="Craving help" icon="♡" bg={C.peach} onPress={() => nav.navigate('Craving')} />
        <Feature title="Challenges" icon="✦" bg={C.mint} onPress={() => nav.navigate('Challenges')} />
        <Feature title="My progress" icon="◔" bg={C.yellow} onPress={() => nav.navigate('Analytics')} />
      </View>
    </ScrollView>
  );
}

function MiniBars({ logs }) {
  const values = logs.length ? logs.slice(-7).map((item) => item.sugar) : [0];
  const max = Math.max(10, ...values);
  return <View style={styles.miniBars}>{values.map((value, index) => <View key={`${value}-${index}`} style={[styles.bar, { height: Math.max(8, (value / max) * 48), backgroundColor: index === values.length - 1 ? C.purple : C.lav }]} />)}</View>;
}

function Feature({ title, icon, bg, onPress }) {
  return <Pressable onPress={onPress} style={[styles.feature, { backgroundColor: bg }]}><Text style={styles.featureIcon}>{icon}</Text><Text style={styles.featureText}>{title}</Text><Text style={styles.arrow}>↗</Text></Pressable>;
}

async function lookupBarcode(code) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,serving_size,nutriments`;
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'SugarDetox/1.0 (mobile app)' } });
    if (!response.ok) return null;
    const json = await response.json();
    if (json.status !== 1 || !json.product) return null;
    const product = json.product;
    const nutrients = product.nutriments || {};
    const name = [product.product_name, product.brands && product.brands.split(',')[0]].filter(Boolean).join(' · ') || 'Scanned product';
    const hasValue = (v) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v));
    if (hasValue(nutrients.sugars_serving)) return { name, sugar: Math.round(Number(nutrients.sugars_serving) * 10) / 10, basis: product.serving_size ? `per serving (${product.serving_size})` : 'per serving' };
    if (hasValue(nutrients.sugars_100g)) return { name, sugar: Math.round(Number(nutrients.sugars_100g) * 10) / 10, basis: 'per 100 g' };
    return { name, sugar: null, basis: '' };
  } finally {
    clearTimeout(timer);
  }
}

function LogSugar() {
  const { data, setData } = useApp();
  const [food, setFood] = useState('');
  const [qty, setQty] = useState('1');
  const [customSugar, setCustomSugar] = useState('');
  const [consumed, setConsumed] = useState(true);
  const [scanner, setScanner] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  const selected = foods.find((item) => item.name.toLowerCase() === food.toLowerCase());
  const base = selected ? selected.sugar : Number(customSugar) || 0;
  const estimate = base * (Number(qty) || 0);

  const save = () => {
    if (!consumed) {
      Alert.alert('No sugar logged', 'Your no-sugar answer will be saved in today’s check-in.', [
        { text: 'Cancel' },
        { text: 'Save', onPress: () => saveCheckIn(false) },
      ]);
      return;
    }
    if (!food || !estimate) return Alert.alert('Add a food', 'Choose a food or enter the sugar grams for a custom item.');
    const entry = { id: String(Date.now()), food, quantity: Number(qty) || 1, sugar: estimate, date: todayKey() };
    setData({ ...data, logs: [...data.logs, entry], checkins: { ...data.checkins, [todayKey()]: { consumedSugar: true, date: todayKey() } } });
    Alert.alert('Logged', `${Math.round(estimate)}g sugar was added to today.`);
    setFood(''); setQty('1'); setCustomSugar('');
  };

  const saveCheckIn = (value) => {
    setData({ ...data, checkins: { ...data.checkins, [todayKey()]: { consumedSugar: value, date: todayKey() } } });
    Alert.alert('Check-in saved', value ? 'Remember to log the item you consumed.' : 'Great — your sugar-free day is tracked.');
  };

  const handleBarcode = async (code) => {
    setScanner(false);
    setLookingUp(true);
    try {
      const product = await lookupBarcode(code);
      if (product && product.sugar !== null) {
        setFood(product.name);
        setCustomSugar(String(product.sugar));
        Alert.alert('Product found', `${product.name}\n${product.sugar} g sugar ${product.basis}. Adjust the quantity if needed.`);
      } else if (product) {
        setFood(product.name);
        setCustomSugar('');
        Alert.alert('Sugar info missing', `We found "${product.name}" but it has no sugar data. Enter the sugar grams from the label.`);
      } else {
        Alert.alert('Product not found', 'This barcode is not in our food database. Type the food name and enter its sugar grams manually.');
      }
    } catch (_) {
      Alert.alert('Could not look up product', 'Check your internet connection, or enter the sugar grams manually.');
    } finally {
      setLookingUp(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
        <Header title="Log sugar" back />
        <Text style={styles.h1}>Quick sugar log</Text>
        <Text style={styles.body}>Did you consume sugar today? Record it in a few seconds.</Text>

        <View style={styles.choiceRow}>
          <Pressable onPress={() => setConsumed(true)} style={[styles.choice, consumed && styles.choiceActive]}><Text style={{ fontSize: 24 }}>✓</Text><Text>Yes, I did</Text></Pressable>
          <Pressable onPress={() => setConsumed(false)} style={[styles.choice, !consumed && styles.choiceNo]}><Text style={{ fontSize: 24 }}>×</Text><Text>No sugar</Text></Pressable>
        </View>

        {consumed && <>
          <Text style={styles.label}>WHAT DID YOU CONSUME?</Text>
          <View style={styles.searchRow}>
            <TextInput value={food} onChangeText={setFood} placeholder="Type a food" placeholderTextColor={C.muted} style={[styles.input, { flex: 1, marginBottom: 0 }]} />
            <Pressable onPress={() => setScanner(true)} disabled={lookingUp} style={styles.scan} accessibilityLabel="Scan barcode"><Text style={{ color: '#fff', fontSize: 24 }}>⌗</Text></Pressable>
          </View>
          {lookingUp && <Text style={[styles.caption, { marginTop: 8 }]}>Looking up product…</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
            {foods.slice(0, 8).map((item) => <Pressable key={item.name} onPress={() => { setFood(item.name); setCustomSugar(''); }} style={styles.foodChip}><Text>{item.name}</Text></Pressable>)}
          </ScrollView>

          {!selected && <>
            <Text style={styles.label}>SUGAR PER SERVING (CUSTOM)</Text>
            <TextInput keyboardType="decimal-pad" value={customSugar} onChangeText={setCustomSugar} placeholder="e.g. 12" placeholderTextColor={C.muted} style={styles.input} />
          </>}

          <Text style={styles.label}>QUANTITY</Text>
          <View style={styles.qtyRow}><Pressable onPress={() => setQty(String(Math.max(1, (Number(qty) || 1) - 1)))} style={styles.qty}><Text>−</Text></Pressable><Text style={styles.qtyText}>{qty}</Text><Pressable onPress={() => setQty(String((Number(qty) || 1) + 1))} style={styles.qty}><Text>+</Text></Pressable></View>
          <Card style={styles.estimate}><Text style={styles.muted}>ESTIMATED SUGAR</Text><Text style={styles.estimateNumber}>{Math.round(estimate)}<Text style={styles.unit}>g</Text></Text><Text style={styles.caption}>Estimate based on the selected serving and quantity.</Text></Card>
          <Button title="Save sugar entry" onPress={save} />
        </>}
        {!consumed && <Button title="Save no-sugar check-in" onPress={save} />}
        <Text style={styles.smallNote}>Every saved entry appears in the calendar and progress views. Barcode product data: Open Food Facts (openfoodfacts.org).</Text>
      </ScrollView>
      {scanner && <BarcodeModal onClose={() => setScanner(false)} onFound={handleBarcode} />}
    </SafeAreaView>
  );
}

function BarcodeModal({ onClose, onFound }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true;
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission?.granted) {
    const blocked = permission && !permission.canAskAgain;
    return (
      <Modal visible transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.modal}>
          <Text style={styles.h2}>Camera permission</Text>
          <Text style={styles.body}>{blocked ? 'Camera access is turned off. Enable it in your phone settings to scan barcodes.' : 'Allow camera access to scan a food barcode. The camera is only used to read the barcode; nothing is recorded.'}</Text>
          {blocked ? <Button title="Open settings" onPress={() => Linking.openSettings()} /> : <Button title="Allow camera" onPress={requestPermission} />}
          <Button title="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }} onBarcodeScanned={({ data: code }) => { if (!scanned) { setScanned(true); onFound(code); } }}>
          <View style={styles.scanOverlay}><View style={styles.scanBox} /><Text style={styles.scanText}>Point at a food barcode</Text><Button title="Close" variant="secondary" onPress={onClose} /></View>
        </CameraView>
      </View>
    </Modal>
  );
}

function CalendarScreen() {
  const { data } = useApp();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const days = new Date(year, month + 1, 0).getDate();
  const start = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < start; i += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) cells.push(day);

  const logged = new Set(data.logs.filter((log) => { const date = new Date(`${log.date}T00:00:00`); return date.getMonth() === month && date.getFullYear() === year; }).map((log) => Number(log.date.slice(-2))));
  const sugarFree = new Set(Object.entries(data.checkins).filter(([key, value]) => value.consumedSugar === false && key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)).map(([key]) => Number(key.slice(-2))));
  const label = new Date(year, month, 1).toLocaleString('en', { month: 'long' });

  const move = (delta) => {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 0) { nextMonth = 11; nextYear -= 1; }
    if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
    setMonth(nextMonth); setYear(nextYear);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 130 }}>
      <Header title="Habit calendar" />
      <View style={styles.calendarTop}><Pressable onPress={() => move(-1)}><Text style={styles.chev}>‹</Text></Pressable><Text style={styles.month}>{label} {year}</Text><Pressable onPress={() => move(1)}><Text style={styles.chev}>›</Text></Pressable></View>
      <Card>
        <View style={styles.week}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <Text key={day} style={styles.weekText}>{day}</Text>)}</View>
        <View style={styles.calendarGrid}>{cells.map((day, index) => <View key={`${day}-${index}`} style={styles.dayCell}>{day && <View style={[styles.dayDot, logged.has(day) && styles.daySugar, sugarFree.has(day) && styles.dayFree]}><Text style={[styles.dayText, (logged.has(day) || sugarFree.has(day)) && { color: '#fff' }]}>{day}</Text></View>}</View>)}</View>
      </Card>
      <View style={styles.legend}><View style={[styles.legendDot, { backgroundColor: C.purple }]} /><Text>Sugar consumed</Text><View style={[styles.legendDot, { backgroundColor: C.mintStrong }]} /><Text>Sugar-free check-in</Text></View>
      <Card style={{ marginTop: 20 }}><Text style={styles.cardTitle}>Habit effect</Text><Text style={styles.body}>See the days you consumed sugar and the days you completed a sugar-free check-in.</Text></Card>
    </ScrollView>
  );
}

function Analytics() {
  const { data } = useApp();
  const today = new Date();
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => { const date = new Date(today); date.setDate(today.getDate() - (6 - index)); const key = localDateKey(date); return { key, label: date.toLocaleDateString('en', { weekday: 'short' }), value: data.logs.filter((log) => log.date === key).reduce((sum, log) => sum + log.sugar, 0) }; }), [data.logs]);
  const monthPrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const monthTotal = data.logs.filter((log) => log.date.startsWith(monthPrefix)).reduce((sum, log) => sum + log.sugar, 0);
  const todayTotal = week[6]?.value || 0;
  const weekTotal = week.reduce((sum, item) => sum + item.value, 0);
  const max = Math.max(10, ...week.map((item) => item.value));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 130 }}>
      <Header title="My progress" />
      <Text style={styles.h1}>See your sugar story.</Text>
      <Text style={styles.body}>Daily, weekly and monthly sugar consumption in one place.</Text>
      <View style={styles.statsRow}><Stat value={`${Math.round(todayTotal)}g`} label="Today" /><Stat value={`${Math.round(weekTotal)}g`} label="7 days" /><Stat value={`${Math.round(monthTotal)}g`} label="This month" /></View>
      <Card><Text style={styles.cardTitle}>Weekly progress</Text><View style={styles.chart}>{week.map((item) => <View key={item.key} style={styles.chartCol}><Text style={styles.chartValue}>{Math.round(item.value)}g</Text><View style={[styles.chartBar, { height: Math.max(8, (item.value / max) * 150) }]} /><Text style={styles.chartLabel}>{item.label}</Text></View>)}</View></Card>
      <Card style={{ marginTop: 16 }}><Text style={styles.cardTitle}>Habit summary</Text><View style={styles.summaryRow}><Text>Days with sugar logged</Text><Text style={styles.bold}>{new Set(data.logs.map((log) => log.date)).size}</Text></View><View style={styles.summaryRow}><Text>Challenges completed</Text><Text style={styles.bold}>{Object.values(data.challenges).filter((item) => item.completed).length}</Text></View><View style={styles.summaryRow}><Text>Points earned</Text><Text style={styles.bold}>{data.points}</Text></View></Card>
    </ScrollView>
  );
}

function Stat({ value, label }) {
  return <Card style={{ flex: 1, marginHorizontal: 4 }}><Text style={styles.metric}>{value}</Text><Text style={styles.muted}>{label}</Text></Card>;
}

function Challenges() {
  const { data, setData } = useApp();
  const nav = useNavigation();
  const today = todayKey();

  const markToday = (challenge) => {
    const current = data.challenges[challenge.id] || { progress: 0, completed: false, lastDate: null };
    if (current.completed) return;
    if (current.lastDate === today) return Alert.alert('Already tracked', 'Today is already counted for this challenge.');
    const nextProgress = Math.min(challenge.days, (current.progress || 0) + 1);
    const completed = nextProgress >= challenge.days;
    setData({ ...data, challenges: { ...data.challenges, [challenge.id]: { ...current, started: true, progress: nextProgress, completed, lastDate: today } }, points: completed && !current.completed ? data.points + challenge.points : data.points });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 130 }}>
      <Header title="Challenges" /><Text style={styles.h1}>Build your streak.</Text><Text style={styles.body}>Complete challenges to build your streak and earn points.</Text>
      {challenges.map((challenge) => { const state = data.challenges[challenge.id] || {}; const progress = state.progress || 0; return <Card key={challenge.id} style={{ backgroundColor: challenge.bg, marginBottom: 14 }}><View style={styles.rowBetween}><View style={styles.challengeIcon}><Text style={{ fontSize: 24 }}>{challenge.icon}</Text></View><Pill bg="#fff">{challenge.points} pts</Pill></View><Text style={[styles.cardTitle, { marginTop: 12 }]}>{challenge.title}</Text><Text style={styles.body}>{challenge.subtitle}</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, (progress / challenge.days) * 100)}%` }]} /></View><View style={styles.rowBetween}><Text style={styles.caption}>{progress}/{challenge.days} days</Text>{state.completed ? <Text style={styles.complete}>Completed ✓</Text> : <Button title={progress ? 'Mark today' : 'Start challenge'} onPress={() => markToday(challenge)} />}</View></Card>; })}
      <Card><Text style={styles.cardTitle}>Rewards</Text><Text style={styles.body}>Completed challenges award points that you can redeem for rewards. Points have no cash value.</Text><Button title={`View rewards · ${data.points} pts`} variant="secondary" onPress={() => nav.navigate('Rewards')} /></Card>
    </ScrollView>
  );
}

function Rewards() {
  const { data, setData } = useApp();
  const redeem = (reward) => {
    if (data.points < reward.points) return Alert.alert('Not enough points', `You need ${reward.points - data.points} more points.`);
    setData({ ...data, points: data.points - reward.points, rewards: [...data.rewards, { id: String(Date.now()), rewardId: reward.id, name: reward.name, date: todayKey() }] });
    Alert.alert('Reward requested', `${reward.name} has been recorded as a redemption request.`);
  };
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.pad}><Header title="Rewards" back /><Text style={styles.h1}>Your points</Text><Text style={styles.rewardPoints}>{data.points}</Text><Text style={styles.body}>Redeem your points for rewards. Points have no cash value.</Text>{rewardCatalog.map((reward) => <Card key={reward.id} style={styles.rewardCard}><Text style={{ fontSize: 36 }}>{reward.emoji}</Text><View style={{ flex: 1, marginLeft: 14 }}><Text style={styles.cardTitle}>{reward.name}</Text><Text style={styles.muted}>{reward.points} points</Text></View><Pressable disabled={data.points < reward.points} onPress={() => redeem(reward)} style={[styles.redeem, { opacity: data.points >= reward.points ? 1 : 0.4 }]}><Text>Redeem</Text></Pressable></Card>)}</ScrollView></SafeAreaView>;
}

function Craving() {
  const nav = useNavigation();
  const [craving, setCraving] = useState('');
  const [shown, setShown] = useState(false);
  const activities = ['Drink a glass of water and wait 10 minutes.', 'Take a short walk outside.', 'Brush your teeth to reset the taste cue.', 'Try five slow breaths and notice the craving without acting on it.'];
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.pad}><Header title="Craving intervention" back /><Text style={styles.h1}>Craving something sweet?</Text><Text style={styles.body}>Tell us what you want and try a small interruption before deciding.</Text><TextInput value={craving} onChangeText={setCraving} placeholder="e.g. chocolate, soda, ice cream" placeholderTextColor={C.muted} style={styles.input} /><Button title="Help me ride it out" onPress={() => setShown(true)} />{shown && <Card style={{ marginTop: 20, backgroundColor: C.peach }}><Text style={styles.cardTitle}>Try this first</Text>{activities.map((activity, index) => <View key={activity} style={styles.tipRow}><View style={styles.tipNum}><Text>{index + 1}</Text></View><Text style={{ flex: 1, lineHeight: 22 }}>{activity}</Text></View>)}<Button title="I still want it → Sugar Swap" variant="secondary" onPress={() => nav.navigate('SugarSwap')} /></Card>}</ScrollView></SafeAreaView>;
}

function SugarSwap() {
  const nav = useNavigation();
  const [query, setQuery] = useState('');
  const match = recipes.filter((recipe) => !query || recipe.craving.includes(query.toLowerCase()) || recipe.name.toLowerCase().includes(query.toLowerCase()));
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.pad}><Header title="Sugar Swap" back /><Text style={styles.h1}>Swap the craving.</Text><Text style={styles.body}>Enter what you’re craving and get an alternative with a recipe.</Text><TextInput value={query} onChangeText={setQuery} placeholder="What are you craving now?" placeholderTextColor={C.muted} style={styles.input} />{match.map((recipe) => <Pressable key={recipe.name} onPress={() => nav.navigate('Recipe', { recipe })} style={styles.swapCard}><View style={styles.swapEmoji}><Text style={{ fontSize: 30 }}>{recipe.emoji}</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{recipe.name}</Text><Text style={styles.muted}>{recipe.time} · {recipe.sugar} sugar</Text><Text style={styles.caption}>Alternative for {recipe.craving}</Text></View><Text style={styles.arrow}>›</Text></Pressable>)}{!match.length && <Card style={{ marginTop: 14 }}><Text style={styles.cardTitle}>No exact match</Text><Text style={styles.body}>Try chocolate, soda or ice cream.</Text></Card>}</ScrollView></SafeAreaView>;
}

function Recipe({ route }) {
  const recipe = route.params.recipe;
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.pad}><Header title="Recipe" back /><View style={styles.recipeHero}><Text style={{ fontSize: 62 }}>{recipe.emoji}</Text></View><Text style={styles.h1}>{recipe.name}</Text><View style={styles.row}><Pill>{recipe.time}</Pill><Pill bg={C.mint}>{recipe.sugar} sugar</Pill></View><Text style={[styles.sectionTitle, { marginTop: 24 }]}>Ingredients</Text>{recipe.items.map((item) => <Text key={item} style={styles.ingredient}>• {item}</Text>)}<Text style={[styles.sectionTitle, { marginTop: 24 }]}>Method</Text><Text style={styles.body}>{recipe.method}</Text></ScrollView></SafeAreaView>;
}

function CheckIn() {
  const { data, setData } = useApp();
  const today = todayKey();
  const [answer, setAnswer] = useState(data.checkins[today]?.consumedSugar ?? null);
  const save = () => {
    if (answer === null) return;
    setData({ ...data, checkins: { ...data.checkins, [today]: { consumedSugar: answer, date: today } } });
    Alert.alert('Check-in saved', answer ? 'Thanks. If you consumed sugar, log the item too.' : 'Great — your sugar-free day is tracked.');
  };
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.pad}><Header title="Daily check-in" back /><Text style={styles.eyebrow}>MANDATORY DAILY CHECK-IN</Text><Text style={styles.h1}>How did you do today?</Text><Text style={styles.body}>Choose one answer. You can update it later by logging sugar.</Text><View style={styles.choiceRow}><Pressable onPress={() => setAnswer(false)} style={[styles.choice, answer === false && styles.choiceActive]}><Text style={{ fontSize: 26 }}>🌿</Text><Text>No added sugar</Text></Pressable><Pressable onPress={() => setAnswer(true)} style={[styles.choice, answer === true && styles.choiceNo]}><Text style={{ fontSize: 26 }}>🍬</Text><Text>I had sugar</Text></Pressable></View><Button title="Save today’s check-in" disabled={answer === null} onPress={save} /></ScrollView></SafeAreaView>;
}

function Settings() {
  const { data, setData, logout, resetData, deleteAccount, syncStatus } = useApp();
  const nav = useNavigation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = async (key) => {
    const next = !data.reminders[key];
    setData({ ...data, reminders: { ...data.reminders, [key]: next } });
    await setReminderNotification(key, next);
  };
  const goToStart = () => nav.reset({ index: 0, routes: [{ name: 'Splash' }] });
  const handleLogout = async () => {
    await logout();
    goToStart();
  };
  const reset = () => {
    Alert.alert('Reset your data?', 'This deletes all your sugar logs, check-ins, challenge progress and points. Your account stays. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          try {
            await resetData();
            Alert.alert('Done', 'Your tracking data has been cleared.');
          } catch (error) {
            Alert.alert('Could not reset data', error.message);
          }
        },
      },
    ]);
  };
  const confirmDelete = async () => {
    if (!deletePassword) return Alert.alert('Enter your password', 'Your password is required to delete your account.');
    setBusy(true);
    try {
      await deleteAccount(deletePassword);
      setDeleteOpen(false);
      setDeletePassword('');
      Alert.alert('Account deleted', 'Your account and data have been permanently deleted.');
      goToStart();
    } catch (error) {
      Alert.alert('Could not delete account', error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.pad}>
        <Header title="Settings" back />
        <Text style={styles.h1}>Make reminders work for you.</Text>
        <Text style={styles.body}>Personalize the moments when Sugar Detox checks in.</Text>
        {[['morning', 'Morning check-in', 'Start the day with a goal.'], ['meal', 'After-meal reminder', 'Log sugar after meals.'], ['evening', 'Evening check-in', 'How did you do today?']].map(([key, title, subtitle]) => (
          <Pressable key={key} onPress={() => toggle(key)} style={styles.settingRow} accessibilityRole="switch" accessibilityState={{ checked: !!data.reminders[key] }}>
            <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.caption}>{subtitle}</Text></View>
            <View style={[styles.switch, { backgroundColor: data.reminders[key] ? C.purple : C.line }]}><View style={[styles.switchKnob, { alignSelf: data.reminders[key] ? 'flex-end' : 'flex-start' }]} /></View>
          </Pressable>
        ))}
        <Card style={{ marginTop: 20 }}>
          <Text style={styles.cardTitle}>Account</Text>
          <Text style={styles.body}>{data.name || 'User'} · {data.email || 'Account'}</Text>
          <Text style={styles.caption}>Sync: {syncStatus === 'synced' ? 'Up to date' : syncStatus === 'syncing' ? 'Syncing…' : 'Offline — will retry automatically'}</Text>
          <Button title="Log out" variant="secondary" onPress={handleLogout} />
          <Button title="Reset my tracking data" variant="ghost" onPress={reset} />
          <Button title="Delete account" variant="ghost" onPress={() => setDeleteOpen(true)} />
        </Card>
        <Card style={{ marginTop: 16 }}>
          <Text style={styles.cardTitle}>Legal</Text>
          <Button title="Privacy Policy" variant="ghost" onPress={() => openLink(PRIVACY_URL)} />
          <Button title="Terms of Use" variant="ghost" onPress={() => openLink(TERMS_URL)} />
          <Text style={styles.caption}>{HEALTH_DISCLAIMER}</Text>
        </Card>
      </ScrollView>
      <Modal visible={deleteOpen} transparent animationType="slide" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.modal}>
          <Text style={styles.h2}>Delete your account?</Text>
          <Text style={styles.body}>This permanently deletes your account, sugar logs, check-ins, challenges, points and rewards. This cannot be undone.</Text>
          <TextInput secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Enter your password to confirm" placeholderTextColor={C.muted} value={deletePassword} onChangeText={setDeletePassword} style={styles.input} />
          <Button title={busy ? 'Deleting…' : 'Permanently delete'} disabled={busy} onPress={confirmDelete} />
          <Button title="Cancel" variant="secondary" disabled={busy} onPress={() => { setDeleteOpen(false); setDeletePassword(''); }} />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MainTabs() {
  return <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: C.purple, tabBarInactiveTintColor: '#98919F', tabBarStyle: { height: 78, paddingTop: 8, paddingBottom: 14, backgroundColor: '#fff', borderTopColor: C.line }, tabBarLabelStyle: { fontSize: 11, fontWeight: '700' } }}><Tab.Screen name="Home" component={Home} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 19 }}>⌂</Text> }} /><Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>□</Text> }} /><Tab.Screen name="Analytics" component={Analytics} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>◔</Text> }} /><Tab.Screen name="Challenges" component={Challenges} options={{ tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>✦</Text> }} /></Tab.Navigator>;
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.log('App error', error?.message || error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <SafeAreaView style={styles.centerPage}>
        <Text style={styles.h1}>Something went wrong.</Text>
        <Text style={styles.body}>Sorry about that. Your data is safe. Please try again.</Text>
        <View style={{ width: '100%', marginTop: 24 }}><Button title="Try again" onPress={() => this.setState({ failed: false })} /></View>
      </SafeAreaView>
    );
  }
}

function ConfigError() {
  return (
    <SafeAreaView style={styles.centerPage}>
      <Text style={styles.h1}>Setup problem</Text>
      <Text style={styles.body}>{CONFIG_ERROR}</Text>
    </SafeAreaView>
  );
}

function App() {
  if (CONFIG_ERROR) return <ConfigError />;
  return <ErrorBoundary><Provider><StatusBar style="dark" /><NavigationContainer><Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}><Stack.Screen name="Splash" component={Splash} /><Stack.Screen name="Intro" component={Intro} /><Stack.Screen name="Goals" component={Goals} /><Stack.Screen name="Auth" component={Auth} /><Stack.Screen name="ForgotPassword" component={ForgotPassword} /><Stack.Screen name="Main" component={MainTabs} /><Stack.Screen name="LogSugar" component={LogSugar} /><Stack.Screen name="CheckIn" component={CheckIn} /><Stack.Screen name="Craving" component={Craving} /><Stack.Screen name="SugarSwap" component={SugarSwap} /><Stack.Screen name="Recipe" component={Recipe} /><Stack.Screen name="Rewards" component={Rewards} /><Stack.Screen name="Settings" component={Settings} /></Stack.Navigator></NavigationContainer></Provider></ErrorBoundary>;
}

function calcStreak(data) {
  const checkins = data.checkins || {};
  let date = new Date();
  // If today's check-in isn't done yet, the streak is still alive: count back from yesterday.
  if (!checkins[localDateKey(date)]) date.setDate(date.getDate() - 1);
  let count = 0;
  while (true) {
    const key = localDateKey(date);
    if (!checkins[key] || checkins[key].consumedSugar !== false) break;
    count += 1;
    date.setDate(date.getDate() - 1);
  }
  return count;
}

function initials(name) {
  const parts = (name || 'User').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'U';
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 28 },
  logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  logoMarkSmall: { width: 30, height: 30, borderRadius: 10 },
  logoStar: { color: '#fff', fontSize: 18 },
  logoText: { fontSize: 22, fontWeight: '900', letterSpacing: -1, color: C.ink },
  logoTextSmall: { fontSize: 18 },
  splashOrb: { width: 170, height: 170, borderRadius: 85, backgroundColor: C.lav, alignItems: 'center', justifyContent: 'center', marginTop: 70, marginBottom: 40 },
  splashOrbStar: { fontSize: 38, color: C.purple },
  splashTitle: { fontSize: 36, lineHeight: 40, fontWeight: '900', textAlign: 'center', letterSpacing: -1.5, color: C.ink },
  splashSub: { marginTop: 12, color: C.muted, fontSize: 16 },
  page: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 18 },
  pad: { padding: 22, paddingBottom: 50 },
  centerPage: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heroOrb: { width: 190, height: 190, borderRadius: 95, backgroundColor: C.lav, alignItems: 'center', justifyContent: 'center', marginBottom: 34 },
  h1: { fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -1.2, color: C.ink },
  h2: { fontSize: 24, fontWeight: '800', color: C.ink },
  body: { fontSize: 15.5, lineHeight: 23, color: C.muted, marginTop: 10 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: C.purple, marginBottom: 10 },
  button: { minHeight: 54, borderRadius: 18, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 14 },
  buttonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  buttonTextDark: { color: C.ink },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  backButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, color: C.ink },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: C.line },
  input: { height: 56, borderWidth: 1, borderColor: C.line, borderRadius: 17, paddingHorizontal: 16, fontSize: 15, color: C.ink, backgroundColor: '#fff', marginTop: 14, marginBottom: 2 },
  goalRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, marginTop: 10 },
  goalRowActive: { borderColor: C.purple, backgroundColor: C.lav2 },
  check: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: '#C8BFCE', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkActive: { backgroundColor: C.purple, borderColor: C.purple },
  goalText: { flex: 1, fontSize: 15, fontWeight: '700', color: C.ink, lineHeight: 20 },
  smallNote: { textAlign: 'center', color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 18 },
  homeTop: { paddingTop: 18, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  homeTitle: { fontSize: 25, fontWeight: '900', letterSpacing: -0.8, color: C.ink },
  avatar: { width: 42, height: 42, borderRadius: 16, backgroundColor: C.lav, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.purple, fontWeight: '900' },
  progressCard: { backgroundColor: C.ink, borderColor: C.ink, marginBottom: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  darkMuted: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, color: '#B8AFBE' },
  muted: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, color: C.muted },
  bigNumber: { fontSize: 44, fontWeight: '900', color: '#fff', marginTop: 4 },
  unit: { fontSize: 15, fontWeight: '700', color: C.muted },
  streakOrb: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.lav, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 9, borderRadius: 10, backgroundColor: '#3A3540', overflow: 'hidden', marginTop: 20 },
  progressFill: { height: '100%', backgroundColor: C.lav, borderRadius: 10 },
  darkCaption: { fontSize: 12, color: '#B8AFBE', lineHeight: 18, marginTop: 8 },
  caption: { fontSize: 12, color: C.muted, lineHeight: 18, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: C.ink, marginVertical: 10 },
  link: { color: C.purple, fontWeight: '800' },
  pill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20 },
  pillText: { fontSize: 11, fontWeight: '800', color: C.ink },
  cardTitle: { fontSize: 17, fontWeight: '800', color: C.ink },
  twoButtons: { flexDirection: 'row', gap: 10 },
  metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metric: { fontSize: 28, fontWeight: '900', color: C.ink, marginTop: 4 },
  miniBars: { height: 54, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  bar: { width: 8, borderRadius: 5 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  feature: { width: '48%', minHeight: 125, borderRadius: 24, padding: 16, position: 'relative' },
  featureIcon: { fontSize: 24 },
  featureText: { fontSize: 16, fontWeight: '900', marginTop: 20, color: C.ink },
  arrow: { position: 'absolute', right: 14, bottom: 14, fontSize: 22, color: C.ink },
  label: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: C.muted, marginTop: 18 },
  choiceRow: { flexDirection: 'row', gap: 12, marginVertical: 18 },
  choice: { flex: 1, minHeight: 100, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', gap: 7 },
  choiceActive: { backgroundColor: C.mint, borderColor: C.mintStrong },
  choiceNo: { backgroundColor: C.peach, borderColor: '#FFB9A9' },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  scan: { width: 56, height: 56, borderRadius: 17, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  foodChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, marginRight: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: C.line, padding: 8, marginTop: 8 },
  qty: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.lav2, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: '900' },
  estimate: { marginTop: 18, backgroundColor: C.lav2, borderColor: C.lav },
  estimateNumber: { fontSize: 48, fontWeight: '900', color: C.ink, marginTop: 4 },
  modal: { position: 'absolute', left: 20, right: 20, bottom: 30, padding: 22, borderRadius: 26, backgroundColor: '#fff' },
  scanOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.18)', padding: 24 },
  scanBox: { width: 260, height: 180, borderWidth: 3, borderColor: '#fff', borderRadius: 24 },
  scanText: { color: '#fff', fontSize: 16, fontWeight: '800', marginVertical: 20 },
  calendarTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 18 },
  month: { fontSize: 19, fontWeight: '900' },
  chev: { fontSize: 34, color: C.purple },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  weekText: { width: '14.285%', textAlign: 'center', fontSize: 11, color: C.muted },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.285%', height: 54, alignItems: 'center', justifyContent: 'center' },
  dayDot: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: C.lav2 },
  daySugar: { backgroundColor: C.purple },
  dayFree: { backgroundColor: C.mintStrong },
  dayText: { fontWeight: '800', color: C.ink },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16, flexWrap: 'wrap' },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginLeft: 8 },
  statsRow: { flexDirection: 'row', marginVertical: 16 },
  chart: { height: 210, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 25 },
  chartCol: { alignItems: 'center', justifyContent: 'flex-end', height: 190, flex: 1 },
  chartValue: { fontSize: 9, color: C.muted, marginBottom: 5 },
  chartBar: { width: 22, borderRadius: 10, backgroundColor: C.purple, minHeight: 8 },
  chartLabel: { fontSize: 10, color: C.muted, marginTop: 7 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line },
  bold: { fontWeight: '900' },
  challengeIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  complete: { fontWeight: '900', color: '#3C9A28' },
  rewardPoints: { fontSize: 64, fontWeight: '900', color: C.purple, marginTop: 8 },
  rewardCard: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  redeem: { backgroundColor: C.lav, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  tipRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 14 },
  tipNum: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  swapCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, marginTop: 12 },
  swapEmoji: { width: 58, height: 58, borderRadius: 19, backgroundColor: C.lav2, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  recipeHero: { height: 180, borderRadius: 28, backgroundColor: C.lav, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  ingredient: { fontSize: 16, color: C.ink, fontWeight: '700', paddingVertical: 7 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: C.line },
  switch: { width: 52, height: 31, borderRadius: 20, padding: 3, justifyContent: 'center' },
  switchKnob: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#fff' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16, marginBottom: 6 },
  consentText: { flex: 1, marginLeft: 12, color: C.muted, fontSize: 13, lineHeight: 19 },
  linkInline: { color: C.purple, fontWeight: '700', textDecorationLine: 'underline' },
});

export default App;