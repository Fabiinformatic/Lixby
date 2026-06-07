const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'es', 'style.css');
if (!fs.existsSync(source)) {
  console.error('Source es/style.css not found');
  process.exit(1);
}
const data = fs.readFileSync(source, 'utf8');

const entries = fs.readdirSync(root, { withFileTypes: true });
const modified = [];
for (const ent of entries) {
  if (!ent.isDirectory()) continue;
  const localeDir = path.join(root, ent.name);
  if (ent.name === 'es') continue; // skip source
  const target = path.join(localeDir, 'style.css');
  if (fs.existsSync(target)) {
    fs.writeFileSync(target, data, 'utf8');
    modified.push(target);
  }
}

console.log('modified files:', modified.length);
for (const f of modified) console.log(f);
