/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary blue (from her buttons, active tabs, links)
        primary: {
          DEFAULT: '#1976D2',
          50: '#E3F2FD',
          100: '#BBDEFB',
          200: '#90CAF9',
          300: '#64B5F6',
          400: '#42A5F5',
          500: '#1976D2',
          600: '#1565C0',
          700: '#0D47A1',
        },
        // Success green (completed, save buttons)
        success: {
          DEFAULT: '#4CAF50',
          50: '#E8F5E9',
          100: '#C8E6C9',
          400: '#66BB6A',
          500: '#4CAF50',
          600: '#43A047',
          700: '#388E3C',
          800: '#2E7D32',
        },
        // Warning amber/orange (pending, dispatched, overdue)
        warning: {
          DEFAULT: '#FF9800',
          50: '#FFF3E0',
          100: '#FFE0B2',
          200: '#FFB74D',
          400: '#FFA726',
          500: '#FF9800',
          600: '#FB8C00',
          700: '#E65100',
        },
        // Danger red (cancelled, reject)
        danger: {
          DEFAULT: '#F44336',
          50: '#FFEBEE',
          100: '#FFCDD2',
          200: '#EF9A9A',
          500: '#F44336',
          600: '#E53935',
          700: '#D32F2F',
          800: '#C62828',
        },
        // Teal (created status)
        teal: {
          DEFAULT: '#00796B',
          50: '#E0F2F1',
          100: '#B2DFDB',
          300: '#80CBC4',
          500: '#009688',
          600: '#00897B',
          700: '#00796B',
        },
        // Purple/lavender (vehicle assignment pending, special statuses)
        purple: {
          DEFAULT: '#7B1FA2',
          50: '#F3E5F5',
          100: '#E1BEE7',
          300: '#CE93D8',
          500: '#9C27B0',
          700: '#7B1FA2',
        },
        // Amber/golden (milk run badge, in progress)
        amber: {
          DEFAULT: '#FFC107',
          50: '#FFF8E1',
          100: '#FFECB3',
          300: '#FFD54F',
          500: '#FFC107',
          700: '#F57F17',
        },
        // Coral (dispatched status)
        coral: {
          DEFAULT: '#D84315',
          50: '#FBE9E7',
          200: '#FF8A65',
          500: '#FF5722',
          700: '#D84315',
        },
        gray: {
          DEFAULT: '#616161',
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#EEEEEE',
          300: '#E0E0E0',
          400: '#BDBDBD',
          500: '#9E9E9E',
          600: '#757575',
          700: '#616161',
          800: '#424242',
          900: '#212121',
        },
        background: '#F5F5F5',
        card: '#FFFFFF',
        'text-primary': '#212121',
        'text-secondary': '#424242',
        'text-muted': '#757575',
        'table-header': '#FFF8E1',
        'navy': '#1A237E',
        'link': '#1976D2',
      },
    },
  },
  plugins: [],
}
