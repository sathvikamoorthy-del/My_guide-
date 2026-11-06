// knm-managed: v1 version: 1
// knm-api helper (built from apps/vscode/src/tools/knm-api.ts by esbuild; do not edit). Needs Node >= 18.
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

// src/tools/knm-api.ts
var knm_api_exports = {};
__export(knm_api_exports, {
  CliError: () => CliError,
  HELPER_VERSION: () => HELPER_VERSION,
  buildUrl: () => buildUrl,
  parseArgs: () => parseArgs,
  readCreds: () => readCreds,
  readWorkspaceBase: () => readWorkspaceBase,
  request: () => request,
  resolveAuth: () => resolveAuth,
  run: () => run
});
module.exports = __toCommonJS(knm_api_exports);
var fs = __toESM(require("node:fs"));
var os = __toESM(require("node:os"));
var path = __toESM(require("node:path"));
var HELPER_VERSION = 1;
var SIGN_IN = 'Run "KNM: Sign in" in VSCode.';
var CliError = class extends Error {
  constructor(msg, code = 1) {
    super(msg);
    this.code = code;
  }
  code;
};
var VALUE_FLAGS = /* @__PURE__ */ new Set(["json", "file", "query", "entity-type", "entity-id", "key", "filename", "message", "project"]);
function parseArgs(argv) {
  const out2 = { positional: [], flags: {}, stdin: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--stdin") {
      out2.stdin = true;
      continue;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (!VALUE_FLAGS.has(name)) throw new CliError(`Unknown option --${name}`);
      let val;
      if (eq > 0) val = a.slice(eq + 1);
      else {
        if (i + 1 >= argv.length) throw new CliError(`Option --${name} needs a value`);
        val = argv[++i];
      }
      (out2.flags[name] ??= []).push(val);
    } else out2.positional.push(a);
  }
  return out2;
}
var one = (p, name) => p.flags[name]?.[p.flags[name].length - 1];
function readCreds(home, file = process.env.KNM_CREDENTIALS) {
  try {
    const j = JSON.parse(fs.readFileSync(file || path.join(home, ".knm", "credentials"), "utf8"));
    return j && typeof j === "object" ? { apiBaseUrl: typeof j.apiBaseUrl === "string" ? j.apiBaseUrl : void 0, token: typeof j.token === "string" ? j.token : void 0 } : null;
  } catch {
    return null;
  }
}
function readWorkspaceBase(cwd) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(cwd, ".project-knm", "context", "config.json"), "utf8"));
    return typeof j?.apiBaseUrl === "string" && j.apiBaseUrl ? j.apiBaseUrl : void 0;
  } catch {
    return void 0;
  }
}
function resolveAuth(home, cwd) {
  const c = readCreds(home);
  if (!c?.token) throw new CliError(`Not signed in to KNM (no token in ~/.knm/credentials). ${SIGN_IN}`);
  const base = (c.apiBaseUrl || readWorkspaceBase(cwd) || "").replace(/\/+$/, "");
  if (!base) throw new CliError(`No KNM API address (not in ~/.knm/credentials nor .project-knm/context/config.json). ${SIGN_IN}`);
  return { base, token: c.token };
}
function buildUrl(base, p, queries = []) {
  if (!p.startsWith("/")) p = "/" + p;
  if (!p.startsWith("/api/")) throw new CliError(`Path must start with /api/ (got ${p})`);
  const [pathname, existing] = p.split("?", 2);
  const qs = new URLSearchParams(existing ?? "");
  for (const q of queries) {
    const i = q.indexOf("=");
    if (i < 1) throw new CliError(`--query expects k=v (got "${q}")`);
    qs.append(q.slice(0, i), q.slice(i + 1));
  }
  const s = qs.toString();
  return base + pathname + (s ? "?" + s : "");
}
var redact = (s, token) => token ? s.split(token).join("[token]") : s;
function oneLine(s) {
  return s.replace(/\s+/g, " ").trim();
}
async function request(env, method, p, o = {}) {
  const { base, token } = resolveAuth(env.home, env.cwd);
  const url = buildUrl(base, p, o.queries);
  if (o.body !== void 0) {
    try {
      JSON.parse(o.body);
    } catch (e) {
      throw new CliError(`The request body is not valid JSON: ${e.message}`);
    }
  }
  let res;
  try {
    res = await env.fetch(url, { method, headers: { authorization: `Bearer ${token}`, ...o.body !== void 0 ? { "content-type": "application/json" } : {} }, body: o.body });
  } catch (e) {
    throw new CliError(redact(`Cannot reach the KNM API at ${base}: ${e.message}`, token));
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
  }
  if (!res.ok || json?.success === false) {
    const msg = json?.error ?? (text ? text.slice(0, 200) : res.statusText);
    const details = json?.details ? ` (${json.details})` : "";
    const hint = res.status === 401 || res.status === 403 ? ` ${SIGN_IN}` : "";
    throw new CliError(redact(oneLine(`${method} ${new URL(url).pathname} failed: ${res.status} ${msg}${details}.${hint}`), token));
  }
  if (!json || json.success !== true) throw new CliError(`Unexpected reply from ${base} (not a KNM API envelope)`);
  return json.data;
}
var out = (data) => data === void 0 ? "" : JSON.stringify(data, null, 2) + "\n";
function readBody(p, env) {
  const sources = [one(p, "json") !== void 0, one(p, "file") !== void 0, p.stdin].filter(Boolean).length;
  if (sources > 1) throw new CliError("Use only one of --json, --file, --stdin");
  if (one(p, "json") !== void 0) return one(p, "json");
  if (one(p, "file") !== void 0) return readFile(one(p, "file"), env);
  if (p.stdin) return env.stdin();
  return void 0;
}
function readFile(f, env) {
  try {
    return fs.readFileSync(path.resolve(env.cwd, f), "utf8");
  } catch (e) {
    throw new CliError(`Cannot read file ${f}: ${e.code ?? e.message}`);
  }
}
var LISTS = { decision: "/api/decisions", requirement: "/api/requirements", workitem: "/api/work-items", test: "/api/test-cases" };
async function getById(env, kind, id, project) {
  const list = LISTS[kind];
  if (!list) throw new CliError(`get needs a kind: ${Object.keys(LISTS).join(", ")}`);
  let ids = [];
  if (project) ids = [project];
  else {
    let ws;
    try {
      ws = JSON.parse(fs.readFileSync(path.join(env.cwd, ".project-knm", "context", "config.json"), "utf8")).projectId || void 0;
    } catch {
    }
    const all = (await request(env, "GET", "/api/projects")).map((x) => x.id);
    ids = ws && all.includes(ws) ? [ws, ...all.filter((x) => x !== ws)] : all;
  }
  for (const pid of ids) {
    const rows = await request(env, "GET", list, { queries: [`projectId=${pid}`] });
    const hit = rows.find((r) => r.id === id);
    if (hit) return { ...hit, projectId: pid };
  }
  throw new CliError(`${kind} ${id} not found in your projects`);
}
var USAGE = `Usage:
  knm-api.js <GET|POST|PUT|PATCH|DELETE> /api/... [--json '<body>' | --file f.json | --stdin] [--query k=v ...]
  knm-api.js upload --entity-type T --entity-id ID --key K [--filename F] (--file path | --stdin)
  knm-api.js get <decision|requirement|workitem|test> <id> [--project id]   (adds projectId to the entity)
  knm-api.js whoami`;
