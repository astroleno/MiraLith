import nextVitals from "eslint-config-next/core-web-vitals";

const config = [{ ignores: [".next/**", "next-env.d.ts", "node_modules/**"] }, ...nextVitals];

export default config;
