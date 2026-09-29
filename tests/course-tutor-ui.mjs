import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Uses installed Playwright or an existing bundled runtime; never installs browsers.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : 'playwright'
);
const base = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
assert.ok(
  process.env.COURSE_TUTOR_QA_OUTPUT_DIR,
  'Set COURSE_TUTOR_QA_OUTPUT_DIR to an output directory outside the repository',
);
const output = path.resolve(process.env.COURSE_TUTOR_QA_OUTPUT_DIR);
assert.ok(
  !output.startsWith(process.cwd() + path.sep),
  'Screenshots belong outside source',
);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [],
  warnings = [],
  external = [],
  mutations = [],
  checks = [],
  playback = [];
const record = (message) => {
  checks.push(message);
  console.log('PASS:', message);
};
let iframeRequests = 0,
  expectedNetworkFailure = false;
let injectResponseLoss = false,
  lostRequest;
await page.route(
  '**/api/course-tutor/conversations/*/messages',
  async (route) => {
    if (!injectResponseLoss) return route.continue();
    injectResponseLoss = false;
    lostRequest = route.request().postDataJSON();
    await route.fetch({ timeout: 15000 });
    expectedNetworkFailure = true;
    await route.abort('failed');
  },
);
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (!['error', 'warning'].includes(m.type())) return;
  const location = m.location().url;
  if (location && !location.startsWith(base)) external.push(m.text());
  else if (expectedNetworkFailure && /Failed to load resource/.test(m.text()))
    warnings.push('Expected injected response loss');
  else if (m.type() === 'error') errors.push(m.text());
  else warnings.push(m.text());
});
page.on('request', (r) => {
  if (r.isNavigationRequest() && r.url().includes('player.bilibili.com'))
    iframeRequests++;
  if (
    r.url().startsWith(base + '/api/') &&
    !['GET', 'HEAD'].includes(r.method())
  )
    mutations.push(new URL(r.url()).pathname);
});
const tutor = page.getByRole('region', { name: '砖芯 AI课程Tutor' });
const toggle = page.getByRole('button', {
  name: '问砖芯 AI',
  exact: true,
});
const tick = () => new Promise((r) => setTimeout(r, 150));
async function until(fn, description) {
  for (let n = 0; n < 100; n++) {
    if (await fn()) return;
    await tick();
  }
  throw new Error('Timed out: ' + description);
}
async function json(url) {
  const r = await context.request.get(base + url);
  assert.equal(r.status(), 200, await r.text());
  return r.json();
}
async function open() {
  if (!(await tutor.isVisible())) await toggle.click();
  await until(
    () =>
      tutor.getByRole('button', { name: '换种说法', exact: true }).isEnabled(),
    'tutor ready',
  );
}
async function minimize() {
  await tutor
    .getByRole('button', { name: '最小化问砖芯 AI', exact: true })
    .click();
  await toggle.waitFor();
}
async function exitImmersive() {
  await page.getByRole('button', { name: '退出沉浸', exact: true }).click();
  await page.getByRole('button', { name: '沉浸学习', exact: true }).waitFor();
}
async function go(lesson, openTutor = true) {
  await page.goto(base + '/?lesson=' + lesson, {
    waitUntil: 'domcontentloaded',
  });
  await toggle.waitFor();
  assert.equal(await page.title(), '砖芯 AI · 初一数学');
  assert.equal(new URL(page.url()).searchParams.get('lesson'), lesson);
  assert.ok((await page.locator('main').innerText()).length > 100);
  assert.equal(
    await page.locator('vite-error-overlay, nextjs-portal').count(),
    0,
  );
  if (openTutor) await open();
}

let playingVideo = null,
  lastPlaybackTime = 0;
