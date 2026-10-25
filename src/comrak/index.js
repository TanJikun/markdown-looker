// @ts-types="./lib/comrak_wasm.d.ts"
import { markdown_to_html } from "./lib/comrak_wasm.js";
/**
 * Render Markdown to HTML.
 *
 * @param markdown The Markdown string to be converted.
 * @param [options] Options to customize the conversion.
 * @returns The generated HTML string.
 * @example
 * ```ts
 * import { markdownToHTML } from "@nick/comrak";
 *
 * markdownToHTML("Hello, **Nick**!");
 * // "<p>Hello, <strong>Nick</strong>!</p>\n"
 * ```
 */ export function markdownToHTML(markdown, options = {}) {
  const { extension = {}, parse = {}, render = {} } = options;
  const opts = {
    extension_autolink: extension.autolink ?? false,
    extension_description_lists: extension.descriptionLists ?? false,
    extension_footnotes: extension.footnotes ?? false,
    extension_front_matter_delimiter: extension.frontMatterDelimiter ?? "---",
    extension_header_ids: extension.headerIDs ?? "",
    extension_strikethrough: extension.strikethrough ?? false,
    extension_superscript: extension.superscript ?? false,
    extension_table: extension.table ?? false,
    extension_tagfilter: extension.tagfilter ?? false,
    extension_tasklist: extension.tasklist ?? false,
    parse_default_info_string: parse.defaultInfoString ?? "",
    parse_smart: parse.smart ?? false,
    parse_relaxed_tasklist_matching: parse.relaxedTasklistMatching ?? false,
    render_escape: render.escape ?? false,
    render_github_pre_lang: render.githubPreLang ?? false,
    render_hardbreaks: render.hardbreaks ?? false,
    render_unsafe: render.unsafe ?? false,
    render_width: render.width ?? 0,
    render_full_info_string: render.fullInfoString ?? false,
    render_list_style: render.listStyle ?? "dash",
  };
  return markdown_to_html(markdown, opts);
}
//# sourceMappingURL=index.js.map
