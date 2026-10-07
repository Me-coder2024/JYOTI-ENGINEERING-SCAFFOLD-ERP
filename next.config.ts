import type { NextConfig } from 'next';
const config: NextConfig = { outputFileTracingIncludes: { '/api/**': ['./public/branding/*.png'] }, turbopack: { root: process.cwd() }, serverExternalPackages: ['pg', 'exceljs', 'pdf-lib'] };
export default config;
