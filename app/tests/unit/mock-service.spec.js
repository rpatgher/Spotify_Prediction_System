// ============================================================
// Unit tests for the logic exposed on `window` by:
//   - src/mockService.jsx (mockAnalysisService)
//   - src/pages-dashboard.jsx (isValidYouTube)
//
// The app has no module bundler: every script attaches its
// public API to `window`. We load the page once (so all scripts
// run) and then exercise that API directly via page.evaluate(),
// without touching the React UI. localStorage is cleared before
// each test for isolation.
// ============================================================
const { test, expect } = require('@playwright/test');

// `index.html` loads React/Babel from CDNs and transpiles the .jsx sources
// in-browser as `type="text/babel"` scripts; this happens *after* the
// page's `load` event, so wait for the globals to exist before evaluating.
async function waitForApp(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.mockAnalysisService && window.isValidYouTube);
}

test.describe('isValidYouTube', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await waitForApp(page);
  });

  test('accepts youtube.com and youtu.be links', async ({ page }) => {
    const result = await page.evaluate(() => ({
      watch: isValidYouTube('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
      short: isValidYouTube('https://youtu.be/dQw4w9WgXcQ'),
      withSpaces: isValidYouTube('  https://youtu.be/dQw4w9WgXcQ  '),
    }));
    expect(result.watch).toBe(true);
    expect(result.short).toBe(true);
    expect(result.withSpaces).toBe(true);
  });

  test('rejects non-youtube input', async ({ page }) => {
    const result = await page.evaluate(() => ({
      empty: isValidYouTube(''),
      otherSite: isValidYouTube('https://vimeo.com/12345'),
      plainText: isValidYouTube('not a link'),
    }));
    expect(result.empty).toBe(false);
    expect(result.otherSite).toBe(false);
    expect(result.plainText).toBe(false);
  });
});

test.describe('mockAnalysisService.analyze*', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await waitForApp(page);
  });

  test('analyzeYouTubeLink returns a well-formed AnalysisResult', async ({ page }) => {
    const result = await page.evaluate(async () => {
      return mockAnalysisService.analyzeYouTubeLink('https://youtu.be/xyz');
    });

    expect(result.source).toBe('youtube');
    expect(result.inputName).toBe('Análisis desde YouTube');
    expect(result.inputValue).toBe('https://youtu.be/xyz');
    expect(result.id).toMatch(/^tv_/);
    expect(result.score).toBeGreaterThanOrEqual(38);
    expect(result.score).toBeLessThanOrEqual(97);
    expect(['A', 'B', 'C', 'D', 'E', 'F']).toContain(result.rating);
    expect(result.features).toHaveLength(3);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(typeof result.summary).toBe('string');
    // "Viernes, 26 de julio de 2026" style
    expect(result.bestReleaseDate).toMatch(/^Viernes/);
  });

  test('analyzeMp3File uses the file name as inputName/inputValue and source mp3', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const file = new File(['fake-audio'], 'mi-cancion.mp3', { type: 'audio/mpeg' });
      return mockAnalysisService.analyzeMp3File(file);
    });

    expect(result.source).toBe('mp3');
    expect(result.inputName).toBe('mi-cancion.mp3');
    expect(result.inputValue).toBe('mi-cancion.mp3');
  });

  test('score-to-rating mapping is consistent across multiple analyses', async ({ page }) => {
    const results = await page.evaluate(async () => {
      const out = [];
      for (let i = 0; i < 10; i++) {
        out.push(await mockAnalysisService.analyzeYouTubeLink('https://youtu.be/abc'));
      }
      return out;
    });

    for (const r of results) {
      const expected =
        r.score >= 90 ? 'A' :
        r.score >= 80 ? 'B' :
        r.score >= 65 ? 'C' :
        r.score >= 50 ? 'D' :
        r.score >= 35 ? 'E' : 'F';
      expect(r.rating).toBe(expected);
    }
  });

  test('suggested release date always falls on a Friday', async ({ page }) => {
    const dates = await page.evaluate(async () => {
      const out = [];
      for (let i = 0; i < 5; i++) {
        out.push((await mockAnalysisService.analyzeYouTubeLink('https://youtu.be/abc')).bestReleaseDate);
      }
      return out;
    });
    for (const d of dates) {
      expect(d.startsWith('Viernes')).toBe(true);
    }
  });
});

