const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
    console.error('错误: 请提供版本号，例如: node update-version.cjs 1.1.0');
    process.exit(1);
}

console.log(`\n正在将版本号更新为: ${newVersion}\n`);

function updateJson(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ 找不到文件: ${filePath}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    const updated = content.replace(/("version"\s*:\s*")[^"]+"/, `$1${newVersion}"`);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✅ 已更新: ${filePath}`);
}

function updateToml(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ 找不到文件: ${filePath}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    // 修正了正则：多行匹配用 m 修饰符，而不是 (?m)
    const updated = content.replace(/^(version\s*=\s*")[^"]+"/m, `$1${newVersion}"`);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✅ 已更新: ${filePath}`);
}

updateJson(path.join(__dirname, 'package.json'));
updateToml(path.join(__dirname, 'src-tauri', 'Cargo.toml'));
updateJson(path.join(__dirname, 'src-tauri', 'tauri.conf.json'));

console.log('\n全部处理完毕！');