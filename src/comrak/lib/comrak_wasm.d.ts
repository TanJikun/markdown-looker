declare var j: {
    new (g: any): {
        __destroy_into_raw(): number;
        __wbg_ptr: number;
        free(): void;
        resolve: any;
        call(g: any, I: any): any;
    };
};
declare var J: {
    new (g: any, I: any): {
        __destroy_into_raw(): number;
        __wbg_ptr: number;
        free(): void;
    };
};
declare var X: {
    new (g: any, I: any, B: any): {
        __destroy_into_raw(): number;
        __wbg_ptr: number;
        free(): void;
    };
};
declare var v: {
    new (g: any): {
        __destroy_into_raw(): number;
        __wbg_ptr: number;
        free(): void;
        rewriter: any;
        call(g: any, I: any): any;
    };
};
declare function ZA(): any;
declare function q(): any;
declare function QA(): any;
declare function $(): any;
declare function BA(A: any, g: any, I: any, B: any, Z: any, E: any, b: any): any;
declare function IA(A: any, g: any, I: any, B: any, Z: any, E: any, b: any): any;
declare function AA(A: any, g: any, I: any, B: any, Z: any, E: any, b: any): any;
declare function f(A: any, g: any, I: any, B: any, Z: any, E: any, b: any): any;
declare function gA(A: any, g: any, I: any, B: any, Z: any, E: any, b: any): any;
declare function GA(A: any, g: any, I: any, B: any, Z: any, E: any, b: any): any;
declare function CA(A: any, g: any, I: any, B: any, Z: any): any;
declare function _(): any;
export { j as BrokenLinkCallback, J as HeadingAdapter, X as SyntaxHighlighterAdapter, v as URLRewriter, ZA as default_extension_options, q as default_options, QA as default_parse_options, $ as default_render_options, BA as format_commonmark, IA as format_html, AA as format_xml, f as markdown_to_commonmark, gA as markdown_to_html, GA as markdown_to_xml, CA as parse_document, _ as version };
