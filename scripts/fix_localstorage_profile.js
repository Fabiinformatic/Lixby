const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const glob = require('glob');
const modified = [];

const accountFiles = glob.sync('**/account/index.html', { cwd: root, nodir: true }).map(p => path.join(root, p)).concat(
  glob.sync('**/cuenta/index.html', { cwd: root, nodir: true }).map(p => path.join(root, p))
);
const oldAccount = '    function writeProfile(profile) {\n      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));\n    }';
const newAccount = '    function writeProfile(profile) {\n      const cachedProfile = {\n        language: profile.language,\n        timezone: profile.timezone,\n        photoUrl: profile.photoUrl,\n        prefAds: profile.prefAds,\n        prefNews: profile.prefNews,\n        prefUpdates: profile.prefUpdates,\n        prefOffers: profile.prefOffers,\n        prefSupport: profile.prefSupport,\n        adsOptIn: profile.adsOptIn\n      };\n      localStorage.setItem(PROFILE_KEY, JSON.stringify(cachedProfile));\n    }';

for (const file of accountFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(oldAccount)) {
    fs.writeFileSync(file, text.replace(oldAccount, newAccount), 'utf8');
    modified.push(file);
  }
}

const cartFiles = glob.sync('**/cart/index.html', { cwd: root, nodir: true }).map(p => path.join(root, p)).concat(
  glob.sync('**/cesta/index.html', { cwd: root, nodir: true }).map(p => path.join(root, p))
);
const oldCart = '      try {\n        const profile = JSON.parse(localStorage.getItem("lixbyProfile") || "{}");\n        const customerName = profile.firstName\n          ? `${profile.firstName} ${profile.lastName || ""}`.trim()\n          : null;\n\n        const checkoutItems = buildCheckoutItems(summary.items);';
const newCart = '      try {\n        const customerName = auth.currentUser?.displayName || null;\n\n        const checkoutItems = buildCheckoutItems(summary.items);';
for (const file of cartFiles) {
  let text = fs.readFileSync(file, 'utf8');
  let updated = false;
  if (text.includes(oldCart)) {
    text = text.replace(oldCart, newCart);
    updated = true;
  }
  if (text.includes('            customerEmail: profile.email || auth.currentUser?.email || null,')) {
    text = text.replace('            customerEmail: profile.email || auth.currentUser?.email || null,', '            customerEmail: auth.currentUser?.email || null,');
    updated = true;
  }
  if (text.includes('            customerPhone: profile.phone || null')) {
    text = text.replace('            customerPhone: profile.phone || null', '            customerPhone: auth.currentUser?.phoneNumber || null');
    updated = true;
  }
  if (updated) {
    fs.writeFileSync(file, text, 'utf8');
    modified.push(file);
  }
}

console.log('modified files:', modified.length);
for (const file of modified) {
  console.log(file);
}
