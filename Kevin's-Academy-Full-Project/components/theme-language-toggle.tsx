'use client';

import { Moon, Sun, Globe } from 'lucide-react';
import { useApp } from '@/lib/app-context';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useApp();

  const handleToggle = () => {
    console.log('Theme toggle clicked, current theme:', theme);
    toggleTheme();

    // Force re-render by triggering a state change in parent
    // This will be caught by useEffect in the parent component
    window.dispatchEvent(new CustomEvent('themeChanged'));
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-2 rounded-lg transition-colors ${
        theme === 'light'
          ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          : 'bg-red-900/30 hover:bg-red-800/40 text-red-300'
      }`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5" />
      )}
    </button>
  );
};

export const LanguageToggle = () => {
  const { language, toggleLanguage } = useApp();

  return (
    <button
      onClick={toggleLanguage}
      className={`p-2 rounded-lg transition-colors ${
        language === 'uz'
          ? 'bg-blue-100 hover:bg-blue-200 text-blue-600'
          : 'bg-red-100 hover:bg-red-200 text-red-600'
      }`}
      aria-label={`Switch to ${language === 'uz' ? 'English' : 'Uzbek'}`}
    >
      <Globe className="w-5 h-5" />
      <span className="ml-1 text-sm font-medium">
        {language.toUpperCase()}
      </span>
    </button>
  );
};

export const ThemeLanguageToggle = () => {
  return (
    <div className="flex items-center space-x-2">
      <LanguageToggle />
      <ThemeToggle />
    </div>
  );
};
