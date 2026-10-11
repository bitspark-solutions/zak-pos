import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Cache the API host to avoid recomputing on every access
let cachedApiHost: string | null = null;
let cachedBaseURL: string | null = null;

/**
 * Get the appropriate API host based on platform
 * - Android Emulator: Uses 10.0.2.2 (special IP that maps to host machine)
 * - iOS Simulator: Uses localhost (works natively)
 * - Physical Devices: Uses local network IP from EXPO_PUBLIC_API_HOST
 * - Web: Uses localhost
 * 
 * Result is cached for performance
 */
const getApiHost = (): string => {
  // Return cached value if available
  if (cachedApiHost !== null) {
    return cachedApiHost;
  }

  const apiPort = process.env.EXPO_PUBLIC_API_PORT || '39847';
  
  // Priority 1: Full API URL override (highest priority)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    // Extract host from full URL if provided
    try {
      const url = new URL(envUrl);
      cachedApiHost = url.origin;
      return cachedApiHost;
    } catch {
      // If it's just a host, return as is
      cachedApiHost = envUrl;
      return cachedApiHost;
    }
  }

  // Priority 2: API Host IP from environment variable
  const apiHost = process.env.EXPO_PUBLIC_API_HOST;
  if (apiHost) {
    // If it includes protocol, use as is, otherwise add http://
    if (apiHost.startsWith('http://') || apiHost.startsWith('https://')) {
      cachedApiHost = `${apiHost}:${apiPort}`;
    } else {
      cachedApiHost = `http://${apiHost}:${apiPort}`;
    }
    return cachedApiHost;
  }

  // Priority 3: Expo config override (cache Constants access)
  const expoConfig = Constants.expoConfig;
  const expoConfigUrl = expoConfig?.extra?.apiUrl;
  if (expoConfigUrl) {
    try {
      const url = new URL(expoConfigUrl);
      cachedApiHost = url.origin;
    } catch {
      cachedApiHost = expoConfigUrl;
    }
    return cachedApiHost!; // Non-null assertion: cachedApiHost is always set in this block
  }

  // Priority 4: Platform-specific defaults (cache Platform.OS access)
  const platform = Platform.OS;
  if (platform === 'android') {
    // For Android Emulator: 10.0.2.2 maps to host machine's localhost
    // For physical Android devices: Use EXPO_PUBLIC_API_HOST environment variable
    // Default to 10.0.2.2 for emulator compatibility
    cachedApiHost = `http://10.0.2.2:${apiPort}`;
  } else if (platform === 'ios') {
    // For iOS Simulator: localhost works, but network IP works for both simulator and physical
    // For physical iOS devices: Use EXPO_PUBLIC_API_HOST environment variable
    // Default to localhost for simulator
    cachedApiHost = `http://localhost:${apiPort}`;
  } else {
    // Web: localhost works fine
    cachedApiHost = `http://localhost:${apiPort}`;
  }
  
  return cachedApiHost;
};

/**
 * Get the base URL (cached for performance)
 */
const getBaseURL = (): string => {
  if (cachedBaseURL !== null) {
    return cachedBaseURL;
  }
  cachedBaseURL = `${getApiHost()}/api/v1`;
  return cachedBaseURL;
};

/**
 * API Configuration
 * Automatically detects platform and uses appropriate host
 * Uses lazy evaluation and caching for optimal performance
 */
export const API_CONFIG = {
  get baseURL() {
    return getBaseURL();
  },
  timeout: 30000, // 30 seconds
};

/**
 * Get full API URL for an endpoint
 */
export const getApiUrl = (endpoint: string): string => {
  const base = API_CONFIG.baseURL.replace(/\/$/, ''); // Remove trailing slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

/**
 * Fetch with timeout support
 */
export const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout: number = API_CONFIG.timeout
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};