async function run(argv, env) {
  const p = parseArgs(argv);
  const cmd = p.positional[0];
  if (!cmd || cmd === "help") throw new CliError(USAGE);
  if (cmd === "whoami") {
    const { base } = resolveAuth(env.home, env.cwd);
    const projects = await request(env, "GET", "/api/projects");
    let projectId;
    try {
      projectId = JSON.parse(fs.readFileSync(path.join(env.cwd, ".project-knm", "context", "config.json"), "utf8")).projectId || void 0;
    } catch {
    }
    return out({ apiBaseUrl: base, signedIn: true, workspaceProjectId: projectId ?? null, projects: projects.map((x) => ({ id: x.id, name: x.name })) });
  }
  if (cmd === "get") {
    if (!p.positional[1] || !p.positional[2]) throw new CliError("get needs <kind> <id>");
    return out(await getById(env, p.positional[1], p.positional[2], one(p, "project")));
  }
  if (cmd === "upload") {
    const entityType = one(p, "entity-type"), entityId = one(p, "entity-id"), key = one(p, "key");
    if (!entityType || !entityId || !key) throw new CliError("upload needs --entity-type, --entity-id and --key");
    if (one(p, "file") === void 0 && !p.stdin) throw new CliError("upload needs --file <path> or --stdin");
    if (one(p, "file") !== void 0 && p.stdin) throw new CliError("Use only one of --file, --stdin");
    const content = p.stdin ? env.stdin() : readFile(one(p, "file"), env);
    const body2 = { entityType, entityId, key, content, filename: one(p, "filename") ?? (one(p, "file") ? path.basename(one(p, "file")) : void 0), message: one(p, "message") };
    return out(await request(env, "POST", "/api/documents/upload", { body: JSON.stringify(body2) }));
  }
  const method = cmd.toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new CliError(`Unknown command "${cmd}".
${USAGE}`);
  const target = p.positional[1];
  if (!target) throw new CliError(`Missing path.
${USAGE}`);
  const body = readBody(p, env);
  return out(await request(env, method, target, { body, queries: p.flags["query"] }));
}
async function main() {
  const env = { home: os.homedir(), cwd: process.cwd(), fetch: globalThis.fetch, stdin: () => fs.readFileSync(0, "utf8") };
  if (typeof env.fetch !== "function") {
    process.stderr.write("knm-api needs Node 18 or newer (global fetch)\n");
    process.exit(1);
  }
  try {
    process.stdout.write(await run(process.argv.slice(2), env));
  } catch (e) {
    const msg = e instanceof CliError ? e.message : `Unexpected error: ${e.message}`;
    process.stderr.write(msg.replace(/\n+$/, "") + "\n");
    process.exit(1);
  }
}
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) void main();
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CliError,
  HELPER_VERSION,
  buildUrl,
  parseArgs,
  readCreds,
  readWorkspaceBase,
  request,
  resolveAuth,
  run
});
