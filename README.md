# sarasa-gothic-webfont

更纱黑体 UI (Sarasa UI) 的 Web 字体包

使用 Unicode Range 拆分 WOFF2 文件，避免浏览器为少量页面文字下载完整中文字体

字体来自 [Sarasa Gothic](https://github.com/be5invis/Sarasa-Gothic)，遵循 SIL Open Font License 1.1

提供的 SC 正体字重:

- 200 (extralight)
- 300 (light)
- 400 (regular)
- 600 (semibold)
- 700 (bold)

## 使用

以下以 `pnpm` 为例：

```bash
pnpm add sarasa-gothic-webfont
```

主入口适用于支持从 JavaScript 导入 CSS 的构建工具，并提供 `className`、`variable` 和 `style`

以 React/Next.js 为例:

```tsx
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

使用 CSS 变量时，将 `sarasaUiSc.variable` 添加到父元素，并通过 `var(--font-sarasa-ui-sc)` 引用字体栈.

JavaScript 入口包含上述全部字重，`font-display` 固定为 `swap`，不接受 `subsets`、`weight` 或 `display` 选项.

不使用 JavaScript 构建入口时，可以直接导入全部字重:

```css
@import "sarasa-gothic-webfont/index.css";

:root {
  font-family: "Sarasa UI SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}
```

也可以只导入需要的字重:

```css
@import "sarasa-gothic-webfont/extralight.css"; /* 200 */
@import "sarasa-gothic-webfont/light.css";      /* 300 */
@import "sarasa-gothic-webfont/regular.css";    /* 400 */
@import "sarasa-gothic-webfont/semibold.css";   /* 600 */
@import "sarasa-gothic-webfont/bold.css";       /* 700 */
```

## 维护

```bash
pnpm install
pnpm run build
pnpm run verify
pnpm pack --dry-run
```

构建脚本会下载 `font-source.json` 指定的官方发行文件，核对 SHA-256 后，仅提取需要的 TTF 字重并生成 WOFF2 分片. 升级字体时，更新该文件中的版本、下载地址和校验值，再重新构建.

## 许可证

- `fonts/` 下的生成 CSS 和 WOFF2 字体使用 SIL Open Font License 1.1.
- 其余原创代码和文档使用 MIT License.

完整授权范围和许可证文本见 [LICENSE](./LICENSE).
