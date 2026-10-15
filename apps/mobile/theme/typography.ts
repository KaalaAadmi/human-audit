import { TextStyle } from 'react-native';

  export const Typography: Record<string, TextStyle> = {
    heroTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: '#E4E4E7',
      letterSpacing: -0.6,
    },
    sectionHeader: {
      fontSize: 20,
      fontWeight: '700',
      color: '#E4E4E7',
      letterSpacing: -0.4,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#E4E4E7',
    },
    body: {
      fontSize: 13,
      fontWeight: '400',
      color: '#CBD5E1',
      lineHeight: 18,
    },
    caption: {
      fontSize: 11,
      fontWeight: '500',
      color: '#84858E',
    },
    metricLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: '#84858E',
    },
  };