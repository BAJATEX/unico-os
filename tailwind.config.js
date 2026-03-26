/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        unico: {
          50: "#fff1f1",
          100: "#ffdfdf",
          200: '#fecdd3', 
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: "#E10600", 
          700: "#c50500",
          800: '#9f1239',
          900: "#0f0f10", 
          950: '#4c0519',
        },
        score: {
          red: "#E10600",
          blue: "#003087"
        }
      }
    }
  },
  plugins: [],
};
