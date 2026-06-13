import { autoDetectPages } from '../autoDetectPages';

// Mock getUrl & getDimensions dependencies natively if not already available in env
describe('autoDetectPages Algorithm V2', () => {

  const generateMangaMocks = (startIndex, count, width = 800, height = 1200, urlBase = 'https://cdn.manga.com/manga/title/ep1/') => {
    return Array.from({ length: count }, (_, i) => ({
      url: `${urlBase}${String(i + 1).padStart(3, '0')}.jpg`,
      width,
      height
    }));
  };

  test('1. Classic Manga Pages (Uniform sizes, sequential URLs)', () => {
    const images = generateMangaMocks(0, 20);
    const result = autoDetectPages(images);
    expect(result.selected.length).toBe(20);
    expect(result.confidence).toBeGreaterThan(0.75);
  });

  test('2. Webtoon Long Strips (Identical widths, varying tall heights + 1 short tail page)', () => {
    const images = [
      { url: 'https://cdn.webtoon.com/manga/title/ep1/001.jpg', width: 720, height: 5000 },
      { url: 'https://cdn.webtoon.com/manga/title/ep1/002.jpg', width: 720, height: 5000 },
      { url: 'https://cdn.webtoon.com/manga/title/ep1/003.jpg', width: 720, height: 5000 },
      { url: 'https://cdn.webtoon.com/manga/title/ep1/004.jpg', width: 720, height: 5000 },
      // The short tail page
      { url: 'https://cdn.webtoon.com/manga/title/ep1/005.jpg', width: 720, height: 1542 },
    ];
    const result = autoDetectPages(images);
    expect(result.selected.length).toBe(5); // The short tail should be perfectly selected
    expect(result.selected.map(i => i.url)).toContain('https://cdn.webtoon.com/manga/title/ep1/005.jpg');
  });

  test('3. Exact 2x Spread Detection', () => {
    const images = [
      { url: 'https://cdn.manga.com/manga/title/ep1/001.jpg', width: 800, height: 1200 },
      { url: 'https://cdn.manga.com/manga/title/ep1/002.jpg', width: 800, height: 1200 },
      { url: 'https://cdn.manga.com/manga/title/ep1/003.jpg', width: 800, height: 1200 },
      { url: 'https://cdn.manga.com/manga/title/ep1/004.jpg', width: 800, height: 1200 },
      { url: 'https://cdn.manga.com/manga/title/ep1/005.jpg', width: 800, height: 1200 },
      { url: 'https://cdn.manga.com/manga/title/ep1/006.jpg', width: 800, height: 1200 },
      { url: 'https://cdn.manga.com/manga/title/ep1/007.jpg', width: 800, height: 1200 },
      { url: 'https://cdn.manga.com/manga/title/ep1/008.jpg', width: 800, height: 1200 },
      // Exact 2x spread! (Double width, same height)
      { url: 'https://cdn.manga.com/manga/title/ep1/009.jpg', width: 1600, height: 1200 },
    ];
    const result = autoDetectPages(images);
    expect(result.selected.length).toBe(9);
    expect(result.selected.map(i => i.url)).toContain('https://cdn.manga.com/manga/title/ep1/009.jpg');
    expect(result.spreadIncludedCount).toBeGreaterThanOrEqual(1);
  });

  test('4. DOM Proximity (Contiguous Block Filtering)', () => {
    const mainComic = generateMangaMocks(0, 15, 800, 1200, 'https://cdn.manga.com/manga/title/ep1/');
    const images = [
      // Fake banner at the very top (index 0), matches size!
      { url: 'https://cdn.manga.com/chap1/promo.jpg', width: 800, height: 1200 },
      ...Array.from({ length: 20 }, (_, i) => ({ url: `https://site.com/junk${i}.jpg`, width: 10, height: 10 })), // 20 spacer junk images
      ...mainComic, // Main comic block starting at index 21
      ...Array.from({ length: 20 }, (_, i) => ({ url: `https://site.com/junk_bottom${i}.jpg`, width: 10, height: 10 })), // 20 spacer junk images
      // Fake banner at the very bottom (index ~56), matches size!
      { url: 'https://cdn.manga.com/chap1/read_next.jpg', width: 800, height: 1200 },
    ];
    
    const result = autoDetectPages(images);
    expect(result.selected.length).toBe(15);
    const selectedUrls = result.selected.map(i => i.url);
    expect(selectedUrls).not.toContain('https://cdn.manga.com/chap1/promo.jpg');
    expect(selectedUrls).not.toContain('https://cdn.manga.com/chap1/read_next.jpg');
  });

  test('5. Junk/Noise Filtering (Ads, icons, tiny images)', () => {
    const mainComic = generateMangaMocks(0, 10);
    const images = [
      { url: 'https://site.com/logo.png', width: 250, height: 100 },
      { url: 'https://site.com/avatar.jpg', width: 48, height: 48 },
      { url: 'https://ads.com/banner.gif', width: 728, height: 90 },
      { url: 'https://tracking.com/pixel.png', width: 1, height: 1 },
      ...mainComic
    ];
    const result = autoDetectPages(images);
    expect(result.selected.length).toBe(10);
  });

  test('6. Empty array handling', () => {
    const result = autoDetectPages([]);
    expect(result.selected).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  test('7. Insane Chaotic Real-World Scenario (Spreads, Lazy-load, Junk, Ads, Gaps)', () => {
    const images = [];
    
    // Seeded-like random for consistent test runs
    let seed = 12345;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
    const randomArrayChoice = (arr) => arr[Math.floor(random() * arr.length)];
    
    const validComicUrls = [];
    
    // 250 total images on the page
    for (let i = 0; i < 250; i++) {
      // The actual comic chapter is scattered between index 50 and 150
      const isComicBlock = i >= 50 && i <= 150;
      const isComicPage = isComicBlock && validComicUrls.length < 40 && random() < 0.4;
      
      if (isComicPage) {
        const pageNum = validComicUrls.length + 1;
        const url = `https://cdn.manga.com/manga/title/ep2/${String(pageNum).padStart(3, '0')}.jpg`;
        validComicUrls.push(url);
        
        const isSpread = random() < 0.15; // 15% spreads
        const isLazy = random() < 0.10;   // 10% lazy loaded (0x0)
        
        // Slight size variations instead of perfect uniformity
        let w = isSpread ? randomInt(1590, 1610) : randomInt(790, 810);
        let h = randomInt(1190, 1210);
        
        if (isLazy) {
          w = 0;
          h = 0;
        }
        
        images.push({ url, width: w, height: h });
      } else {
        // Inject extreme junk
        const junkTypes = ['logo', 'banner', 'avatar', 'pixel', 'random_large'];
        const type = randomArrayChoice(junkTypes);
        let w, h, url;
        
        if (type === 'pixel') {
          w = 1; h = 1;
          url = `https://tracker.com/pixel_${i}.gif`;
        } else if (type === 'banner') {
          w = 728; h = 90;
          url = `https://ads.com/banner_${i}.jpg`;
        } else if (type === 'logo') {
          w = 200; h = 50;
          url = `https://site.com/logo_${i}.png`;
        } else if (type === 'avatar') {
          w = 48; h = 48;
          url = `https://site.com/users/avatar_${i}.jpg`;
        } else {
          // Random large image that might accidentally mimic a page size
          w = randomInt(700, 1600);
          h = randomInt(1000, 1300);
          url = `https://other.cdn.com/random/img_${i}.jpg`;
        }
        
        // Add some evil duplicate URLs at the bottom simulating "Read previous chapter" thumbnails
        if (i > 180 && validComicUrls.length > 0 && random() < 0.1) {
           w = 800; h = 1200;
           url = randomArrayChoice(validComicUrls);
        }
        
        images.push({ url, width: w, height: h });
      }
    }
    
    const result = autoDetectPages(images);
    const selectedUrls = result.selected.map(img => img.url);
    
    // We expect exactly our generated comic URLs, ignoring all the noise
    validComicUrls.forEach(url => {
      expect(selectedUrls).toContain(url);
    });
    
    expect(selectedUrls.length).toBe(validComicUrls.length);
  });
});
