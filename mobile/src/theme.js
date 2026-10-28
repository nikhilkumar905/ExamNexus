// Colours match the website (frontend/src/styles.css). Sizes are derived from the
// live window size, so every screen adapts to small phones, large phones, tablets
// and rotation without per-device code.
import { useWindowDimensions } from 'react-native'

export const colors = {
  bg: '#f5f6fa',
  surface: '#ffffff',
  text: '#1c2033',
  muted: '#6b7080',
  border: '#e3e5ec',
  primary: '#4f46e5',
  primarySoft: '#eef0ff',
  green: '#15803d',
  greenSoft: '#e8f7ee',
  red: '#c62828',
  redSoft: '#fdecec',
  amber: '#b45309',
  amberSoft: '#fff4e0',
  white: '#ffffff',
}

export const radius = 12
const BASE_WIDTH = 390 // a typical phone

export function useLayout() {
  const { width, height } = useWindowDimensions()
  const scale = Math.min(Math.max(width / BASE_WIDTH, 0.85), 1.3)
  // Fonts grow at half the rate of the screen so tablets don't get giant text
  const fs = (size) => Math.round(size * (1 + (scale - 1) * 0.5))
  return {
    width,
    height,
    landscape: width > height,
    isTablet: Math.min(width, height) >= 600,
    columns: width >= 1000 ? 3 : width >= 640 ? 2 : 1,
    gutter: width < 360 ? 12 : width >= 640 ? 24 : 16,
    maxContent: 960,
    fs,
  }
}
