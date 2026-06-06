from pathlib import Path

root = Path(r'c:\Users\fabia\Desktop\Lixby')
account_files = list(root.rglob('*/account/index.html')) + list(root.rglob('*/cuenta/index.html'))
modified = []
old_account = ('    function writeProfile(profile) {\n'
               '      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));\n'
               '    }')
new_account = ('    function writeProfile(profile) {\n'
               '      const cachedProfile = {\n'
               '        language: profile.language,\n'
               '        timezone: profile.timezone,\n'
               '        photoUrl: profile.photoUrl,\n'
               '        prefAds: profile.prefAds,\n'
               '        prefNews: profile.prefNews,\n'
               '        prefUpdates: profile.prefUpdates,\n'
               '        prefOffers: profile.prefOffers,\n'
               '        prefSupport: profile.prefSupport,\n'
               '        adsOptIn: profile.adsOptIn\n'
               '      };\n'
               '      localStorage.setItem(PROFILE_KEY, JSON.stringify(cachedProfile));\n'
               '    }')

for p in account_files:
    text = p.read_text(encoding='utf-8')
    if old_account in text:
        text = text.replace(old_account, new_account)
        p.write_text(text, encoding='utf-8')
        modified.append(str(p))

cart_files = list(root.rglob('*/cart/index.html')) + list(root.rglob('*/cesta/index.html'))
old_cart = ('      try {\n'
            '        const profile = JSON.parse(localStorage.getItem("lixbyProfile") || "{}");\n'
            '        const customerName = profile.firstName\n'
            '          ? `${profile.firstName} ${profile.lastName || ""}`.trim()\n'
            '          : null;\n\n'
            '        const checkoutItems = buildCheckoutItems(summary.items);')
new_cart = ('      try {\n'
            '        const customerName = auth.currentUser?.displayName || null;\n\n'
            '        const checkoutItems = buildCheckoutItems(summary.items);')

for p in cart_files:
    text = p.read_text(encoding='utf-8')
    updated = False
    if old_cart in text:
        text = text.replace(old_cart, new_cart)
        updated = True
    if '            customerEmail: profile.email || auth.currentUser?.email || null,' in text:
        text = text.replace('            customerEmail: profile.email || auth.currentUser?.email || null,',
                            '            customerEmail: auth.currentUser?.email || null,')
        updated = True
    if '            customerPhone: profile.phone || null' in text:
        text = text.replace('            customerPhone: profile.phone || null',
                            '            customerPhone: auth.currentUser?.phoneNumber || null')
        updated = True
    if updated:
        p.write_text(text, encoding='utf-8')
        modified.append(str(p))

print('modified files:', len(modified))
for f in modified:
    print(f)
