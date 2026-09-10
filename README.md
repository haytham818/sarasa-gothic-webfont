# sarasa-gothic-webfont

更纱黑体 Sarasa UI SC 的自托管 Web 字体包。目前包含 Regular（400）和 SemiBold（600），并使用 Unicode Range 拆分 WOFF2 文件，避免浏览器为少量页面文字下载完整中文字体。

字体来自 [Sarasa Gothic](https://github.com/be5invis/Sarasa-Gothic)，遵循 SIL Open Font License 1.1。

## 使用

```bash
pnpm add sarasa-gothic-webfont
```

在应用的全局 CSS 中导入全部字重：

```css
@import "sarasa-gothic-webfont";

:root {
  font-family: "Sarasa UI SC", "PingFang SC", "Microsoft YaHei", sans-serif;
}
```

也可以只导入单个字重：

```css
@import "sarasa-gothic-webfont/regular.css";
@import "sarasa-gothic-webfont/semibold.css";
```

## 维护

```bash
pnpm install
pnpm run build
pnpm run verify
pnpm pack --dry-run
```

构建脚本会下载 `font-source.json` 指定的官方发行文件，核对 SHA-256 后，仅提取需要的 TTF 字重并生成 WOFF2 分片。升级字体时，更新该文件中的版本、下载地址和校验值，再重新构建。

## 发布约定

- npm 包版本与上游字体版本分开管理，遵循语义化版本。
- 上游字体或字形内容更新时，至少递增 npm 次版本号。
- 只发布 `package.json` 的 `files` 字段列出的字体、CSS、许可证及来源元数据。
