import { Sarasa_UI_SC } from "sarasa-gothic-webfont/next";

const sarasaUiSc = Sarasa_UI_SC();

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className={sarasaUiSc.className}>
      <body>{children}</body>
    </html>
  );
}
