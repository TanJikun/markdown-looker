export function setupImagePaster(editor, getMdPath) {
    const container = editor.getDomNode();
    if (!container) return;

    container.addEventListener('paste', async (e) => {
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;

        // 1. 优先检查“原位置”：如果剪贴板里有图片路径/链接，直接插入
        const uriList = clipboardData.getData('text/uri-list');
        if (uriList) {
            const urls = uriList.split('\n').map(u => u.trim()).filter(u => u && !u.startsWith('#'));
            if (urls.length > 0) {
                const url = urls[0];
                // 简单判断是不是图片文件格式
                if (/\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(url) || url.startsWith('file://')) {
                    e.preventDefault();
                    e.stopPropagation();
                    insertText(editor, `![图片显示失败](${url})`);
                    return;
                }
            }
        }

        // 2. 处理纯图片数据（截图等）
        const items = clipboardData.items;
        let imageFile = null;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                imageFile = items[i].getAsFile();
                break;
            }
        }

        if (imageFile) {
            e.preventDefault();
            e.stopPropagation();
            await handleImageFile(editor, imageFile, getMdPath());
        }
    }, true); // 使用捕获阶段拦截，防止 Monaco 默认粘贴
}

// 生成带时间戳的文件名
function generateFileName(originalName) {
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');

    const extMatch = originalName.match(/\.([a-z0-9]+)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
    const base = originalName.replace(/\.[^.]+$/, '') || 'image';

    return `${base}_${timestamp}.${ext}`;
}

async function handleImageFile(editor, file, mdPath) {
    const tauri = window.__TAURI__;
    if (!tauri?.core?.invoke) return;

    const fileName = generateFileName(file.name || 'image.png');
    const placeholderId = `upload-${Date.now()}`;
    const placeholder = `![正在上传](正在上传-${placeholderId})`;

    // 插入占位符
    insertText(editor, placeholder);

    try {
        // 读取配置
        const config = await tauri.core.invoke('load_config');

        // 读取文件为 Uint8Array
        const arrayBuffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));

        // 调用后端处理
        const resultUrl = await tauri.core.invoke('save_or_upload_image', {
            config,
            mdPath: mdPath || null,
            fileName,
            bytes
        });

        // 替换占位符
        replacePlaceholder(editor, placeholder, `![图片显示失败](${resultUrl})`);
    } catch (err) {
        console.error('图片处理失败:', err);
        // 失败时替换为提示信息
        replacePlaceholder(editor, placeholder, `![图片显示失败](上传失败: ${String(err)})`);
    }
}

// 在光标处插入文本
function insertText(editor, text) {
    const selection = editor.getSelection();
    const id = { major: 1, minor: 1 };
    const op = { identifier: id, range: selection, text: text, forceMoveMarkers: true };
    editor.executeEdits('image-paste', [op]);
    editor.focus();
}

// 替换占位符
function replacePlaceholder(editor, placeholder, replacement) {
    const model = editor.getModel();
    if (!model) return;

    // 在全文中查找占位符
    const matches = model.findMatches(placeholder, false, false, true, null, false);
    if (matches.length > 0) {
        const range = matches[0].range;
        editor.executeEdits('image-replace', [{
            range: range,
            text: replacement,
            forceMoveMarkers: true
        }]);
    }
}