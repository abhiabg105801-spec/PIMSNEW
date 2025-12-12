// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  // ✅ Content definition from your first snippet
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}", // Scans all relevant files in src
  ],

  
  theme: {
    // ✅ Theme extensions from your second snippet
    extend: {
      keyframes: {
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(-10px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 1 },
        },
        'glow-bar': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'pulse-slow': 'pulse-slow 1s ease-in-out infinite',
        'glow-bar': 'glow-bar 100s linear infinite',
        'fade-in': 'fade-in 0.8s ease-out',
        'slide-up': 'slide-up 0.8s ease-out',
      },

      
    },
  },
  // ✅ Plugins array (can be empty)
  plugins: [],
}

