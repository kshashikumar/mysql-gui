/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { addDynamicIconSelectors } from '@iconify/tailwind';

const TAILWIND_PLUGINS = [
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('postcss-import'),
    require('tailwindcss'),
    require('autoprefixer'),
    require('tailwind-scrollbar'),
];

const CUSTOM_PLUGINS = [addDynamicIconSelectors()];

/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{html,ts}', './projects/**/*.{html,ts}', './src/**/*.{js,jsx,ts,tsx}'],
    darkMode: 'class',
    theme: {
        fontFamily: {
            display: ['Oswald', 'sans-serif'],
            body: ['Poppins', 'sans-serif'],
            mono: ['Menlo', 'Monaco', 'Courier New', 'monospace'],
        },
        container: {
            center: true,
            padding: '1.5rem',
        },
        extend: {},
    },
    plugins: [...TAILWIND_PLUGINS, ...CUSTOM_PLUGINS],
};
