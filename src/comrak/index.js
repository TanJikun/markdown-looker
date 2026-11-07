// src/comrak/index.js —— comrak wasm 适配层（新版 0.48+，兼容旧版 0.4.x）
// 接口与旧版完全一致：markdownToHTML(md, { extension, parse, render })
import * as wasm from './lib/comrak_wasm.js';

const DEFAULTS = {
  extension: {
    autolink: false, descriptionLists: false, footnotes: false, inlineFootnotes: false,
    frontMatterDelimiter: null, headerIDs: null, strikethrough: false, superscript: false,
    table: false, tagfilter: false, tasklist: false, multilineBlockQuotes: false,
    alerts: false, mathDollars: false, mathCode: false,
    wikilinksTitleBeforePipe: false, wikilinksTitleAfterPipe: false,
    underline: false, subscript: false, spoiler: false, shortcodes: false, greentext: false,
    linkURLRewriter: null, imageURLRewriter: null,
    cjkFriendlyEmphasis: false, subtext: false, highlight: false,
  },
  parse: {
    defaultInfoString: null, smart: false, relaxedTasklistMatching: false,
    tasklistInTable: false, relaxedAutolinks: false, ignoreSetext: false,
    brokenLinkCallback: null, leaveFootnoteDefinitions: false, escapedCharSpans: false,
  },
  render: {
    escape: false, githubPreLang: false, hardbreaks: false, unsafe: false, width: 0,
    fullInfoString: false, listStyle: 'dash', sourcepos: false, escapedCharSpans: false,
    ignoreEmptyLinks: false, gfmQuirks: false, preferFenced: false,
    figureWithCaption: false, tasklistClasses: true, olWidth: 0,
    experimentalMinimizeCommonmark: false,
  },
};

// 兼容旧调用方的 snake_case 选项名
const EXT_ALIASES = {
  math_dollars: 'mathDollars', math_code: 'mathCode',
  description_lists: 'descriptionLists', front_matter_delimiter: 'frontMatterDelimiter',
  header_ids: 'headerIDs', inline_footnotes: 'inlineFootnotes',
};
const PARSE_ALIASES = {
  default_info_string: 'defaultInfoString', relaxed_tasklist_matching: 'relaxedTasklistMatching',
};
const RENDER_ALIASES = {
  github_pre_lang: 'githubPreLang', full_info_string: 'fullInfoString', list_style: 'listStyle',
};

function normalizeSection(obj, aliases) {
  if (!obj) return {};
  const out = { ...obj };
  for (const [snake, camel] of Object.entries(aliases)) {
    if (out[snake] !== undefined) {
      if (out[camel] === undefined) out[camel] = out[snake];
      delete out[snake];
    }
  }
  return out;
}

// 旧版 0.4.x wasm 要求的扁平 snake_case 全字段格式
function toFlatOpts(opts) {
  const e = opts.extension, p = opts.parse, r = opts.render;
  return {
    extension_autolink: e.autolink ?? false,
    extension_description_lists: e.descriptionLists ?? false,
    extension_footnotes: e.footnotes ?? false,
    extension_front_matter_delimiter: e.frontMatterDelimiter ?? '---',
    extension_header_ids: e.headerIDs ?? '',
    extension_strikethrough: e.strikethrough ?? false,
    extension_superscript: e.superscript ?? false,
    extension_table: e.table ?? false,
    extension_tagfilter: e.tagfilter ?? false,
    extension_tasklist: e.tasklist ?? false,
    parse_default_info_string: p.defaultInfoString ?? '',
    parse_smart: p.smart ?? false,
    parse_relaxed_tasklist_matching: p.relaxedTasklistMatching ?? false,
    render_escape: r.escape ?? false,
    render_github_pre_lang: r.githubPreLang ?? false,
    render_hardbreaks: r.hardbreaks ?? false,
    render_unsafe: r.unsafe ?? false,
    render_width: r.width ?? 0,
    render_full_info_string: r.fullInfoString ?? false,
    render_list_style: r.listStyle ?? 'dash',
  };
}

let usingOldLib = null; // null = 未探测；true = 旧版 wasm；false = 新版 wasm

export function markdownToHTML(markdown, options = {}) {
  const opts = {
    extension: { ...DEFAULTS.extension, ...normalizeSection(options.extension, EXT_ALIASES) },
    parse: { ...DEFAULTS.parse, ...normalizeSection(options.parse, PARSE_ALIASES) },
    render: { ...DEFAULTS.render, ...normalizeSection(options.render, RENDER_ALIASES) },
  };
  if (usingOldLib !== true) {
    try {
      const out = wasm.markdown_to_html(markdown, opts, null, null, null, null, null);
      usingOldLib = false;
      return out;
    } catch (e) {
      if (!/missing field/i.test(String((e && e.message) || e))) throw e;
      usingOldLib = true;
      console.warn('[comrak] 检测到旧版 lib/comrak_wasm.js（0.4.x）：sourcepos 与 alerts/math 扩展不可用，滚动同步将退化为比例模式。请用 comrak@0.48+ 的 esm/lib/comrak_wasm.js 替换该文件。');
    }
  }
  return wasm.markdown_to_html(markdown, toFlatOpts(opts));
}
