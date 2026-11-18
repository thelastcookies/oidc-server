import { build } from 'esbuild';

build({
  entryPoints: ['./src/app.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  minify: true,
  // 保留函数/类的原始 name
  // oidc-provider 的 dynamic token 依赖原始类名
  keepNames: true,
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
