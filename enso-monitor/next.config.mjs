import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Este projeto vive num diretório que contém outros projetos com seus
  // próprios lockfiles; sem isto o Next infere a raiz errada do workspace.
  outputFileTracingRoot: raiz,
};

export default nextConfig;
