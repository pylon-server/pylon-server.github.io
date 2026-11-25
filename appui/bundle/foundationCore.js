/* Safe browser persistence for AppUI services and components. */
var AppUIStorage = window.AppUIStorage || (function() {
  function get(key, fallback = null) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) { return fallback; }
  }

  function set(key, value) {
    try { localStorage.setItem(key, String(value)); return true; }
    catch (_) { return false; }
  }

  function remove(key) {
    try { localStorage.removeItem(key); return true; }
    catch (_) { return false; }
  }

  function getJSON(key, fallback = null) {
    const value = get(key, null);
    if (value === null) return fallback;
    try { return JSON.parse(value); }
    catch (_) { return fallback; }
  }

  function setJSON(key, value) {
    try { return set(key, JSON.stringify(value)); }
    catch (_) { return false; }
  }

  function keys(prefix = '') {
    const result = [];
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key && key.startsWith(prefix)) result.push(key);
      }
    } catch (_) {}
    return result;
  }

  const session = {
    getCached(key, ttl = 60000, fallback = null) {
      try {
        const entry = JSON.parse(sessionStorage.getItem(key));
        if (!entry || !Number.isFinite(entry.ts) || !Number.isFinite(ttl) || ttl < 0
            || Date.now() - entry.ts > ttl || entry.data === undefined) return fallback;
        return entry.data;
      } catch (_) { return fallback; }
    },
    setCached(key, data) {
      try {
        sessionStorage.setItem(key, JSON.stringify({ts: Date.now(), data}));
        return true;
      } catch (_) { return false; }
    },
  };

  return {get, set, remove, getJSON, setJSON, keys, session};
})();
window.AppUIStorage = AppUIStorage;

;
/* AppUI theme service: keeps the shell's theme state in sync.
   Supports per-page theme overrides (stored separately from global preference). */
var AppUITheme = window.AppUITheme || (function() {
  const storageKey = 'appui-theme';
  const _pageName = (window.location.pathname.match(/\/pages\/([^/]+)/) || [])[1] || '';
  const _pageKey = _pageName ? 'appui-theme-' + _pageName : '';

  function get() {
    // Per-page override takes priority
    if (_pageKey) {
      var pageTheme = AppUIStorage.get(_pageKey);
      if (pageTheme) return pageTheme;
    }
    return document.documentElement.getAttribute('data-theme')
      || document.documentElement.dataset.theme
      || AppUIStorage.get(storageKey)
      || AppUIStorage.get('ui-theme')
      || 'light';
  }

  function set(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    AppUIStorage.set(storageKey, next);
    return next;
  }

  function setForPage(theme) {
    const next = theme === 'light' ? 'light' : 'dark';
    if (_pageKey) AppUIStorage.set(_pageKey, next);
    return set(next);
  }

  function clearPageOverride() {
    if (_pageKey) AppUIStorage.remove(_pageKey);
  }

  function restore() {
    // Check per-page override first
    if (_pageKey) {
      var pageTheme = AppUIStorage.get(_pageKey);
      if (pageTheme) return set(pageTheme);
    }
    const saved = AppUIStorage.get(storageKey) || AppUIStorage.get('ui-theme');
    return set(saved || 'light');
  }

  function toggle() {
    const next = get() === 'dark' ? 'light' : 'dark';
    if (_pageKey) AppUIStorage.set(_pageKey, next);
    return set(next);
  }

  return {get, set, setForPage, clearPageOverride, restore, toggle, pageName: _pageName};
})();
window.AppUITheme = AppUITheme;

