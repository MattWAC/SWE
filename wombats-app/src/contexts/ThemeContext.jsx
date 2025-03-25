import { createContext, useState, useEffect, useContext } from 'react';

// Define Catppuccin theme colors
// Latte (Light) and Mocha (Dark) themes from Catppuccin
export const themes = {
  light: {
    name: 'light',
    displayName: 'Light',
    colors: {
      // Latte palette
      rosewater: '#dc8a78',
      flamingo: '#dd7878',
      pink: '#ea76cb',
      mauve: '#8839ef',
      red: '#d20f39',
      maroon: '#e64553',
      peach: '#fe640b',
      yellow: '#df8e1d',
      green: '#40a02b',
      teal: '#179299',
      sky: '#04a5e5',
      sapphire: '#209fb5',
      blue: '#1e66f5',
      lavender: '#7287fd',
      
      // Base colors
      text: '#4c4f69',
      subtext1: '#5c5f77',
      subtext0: '#6c6f85',
      overlay2: '#7c7f93',
      overlay1: '#8c8fa1',
      overlay0: '#9ca0b0',
      surface2: '#acb0be',
      surface1: '#bcc0cc',
      surface0: '#ccd0da',
      base: '#eff1f5',
      mantle: '#e6e9ef',
      crust: '#dce0e8',

      // Mapped for our app
      primary: '#1e66f5', // blue
      primaryHover: '#209fb5', // sapphire
      secondary: '#6c6f85', // subtext0
      background: '#eff1f5', // base
      cardBackground: '#ffffff',
      textSecondary: '#5c5f77', // subtext1
      border: '#ccd0da', // surface0
      error: '#d20f39', // red
      success: '#40a02b', // green
      warning: '#df8e1d', // yellow
      info: '#209fb5', // sapphire
      navBackground: '#dce0e8', // crust
      navText: '#4c4f69', // text
    }
  },
  dark: {
    name: 'dark',
    displayName: 'Dark',
    colors: {
      // Mocha palette
      rosewater: '#f5e0dc',
      flamingo: '#f2cdcd',
      pink: '#f5c2e7',
      mauve: '#cba6f7',
      red: '#f38ba8',
      maroon: '#eba0ac',
      peach: '#fab387',
      yellow: '#f9e2af',
      green: '#a6e3a1',
      teal: '#94e2d5',
      sky: '#89dceb',
      sapphire: '#74c7ec',
      blue: '#89b4fa',
      lavender: '#b4befe',
      
      // Base colors
      text: '#cdd6f4',
      subtext1: '#bac2de',
      subtext0: '#a6adc8',
      overlay2: '#9399b2',
      overlay1: '#7f849c',
      overlay0: '#6c7086',
      surface2: '#585b70',
      surface1: '#45475a',
      surface0: '#313244',
      base: '#1e1e2e',
      mantle: '#181825',
      crust: '#11111b',

      // Mapped for our app
      primary: '#89b4fa', // blue
      primaryHover: '#74c7ec', // sapphire
      secondary: '#a6adc8', // subtext0
      background: '#1e1e2e', // base
      cardBackground: '#313244', // surface0
      text: '#cdd6f4', // text
      textSecondary: '#bac2de', // subtext1
      border: '#45475a', // surface1
      error: '#f38ba8', // red
      success: '#a6e3a1', // green
      warning: '#f9e2af', // yellow
      info: '#74c7ec', // sapphire
      navBackground: '#11111b', // crust
      navText: '#cdd6f4', // text
    }
  }
};

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Check if theme preference exists in localStorage
  const savedTheme = localStorage.getItem('theme');
  const [currentTheme, setCurrentTheme] = useState(
    savedTheme === 'dark' ? themes.dark : themes.light
  );

  // Update localStorage when theme changes
  useEffect(() => {
    localStorage.setItem('theme', currentTheme.name);
    
    // Apply theme colors to CSS variables
    const root = document.documentElement;
    Object.entries(currentTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });
  }, [currentTheme]);

  // Toggle between light and dark theme
  const toggleTheme = () => {
    setCurrentTheme(currentTheme.name === 'light' ? themes.dark : themes.light);
  };

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;