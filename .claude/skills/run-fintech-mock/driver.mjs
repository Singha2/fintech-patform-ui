// Browser driver for the fintech mock UI in LIVE mode. Drives the system Chrome via playwright-core
// (no browser download). See SKILL.md for setup + prerequisites.
//
// Usage (from repo root, dev server on :5173, backend on :8080):
//   node .claude/skills/run-fintech-mock/driver.mjs                        # smoke: super/ops (admin widget) + investor + buyer
//   node .claude/skills/run-fintech-mock/driver.mjs ops@dev.local /s5      # admin: login, goto <path>, screenshot
//   node .claude/skills/run-fintech-mock/driver.mjs investor@dev.local     # investor: passwordless login → marketplace
//   node .claude/skills/run-fintech-mock/driver.mjs ack@dev.local          # buyer: /s15 ack-user portal login
// Login flow is inferred from the email (investor* → investor, ack* → buyer, else admin).
//
// Env: APP_URL (default http://localhost:5173) · CHROME_PATH (auto-detected if unset).
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const BASE = process.env.APP_URL || 'http://localhost:5173'
const OUT = new URL('./screenshots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => existsSync(p))
if (!CHROME) { console.error('No Chrome found — set CHROME_PATH to a Chrome/Chromium binary'); process.exit(1) }

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errs = []
page.on('console', m => m.type() === 'error' && errs.push(m.text()))
const shot = async name => { const p = OUT + name + '.png'; await page.screenshot({ path: p, fullPage: true }); console.log('  📸', p) }

const otpReady = () => page.waitForFunction(() => (document.querySelector('#otp')?.value || '').length === 6, { timeout: 15000 })

// Admin password login (S1 LiveLogin): #email + #password → Login → OTP auto-fills from /dev/last-otp → Verify.
async function loginAdmin(email, password = 'DevPass123!') {
  await page.goto(BASE + '/s1', { waitUntil: 'networkidle' })
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.getByRole('button', { name: 'Login' }).click()
  await page.waitForSelector('#otp', { timeout: 15000 })
  await otpReady()
  await page.getByRole('button', { name: /Verify/ }).click()
  await page.waitForSelector('text=Work Queue', { timeout: 20000 })   // S2 dashboard rendered
}

// Passwordless investor login (S1 "Investor?" toggle, BE-18): email → Send OTP → auto-fill → Verify → /s11.
async function loginInvestor(email = 'investor@dev.local') {
  await page.goto(BASE + '/s1', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Investor\?/ }).click()     // switch to passwordless mode
  await page.fill('#email', email)
  await page.getByRole('button', { name: 'Send OTP' }).click()
  await otpReady()
  await page.getByRole('button', { name: /Verify/ }).click()
  await page.waitForURL('**/s11', { timeout: 20000 })                // lands on the marketplace
}

// Passwordless buyer ack-user login (S15 standalone portal, BE-15): email → Send OTP → auto-fill → Verify.
async function loginBuyer(email = 'ack@dev.local') {
  await page.goto(BASE + '/s15', { waitUntil: 'networkidle' })
  await page.fill('#email', email)
  await page.getByRole('button', { name: 'Send OTP' }).click()
  await otpReady()
  await page.getByRole('button', { name: /Verify/ }).click()
  await page.waitForSelector('text=Per-invoice acknowledgment', { timeout: 20000 })
}

// Pick the login flow from the email.
const loginFor = email => /investor/i.test(email) ? () => loginInvestor(email)
  : /^ack|acknowledg/i.test(email) ? () => loginBuyer(email)
    : () => loginAdmin(email)

const [emailArg, pathArg] = process.argv.slice(2)
try {
  if (emailArg) {
    console.log('▶ login', emailArg)
    await loginFor(emailArg)()
    if (pathArg) await page.goto(BASE + pathArg, { waitUntil: 'networkidle' })
    await shot(emailArg.split('@')[0] + (pathArg ? pathArg.replace(/\//g, '-') : ''))
  } else {
    // Default smoke: all four login flows + the super-admin-only widget gate.
    console.log('▶ super@dev.local (admin)')
    await loginAdmin('super@dev.local')
    console.log('  Admin & Roles widget visible:', await page.locator('text=Admin & Roles').first().isVisible().catch(() => false))
    await shot('s2-super')
    await page.getByRole('button', { name: 'Log out' }).click()
    await page.waitForSelector('#email', { timeout: 10000 })

    console.log('▶ ops@dev.local (admin)')
    await loginAdmin('ops@dev.local')
    console.log('  Admin & Roles widget present:', (await page.locator('text=Admin & Roles').count()) > 0)
    await shot('s2-ops')

    console.log('▶ investor@dev.local (passwordless)')
    await loginInvestor()
    console.log('  landed on marketplace:', page.url().includes('/s11'))
    await shot('s11-investor')

    console.log('▶ ack@dev.local (buyer portal)')
    await loginBuyer()
    console.log('  buyer portal open:', await page.locator('text=Per-invoice acknowledgment').first().isVisible().catch(() => false))
    await shot('s15-buyer')
  }
  console.log('console errors:', errs.length ? errs.slice(0, 3) : 'none')
} finally {
  await browser.close()
}
