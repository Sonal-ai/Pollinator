'use client';

import React from 'react';
import { useTheme } from '@/components/theme-provider';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`relative p-2 rounded-full border transition-all duration-300 active:scale-90 ${
        isDark
          ? 'bg-[#12151f]/80 border-yellow-400/25 hover:border-yellow-400/60 text-yellow-300 hover:bg-[#181d2b] shadow-lg shadow-yellow-500/10'
          : 'bg-amber-50/80 border-amber-300/60 hover:border-amber-400 text-amber-700 hover:bg-amber-100 shadow-md shadow-amber-500/10'
      } ${className}`}
      title={isDark ? 'Switch to Honeycomb Light Mode' : 'Switch to Hive Obsidian Mode'}
    >
      <motion.div
        key={theme}
        initial={{ scale: 0.5, rotate: -90, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        exit={{ scale: 0.5, rotate: 90, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex items-center justify-center w-4 h-4"
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-yellow-400 fill-yellow-400/20" />
        ) : (
          <Moon className="w-4 h-4 text-amber-600 fill-amber-600/20" />
        )}
      </motion.div>
    </button>
  );
}