async function checkPlayback(step) {
  if (!playingVideo) return;
  const before = await playingVideo.evaluate((v) => v.currentTime);
  assert.ok(
    before >= lastPlaybackTime - 0.1,
    step + ': playback position must not reset',
  );
  await until(
    () =>
      playingVideo.evaluate(
        (v, time) => !v.paused && v.currentTime > time + 0.3,
        before,
      ),
    step + ': playback advances',
  );
  lastPlaybackTime = await playingVideo.evaluate((v) => v.currentTime);
  playback.push({
    step,
    before,
    after: lastPlaybackTime,
  });
}
async function verifyImmersion(lesson) {
  playingVideo = null;
  lastPlaybackTime = 0;
  await go(lesson, false);
  const iframe = page.locator('.lesson-player iframe');
  const handle = await iframe.elementHandle(),
    normal = await iframe.boundingBox();
  if (process.env.VERIFY_BILIBILI_PLAYBACK === 'true') {
    const frame = await handle.contentFrame();
    playingVideo = frame.locator('video').first();
    await playingVideo.waitFor({ state: 'attached', timeout: 45000 });
    await until(
      () => playingVideo.evaluate((v) => v.readyState >= 2),
      'Bilibili video ready',
    );
    await playingVideo.evaluate(async (v) => {
      v.muted = true;
      await v.play();
    });
    await checkPlayback(lesson + ': normal mode');
  }
  const requests = iframeRequests;
  assert.equal(
    await tutor.isVisible(),
    false,
    'Fresh course starts without pre-opening Tutor',
  );
  await screenshot(lesson + '-normal');
  await page.getByRole('button', { name: '沉浸学习', exact: true }).click();
  await tutor.waitFor();
  await until(
    () =>
      tutor.getByRole('button', { name: '换种说法', exact: true }).isEnabled(),
    'first-entry Tutor ready without prior Ask click',
  );
  await screenshot(lesson + '-first-entry-tutor');
  const enlarged = await iframe.boundingBox();
  assert.ok(
    enlarged.width > normal.width + 100 &&
      enlarged.height > normal.height + 100,
    'Video visibly enlarges',
  );
  assert.equal(
    await tutor.isVisible(),
    true,
    'Entering immersive mode directly opens Tutor',
  );
  await checkPlayback(lesson + ': direct-entry tutor');
  await minimize();
  const button = await toggle.boundingBox();
  assert.ok(
    button.x >= enlarged.x &&
      button.y >= enlarged.y &&
      button.x + button.width <= enlarged.x + enlarged.width,
  );
  assert.ok(
    button.y + button.height <= enlarged.y + enlarged.height - 45,
    'Ask button clears player controls',
  );
  assert.equal(
    await toggle.evaluate(
      (el) =>
        el.parentElement.querySelector('iframe')?.parentElement ===
        el.parentElement,
    ),
    true,
  );
  await checkPlayback(lesson + ': enter immersive');
  await screenshot(lesson + '-immersive-minimized');
  await open();
  await checkPlayback(lesson + ': open tutor');
  const panel = await page.locator('.cw-tutor-panel').boundingBox();
  assert.ok(panel.width >= 360 && panel.width <= 420);
  assert.ok(
    panel.x >= enlarged.x &&
      panel.y >= enlarged.y &&
      panel.x + panel.width <= enlarged.x + enlarged.width,
  );
  await minimize();
  await checkPlayback(lesson + ': minimize tutor');
  await exitImmersive();
  const restored = await iframe.boundingBox();
  assert.ok(
    Math.abs(restored.width - normal.width) <= 1 &&
      Math.abs(restored.height - normal.height) <= 1,
  );
  assert.equal(await page.locator('.topbar').evaluate((el) => el.inert), false);
  assert.notEqual(
    await page.locator('body').evaluate((el) => el.style.overflow),
    'hidden',
  );
  await checkPlayback(lesson + ': exit immersive');
  assert.equal(await handle.evaluate((el) => el.isConnected), true);
  assert.equal(
    iframeRequests,
    requests,
    'Mode and panel transitions must not navigate the iframe',
  );
  assert.equal(
    await page.evaluate(() => document.fullscreenElement === null),
    true,
  );
  await open();
  record(
    lesson +
      ': first entry opens Tutor without prior Ask click; enlarge, sibling overlay, minimize, exit, layout restore, stable iframe',
  );
}
async function send(message) {
  await tutor
    .getByRole('textbox', { name: '问问砖芯 AI', exact: true })
    .fill(message);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/messages') && r.request().method() === 'POST',
  );
  await tutor.getByRole('button', { name: '发送', exact: true }).click();
  const r = await response;
  assert.equal(r.status(), 200, await r.text());
  const d = await r.json();
  await until(
    () =>
      tutor
        .locator('.ct-message')
        .count()
        .then((n) => n === d.messages.length),
    'saved message rendered',
  );
  return d;
}
async function action(name) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/messages') && r.request().method() === 'POST',
  );
  await tutor.getByRole('button', { name, exact: true }).click();
  const r = await response;
  assert.equal(r.status(), 200, await r.text());
  await until(
    () => tutor.getByRole('button', { name, exact: true }).isEnabled(),
    'action complete',
  );
  return r.json();
}
async function state() {
  const [evidence, journey, learning] = await Promise.all([
    json('/api/v2/state'),
    json('/api/journey'),
    json('/api/learning'),
  ]);
  return {
    states: evidence.states,
    throughSeq: evidence.throughSeq,
    journey,
    learning,
  };
}
async function screenshot(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(output, name + '.png'),
    fullPage: false,
  });
}
try {
  await verifyImmersion('number-line');
  assert.equal(
    (await json('/api/course-tutor/context?lessonId=number-line')).available,
    false,
    'Run deterministic UI tests with AI_TUTOR_ENABLED=false; use a separate live-provider check',
  );
  const before = await state(),
    mutationStart = mutations.length;
  const frame = await page.locator('.lesson-player iframe').elementHandle(),
    frameCount = iframeRequests;
  for (let n = 0; n < 2; n++) {
    await minimize();
    await open();
  }
  let thread = await send('数轴上的原点有什么用？');
  await checkPlayback('number-line: send message');
  const normalId = thread.conversation.id;
  await send('懂了');
  for (const name of ['换种说法', '举个例子', '画图解释', '出题检查'])
    thread = await action(name);
  await tutor
    .getByText('本次自测暂不计入正式掌握状态', { exact: true })
    .waitFor();
  assert.deepEqual(
    await state(),
    before,
    'Chat must leave formal records unchanged',
  );
  assert.ok(
    mutations
      .slice(mutationStart)
      .every((url) => url.startsWith('/api/course-tutor/')),
  );
  assert.equal(await frame.evaluate((el) => el.isConnected), true);
  assert.equal(
    iframeRequests,
    frameCount,
    'Toggle/send must not reload Bilibili',
  );
  record('normal course: four actions; stable iframe; no formal state writes');
  await screenshot('course-desktop');

  const count = thread.messages.length;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await open();
  await until(
    () =>
      tutor
        .locator('.ct-message')
        .count()
        .then((n) => n === count),
    'refresh restores chat',
  );
  assert.equal(
    (await json('/api/course-tutor/conversations?lessonId=number-line'))
      .conversations[0].id,
    normalId,
  );
  record('refresh restores the same conversation');

  // Lose the HTTP response after D1 has committed, then retry the exact same requestId.
  injectResponseLoss = true;
  await tutor
    .getByRole('textbox', { name: '问问砖芯 AI', exact: true })
    .fill('谢谢');
  await tutor.getByRole('button', { name: '发送', exact: true }).click();
  await tutor
    .getByRole('button', { name: '重试这条消息', exact: true })
    .waitFor();
  const replay = page.waitForRequest(
    (r) => r.url().endsWith('/messages') && r.method() === 'POST',
  );
  await tutor
    .getByRole('button', { name: '重试这条消息', exact: true })
    .click();
  assert.deepEqual((await replay).postDataJSON(), lostRequest);
  await until(
    () =>
      tutor
        .locator('.ct-message')
        .count()
        .then((n) => n === count + 2),
    'safe retry',
  );
  expectedNetworkFailure = false;
  record(
    'lost response retry preserves requestId and adds exactly one message pair',
  );

  // Existing exercise navigation is independent of course chat state.
  const questionFrame = await page
    .locator('.lesson-player iframe')
    .elementHandle();
  await exitImmersive();
  await page.locator('#answer').fill('5');
  await page.getByRole('button', { name: '提交答案', exact: true }).click();
  await page.getByRole('button', { name: '下一道题', exact: true }).click();
  await open();
  assert.equal(await tutor.locator('.ct-message').count(), count + 2);
  assert.equal(await questionFrame.evaluate((el) => el.isConnected), true);
  record('next question preserves course chat and iframe');

  await verifyImmersion('absolute');
  assert.equal(await tutor.locator('.ct-message').count(), 0);
  await tutor.getByText('S05', { exact: true }).waitFor();
  const absoluteBefore = await state();
  thread = await action('画图解释');
  const absoluteId = thread.conversation.id;
  await tutor.getByRole('img', { name: /到原点的距离/ }).waitFor();
  await action('出题检查');
  await send('会了');
  assert.deepEqual(await state(), absoluteBefore);
  await tutor.getByRole('log').evaluate((el) => (el.scrollTop = 0));
  await screenshot('absolute-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  const landscape = await page.locator('.course-workspace').evaluate((el) => ({
    width: el.clientWidth, height: el.clientHeight,
    panelWidth: el.querySelector('.cw-tutor-panel').clientWidth,
    videoWidth: el.querySelector('iframe').clientWidth,
    background: getComputedStyle(el.querySelector('.cw-tutor-panel')).backgroundColor,
  }));
  assert.ok(
    landscape.width === 844 && landscape.height === 390 &&
      landscape.panelWidth <= landscape.width * .46 &&
      landscape.videoWidth === 844,
    'Portrait mobile enters landscape with a right overlay and full-width video',
  );
  assert.match(landscape.background, /rgba\(.+, 0\.58\)/, 'Panel is translucent');
  await checkPlayback('absolute: mobile landscape fallback');
  await page.screenshot({
    path: path.join(output, 'absolute-mobile-tutor.png'),
  });
  const mobileFrame = await page
      .locator('.lesson-player iframe')
      .elementHandle(),
    mobileRequests = iframeRequests;
  await minimize();
  await checkPlayback('absolute: narrow-screen minimize');
  await screenshot('absolute-mobile-minimized');
  await open();
  await checkPlayback('absolute: narrow-screen reopen');
  await page.setViewportSize({ width: 844, height: 390 });
  const turned = await page.locator('.course-workspace').evaluate((el) => ({
    width: el.clientWidth, height: el.clientHeight, transform: getComputedStyle(el).transform,
  }));
  assert.deepEqual(turned, { width: 844, height: 390, transform: 'none' });
  await screenshot('absolute-phone-landscape');
  await checkPlayback('absolute: device rotated to landscape');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await mobileFrame.evaluate((el) => el.isConnected), true);
  assert.equal(iframeRequests, mobileRequests);
  await page.keyboard.press('Escape');
  assert.equal(await tutor.isVisible(), false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '沉浸学习', exact: true }).waitFor();
  await checkPlayback('absolute: narrow-screen exit immersive');
  await screenshot('absolute-mobile-normal');
  record(
    'absolute: S05, controlled number line, informal check, unchanged state, 390px layout',
  );

  await go('number-line');
  await until(
    () =>
      tutor
        .locator('.ct-message')
        .count()
        .then((n) => n === count + 2),
    'return to normal chat',
  );
  assert.equal(
    (await json('/api/course-tutor/conversations?lessonId=number-line'))
      .conversations[0].id,
    normalId,
  );
  assert.notEqual(normalId, absoluteId);
  await tutor
    .getByRole('button', { name: '删除本课聊天', exact: true })
    .click();
  await tutor.getByRole('button', { name: '确认删除', exact: true }).click();
  await until(
    () =>
      tutor
        .locator('.ct-message')
        .count()
        .then((n) => n === 0),
    'deleted chat clears',
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await open();
  assert.equal(await tutor.locator('.ct-message').count(), 0);
  assert.equal(
    (await json('/api/course-tutor/conversations?lessonId=absolute'))
      .conversations[0].id,
    absoluteId,
  );
  record(
    'course isolation, return to earlier chat, deletion survives refresh and leaves other course intact',
  );
  const other = await browser.newContext();
  await other.request.get(base + '/api/learning');
  assert.equal(
    (
      await other.request.get(
        base + '/api/course-tutor/conversations/' + absoluteId,
      )
    ).status(),
    404,
  );
  await other.request.delete(base + '/api/v2/me', {
    headers: { origin: base },
  });
  await other.close();
  assert.deepEqual(
    errors,
    [],
    'No application console errors or runtime exceptions',
  );
  record(
    'learner isolation; page identity, meaningful content, no overlay or application errors',
  );
} finally {
  await writeFile(
    path.join(output, 'ui-results.json'),
    JSON.stringify(
      { checks, playback, errors, warnings, external, iframeRequests },
      null,
      2,
    ),
  );
  await context.request.delete(base + '/api/v2/me', {
    headers: { origin: base },
  });
  await browser.close();
}
