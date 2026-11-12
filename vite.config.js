import { defineConfig } from "vite";

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