import fs from 'node:fs';
import path from 'node:path';

const version = process.env.NEXT_RELEASE_VERSION;
if (!version) {
    console.error('NEXT_RELEASE_VERSION 环境变量未设置');
    process.exit(1);
}

// 1. 更新 package.json
const pkgPath = path.resolve('package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 4) + '\n');

// 2. 更新 src-tauri/tauri.conf.json
const tauriConfPath = path.resolve('src-tauri/tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    tauriConf.version = version;
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
}

// 3. 更新 src-tauri/Cargo.toml（简单的正则替换）
const cargoPath = path.resolve('src-tauri/Cargo.toml');
if (fs.existsSync(cargoPath)) {
    let cargo = fs.readFileSync(cargoPath, 'utf8');
    // 只替换 [package] 块下的 version = "x.y.z"
    cargo = cargo.replace(
        /(\[package\][\s\S]*?version\s*=\s*")[^"]*(")/,
        `$1${version}$2`
    );
    fs.writeFileSync(cargoPath, cargo);
}

console.log(`✅ 版本号已同步为 ${version}`);