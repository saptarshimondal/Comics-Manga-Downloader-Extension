/**
 * Auto-detect comic/manga/webtoon page images from an already-extracted list.
 * Uses scoring, URL/size grouping, and group confidence. Does not re-scan the DOM.
 */

const JUNK_TOKENS = /logo|avatar|icon|sprite|emoji|ads|advert|banner|tracking|analytics|pixel|beacon/gi;
const IMAGE_EXT = /\.(jpg|jpeg|png|webp)(\?|$)/i;
const WEAK_HINTS = /chapter|page|manga|comic|webtoon|reader|cdn|image/gi;
const MIN_PAGE_SCORE = 20;
const MIN_GROUP_COUNT = 4;
const TINY_SIZE = 200;

/**
 * Get effective URL from image (supports both url and src).
 */
function getUrl(img) {
  return (img && (img.url != null ? img.url : img.src)) || '';
}

/**
 * Get best available width/height from image (naturalWidth/Height, width/height, displayWidth/Height).
 */
function getDimensions(img) {
  const w = img.naturalWidth ?? img.width ?? img.displayWidth;
  const h = img.naturalHeight ?? img.height ?? img.displayHeight;
  return { w: Number(w) || 0, h: Number(h) || 0 };
}

/**
 * Per-image score 0..100: area, min dimension, aspect ratio, URL signals; penalties for junk, tiny, repeated URLs.
 */
function scoreImage(img, index, stats) {
  const url = getUrl(img);
  const { w, h } = getDimensions(img);
  let score = 0;

  // Positive: large area relative to max area (+0..30)
  const area = w * h;
  if (stats.maxArea > 0 && area > 0) {
    const areaRatio = Math.min(1, area / stats.maxArea);
    score += Math.round(30 * areaRatio);
  }

  // Positive: large min dimension (+0..10)
  const minDim = Math.min(w, h);
  if (minDim >= 800) score += 10;
  else if (minDim >= 400) score += 7;
  else if (minDim >= 200) score += 4;

  // Positive: page-like aspect ratio (+0..10)
  if (w > 0 && h > 0) {
    const ratio = h / w;
    const ratioLand = w / h;
    if (ratio >= 1.2 && ratio <= 1.9) score += 10; // portrait
    else if (ratio > 2.0) score += 10; // webtoon slice
    else if (ratioLand > 1.2) score += 5; // landscape spread
  }

  // Positive: URL extension (+2)
  if (IMAGE_EXT.test(url)) score += 2;

  // Positive: weak hints in URL (+0..8)
  const hintMatches = url.match(WEAK_HINTS);
  if (hintMatches) score += Math.min(8, hintMatches.length * 2);

  // Negative: junk tokens (-10..-35 by count)
  const junkMatches = url.match(JUNK_TOKENS);
  if (junkMatches) {
    const penalty = Math.min(35, 10 + junkMatches.length * 5);
    score -= penalty;
  }

  // Negative: tiny images
  const maxDim = Math.max(w, h);
  if (maxDim > 0 && maxDim < TINY_SIZE) score -= 25;

  // Negative: repeated identical URL (icons/sprites) – applied via stats.urlCounts
  const urlKey = url.split('?')[0].split('#')[0];
  const urlCount = stats.urlCounts.get(urlKey) || 0;
  if (urlCount > 3) score -= Math.min(20, (urlCount - 3) * 5);

  return Math.max(0, Math.min(100, score));
}

/**
 * Build URL signature: lowercase hostname + first 2–3 path segments, no query/hash.
 */
function urlSignature(url) {
  if (!url || url.startsWith('data:')) return 'data';
  try {
    const u = new URL(url);
    const pathSegments = u.pathname.replace(/^\/+|\/+$/g, '').split('/').slice(0, 3);
    return (u.hostname.toLowerCase() + '/' + pathSegments.join('/')) || u.hostname;
  } catch {
    return url.slice(0, 80);
  }
}

/**
 * Group by URL signature, then by size bucket (width ratio to median) within each signature.
 */
