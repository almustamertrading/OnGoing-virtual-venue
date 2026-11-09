// Logs in as the mirror's owner account and loads every important page, reporting status,
// error screens and what the finance widgets show. Usage: node compat_check.cjs <baseUrl> <label>
const { chromium } = require('playwright');
const base = process.argv[2], label = process.argv[3];
const P2022 = '02784466-8f7d-44e0-81a6-22c135b55fe7', PROP = '50c1e871-e845-4633-bb20-c8a0ac04b9f2';
const pages = ['/projects', `/projects/${P2022}`, `/projects/${P2022}/finance`, `/projects/${P2022}/procurement`,
  `/projects/${P2022}/pricing`, `/projects/${P2022}/inventory`, `/projects/${P2022}/activity`, `/projects/${P2022}/tasks`,
  '/proposals', `/proposals/${PROP}`, `/proposals/${PROP}/print`];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message.slice(0, 120)));
  await p.goto(base + '/login', { waitUntil: 'networkidle', timeout: 180000 });
  await p.locator('#email').fill('user2@mirror-users.test');
  await p.locator('input[name="password"]').fill('Mirror-Local-Only-1!');
  await p.locator('form button[type="submit"]').click();
  await p.waitForURL(/\/projects/, { timeout: 120000 });
  for (const path of pages) {
    const r = await p.goto(base + path, { waitUntil: 'networkidle', timeout: 180000 });
    await p.waitForTimeout(500);
    const text = await p.locator('body').innerText();
    const broken = /Application error|couldn.t load|Unhandled Runtime Error|could not be found|Something went wrong/i.test(text);
    let note = '';
    if (path.endsWith('/finance')) note = /750,000|1,200,000/.test(text) ? 'invoices shown' : 'invoices NOT shown';
    if (path === `/proposals/${PROP}`) note = (text.match(/الهامش[^\n]*\n?[^\n]*/) || [''])[0].replace(/\n/g, ' ').slice(0, 60);
    if (path.endsWith('/inventory')) note = (text.match(/القيمة الإجمالية[^\n]*/) || ['(no stock value)'])[0].slice(0, 50);
    if (path.endsWith('/procurement')) note = /480,000/.test(text) ? 'quote amounts shown' : 'quote amounts NOT shown';
    console.log(`${label} | ${r.status()} | ${broken ? 'ERROR SCREEN' : 'ok'} | ${path} ${note ? '| ' + note : ''}`);
  }
  if (errors.length) console.log(label, 'browser errors:', [...new Set(errors)].slice(0, 5));
  await b.close();
})().catch(e => { console.log(label, 'FAILED:', e.message.slice(0, 200)); process.exit(1); });
