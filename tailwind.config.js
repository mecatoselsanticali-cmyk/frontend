/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
        },
      },
      // Escala del logo en LogoLoader.tsx — animate-pulse de Tailwind ya
      // trae una animación de opacidad, pero acá también hace falta un
      // scale sutil, así que no alcanza sin un keyframe propio.
      keyframes: {
        "logo-pulse": {
          "0%, 100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.08)", opacity: "0.85" },
        },
      },
      animation: {
        "logo-pulse": "logo-pulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
