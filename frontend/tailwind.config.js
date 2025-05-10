import DaisyUI from 'daisyui';
import TailwindAnimated from 'tailwindcss-animated';

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {},
	},
	plugins: [DaisyUI, TailwindAnimated],
};
