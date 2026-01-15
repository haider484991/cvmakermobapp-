/* eslint-disable no-undef */

// Mock expo module
jest.mock('expo', () => ({}));

// Mock react-native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default),
  },
  StyleSheet: {
    create: jest.fn((styles) => styles),
    absoluteFillObject: {},
  },
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Link: 'Link',
  Stack: {
    Screen: 'Stack.Screen',
  },
  Tabs: {
    Screen: 'Tabs.Screen',
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  default: {
    call: jest.fn(),
  },
  useSharedValue: jest.fn((init) => ({ value: init })),
  useAnimatedStyle: jest.fn(() => ({})),
  withSpring: jest.fn((value) => value),
  withTiming: jest.fn((value) => value),
  withDelay: jest.fn((_, value) => value),
  withSequence: jest.fn((...values) => values[0]),
  withRepeat: jest.fn((value) => value),
  Easing: {
    linear: jest.fn(),
    ease: jest.fn(),
    quad: jest.fn(),
    cubic: jest.fn(),
    sin: jest.fn(),
    in: jest.fn(() => jest.fn()),
    out: jest.fn(() => jest.fn()),
    inOut: jest.fn(() => jest.fn()),
    back: jest.fn(() => jest.fn()),
  },
  FadeIn: { delay: jest.fn(() => ({ duration: jest.fn() })) },
  FadeInUp: { delay: jest.fn(() => ({ duration: jest.fn(() => ({ springify: jest.fn() })) })) },
  FadeInDown: { delay: jest.fn(() => ({ duration: jest.fn() })) },
  FadeInRight: { delay: jest.fn(() => ({ springify: jest.fn() })) },
  FadeInLeft: { delay: jest.fn(() => ({ springify: jest.fn() })) },
  ZoomIn: { delay: jest.fn(() => ({ springify: jest.fn() })) },
  Layout: { springify: jest.fn() },
  runOnJS: jest.fn((fn) => fn),
}));

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
    })
  ),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock expo-print
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() =>
    Promise.resolve({ uri: 'file://test.pdf' })
  ),
}));

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  Paths: {
    document: '/mock/document',
    cache: '/mock/cache',
  },
  File: jest.fn().mockImplementation((base, name) => ({
    uri: `${base}/${name}`,
    exists: true,
    move: jest.fn(),
    delete: jest.fn(),
  })),
  Directory: jest.fn().mockImplementation((base, name) => ({
    uri: `${base}/${name}`,
    exists: true,
    create: jest.fn(),
  })),
}));

// Mock lucide-react-native icons
jest.mock('lucide-react-native', () => ({
  FileText: 'FileText',
  Sparkles: 'Sparkles',
  Layout: 'Layout',
  Download: 'Download',
  Check: 'Check',
  ChevronLeft: 'ChevronLeft',
  Rocket: 'Rocket',
}));

// Global test timeout
jest.setTimeout(10000);
