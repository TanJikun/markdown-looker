import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
    },
    envPrefix: ["VITE_", "TAURI_"],
    build: {
        target: process.env.TAURI_ENV_PLATFORM == "windows" ? "chrome105" : "safari13",
        minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
        rollupOptions: {
            // 双入口：主窗口 + 设置窗口（设置窗口不加载 Monaco/Shiki/Mermaid）
            input: {
                main: fileURLToPath(new URL('./index.html', import.meta.url)),
                settings: fileURLToPath(new URL('./settings.html', import.meta.url)),
            },
            output: {
                manualChunks(id) {
                    const n = id.replaceAll('\\', '/');

                    // 语言 grammar 各自独立成 chunk，保持按需
                    if (n.includes('/@shikijs/langs/')) return;

                    // Shiki 核心 + 引擎 + 主题 + 语言索引统一放一个 chunk
                    if (n.includes('/shiki/') || n.includes('/@shikijs/')) {
                        return 'shiki';
                    }
                },
            },
        },
    },
});