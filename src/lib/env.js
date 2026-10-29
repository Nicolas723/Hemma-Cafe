/**
 * Build pública de demostración (GitHub Pages): `npm run build:demo`.
 * Solo ofrece la demo en memoria; nunca lee ni escribe los datos reales del café.
 */
export const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === "true";
