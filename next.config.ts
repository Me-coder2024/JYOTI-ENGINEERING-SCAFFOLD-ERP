import type { NextConfig } from 'next';
const config: NextConfig = { turbopack: { root: process.cwd() }, serverExternalPackages: ['pg', 'exceljs', 'pdf-lib'] };
export default config;