;
/**
 * marked v12.0.2 - a markdown parser
 * Copyright (c) 2011-2024, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/markedjs/marked
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?t(exports):"function"==typeof define&&define.amd?define(["exports"],t):t((e="undefined"!=typeof globalThis?globalThis:e||self).marked={})}(this,(function(e){"use strict";function t(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}function n(t){e.defaults=t}e.defaults={async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null};const s=/[&<>"']/,r=new RegExp(s.source,"g"),i=/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,l=new RegExp(i.source,"g"),o={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},a=e=>o[e];function c(e,t){if(t){if(s.test(e))return e.replace(r,a)}else if(i.test(e))return e.replace(l,a);return e}const h=/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/gi;function p(e){return e.replace(h,((e,t)=>"colon"===(t=t.toLowerCase())?":":"#"===t.charAt(0)?"x"===t.charAt(1)?String.fromCharCode(parseInt(t.substring(2),16)):String.fromCharCode(+t.substring(1)):""))}const u=/(^|[^\[])\^/g;function k(e,t){let n="string"==typeof e?e:e.source;t=t||"";const s={replace:(e,t)=>{let r="string"==typeof t?t:t.source;return r=r.replace(u,"$1"),n=n.replace(e,r),s},getRegex:()=>new RegExp(n,t)};return s}function g(e){try{e=encodeURI(e).replace(/%25/g,"%")}catch(e){return null}return e}const f={exec:()=>null};function d(e,t){const n=e.replace(/\|/g,((e,t,n)=>{let s=!1,r=t;for(;--r>=0&&"\\"===n[r];)s=!s;return s?"|":" |"})).split(/ \|/);let s=0;if(n[0].trim()||n.shift(),n.length>0&&!n[n.length-1].trim()&&n.pop(),t)if(n.length>t)n.splice(t);else for(;n.length<t;)n.push("");for(;s<n.length;s++)n[s]=n[s].trim().replace(/\\\|/g,"|");return n}function x(e,t,n){const s=e.length;if(0===s)return"";let r=0;for(;r<s;){const i=e.charAt(s-r-1);if(i!==t||n){if(i===t||!n)break;r++}else r++}return e.slice(0,s-r)}function b(e,t,n,s){const r=t.href,i=t.title?c(t.title):null,l=e[1].replace(/\\([\[\]])/g,"$1");if("!"!==e[0].charAt(0)){s.state.inLink=!0;const e={type:"link",raw:n,href:r,title:i,text:l,tokens:s.inlineTokens(l)};return s.state.inLink=!1,e}return{type:"image",raw:n,href:r,title:i,text:c(l)}}class w{options;rules;lexer;constructor(t){this.options=t||e.defaults}space(e){const t=this.rules.block.newline.exec(e);if(t&&t[0].length>0)return{type:"space",raw:t[0]}}code(e){const t=this.rules.block.code.exec(e);if(t){const e=t[0].replace(/^ {1,4}/gm,"");return{type:"code",raw:t[0],codeBlockStyle:"indented",text:this.options.pedantic?e:x(e,"\n")}}}fences(e){const t=this.rules.block.fences.exec(e);if(t){const e=t[0],n=function(e,t){const n=e.match(/^(\s+)(?:```)/);if(null===n)return t;const s=n[1];return t.split("\n").map((e=>{const t=e.match(/^\s+/);if(null===t)return e;const[n]=t;return n.length>=s.length?e.slice(s.length):e})).join("\n")}(e,t[3]||"");return{type:"code",raw:e,lang:t[2]?t[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):t[2],text:n}}}heading(e){const t=this.rules.block.heading.exec(e);if(t){let e=t[2].trim();if(/#$/.test(e)){const t=x(e,"#");this.options.pedantic?e=t.trim():t&&!/ $/.test(t)||(e=t.trim())}return{type:"heading",raw:t[0],depth:t[1].length,text:e,tokens:this.lexer.inline(e)}}}hr(e){const t=this.rules.block.hr.exec(e);if(t)return{type:"hr",raw:t[0]}}blockquote(e){const t=this.rules.block.blockquote.exec(e);if(t){let e=t[0].replace(/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,"\n    $1");e=x(e.replace(/^ *>[ \t]?/gm,""),"\n");const n=this.lexer.state.top;this.lexer.state.top=!0;const s=this.lexer.blockTokens(e);return this.lexer.state.top=n,{type:"blockquote",raw:t[0],tokens:s,text:e}}}list(e){let t=this.rules.block.list.exec(e);if(t){let n=t[1].trim();const s=n.length>1,r={type:"list",raw:"",ordered:s,start:s?+n.slice(0,-1):"",loose:!1,items:[]};n=s?`\\d{1,9}\\${n.slice(-1)}`:`\\${n}`,this.options.pedantic&&(n=s?n:"[*+-]");const i=new RegExp(`^( {0,3}${n})((?:[\t ][^\\n]*)?(?:\\n|$))`);let l="",o="",a=!1;for(;e;){let n=!1;if(!(t=i.exec(e)))break;if(this.rules.block.hr.test(e))break;l=t[0],e=e.substring(l.length);let s=t[2].split("\n",1)[0].replace(/^\t+/,(e=>" ".repeat(3*e.length))),c=e.split("\n",1)[0],h=0;this.options.pedantic?(h=2,o=s.trimStart()):(h=t[2].search(/[^ ]/),h=h>4?1:h,o=s.slice(h),h+=t[1].length);let p=!1;if(!s&&/^ *$/.test(c)&&(l+=c+"\n",e=e.substring(c.length+1),n=!0),!n){const t=new RegExp(`^ {0,${Math.min(3,h-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`),n=new RegExp(`^ {0,${Math.min(3,h-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),r=new RegExp(`^ {0,${Math.min(3,h-1)}}(?:\`\`\`|~~~)`),i=new RegExp(`^ {0,${Math.min(3,h-1)}}#`);for(;e;){const a=e.split("\n",1)[0];if(c=a,this.options.pedantic&&(c=c.replace(/^ {1,4}(?=( {4})*[^ ])/g,"  ")),r.test(c))break;if(i.test(c))break;if(t.test(c))break;if(n.test(e))break;if(c.search(/[^ ]/)>=h||!c.trim())o+="\n"+c.slice(h);else{if(p)break;if(s.search(/[^ ]/)>=4)break;if(r.test(s))break;if(i.test(s))break;if(n.test(s))break;o+="\n"+c}p||c.trim()||(p=!0),l+=a+"\n",e=e.substring(a.length+1),s=c.slice(h)}}r.loose||(a?r.loose=!0:/\n *\n *$/.test(l)&&(a=!0));let u,k=null;this.options.gfm&&(k=/^\[[ xX]\] /.exec(o),k&&(u="[ ] "!==k[0],o=o.replace(/^\[[ xX]\] +/,""))),r.items.push({type:"list_item",raw:l,task:!!k,checked:u,loose:!1,text:o,tokens:[]}),r.raw+=l}r.items[r.items.length-1].raw=l.trimEnd(),r.items[r.items.length-1].text=o.trimEnd(),r.raw=r.raw.trimEnd();for(let e=0;e<r.items.length;e++)if(this.lexer.state.top=!1,r.items[e].tokens=this.lexer.blockTokens(r.items[e].text,[]),!r.loose){const t=r.items[e].tokens.filter((e=>"space"===e.type)),n=t.length>0&&t.some((e=>/\n.*\n/.test(e.raw)));r.loose=n}if(r.loose)for(let e=0;e<r.items.length;e++)r.items[e].loose=!0;return r}}html(e){const t=this.rules.block.html.exec(e);if(t){return{type:"html",block:!0,raw:t[0],pre:"pre"===t[1]||"script"===t[1]||"style"===t[1],text:t[0]}}}def(e){const t=this.rules.block.def.exec(e);if(t){const e=t[1].toLowerCase().replace(/\s+/g," "),n=t[2]?t[2].replace(/^<(.*)>$/,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",s=t[3]?t[3].substring(1,t[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):t[3];return{type:"def",tag:e,raw:t[0],href:n,title:s}}}table(e){const t=this.rules.block.table.exec(e);if(!t)return;if(!/[:|]/.test(t[2]))return;const n=d(t[1]),s=t[2].replace(/^\||\| *$/g,"").split("|"),r=t[3]&&t[3].trim()?t[3].replace(/\n[ \t]*$/,"").split("\n"):[],i={type:"table",raw:t[0],header:[],align:[],rows:[]};if(n.length===s.length){for(const e of s)/^ *-+: *$/.test(e)?i.align.push("right"):/^ *:-+: *$/.test(e)?i.align.push("center"):/^ *:-+ *$/.test(e)?i.align.push("left"):i.align.push(null);for(const e of n)i.header.push({text:e,tokens:this.lexer.inline(e)});for(const e of r)i.rows.push(d(e,i.header.length).map((e=>({text:e,tokens:this.lexer.inline(e)}))));return i}}lheading(e){const t=this.rules.block.lheading.exec(e);if(t)return{type:"heading",raw:t[0],depth:"="===t[2].charAt(0)?1:2,text:t[1],tokens:this.lexer.inline(t[1])}}paragraph(e){const t=this.rules.block.paragraph.exec(e);if(t){const e="\n"===t[1].charAt(t[1].length-1)?t[1].slice(0,-1):t[1];return{type:"paragraph",raw:t[0],text:e,tokens:this.lexer.inline(e)}}}text(e){const t=this.rules.block.text.exec(e);if(t)return{type:"text",raw:t[0],text:t[0],tokens:this.lexer.inline(t[0])}}escape(e){const t=this.rules.inline.escape.exec(e);if(t)return{type:"escape",raw:t[0],text:c(t[1])}}tag(e){const t=this.rules.inline.tag.exec(e);if(t)return!this.lexer.state.inLink&&/^<a /i.test(t[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&/^<\/a>/i.test(t[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&/^<(pre|code|kbd|script)(\s|>)/i.test(t[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&/^<\/(pre|code|kbd|script)(\s|>)/i.test(t[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:t[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:t[0]}}link(e){const t=this.rules.inline.link.exec(e);if(t){const e=t[2].trim();if(!this.options.pedantic&&/^</.test(e)){if(!/>$/.test(e))return;const t=x(e.slice(0,-1),"\\");if((e.length-t.length)%2==0)return}else{const e=function(e,t){if(-1===e.indexOf(t[1]))return-1;let n=0;for(let s=0;s<e.length;s++)if("\\"===e[s])s++;else if(e[s]===t[0])n++;else if(e[s]===t[1]&&(n--,n<0))return s;return-1}(t[2],"()");if(e>-1){const n=(0===t[0].indexOf("!")?5:4)+t[1].length+e;t[2]=t[2].substring(0,e),t[0]=t[0].substring(0,n).trim(),t[3]=""}}let n=t[2],s="";if(this.options.pedantic){const e=/^([^'"]*[^\s])\s+(['"])(.*)\2/.exec(n);e&&(n=e[1],s=e[3])}else s=t[3]?t[3].slice(1,-1):"";return n=n.trim(),/^</.test(n)&&(n=this.options.pedantic&&!/>$/.test(e)?n.slice(1):n.slice(1,-1)),b(t,{href:n?n.replace(this.rules.inline.anyPunctuation,"$1"):n,title:s?s.replace(this.rules.inline.anyPunctuation,"$1"):s},t[0],this.lexer)}}reflink(e,t){let n;if((n=this.rules.inline.reflink.exec(e))||(n=this.rules.inline.nolink.exec(e))){const e=t[(n[2]||n[1]).replace(/\s+/g," ").toLowerCase()];if(!e){const e=n[0].charAt(0);return{type:"text",raw:e,text:e}}return b(n,e,n[0],this.lexer)}}emStrong(e,t,n=""){let s=this.rules.inline.emStrongLDelim.exec(e);if(!s)return;if(s[3]&&n.match(/[\p{L}\p{N}]/u))return;if(!(s[1]||s[2]||"")||!n||this.rules.inline.punctuation.exec(n)){const n=[...s[0]].length-1;let r,i,l=n,o=0;const a="*"===s[0][0]?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(a.lastIndex=0,t=t.slice(-1*e.length+n);null!=(s=a.exec(t));){if(r=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!r)continue;if(i=[...r].length,s[3]||s[4]){l+=i;continue}if((s[5]||s[6])&&n%3&&!((n+i)%3)){o+=i;continue}if(l-=i,l>0)continue;i=Math.min(i,i+l+o);const t=[...s[0]][0].length,a=e.slice(0,n+s.index+t+i);if(Math.min(n,i)%2){const e=a.slice(1,-1);return{type:"em",raw:a,text:e,tokens:this.lexer.inlineTokens(e)}}const c=a.slice(2,-2);return{type:"strong",raw:a,text:c,tokens:this.lexer.inlineTokens(c)}}}}codespan(e){const t=this.rules.inline.code.exec(e);if(t){let e=t[2].replace(/\n/g," ");const n=/[^ ]/.test(e),s=/^ /.test(e)&&/ $/.test(e);return n&&s&&(e=e.substring(1,e.length-1)),e=c(e,!0),{type:"codespan",raw:t[0],text:e}}}br(e){const t=this.rules.inline.br.exec(e);if(t)return{type:"br",raw:t[0]}}del(e){const t=this.rules.inline.del.exec(e);if(t)return{type:"del",raw:t[0],text:t[2],tokens:this.lexer.inlineTokens(t[2])}}autolink(e){const t=this.rules.inline.autolink.exec(e);if(t){let e,n;return"@"===t[2]?(e=c(t[1]),n="mailto:"+e):(e=c(t[1]),n=e),{type:"link",raw:t[0],text:e,href:n,tokens:[{type:"text",raw:e,text:e}]}}}url(e){let t;if(t=this.rules.inline.url.exec(e)){let e,n;if("@"===t[2])e=c(t[0]),n="mailto:"+e;else{let s;do{s=t[0],t[0]=this.rules.inline._backpedal.exec(t[0])?.[0]??""}while(s!==t[0]);e=c(t[0]),n="www."===t[1]?"http://"+t[0]:t[0]}return{type:"link",raw:t[0],text:e,href:n,tokens:[{type:"text",raw:e,text:e}]}}}inlineText(e){const t=this.rules.inline.text.exec(e);if(t){let e;return e=this.lexer.state.inRawBlock?t[0]:c(t[0]),{type:"text",raw:t[0],text:e}}}}const m=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,y=/(?:[*+-]|\d{1,9}[.)])/,$=k(/^(?!bull |blockCode|fences|blockquote|heading|html)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html))+?)\n {0,3}(=+|-+) *(?:\n+|$)/).replace(/bull/g,y).replace(/blockCode/g,/ {4}/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).getRegex(),z=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,T=/(?!\s*\])(?:\\.|[^\[\]\\])+/,R=k(/^ {0,3}\[(label)\]: *(?:\n *)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n *)?| *\n *)(title))? *(?:\n+|$)/).replace("label",T).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),_=k(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,y).getRegex(),A="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",S=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,I=k("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n *)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n *)+\\n|$))","i").replace("comment",S).replace("tag",A).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),E=k(z).replace("hr",m).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",A).getRegex(),q={blockquote:k(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",E).getRegex(),code:/^( {4}[^\n]+(?:\n(?: *(?:\n|$))*)?)+/,def:R,fences:/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,heading:/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,hr:m,html:I,lheading:$,list:_,newline:/^(?: *(?:\n|$))+/,paragraph:E,table:f,text:/^[^\n]+/},Z=k("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",m).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code"," {4}[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",A).getRegex(),L={...q,table:Z,paragraph:k(z).replace("hr",m).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",Z).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",A).getRegex()},P={...q,html:k("^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:\"[^\"]*\"|'[^']*'|\\s[^'\"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))").replace("comment",S).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:f,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:k(z).replace("hr",m).replace("heading"," *#{1,6} *[^\n]").replace("lheading",$).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},Q=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,v=/^( {2,}|\\)\n(?!\s*$)/,B="\\p{P}\\p{S}",C=k(/^((?![*_])[\spunctuation])/,"u").replace(/punctuation/g,B).getRegex(),M=k(/^(?:\*+(?:((?!\*)[punct])|[^\s*]))|^_+(?:((?!_)[punct])|([^\s_]))/,"u").replace(/punct/g,B).getRegex(),O=k("^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)[punct](\\*+)(?=[\\s]|$)|[^punct\\s](\\*+)(?!\\*)(?=[punct\\s]|$)|(?!\\*)[punct\\s](\\*+)(?=[^punct\\s])|[\\s](\\*+)(?!\\*)(?=[punct])|(?!\\*)[punct](\\*+)(?!\\*)(?=[punct])|[^punct\\s](\\*+)(?=[^punct\\s])","gu").replace(/punct/g,B).getRegex(),D=k("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)[punct](_+)(?=[\\s]|$)|[^punct\\s](_+)(?!_)(?=[punct\\s]|$)|(?!_)[punct\\s](_+)(?=[^punct\\s])|[\\s](_+)(?!_)(?=[punct])|(?!_)[punct](_+)(?!_)(?=[punct])","gu").replace(/punct/g,B).getRegex(),j=k(/\\([punct])/,"gu").replace(/punct/g,B).getRegex(),H=k(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),U=k(S).replace("(?:--\x3e|$)","--\x3e").getRegex(),X=k("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",U).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),F=/(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/,N=k(/^!?\[(label)\]\(\s*(href)(?:\s+(title))?\s*\)/).replace("label",F).replace("href",/<(?:\\.|[^\n<>\\])+>|[^\s\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),G=k(/^!?\[(label)\]\[(ref)\]/).replace("label",F).replace("ref",T).getRegex(),J=k(/^!?\[(ref)\](?:\[\])?/).replace("ref",T).getRegex(),K={_backpedal:f,anyPunctuation:j,autolink:H,blockSkip:/\[[^[\]]*?\]\([^\(\)]*?\)|`[^`]*?`|<[^<>]*?>/g,br:v,code:/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,del:f,emStrongLDelim:M,emStrongRDelimAst:O,emStrongRDelimUnd:D,escape:Q,link:N,nolink:J,punctuation:C,reflink:G,reflinkSearch:k("reflink|nolink(?!\\()","g").replace("reflink",G).replace("nolink",J).getRegex(),tag:X,text:/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,url:f},V={...K,link:k(/^!?\[(label)\]\((.*?)\)/).replace("label",F).getRegex(),reflink:k(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",F).getRegex()},W={...K,escape:k(Q).replace("])","~|])").getRegex(),url:k(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/,"i").replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])([\s\S]*?[^\s~])\1(?=[^~]|$)/,text:/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/},Y={...W,br:k(v).replace("{2,}","*").getRegex(),text:k(W.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},ee={normal:q,gfm:L,pedantic:P},te={normal:K,gfm:W,breaks:Y,pedantic:V};class ne{tokens;options;state;tokenizer;inlineQueue;constructor(t){this.tokens=[],this.tokens.links=Object.create(null),this.options=t||e.defaults,this.options.tokenizer=this.options.tokenizer||new w,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};const n={block:ee.normal,inline:te.normal};this.options.pedantic?(n.block=ee.pedantic,n.inline=te.pedantic):this.options.gfm&&(n.block=ee.gfm,this.options.breaks?n.inline=te.breaks:n.inline=te.gfm),this.tokenizer.rules=n}static get rules(){return{block:ee,inline:te}}static lex(e,t){return new ne(t).lex(e)}static lexInline(e,t){return new ne(t).inlineTokens(e)}lex(e){e=e.replace(/\r\n|\r/g,"\n"),this.blockTokens(e,this.tokens);for(let e=0;e<this.inlineQueue.length;e++){const t=this.inlineQueue[e];this.inlineTokens(t.src,t.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[]){let n,s,r,i;for(e=this.options.pedantic?e.replace(/\t/g,"    ").replace(/^ +$/gm,""):e.replace(/^( *)(\t+)/gm,((e,t,n)=>t+"    ".repeat(n.length)));e;)if(!(this.options.extensions&&this.options.extensions.block&&this.options.extensions.block.some((s=>!!(n=s.call({lexer:this},e,t))&&(e=e.substring(n.raw.length),t.push(n),!0)))))if(n=this.tokenizer.space(e))e=e.substring(n.raw.length),1===n.raw.length&&t.length>0?t[t.length-1].raw+="\n":t.push(n);else if(n=this.tokenizer.code(e))e=e.substring(n.raw.length),s=t[t.length-1],!s||"paragraph"!==s.type&&"text"!==s.type?t.push(n):(s.raw+="\n"+n.raw,s.text+="\n"+n.text,this.inlineQueue[this.inlineQueue.length-1].src=s.text);else if(n=this.tokenizer.fences(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.heading(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.hr(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.blockquote(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.list(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.html(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.def(e))e=e.substring(n.raw.length),s=t[t.length-1],!s||"paragraph"!==s.type&&"text"!==s.type?this.tokens.links[n.tag]||(this.tokens.links[n.tag]={href:n.href,title:n.title}):(s.raw+="\n"+n.raw,s.text+="\n"+n.raw,this.inlineQueue[this.inlineQueue.length-1].src=s.text);else if(n=this.tokenizer.table(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.lheading(e))e=e.substring(n.raw.length),t.push(n);else{if(r=e,this.options.extensions&&this.options.extensions.startBlock){let t=1/0;const n=e.slice(1);let s;this.options.extensions.startBlock.forEach((e=>{s=e.call({lexer:this},n),"number"==typeof s&&s>=0&&(t=Math.min(t,s))})),t<1/0&&t>=0&&(r=e.substring(0,t+1))}if(this.state.top&&(n=this.tokenizer.paragraph(r)))s=t[t.length-1],i&&"paragraph"===s.type?(s.raw+="\n"+n.raw,s.text+="\n"+n.text,this.inlineQueue.pop(),this.inlineQueue[this.inlineQueue.length-1].src=s.text):t.push(n),i=r.length!==e.length,e=e.substring(n.raw.length);else if(n=this.tokenizer.text(e))e=e.substring(n.raw.length),s=t[t.length-1],s&&"text"===s.type?(s.raw+="\n"+n.raw,s.text+="\n"+n.text,this.inlineQueue.pop(),this.inlineQueue[this.inlineQueue.length-1].src=s.text):t.push(n);else if(e){const t="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(t);break}throw new Error(t)}}return this.state.top=!0,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}inlineTokens(e,t=[]){let n,s,r,i,l,o,a=e;if(this.tokens.links){const e=Object.keys(this.tokens.links);if(e.length>0)for(;null!=(i=this.tokenizer.rules.inline.reflinkSearch.exec(a));)e.includes(i[0].slice(i[0].lastIndexOf("[")+1,-1))&&(a=a.slice(0,i.index)+"["+"a".repeat(i[0].length-2)+"]"+a.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;null!=(i=this.tokenizer.rules.inline.blockSkip.exec(a));)a=a.slice(0,i.index)+"["+"a".repeat(i[0].length-2)+"]"+a.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);for(;null!=(i=this.tokenizer.rules.inline.anyPunctuation.exec(a));)a=a.slice(0,i.index)+"++"+a.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);for(;e;)if(l||(o=""),l=!1,!(this.options.extensions&&this.options.extensions.inline&&this.options.extensions.inline.some((s=>!!(n=s.call({lexer:this},e,t))&&(e=e.substring(n.raw.length),t.push(n),!0)))))if(n=this.tokenizer.escape(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.tag(e))e=e.substring(n.raw.length),s=t[t.length-1],s&&"text"===n.type&&"text"===s.type?(s.raw+=n.raw,s.text+=n.text):t.push(n);else if(n=this.tokenizer.link(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.reflink(e,this.tokens.links))e=e.substring(n.raw.length),s=t[t.length-1],s&&"text"===n.type&&"text"===s.type?(s.raw+=n.raw,s.text+=n.text):t.push(n);else if(n=this.tokenizer.emStrong(e,a,o))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.codespan(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.br(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.del(e))e=e.substring(n.raw.length),t.push(n);else if(n=this.tokenizer.autolink(e))e=e.substring(n.raw.length),t.push(n);else if(this.state.inLink||!(n=this.tokenizer.url(e))){if(r=e,this.options.extensions&&this.options.extensions.startInline){let t=1/0;const n=e.slice(1);let s;this.options.extensions.startInline.forEach((e=>{s=e.call({lexer:this},n),"number"==typeof s&&s>=0&&(t=Math.min(t,s))})),t<1/0&&t>=0&&(r=e.substring(0,t+1))}if(n=this.tokenizer.inlineText(r))e=e.substring(n.raw.length),"_"!==n.raw.slice(-1)&&(o=n.raw.slice(-1)),l=!0,s=t[t.length-1],s&&"text"===s.type?(s.raw+=n.raw,s.text+=n.text):t.push(n);else if(e){const t="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(t);break}throw new Error(t)}}else e=e.substring(n.raw.length),t.push(n);return t}}class se{options;constructor(t){this.options=t||e.defaults}code(e,t,n){const s=(t||"").match(/^\S*/)?.[0];return e=e.replace(/\n$/,"")+"\n",s?'<pre><code class="language-'+c(s)+'">'+(n?e:c(e,!0))+"</code></pre>\n":"<pre><code>"+(n?e:c(e,!0))+"</code></pre>\n"}blockquote(e){return`<blockquote>\n${e}</blockquote>\n`}html(e,t){return e}heading(e,t,n){return`<h${t}>${e}</h${t}>\n`}hr(){return"<hr>\n"}list(e,t,n){const s=t?"ol":"ul";return"<"+s+(t&&1!==n?' start="'+n+'"':"")+">\n"+e+"</"+s+">\n"}listitem(e,t,n){return`<li>${e}</li>\n`}checkbox(e){return"<input "+(e?'checked="" ':"")+'disabled="" type="checkbox">'}paragraph(e){return`<p>${e}</p>\n`}table(e,t){return t&&(t=`<tbody>${t}</tbody>`),"<table>\n<thead>\n"+e+"</thead>\n"+t+"</table>\n"}tablerow(e){return`<tr>\n${e}</tr>\n`}tablecell(e,t){const n=t.header?"th":"td";return(t.align?`<${n} align="${t.align}">`:`<${n}>`)+e+`</${n}>\n`}strong(e){return`<strong>${e}</strong>`}em(e){return`<em>${e}</em>`}codespan(e){return`<code>${e}</code>`}br(){return"<br>"}del(e){return`<del>${e}</del>`}link(e,t,n){const s=g(e);if(null===s)return n;let r='<a href="'+(e=s)+'"';return t&&(r+=' title="'+t+'"'),r+=">"+n+"</a>",r}image(e,t,n){const s=g(e);if(null===s)return n;let r=`<img src="${e=s}" alt="${n}"`;return t&&(r+=` title="${t}"`),r+=">",r}text(e){return e}}class re{strong(e){return e}em(e){return e}codespan(e){return e}del(e){return e}html(e){return e}text(e){return e}link(e,t,n){return""+n}image(e,t,n){return""+n}br(){return""}}class ie{options;renderer;textRenderer;constructor(t){this.options=t||e.defaults,this.options.renderer=this.options.renderer||new se,this.renderer=this.options.renderer,this.renderer.options=this.options,this.textRenderer=new re}static parse(e,t){return new ie(t).parse(e)}static parseInline(e,t){return new ie(t).parseInline(e)}parse(e,t=!0){let n="";for(let s=0;s<e.length;s++){const r=e[s];if(this.options.extensions&&this.options.extensions.renderers&&this.options.extensions.renderers[r.type]){const e=r,t=this.options.extensions.renderers[e.type].call({parser:this},e);if(!1!==t||!["space","hr","heading","code","table","blockquote","list","html","paragraph","text"].includes(e.type)){n+=t||"";continue}}switch(r.type){case"space":continue;case"hr":n+=this.renderer.hr();continue;case"heading":{const e=r;n+=this.renderer.heading(this.parseInline(e.tokens),e.depth,p(this.parseInline(e.tokens,this.textRenderer)));continue}case"code":{const e=r;n+=this.renderer.code(e.text,e.lang,!!e.escaped);continue}case"table":{const e=r;let t="",s="";for(let t=0;t<e.header.length;t++)s+=this.renderer.tablecell(this.parseInline(e.header[t].tokens),{header:!0,align:e.align[t]});t+=this.renderer.tablerow(s);let i="";for(let t=0;t<e.rows.length;t++){const n=e.rows[t];s="";for(let t=0;t<n.length;t++)s+=this.renderer.tablecell(this.parseInline(n[t].tokens),{header:!1,align:e.align[t]});i+=this.renderer.tablerow(s)}n+=this.renderer.table(t,i);continue}case"blockquote":{const e=r,t=this.parse(e.tokens);n+=this.renderer.blockquote(t);continue}case"list":{const e=r,t=e.ordered,s=e.start,i=e.loose;let l="";for(let t=0;t<e.items.length;t++){const n=e.items[t],s=n.checked,r=n.task;let o="";if(n.task){const e=this.renderer.checkbox(!!s);i?n.tokens.length>0&&"paragraph"===n.tokens[0].type?(n.tokens[0].text=e+" "+n.tokens[0].text,n.tokens[0].tokens&&n.tokens[0].tokens.length>0&&"text"===n.tokens[0].tokens[0].type&&(n.tokens[0].tokens[0].text=e+" "+n.tokens[0].tokens[0].text)):n.tokens.unshift({type:"text",text:e+" "}):o+=e+" "}o+=this.parse(n.tokens,i),l+=this.renderer.listitem(o,r,!!s)}n+=this.renderer.list(l,t,s);continue}case"html":{const e=r;n+=this.renderer.html(e.text,e.block);continue}case"paragraph":{const e=r;n+=this.renderer.paragraph(this.parseInline(e.tokens));continue}case"text":{let i=r,l=i.tokens?this.parseInline(i.tokens):i.text;for(;s+1<e.length&&"text"===e[s+1].type;)i=e[++s],l+="\n"+(i.tokens?this.parseInline(i.tokens):i.text);n+=t?this.renderer.paragraph(l):l;continue}default:{const e='Token with "'+r.type+'" type was not found.';if(this.options.silent)return console.error(e),"";throw new Error(e)}}}return n}parseInline(e,t){t=t||this.renderer;let n="";for(let s=0;s<e.length;s++){const r=e[s];if(this.options.extensions&&this.options.extensions.renderers&&this.options.extensions.renderers[r.type]){const e=this.options.extensions.renderers[r.type].call({parser:this},r);if(!1!==e||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(r.type)){n+=e||"";continue}}switch(r.type){case"escape":{const e=r;n+=t.text(e.text);break}case"html":{const e=r;n+=t.html(e.text);break}case"link":{const e=r;n+=t.link(e.href,e.title,this.parseInline(e.tokens,t));break}case"image":{const e=r;n+=t.image(e.href,e.title,e.text);break}case"strong":{const e=r;n+=t.strong(this.parseInline(e.tokens,t));break}case"em":{const e=r;n+=t.em(this.parseInline(e.tokens,t));break}case"codespan":{const e=r;n+=t.codespan(e.text);break}case"br":n+=t.br();break;case"del":{const e=r;n+=t.del(this.parseInline(e.tokens,t));break}case"text":{const e=r;n+=t.text(e.text);break}default:{const e='Token with "'+r.type+'" type was not found.';if(this.options.silent)return console.error(e),"";throw new Error(e)}}}return n}}class le{options;constructor(t){this.options=t||e.defaults}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(e){return e}postprocess(e){return e}processAllTokens(e){return e}}class oe{defaults={async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null};options=this.setOptions;parse=this.#e(ne.lex,ie.parse);parseInline=this.#e(ne.lexInline,ie.parseInline);Parser=ie;Renderer=se;TextRenderer=re;Lexer=ne;Tokenizer=w;Hooks=le;constructor(...e){this.use(...e)}walkTokens(e,t){let n=[];for(const s of e)switch(n=n.concat(t.call(this,s)),s.type){case"table":{const e=s;for(const s of e.header)n=n.concat(this.walkTokens(s.tokens,t));for(const s of e.rows)for(const e of s)n=n.concat(this.walkTokens(e.tokens,t));break}case"list":{const e=s;n=n.concat(this.walkTokens(e.items,t));break}default:{const e=s;this.defaults.extensions?.childTokens?.[e.type]?this.defaults.extensions.childTokens[e.type].forEach((s=>{const r=e[s].flat(1/0);n=n.concat(this.walkTokens(r,t))})):e.tokens&&(n=n.concat(this.walkTokens(e.tokens,t)))}}return n}use(...e){const t=this.defaults.extensions||{renderers:{},childTokens:{}};return e.forEach((e=>{const n={...e};if(n.async=this.defaults.async||n.async||!1,e.extensions&&(e.extensions.forEach((e=>{if(!e.name)throw new Error("extension name required");if("renderer"in e){const n=t.renderers[e.name];t.renderers[e.name]=n?function(...t){let s=e.renderer.apply(this,t);return!1===s&&(s=n.apply(this,t)),s}:e.renderer}if("tokenizer"in e){if(!e.level||"block"!==e.level&&"inline"!==e.level)throw new Error("extension level must be 'block' or 'inline'");const n=t[e.level];n?n.unshift(e.tokenizer):t[e.level]=[e.tokenizer],e.start&&("block"===e.level?t.startBlock?t.startBlock.push(e.start):t.startBlock=[e.start]:"inline"===e.level&&(t.startInline?t.startInline.push(e.start):t.startInline=[e.start]))}"childTokens"in e&&e.childTokens&&(t.childTokens[e.name]=e.childTokens)})),n.extensions=t),e.renderer){const t=this.defaults.renderer||new se(this.defaults);for(const n in e.renderer){if(!(n in t))throw new Error(`renderer '${n}' does not exist`);if("options"===n)continue;const s=n,r=e.renderer[s],i=t[s];t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n||""}}n.renderer=t}if(e.tokenizer){const t=this.defaults.tokenizer||new w(this.defaults);for(const n in e.tokenizer){if(!(n in t))throw new Error(`tokenizer '${n}' does not exist`);if(["options","rules","lexer"].includes(n))continue;const s=n,r=e.tokenizer[s],i=t[s];t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n}}n.tokenizer=t}if(e.hooks){const t=this.defaults.hooks||new le;for(const n in e.hooks){if(!(n in t))throw new Error(`hook '${n}' does not exist`);if("options"===n)continue;const s=n,r=e.hooks[s],i=t[s];le.passThroughHooks.has(n)?t[s]=e=>{if(this.defaults.async)return Promise.resolve(r.call(t,e)).then((e=>i.call(t,e)));const n=r.call(t,e);return i.call(t,n)}:t[s]=(...e)=>{let n=r.apply(t,e);return!1===n&&(n=i.apply(t,e)),n}}n.hooks=t}if(e.walkTokens){const t=this.defaults.walkTokens,s=e.walkTokens;n.walkTokens=function(e){let n=[];return n.push(s.call(this,e)),t&&(n=n.concat(t.call(this,e))),n}}this.defaults={...this.defaults,...n}})),this}setOptions(e){return this.defaults={...this.defaults,...e},this}lexer(e,t){return ne.lex(e,t??this.defaults)}parser(e,t){return ie.parse(e,t??this.defaults)}#e(e,t){return(n,s)=>{const r={...s},i={...this.defaults,...r};!0===this.defaults.async&&!1===r.async&&(i.silent||console.warn("marked(): The async option was set to true by an extension. The async: false option sent to parse will be ignored."),i.async=!0);const l=this.#t(!!i.silent,!!i.async);if(null==n)return l(new Error("marked(): input parameter is undefined or null"));if("string"!=typeof n)return l(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(n)+", string expected"));if(i.hooks&&(i.hooks.options=i),i.async)return Promise.resolve(i.hooks?i.hooks.preprocess(n):n).then((t=>e(t,i))).then((e=>i.hooks?i.hooks.processAllTokens(e):e)).then((e=>i.walkTokens?Promise.all(this.walkTokens(e,i.walkTokens)).then((()=>e)):e)).then((e=>t(e,i))).then((e=>i.hooks?i.hooks.postprocess(e):e)).catch(l);try{i.hooks&&(n=i.hooks.preprocess(n));let s=e(n,i);i.hooks&&(s=i.hooks.processAllTokens(s)),i.walkTokens&&this.walkTokens(s,i.walkTokens);let r=t(s,i);return i.hooks&&(r=i.hooks.postprocess(r)),r}catch(e){return l(e)}}}#t(e,t){return n=>{if(n.message+="\nPlease report this to https://github.com/markedjs/marked.",e){const e="<p>An error occurred:</p><pre>"+c(n.message+"",!0)+"</pre>";return t?Promise.resolve(e):e}if(t)return Promise.reject(n);throw n}}}const ae=new oe;function ce(e,t){return ae.parse(e,t)}ce.options=ce.setOptions=function(e){return ae.setOptions(e),ce.defaults=ae.defaults,n(ce.defaults),ce},ce.getDefaults=t,ce.defaults=e.defaults,ce.use=function(...e){return ae.use(...e),ce.defaults=ae.defaults,n(ce.defaults),ce},ce.walkTokens=function(e,t){return ae.walkTokens(e,t)},ce.parseInline=ae.parseInline,ce.Parser=ie,ce.parser=ie.parse,ce.Renderer=se,ce.TextRenderer=re,ce.Lexer=ne,ce.lexer=ne.lex,ce.Tokenizer=w,ce.Hooks=le,ce.parse=ce;const he=ce.options,pe=ce.setOptions,ue=ce.use,ke=ce.walkTokens,ge=ce.parseInline,fe=ce,de=ie.parse,xe=ne.lex;e.Hooks=le,e.Lexer=ne,e.Marked=oe,e.Parser=ie,e.Renderer=se,e.TextRenderer=re,e.Tokenizer=w,e.getDefaults=t,e.lexer=xe,e.marked=ce,e.options=he,e.parse=fe,e.parseInline=ge,e.parser=de,e.setOptions=pe,e.use=ue,e.walkTokens=ke}));

;
/* Markdown display policy used by AppUICore; independent of streaming and DOM lifecycle.
 * Engine: marked (dependencies/marked, shipped in the foundation bundle) behind a hardened private instance - see safeMarked.
 * The regex renderer below is only the fallback for a page where marked did not load. */
window._AppUICoreMarkdown=(function(){
  // --- HTML Escape ---
  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // --- Lists ---
  // One <div> per item, indented by NESTING LEVEL. The level comes from the item's leading whitespace relative to
  // the items above it (2-, 3- or 4-space / tab indents all work): a deeper indent than the current item opens a
  // level, a shallower one pops back to the matching level. Bullets change with depth (\u2022 \u25e6 \u25aa); an
  // ordered item keeps its own number.
  const LIST_RE = /^([ \t]*)([-*+]|\d+[.)]) +(.+)$/;
  const BULLETS = ['\u2022', '\u25e6', '\u25aa'];
  function renderLists(html) {
    const lines = html.split('\n'), out = [];
    let stack = [];                                    // indent widths of the open levels
    let prev = 'blank';                                // blank | list | prose
    for (const line of lines) {
      const m = LIST_RE.exec(line);
      if (!m) {
        if (line.trim()) {                             // prose ends the list
          if (prev === 'list') out.push('');           // ... and starts its own paragraph block
          stack = []; prev = 'prose';
        } else prev = prev === 'list' ? 'list' : 'blank';   // a blank line keeps the list (and its nesting) open
        out.push(line);
        continue;
      }
      const indent = m[1].replace(/\t/g, '    ').length;
      while (stack.length && indent < stack[stack.length - 1]) stack.pop();
      if (!stack.length || indent > stack[stack.length - 1]) stack.push(indent);
      const level = stack.length - 1;
      const marker = /^\d/.test(m[2]) ? m[2] : BULLETS[level % BULLETS.length];
      if (prev === 'prose') out.push('');              // a list right after prose is its own block, not inside the <p>
      out.push('<div class="appui-md-li appui-md-li-' + level + '" style="padding-left:' + (12 + level * 18) + 'px">' +
        marker + ' ' + m[3] + '</div>');
      prev = 'list';
    }
    return out.join('\n');
  }

  // --- marked (the offline copy in dependencies/marked, part of the foundation bundle) ---
  // A PRIVATE marked instance, hardened for model / tool output (untrusted): the global `marked` is left alone for
  // the file previews, which render the user's own documents. Here
  //   * raw HTML in the text is shown as text (marked passes it through by default - <img onerror>, <script>),
  //   * links: only http(s) / mailto / relative / # targets, always opened in a new tab with noopener,
  //   * images: http(s) / relative / data:image / blob only,
  //   * and the elements carry the inline look the chat always had (the page CSS may reset ul/ol/pre/table).
  const SAFE_HREF = /^(?:https?:|mailto:|tel:|vfs:|#|\/|\.{1,2}\/|[^:]*$)/i;
  const SAFE_SRC = /^(?:https?:|data:image\/(?:png|jpe?g|gif|webp|svg\+xml|bmp);|blob:|\/|\.{1,2}\/|[^:]*$)/i;
  const attr = v => escHtml(String(v == null ? '' : v)).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const PRE = 'background:var(--bg-primary);border:1px solid var(--border);border-radius:4px;padding:8px;overflow-x:auto;font-size:11px;margin:6px 0;line-height:1.4';
  const CODE = 'background:var(--bg-secondary);padding:1px 4px;border-radius:3px;font-size:11px';
  let _safe;                                            // the built instance (undefined until marked is there)
  function safeMarked() {
    if (_safe) return _safe;
    const M = window.marked;
    if (!M || typeof M.Marked !== 'function') return null;   // not cached: marked may still be loading, retried on the next call
    const inst = new M.Marked({gfm: true, breaks: false});
    inst.use({renderer: {
      html(html) { return escHtml(String(html && html.raw != null ? html.raw : html)); },
      link(href, title, text) {
        if (!SAFE_HREF.test(String(href || '').trim())) return text;          // javascript: / data: / vbscript: -> plain text
        return '<a href="' + attr(href) + '"' + (title ? ' title="' + attr(title) + '"' : '') +
          ' target="_blank" rel="noopener noreferrer">' + text + '</a>';
      },
      image(href, title, text) {
        if (!SAFE_SRC.test(String(href || '').trim())) return escHtml(text || '');
        return '<img src="' + attr(href) + '" alt="' + attr(text) + '"' + (title ? ' title="' + attr(title) + '"' : '') +
          ' style="max-width:100%">';
      },
      code(code, lang) {
        const l = String(lang || '').trim().split(/\s+/)[0].replace(/[^\w+#.-]/g, '');
        const hdr = '<div class="appui-md-code-bar" style="display:flex;justify-content:space-between;align-items:center;font-size:10px;opacity:.75;margin-bottom:4px">' +
          '<span>' + escHtml(l || 'code') + '</span>' +
          '<button type="button" class="appui-md-copy" style="font:inherit;padding:1px 6px;border:1px solid var(--border);border-radius:3px;background:transparent;color:inherit;cursor:pointer" ' +
          'onclick="(function(b){var c=b.parentNode&&b.parentNode.nextElementSibling;if(!c)return;var t=c.textContent||\'\';(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){b.textContent=\'Copied\';setTimeout(function(){b.textContent=\'Copy\';},1200);},function(){});})(this)">Copy</button></div>';
        return '<pre style="' + PRE + '">' + hdr + '<code' + (l ? ' class="language-' + l + '"' : '') + '>' +
          escHtml(String(code).replace(/\n$/, '')) + '</code></pre>';
      },
      codespan(code) { return '<code style="' + CODE + '">' + code + '</code>'; },
      paragraph(text) { return '<p style="margin:4px 0">' + text + '</p>\n'; },
      heading(text, level) {
        return '<h' + level + ' style="font-size:' + Math.max(11, 16 - level) +
          'px;font-weight:bold;color:var(--accent);margin:8px 0 4px">' + text + '</h' + level + '>\n';
      },
      list(body, ordered, start) {
        const tag = ordered ? 'ol' : 'ul';
        return '<' + tag + (ordered && start !== 1 && start !== '' ? ' start="' + attr(start) + '"' : '') +
          ' style="margin:4px 0;padding-left:22px;list-style-position:outside;list-style-type:' + (ordered ? 'decimal' : 'disc') +
          '">' + body + '</' + tag + '>\n';
      },
      table(header, body) {
        return '<table class="appui-markdown-table" border="1" cellpadding="4" cellspacing="0" ' +
          'style="border-collapse:collapse;font-size:12px;margin:8px 0"><thead>' + header + '</thead><tbody>' + body + '</tbody></table>\n';
      },
      blockquote(quote) { return '<blockquote style="margin:6px 0;padding:0 10px;border-left:3px solid var(--border)">' + quote + '</blockquote>\n'; },
      hr() { return '<hr style="border:0;border-top:1px solid var(--border);margin:8px 0">\n'; },
    }});
    return (_safe = inst);
  }

  // --- Markdown Rendering ---
  function renderMarkdown(text) {
    if (!text) return '';
    // marked, hardened (see safeMarked). breaks:FALSE - a single newline is a soft wrap, only a blank line starts a
    // new paragraph (standard markdown); breaks:true double-spaced every reply.
    const m = safeMarked();
    if (m) {
      try { return m.parse(text); } catch (e) { /* fall through to the built-in renderer */ }
    }
    // Fallback: regex-based rendering
    // First, extract code blocks to protect them
    const codeBlocks = [];
    let html = text.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
      const idx = codeBlocks.length;
      codeBlocks.push('<pre style="background:var(--bg-primary);border:1px solid var(--border);border-radius:4px;padding:8px;overflow-x:auto;font-size:11px;margin:6px 0;line-height:1.4"><code>' + escHtml(code.replace(/\n$/, '')) + '</code></pre>');
      return `\x00CODEBLOCK_${idx}\x00`;
    });
    // Keep image markup out of prose escaping and inline formatting.
    html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function(_, alt, src) {
      const attr = value => escHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const idx = codeBlocks.length;
      codeBlocks.push('<img src="' + attr(src) + '" alt="' + attr(alt) + '" style="max-width:100%">');
      return `\x00CODEBLOCK_${idx}\x00`;
    });
    // Protect inline code and links before formatting surrounding prose.
    const attr = value => escHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    html = html.replace(/`([^`\n]+)`/g, function(_, code) {
      const idx = codeBlocks.length;
      codeBlocks.push('<code style="background:var(--bg-secondary);padding:1px 4px;border-radius:3px;font-size:11px">' + escHtml(code) + '</code>');
      return `\x00CODEBLOCK_${idx}\x00`;
    });
    html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function(match, label, href) {
      if (/^(javascript|data|vbscript):/i.test(href)) return match;
      const idx = codeBlocks.length;
      codeBlocks.push('<a href="' + attr(href) + '" target="_blank" rel="noopener noreferrer">' + escHtml(label) + '</a>');
      return `\x00CODEBLOCK_${idx}\x00`;
    });
    // Escape HTML in the rest (prose)
    html = escHtml(html);
    // Inline code

    // Semantic headings keep document navigation and page styling available.
    html = html.replace(/^(#{1,6}) (.+)$/gm, function(_, hashes, title) {
      const level = hashes.length;
      const size = Math.max(11, 16 - level);
      return '<h' + level + ' style="font-size:' + size + 'px;font-weight:bold;color:var(--accent);margin:8px 0 4px">' + title + '</h' + level + '>';
    });
    // Bold / Italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // a single-line span whose opening * is not followed by a space: "* item" bullet lines must not pair up
    // with the next bullet's * and turn the text between them into <em>
    html = html.replace(/(?<!\*)\*(?![\s*])([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/(?<![\w_])_([^_]+)_(?![\w_])/g, '<em>$1</em>');
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    html = html.replace(/^&gt; ?(.+)$/gm, '<blockquote>$1</blockquote>');
    // Lists - nesting follows the source indentation (see renderLists)
    html = renderLists(html);
    // Markdown tables preserve empty cells and remain intact across newline handling.
    html = html.replace(/^(\|[^\n]+\|)\n\|[ \t:|-]+\|\n((?:\|[^\n]*\|(?:\n|$))*)/gm, function(_, header, rows) {
      const cells = row => row.trim().slice(1, -1).split('|').map(cell => cell.trim());
      const head = cells(header).map(cell => '<th>' + cell + '</th>').join('');
      const body = rows.trim().split('\n').filter(Boolean).map(row =>
        '<tr>' + cells(row).map(cell => '<td>' + cell + '</td>').join('') + '</tr>').join('');
      const idx = codeBlocks.length;
      codeBlocks.push('<table class="appui-markdown-table" border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-size:12px;margin:8px 0"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>');
      return `\x00CODEBLOCK_${idx}\x00`;
    });
    // PARAGRAPHS (breaks:false): split on BLANK lines → <p>; within a block a
    // single newline is a soft wrap (space). A block that is already a
    // block-level element (heading/list-div/blockquote/table placeholder) is
    // emitted as-is, not wrapped in <p>.
    const BLOCK_RE = /^\s*(<h[1-6]|<div|<blockquote|<pre|\x00CODEBLOCK_)/;
    html = html.split(/\n{2,}/).map(function(block) {
      const b = block.replace(/^\n+|\n+$/g, '');
      if (!b.trim()) return '';
      if (BLOCK_RE.test(b)) return b.replace(/\n/g, ' ');
      return '<p style="margin:4px 0">' + b.replace(/\n/g, ' ') + '</p>';
    }).join('');
    // Restore code blocks
    for (let i = codeBlocks.length - 1; i >= 0; i--) {
      html = html.replace(`\x00CODEBLOCK_${i}\x00`, () => codeBlocks[i]);
    }
    return html;
  }

  return {escHtml,renderMarkdown,renderLists};
})();

;
/* Incremental SSE framing; transport and payload handling belong to callers. */
const AppUIStreamEvents = (() => {
  function create(onEvent) {
    let line = '', event = '', data = [], skipLf = false, first = true, finished = false;

    function dispatch() {
      const frame = data.length ? {event: event || 'message', data: data.join('\n')} : null;
      event = '';
      data = [];
      if (frame) onEvent(frame);
    }

    function consumeLine() {
      const value = line;
      line = '';
      if (!value) { dispatch(); return; }
      if (value.startsWith(':')) return;
      const colon = value.indexOf(':');
      const field = colon < 0 ? value : value.slice(0, colon);
      let content = colon < 0 ? '' : value.slice(colon + 1);
      if (content.startsWith(' ')) content = content.slice(1);
      if (field === 'data') data.push(content);
      else if (field === 'event') event = content;
    }

    function push(text) {
      if (finished) throw new Error('Stream parser is finished');
      for (const char of String(text)) {
        if (first) { first = false; if (char === '\uFEFF') continue; }
        if (skipLf) { skipLf = false; if (char === '\n') continue; }
        if (char === '\r') { skipLf = true; consumeLine(); }
        else if (char === '\n') consumeLine();
        else line += char;
      }
    }

    function finish() {
      if (finished) return;
      finished = true;
      if (line) consumeLine();
      dispatch();
    }

    return {push, finish};
  }
  return {create};
})();
window.AppUIStreamEvents = AppUIStreamEvents;

;
/* Shared chat payload decoding; AppUIStreamEvents owns incremental SSE framing. */
window._AppUICoreStream = (() => {
  const parsers = new WeakMap();
  function json(payload, fallback) {
    try { return JSON.parse(payload); } catch (_) { return fallback; }
  }
  function dispatch({event, data: payload}, callbacks) {
    if (payload === '[DONE]' || event === 'done') {
      callbacks.onDone?.(payload === '[DONE]' ? {} : json(payload, {}));
    } else if (event === 'meta') callbacks.onMeta?.(json(payload, {}));
    else if (event === 'tool_call') callbacks.onToolCall?.(json(payload, {name: payload}));
    else if (event === 'tool_result') callbacks.onToolResult?.(json(payload, {result: payload}));
    else if (event === 'error') callbacks.onError?.(payload);
    else {
      const data = json(payload, payload);
      if (typeof data === 'string') callbacks.onText?.(data);
      else if (data && typeof data === 'object') {
        const token = data.token || data.content || data.text || data.delta?.content || '';
        if (token) callbacks.onText?.(token);
      }
    }
  }
  // Calls can contain arbitrary partial lines. Dispatch only complete SSE frames;
  // finish(callbacks) flushes a final unterminated frame at end of input.
  function parseSSE(chunk, callbacks) {
    let parser = parsers.get(callbacks);
    if (!parser) {
      parser = window.AppUIStreamEvents.create(frame => dispatch(frame, callbacks));
      parsers.set(callbacks, parser);
    }
    parser.push(chunk);
  }
  parseSSE.finish = callbacks => {
    const parser = parsers.get(callbacks);
    parsers.delete(callbacks);
    parser?.finish();
  };

  /** POST chat; callbacks keep their existing signatures. Exactly one terminal
   * notification is emitted. Failures reject, and all owned readers are released.
   * EOF without a terminal event remains a successful legacy stream completion. */
  async function streamChat(opts) {
    const url = opts.url || `/api/llm/${opts.backend || 'kiro'}/chat/stream`;
    const body = {prompt: opts.prompt, system: opts.system || '', model: opts.model || '', backend: opts.backend || ''};
    if (opts.session_id) body.session_id = opts.session_id;
    let fullText = '', sessionId = opts.session_id || null, state = 'open';
    let reader, reachedEof = false, cancellation;
    const result = () => ({text: fullText, session_id: sessionId});
    const checkAbort = () => {
      if (!opts.signal?.aborted) return;
      const error = new Error('Request cancelled');
      error.name = 'AbortError';
      throw error;
    };
    function complete(data = {}) {
      if (state !== 'open') return;
      checkAbort();
      if (data?.session_id) sessionId = data.session_id;
      state = 'done';
      opts.onDone?.({...result(), ...(data?.total_ms !== undefined ? {total_ms: data.total_ms} : {})});
    }
    function fail(error) {
      if (state !== 'open') return;
      state = 'error';
      opts.onError?.(error?.message || String(error));
    }
    function cancelReader() {
      if (!reader || cancellation) return cancellation;
      try { cancellation = Promise.resolve(reader.cancel()).catch(() => {}); }
      catch (_) { cancellation = Promise.resolve(); }
      return cancellation;
    }
    const onAbort = () => { cancelReader(); };
    const callbacks = {
      onText(token) {
        if (state !== 'open') return;
        checkAbort();
        fullText += token;
        opts.onText?.(token, fullText);
      },
      onToolCall(data) { if (state === 'open') { checkAbort(); opts.onToolCall?.(data); } },
      onToolResult(data) { if (state === 'open') { checkAbort(); opts.onToolResult?.(data); } },
      onMeta(data) {
        if (state !== 'open') return;
        checkAbort();
        if (data?.session_id) sessionId = data.session_id;
        opts.onMeta?.(data);
      },
      onDone: complete,
      onError(message) {
        if (state !== 'open') return;
        const error = new Error(message);
        fail(error);
        throw error;
      },
    };
    try {
      checkAbort();
      const response = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body), ...(opts.signal ? {signal: opts.signal} : {})});
      checkAbort();
      if (!response.ok) {
        let message = 'HTTP ' + response.status;
        try {
          const data = await response.json();
          const detail = data?.error || data?._error || data?.message;
          if (typeof detail === 'string') message = detail;
        } catch (_) { /* retain the HTTP status for non-JSON errors */ }
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      if (!(response.headers.get('content-type') || '').toLowerCase().includes('text/event-stream')) {
        const data = await response.json();
        checkAbort();
        if (data?.ok === false || data?._error || data?.error) throw new Error(data.error || data._error || 'Chat request failed');
        fullText = data?.response || data?.content || data?.text || JSON.stringify(data);
        if (data?.session_id) sessionId = data.session_id;
        opts.onText?.(fullText, fullText);
        complete();
        return result();
      }
      if (!response.body) throw new Error('Chat stream has no response body');
      reader = response.body.getReader();
      opts.signal?.addEventListener('abort', onAbort, {once: true});
      checkAbort();
      const decoder = new TextDecoder();
      while (state === 'open') {
        const {done, value} = await reader.read();
        checkAbort();
        if (done) { reachedEof = true; break; }
        parseSSE(decoder.decode(value, {stream: true}), callbacks);
      }
      if (state === 'open') {
        parseSSE(decoder.decode(), callbacks);
        parseSSE.finish(callbacks);
        complete();
      }
      return result();
    } catch (error) {
      fail(error);
      throw error;
    } finally {
      opts.signal?.removeEventListener('abort', onAbort);
      parsers.delete(callbacks);
      if (reader) {
        try { if (!reachedEof) await cancelReader(); }
        finally { reader.releaseLock(); }
      }
    }
  }
  return {parseSSE, streamChat};
})();

;
/* Chat queue, interruption and steering controls shared by AppUICore consumers. */
window._AppUICoreSteering = {
  /**
   * Queue a message to send after current LLM turn completes.
   * @param {string} message
   * @param {object} opts - {endpoint: '/chat/steer'}
   */
  queue(message, opts = {}) {
    const endpoint = opts.endpoint || `/api/llm/${opts.backend || 'kiro'}/chat/steer`;
    fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message})
    }).catch(() => {});
  },

  /**
   * Interrupt current generation (abort controller) and re-send.
   * @param {AbortController} controller - the active abort controller
   * @param {function} sendFn - function to call with the message
   * @param {string} message
   * @returns {ReturnType<typeof setTimeout>} Handle callers can cancel with clearTimeout.
   */
  interrupt(controller, sendFn, message) {
    if (controller) try { controller.abort(); } catch(e) {}
    return setTimeout(() => sendFn(message), 200);
  },

  /**
   * Create queue/interrupt buttons for a chat input area.
   * @param {object} opts - {onQueue, onInterrupt, container}
   * @returns {HTMLElement} the button group
   */
  createButtons(opts = {}) {
    const el = document.createElement('span');
    el.className = 'ui-steer-btns';
    el.innerHTML = `<button class="ui-steer-queue" title="Queue (send after done)" style="padding:2px 6px;background:var(--bg-elevated);border:1px solid var(--color-warning);color:var(--color-warning);border-radius:3px;cursor:pointer;font-size:11px;margin-right:3px">⏭</button><button class="ui-steer-interrupt" title="Interrupt (abort + send now)" style="padding:2px 6px;background:var(--bg-elevated);border:1px solid var(--color-error);color:var(--color-error);border-radius:3px;cursor:pointer;font-size:11px">⏹</button>`;
    if (opts.onQueue) el.querySelector('.ui-steer-queue').onclick = opts.onQueue;
    if (opts.onInterrupt) el.querySelector('.ui-steer-interrupt').onclick = opts.onInterrupt;
    if (opts.container) opts.container.appendChild(el);
    return el;
  },

  /**
   * Remove steering buttons.
   * @param {HTMLElement} el - the button group from createButtons
   */
  removeButtons(el) {
    if (el) el.remove();
  }
};

;
/**
 * AI Core  --  shared utilities for ai-float.js and ai-sidebar.js
 * 
 * Provides:
 *   AppUICore.escHtml(s)            --  escape HTML entities
 *   AppUICore.renderMarkdown(text)  --  markdown to HTML (with fallback)
 *   AppUICore.smartScroll(el)       --  scroll only if user is near bottom
 *   AppUICore.parseSSE(chunk, cb)   --  parse SSE lines, dispatch events
 *   AppUICore.streamChat(opts)      --  full streaming chat with tool support
 */
var AppUICore = window.AppUICore || (function() {

  const {escHtml,renderMarkdown}=window._AppUICoreMarkdown;

  // --- Smart Scroll ---
  function smartScroll(el, threshold) {
    if (!el) return;
    threshold = threshold || 80;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
      el.scrollTop = el.scrollHeight;
    }
  }

  function forceScroll(el) {
    if (el) el.scrollTop = el.scrollHeight;
  }

  const {parseSSE,streamChat}=window._AppUICoreStream;

  // --- Tool Status UI Helpers ---
  // A tool row: "⚙ name  ⏱ 1.2s" — the elapsed time ticks while the tool runs and
  // freezes when markToolDone is called (or shows the backend-reported ms). Click
  // to expand args + output; the expanded detail SCROLLS (60vh) instead of being
  // clipped at a fixed height.
  const _TOOL_OPEN_H = '60vh';
  function _fmtElapsed(ms) {
    if (!(ms >= 0)) return '';
    if (ms < 1000) return ms + 'ms';
    const s = ms / 1000;
    return s < 60 ? s.toFixed(s < 10 ? 1 : 0) + 's' : Math.floor(s / 60) + 'm ' + Math.round(s % 60) + 's';
  }
  function _isLargeOutput(o) {
    if (typeof o === 'string') return o.length > 2048;
    if (o && typeof o === 'object') {
      if (Array.isArray(o)) return o.length > 12;
      const ks = Object.keys(o);
      if (ks.length > 12) return true;
      for (let i = 0; i < ks.length; i++) {
        const v = o[ks[i]];
        if (typeof v === 'string' && v.length > 512) return true;
        if (Array.isArray(v) && v.length > 8) return true;
        if (v && typeof v === 'object' && Object.keys(v).length > 8) return true;
      }
    }
    return false;
  }
  function _formatToolOutput(output) {
    let outStr;
    try { outStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2); }
    catch { outStr = String(output); }
    if (!outStr) return '';
    // the detail scrolls, so keep a generous amount (a read window / search page)
    if (outStr.length > 60000) outStr = outStr.slice(0, 60000) + '\n\u2026 (truncated at 60k chars)';
    return '\u2192 ' + outStr;
  }
  function _materializeToolOutput(el) {
    if (!el || !el._hasPendingOutput) return;
    const raw = el._pendingOutput;
    el._hasPendingOutput = false;
    el._pendingOutput = undefined;
    const out = el.querySelector('.tool-output');
    if (out) out.textContent = _formatToolOutput(raw);
  }
  function _toggleToolDetail(el) {
    const detail = el.querySelector('.tool-detail');
    if (!detail) return;
    const isOpen = detail.style.maxHeight && detail.style.maxHeight !== '0px';
    if (!isOpen && el._hasPendingOutput) _materializeToolOutput(el);
    detail.style.maxHeight = isOpen ? '0px' : _TOOL_OPEN_H;
    detail.style.overflow = isOpen ? 'hidden' : 'auto';
  }
  function createToolStatus(toolName, args) {
    const el = document.createElement('div');
    el.className = 'ai-tool-status';
    el.style.cssText = 'margin:3px 0;padding:2px 8px;background:var(--bg-elevated);border-left:2px solid var(--color-info, #ce93d8);border-radius:2px;font-size:10px;cursor:pointer;display:block';
    const argsStr = args ? (typeof args === 'string' ? args : JSON.stringify(args)).slice(0, 4000) : '';
    el.innerHTML = `<span style="color:var(--color-info, #ce93d8)">⚙ ${escHtml((toolName || 'tool').slice(0, 60))}</span>`
      + ` <span class="tool-elapsed" style="color:var(--text-muted);font-variant-numeric:tabular-nums" title="time spent in this tool call">\u23f1 0s</span>`
      + `${argsStr ? `<div class="tool-detail" style="color:var(--text-muted);font-size:10px;max-height:0;overflow:hidden;transition:max-height 0.3s;white-space:pre-wrap;word-break:break-all;margin-top:2px;cursor:text">${escHtml(argsStr)}</div>` : ''}`;
    el._t0 = Date.now();
    const tick = () => {
      const e = el.querySelector('.tool-elapsed');
      if (!e || el._done) return;
      e.textContent = '\u23f1 ' + _fmtElapsed(Math.floor((Date.now() - el._t0) / 1000) * 1000);
    };
    el._timer = setInterval(() => {
      // stop on completion, detachment or a 30 min safety cap (no leaked timers)
      if (el._done || (!el.isConnected && Date.now() - el._t0 > 5000) || Date.now() - el._t0 > 1800000) {
        clearInterval(el._timer); el._timer = null; return;
      }
      tick();
    }, 1000);
    el.onclick = (e) => {
      // selecting / scrolling inside the open output must not collapse it
      if (e.target.closest && e.target.closest('.tool-detail')) return;
      e.stopPropagation();
      _toggleToolDetail(el);
    };
    return el;
  }

  function markToolDone(el, output, ms) {
    if (!el) return;
    el.style.borderLeftColor = 'var(--color-success)';
    const label = el.querySelector('span');
    if (label) label.innerHTML = label.innerHTML.replace('...', ' \u2714');
    // elapsed: the backend-reported duration when given, else the row's own clock;
    // ms === null = unknown (a replayed history row) → no time shown
    if (!el._done) {
      el._done = true;
      if (el._timer) { clearInterval(el._timer); el._timer = null; }
      const e = el.querySelector('.tool-elapsed');
      const took = (typeof ms === 'number' && ms >= 0) ? ms
        : (ms === null ? null : (el._t0 ? Date.now() - el._t0 : null));
      if (e) { if (took != null) e.textContent = '\u23f1 ' + _fmtElapsed(took); else e.remove(); }
    }
    // AI_ASSISTANT #2: render the tool's OUTPUT in the collapsible detail (not
    // just tint the border) so the user can expand a row and see WHAT the tool
    // returned. Append below the args; create the detail block if the row had
    // no args (so an args-less tool still shows its result). Idempotent: a
    // re-render / re-mark replaces any prior output block.
    if (output === undefined || output === null || output === '') return;
    let detail = el.querySelector('.tool-detail');
    if (!detail) {
      detail = document.createElement('div');
      detail.className = 'tool-detail';
      detail.style.cssText = 'color:var(--text-muted);font-size:10px;max-height:0;overflow:hidden;transition:max-height 0.3s;white-space:pre-wrap;word-break:break-all;margin-top:2px;cursor:text';
      el.appendChild(detail);
    }
    const isOpen = !!(detail.style.maxHeight && detail.style.maxHeight !== '0px');
    // keep the args (existing content), drop any previous output block, append fresh
    const prev = detail.querySelector('.tool-output');
    if (prev) prev.remove();
    const out = document.createElement('div');
    out.className = 'tool-output';
    out.style.cssText = 'margin-top:4px;padding-top:4px;border-top:1px dashed var(--border,#444)';
    // #35: defer JSON.stringify + huge text-node creation for collapsed large outputs
    // until the user actually clicks the row to expand it.
    if (!isOpen && _isLargeOutput(output)) {
      el._pendingOutput = output;
      el._hasPendingOutput = true;
      out.textContent = '\u2192 (click to expand output)';
    } else {
      el._hasPendingOutput = false;
      el._pendingOutput = undefined;
      const formatted = _formatToolOutput(output);
      if (!formatted) return;
      out.textContent = formatted;
    }
    detail.appendChild(out);
  }

  // --- Format Utilities ---
  function fmtSize(n) {
    if (!n) return '';
    if (n > 1e9) return (n/1e9).toFixed(1)+' GB';
    if (n > 1e6) return (n/1e6).toFixed(1)+' MB';
    if (n > 1e3) return (n/1e3).toFixed(1)+' KB';
    return n + ' B';
  }

  function fmtDate(ts) {
    return ts ? new Date(ts * 1000).toLocaleString() : '';
  }

  function copyFallback(text) {
    let input;
    try {
      input = document.createElement('textarea');
      input.value = text;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.focus?.({preventScroll: true});
      input.select();
      if (!document.execCommand('copy')) throw new Error('Clipboard is unavailable');
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    } finally {
      input?.remove();
    }
  }

  function copyText(text, {fallbackOnError = false} = {}) {
    text = text == null ? '' : String(text);
    if (!navigator.clipboard?.writeText) return copyFallback(text);
    let write;
    try {
      write = navigator.clipboard.writeText(text);
    } catch (error) {
      write = Promise.reject(error);
    }
    return Promise.resolve(write).catch(error => {
      if (!fallbackOnError) throw error;
      return copyFallback(text);
    });
  }

  function downloadBlob(blob, filename, options) {
    options = options || {};
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    if (options.rel) link.rel = options.rel;
    function cleanup() {
      URL.revokeObjectURL(url);
      link.remove();
    }
    try {
      if (options.attach) document.body.appendChild(link);
      link.click();
    } catch (error) {
      cleanup();
      throw error;
    }
    window.setTimeout(cleanup, options.revokeDelay == null ? 0 : options.revokeDelay);
  }

  function downloadText(text, filename, type) {
    downloadBlob(new Blob([text == null ? '' : String(text)], {type: type || 'text/plain'}), filename);
  }

  function downloadJson(value, filename) {
    downloadText(JSON.stringify(value, null, 2), filename || 'download.json', 'application/json');
  }

  // --- Public API ---
  return {
    escHtml,
    fmtSize,
    fmtDate,
    copyText,
    downloadBlob,
    downloadText,
    downloadJson,
    renderMarkdown,
    smartScroll,
    forceScroll,
    parseSSE,
    streamChat,
    createToolStatus,
    markToolDone,
    // Theme toggle
    toggleTheme() {
      return AppUITheme.toggle();
    },
    setTheme(theme) {
      return AppUITheme.set(theme);
    },
    initTheme() {
      return AppUITheme.restore();
    },
    steer: window._AppUICoreSteering,

    // --- Tools (call sync or async with auto-callback wiring) ---
    tools: (function() {
      let _schema = null;  // cached tool list

      async function list() {
        if (!_schema) {
          const r = await fetch('/tools');
          const d = await r.json();
          _schema = d.tools || [];
        }
        return _schema;
      }

      async function call(name, params = {}) {
        const r = await fetch(`/api/${name}`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(params)
        });
        return r.json();
      }

      async function asyncCall(name, params = {}, onDone = null) {
        // Look up what event this tool emits
        const tools = await list();
        const tool = tools.find(t => t.name === name);
        if (!tool || !tool.emits) {
          throw new Error(`Tool ${name} does not support async (no emits declared)`);
        }
        // NOTE: Legacy AppUICore.events SSE listener removed.
        // Pages that need async completion callbacks should use AppUIEventBus directly:
        //   const bus = new AppUIEventBus(['tools']);
        //   bus.on('tools', tool.emits, data => { bus.close(); onDone(data); });
        if (onDone) {
          console.warn('AppUICore.tools.asyncCall: onDone callback ignored — use AppUIEventBus for async tool events');
        }
        // Fire the async call
        const r = await fetch(`/api/${name}!async`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(params)
        });
        return r.json();
      }

      return { list, call, asyncCall };
    })(),
  };
})();

// Auto-restore saved theme on load
AppUICore.initTheme();
window.AppUICore = AppUICore;

;
/**
 * AppUITextUtils — shared text manipulation for all pages.
 * @module text-utils
 */
var AppUITextUtils = (function() {
  'use strict';
  
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  
  // Plain queries match substrings; regex-looking queries compile once.
  // An incomplete regex falls back to literal matching while the user types.
  function makeMatcher(query, {stringify = value => String(value || '')} = {}) {
    query = String(query || '').trim();
    if (!query) return () => true;
    if (/[\\^$.*+?()[\]{}|]/.test(query)) {
      try {
        const expression = new RegExp(query, 'i');
        return value => expression.test(stringify(value));
      } catch (_) {}
    }
    const lower = query.toLowerCase();
    return value => stringify(value).toLowerCase().includes(lower);
  }

  function truncate(s, max, suffix) {
    s = String(s || '');
    suffix = suffix || '...';
    max = max || 100;
    return s.length <= max ? s : s.substring(0, max - suffix.length) + suffix;
  }
  
  function formatTime(ts, opts) {
    if (!ts) return '-';
    opts = opts || {};
    var d = typeof ts === 'number' ? new Date(ts > 1e12 ? ts : ts * 1000) : new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    if (opts.relative) return _relative(d);
    if (opts.timeOnly) return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    return d.toLocaleDateString([], {month:'short', day:'numeric'}) + ' ' +
           d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  }
  
  function _relative(d) {
    var s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  }
  
  function formatLatency(ms) {
    if (ms == null) return '-';
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return (ms / 60000).toFixed(1) + 'min';
  }

  function formatBytes(value) {
    value = Number(value) || 0;
    if (value <= 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB', 'TB'];
    var index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return (value / Math.pow(1024, index)).toFixed(index ? 1 : 0) + ' ' + units[index];
  }

  function formatRelative(ts, opts) {
    opts = opts || {};
    if (!ts) return opts.empty || '';
    var d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    var seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (seconds < 60) return opts.justNow === false ? seconds + 's ago' : 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (opts.yesterday && seconds < 172800) return 'Yesterday';
    var days = Math.floor(seconds / 86400);
    if (days < (opts.cutoffDays || 7)) return days + 'd ago';
    return d.toLocaleDateString();
  }
  
  /** @deprecated Use sanitizeDom for HTML or esc for plain text. */
  function sanitizeHtml(html, maxLen) {
    if (!html) return '';
    var safe = sanitizeDom(String(html));
    if (maxLen) {
      var tmp = document.createElement('div');
      tmp.innerHTML = safe;
      var text = tmp.textContent || '';
      if (text.length > maxLen) {
        safe = esc(text.substring(0, maxLen)) + '...';
      }
    }
    return safe;
  }
  
  /**
   * STRUCTURAL sanitizer for HTML that will be assigned to innerHTML when its
   * source is not trusted — e.g. rendered markdown of an LLM answer that was
   * grounded on arbitrary document text. Unlike sanitizeHtml (a regex pass), it
   * parses the markup into an INERT document (DOMParser: no scripts run, no
   * resources load) and rebuilds it from an allowlist: unknown elements are
   * unwrapped (their text kept), active ones (script/iframe/form/…) dropped with
   * their content, every attribute outside a small allowlist removed (so no
   * on* handlers, quoted or not), and href/src restricted to http(s), mailto,
   * same-origin paths, fragments and data:image. Returns safe HTML.
   */
  var _SAFE_TAGS = {A:1,ABBR:1,B:1,BLOCKQUOTE:1,BR:1,CODE:1,DEL:1,DIV:1,EM:1,H1:1,H2:1,H3:1,H4:1,
    H5:1,H6:1,HR:1,I:1,IMG:1,KBD:1,LI:1,MARK:1,OL:1,P:1,PRE:1,S:1,SPAN:1,STRONG:1,SUB:1,SUP:1,
    TABLE:1,TBODY:1,TD:1,TFOOT:1,TH:1,THEAD:1,TR:1,U:1,UL:1,DETAILS:1,SUMMARY:1};
  var _DROP_TAGS = {SCRIPT:1,STYLE:1,IFRAME:1,OBJECT:1,EMBED:1,LINK:1,META:1,BASE:1,FORM:1,INPUT:1,
    BUTTON:1,SELECT:1,TEXTAREA:1,SVG:1,MATH:1,TEMPLATE:1,NOSCRIPT:1,FRAME:1,FRAMESET:1,APPLET:1,
    AUDIO:1,VIDEO:1,SOURCE:1,TITLE:1,HEAD:1};
  var _SAFE_ATTRS = {href:1,src:1,alt:1,title:1,class:1,style:1,colspan:1,rowspan:1,align:1,
    border:1,cellpadding:1,cellspacing:1,start:1,open:1};
  var _SAFE_URL = /^(https?:|mailto:|#|\/(?!\/)|\.{1,2}\/|data:image\/(png|jpeg|gif|webp);)/i;
  function sanitizeDom(html) {
    if (!html) return '';
    var doc;
    try { doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html'); }
    catch (e) { return esc(String(html)); }
    (function clean(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (el.nodeType === 3) continue;                       // text
        if (el.nodeType !== 1) { node.removeChild(el); continue; }   // comments etc.
        var tag = el.tagName.toUpperCase();
        if (_DROP_TAGS[tag]) { node.removeChild(el); continue; }
        clean(el);
        if (!_SAFE_TAGS[tag]) {                                // unwrap: keep the content
          while (el.firstChild) node.insertBefore(el.firstChild, el);
          node.removeChild(el);
          continue;
        }
        var attrs = Array.prototype.slice.call(el.attributes);
        for (var j = 0; j < attrs.length; j++) {
          var name = attrs[j].name.toLowerCase(), val = attrs[j].value || '';
          var ok = !!_SAFE_ATTRS[name];
          if (ok && (name === 'href' || name === 'src')) ok = _SAFE_URL.test(val.trim());
          if (ok && name === 'style') ok = !/url\s*\(|expression\s*\(|@import|behavior\s*:/i.test(val);
          if (!ok) el.removeAttribute(attrs[j].name);
        }
        if (tag === 'A' && el.hasAttribute('href') && !/^#/.test(el.getAttribute('href'))) {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      }
    })(doc.body);
    return doc.body.innerHTML;
  }

  /** Append literal text with case-insensitive query matches in native mark elements. */
  function appendHighlight(host, text, query) {
    const doc = host.ownerDocument || document;
    text = String(text ?? '');
    query = String(query ?? '');
    if (!query) {host.appendChild(doc.createTextNode(text)); return host;}
    const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      host.appendChild(doc.createTextNode(text.slice(cursor, match.index)));
      const mark = doc.createElement('mark');
      mark.textContent = match[0];
      host.appendChild(mark);
      cursor = match.index + match[0].length;
    }
    host.appendChild(doc.createTextNode(text.slice(cursor)));
    return host;
  }

  function parseJsonObject(text) {
    const cleaned=text.replace(/```json\n?/g,'').replace(/```/g,'').trim();
    const match=cleaned.match(/\{[\s\S]*\}/);
    return match?JSON.parse(match[0]):null;
  }

  return { makeMatcher, esc: esc, truncate: truncate, formatTime: formatTime, formatLatency: formatLatency, formatBytes: formatBytes, formatRelative: formatRelative, sanitizeHtml: sanitizeHtml, sanitizeDom: sanitizeDom, appendHighlight, parseJsonObject };
})();

// Also expose globally for backward compatibility
if (typeof window !== 'undefined') window.AppUITextUtils = AppUITextUtils;

;
/** Shared browser file reading and dropped-directory traversal. */
var AppUIFileUtils = (() => {
  // Partition a flat listing under an already-normalized directory prefix.
  // File entries retain their original identity; explicit folders can be empty.
  function flatChildren(entries, prefix = '', {folders = [], normalize = String, skipEmpty = true} = {}) {
    const base = prefix ? prefix + '/' : '';
    const directories = Object.create(null), files = [];
    function relative(value) {
      const path = normalize(value);
      return base && !path.startsWith(base) ? null : path.slice(base.length);
    }
    entries.forEach(entry => {
      const rest = relative(entry.name);
      if (rest === null || (skipEmpty && !rest)) return;
      const slash = rest.indexOf('/');
      if (slash < 0) files.push({name: rest, entry});
      else directories[rest.slice(0, slash)] = true;
    });
    folders.forEach(folder => {
      const rest = relative(folder);
      if (!rest) return;
      const slash = rest.indexOf('/');
      directories[slash < 0 ? rest : rest.slice(0, slash)] = true;
    });
    return {directories: Object.keys(directories), files};
  }

  function bytesFromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function blobFromBase64(base64, mime = 'application/octet-stream') {
    return new Blob([bytesFromBase64(base64)], { type: mime });
  }

  // Strict UTF-8 conversion preserves malformed-input errors for caller fallbacks.
  function textToBase64(text, {urlSafe = false} = {}) {
    const encoded = btoa(unescape(encodeURIComponent(String(text))));
    return urlSafe ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : encoded;
  }

  function textFromBase64(value, {urlSafe = false} = {}) {
    let encoded = String(value);
    if (urlSafe) {
      encoded = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (encoded.length % 4) encoded += '=';
    }
    return decodeURIComponent(escape(atob(encoded)));
  }

  function readBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.onload = () => resolve(String(reader.result).split(',', 2)[1] || '');
      reader.readAsDataURL(file);
    });
  }

  // Call during the drop handler: DataTransfer can become unreadable afterward.
  function captureDrop(dataTransfer) {
    const entries = [];
    for (const item of Array.from(dataTransfer?.items || [])) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
    return { entries, files: Array.from(dataTransfer?.files || []) };
  }

  async function readEntries(entries, { mapFile = (file, path) => ({ file, path }) } = {}) {
    const result = [];
    async function walk(entry, prefix) {
      try {
        if (entry.isFile) {
          const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
          result.push(await mapFile(file, prefix + entry.name));
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const pending = [];
          try {
            while (true) {
              const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
              if (!batch.length) break;
              for (const child of batch) pending.push(walk(child, prefix + entry.name + '/'));
            }
          } finally {
            await Promise.all(pending);
          }
        }
      } catch (_) { /* Skip unreadable files/directories, retaining successful reads. */ }
    }
    await Promise.all(Array.from(entries || [], entry => walk(entry, '')));
    return result;
  }

  function readDrop(dataTransfer, options) {
    const captured = captureDrop(dataTransfer);
    const entries = captured.entries.length ? captured.entries : captured.files.map(file => ({
      isFile: true, name: file.name, file: resolve => resolve(file),
    }));
    return readEntries(entries, options);
  }

  return { flatChildren, bytesFromBase64, blobFromBase64, textToBase64, textFromBase64, readBase64, captureDrop, readEntries, readDrop };
})();
if (typeof window !== 'undefined') window.AppUIFileUtils = AppUIFileUtils;

;
/** In-memory promise coalescing with optional successful-result TTL caching. */
var AppUIAsyncCache = (() => {
  function create({ ttlMs = 0, cacheIf = () => true, maxEntries = 256 } = {}) {
    if (!(ttlMs >= 0) || !(maxEntries === Infinity || Number.isInteger(maxEntries) && maxEntries >= 0))
      throw new RangeError('Cache TTL and capacity must be nonnegative; capacity must be an integer or Infinity');
    const pending = new Map();
    const recent = new Map();

    function prune() {
      const now = Date.now();
      for (const [key, cached] of recent) {
        if (now - cached.time >= ttlMs) recent.delete(key);
      }
      while (recent.size > maxEntries) recent.delete(recent.keys().next().value);
    }

    function get(key, load) {
      prune();
      if (pending.has(key)) return pending.get(key);
      const cached = recent.get(key);
      if (cached) {
        recent.delete(key);
        recent.set(key, cached);
        return Promise.resolve(cached.value);
      }
      const request = Promise.resolve().then(load);
      pending.set(key, request);
      request.then(value => {
        // A cleared/replaced request must not repopulate the cache later.
        if (pending.get(key) !== request) return;
        pending.delete(key);
        try {
          if (ttlMs > 0 && maxEntries > 0 && cacheIf(value)) {
            recent.set(key, { time: Date.now(), value });
            prune();
          }
        } catch (_) { /* A cache-policy failure must not replace the loaded result. */ }
      }, () => {
        if (pending.get(key) === request) pending.delete(key);
      });
      return request;
    }

    function clear(key) {
      if (arguments.length) { pending.delete(key); recent.delete(key); }
      else { pending.clear(); recent.clear(); }
    }

    return { get, clear };
  }
  return { create };
})();
if (typeof window !== 'undefined') window.AppUIAsyncCache = AppUIAsyncCache;

;
/** Shared classic-script loading with bounded transport and per-caller export checks. */
var AppUIScriptLoader = (() => {
  const requests = new Map();

  function load(url, globalName, {timeout = 10000} = {}) {
    if (globalName && window[globalName] !== undefined) return Promise.resolve(window[globalName]);
    if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2147483647)
      return Promise.reject(new RangeError('Script timeout must be between 0 and 2147483647 milliseconds, exclusive of 0'));
    let key;
    try {
      const resolved = new URL(url, document.baseURI || window.location.href);
      resolved.hash = '';
      key = resolved.href;
    } catch (error) { return Promise.reject(error); }
    let request = requests.get(key);
    if (!request) {
      let script;
      try {
        script = document.createElement('script');
        script.src = key;
      } catch (error) { return Promise.reject(error); }
      let resolve, reject, settled = false;
      request = new Promise((yes, no) => {resolve = yes; reject = no;});
      requests.set(key, request);
      const timer = setTimeout(() => finish(new Error('Script load timed out: ' + key)), timeout);
      function finish(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onload = script.onerror = null;
        if (error) {
          if (requests.get(key) === request) requests.delete(key);
          script.remove();
          reject(error);
        } else resolve(true);
      }
      script.onload = () => finish();
      script.onerror = () => finish(new Error('Failed to load script: ' + key));
      try { document.head.appendChild(script); }
      catch (error) { finish(error); }
    }
    // One URL transport, but each caller validates its own requested export.
    // A missing export does not invalidate another caller's successful load.
    return request.then(() => {
      if (globalName && window[globalName] === undefined)
        throw new Error('Script did not define ' + globalName + ': ' + key);
      return globalName ? window[globalName] : true;
    });
  }

  return { load };
})();
if (typeof window !== 'undefined') window.AppUIScriptLoader = AppUIScriptLoader;

;
/** Deferred native modules with one initialized feature instance per caller. */
(function (global) {
  if (global.AppUILazyFeature) return;

  function create(options) {
    if (!options || typeof options.src !== 'string' || !options.src.trim()) {
      throw new TypeError('Lazy feature requires a module URL');
    }
    var initialize = options.initialize;
    if (initialize !== undefined && typeof initialize !== 'function') {
      throw new TypeError('Lazy feature initialize must be a function');
    }
    var url = new URL(options.src, document.baseURI).href;
    var pending;
    var nativeRetries = 0;

    function load() {
      if (!pending) {
        pending = Promise.resolve().then(function () {
          if (global.AppUIAssets && global.AppUIAssets.loadModule) {
            return global.AppUIAssets.loadModule(url);
          }
          var requestUrl = url;
          if (nativeRetries) {
            var retryUrl = new URL(url);
            retryUrl.searchParams.set('_appui_retry', nativeRetries);
            requestUrl = retryUrl.href;
          }
          return import(requestUrl).catch(function (error) {
            nativeRetries++;
            throw error;
          });
        }).then(function (module) {
          return initialize ? initialize(module) : module;
        }).catch(function (error) {
          // Network and initialization failures may be retried on the next action.
          pending = null;
          throw error;
        });
      }
      return pending;
    }

    function call(name, args) {
      return load().then(function (feature) {
        if (!feature || typeof feature[name] !== 'function') {
          throw new TypeError('Lazy feature has no method: ' + name);
        }
        return feature[name].apply(feature, args || []);
      });
    }

    function mount(name, host, options) {
      options = options || {};
      var destroyed = false, owned;
      function release(value) {
        if (typeof value === 'function') value();
        else if (value && typeof value.destroy === 'function') value.destroy();
      }
      host.textContent = options.loadingText || 'Loading…';
      var ready = load().then(function (feature) {
        if (destroyed) return;
        if (!feature || typeof feature[name] !== 'function') {
          throw new TypeError('Lazy feature has no method: ' + name);
        }
        return feature[name](host);
      }).then(function (cleanup) {
        if (destroyed) release(cleanup);
        else owned = cleanup;
      }).catch(function (error) {
        if (destroyed) return;
        if (options.onError) options.onError(error, host);
        else host.textContent = 'Unable to open this panel. Open it again to retry.';
      });
      return { ready: ready, destroy: function () {
        if (destroyed) return;
        destroyed = true;
        var cleanup = owned;
        owned = null;
        release(cleanup);
      } };
    }

    return { load: load, call: call, mount: mount };
  }

  window.AppUILazyFeature = { create: create };
})(window);

;
/** Scope document styles under a caller-owned root; external imports are omitted. */
var AppUIDocumentStyles = (() => {
  function scope(cssText, { selector = '.fs-doc', omitDarkMedia = false } = {}) {

    // Parse via a detached <style> so the browser gives us structured rules.
    var tmp = document.createElement('style'); tmp.textContent = cssText || '';
    document.head.appendChild(tmp);
    var sheet = tmp.sheet, out = '';
    var scopeSel = function (sel) {
      return sel.split(',').map(function (s) {
        s = s.trim(); if (!s) return s;
        // Map document-global selectors onto the scope root itself.
        if (/^(html|body|:root)\b/i.test(s)) {
          var rest = s.replace(/^(html|body|:root)/i, '').trim();
          return rest ? (selector + ' ' + rest) : selector;
        }
        return selector + ' ' + s;
      }).join(', ');
    };
    var walk = function (rules) {
      var txt = '';
      [].slice.call(rules || []).forEach(function (r) {
        if (r.type === 1) {   // style rule
          txt += scopeSel(r.selectorText) + '{' + r.style.cssText + '}';
        } else if (r.type === 4 || r.type === 12) {   // @media / @supports
          // DROP `@media (prefers-color-scheme: dark)` blocks. The preview
          // forces the doc background light/transparent (see the override
          // below), but prefers-color-scheme matches the OS/browser — so a
          // doc's dark-mode palette (e.g. silver #e8ebef headings meant for a
          // dark page) would paint light-on-light = unreadable. Rendering the
          // doc's LIGHT (default) palette matches the light preview surface.
          if (omitDarkMedia && r.type === 4 && /prefers-color-scheme\s*:\s*dark/i.test(r.conditionText || '')) {
            return;   // skip the dark-scheme block entirely
          }
          txt += '@' + (r.type === 4 ? 'media ' + r.conditionText : 'supports ' + r.conditionText) + '{' + walk(r.cssRules) + '}';
        } else if (r.cssText && r.type !== 3) {   // keyframes/font-face/etc: keep as-is (not layout-global)
          txt += r.cssText;
        }
      });
      return txt;
    };
    try { out = walk(sheet.cssRules); } catch (e) { out = ''; }
    document.head.removeChild(tmp);
    return out;
    }
  return { scope };
})();
if (typeof window !== 'undefined') window.AppUIDocumentStyles = AppUIDocumentStyles;

;
/* Page-box measurement and fit-to-width for document previewers. */
window.AppUIDocumentLayout = (function () {
  'use strict';
  function fit(ph, c, paneW, preserveDeclaredBox) {
    var nw, nh;
    if (c.__natW > 1 && c.__natH > 1) { nw = c.__natW; nh = c.__natH; }
    else {
      // Measure the natural (unscaled) box. When _applyDeclaredBox PINNED an
      // explicit width/height on a dimensionless slide (stream head with no
      // `.page` rule), keep that box (position:relative) so we read the true
      // slide size (e.g. 1280×720) — NOT position:static, which would collapse
      // an absolutely-positioned-only slide back to the pane width (wrong
      // aspect). A page that already has CSS dims is measured the normal way.
      var _pinned = preserveDeclaredBox && !!(c.getAttribute && c.getAttribute('data-boxed'));
      c.style.transform = 'none';
      if (!_pinned) { c.style.position = 'static'; c.style.margin = '0'; }
      else { c.style.position = 'relative'; c.style.margin = '0'; }
      nw = c.offsetWidth || c.getBoundingClientRect().width;
      nh = Math.max(c.offsetHeight || 0, c.scrollHeight || 0) || c.getBoundingClientRect().height;
      if (nw > 1 && nh > 1) { c.__natW = nw; c.__natH = nh; }
    }
    if (nw > 1 && nh > 1) {
      var scale = Math.min(4, paneW / nw);
      c.style.position = 'absolute'; c.style.left = '0'; c.style.top = '0';
      c.style.transformOrigin = 'top left'; c.style.transform = 'scale(' + scale + ')';
      ph.style.width = Math.round(nw * scale) + 'px';
      ph.style.height = Math.round(nh * scale) + 'px';
      ph.style.maxWidth = '100%';
    }
  }

  function declaredDimensions(pg) {
    try {
      var w = 0, h = 0;
      var _len = function (s, prop) {
        var m = s.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([\\d.]+)(px|pt)', 'i'));
        if (!m) return 0;
        var v = parseFloat(m[1]);
        return m[2].toLowerCase() === 'pt' ? v * 96 / 72 : v;
      };
      var st = pg.getAttribute && pg.getAttribute('style') || '';
      w = _len(st, 'width');
      h = _len(st, 'height') || _len(st, 'min-height');  // docx pages use min-height
      if ((!w || !h) && pg.getAttribute) {
        w = w || parseFloat(pg.getAttribute('width') || '0') || 0;
        h = h || parseFloat(pg.getAttribute('height') || '0') || 0;
      }
      // A page may size itself from an inner slide frame; peek one level.
      if ((!w || !h)) {
        var inner = pg.querySelector && pg.querySelector('[style*="width"][style*="height"]');
        if (inner) {
          var is = inner.getAttribute('style') || '';
          if (!w) w = _len(is, 'width');
          if (!h) h = _len(is, 'height');
        }
      }
      return (w > 1 && h > 1) ? { w: w, h: h } : null;
    } catch (e) { return null; }
  }
  return {fit: fit, declaredDimensions: declaredDimensions};
})();

;
/**
 * AppUIPollRefresh — visibility-aware polling for pages.
 * @module poll-refresh
 */
var AppUIPollRefresh = (function() {
  'use strict';
  
  function create(fetchFn, intervalMs, opts) {
    opts = opts || {};
    var timer = null;
    var paused = false;
    var visibilityBound = false;
    var inFlight = false;
    var controller = null;
    var active = false;
    var generation = 0;
    
    function tick(manual, session) {
      if ((!active && !manual) || session !== generation) return;
      if (opts.stopWhen && opts.stopWhen()) { stop(); return; }
      if (paused || inFlight) return;
      const request = new AbortController();
      controller = request;
      inFlight = true;
      const settle = () => {
        if (session !== generation || controller !== request) return;
        inFlight = false;
        controller = null;
      };
      try {
        Promise.resolve(fetchFn({signal: controller.signal})).catch(function() {}).finally(settle);
      } catch(e) { settle(); }
    }

    function onVisibilityChange() {
      if (!active) return;
      paused = document.hidden;
      if (!paused && opts.refreshOnVisible) tick(false, generation);
    }

    function start() {
      stop();
      active = true;
      const session = generation;
      timer = setInterval(() => tick(false, session), intervalMs);
      // Pause when tab hidden
      if (opts.pauseOnHidden !== false && !visibilityBound) {
        document.addEventListener('visibilitychange', onVisibilityChange);
        visibilityBound = true;
        paused = document.hidden;
      }
    }
    
    function stop() {
      active = false;
      generation++;
      if (timer !== null) { clearInterval(timer); timer = null; }
      if (controller) controller.abort();
      controller = null;
      inFlight = false;
      if (visibilityBound) document.removeEventListener('visibilitychange', onVisibilityChange);
      visibilityBound = false;
    }
    function refresh() { tick(true, generation); }
    function setInterval_(ms) { intervalMs = ms; if (timer !== null) { stop(); start(); } }
    
    return { start: start, stop: stop, destroy: stop, refresh: refresh, setInterval: setInterval_ };
  }
  
  function start(fetchFn, intervalMs, opts) {
    var poller = create(fetchFn, intervalMs, opts);
    poller.start();
    return poller;
  }

  return { create: create, start: start };
})();

if (typeof window !== 'undefined') window.AppUIPollRefresh = AppUIPollRefresh;

;
/**
 * State  --  localStorage persistence layer with cross-tab sync.
 *
 * Usage:
 *   const state = State.create('doc_studio');
 *   state.set('content', {title: 'Hello'});
 *   state.get('content');  // {title: 'Hello'}
 *   state.clear('content');
 *   state.clearAll();
 *
 * Features:
 *   - Namespaced per page (no collisions between pages)
 *   - Debounced auto-save (batches rapid writes)
 *   - Cross-tab sync via storage event
 *   - save/load/clear direct functions
 */
var State = window.State || (function() {
  'use strict';

  const DEFAULT_DEBOUNCE_MS = 300;

  /**
   * Create a namespaced state instance.
   * @param {string} namespace  --  unique per page/app (e.g. 'doc_studio')
   * @param {object} opts  --  {debounce: ms, onChange: fn(key, value)}
   * @returns {StateInstance}
   */
  function create(namespace, opts) {
    opts = opts || {};
    const prefix = 'state:' + namespace + ':';
    const debounceMs = opts.debounce != null ? opts.debounce : DEFAULT_DEBOUNCE_MS;
    const listeners = Object.create(null);  // key -> [callback, ...]
    let pendingWrites = Object.create(null);
    let writeTimer = null;

    // --- Core persistence ---

    function _storageKey(key) {
      return prefix + key;
    }

    function save(key, data) {
      AppUIStorage.setJSON(_storageKey(key), data);
    }

    function load(key, defaultValue) {
      return AppUIStorage.getJSON(_storageKey(key), defaultValue !== undefined ? defaultValue : null);
    }

    function clear(key) {
      delete pendingWrites[key];
      if (!Object.keys(pendingWrites).length && writeTimer !== null) {
        clearTimeout(writeTimer);
        writeTimer = null;
      }
      AppUIStorage.remove(_storageKey(key));
    }

    function clearAll() {
      pendingWrites = Object.create(null);
      if (writeTimer !== null) clearTimeout(writeTimer);
      writeTimer = null;
      AppUIStorage.keys(prefix).forEach(key => AppUIStorage.remove(key));
    }

    // --- Debounced auto-save ---

    function _flushWrites() {
      const batch = pendingWrites;
      pendingWrites = Object.create(null);
      writeTimer = null;
      for (const key in batch) {
        save(key, batch[key]);
      }
    }

    function set(key, data) {
      pendingWrites[key] = data;
      if (writeTimer !== null) clearTimeout(writeTimer);
      writeTimer = setTimeout(_flushWrites, debounceMs);
      // Notify local listeners immediately (optimistic)
      _notify(key, data);
    }

    function get(key, defaultValue) {
      // Return pending write if exists (not yet flushed)
      if (key in pendingWrites) return pendingWrites[key];
      return load(key, defaultValue);
    }

    // --- Flush (force immediate write) ---

    function flush() {
      if (writeTimer !== null) {
        clearTimeout(writeTimer);
        _flushWrites();
      }
    }

    // --- Listeners ---

    function _notify(key, value) {
      (listeners[key] || []).forEach(fn => { try { fn(value, key); } catch(e) {} });
      (listeners['*'] || []).forEach(fn => { try { fn(value, key); } catch(e) {} });
      if (opts.onChange) { try { opts.onChange(key, value); } catch(e) {} }
    }

    function onChange(key, callback) {
      if (!listeners[key]) listeners[key] = [];
      listeners[key].push(callback);
    }

    function offChange(key, callback) {
      if (listeners[key]) {
        listeners[key] = listeners[key].filter(fn => fn !== callback);
      }
    }

    // --- Cross-tab sync ---

    function _handleStorage(e) {
      if (!e.key || !e.key.startsWith(prefix)) return;
      const key = e.key.slice(prefix.length);
      let value = null;
      try { value = e.newValue ? JSON.parse(e.newValue) : null; } catch(err) {}
      _notify(key, value);
    }

    window.addEventListener('storage', _handleStorage);

    // --- Cleanup ---

    function destroy() {
      flush();
      window.removeEventListener('storage', _handleStorage);
    }

    return {
      save, load, clear, clearAll,
      set, get, flush,
      onChange, offChange,
      destroy,
      get namespace() { return namespace; }
    };
  }

  return { create };
})();

;
/**
 * AppUIReactiveState — in-memory reactive store for cross-component communication.
 *
 * Unlike State (localStorage persistence), AppUIReactiveState is purely in-memory
 * and designed for same-page component coordination with automatic derived values.
 *
 * Usage:
 *   const store = AppUIReactiveState.create();
 *   store.set('transcript', entries);
 *   store.watch('transcript', (value) => updateUI(value));
 *   store.derived('context', ['transcript', 'selection'], (t, s) => buildContext(t, s));
 *   store.batch(() => { store.set('a', 1); store.set('b', 2); }); // single notification round
 */
var AppUIReactiveState = window.AppUIReactiveState || (function() {
  'use strict';

  function create() {
    const _data = Object.create(null);
    const _watchers = Object.create(null);    // key -> Set<fn>
    const _derivations = Object.create(null); // key -> {deps, compute}
    let _batchDepth = 0, _flushing = false;
    let _pending = new Map();
    let _order = [];

    function _dependencyOrder() {
      const visiting = new Set(), visited = new Set(), order = [];
      function visit(key) {
        if (visiting.has(key)) throw new Error('Derived state dependency cycle at ' + key);
        if (visited.has(key)) return;
        visiting.add(key);
        for (const dep of _derivations[key].deps) {
          if (_derivations[dep]) visit(dep);
        }
        visiting.delete(key);
        visited.add(key);
        order.push(key);
      }
      Object.keys(_derivations).forEach(visit);
      return order;
    }

    function _change(key, value, notify = true) {
      if (!_pending.has(key)) _pending.set(key, {prev: _data[key], notify});
      else if (notify) _pending.get(key).notify = true;
      _data[key] = value;
      if (!_batchDepth && !_flushing) _flush();
    }

    function set(key, value) { _change(key, value); }

    function get(key, defaultValue) {
      return key in _data ? _data[key] : defaultValue;
    }

    function watch(key, fn) {
      if (!_watchers[key]) _watchers[key] = new Set();
      _watchers[key].add(fn);
      return () => unwatch(key, fn);
    }

    function unwatch(key, fn) { _watchers[key]?.delete(fn); }

    function derived(key, deps, computeFn) {
      const previous = _derivations[key];
      const definition = {deps: [...deps], compute: computeFn};
      _derivations[key] = definition;
      let order, initial;
      try {
        order = _dependencyOrder();
        initial = computeFn(...deps.map(dep => _data[dep]));
      } catch (error) {
        if (previous) _derivations[key] = previous;
        else delete _derivations[key];
        throw error;
      }
      _order = order;
      // Registration stays silent for this key, but updates existing dependents.
      _change(key, initial, false);
      return () => {
        if (_derivations[key] !== definition) return;
        delete _derivations[key];
        _order = _dependencyOrder();
      };
    }

    function batch(fn) {
      _batchDepth++;
      try { return fn(); }
      finally {
        _batchDepth--;
        if (!_batchDepth && !_flushing) _flush();
      }
    }

    function _notify(key, value, prev) {
      const callbacks = [...(_watchers[key] || []), ...(_watchers['*'] || [])];
      for (const fn of callbacks) { try { fn(value, key, prev); } catch (_) {} }
    }

    function _flush() {
      _flushing = true;
      try {
        while (_pending.size) {
          const changes = _pending;
          _pending = new Map();
          const changed = new Set(changes.keys());
          for (const key of _order) {
            const definition = _derivations[key];
            if (!definition || !definition.deps.some(dep => changed.has(dep))) continue;
            const value = definition.compute(...definition.deps.map(dep => _data[dep]));
            if (!Object.is(value, _data[key])) {
              if (!changes.has(key)) changes.set(key, {prev: _data[key], notify: true});
              _data[key] = value;
              changed.add(key);
            }
          }
          // Every observer sees a fully recomputed graph. Reentrant writes
          // queue another round rather than recursively interrupting this one.
          const notifications = [...changes].map(([key, change]) => [key, _data[key], change]);
          for (const [key, value, change] of notifications) {
            if (change.notify) _notify(key, value, change.prev);
          }
        }
      } finally { _flushing = false; }
    }

    function keys() { return Object.keys(_data); }

    function destroy() {
      _pending.clear();
      _order = [];
      for (const key in _watchers) _watchers[key].clear();
      for (const key in _data) delete _data[key];
      for (const key in _derivations) delete _derivations[key];
    }

    return { set, get, watch, unwatch, derived, batch, keys, destroy };
  }

  return { create };
})();

if (typeof window !== 'undefined') window.AppUIReactiveState = AppUIReactiveState;

;
/* Local configuration with namespace-owned, versioned server saves. */
var AppUIConfigStore = window.AppUIConfigStore || (() => {
  const DEBOUNCE_MS = 10000, RETRY_LIMIT = 5;
  const entries = new Map(), listeners = new Set(), loadErrors = new Map();
  const JOURNAL_PREFIX = 'appui.config.pending.v1:';
  let journalError = null;
  let namespace = '', generation = 0, loadController = null;
  const id = (space, key) => JSON.stringify([space, key]);
  const prefix = (space, key) => 'cfg:' + space + '.' + key;
  function getStatus(space = namespace) {
    const owned = [...entries.values()].filter(entry => entry.namespace === space);
    const pending = owned.filter(entry => entry.dirty).length;
    const saving = owned.some(entry => entry.inFlight);
    const error = owned.find(entry => entry.error)?.error || loadErrors.get(space) || journalError;
    return {namespace: space, state: saving ? 'saving' : error ? 'error' : pending ? 'pending' : 'saved', pending, error};
  }
  function notify() {
    const status = getStatus();
    for (const listener of [...listeners]) {try {listener(status);} catch (_) {}}
  }
  function onStatus(listener) {listeners.add(listener); listener(getStatus()); return () => listeners.delete(listener);}
  function persist(entry, force = false) {
    const key = JOURNAL_PREFIX + encodeURIComponent(id(entry.namespace, entry.key));
    let previous;
    try {previous = JSON.parse(AppUIStorage.get(key) || 'null');} catch (_) {}
    // An acknowledgment from this page must not remove another tab's edit.
    if (!force && previous && previous.token !== entry.token) return;
    const success = entry.dirty
      ? AppUIStorage.setJSON(key, {namespace: entry.namespace, key: entry.key, value: entry.value, removed: entry.removed, token: entry.token})
      : AppUIStorage.remove(key);
    journalError = success === false ? 'Pending changes could not be saved to browser storage' : null;
  }
  async function init(space) {
    namespace = String(space);
    const version = ++generation, owned = namespace;
    loadController?.abort();
    const controller = new AbortController(); loadController = controller;
    const timer = setTimeout(() => controller.abort(), 10000);
    for (const entry of entries.values()) {
      if (entry.namespace === owned && entry.dirty && !entry.inFlight && entry.timer === null) {
        entry.attempts = 0;
        schedule(entry, 1000);
      }
    }
    notify();
    try {
      const response = await fetch('/api/config.get', {method: 'POST', signal: controller.signal,
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({key: owned})});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (version !== generation || controller.signal.aborted) return false;
      if (!data || data._error || data.error || data.ok === false) throw new Error(data?.error || data?._error || 'Invalid configuration response');
      loadErrors.delete(owned);
      if (data.value !== null) {
        const object = data.value !== undefined ? {value: data.value} : data;
        for (const [key, value] of Object.entries(object)) {
          if (key.startsWith('_') || entries.has(id(owned, key))) continue;
          const storageKey = prefix(owned, key);
          if (AppUIStorage.get(storageKey) === null) AppUIStorage.setJSON(storageKey, value);
        }
      }
      return true;
    } catch (error) {
      if (version === generation) loadErrors.set(owned, error.message);
      return false;
    } finally {clearTimeout(timer); if (version === generation) notify();}
  }
  function get(key, fallback) {
    const entry = entries.get(id(namespace, key));
    if (entry) return entry.removed ? fallback : JSON.parse(JSON.stringify(entry.value));
    const raw = AppUIStorage.get(prefix(namespace, key));
    if (raw === null) return fallback;
    try {return JSON.parse(raw);} catch (_) {return raw;}
  }
  function schedule(entry, milliseconds) {
    if (entry.timer !== null) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {entry.timer = null; void save(entry);}, milliseconds);
  }
  function change(key, value, removed) {
    const snapshot = removed ? null : JSON.parse(JSON.stringify(value));
    const token = id(namespace, key);
    let entry = entries.get(token);
    if (!entry) {
      entry = {namespace, key, version: 0, timer: null, inFlight: null};
      entries.set(token, entry);
    }
    Object.assign(entry, {token: window.crypto?.randomUUID?.() || Date.now() + ':' + Math.random(), value: snapshot, removed, version: entry.version + 1, dirty: true, attempts: 0, error: null});
    if (removed) AppUIStorage.remove(prefix(namespace, key));
    else AppUIStorage.setJSON(prefix(namespace, key), snapshot);
    persist(entry, true); schedule(entry, DEBOUNCE_MS); notify();
  }
  function set(key, value) {change(key, value, false);}
  function remove(key) {change(key, null, true);}
  async function save(entry, keepalive = false) {
    if (entry.timer !== null) {clearTimeout(entry.timer); entry.timer = null;}
    if (entry.inFlight) {
      const wanted = entry.version, sending = entry.sendingVersion;
      await entry.inFlight;
      return entry.dirty && wanted !== sending ? save(entry, keepalive) : !entry.dirty;
    }
    if (!entry.dirty) return true;
    const version = entry.version, value = entry.value;
    entry.sendingVersion = version;
    entry.inFlight = (async () => {
      // Start on a microtask so inFlight is installed even for a synchronous throw.
      await Promise.resolve();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch('/api/config.set', {method: 'POST', keepalive, signal: controller.signal,
          headers: {'Content-Type': 'application/json'}, body: JSON.stringify({key: entry.namespace + '.' + entry.key, value})});
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = response.status === 204 ? null : await response.json();
        if (data && (data.ok === false || data.error || data._error)) throw new Error(data.error || data._error || 'Configuration save failed');
        if (entry.version === version) {entry.dirty = false; entry.error = null; entry.attempts = 0;}
        return true;
      } catch (error) {
        if (entry.version === version) {entry.error = error.message; entry.attempts++;}
        return false;
      } finally {
        clearTimeout(timer); entry.inFlight = null;
        if (entry.dirty) {
          if (entry.version !== version) schedule(entry, DEBOUNCE_MS);
          else if (entry.attempts <= RETRY_LIMIT) schedule(entry, Math.min(1000 * 2 ** (entry.attempts - 1), 30000));
        }
        persist(entry); notify();
      }
    })();
    notify();
    return entry.inFlight;
  }
  function flush({keepalive = false} = {}) {
    return Promise.all([...entries.values()].filter(entry => entry.dirty || entry.inFlight).map(entry => save(entry, keepalive)));
  }
  function getAll() {
    const result = Object.create(null), start = prefix(namespace, '');
    for (const storageKey of AppUIStorage.keys(start)) {
      const key = storageKey.slice(start.length); result[key] = get(key);
    }
    for (const entry of entries.values()) {
      if (entry.namespace !== namespace) continue;
      if (entry.removed) delete result[entry.key]; else result[entry.key] = get(entry.key);
    }
    return result;
  }
  // Restore unacknowledged edits, including deletion tombstones. They are
  // retried when their namespace initializes or when the caller flushes.
  try {
    for (const journalKey of AppUIStorage.keys(JOURNAL_PREFIX)) {
      let record;
      try {record = JSON.parse(AppUIStorage.get(journalKey));} catch (_) {continue;}
      if (!record || typeof record.namespace !== 'string' || typeof record.key !== 'string' || typeof record.token !== 'string' ||
          typeof record.removed !== 'boolean' || (!record.removed && record.value === undefined)) continue;
      entries.set(id(record.namespace, record.key), {...record, version: 1, dirty: true, attempts: 0,
        error: null, timer: null, inFlight: null});
    }
  } catch (_) { /* Keep browser-storage failure isolated from the runtime. */ }
  window.addEventListener('beforeunload', () => {void flush({keepalive: true});});
  return {init, get, set, remove, flush, getAll, getStatus, onStatus};
})();
window.AppUIConfigStore = AppUIConfigStore;

;
/* Resource ownership helpers for AppUI services, components, and features. */
var AppUILifecycle = window.AppUILifecycle || (function() {
  function createScope() {
    let destroyed = false;
    const cleanups = [];
    return {
      add(cleanup) {
        const dispose = typeof cleanup === 'function' ? cleanup
          : typeof cleanup?.destroy === 'function' ? () => cleanup.destroy() : null;
        if (!dispose) return cleanup;
        let complete = false;
        const once = () => {
          if (complete) return;
          complete = true;
          dispose();
        };
        if (destroyed) once();
        else cleanups.push(once);
        return once;
      },
      listen(target, type, listener, options) {
        target.addEventListener(type, listener, options);
        return this.add(() => target.removeEventListener(type, listener, options));
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        let failed = false, firstError;
        cleanups.splice(0).reverse().forEach(cleanup => {
          try { cleanup(); }
          catch (error) { if (!failed) { failed = true; firstError = error; } }
        });
        if (failed) throw firstError;
      },
      get destroyed() { return destroyed; },
    };
  }

  // Coalesce work into one frame; canceled callbacks stay inert even if delivered late.
  function createFrameTask(callback, {fallbackDelay = 16} = {}) {
    let pending = null, destroyed = false;
    function cancel() {
      const task = pending;
      pending = null;
      if (!task) return;
      if (task.timer) clearTimeout(task.id);
      else if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(task.id);
    }
    function schedule() {
      if (destroyed || pending) return;
      const task = {id: null, timer: false};
      pending = task;
      const run = () => {
        if (destroyed || pending !== task) return;
        pending = null;
        callback();
      };
      try { task.id = requestAnimationFrame(run); }
      catch (error) {
        if (pending !== task) throw error;
        task.timer = true;
        task.id = setTimeout(run, fallbackDelay);
      }
    }
    return {schedule, cancel, destroy() {destroyed = true; cancel();}};
  }

  // A callable delayed task; a scope can own its cleanup via add(task.destroy).
  function debounce(callback, delay = 300) {
    let pending = null, destroyed = false;
    function cancel() {
      const task = pending;
      pending = null;
      if (task) clearTimeout(task.id);
    }
    function schedule(...args) {
      if (destroyed) return;
      cancel();
      const task = {id: null};
      pending = task;
      task.id = setTimeout(() => {
        if (destroyed || pending !== task) return;
        pending = null;
        callback.apply(this, args);
      }, delay);
    }
    schedule.cancel = cancel;
    schedule.destroy = () => {destroyed = true; cancel();};
    return schedule;
  }

  function generation() {
    let value = 0;
    return {next: () => ++value, current: () => value, isCurrent: candidate => candidate === value};
  }

  function createViewScope({host, parent, signal, isCurrent, pagehide = true, observeRemoval = true} = {}) {
    const scope = createScope(), controller = new AbortController();
    let mounted = !host || host.isConnected !== false;
    scope.signal = controller.signal;
    scope.current = () => !scope.destroyed && (!parent || parent.current()) && (!host || host.isConnected !== false) && (!isCurrent || !!isCurrent());
    scope.add(() => controller.abort());
    if (parent) {
      const cancel = () => scope.destroy();
      if (parent.signal.aborted) {scope.destroy();return scope;}
      parent.signal.addEventListener('abort', cancel, {once: true});
      scope.add(() => parent.signal.removeEventListener('abort', cancel));
    }
    if (signal) {
      if (signal.aborted) {scope.destroy();return scope;}
      scope.listen(signal,'abort',()=>scope.destroy(),{once:true});
    }
    if (pagehide) scope.listen(window, 'pagehide', event => {if (!event.persisted) scope.destroy();});
    if (host && observeRemoval && typeof MutationObserver === 'function') {
      const observer = new MutationObserver(() => {
        if (host.isConnected !== false) mounted = true;
        if (mounted && !scope.current()) scope.destroy();
      });
      const target = host.ownerDocument?.body || (typeof document !== 'undefined' && document.body);
      if (target) {observer.observe(target, {childList: true, subtree: true}); scope.add(() => observer.disconnect());}
    }
    return scope;
  }

  function createKeyedScopes(options = {}) {
    const lifetime = createViewScope(options), scopes = new Map();
    function clear() {
      const owned = Array.from(scopes.values()); scopes.clear();
      const cleanup=createScope();
      owned.reverse().forEach(scope=>cleanup.add(scope));
      cleanup.destroy();
    }
    lifetime.add(clear);
    return {
      signal: lifetime.signal,
      current: () => lifetime.current(),
      get destroyed() { return lifetime.destroyed; },
      get: key => scopes.get(key),
      begin(key, options = {}) {
        const previous = scopes.get(key), {isCurrent, parent, ...settings} = options;
        const scope = createViewScope({pagehide: false, ...settings, parent: parent || lifetime,
          isCurrent: () => scopes.get(key) === scope && lifetime.current() && (!isCurrent || !!isCurrent()),
        });
        scopes.set(key, scope);
        scope.add(() => {if (scopes.get(key) === scope) scopes.delete(key);});
        if (lifetime.destroyed) scope.destroy();
        previous?.destroy();
        return scope;
      },
      destroy(...keys) {if (keys.length) scopes.get(keys[0])?.destroy(); else lifetime.destroy();},
      destroyAll: clear,
    };
  }

  function wait(scope, milliseconds, {isCurrent} = {}) {
    if(scope.destroyed)return Promise.resolve(false);
    return new Promise(resolve=>{
      const timer=setTimeout(()=>resolve(!scope.destroyed&&(!isCurrent||!!isCurrent())),milliseconds);
      scope.add(()=>{clearTimeout(timer);resolve(false);});
    });
  }

  return {createScope, createViewScope, createKeyedScopes, generation, wait, createFrameTask, debounce};
})();
window.AppUILifecycle = AppUILifecycle;

;
/**
 * AppUIHostHooks  --  a tiny named registry for PAGE-PROVIDED host hooks.
 *
 * The manifest sidebar contract lets an app DECLARE (in its manifest's
 * `sidebars_shown`) which gallery sidebars a page embeds, so adding e.g. the AI
 * chat to a page is a MANIFEST edit, not code. But some sidebars need live page
 * FUNCTIONS they can't get from a static manifest — the AI chat's `context()`
 * (a per-turn snapshot of the page) and `onAction(type, payload)` (where a
 * chat-emitted action is applied). A JSON manifest can't carry a function.
 *
 * This registry bridges that gap WITHOUT coupling the manifest to code: the
 * page registers its live hooks under a stable KEY, and the manifest entry
 * references that key via `host_hooks`. At mount time the shell resolves the
 * key → the registered `{ context, onAction, system, ... }` and passes them to
 * the sidebar. A sidebar whose provider declares no `needs_host` (apphost
 * `_one_sidebar_spec`) is a pure drop-in and ignores all of this.
 *
 *   // page code, once, early:
 *   AppUIHostHooks.register('catalog.chain', {
 *     context: () => currentChainSnapshot(),
 *     onAction: (type, payload) => applyChainAction(type, payload),
 *     system: 'You are the chain assistant…',
 *   });
 *
 *   // manifest (platform/tool_catalog):
 *   "sidebars_shown": [
 *     { "type": "ai-sidebar", "position": "right", "host_hooks": "catalog.chain" }
 *   ]
 *
 * register() returns an unregister() for teardown; registering the same key
 * replaces the prior entry (last writer wins) so a page re-mount is safe.
 */
window.AppUIHostHooks = (function () {
  const _hooks = Object.create(null);

  /** Register page hooks under `key`. Returns an unregister() fn. */
  function register(key, hooks) {
    if (!key || typeof key !== 'string') throw new Error('AppUIHostHooks.register: string key required');
    if (!hooks || typeof hooks !== 'object') throw new Error('AppUIHostHooks.register: hooks object required');
    _hooks[key] = hooks;
    return function unregister() { if (_hooks[key] === hooks) delete _hooks[key]; };
  }

  /** The hooks registered under `key`, or null. */
  function get(key) { return (key && _hooks[key]) || null; }

  /** True if something is registered under `key`. */
  function has(key) { return !!(key && _hooks[key]); }

  /** Remove any registration under `key`. */
  function unregister(key) { if (key && _hooks[key]) delete _hooks[key]; }

  /**
   * Resolve a sidebar's `needs_host` declaration against the hooks registered
   * under `key`, producing the subset of host functions/values the provider
   * accepts. `needsHost` is the provider spec's `needs_host` object, e.g.
   * { context: "optional", onAction: "optional", system: "optional" }. Returns
   * a plain object with only the matching keys that the page actually provided;
   * missing OPTIONAL hooks are simply omitted (the sidebar works without them),
   * and a missing REQUIRED hook is reported via `missing` so a caller can warn.
   */
  function resolve(needsHost, key) {
    const hooks = get(key);
    const out = {}, missing = [];
    if (!needsHost || typeof needsHost !== 'object') return { host: out, missing };
    for (const name of Object.keys(needsHost)) {
      const requirement = needsHost[name];   // "optional" | "required" | true
      const required = requirement === 'required' || requirement === true;
      const value = hooks ? hooks[name] : undefined;
      if (value !== undefined && value !== null) out[name] = value;
      else if (required) missing.push(name);
    }
    return { host: out, missing };
  }

  return { register, get, has, unregister, resolve };
})();

;
/**
 * AppUISelectionBus  --  a tiny shared "current selection" channel.
 *
 * A page and the embedded panels (AI chat, inspectors) often need to agree on
 * "what is selected right now" WITHOUT knowing about each other: a page view
 * publishes its current selection, and any observer (the AI chat's context(),
 * a sibling view, a future "clickable cited tool") reads/subscribes. This is
 * the small shared event the two-way-selection-sync feature (#6) needs.
 *
 * It is namespaced by a SCOPE string (e.g. 'platform/tool_catalog') so independent
 * pages don't cross-talk. A selection is a plain { kind, id, label?, data? }.
 *
 *   const bus = AppUISelectionBus.scope('platform/tool_catalog');
 *   bus.set({ kind: 'node', id: 'file/vfs', label: 'vfs' });   // a view selects
 *   const cur = bus.get();                                     // another reads
 *   const off = bus.subscribe((sel) => { ...highlight sel... });// react to changes
 *   off();                                                     // unsubscribe
 *
 * Deliberately dependency-free (no EventBus/SSE) — it's in-page, synchronous,
 * and additive. Setting an equal selection (same kind+id) is a no-op (no churn).
 */
window.AppUISelectionBus = (function () {
  const _scopes = Object.create(null);

  function scope(name) {
    const key = String(name || 'default');
    let s = _scopes[key];
    if (s) return s;
    let current = null;
    const subs = new Set();
    const same = (a, b) => (!a && !b) || (a && b && a.kind === b.kind && a.id === b.id);
    s = {
      /** The current selection, or null. */
      get() { return current; },
      /** Set the selection; notifies subscribers unless unchanged. */
      set(sel) {
        const next = sel || null;
        if (same(current, next)) return;
        current = next;
        for (const fn of subs) { try { fn(current); } catch (_e) { try { console.warn('AppUISelectionBus subscriber threw:', _e); } catch (_e2) {} } }
      },
      /** Clear the selection. */
      clear() { s.set(null); },
      /** Subscribe to changes; returns an unsubscribe fn. */
      subscribe(fn) {
        if (typeof fn !== 'function') return function () {};
        subs.add(fn);
        return function () { subs.delete(fn); };
      },
    };
    _scopes[key] = s;
    return s;
  }

  return { scope };
})();

;
/* Owned pointer gestures shared by layout and floating controls. */
var AppUIPointerGesture = window.AppUIPointerGesture || (() => {
  const bodyOwners = [];
  let bodyStyles;
  function acquireBody(owner, cursor) {
    if (!bodyOwners.length) bodyStyles = {userSelect:document.body.style.userSelect,cursor:document.body.style.cursor};
    bodyOwners.push({owner,cursor});
    document.body.style.userSelect = 'none';
    document.body.style.cursor = cursor;
  }
  function releaseBody(owner) {
    const index = bodyOwners.findIndex(entry => entry.owner === owner);
    if (index < 0) return;
    bodyOwners.splice(index,1);
    if (bodyOwners.length) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = bodyOwners[bodyOwners.length-1].cursor;
    } else {
      document.body.style.userSelect = bodyStyles.userSelect;
      document.body.style.cursor = bodyStyles.cursor;
      bodyStyles = null;
    }
  }
  function bind(handle, opts = {}) {
    if (!handle) throw new Error('AppUIPointerGesture: handle not found');
    let active = null, destroyed = false;
    const bodyOwner = {};
    const touchAction = handle.style.touchAction;
    handle.style.touchAction = opts.touchAction || 'none';
    function finish(event, notify = true) {
      if (active === null || (event && event.pointerId !== active)) return;
      const pointerId = active;
      active = null;
      releaseBody(bodyOwner);
      if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
      if (notify) opts.onEnd?.(event);
    }
    function down(event) {
      if (destroyed || active !== null || event.button !== (opts.button ?? 0)) return;
      if (opts.shouldStart && !opts.shouldStart(event)) return;
      event.preventDefault();
      active = event.pointerId;
      acquireBody(bodyOwner, opts.cursor || 'col-resize');
      try {
        handle.setPointerCapture(event.pointerId);
        opts.onStart?.(event);
      } catch (error) { finish(event, false); throw error; }
    }
    function move(event) {
      if (active !== event.pointerId) return;
      try { opts.onMove?.(event); }
      catch (error) { finish(event, false); throw error; }
    }
    const end = event => finish(event);
    const listeners = {pointerdown: down, pointermove: move, pointerup: end,
      pointercancel: end, lostpointercapture: end};
    for (const [name, listener] of Object.entries(listeners)) handle.addEventListener(name, listener);
    return {destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const [name, listener] of Object.entries(listeners)) handle.removeEventListener(name, listener);
      finish(null, false);
      handle.style.touchAction = touchAction;
    }};
  }
  function positionHandlers(target, {minLeft=0,minTop=0,onMove} = {}) {
    let start;
    return {
      onStart(event) {
        const rect=target.getBoundingClientRect();
        start={x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
      },
      onMove(event) {
        if(!start)return;
        target.style.left=`${Math.max(minLeft,start.left+event.clientX-start.x)}px`;
        target.style.top=`${Math.max(minTop,start.top+event.clientY-start.y)}px`;
        onMove?.(event);
      },
    };
  }
  /** Bind a pane divider whose position is a percentage of a container. */
  function bindPercentage(handle, {container, direction='horizontal', min=0, max=100, onResize} = {}) {
    const owner = AppUILifecycle.createViewScope({host:handle});
    const vertical = direction === 'vertical';
    let rect;
    owner.add(bind(handle, {
      cursor: vertical ? 'row-resize' : 'col-resize',
      shouldStart() {
        if (!owner.current()) return false;
        const target = typeof container === 'function' ? container() : container;
        rect = target?.getBoundingClientRect();
        return !!rect && rect[vertical ? 'height' : 'width'] > 0;
      },
      onMove(event) {
        const point = vertical ? event.clientY : event.clientX;
        const start = vertical ? rect.top : rect.left;
        const size = vertical ? rect.height : rect.width;
        onResize?.(Math.min(max, Math.max(min, (point - start) / size * 100)), event);
      },
    }));
    return {destroy: () => owner.destroy()};
  }
  return {bind,positionHandlers,bindPercentage};
})();
window.AppUIPointerGesture=AppUIPointerGesture;

;
/* Abortable JSON API client for AppUI features. */
var AppUIApi = window.AppUIApi || (function () {
  function detectBase() {
    if (typeof window === 'undefined') return '';
    if (typeof window.__PYLON_BASE__ === 'string' && window.__PYLON_BASE__) {
      return window.__PYLON_BASE__.replace(/\/+$/, '');
    }
    const p = (window.location && window.location.pathname) || '';
    const m = /^(.+?)\/(?:apps|appui|v1|drive|dependencies)(?:\/|$)/.exec(p);
    return (m && m[1]) ? m[1] : '';
  }

  function resolvePath(path) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return path;
    // A static frontend has its own asset origin. Only operation paths cross
    // to the configured backend; never route arbitrary URLs or assets there.
    if (window.PYLON_API_ORIGIN && /^\/v1\/apps\/[A-Za-z0-9_/-]+$/.test(path)) {
      const origin = new URL(window.PYLON_API_ORIGIN);
      if (origin.protocol !== 'https:' || origin.origin !== window.PYLON_API_ORIGIN)
        throw new Error('Invalid API origin');
      return origin.origin + path;
    }
    const base = detectBase();
    if (!base || path === base || path.startsWith(base + '/')) return path;
    return base + path;
  }

  /** Generate a unique trace ID: hex timestamp + random suffix. */
  function generateTraceId() {
    const ts = Date.now().toString(16);
    const rand = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0');
    return ts + '-' + rand;
  }

  async function performRequest(
    path,
    body,
    { timeout = 120000, signal, method, headers: suppliedHeaders, credentials, decode } = {},
    responseEnvelope = false
  ) {
    const controller = new AbortController();
    const timer = timeout == null ? null : window.setTimeout(() => controller.abort(), timeout);
    const cancel = () => {
      if (timer !== null) window.clearTimeout(timer);
      controller.abort();
    };
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
    const traceId = generateTraceId();
    let reported = false;
    function reportFailure(status, kind) {
      if (reported || signal?.aborted || !window.AppUILogger) return;
      try {
        const pathname = new URL(path, window.location?.href || 'http://localhost/').pathname;
        if (pathname === '/v1/log') return;
        reported = true;
        const level = status >= 400 && status < 500 ? 'warn' : 'error';
        // app_id + op (an op call's path) and the page key the failure's fingerprint, so a client-side failure groups
        // per op / page and the 'repeats for the same path' triage rule can tell one flaky call from a broken one
        const m = /^\/v1\/apps\/(.+)\/([^/]+)$/.exec(pathname);
        window.AppUILogger[level]('HTTP request failed', {
          path: pathname, method: method || (body == null ? 'GET' : 'POST'),
          status: status || 0, kind, trace_id: traceId,
          page: window.location?.pathname || '',
          ...(m ? { app_id: decodeURIComponent(m[1]), op: decodeURIComponent(m[2]) } : { op: pathname.split('/').map((seg) => (/\d|^[0-9a-f-]{12,}$/i.test(seg) ? '*' : seg)).join('/').slice(0, 120) })
        });
      } catch (_) { /* diagnostics must never change request behavior */ }
    }
    try {
      const headers = { ...suppliedHeaders, 'X-Trace-ID': traceId };
      for (const name of Object.keys(headers)) {
        if (name !== 'X-Trace-ID' && name.toLowerCase() === 'x-trace-id') delete headers[name];
      }
      const verb = method == null ? (body == null ? 'GET' : 'POST') : String(method).toUpperCase();
      const opts = { headers, signal: controller.signal };
      if (method != null || verb !== 'GET') opts.method = verb;
      if (verb !== 'GET' && verb !== 'HEAD' && body !== undefined) {
        if (!Object.keys(headers).some((name) => name.toLowerCase() === 'content-type'))
          headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
      if (credentials !== undefined) opts.credentials = credentials;
      const resolved = resolvePath(path);
      if (window.PYLON_API_ORIGIN && resolved.startsWith(window.PYLON_API_ORIGIN + '/v1/apps/')) {
        const token = window.PylonFrontendAuth?.getToken();
        if (!token) throw new Error('Connect Pylon to authorize API access');
        for (const key of Object.keys(headers)) if (key.toLowerCase() === 'authorization') delete headers[key];
        headers.Authorization = 'Bearer ' + token;
        opts.credentials = 'omit'; opts.cache = 'no-store'; opts.redirect = 'error';
      }
      const response = await fetch(resolved, opts);
      if (!response.ok) reportFailure(response.status, "http");
      if (responseEnvelope) {
        const data = typeof decode === 'function' ? await decode(response)
          : verb === 'HEAD' || response.status === 204 || response.status === 205
            ? null : await response.json();
        return {ok: response.ok, status: response.status, data, traceId};
      }
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        try {
          error.response = await response.json();
          const detail = error.response?.error || error.response?._error || error.response?.message;
          if (typeof detail === 'string') error.message = detail;
        } catch (_) {}
        throw error;
      }
      const result =
        verb === 'HEAD' || response.status === 204 || response.status === 205
          ? null
          : await response.json();
      if (result && typeof result === 'object') result._trace_id = traceId;
      return result;
    } catch (error) {
      reportFailure(error.status || 0, error.name === "AbortError" ? "timeout" : "request_failed");
      if (responseEnvelope) throw error;
      return {
        ...(error.response !== undefined ? { response: error.response } : {}),
        _error:
          error.name === 'AbortError'
            ? signal?.aborted
              ? 'Request cancelled'
              : 'Request timed out'
            : error.message,
        _trace_id: traceId,
        status: error.status || 0,
        code: error.name === 'AbortError'
            ? signal?.aborted
              ? 'cancelled'
              : 'timeout'
            : 'request_failed'
      };
    } finally {
      if (timer !== null) window.clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  function request(path, body, options) {
    return performRequest(path, body, options);
  }

  function requestResponse(path, body, options) {
    return performRequest(path, body, options, true);
  }

  function tool(name, params, options) {
    return request('/api/' + String(name).replace(/\./g, '/'), params || {}, options);
  }

  function post(path, body, options) {
    return request(path, body || {}, options);
  }

  function get(path, options) {
    return request(path, null, options);
  }

  /** Call a v2 app operation without throwing across a page's UI handlers.
   * Application failures retain their payload; transport failures use the same
   * {ok:false,error} shape. Options support the existing timeout and signal API.
   */
  async function operation(appId, name, body, options) {
    try {
      const path = String(appId).split('/').map(encodeURIComponent).join('/');
      const response = await requestResponse(
        '/v1/apps/' + path + '/' + encodeURIComponent(name), body || {},
        {...options, method: 'POST'}
      );
      const data = response.data;
      if (!data || typeof data !== 'object' || Array.isArray(data))
        return {ok: false, error: response.ok ? 'Invalid operation response' : 'HTTP ' + response.status};
      if (!response.ok)
        return {...data, ok: false, error: data.error || data._error || 'HTTP ' + response.status};
      if (data._error && !data.error)
        return {...data, ok: false, error: data._error};
      return data;
    } catch (error) {
      const aborted = error.name === 'AbortError';
      return {ok: false, error: aborted
        ? options?.signal?.aborted ? 'Request cancelled' : 'Request timed out'
        : String(error)};
    }
  }

  async function requestOrThrow(path, body, options) {
    const result = await request(path, body, options);
    if (result?._error) {
      const error = new Error(result._error);
      error.status = result.status;
      error.code = result.code;
      error.traceId = result._trace_id;
      throw error;
    }
    return result;
  }

  /** Run an app operation as a platform/work_runner background job and resolve
   * with the operation's own result, like operation() would. A long op (a
   * converter) then survives slow connections and can report progress:
   *   AppUIApi.runJob('analytics/bb', 'convert', {...}, {onProgress: (p, job) => …})
   * p = {fraction|null, done, total, detail, eta_s} (framework.jobprogress), or
   * null while the op has not reported. Falls back to a direct operation() when
   * work_runner explicitly reports it is missing. Options: timeout (seconds,
   * default 3600, covering submit and wait), pollMs (default 1000),
   * idempotencyKey (reuse after an ambiguous submit), signal, label, isolate (run the
   * op in its own Python process — for long CPU-bound converts).
   */
  async function runJob(appId, name, body, options = {}) {
    const timeout = options.timeout ?? 3600, pollMs = options.pollMs ?? 1000;
    if (!Number.isFinite(timeout) || timeout <= 0 || !Number.isFinite(pollMs) || pollMs < 0)
      return {ok: false, error: 'Invalid job timeout or polling interval'};
    const controller = new AbortController();
    const cancel = () => controller.abort();
    const deadline = Date.now() + timeout * 1000;
    let timer;
    const armDeadline = () => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) cancel();
      else timer = setTimeout(armDeadline, Math.min(remaining, 2147483647));
    };
    armDeadline();
    const signal = controller.signal;
    options.signal?.addEventListener('abort', cancel, {once: true});
    if (options.signal?.aborted) cancel();
    let id;
    const stopped = () => signal.aborted || Date.now() >= deadline;
    const stoppedResult = (retrySubmission = true) => ({ok: false, error: options.signal?.aborted ? 'Request cancelled' : 'Request timed out',
      code: options.signal?.aborted ? 'cancelled' : 'timeout', ...(retrySubmission ? {idempotency_key: submissionKey} : {}), ...(id ? {job_id: id} : {})});
    const pause = () => new Promise(resolve => {
      if (stopped()) { resolve(); return; }
      const done = () => { clearTimeout(waitTimer); signal.removeEventListener('abort', done); resolve(); };
      const waitTimer = setTimeout(done, Math.min(pollMs, Math.max(0, deadline - Date.now())));
      signal.addEventListener('abort', done, {once: true});
    });
    const requestOptions = () => ({signal, timeout: Math.max(1, Math.min(60000, deadline - Date.now()))});
    // A caller can reuse this key after an ambiguous submit response. Never
    // execute directly merely because a submission reply was lost.
    const submissionKey = options.idempotencyKey || window.crypto?.randomUUID?.() || generateTraceId();
    try {
      if (stopped()) return stoppedResult();
      const sub = await operation('platform/work_runner', 'submit', {
        kind: 'op', target: 'local', app: appId, op: name, args: body || {}, timeout,
        isolate: !!options.isolate, label: options.label || (appId + '.' + name),
        idempotency_key: submissionKey}, requestOptions());
      id = sub && sub.ok && ((sub.job && (sub.job.id || sub.job.job_id)) || sub.job_id);
      if (stopped()) return stoppedResult();
      if (!id) {
        const error = String(sub?.error || sub?._error || 'Worker returned no job identity');
        const unavailable = /^(?:required )?app ['"]platform\/work_runner['"] (?:is not available|has no op ['"]submit['"])/i.test(error) ||
          /^(?:unknown|missing) (?:app|operation):? (?:platform\/work_runner|submit)$/i.test(error);
        if (unavailable) {
          const result = await operation(appId, name, body, {signal, timeout: Math.max(1, deadline - Date.now())});
          return stopped() ? stoppedResult(false) : result;
        }
        return {...sub, ok: false, error, idempotency_key: submissionKey};
      }
      let useWait = true;
      while (!stopped()) {
        let got;
        if (useWait) {
          got = await operation('platform/work_runner', 'wait',
            {job_id: id, timeout_s: Math.min(options.onProgress ? 3 : 25, Math.max(0.001, (deadline - Date.now()) / 1000))}, requestOptions());
          if (got?.ok === false && /has no op ['"]wait['"]|not found: wait|unknown op:? wait/i.test(String(got.error || got._error || ''))) {
            useWait = false;
            got = null;
          }
        }
        if (stopped()) return stoppedResult();
        if (!got) {
          await pause();
          if (stopped()) return stoppedResult();
          got = await operation('platform/work_runner', 'get', {job_id: id}, requestOptions());
        }
        if (stopped()) return stoppedResult();
        const job = got?.job;
        if (!job) {
          if (/job not found/i.test(String(got?.error || got?._error || '')))
            return {ok: false, error: got.error || got._error, job_id: id};
          await pause();
          continue;
        }
        if (['pending', 'claimed', 'running'].includes(job.status)) {
          try { options.onProgress?.(job.progress || null, job); } catch (_) { /* page hook */ }
          // Avoid a hot loop if a server returns immediately from wait().
          await pause();
          continue;
        }
        const res = job.op_result;
        if (res && typeof res === 'object') return (res._error && !res.error) ? {...res, ok: false, error: res._error} : res;
        return {ok: job.status === 'done', error: job.error || (job.status === 'done' ? '' : 'job ' + job.status), job};
      }
      return stoppedResult();
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      if (id && stopped()) {
        // Best effort: cleanup must neither delay the caller nor reject unhandled.
        operation('platform/work_runner', 'cancel', {job_id: id}, {timeout: 5000}).catch(() => {});
      }
    }
  }

  return { request, requestResponse, requestOrThrow, operation, runJob, tool, get, post, generateTraceId };
})();
window.AppUIApi = AppUIApi;

;
/* Shared structured logging. Deliberately does not intercept console or form data. */
(function () {
  'use strict';
  if (window.AppUILogger) return;
  let windowStart = Date.now(), sent = 0, routine = 0;
  const consoles = new Map();
  const source = location.pathname.replace(/^\/apps\//, '').split('/').filter(Boolean).slice(0, 2).join('/') || 'page';
  function send(level, name, message, fields) {
    if (Date.now() - windowStart >= 60000) {windowStart = Date.now(); sent = 0; routine = 0;}
    if (['debug', 'info'].includes(level) && ++routine > 20) return Promise.resolve(false);
    if (++sent > 60) return Promise.resolve(false);
    return fetch('/v1/log', {method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({level, source: name, message: String(message ?? '').slice(0, 16000), fields: fields || {}})
    }).then(response => response.ok).catch(() => false);
  }
  function create(name = source) {
    return Object.fromEntries(['debug', 'info', 'warn', 'error', 'critical'].map(level =>
      [level, (message, fields) => send(level, name, message, fields)]));
  }
  // Opt-in console-compatible adapter: preserve local arguments, send bounded metadata.
  function consoleFor(name = source) {
    if (consoles.has(name)) return consoles.get(name);
    function summarize(value) {
      if (value instanceof Error) return value.name + ': ' + value.message;
      if (typeof value === 'string') return value.slice(0, 1000);
      if (value == null || ['number', 'boolean', 'bigint'].includes(typeof value)) return String(value);
      if (Array.isArray(value)) return '[Array(' + value.length + ')]';
      return '[object]';
    }
    const adapter = Object.fromEntries(['log', 'debug', 'info', 'warn', 'error'].map(method => [method, (...args) => {
      window.console?.[method]?.(...args);
      try {
        const error = args.find(value => value instanceof Error);
        return send(method === 'log' ? 'debug' : method, name, args.map(summarize).join(' '),
          error ? {stack: String(error.stack || '').slice(0, 12000)} : {});
      } catch (_) {return Promise.resolve(false);}
    }]));
    consoles.set(name, adapter);
    return adapter;
  }
  const api = Object.assign(create(), {create, console: consoleFor});
  window.AppUILogger = api;
  window.addEventListener('error', event => {
    if (event.message) api.error(event.message, {kind: 'uncaught', line: event.lineno,
      stack: event.error?.stack ? String(event.error.stack).slice(0, 12000) : ''});
  });
  window.addEventListener('unhandledrejection', event => {
    api.error(event.reason?.message || String(event.reason), {kind: 'unhandledrejection',
      stack: event.reason?.stack ? String(event.reason.stack).slice(0, 12000) : ''});
  });
})();

;
/* Page-local event service. */
var AppUIEvents = window.AppUIEvents || (function() {
  function create() {
    let destroyed = false;
    const listeners = new Map();
    const disposers = [];

    function on(type, listener) {
      if (destroyed || typeof listener !== 'function') return () => {};
      const group = listeners.get(type) || new Set();
      group.add(listener);
      listeners.set(type, group);
      return () => off(type, listener);
    }

    function once(type, listener) {
      let unsubscribe = () => {};
      unsubscribe = on(type, detail => {
        unsubscribe();
        listener(detail);
      });
      return unsubscribe;
    }

    function off(type, listener) {
      const group = listeners.get(type);
      if (!group) return;
      group.delete(listener);
      if (!group.size) listeners.delete(type);
    }

    function emit(type, detail) {
      if (destroyed) return false;
      (listeners.get(type) || []).forEach(listener => listener(detail));
      (listeners.get('*') || []).forEach(listener => listener({type, detail}));
      return true;
    }

    function subscribeSSE(type, listener) {
      // Legacy SSE method removed — pages should use AppUIEventBus directly:
      //   const bus = new AppUIEventBus(['tools']);
      //   bus.on('tools', eventType, handler);
      console.warn('AppUIEvents.subscribeSSE is deprecated — use AppUIEventBus instead');
      return () => {};
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      listeners.clear();
      disposers.splice(0).reverse().forEach(dispose => dispose());
    }

    return {on, once, off, emit, subscribeSSE, destroy, get destroyed() { return destroyed; }};
  }

  // Adapt an injected shared EventBus without coupling foundation to its bundle.
  function createConnected({channels,replay=0},Bus) {
    const bus=new Bus(channels,{replay});
    let destroyed=false;
    function onChannel(channel,event,listener) {
      if(destroyed || typeof listener!=='function')return()=>{};
      let subscribed=true;
      const handler=(...args)=>{if(!destroyed && subscribed)listener(...args);};
      bus.on(channel,event,handler);
      return()=>{if(!subscribed)return;subscribed=false;bus.off(channel,event,handler);};
    }
    function on(type,listener) {
      const parts=type.split(':');
      return onChannel(parts[0]||'*',parts[1]||'*',listener);
    }
    function onAny(listener) {
      if(destroyed || typeof listener!=='function')return()=>{};
      let subscribed=true;
      const handler=(...args)=>{if(!destroyed && subscribed)listener(...args);};
      bus.onAny(handler);
      return()=>{if(!subscribed)return;subscribed=false;bus.offAny?.(handler);};
    }
    return {on,onChannel,onAny,
      emit(type,detail) {
        if(destroyed)return false;
        const parts=type.split(':');
        return Bus.publish(parts[0]||type,parts[1]||type,detail);
      },
      get bus(){return bus;},get destroyed(){return destroyed;},
      destroy(){if(destroyed)return;destroyed=true;bus.close();},
    };
  }

  return {create,createConnected};
})();
window.AppUIEvents = AppUIEvents;
