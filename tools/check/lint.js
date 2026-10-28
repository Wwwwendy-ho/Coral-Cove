/* Lints Coral Cove's JavaScript and looks for code that can never run.
   - eslint (rules in .eslintrc.json) on the app's main script and on library.js, words.js, storage.js and sw.js.
     The main script is checked whole, as built into index.html (its files in src/js/ share variables), and each
     problem is reported at its file and line in src/;
   - functions that nothing can call, followed through chains (a function only called by other dead functions
     is dead too), which eslint alone doesn't see.
   Exits with 1 when anything is found. Usage: node lint.js */
const fs = require('fs'), path = require('path'), os = require('os');
const { ESLint } = require('eslint');
const acorn = require('acorn'), walk = require('acorn-walk');
const ROOT = path.join(__dirname, '..', '..');

function mainScript() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const re = /<script>([\s\S]*?)<\/script>/g; let m, best = null;
  while ((m = re.exec(html))) if (!best || m[1].length > best[1].length) best = m;
  const before = html.slice(0, best.index + '<script>'.length).split('\n').length - 1;
  return '\n'.repeat(before) + best[1];   // padded so line numbers are index.html's
}

// index.html line -> 'src/js/file.js:line', using the comment lines tools/build.py puts around each file
const INDEX_LINES = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n');
function where(file, line) {
  if (!file.endsWith('index.html.js')) return path.basename(file) + ':' + line;
  for (let i = line - 2; i >= 0; i--) {
    const m = INDEX_LINES[i].match(/^\/\* (from|end of) (src\/\S+) \*\/$/);
    if (m) return m[1] === 'from' ? m[2] + ':' + (line - 1 - i) : 'src/page.html (index.html:' + line + ')';
  }
  return 'src/page.html (index.html:' + line + ')';
}

function deadFunctions(src) {
  const ast = acorn.parse(src, { ecmaVersion: 2022, locations: true, allowReturnOutsideFunction: true });
  const decls = []; walk.full(ast, n => { if (n.type === 'FunctionDeclaration' && n.id) decls.push(n); });
  const names = new Set(decls.map(d => d.id.name)), uses = [];
  walk.ancestor(ast, { Identifier(n, st, anc) {
    const parent = anc[anc.length - 2];
    if ((parent && parent.type === 'FunctionDeclaration' && parent.id === n) || !names.has(n.name)) return;
    uses.push({ name: n.name, owner: [...anc].reverse().find(a => a.type === 'FunctionDeclaration' && a !== n) || null });
  } });
  let dead = new Set();
  for (let round = 0; round < 50; round++) {
    const live = new Set();
    uses.forEach(u => { if (!u.owner || (!dead.has(u.owner) && u.owner.id.name !== u.name)) live.add(u.name); });
    const next = new Set(decls.filter(d => !live.has(d.id.name)));
    if (next.size === dead.size) break; dead = next;
  }
  return [...dead].map(n => ({ name: n.id.name, line: n.loc.start.line }));
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cove-lint-'));
  const main = path.join(tmp, 'index.html.js'); fs.writeFileSync(main, mainScript());
  const files = [main, ...['library.js', 'words.js', 'storage.js', 'sw.js'].map(f => path.join(ROOT, f))];
  const eslint = new ESLint({ useEslintrc: false, overrideConfigFile: path.join(__dirname, '.eslintrc.json') });
  const results = await eslint.lintFiles(files);
  let problems = 0;
  for (const r of results) for (const m of r.messages) {
    problems++;
    console.log(`${where(r.filePath, m.line)}:${m.column}  ${m.message}  (${m.ruleId})`);
  }
  for (const f of files) {
    for (const d of deadFunctions(fs.readFileSync(f, 'utf8'))) { problems++; console.log(`${where(f, d.line)}  function ${d.name} can never run`); }
  }
  console.log(problems ? problems + ' problem(s)' : 'lint: clean');
  process.exit(problems ? 1 : 0);
})();
