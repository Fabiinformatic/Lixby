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
const accountFiles = files.filter((f) => /\/(account|cuenta)\/index\.html$/.test(f.replace(/\\/g, '/')));
const oldRE = /^[ \t]*function writeProfile\(profile\) \{\r?\n[ \t]*localStorage\.setItem\(PROFILE_KEY, JSON\.stringify\(profile\)\);\r?\n[ \t]*\}/gm;
const newText = `    function writeProfile(profile) {
      const cachedProfile = {
        language: profile.language,
        timezone: profile.timezone,
        photoUrl: profile.photoUrl,
        prefAds: profile.prefAds,
        prefNews: profile.prefNews,
        prefUpdates: profile.prefUpdates,
        prefOffers: profile.prefOffers,
        prefSupport: profile.prefSupport,
        adsOptIn: profile.adsOptIn
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(cachedProfile));
    }`;

const modified = [];
for (const file of accountFiles) {
  let content = fs.readFileSync(file, 'utf8');
  if (oldRE.test(content)) {
    content = content.replace(oldRE, newText);
    fs.writeFileSync(file, content, 'utf8');
    modified.push(file);
  }
}

console.log('modified files:', modified.length);
for (const file of modified) {
  console.log(file);
}
