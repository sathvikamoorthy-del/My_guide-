// knm-managed: v1 version: 1
// knm-context helper (built from apps/vscode/src/tools/knm-context.ts by esbuild; do not edit). Needs Node >= 18.
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/tools/knm-context.ts
var knm_context_exports = {};
__export(knm_context_exports, {
  CliError: () => CliError,
  ENGINE_FROM: () => ENGINE_FROM,
  HELPER_VERSION: () => HELPER_VERSION,
  ValidationFailed: () => ValidationFailed,
  addUser: () => addUser,
  installEngine: () => installEngine,
  listMocks: () => listMocks,
  mockRoot: () => mockRoot,
  newApp: () => newApp,
  newMock: () => newMock,
  nextMockId: () => nextMockId,
  run: () => run,
  smokeMock: () => smokeMock,
  validateMock: () => validateMock
});
module.exports = __toCommonJS(knm_context_exports);
var fs2 = __toESM(require("node:fs"));
var path2 = __toESM(require("node:path"));
var import_node_child_process = require("node:child_process");

// src/contextDoc.ts
var CONTEXT_PATH = "docs/project/context.md";
var DOCS_DIR = "docs/project";
var MOCK_DIR = "docs/mock";
var STATUSES = ["draft", "final"];
var SECTION = /^##\s+Documents\s*$/i;
var FACT = /^([A-Za-z][A-Za-z ]*?):\s*(.*)$/;
var norm = (p) => p.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
var cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
var isRule = (line) => /^[\s|:-]+$/.test(line) && line.includes("-");
var isRow = (line) => line.trim().startsWith("|");
var clean = (s) => s.replace(/\s*\|\s*/g, " / ").replace(/\s+/g, " ").trim();
var rowLine = (r) => `| ${r.path} | ${r.what} | ${r.status} | ${r.by} |`;
function parseContext(text) {
  const facts = [];
  const documents = [];
  let inDocs = false, hasSection = false, head = true;
  for (const line of text.split(/\r?\n/)) {
    if (SECTION.test(line)) {
      inDocs = true;
      hasSection = true;
      head = false;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      if (inDocs) inDocs = false;
      if (!/^#\s/.test(line)) head = false;
      continue;
    }
    if (inDocs && isRow(line) && !isRule(line)) {
      const c = cells(line);
      if (c[0]?.toLowerCase() === "path") continue;
      if (c[0]) documents.push({ path: norm(c[0]), what: c[1] ?? "", status: (c[2] ?? "").toLowerCase(), by: c[3] ?? "" });
    } else if (head) {
      const m = FACT.exec(line);
      if (m && m[2].trim()) facts.push([m[1].trim(), m[2].trim()]);
    }
  }
  return { facts, documents, hasSection };
}
function setFact(text, key, value) {
  const v = clean(value);
  const lines = text ? text.split(/\r?\n/) : ["# Project context"];
  let end = lines.findIndex((l) => /^##\s/.test(l));
  if (end < 0) end = lines.length;
  const at = lines.findIndex((l, i) => i < end && FACT.test(l) && FACT.exec(l)[1].trim().toLowerCase() === key.toLowerCase());
  if (at >= 0) lines[at] = `${key}: ${v}`;
  else {
    let last = -1;
    for (let i = 0; i < end; i++) if (FACT.test(lines[i]) || /^#\s/.test(lines[i])) last = i;
    lines.splice(last + 1, 0, ...last + 1 === 1 && !FACT.test(lines[0]) ? [""] : [], `${key}: ${v}`);
  }
  return lines.join("\n").replace(/\n*$/, "\n");
}
function upsertDocument(text, row) {
  const r = { path: norm(row.path), what: clean(row.what), status: STATUSES.includes(row.status) ? row.status : "draft", by: clean(row.by) || "user" };
  if (!r.path) throw new Error("path is empty");
  const lines = text ? text.split(/\r?\n/) : ["# Project context"];
  const s = lines.findIndex((l) => SECTION.test(l));
  if (s < 0) {
    return [...lines.filter((l, i) => !(i === lines.length - 1 && l === "")), "", "## Documents", "| Path | What | Status | Added by |", "|---|---|---|---|", rowLine(r), ""].join("\n");
  }
  let e = s + 1;
  while (e < lines.length && !/^#{1,6}\s/.test(lines[e])) e++;
  let first = -1, last = -1, same = -1;
  for (let i = s + 1; i < e; i++) {
    if (!isRow(lines[i])) continue;
    if (first < 0) first = i;
    last = i;
    if (!isRule(lines[i]) && norm(cells(lines[i])[0] ?? "") === r.path) same = i;
  }
  if (same >= 0) lines[same] = rowLine(r);
  else if (first >= 0) lines.splice(last + 1, 0, rowLine(r));
  else lines.splice(s + 1, 0, "| Path | What | Status | Added by |", "|---|---|---|---|", rowLine(r));
  return lines.join("\n").replace(/\n*$/, "\n");
}
var CMD = { import: "knm.importFeatures", walkthrough: "knm.createWalkthrough", db: "knm.createDbDesign" };
function validateContext(input) {
  const findings = [];
  if (input.text === null) {
    findings.push({ id: "no-context", level: "missing", message: "docs/project/context.md does not exist. The skills create it, or add it yourself.", action: { kind: "open", path: CONTEXT_PATH, label: "Create context.md" } });
  }
  const p = parseContext(input.text ?? "");
  const files = new Set(input.files.map(norm));
  const exists = (path3) => !path3.startsWith(`${DOCS_DIR}/`) && path3 !== DOCS_DIR ? !!input.exists?.(path3) : files.has(path3) || (path3.endsWith("/") ? [...files].some((f) => f.startsWith(path3)) : [...files].some((f) => f.startsWith(path3 + "/")));
  const documents = p.documents.map((d) => ({ ...d, exists: exists(d.path) }));
  if (input.text !== null && !p.hasSection) findings.push({ id: "no-section", level: "problem", message: 'context.md has no "## Documents" table.', action: { kind: "open", path: CONTEXT_PATH, label: "Open context.md" } });
  const seen = /* @__PURE__ */ new Set();
  for (const d of documents) {
    if (seen.has(d.path)) findings.push({ id: `dup:${d.path}`, level: "problem", message: `${d.path} is listed more than once.` });
    seen.add(d.path);
    if (!d.exists) findings.push({ id: `gone:${d.path}`, level: "problem", message: `${d.path} is listed but does not exist.`, action: { kind: "remove", path: d.path, label: "Remove row" } });
    if (!STATUSES.includes(d.status)) findings.push({ id: `status:${d.path}`, level: "problem", message: `${d.path}: status "${d.status}" must be draft or final.`, action: { kind: "open", path: CONTEXT_PATH, label: "Open context.md" } });
  }
  const listed = (f) => seen.has(f) || [...seen].some((s) => s.endsWith("/") ? f === s.slice(0, -1) || f.startsWith(s) : f.startsWith(s + "/"));
  for (const f of [...files].sort()) {
    if (f === CONTEXT_PATH) continue;
    if (!listed(f)) findings.push({ id: `unlisted:${f}`, level: "problem", message: `${f} is in docs/project but not listed in context.md.`, action: { kind: "list", path: f, label: "List it" } });
  }
  for (const m of input.mocks ?? []) {
    if (!listed(m)) findings.push({ id: `unlisted:${m}`, level: "problem", message: `${m} (a walkthrough) is not listed in context.md.`, action: { kind: "list", path: m, label: "List it" } });
  }
  const fact = (k) => p.facts.find(([n]) => n.toLowerCase() === k.toLowerCase())?.[1];
  const missingFacts = ["Target DB", "Stack", "Roles"].filter((k) => !fact(k));
  if (missingFacts.length) findings.push({ id: "facts", level: "missing", message: `${missingFacts.join(", ")} not set (the DB design and the walkthrough need them).`, action: { kind: "open", path: CONTEXT_PATH, label: "Open context.md" } });
  const live = documents.filter((d) => d.exists);
  const isSource = (d) => d.by.toLowerCase() === "user" || /blueprint|requirement|spec|brief/i.test(d.what);
  if (!live.some(isSource)) findings.push({ id: "no-source", level: "missing", message: "No source document is listed (blueprint, requirements or spec).", action: { kind: "open", path: CONTEXT_PATH, label: "Open context.md" } });
  if (!documents.some((d) => d.by === "import-features")) findings.push({ id: "no-features", level: "missing", message: "Features are not imported yet.", action: { kind: "command", command: CMD.import, label: "Import features" } });
  if (!live.some((d) => /(^|\/)db_design\.md$/.test(d.path))) findings.push({ id: "no-db", level: "missing", message: "No DB design.", action: { kind: "command", command: CMD.db, label: "Create DB design" } });
  if (!live.some((d) => d.path.startsWith(`${MOCK_DIR}/`))) findings.push({ id: "no-walkthrough", level: "missing", message: "No walkthrough.", action: { kind: "command", command: CMD.walkthrough, label: "Create walkthrough" } });
  return { exists: input.text !== null, facts: p.facts, documents, findings };
}

// src/contextFs.ts
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
var readContext = (root) => {
  try {
    return fs.readFileSync(path.join(root, CONTEXT_PATH), "utf8");
  } catch {
    return null;
  }
};
function listProjectFiles(root) {
  const out = [];
  const base = path.join(root, DOCS_DIR);
  const walk = (dir) => {
    for (const e of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === ".DS_Store") continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(root, p).split(path.sep).join("/"));
    }
  };
  walk(base);
  return out.sort();
}
function listMockDirs(root) {
  const base = path.join(root, MOCK_DIR);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\d+$/.test(e.name)).map((e) => `${MOCK_DIR}/${e.name}/`).sort();
}
var checkContext = (root) => validateContext({ text: readContext(root), files: listProjectFiles(root), mocks: listMockDirs(root), exists: (p) => fs.existsSync(path.join(root, p)) });
function write(root, text) {
  const f = path.join(root, CONTEXT_PATH);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
}
var addDocument = (root, row) => write(root, upsertDocument(readContext(root) ?? "", row));
var setContextFact = (root, key, value) => write(root, setFact(readContext(root) ?? "", key, value));

// src/tools/knm-context.ts
var HELPER_VERSION = 1;
var CliError = class extends Error {
  constructor(msg) {
    super(msg);
  }
};
var USAGE = `Usage:
  knm-context add <path> --what "<text>" [--status draft|final] [--by <skill>]
  knm-context set <Key> <value>
  knm-context check
  knm-context new-mock
  knm-context mocks
  knm-context install-engine --mock <id>
  knm-context new-app <name> --title "<Title>" --platform mobile|desktop --mock <id>
  knm-context add-user <key> --name "<Name>" --role-label "<Role>" --color "#rrggbb" --mock <id> --app <app> [--side <side>]
  knm-context validate-mock <id> [--app <name>]
  knm-context smoke-mock <id> --app <name>`;
var ENGINE_FROM = ".project-knm/tools/walkthrough";
function flags(argv) {
  const positional = [], f = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const name = argv[i].slice(2);
      if (!["what", "status", "by", "title", "platform", "mock", "app", "name", "role-label", "color", "side"].includes(name)) throw new CliError(`Unknown option --${name}
${USAGE}`);
      if (i + 1 >= argv.length) throw new CliError(`Option --${name} needs a value`);
      f[name] = argv[++i];
    } else positional.push(argv[i]);
  }
  return { positional, f };
}
var MARKER = /knm-managed:\s*v1(?:\s+version:\s*(\d+))?/;
var version = (text) => {
  const m = MARKER.exec(text.slice(0, 800));
  return m ? m[1] ? Number(m[1]) : 1 : null;
};
function installEngine(root, mock) {
  const from = path2.join(root, ENGINE_FROM);
  if (!fs2.existsSync(from)) throw new CliError(`The bundled walkthrough engine is missing (${ENGINE_FROM}). Run "KNM: Install files" in VSCode.`);
  const res = { installed: [], updated: [], kept: [] };
  const walk = (dir) => {
    for (const e of fs2.readdirSync(dir, { withFileTypes: true })) {
      const src = path2.join(dir, e.name);
      if (e.isDirectory()) {
        if (dir === from && e.name === "template") continue;
        walk(src);
        continue;
      }
      const rel = path2.relative(from, src).split(path2.sep).join("/");
      const dst = path2.join(root, mockRoot(mock), "walkthrough", rel);
      const content = fs2.readFileSync(src, "utf8");
      if (!fs2.existsSync(dst)) {
        fs2.mkdirSync(path2.dirname(dst), { recursive: true });
        fs2.writeFileSync(dst, content);
        res.installed.push(rel);
        continue;
      }
      const iv = version(fs2.readFileSync(dst, "utf8")), bv = version(content);
      if (iv !== null && bv !== null && bv > iv) {
        fs2.writeFileSync(dst, content);
        res.updated.push(rel);
      } else res.kept.push(rel);
    }
  };
  walk(from);
  return res;
}
var mockRoot = (id) => `${MOCK_DIR}/${id}`;
var MOCK_ID = /^\d{1,6}$/;
var APP_NAME = /^[a-z][a-z0-9-]{0,38}$/;
function listMocks(root) {
  const base = path2.join(root, MOCK_DIR);
  if (!fs2.existsSync(base)) return [];
  return fs2.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory() && MOCK_ID.test(e.name)).map((e) => e.name).sort().map((id) => {
    const reg = path2.join(base, id, "apps", "apps.json");
    let apps = [];
    try {
      apps = JSON.parse(fs2.readFileSync(reg, "utf8")).apps ?? [];
    } catch {
    }
    return { id, apps };
  });
}
function nextMockId(root) {
  const ids = listMocks(root).map((m) => m.id);
  const width = Math.max(3, ...ids.map((i) => i.length));
  return String(ids.reduce((m, i) => Math.max(m, Number(i)), 0) + 1).padStart(width, "0");
}
function needMock(root, id) {
  if (!id || !MOCK_ID.test(id)) throw new CliError('--mock <id> is needed (the number of a folder in docs/mock; "mocks" lists them)');
  if (!fs2.existsSync(path2.join(root, mockRoot(id)))) throw new CliError(`${mockRoot(id)} does not exist (new-mock creates the next one)`);
  return id;
}
function newMock(root) {
  const id = nextMockId(root);
  fs2.mkdirSync(path2.join(root, mockRoot(id)), { recursive: true });
  return { id, root: mockRoot(id), installed: installEngine(root, id).installed };
}
function newApp(root, mock, name, title, platform) {
  if (!APP_NAME.test(name)) throw new CliError(`App name "${name}" must be lowercase letters, digits and dashes`);
  if (platform !== "mobile" && platform !== "desktop") throw new CliError("--platform must be mobile or desktop");
  needMock(root, mock);
  const tpl = path2.join(root, ENGINE_FROM, "template");
  if (!fs2.existsSync(tpl)) throw new CliError(`The bundled template is missing (${ENGINE_FROM}/template). Run "KNM: Install files" in VSCode.`);
  const rel = `${mockRoot(mock)}/apps/${name}`;
  const base = path2.join(root, rel);
  if (fs2.existsSync(base) && fs2.readdirSync(base).length) throw new CliError(`${rel} already exists`);
  const created = [];
  const put = (p, content) => {
    const f = path2.join(base, p);
    fs2.mkdirSync(path2.dirname(f), { recursive: true });
    fs2.writeFileSync(f, content);
    created.push(`${rel}/${p}`);
  };
  const walk = (dir) => {
    for (const e of fs2.readdirSync(dir, { withFileTypes: true })) {
      const src = path2.join(dir, e.name);
      if (e.isDirectory()) walk(src);
      else put(path2.relative(tpl, src).split(path2.sep).join("/"), fs2.readFileSync(src, "utf8"));
    }
  };
  walk(tpl);
  const json = (v) => JSON.stringify(v, null, 2) + "\n";
  put("app.json", json({ name, title, spec: CONTEXT_PATH, walkthroughs: [] }));
  put("mock-app/mock-data/users.json", json({}));
  put("roles.json", json({}));
  put("mock-app/mock-data/seeds/default.json", json({ _sample: "Sample data only. Names, ids and numbers are invented." }));
  put("mock-app/mock-data/spec/screens.json", json([]));
  put("sequences/.gitkeep", "");
  put("gaps/.gitkeep", "");
  const reg = path2.join(root, mockRoot(mock), "apps", "apps.json");
  const apps = fs2.existsSync(reg) ? JSON.parse(fs2.readFileSync(reg, "utf8")) : { apps: [] };
  if (apps.apps.some((a) => a.name === name)) throw new CliError(`${name} is already in ${mockRoot(mock)}/apps/apps.json`);
  apps.apps.push({ name, title, platform });
  fs2.writeFileSync(reg, json(apps));
  return { app: name, created };
}
var USER_KEY = /^[a-z][a-z0-9_-]{0,38}$/;
var COLOR = /^#[0-9a-fA-F]{6}$/;
function addUser(root, mock, app, key, o) {
  if (!USER_KEY.test(key)) throw new CliError(`User key "${key}" must be lowercase letters, digits, dashes or underscores, and not start with "_" (those are metadata)`);
  if (!COLOR.test(o.color)) throw new CliError("--color must be a hex colour like #2563eb");
  needMock(root, mock);
  const rel = `${mockRoot(mock)}/apps/${app}`;
  if (!fs2.existsSync(path2.join(root, rel, "app.json"))) throw new CliError(`${rel} does not exist (new-app creates it)`);
  const read = (p) => {
    try {
      return JSON.parse(fs2.readFileSync(path2.join(root, rel, p), "utf8"));
    } catch {
      return {};
    }
  };
  const files = ["mock-app/mock-data/users.json", "roles.json"];
  const users = read(files[0]), roles = read(files[1]);
  users[key] = { name: o.name, roleLabel: o.roleLabel, ...o.side ? { side: o.side } : {} };
  roles[key] = { label: o.roleLabel, color: o.color };
  files.forEach((p, i) => fs2.writeFileSync(path2.join(root, rel, p), JSON.stringify(i ? roles : users, null, 2) + "\n"));
  return { user: key, files: files.map((p) => `${rel}/${p}`) };
}
function smokeMock(root, mock, app) {
  needMock(root, mock);
  const cli = path2.join(root, mockRoot(mock), "walkthrough", "smoke-cli.mjs");
  if (!fs2.existsSync(cli)) throw new CliError(`The engine in ${mockRoot(mock)} has no smoke-cli.mjs. Run: knm-context install-engine --mock ${mock}`);
  const r = (0, import_node_child_process.spawnSync)(process.execPath, [cli, "--app", app], { cwd: root, encoding: "utf8", timeout: 9e4 });
  return { ok: r.status === 0, skipped: r.status === 2, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}
var ValidationFailed = class extends Error {
  constructor(output) {
    super("the walkthrough validator reported problems");
    this.output = output;
  }
  output;
};
function validateMock(root, mock, app) {
  needMock(root, mock);
  const cli = path2.join(root, mockRoot(mock), "walkthrough", "validate-cli.mjs");
  if (!fs2.existsSync(cli)) throw new CliError(`The engine is missing in ${mockRoot(mock)}. Run: knm-context install-engine --mock ${mock}`);
  const r = (0, import_node_child_process.spawnSync)(process.execPath, [cli, ...app ? ["--app", app] : []], { cwd: root, encoding: "utf8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0) throw new ValidationFailed(out);
  if (app && process.env.KNM_SMOKE !== "0") {
    const smoke = smokeMock(root, mock, app);
    if (!smoke.ok && !smoke.skipped) throw new ValidationFailed(out + smoke.output);
    return out + smoke.output;
  }
  return out;
}
function run(argv, root) {
  const [cmd, ...rest] = argv;
  const { positional, f } = flags(rest);
  switch (cmd) {
    case "add": {
      const p = positional[0];
      if (!p) throw new CliError(`Missing path.
${USAGE}`);
      if (!f.what) throw new CliError(`Missing --what.
${USAGE}`);
      if (f.status && !STATUSES.includes(f.status)) throw new CliError(`--status must be draft or final`);
      addDocument(root, { path: p, what: f.what, status: f.status ?? "draft", by: f.by ?? "user" });
      return JSON.stringify({ ok: true, context: CONTEXT_PATH, path: p }) + "\n";
    }
    case "set": {
      const [key, ...value] = positional;
      if (!key || !value.length) throw new CliError(`Usage: set <Key> <value>`);
      setContextFact(root, key, value.join(" "));
      return JSON.stringify({ ok: true, context: CONTEXT_PATH, key }) + "\n";
    }
    case "check":
      return JSON.stringify(checkContext(root), null, 2) + "\n";
    case "new-mock":
      return JSON.stringify({ ok: true, ...newMock(root) }, null, 2) + "\n";
    case "mocks":
      return JSON.stringify({ mocks: listMocks(root), next: nextMockId(root) }, null, 2) + "\n";
    case "install-engine": {
      const id = needMock(root, f.mock);
      return JSON.stringify({ ok: true, to: `${mockRoot(id)}/walkthrough`, ...installEngine(root, id) }, null, 2) + "\n";
    }
    case "new-app": {
      const name = positional[0];
      if (!name || !f.title || !f.platform) throw new CliError(`Usage: new-app <name> --title "<Title>" --platform mobile|desktop --mock <id>`);
      return JSON.stringify({ ok: true, ...newApp(root, needMock(root, f.mock), name, f.title, f.platform) }, null, 2) + "\n";
    }
    case "add-user": {
      const key = positional[0];
      if (!key || !f.name || !f["role-label"] || !f.color || !f.app) throw new CliError('Usage: add-user <key> --name "<Name>" --role-label "<Role>" --color "#rrggbb" --mock <id> --app <app> [--side <side>]');
      return JSON.stringify({ ok: true, ...addUser(root, needMock(root, f.mock), f.app, key, { name: f.name, roleLabel: f["role-label"], color: f.color, side: f.side }) }, null, 2) + "\n";
    }
    case "smoke-mock": {
      const id = positional[0];
      if (!id || !f.app) throw new CliError("Usage: smoke-mock <id> --app <name>");
      const r = smokeMock(root, id, f.app);
      if (!r.ok && !r.skipped) throw new ValidationFailed(r.output);
      return r.output;
    }
    case "validate-mock": {
      const id = positional[0];
      if (!id) throw new CliError("Usage: validate-mock <id> [--app <name>]");
      return validateMock(root, id, f.app);
    }
    default:
      throw new CliError(`Unknown command "${cmd ?? ""}".
${USAGE}`);
  }
}
function main() {
  try {
    process.stdout.write(run(process.argv.slice(2), process.cwd()));
  } catch (e) {
    if (e instanceof ValidationFailed) {
      process.stdout.write(e.output);
      process.exit(1);
    }
    process.stderr.write((e instanceof CliError ? e.message : `Unexpected error: ${e.message}`).replace(/\n+$/, "") + "\n");
    process.exit(1);
  }
}
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) main();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CliError,
  ENGINE_FROM,
  HELPER_VERSION,
  ValidationFailed,
  addUser,
  installEngine,
  listMocks,
  mockRoot,
  newApp,
  newMock,
  nextMockId,
  run,
  smokeMock,
  validateMock
});
