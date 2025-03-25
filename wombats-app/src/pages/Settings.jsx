import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const Settings = () => {
  const { theme, toggleTheme } = useTheme();
  
  const appSpecificColors = Object.entries(theme.colors).filter(
    ([name, _]) => !['rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon', 
                      'peach', 'yellow', 'green', 'teal', 'sky', 'sapphire', 
                      'blue', 'lavender', 'text', 'subtext1', 'subtext0', 
                      'overlay2', 'overlay1', 'overlay0', 'surface2', 'surface1', 
                      'surface0', 'base', 'mantle', 'crust'].includes(name)
  );
  
  // Get all the Catppuccin accent colors
  const accentColors = Object.entries(theme.colors).filter(
    ([name, _]) => ['rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon', 
                   'peach', 'yellow', 'green', 'teal', 'sky', 'sapphire', 
                   'blue', 'lavender'].includes(name)
  );
  
  return (
    <div className="page">
      <h1>Settings</h1>
      
      <div className="settings-section">
        <h2>Display</h2>
        
        <div className="setting-item">
          <div className="setting-label">
            <span>Theme</span>
            <span className="setting-description">
              Choose between {theme.name === 'dark' ? 'Dark' : 'Light'} and {theme.name === 'dark' ? 'Light' : 'Dark'}
            </span>
          </div>
          
          <div className="setting-control">
            <button 
              className={`theme-toggle ${theme.name === 'dark' ? 'dark' : 'light'}`}
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              <div className="toggle-thumb"></div>
              <span className="toggle-text">{theme.displayName}</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="theme-preview">
        <h3>{theme.displayName} Theme</h3>
        
        {/* <div className="color-section">
          <h4>Accent Colors</h4>
          <div className="theme-colors accent-colors">
            {accentColors.map(([name, value]) => (
              <div key={name} className="color-item">
                <div className="color-swatch" style={{ backgroundColor: value }}></div>
                <div className="color-info">
                  <div className="color-name">{name}</div>
                  <div className="color-value">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div> */}
        
        <div className="color-section">
          <h4>App Colors</h4>
          <div className="theme-colors">
            {appSpecificColors.map(([name, value]) => (
              <div key={name} className="color-item">
                <div className="color-swatch" style={{ backgroundColor: value }}></div>
                <div className="color-info">
                  <div className="color-name">{name}</div>
                  <div className="color-value">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;