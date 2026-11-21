/** @type {import('tailwindcss').Config} */
const teal = {
  50: "#f1f7f5",
  100: "#dcebe6",
  200: "#bdd8cf",
  300: "#97bdb1",
  400: "#739f92",
  500: "#5c8579",
  600: "#4b6d64",
  700: "#405a54",
  800: "#384a46",
  900: "#313f3c",
  950: "#192523",
};

const lavender = {
  50: "#f7f4f8",
  100: "#eee8f0",
  200: "#ded3e2",
  300: "#c7b4cf",
  400: "#ab91b7",
  500: "#90749d",
  600: "#795e85",
  700: "#644d6d",
  800: "#53415a",
  900: "#46374b",
  950: "#2b2230",
};

const peach = {
  50: "#faf5f2",
  100: "#f2e7df",
  200: "#e7d2c4",
  300: "#d5b5a2",
  400: "#c49681",
  500: "#b47d67",
  600: "#a26956",
  700: "#875849",
  800: "#704b40",
  900: "#5c4038",
  950: "#30201d",
};

const sage = {
  50: "#f4f7f2",
  100: "#e7ede2",
  200: "#d2ddc9",
  300: "#b4c6a9",
  400: "#94aa86",
  500: "#778f6a",
  600: "#607354",
  700: "#4e5e46",
  800: "#414d3c",
  900: "#374033",
  950: "#1d241b",
};

const sand = {
  50: "#f8f6f1",
  100: "#eee9dc",
  200: "#e1d8c2",
  300: "#cfc09e",
  400: "#b8a47a",
  500: "#a18a61",
  600: "#86714f",
  700: "#6d5c43",
  800: "#5b4e3b",
  900: "#4e4335",
  950: "#29231c",
};

const plum = {
  50: "#faf5f8",
  100: "#f3e9f0",
  200: "#e8d4e1",
  300: "#d6b5cc",
  400: "#bd8eae",
  500: "#9b829a",
  600: "#826b81",
  700: "#6c596d",
  800: "#594a5b",
  900: "#4b3e4d",
  950: "#2b242d",
};

const slate = {
  50: "#fcf9f7",
  100: "#f6f0ed",
  200: "#e9ded8",
  300: "#d3c3bc",
  400: "#ad9992",
  500: "#86736e",
  600: "#685852",
  700: "#51443f",
  800: "#392f30",
  900: "#281f25",
  950: "#181216",
};

export default {
  content: [
    "./frontend/index.html",
    "./frontend/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate,
        indigo: plum,
        violet: plum,
        blue: teal,
        teal,
        sage,
        sand,
        peach,
        red: peach,
        green: sage,
        emerald: sage,
        yellow: sand,
        sky: teal,
        amber: sand,
        rose: peach,
        navy: "#46374b",
        vio: "#795e85",
      },
    },
  },
  plugins: [],
}
