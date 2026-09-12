// Run against a local static server. See README for setup.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_URL || 'http://127.0.0.1:4173';
const screenshots = process.env.SCREENSHOTS;
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const navigate = async (route = '') => {
    await page.goto(`${base}/#${route}`, {waitUntil:'networkidle'});
    await page.waitForSelector(route ? '.view-head' : '.tool-card');
  };
  const snap = async (name) => {
    if (!screenshots) return;
    fs.mkdirSync(screenshots,{recursive:true});
    await page.screenshot({path:path.join(screenshots,`${name}.png`),fullPage:true});
  };
  try {
    await navigate();
    assert.equal(await page.locator('.tool-card').count(),5);
    await page.getByRole('button',{name:'Music',exact:true}).click();
    assert.equal(await page.locator('.tool-card').count(),3);
    await page.getByRole('button',{name:'Focus',exact:true}).click();
    assert.equal(await page.locator('.tool-card').count(),1);
    assert.equal(await page.locator('.tool-card h3').textContent(),'Timer');
    await page.getByRole('button',{name:'Play',exact:true}).click();
    assert.equal(await page.locator('.tool-card h3').textContent(),'Hexic');
    await page.getByRole('button',{name:'All tools',exact:true}).click();
    await page.getByRole('button',{name:'Install the app'}).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(),0);
    console.log('PASS collection filters and installation help');

    await navigate('metronome');
    await page.getByRole('button',{name:'Increase tempo'}).click();
    assert.equal(await page.locator('.big-number').textContent(),'121');
    await page.getByRole('button',{name:'Allegro · 132'}).click();
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('.big-number').textContent(),'137');
    await page.getByRole('combobox',{name:'Time signature'}).selectOption('7/8');
    assert.equal(await page.locator('.dot').count(),7);
    for (const sound of ['beep','wood','cowbell','snare','click']) {
      await page.getByRole('combobox',{name:'Sound',exact:true}).selectOption(sound);
      await page.getByRole('button',{name:'Play',exact:true}).click();
      await page.getByRole('button',{name:'Pause',exact:true}).waitFor();
      await page.waitForTimeout(100);
      await page.getByRole('button',{name:'Pause',exact:true}).click();
    }
    await page.reload({waitUntil:'networkidle'});
    assert.equal(await page.locator('.big-number').textContent(),'137');
    await snap('metronome-desktop');
    console.log('PASS tempo controls, all sound voices, playback, and persistence');

    await navigate('timer');
    assert.equal(await page.getByRole('spinbutton',{name:'Work seconds'}).isVisible(),false);
    await page.getByRole('button',{name:'Intervals',exact:true}).click();
    assert.equal(await page.getByRole('spinbutton',{name:'Minutes',exact:true}).isVisible(),false);
    await page.getByRole('spinbutton',{name:'Rest seconds'}).fill('0');
    await page.getByRole('spinbutton',{name:'Rest seconds'}).press('Tab');
    assert.equal(await page.getByRole('spinbutton',{name:'Rest seconds'}).inputValue(),'0');
    await page.getByRole('spinbutton',{name:'Work seconds'}).fill('1');
    await page.getByRole('spinbutton',{name:'Work seconds'}).press('Tab');
    await page.getByRole('spinbutton',{name:'Rounds',exact:true}).fill('2');
    await page.getByRole('spinbutton',{name:'Rounds',exact:true}).press('Tab');
    await page.getByRole('button',{name:'Start',exact:true}).click();
    await page.getByText('Done!',{exact:true}).waitFor({timeout:5000});
    await page.getByRole('button',{name:'Countdown',exact:true}).click();
    await page.getByRole('spinbutton',{name:'Minutes',exact:true}).fill('999');
    await page.getByRole('spinbutton',{name:'Minutes',exact:true}).press('Tab');
    assert.equal(await page.getByRole('spinbutton',{name:'Minutes',exact:true}).inputValue(),'180');
    await page.getByRole('button',{name:'0:30',exact:true}).click();
    await page.getByRole('button',{name:'Start',exact:true}).click();
    await page.waitForTimeout(1100);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    const paused = await page.locator('.big-number').textContent();
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.big-number').textContent(),paused);
    await page.getByRole('button',{name:'Start',exact:true}).click();
    await page.waitForTimeout(1100);
    assert.notEqual(await page.locator('.big-number').textContent(),paused);
    await page.getByRole('button',{name:'Reset',exact:true}).click();
    assert.equal(await page.locator('.big-number').textContent(),'0:30');
    await snap('timer-desktop');
    console.log('PASS timer modes, zero-rest intervals, completion, input limits, pause/resume');

    await navigate('tap-tempo');
    for(let i=0;i<4;i++) { await page.getByRole('button',{name:'Tap the beat'}).click(); if(i<3) await page.waitForTimeout(500); }
    const bpm = Number(await page.locator('.big-number').textContent());
    assert.ok(bpm > 90 && bpm < 130, `Measured BPM: ${bpm}`);
    await page.getByRole('button',{name:'Use in metronome'}).click();
    await page.waitForURL('**/#metronome');
    assert.equal(Number(await page.locator('.big-number').textContent()),bpm);
    console.log('PASS tapping and BPM transfer');

    await navigate('tuner');
    assert.equal(await page.getByRole('alert').isVisible(),false);
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('denied','NotAllowedError'); }; });
    await page.getByRole('button',{name:'Start tuner',exact:true}).click();
    await page.getByRole('alert').getByText('Microphone permission was denied.').waitFor();
    assert.equal(await page.getByRole('button',{name:'Start tuner',exact:true}).isEnabled(),true);
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        window.testAudio = new AudioContext();
        const oscillator = testAudio.createOscillator();
        oscillator.frequency.value = 440;
        window.testOscillator = oscillator;
        const destination = testAudio.createMediaStreamDestination();
        oscillator.connect(destination);
        oscillator.start();
        await testAudio.resume();
        window.testStream = destination.stream;
        return destination.stream;
      };
    });
    await page.getByRole('button',{name:'Start tuner',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('.note').textContent === 'A4');
    const hz = parseFloat(await page.locator('.hz').textContent());
    assert.ok(Math.abs(hz-440)<1,`440 Hz detected as ${hz}`);
    for (const frequency of [110, 220, 440, 880]) {
      await page.evaluate(frequency => { testOscillator.frequency.value = frequency; }, frequency);
      await page.waitForTimeout(250);
      for (let sample = 0; sample < 5; sample++) {
        const measured = parseFloat(await page.locator('.hz').textContent());
        const centsError = Math.abs(1200 * Math.log2(measured / frequency));
        assert.ok(centsError < 1, `${frequency} Hz detected as ${measured} Hz (${centsError} cents)`);
        await page.waitForTimeout(50);
      }
    }
    await page.evaluate(() => { testOscillator.frequency.value = 440; });
    await page.waitForTimeout(200);
    await snap('tuner-desktop');
    await page.getByRole('link',{name:'Timer',exact:true}).click();
    assert.ok(await page.evaluate(() => testStream.getTracks().every(track => track.readyState === 'ended')));
    await page.evaluate(() => testAudio.close());
    console.log('PASS tuner denial, synthetic pitch accuracy at four reference pitches, microphone release');

    await navigate('tuner');
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { window.resolveMic = resolve; });
    });
    await page.getByRole('button',{name:'Start tuner',exact:true}).click();
    await page.waitForFunction(() => typeof window.resolveMic === 'function');
    await page.getByRole('link',{name:'Timer',exact:true}).click();
    await page.evaluate(() => {
      const audio = new AudioContext();
      const stream = audio.createMediaStreamDestination().stream;
      window.lateStream = stream;
      resolveMic(stream);
      audio.close();
    });
    await page.waitForFunction(() => lateStream.getTracks().every(track => track.readyState === 'ended'));
    console.log('PASS navigation during pending microphone permission');

    await navigate('hexic');
    await page.getByRole('button',{name:'Hint',exact:true}).click();
    await page.getByRole('button',{name:'Rotate ↻',exact:true}).waitFor({state:'visible'});
    assert.equal(await page.getByRole('button',{name:'Rotate ↻',exact:true}).isEnabled(),true);
    await page.getByRole('button',{name:'Rotate ↻',exact:true}).click();
    await page.waitForFunction(() => document.querySelector('.hexic-stats').textContent.includes('Moves: 1'));
    await snap('hexic-desktop');
    console.log('PASS Hexic hint and rotation');

    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:900});
      for(const route of ['', 'metronome','tuner','timer','tap-tempo','hexic']) {
        await navigate(route);
        const dims = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
        assert.ok(dims.scroll <= dims.viewport,`${route||'home'} overflows at ${width}: ${JSON.stringify(dims)}`);
        for(const node of await page.locator('input,select,button:not([hidden])').all()) {
          if(!(await node.isVisible()))continue;
          const box = await node.boundingBox();
          assert.ok(box.x >= -1 && box.x+box.width <= width+1,`Control outside viewport on ${route} at ${width}`);
        }
        if(width === 390 || width === 1440) await snap(`${route||'home'}-${width}`);
      }
    }
    console.log('PASS all routes and controls at 320, 390, 768, and 1440 pixels');

    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({waitUntil:'networkidle'});
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
    await context.setOffline(true);
    await page.goto(base,{waitUntil:'load'});
    await page.getByRole('link',{name:'Open Metronome',exact:true}).waitFor();
    for(const route of ['metronome','tuner','timer','tap-tempo','hexic']) {
      await page.goto(`${base}/#${route}`,{waitUntil:'load'});
      await page.locator('.view-head h2').waitFor();
    }
    assert.equal(await page.evaluate(async () => (await caches.keys()).filter(key => key.startsWith('hns-')).length),1);
    console.log('PASS full offline reload and all five tools');
    assert.deepEqual(errors,[]);
    console.log('PASS no uncaught browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

