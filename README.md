# sarasa-gothic-webfont

更纱黑体 UI（Sarasa UI）的构建期 Web 字体下载器。

npm 包只包含 API、CLI 和带 SHA-256 的字体制品清单。应用构建前根据配置下载所选字重；生成的 CSS 使用 Unicode Range，浏览器仍只请求页面实际使用字符对应的 WOFF2 分片。

字体来自 [Sarasa Gothic](https://github.com/be5invis/Sarasa-Gothic)。

## 安装

```bash
pnpm add sarasa-gothic-webfont
```

## 配置

在项目根目录创建 `sarasa-font.config.mjs`：

```js
import { defineConfig } from "sarasa-gothic-webfont/config";

export default defineConfig({
  outDir: "src/generated/sarasa-fonts",
  families: {
    "ui-sc": {
      weights: [400, 600],
    },
  },
});
```

Sarasa UI SC 提供以下正体字重：200、300、400、600、700。

将生成目录加入项目的 `.gitignore`：

```gitignore
src/generated/sarasa-fonts/
```

在应用构建前准备字体：

```json
{
  "scripts": {
    "fonts": "sarasa-gothic-webfont prepare",
    "predev": "pnpm fonts",
    "prebuild": "pnpm fonts"
  }
}
```

下载缓存默认位于 `node_modules/.cache/sarasa-gothic-webfont`。可通过配置中的 `cacheDir` 改为另一个项目内相对路径。

## 使用

在应用的全局入口导入生成的样式表，然后使用组件式 API：

```tsx
import "@/generated/sarasa-fonts/index.css";
import { Sarasa_UI_SC } from "sarasa-gothic-webfont";

const sarasaUiSc = Sarasa_UI_SC();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={sarasaUiSc.className}>
      <body>{children}</body>
    </html>
  );
}
```

`Sarasa_UI_SC()` 返回 `className`、`variable` 和 `style`。使用 CSS 变量时，将 `variable` 添加到父元素，并通过 `var(--font-sarasa-ui-sc)` 引用字体栈。

Storybook 应导入同一个生成文件：

```tsx
// .storybook/preview.tsx
import "../src/generated/sarasa-fonts/index.css";
```

如果配置文件使用其他名称或位置，可以显式指定：

```bash
sarasa-gothic-webfont prepare --config config/fonts.mjs
```

## 构建行为

- 只下载配置中明确选择的 family 和 weight。
- 每个归档在解包前核对字节数和 SHA-256。
- 缓存校验失败时重新下载，不使用损坏文件。
- 生成目录通过临时目录替换，失败时保留上一次可用输出。
- 不在 `postinstall` 阶段联网，也不修改安装后的包目录。

## 维护

```bash
pnpm install
pnpm run build
pnpm run build:assets
pnpm test
pnpm pack --dry-run
```

`build` 从 `font-source.json` 指定的官方发行文件重建 WOFF2 分片；`build:assets` 为每个字重生成独立归档并更新 `font-assets.json`。发布 npm 版本前，对应的字体归档必须已上传到清单中的 GitHub Release。

## 许可证

- 字体归档和仓库 `fonts/` 下的生成文件使用 SIL Open Font License 1.1。
- 其余原创代码和文档使用 MIT License。

完整授权范围和许可证文本见 [LICENSE](./LICENSE)。
