import { build } from 'esbuild';

build({
  entryPoints: ['./src/app.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  minify: true,
  outdir: './dist',
  target: 'es2020',
  loader: { '.wasm': 'file' },
  publicPath: '/public',
  banner: {
    // 解决 esm 和 cjs 的问题
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
