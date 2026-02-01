import { runSelfTests, autoDetectPages } from '../autoDetectPages';

describe('autoDetectPages self-tests', () => {
  it('runSelfTests passes all fixtures (A: high confidence, B: low confidence, C: ambiguity penalty)', () => {
    expect(runSelfTests()).toBe(true);
  });
});

describe('autoDetectPages URL cohesion', () => {
  it('same prefixSig + sequential filenames yields high confidence', () => {
    const base = 'https://cdn.example.com/manga/title/chapter1';
    const images = Array.from({ length: 20 }, (_, i) => ({
      src: `${base}/${String(i + 1).padStart(3, '0')}.png`,
      width: 800,
      height: 1200,
    }));
    const result = autoDetectPages(images);
    expect(result.confidence).toBeGreaterThan(0.75);
    expect(result.selected.length).toBeGreaterThan(0);
  });

  it('mixed icons/ads yields low confidence', () => {
    const images = [
      { src: 'https://site.com/logo.png', width: 64, height: 64 },
      { src: 'https://site.com/ads/banner.gif', width: 728, height: 90 },
      { src: 'https://site.com/avatar/user123.jpg', width: 48, height: 48 },
    ];
    const result = autoDetectPages(images);
    expect(result.confidence).toBeLessThan(0.45);
  });

  it('groups output includes urlCohesion and numericSequenceStrength', () => {
    const base = 'https://cdn.example.com/series/vol1';
    const images = Array.from({ length: 10 }, (_, i) => ({
      src: `${base}/page_${i + 1}.jpg`,
      width: 800,
      height: 1200,
    }));
    const result = autoDetectPages(images);
    expect(result.groups.length).toBeGreaterThan(0);
    const g = result.groups[0];
    expect(g).toHaveProperty('urlCohesion');
    expect(g).toHaveProperty('numericSequenceStrength');
  });

  /**
   * Demon Slayer–style: same chapter CDN folder (prefixSig), most portrait, one landscape spread.
   * Orientation-invariant bucketing keeps portrait and same-sized spread in one bucket; spread is selected.
   */
  it('same prefixSig with one landscape spread: spread is included in selected', () => {
    const base = 'https://cdn.read-demonslayer.com/images/manga/demonslayer/chapter-140';
    const portrait = (hash) => `${base}/${hash}.jpg`;
    const portraits = Array.from({ length: 20 }, (_, i) => ({
      src: portrait(`p${String(i + 1).padStart(2, '0')}${'a'.repeat(30)}`),
      width: 800,
      height: 1168,
    }));
    const spreadUrl = portrait(`spread${'b'.repeat(28)}`);
    const spreadImage = { src: spreadUrl, width: 1096, height: 800 };
    const images = [...portraits, spreadImage];
    const result = autoDetectPages(images);
    expect(result.selected.length).toBeGreaterThan(0);
    const selectedUrls = result.selected.map((img) => img.src || img.url);
    expect(selectedUrls).toContain(spreadUrl);
  });

  /**
   * Spread in a different size bucket (e.g. 600×1000 vs 800×1200): post-pass includes it when urlCohesion is high.
   */
  it('same prefixSig with spread in different size bucket: post-pass includes spread', () => {
    const base = 'https://cdn.example.com/manga/title/chapter-140';
    const portraits = Array.from({ length: 18 }, (_, i) => ({
      src: `${base}/page_${String(i + 1).padStart(3, '0')}.jpg`,
      width: 800,
      height: 1200,
    }));
    const spreadUrl = `${base}/page_spread_001.jpg`;
    const spreadImage = { src: spreadUrl, width: 600, height: 1000 };
    const images = [...portraits, spreadImage];
    const result = autoDetectPages(images);
    expect(result.selected.length).toBeGreaterThan(0);
    const selectedUrls = result.selected.map((img) => img.src || img.url);
    expect(selectedUrls).toContain(spreadUrl);
  });

  describe('debug instrumentation', () => {
    it('returns debug.candidates with rawUrl, querylessUrl, prefixSig, fullSig, sizeBucketKey, perImageScore, exclusionReason, dedupKey, droppedDueToKeyCollision', () => {
      const base = 'https://cdn.example.com/manga/ch1';
      const images = Array.from({ length: 10 }, (_, i) => ({
        src: `${base}/p${i + 1}.jpg`,
        width: 800,
        height: 1200,
      }));
      const result = autoDetectPages(images);
      expect(result.debug).toBeDefined();
      expect(result.debug.candidates).toHaveLength(images.length);
      const c = result.debug.candidates[0];
      expect(c).toHaveProperty('rawUrl');
      expect(c).toHaveProperty('querylessUrl');
      expect(c).toHaveProperty('prefixSig');
      expect(c).toHaveProperty('fullSig');
      expect(c).toHaveProperty('sizeBucketKey');
      expect(c).toHaveProperty('perImageScore');
      expect(c).toHaveProperty('groupKey');
      expect(c).toHaveProperty('exclusionReason');
      expect(c).toHaveProperty('dedupKey');
      expect(c).toHaveProperty('droppedDueToKeyCollision');
      expect(result.debug).toHaveProperty('winningGroupKey');
      expect(result.debug).toHaveProperty('winningUrlCohesion');
      expect(result.debug).toHaveProperty('winningCount');
      expect(result.debug).toHaveProperty('postPassRan');
    });
  });

  describe('URL similarity and negative controls', () => {
    it('same prefixSig with spread (different bucket): spread included when cohesion high', () => {
      const base = 'https://cdn.example.com/series/vol1/chapter';
      const pages = Array.from({ length: 20 }, (_, i) => ({
        src: `${base}/page_${i + 1}.jpg`,
        width: 800,
        height: 1200,
      }));
      const spreadUrl = `${base}/spread_001.jpg`;
      const images = [...pages, { src: spreadUrl, width: 600, height: 1000 }];
      const result = autoDetectPages(images);
      const selectedUrls = result.selected.map((img) => img.src || img.url);
      expect(selectedUrls).toContain(spreadUrl);
    });

    it('same dimensions different prefixSig: not pulled in', () => {
      const baseA = 'https://cdn.example.com/manga/a/chapter-1';
      const baseB = 'https://cdn.example.com/manga/b/chapter-1';
      const pagesA = Array.from({ length: 15 }, (_, i) => ({
        src: `${baseA}/p${i + 1}.jpg`,
        width: 800,
        height: 1200,
      }));
      const spreadB = { src: `${baseB}/spread.jpg`, width: 600, height: 1000 };
      const images = [...pagesA, spreadB];
      const result = autoDetectPages(images);
      const selectedUrls = result.selected.map((img) => img.src || img.url);
      expect(selectedUrls).not.toContain(spreadB.src);
    });

    it('junk-like URL on same host: not pulled in', () => {
      const base = 'https://cdn.example.com/manga/ch1';
      const pages = Array.from({ length: 18 }, (_, i) => ({
        src: `${base}/page_${i + 1}.jpg`,
        width: 800,
        height: 1200,
      }));
      const junkUrl = 'https://cdn.example.com/ads/banner.gif';
      const images = [...pages, { src: junkUrl, width: 728, height: 90 }];
      const result = autoDetectPages(images);
      const selectedUrls = result.selected.map((img) => img.src || img.url);
      expect(selectedUrls).not.toContain(junkUrl);
    });
  });

  describe('opaque ID segment grouping (A)', () => {
    it('same host and path structure with varying opaque segment: same prefixSig and all selected', () => {
      const host = 'https://cdn.example.com';
      const pathPrefix = '/images/chapter';
      const opaqueTokens = [
        'a1b2c3d4e5f6g7h8i9j0k1', // 24 chars mixed
        'x9y8z7w6v5u4t3s2r1q0p9',
        'Mn2Op4Qr6St8Uv0Wx1Yz3Ab',
        'Pq5Rs7Tu9Vw1Xy3Za5Bc7De',
        'Fg9Hi1Jk3Lm5No7Pq9Rs1Tu',
      ];
      const images = opaqueTokens.map((token) => ({
        src: `${host}${pathPrefix}/${token}.jpg`,
        width: 800,
        height: 1200,
      }));
      const result = autoDetectPages(images);
      expect(result.debug).toBeDefined();
      const prefixSigs = [...new Set(result.debug.candidates.map((c) => c.prefixSig))];
      expect(prefixSigs.filter((s) => s && s !== 'data')).toHaveLength(1);
      expect(result.selected.length).toBe(images.length);
      const selectedUrls = result.selected.map((img) => img.src || img.url);
      images.forEach((img) => expect(selectedUrls).toContain(img.src || img.url));
    });

    it('same host but different path structure: do not merge into same group', () => {
      const host = 'https://cdn.example.com';
      const images = [
        { src: `${host}/manga/series-a/chapter/abc123def456ghi789jkl012.jpg`, width: 800, height: 1200 },
        { src: `${host}/manga/series-b/chapter/xyz789uvw456rst123opq012.jpg`, width: 800, height: 1200 },
      ];
      const result = autoDetectPages(images);
      const prefixSigs = result.debug.candidates.map((c) => c.prefixSig);
      const uniquePrefix = [...new Set(prefixSigs.filter((s) => s && s !== 'data'))];
      expect(uniquePrefix.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('long-hex filename dedup (B)', () => {
    it('two distinct long-hex filenames same folder: both selected', () => {
      const base = 'https://cdn.example.com/folder/chapter';
      const hex1 = '1489e3a26b6275a0d2a9681514361123';
      const hex2 = '56e20e0c267e214a0f4d364c99fd46a9';
      const hex3 = 'a1b2c3d4e5f6789012345678abcdef12';
      const hex4 = 'fedcba9876543210fedcba9876543210';
      const images = [
        { src: `${base}/${hex1}.jpg`, width: 800, height: 1200 },
        { src: `${base}/${hex2}.jpg`, width: 800, height: 1200 },
        { src: `${base}/${hex3}.jpg`, width: 800, height: 1200 },
        { src: `${base}/${hex4}.jpg`, width: 800, height: 1200 },
      ];
      const result = autoDetectPages(images);
      expect(result.selected.length).toBe(4);
      const selectedUrls = result.selected.map((img) => img.src || img.url);
      expect(selectedUrls).toContain(`${base}/${hex1}.jpg`);
      expect(selectedUrls).toContain(`${base}/${hex2}.jpg`);
    });

    it('duplicate queryless URL: only one selected', () => {
      const base = 'https://cdn.example.com/page';
      const images = [
        { src: `${base}/001.jpg`, width: 800, height: 1200 },
        { src: `${base}/002.jpg`, width: 800, height: 1200 },
        { src: `${base}/003.jpg`, width: 800, height: 1200 },
        { src: `${base}/001.jpg?t=1`, width: 800, height: 1200 },
      ];
      const result = autoDetectPages(images);
      expect(result.selected.length).toBe(3);
      const keys = new Set(result.selected.map((img) => (img.src || img.url).replace(/\?.*$/, '')));
      expect(keys.size).toBe(3);
    });
  });
});
