import { useColorScheme } from 'react-native';

export interface Palette {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  danger: string;
  success: string;
  warning: string;
  /** Burbuja de mensaje saliente (nosotros) y entrante (el contacto). */
  bubbleOut: string;
  bubbleIn: string;
}

const light: Palette = {
  dark: false,
  bg: '#f4f6f8',
  surface: '#ffffff',
  surfaceAlt: '#eef1f4',
  border: '#dfe3e8',
  text: '#1a1d21',
  textMuted: '#666e78',
  primary: '#0f7b6c',
  primaryText: '#ffffff',
  danger: '#c02b2b',
  success: '#1a7f37',
  warning: '#9a6700',
  bubbleOut: '#d6f2e6',
  bubbleIn: '#ffffff',
};

const dark: Palette = {
  dark: true,
  bg: '#111417',
  surface: '#1b1f24',
  surfaceAlt: '#22272d',
  border: '#2d333b',
  text: '#e6edf3',
  textMuted: '#9aa4af',
  primary: '#2ea88f',
  primaryText: '#04120f',
  danger: '#f85149',
  success: '#3fb950',
  warning: '#d29922',
  bubbleOut: '#1f4d42',
  bubbleIn: '#22272d',
};

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 6, md: 10, lg: 16 } as const;
