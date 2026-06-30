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
  bg: '#121212', // hsl(0,0%,7%)
  surface: '#2B2B2C', // hsl(240,1%,17%)
  frame: '#212121', // hsl(0,0%,13%)
  divider: '#1C1C1C', // hsl(0,0%,11%)
  hair: '#383838', // hsl(0,0%,22%)
  accent: '#00FFFE', // hsl(182,100%,50%)
  alert: '#B94C4C', // hsl(0,43%,51%)
  disabled: 'rgba(214,214,214,0.22)', // hsla(0,0%,84%,0.22)
  t1: '#F5F5F5', // hsl(0,0%,96%)
  t2: 'rgba(214,214,214,0.7)', // hsla(0,0%,84%,0.7)
  t3: 'rgba(214,214,214,0.45)', // hsla(0,0%,84%,0.45)
  t4: 'rgba(214,214,214,0.4)', // hsla(0,0%,84%,0.4)
};

export const lightTheme: ThemeColors = {
  bg: '#FCFCFC', // hsl(0,0%,99%)
  surface: '#F5F5F5', // hsl(0,0%,96%)
  frame: '#E6E6E6', // hsl(0,0%,90%)
  divider: '#EBEBEB', // hsl(0,0%,92%)
  hair: '#D1D1D1', // hsl(0,0%,82%)
  accent: '#007A82', // hsl(186,95%,32%)
  alert: '#BF2D2D', // hsl(0,62%,47%)
  disabled: 'rgba(30,30,30,0.25)', // hsla(0,0%,0%,0.25)
  t1: '#1C1C1C', // hsl(0,0%,11%)
  t2: 'rgba(30,30,30,0.62)', // hsla(0,0%,0%,0.62)
  t3: 'rgba(30,30,30,0.42)', // hsla(0,0%,0%,0.42)
  t4: 'rgba(30,30,30,0.36)', // hsla(0,0%,0%,0.36)
};
