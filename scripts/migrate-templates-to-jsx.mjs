import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const root = resolve(process.cwd(), "web", "src");
const templatesDir = join(root, "templates");
const pagesDir = join(root, "pages");
const entriesDir = join(root, "entries");

const attrNameMap = new Map([
  ["class", "className"],
  ["for", "htmlFor"],
  ["colspan", "colSpan"],
  ["rowspan", "rowSpan"],
  ["maxlength", "maxLength"],
  ["minlength", "minLength"],
  ["tabindex", "tabIndex"],
  ["readonly", "readOnly"],
  ["autocomplete", "autoComplete"],
  ["autofocus", "autoFocus"],
  ["spellcheck", "spellCheck"],
  ["inputmode", "inputMode"],
  ["contenteditable", "contentEditable"],
  ["stroke-width", "strokeWidth"],
  ["stroke-linecap", "strokeLinecap"],
  ["stroke-linejoin", "strokeLinejoin"],
  ["fill-rule", "fillRule"],
  ["clip-rule", "clipRule"],
]);

const voidTags = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];

const toComponentName = (name) =>
  `${name
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")}Page`;

const toCamel = (value) =>
  value.trim().replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());

function styleToJsx(style) {
  const entries = style
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((declaration) => {
      const colon = declaration.indexOf(":");
      if (colon === -1) return null;
      const key = toCamel(declaration.slice(0, colon));
      const value = declaration.slice(colon + 1).trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `${JSON.stringify(key)}: "${value}"`;
    })
    .filter(Boolean);

  return `style={{ ${entries.join(", ")} }}`;
}

function convertTagAttributes(tag) {
  return tag
    .replace(/\sstyle="([^"]*)"/g, (_match, style) => ` ${styleToJsx(style)}`)
    .replace(/\s([A-Za-z_:][\w:.-]*)(=)/g, (match, rawName, equals) => {
      if (rawName.startsWith("aria-") || rawName.startsWith("data-")) return match;
      return ` ${attrNameMap.get(rawName.toLowerCase()) || rawName}${equals}`;
    })
    .replace(/\schecked(?=[\s/>])/g, " defaultChecked")
    .replace(/\sreadonly(?=[\s/>])/gi, " readOnly")
    .replace(/\sfor(?=[\s/>])/g, " htmlFor");
}

function selfCloseVoidTags(markup) {
  return voidTags.reduce((next, tag) => {
    const pattern = new RegExp(`<${tag}([^<>]*?)(?<!/)\\s*>`, "gi");
    return next.replace(pattern, (_match, attrs) => `<${tag}${attrs} />`);
  }, markup);
}

function convertTemplate(markup) {
  let jsx = markup
    .replace(/<!--([\s\S]*?)-->/g, (_match, comment) => `{/*${comment.replace(/\*\//g, "* /")}*/}`)
    .replace(/<([A-Za-z][\w:-]*)(\s[^<>]*?)?>/g, (match) => convertTagAttributes(match));

  jsx = selfCloseVoidTags(jsx);
  jsx = jsx.replace(/>(\s*)>(\s*)</g, ">$1&gt;$2<");

  return jsx.trim();
}

mkdirSync(pagesDir, { recursive: true });

for (const file of readdirSync(templatesDir).filter((name) => name.endsWith(".html"))) {
  const pageName = basename(file, ".html");
  const componentName = toComponentName(pageName);
  const source = readFileSync(join(templatesDir, file), "utf8");
  const jsx = convertTemplate(source);

  writeFileSync(
    join(pagesDir, `${componentName}.jsx`),
    `export default function ${componentName}() {\n  return (\n    <>\n${jsx
      .split("\n")
      .map((line) => `      ${line}`)
      .join("\n")}\n    </>\n  );\n}\n`,
    "utf8"
  );

  writeFileSync(
    join(entriesDir, `${pageName}.jsx`),
    `import { renderPage } from "../renderPage.jsx";\nimport ${componentName} from "../pages/${componentName}.jsx";\n\nrenderPage(${componentName});\n`,
    "utf8"
  );
}
