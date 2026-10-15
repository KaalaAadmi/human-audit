import { TextStyle } from 'react-native';

export const Typography: Record<string, TextStyle> = {
  displayLarge: {
    fontSize: 34,
    fontWeight: '800',
    color: '#F4F4F5',
    letterSpacing: -1.0,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F4F4F5',
    letterSpacing: -0.6,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F4F4F5',
    letterSpacing: -0.4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F4F4F5',
  },
  bodyText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#A1A1AA',
    lineHeight: 20,
  },
  body: {
    fontSize: 13,
    fontWeight: '400',
    color: '#A1A1AA',
    lineHeight: 18,
  },
  bodyMono: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F4F4F5',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    color: '#71717A',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    color: '#71717A',
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: '#71717A',
  },
};