function buildGroups(images, scores) {
  const bySignature = new Map();
  images.forEach((img, i) => {
    const sig = urlSignature(getUrl(img));
    if (!bySignature.has(sig)) bySignature.set(sig, []);
    bySignature.get(sig).push({ img, index: i, score: scores[i] });
  });

  const groups = [];
  const { w: medianW } = medianDimensions(images);

  bySignature.forEach((candidates, key) => {
    const widths = candidates.map(({ img }) => getDimensions(img).w).filter(Boolean);
    const medianWidth = widths.length ? median(widths) : medianW || 800;

    const byBucket = new Map();
    candidates.forEach(({ img, index, score }) => {
      const { w } = getDimensions(img);
      const bucket = w > 0 ? Number((w / medianWidth).toFixed(1)) : 1;
      if (!byBucket.has(bucket)) byBucket.set(bucket, []);
      byBucket.get(bucket).push({ img, index, score });
    });

    byBucket.forEach((items, bucket) => {
      if (items.length >= MIN_GROUP_COUNT || (items.length >= 1 && widths.length === 0)) {
        groups.push({ key: `${key}|${bucket}`, items, medianWidth });
      }
    });
  });

  // Fallback: single global size cluster (for noisy URLs / many signatures)
  const allWithDims = images.map((img, i) => ({ img, index: i, score: scores[i] }))
    .filter(({ img }) => getDimensions(img).w > 0);
  if (allWithDims.length >= MIN_GROUP_COUNT) {
    const widths = allWithDims.map(({ img }) => getDimensions(img).w);
    const med = median(widths);
    const byGlobalBucket = new Map();
    allWithDims.forEach(({ img, index, score }) => {
      const w = getDimensions(img).w;
      const bucket = Number((w / med).toFixed(1));
      if (!byGlobalBucket.has(bucket)) byGlobalBucket.set(bucket, []);
      byGlobalBucket.get(bucket).push({ img, index, score });
    });
    byGlobalBucket.forEach((items, bucket) => {
      if (items.length >= MIN_GROUP_COUNT) {
        groups.push({ key: `global|${bucket}`, items, medianWidth: med });
      }
    });
  }

  return groups;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function medianDimensions(images) {
  const widths = [];
  const heights = [];
  images.forEach((img) => {
    const { w, h } = getDimensions(img);
    if (w) widths.push(w);
    if (h) heights.push(h);
  });
  return { w: median(widths), h: median(heights) };
}

function stddev(values) {
  if (!values.length) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const sq = values.reduce((sum, v) => sum + (v - avg) ** 2, 0);
  return Math.sqrt(sq / values.length);
}

/**
 * Sequence coherence: indices mostly increasing, small gaps (reading order).
 */
function sequenceCoherence(indices) {
  if (indices.length < 2) return 1;
  const sorted = indices.slice().sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);
  const medianGap = median(gaps);
  const maxReasonableGap = Math.max(10, sorted.length);
  return medianGap <= maxReasonableGap ? Math.max(0, 1 - medianGap / maxReasonableGap) : 0;
}

/**
 * Group confidence 0..1 from countScore, dominance, sizeConsistency, avgScore, junkRate, sequenceCoherence.
 */
function groupConfidence(group, totalCandidates, scoresByIdx) {
  const items = group.items;
  const count = items.length;
  const countScore = Math.min(1, count / 15);
  const dominance = totalCandidates > 0 ? count / totalCandidates : 0;
  const widths = items.map(({ img }) => getDimensions(img).w).filter(Boolean);
  const sizeConsistency = widths.length
    ? Math.max(0, 1 - stddev(widths) / (median(widths) || 1))
    : 0.5;
  const avgScore = items.reduce((s, { score }) => s + score, 0) / (items.length * 100);
  const urls = items.map(({ img }) => getUrl(img));
  const junkCount = urls.filter((u) => (u.match(JUNK_TOKENS) || []).length > 0).length;
  const junkRate = urls.length ? junkCount / urls.length : 0;
  const indices = items.map(({ index }) => index);
  const coherence = sequenceCoherence(indices);

  let confidence =
    0.25 * avgScore +
    0.2 * sizeConsistency +
    0.2 * dominance +
    0.2 * countScore +
    0.15 * coherence -
    0.25 * junkRate;
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Main API: auto-detect page images from the existing extracted list.
 *
 * @param {Array} images - Same list as shown in popup. Each item has at least url/src, optional width/height (or naturalWidth/naturalHeight, displayWidth/displayHeight).
 * @param {object} opts - Optional options (reserved).
 * @returns {{ selected: Array, confidence: number, groups: Array, reason: string }}
 */
export function autoDetectPages(images, opts = {}) {
  if (!Array.isArray(images) || images.length === 0) {
    return { selected: [], confidence: 0, groups: [], reason: 'no images' };
  }

  const urlCounts = new Map();
  images.forEach((img) => {
    const u = getUrl(img).split('?')[0].split('#')[0];
    urlCounts.set(u, (urlCounts.get(u) || 0) + 1);
  });

  const areas = images.map((img) => {
    const { w, h } = getDimensions(img);
    return w * h;
  });
  const maxArea = Math.max(...areas, 1);
  const stats = { maxArea, urlCounts };

  const scores = images.map((img, i) => scoreImage(img, i, stats));
  const groups = buildGroups(images, scores);
  const totalCandidates = images.length;

  let best = { group: null, confidence: 0, meanScore: 0 };
  const groupInfos = [];

  groups.forEach((group) => {
    const confidence = groupConfidence(group, totalCandidates, scores);
    const meanScore = group.items.reduce((s, { score }) => s + score, 0) / group.items.length;
    groupInfos.push({
      key: group.key,
      count: group.items.length,
      confidence,
      meanScore,
    });
    if (confidence > best.confidence) {
      best = { group, confidence, meanScore };
    }
  });

  let selected = [];
  let overallConfidence = 0;
  let reason = 'no suitable group';

  if (best.group) {
    selected = best.group.items
      .filter(({ score }) => score >= MIN_PAGE_SCORE)
      .map(({ img }) => img);
    overallConfidence = best.confidence;
    reason = `best group ${best.group.key} count=${best.group.items.length} confidence=${overallConfidence.toFixed(2)}`;
  }

  return {
    selected,
    confidence: overallConfidence,
    groups: groupInfos,
    reason,
  };
}

export default autoDetectPages;
