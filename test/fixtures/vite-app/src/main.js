import { Sarasa_UI_SC } from "sarasa-gothic-webfont/vite";

const sarasaUiSc = Sarasa_UI_SC();
const app = document.querySelector("#app");

document.documentElement.className = sarasaUiSc.className;
app.textContent = "更纱黑体 Vite 构建测试";