test.describe('mockAnalysisService — session', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await waitForApp(page);
  });

  test('set/get/clear session round-trip', async ({ page }) => {
    const out = await page.evaluate(() => {
      mockAnalysisService.setSession({ name: 'Ana', role: 'user' });
      const got = mockAnalysisService.getSession();
      mockAnalysisService.clearSession();
      const after = mockAnalysisService.getSession();
      return { got, after };
    });

    expect(out.got).toEqual({ name: 'Ana', role: 'user' });
    expect(out.after).toBeNull();
  });

  test('getSession returns null when nothing is stored', async ({ page }) => {
    const session = await page.evaluate(() => mockAnalysisService.getSession());
    expect(session).toBeNull();
  });
});

test.describe('mockAnalysisService — registered users', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await waitForApp(page);
  });

  test('registerUser stores a role that findUserRole recalls case-insensitively', async ({ page }) => {
    const out = await page.evaluate(() => {
      mockAnalysisService.registerUser({ name: 'Productor Demo', role: 'producer' });
      return {
        exact: mockAnalysisService.findUserRole('Productor Demo'),
        lower: mockAnalysisService.findUserRole('productor demo'),
        padded: mockAnalysisService.findUserRole('  Productor Demo  '),
        unknown: mockAnalysisService.findUserRole('Nadie'),
      };
    });

    expect(out.exact).toBe('producer');
    expect(out.lower).toBe('producer');
    expect(out.padded).toBe('producer');
    expect(out.unknown).toBeNull();
  });
});

test.describe('mockAnalysisService — history & current analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
    await waitForApp(page);
  });

  test('saveToHistory de-dupes by id and orders newest first', async ({ page }) => {
    const out = await page.evaluate(async () => {
      const r1 = await mockAnalysisService.analyzeYouTubeLink('https://youtu.be/1');
      const r2 = await mockAnalysisService.analyzeYouTubeLink('https://youtu.be/2');

      mockAnalysisService.saveToHistory(r1);
      mockAnalysisService.saveToHistory(r1); // duplicate, should not add a second entry
      mockAnalysisService.saveToHistory(r2);

      const list = mockAnalysisService.getHistory();
      return { length: list.length, firstId: list[0].id, r1Id: r1.id, r2Id: r2.id };
    });

    expect(out.length).toBe(2);
    expect(out.firstId).toBe(out.r2Id); // newest first
  });

  test('deleteFromHistory removes only the targeted entry', async ({ page }) => {
    const out = await page.evaluate(async () => {
      const r1 = await mockAnalysisService.analyzeYouTubeLink('https://youtu.be/1');
      const r2 = await mockAnalysisService.analyzeYouTubeLink('https://youtu.be/2');
      mockAnalysisService.saveToHistory(r1);
      mockAnalysisService.saveToHistory(r2);

      mockAnalysisService.deleteFromHistory(r1.id);
      const list = mockAnalysisService.getHistory();
      return { length: list.length, remainingId: list[0]?.id, r2Id: r2.id };
    });

    expect(out.length).toBe(1);
    expect(out.remainingId).toBe(out.r2Id);
  });

  test('setCurrentAnalysis / getCurrentAnalysis round-trip', async ({ page }) => {
    const out = await page.evaluate(async () => {
      const r = await mockAnalysisService.analyzeMp3File(new File(['x'], 'song.mp3'));
      mockAnalysisService.setCurrentAnalysis(r);
      return { current: mockAnalysisService.getCurrentAnalysis(), id: r.id };
    });

    expect(out.current.id).toBe(out.id);
  });

  test('getCurrentAnalysis returns null when nothing was analyzed yet', async ({ page }) => {
    const current = await page.evaluate(() => mockAnalysisService.getCurrentAnalysis());
    expect(current).toBeNull();
  });
});
