# 构建配置

## 双入口点打包

```javascript
// esbuild.js
const esbuild = require('esbuild');

async function build() {
  await esbuild.build({
    entryPoints: [
      'src/extension.ts',      // 扩展入口
      'src/server/main.ts'     // 服务器入口
    ],
    bundle: true,
    outdir: 'dist',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    sourcemap: true
  });
}

build();
```

## 打包后目录结构

```
dist/
├── extension.js        # 扩展代码 (运行在 Extension Host)
└── server/
    └── main.js         # 服务器代码 (独立进程运行)
```
