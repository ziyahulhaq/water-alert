export type ThemeColors = {
  bg: string;
  surface: string;
  frame: string;
  divider: string;
  hair: string;
  accent: string;
  alert: string;
  disabled: string;
  t1: string;
  t2: string;
  t3: string;
  t4: string;
};

export const darkTheme: ThemeColors = {
  bg: '#121212',
  surface: '#2B2B2C',
  frame: '#212121',
  divider: '#1C1C1C',
  hair: '#383838',
  accent: '#00FFFE',
  alert: '#8B3A3A',
  disabled: '#444444',
  t1: '#F5F5F5',
  t2: 'rgba(214,214,214,0.7)',
  t3: 'rgba(214,214,214,0.45)',
  t4: 'rgba(214,214,214,0.4)',
};

export const lightTheme: ThemeColors = {
  bg: '#FFFFFF',
  surface: '#F2F2F2',
  frame: '#E0E0E0',
  divider: '#EBEBEB',
  hair: '#D4D4D4',
  accent: '#009999',
  alert: '#8B3A3A',
  disabled: '#A3A3A3',
  t1: '#111111',
  t2: 'rgba(30,30,30,0.7)',
  t3: 'rgba(30,30,30,0.45)',
  t4: 'rgba(30,30,30,0.4)',
};
