// Markdown 解析 Worker：把 Comrak 解析从 UI 线程移走
import { markdownToHTML } from './comrak/index.js';

self.onmessage = (e) => {
    const { id, md, options } = e.data;
    const t0 = performance.now();
    try {
        const html = markdownToHTML(md, options);
        const cost = performance.now() - t0;
        self.postMessage({ id, ok: true, html, cost });
    } catch (err) {
        self.postMessage({
            id,
            ok: false,
            error: String((err && err.message) || err),
        });
    }
};