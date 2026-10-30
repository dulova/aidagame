import { test, expect } from '@playwright/test';

const sizes = [
  { width: 320, height: 568 }, { width: 393, height: 664 },
  { width: 390, height: 844 }, { width: 652, height: 1227 },
  { width: 1440, height: 900 }, { width: 1920, height: 1080 },
];
async function box(page: any, selector: string) {
  return page.locator(selector).evaluate((el: HTMLElement) => {
    const r = el.getBoundingClientRect(); return { x: r.x, right: r.right, width: r.width, height: r.height };
  });
}
function aligned(actual: { x: number; width: number }, expected: { x: number; width: number }) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(1);
  expect(Math.abs(actual.width - expected.width)).toBeLessThan(1);
}

test('all screens share one width; the square board, tray and controls stay aligned after idle', async ({ page }) => {
  for (const size of sizes) {
    await page.setViewportSize(size); await page.goto('./');
    await expect(page.locator('#start-game')).toBeEnabled();
    const header = await box(page, '.app-header');
    aligned(await box(page, '.game-card.active, #start-game'), header);
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    aligned(await box(page, '.app-header'), header); expect((await box(page, '.app-header')).height).toBe(header.height); aligned(await box(page, '.theme-grid'), header);
    await page.locator('.settings-back').click(); await page.locator('#start-game').click();
    await page.locator('.board').waitFor();
    expect((await box(page, '.app-header')).height).toBe(header.height);
    for (let i = 0; i < 3; i++) {
      for (const selector of ['.app-header', '.board', '.pieces-panel', '.game-buttons']) aligned(await box(page, selector), header);
      const board = await box(page, '.board'); expect(Math.abs(board.width - board.height)).toBeLessThan(1);
      await page.waitForTimeout(350);
    }
    const shapes = await page.locator('.board-cell').first().evaluate(el => ({ radius: getComputedStyle(el).borderTopLeftRadius, size: el.getBoundingClientRect().width }));
    const radius = parseFloat(shapes.radius) * (shapes.radius.endsWith('%') ? shapes.size / 100 : 1);
    expect(radius / shapes.size).toBeGreaterThan(.05);
    expect(radius / shapes.size).toBeLessThan(.35); // Rounded squares must not approach a circle.
    const footer = await page.locator('.app-footer a').evaluate(el => ({ color: getComputedStyle(el).color, accent: getComputedStyle(document.body).getPropertyValue('--accent').trim(), decoration: getComputedStyle(el).textDecorationLine }));
    expect(footer.decoration).toContain('underline');
    expect(await page.locator('.app-footer a').evaluate(el => {const p=document.createElement('span');p.style.color='var(--accent)';el.append(p);const c=getComputedStyle(p).color;p.remove();return c;})).toBe(footer.color);
    await page.screenshot({ path: test.info().outputPath(`layout-${size.width}.png`), fullPage: true });
  }
});

test('changing mobile browser height cannot gradually shrink or move the board', async ({ page }) => {
  await page.setViewportSize({width:393,height:844}); await page.goto('./'); await page.locator('#start-game').click(); await page.locator('.board').waitFor();
  const initial = await box(page, '.board');
  for (const height of [664, 724, 844, 664, 844]) {
    await page.setViewportSize({width:393,height}); await page.waitForTimeout(250);
    aligned(await box(page, '.board'), initial); aligned(await box(page, '.pieces-panel'), initial);
  }
  await page.reload(); await page.locator('#start-game').click(); await page.locator('.board').waitFor(); aligned(await box(page, '.board'), initial);
});

test('long presses cannot select UI; pinch is cancelled while single-finger page scrolling remains available', async ({ page }) => {
  await page.goto('./');
  const guards = await page.evaluate(() => {
    const title = document.querySelector('.brand-copy')!;
    const selection = new Event('selectstart', {bubbles:true,cancelable:true}); title.dispatchEvent(selection);
    const gesture = new Event('gesturestart', {bubbles:true,cancelable:true}); document.dispatchEvent(gesture);
    const gestureChange = new Event('gesturechange', {bubbles:true,cancelable:true}); document.dispatchEvent(gestureChange);
    const touch = (count: number) => {const e=new Event('touchmove',{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:Array(count).fill({})});document.dispatchEvent(e);return e.defaultPrevented;};
    return {selection:selection.defaultPrevented, gesture:gesture.defaultPrevented, change:gestureChange.defaultPrevented, pinch:touch(2), scroll:touch(1), userSelect:getComputedStyle(title).userSelect, touchAction:getComputedStyle(document.documentElement).touchAction, viewport:document.querySelector('meta[name=viewport]')!.getAttribute('content')};
  });
  expect(guards).toMatchObject({selection:true,gesture:true,change:true,pinch:true,scroll:false,userSelect:'none',touchAction:'pan-y'});
  expect(guards.viewport).toContain('maximum-scale=1'); expect(guards.viewport).toContain('user-scalable=no');
  const brand=await page.locator('.brand-copy').boundingBox(); await page.mouse.move(brand!.x+5,brand!.y+5); await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.move(brand!.x+100,brand!.y+20); await page.mouse.up();
  expect(await page.evaluate(()=>getSelection()?.toString())).toBe('');
});

test('a native two-finger pinch does not zoom or place a figure', async ({page,context,isMobile,browserName}) => {
  test.skip(!isMobile || browserName !== 'chromium', 'Native touch dispatch uses mobile Chromium CDP');
  await page.goto('./'); await page.locator('#start-game').click(); await page.locator('.board').waitFor();
  const cdp = await context.newCDPSession(page); const initial = await box(page,'.board');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:130,y:270,id:1},{x:190,y:270,id:2}]});
  for (let i=0;i<6;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:130-i*8,y:270,id:1},{x:190+i*8,y:270,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await page.evaluate(()=>visualViewport!.scale)).toBe(1); aligned(await box(page,'.board'),initial);
  await expect(page.locator('.score-current')).toHaveText('0'); await expect(page.locator('.drag-ghost')).toHaveCount(0);
});
