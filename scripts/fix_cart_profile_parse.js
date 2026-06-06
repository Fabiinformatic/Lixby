const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

function walk(dir) {
  let res = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      res = res.concat(walk(p));
    } else if (entry.isFile() && p.endsWith('index.html')) {
      res.push(p);
    }
  }
  return res;
}

const files = walk(root);
const cartFiles = files.filter((f) => /(\/cart|\/cesta)\/index\.html$/.test(f.replace(/\\/g, '/')));
const oldBlock = /const profile = JSON\.parse\(localStorage\.getItem\("lixbyProfile"\) \|\| "\{\}"\);[\s\S]*?const checkoutItems = buildCheckoutItems\(summary\.items\);/g;
const replacement = `        const customerName = auth.currentUser?.displayName || null;\n\n        const checkoutItems = buildCheckoutItems(summary.items);`;
const modified = [];
for (const file of cartFiles) {
  let content = fs.readFileSync(file, 'utf8');
  const newContent = content.replace(oldBlock, replacement);
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    modified.push(file);
  }
}
console.log('modified files:', modified.length);
for (const file of modified) console.log(file);
