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
/** Orientation-invariant size bucket step (min/max dims); tune here to group portrait vs spread. */
const SIZE_BUCKET_STEP = 200;
/** Spread inclusion: area within [medianArea * SPREAD_AREA_MIN, medianArea * SPREAD_AREA_MAX]. */
const SPREAD_AREA_MIN = 0.6;
const SPREAD_AREA_MAX = 1.8;
/** URL similarity: gated score boost and post-pass only when cohesion/similarity above these. */
const COHESION_FOR_SIMILARITY_BOOST = 0.75;
const COUNT_FOR_SIMILARITY_BOOST = 8;
const SIMILARITY_BOOST_CAP = 12;
const COHESION_FOR_OVERRIDE = 0.85;
const SIMILARITY_FOR_OVERRIDE = 0.9;
const MIN_SCORE_OVERRIDE = 10;
/** MAD/IQR: include candidate if area within median ± k*MAD. */
const MAD_K = 2.5;

/**
 * Get effective URL from image (supports both url and src).
 */
function getUrl(img) {
  return (img && (img.url != null ? img.url : img.src)) || '';
}

/**
 * Stable identity for dedup: queryless URL (origin + pathname). Distinct pathnames never collapse.
 * Do NOT use normalized fullSig/basePattern so long-hex filenames (which normalize to {h}) stay distinct (fix B).
 */
function getQuerylessUrl(img) {
  const url = getUrl(img);
  if (!url || url.startsWith('data:')) return url || '';
  const parsed = parseUrlSafe(url);
  return parsed ? parsed.queryless : url;
}

/** Dedup key: querylessUrl|type so true duplicates (same resource) collapse, distinct pages never. */
function imageKey(img) {
  const queryless = getQuerylessUrl(img);
  const url = getUrl(img);
  const type = img.type ?? (url.startsWith('data') ? 'data' : 'url');
  return `${queryless}|${type}`;
}

/**
 * Get best available width/height from image (naturalWidth/Height, width/height, displayWidth/Height).
 */
function getDimensions(img) {
  const w = img.naturalWidth ?? img.width ?? img.displayWidth;
  const h = img.naturalHeight ?? img.height ?? img.displayHeight;
  return { w: Number(w) || 0, h: Number(h) || 0 };
}

// --- URL normalization + robust signature ---

const HEX_LIKE = /^[a-f0-9]{8,}$/i;
const UUID_LIKE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const NUMERIC = /^\d+$/;
const EXT_RE = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i;
/** Opaque ID: length threshold so per-resource tokens collapse to {id} for grouping. */
const OPAQUE_SEGMENT_MIN_LENGTH = 20;
/** URL-safe charset for opaque token (letters, digits, base64-ish); - at start so not a range. */
const OPAQUE_CHARSET = /^[-A-Za-z0-9_+=]+$/;

/**
 * Parse URL safely. Returns { host, pathname, ext, queryless } or null for invalid URLs.
 */
function parseUrlSafe(url) {
  if (!url || typeof url !== 'string' || url.startsWith('data:')) return null;
  try {
    const u = new URL(url);
    const pathname = u.pathname || '/';
    const extMatch = pathname.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : '';
    const queryless = u.origin + pathname;
    return { host: u.hostname.toLowerCase(), pathname, ext, queryless };
  } catch {
    return null;
  }
}

/**
 * Heuristic: segment looks like an opaque per-resource ID (high-entropy token), not already numeric/hex/uuid.
 * Conservative: length >= 20, URL-safe charset, mixed letters+digits so CDN tokens collapse to {id} for grouping (fix A).
 * Strips trailing image extension so "token.jpg" is treated as opaque; avoids splitting same URL family by per-resource token.
 */
function isOpaqueIdSegment(seg) {
  if (!seg || seg.length < OPAQUE_SEGMENT_MIN_LENGTH) return false;
  const withoutExt = seg.replace(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i, '');
  if (withoutExt.length < OPAQUE_SEGMENT_MIN_LENGTH) return false;
  if (!OPAQUE_CHARSET.test(withoutExt)) return false;
  const hasDigit = /\d/.test(withoutExt);
  const hasLetter = /[A-Za-z]/.test(withoutExt);
  return hasDigit && hasLetter;
}

/**
 * Normalize path: split by /, remove empty; numeric -> {n}, long hex -> {h}, UUID -> {uuid}, opaque ID -> {id}; keep text.
 */
function normalizePathSegments(pathname) {
  if (!pathname) return [];
  const raw = pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  return raw.map((seg) => {
    if (NUMERIC.test(seg)) return '{n}';
    if (UUID_LIKE.test(seg)) return '{uuid}';
    if (seg.length >= 8 && HEX_LIKE.test(seg)) return '{h}';
    const withoutExt = seg.replace(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i, '');
    if (withoutExt.length >= 8 && HEX_LIKE.test(withoutExt)) return '{h}';
    if (isOpaqueIdSegment(seg)) return '{id}';
    return seg;
  });
}

/**
 * Extract page-like token from filename. Returns { num, basePattern }.
 * num: most likely page number (prefer last numeric run in basename).
 * basePattern: basename with numbers replaced by {n}, without extension.
 */
function extractFileToken(filename) {
  if (!filename || typeof filename !== 'string') return { num: null, basePattern: '' };
  const base = filename.replace(/\?.*$/, '').split('/').pop() || '';
  const noExt = base.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
  const numRuns = noExt.match(/\d+/g);
  const num = numRuns && numRuns.length > 0
    ? parseInt(numRuns[numRuns.length - 1], 10)
    : null;
  const basePattern = noExt.replace(/\d+/g, '{n}') || 'image';
  return { num, basePattern };
}

/**
 * Build URL signature: prefixSig (host + up to 3 normalized segments), fullSig, depth, ext, pathSegments (for similarity).
 */
function buildUrlSignature(url) {
  const parsed = parseUrlSafe(url);
  if (!parsed) return { prefixSig: 'data', fullSig: 'data', depth: 0, ext: '', pathSegments: [] };
  const norm = normalizePathSegments(parsed.pathname);
  const depth = norm.length;
  const prefixSegs = norm.slice(0, 3);
  const prefixSig = [parsed.host, ...prefixSegs].join('/') || parsed.host;
  const filename = (parsed.pathname.split('/').filter(Boolean).pop() || '').replace(/\?.*$/, '');
  const { basePattern } = extractFileToken(filename);
  const ext = parsed.ext || (EXT_RE.test(filename) ? (filename.match(/\.(jpg|jpeg|png|gif|webp)/i) || [])[0].slice(1).toLowerCase() : '');
  const fullSig = norm.length ? `${parsed.host}/${norm.join('/')}/${basePattern}.${ext}` : `${parsed.host}/${basePattern}.${ext}`;
  return { prefixSig, fullSig, depth, ext, pathSegments: norm, basePattern };
}

/**
 * Per-image score 0..100: area, min dimension, aspect ratio, URL signals; penalties for junk, tiny, repeated URLs.
 * Optional cohesionBonus 0..10 added when image belongs to high-cohesion prefix group.
 */
function scoreImage(img, index, stats, cohesionBonus = 0) {
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

  // Positive: URL cohesion bonus (+0..10)
  score += Math.min(10, Math.max(0, cohesionBonus));

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
 * Return per-image score components for debug (area, aspect, cohesion, junk, tiny, repeated).
 */
function scoreImageComponents(img, index, stats, cohesionBonus = 0) {
  const url = getUrl(img);
  const { w, h } = getDimensions(img);
  const components = { area: 0, aspect: 0, cohesionBonus: Math.min(10, Math.max(0, cohesionBonus)), junkPenalty: 0, tinyPenalty: 0, repeatedPenalty: 0, urlHints: 0, ext: 0 };
  const area = w * h;
  if (stats.maxArea > 0 && area > 0) {
    const areaRatio = Math.min(1, area / stats.maxArea);
    components.area = Math.round(30 * areaRatio);
  }
  const minDim = Math.min(w, h);
  if (w > 0 && h > 0) {
    const ratio = h / w;
    const ratioLand = w / h;
    if (ratio >= 1.2 && ratio <= 1.9) components.aspect = 10;
    else if (ratio > 2.0) components.aspect = 10;
    else if (ratioLand > 1.2) components.aspect = 5;
  }
  if (IMAGE_EXT.test(url)) components.ext = 2;
  const hintMatches = url.match(WEAK_HINTS);
  if (hintMatches) components.urlHints = Math.min(8, hintMatches.length * 2);
  const junkMatches = url.match(JUNK_TOKENS);
  if (junkMatches) components.junkPenalty = Math.min(35, 10 + junkMatches.length * 5);
  const maxDim = Math.max(w, h);
  if (maxDim > 0 && maxDim < TINY_SIZE) components.tinyPenalty = 25;
  const urlKey = url.split('?')[0].split('#')[0];
  const urlCount = stats.urlCounts.get(urlKey) || 0;
  if (urlCount > 3) components.repeatedPenalty = Math.min(20, (urlCount - 3) * 5);
  return components;
}

/**
 * URL similarity 0..1 of candidate meta to winner (prefixSig + selected set fullSig/pathSegments/basePattern).
 */
function urlSimilarityToWinner(candidateMeta, winnerPrefixSig, selectedMetas) {
  if (!candidateMeta || !winnerPrefixSig || !selectedMetas || selectedMetas.length === 0) return 0;
  const prefixMatch = candidateMeta.prefixSig === winnerPrefixSig ? 1 : 0;
  const winnerFullSigs = new Set(selectedMetas.map((m) => m.fullSig));
  const fullSigMatch = winnerFullSigs.has(candidateMeta.fullSig) ? 1 : 0;
  const candidateSegs = candidateMeta.pathSegments || [];
  const winnerSegsSet = new Set(selectedMetas.flatMap((m) => m.pathSegments || []));
  const segmentOverlap = candidateSegs.length === 0
    ? (prefixMatch ? 0.5 : 0)
    : candidateSegs.filter((s) => winnerSegsSet.has(s)).length / Math.max(candidateSegs.length, 1);
  const winnerBasePatterns = new Set(selectedMetas.map((m) => m.basePattern || '').filter(Boolean));
  const basePatternMatch = winnerBasePatterns.has(candidateMeta.basePattern) ? 1 : 0;
  const fullSigScore = fullSigMatch > 0 ? 1 : 0.5 * segmentOverlap + 0.5 * basePatternMatch;
  return 0.35 * prefixMatch + 0.35 * fullSigScore + 0.15 * Math.min(1, segmentOverlap * 2) + 0.15 * (prefixMatch && (segmentOverlap > 0 || basePatternMatch) ? 1 : basePatternMatch);
}

/**
 * Median absolute deviation for robust spread (MAD).
 */
function mad(values) {
  if (!values.length) return 0;
  const m = median(values);
  const absDev = values.map((v) => Math.abs(v - m));
  return median(absDev);
}

/**
 * Numeric sequence strength 0..1: collect nums from file tokens; if >= 5, sort unique, gaps; score high when many gaps are 1 and median gap small.
 */
function numericSequenceStrength(nums) {
  const clean = nums.filter((n) => n != null && Number.isFinite(n));
  if (clean.length < 5) return 0;
  const unique = [...new Set(clean)].sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < unique.length; i++) gaps.push(unique[i] - unique[i - 1]);
  const medianGap = median(gaps);
  const ones = gaps.filter((g) => g === 1).length;
  const ratioOnes = gaps.length > 0 ? ones / gaps.length : 0;
  const smallGap = medianGap <= 2 ? 1 : Math.max(0, 1 - (medianGap - 2) / 10);
  return 0.6 * ratioOnes + 0.4 * smallGap;
}

/**
 * Compute urlCohesion per prefix group: dominance, extConsistency, depthConsistency, numericSequenceStrength.
 */
function computeUrlCohesionPerPrefix(imagesWithMeta, totalCandidates) {
  const byPrefix = new Map();
  imagesWithMeta.forEach(({ img, index, meta }) => {
    const prefixSig = meta.prefixSig;
    if (!byPrefix.has(prefixSig)) byPrefix.set(prefixSig, []);
    byPrefix.get(prefixSig).push({ img, index, meta });
  });

  const result = new Map();
  byPrefix.forEach((candidates, prefixSig) => {
    const count = candidates.length;
    const dominance = totalCandidates > 0 ? count / totalCandidates : 0;
    const exts = candidates.map(({ meta }) => meta.ext || '');
    const extCounts = new Map();
    exts.forEach((e) => extCounts.set(e, (extCounts.get(e) || 0) + 1));
    const maxExtCount = Math.max(...extCounts.values(), 1);
    const extConsistency = maxExtCount / candidates.length;
    const depths = candidates.map(({ meta }) => meta.depth);
    const depthVar = stddev(depths);
    const depthConsistency = depthVar === 0 ? 1 : Math.max(0, 1 - depthVar / 3);
    const nums = candidates.map(({ meta }) => meta.fileNum);
    const numericSequenceStrengthVal = numericSequenceStrength(nums);
    const urlCohesion = Math.max(
      0,
      Math.min(
        1,
        0.45 * dominance +
          0.2 * extConsistency +
          0.15 * depthConsistency +
          0.2 * numericSequenceStrengthVal,
      ),
    );
    result.set(prefixSig, {
      urlCohesion,
      numericSequenceStrength: numericSequenceStrengthVal,
      count,
      dominance,
      extConsistency,
      depthConsistency,
    });
  });
  return result;
}

/**
 * Orientation-invariant size bucket key from (w, h): same bucket for portrait vs landscape of similar size.
 * bucketMin = floor(minDim/step)*step, bucketMax = ceil(maxDim/step)*step.
 */
function orientationInvariantBucketKey(w, h, step = SIZE_BUCKET_STEP) {
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  if (minDim <= 0 && maxDim <= 0) return 'nodim';
  const bucketMin = Math.floor(minDim / step) * step;
  const bucketMax = Math.ceil(maxDim / step) * step;
  return `${bucketMin}|${bucketMax}`;
}

/**
 * Group by prefixSig (normalized), then by orientation-invariant size bucket (minDim|maxDim);
 * prefixSig-only when size missing. Fallback global size cluster.
 * This avoids splitting same-chapter images into different groups solely due to portrait vs landscape (spread).
 */
function buildGroups(images, scores, urlMetaList, cohesionByPrefix) {
  const byPrefix = new Map();
  images.forEach((img, i) => {
    const meta = urlMetaList[i] || { prefixSig: 'data', depth: 0, ext: '' };
    const prefixSig = meta.prefixSig;
    if (!byPrefix.has(prefixSig)) byPrefix.set(prefixSig, []);
    byPrefix.get(prefixSig).push({ img, index: i, score: scores[i], meta });
  });

  const groups = [];
  const { w: medianW } = medianDimensions(images);

  byPrefix.forEach((candidates, prefixSig) => {
    const widths = candidates.map(({ img }) => getDimensions(img).w).filter(Boolean);
    const medianWidth = widths.length ? median(widths) : medianW || 800;
    const cohesion = cohesionByPrefix.get(prefixSig) || { urlCohesion: 0, numericSequenceStrength: 0 };

    const byBucket = new Map();
    candidates.forEach(({ img, index, score, meta }) => {
      const { w, h } = getDimensions(img);
      const bucket = orientationInvariantBucketKey(w, h);
      if (!byBucket.has(bucket)) byBucket.set(bucket, []);
      byBucket.get(bucket).push({ img, index, score });
    });

    byBucket.forEach((items, bucket) => {
      if (items.length >= MIN_GROUP_COUNT || (items.length >= 1 && widths.length === 0)) {
        groups.push({
          key: `${prefixSig}|${bucket}`,
          items,
          medianWidth,
          prefixSig,
          urlCohesion: cohesion.urlCohesion,
          numericSequenceStrength: cohesion.numericSequenceStrength,
        });
      }
    });

    if (widths.length === 0 && candidates.length >= MIN_GROUP_COUNT) {
      groups.push({
        key: prefixSig,
        items: candidates.map(({ img, index, score }) => ({ img, index, score })),
        medianWidth: medianW || 800,
        prefixSig,
        urlCohesion: cohesion.urlCohesion,
        numericSequenceStrength: cohesion.numericSequenceStrength,
      });
    }
  });

  const allWithDims = images.map((img, i) => ({ img, index: i, score: scores[i] }))
    .filter(({ img }) => getDimensions(img).w > 0);
  if (allWithDims.length >= MIN_GROUP_COUNT) {
    const byGlobalBucket = new Map();
    allWithDims.forEach(({ img, index, score }) => {
      const { w, h } = getDimensions(img);
      const bucket = orientationInvariantBucketKey(w, h);
      if (!byGlobalBucket.has(bucket)) byGlobalBucket.set(bucket, []);
      byGlobalBucket.get(bucket).push({ img, index, score });
    });
    const med = median(allWithDims.map(({ img }) => getDimensions(img).w));
    byGlobalBucket.forEach((items, bucket) => {
      if (items.length >= MIN_GROUP_COUNT) {
        groups.push({
          key: `global|${bucket}`,
          items,
          medianWidth: med,
          prefixSig: 'global',
          urlCohesion: 0,
          numericSequenceStrength: 0,
        });
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

const AMBIGUITY_THRESHOLD = 0.08;
const URL_COHESION_CLEAR_WIN = 0.15;

/**
 * Group confidence 0..1: avgScore, sizeConsistency, dominance, countScore, sequenceCoherence, urlCohesion, junkRate.
 * If many items missing dimensions, sizeConsistency neutral 0.5. If urlCohesion >= 0.75 and count >= 8, allow high confidence with missing dims.
 */
function groupConfidence(group, totalCandidates) {
  const items = group.items;
  const count = items.length;
  const countScore = Math.min(1, count / 15);
  const dominance = totalCandidates > 0 ? count / totalCandidates : 0;
  const widths = items.map(({ img }) => getDimensions(img).w).filter(Boolean);
  const missingDims = items.length - widths.length;
  let sizeConsistency = 0.5;
  if (widths.length > 0) {
    sizeConsistency = Math.max(0, 1 - stddev(widths) / (median(widths) || 1));
    if (missingDims > items.length / 2) sizeConsistency = 0.5;
  }
  const urlCohesion = group.urlCohesion != null ? group.urlCohesion : 0;
  if (urlCohesion >= 0.75 && count >= 8 && missingDims > 0) {
    sizeConsistency = Math.max(sizeConsistency, 0.5);
  }
  const avgScore = items.reduce((s, { score }) => s + score, 0) / (items.length * 100);
  const urls = items.map(({ img }) => getUrl(img));
  const junkCount = urls.filter((u) => (u.match(JUNK_TOKENS) || []).length > 0).length;
  const junkRate = urls.length ? junkCount / urls.length : 0;
  const indices = items.map(({ index }) => index);
  const coherence = sequenceCoherence(indices);

  let confidence =
    0.22 * avgScore +
    0.16 * sizeConsistency +
    0.18 * dominance +
    0.18 * countScore +
    0.12 * coherence +
    0.22 * urlCohesion -
    0.22 * junkRate;
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Main API: auto-detect page images from the existing extracted list.
 * Debug: result.debug.candidates explains why each candidate was excluded (junk, below_min_score, competing_group, or selected).
 * URL similarity: when the chosen group is highly cohesive, candidates with high urlSimilarityToWinner get a gated score boost
 * and can be included in post-pass (same prefixSig, area within MAD bounds); MIN_PAGE_SCORE override only when cohesion and
 * similarity are very high. Junk filtering remains strict (icons/ads/tracking excluded).
 *
 * @param {Array} images - Same list as shown in popup. Each item has at least url/src, optional width/height (or naturalWidth/naturalHeight, displayWidth/displayHeight).
 * @param {object} opts - Optional options (reserved).
 * @returns {{ selected: Array, confidence: number, groups: Array, reason: string, debug?: { candidates: Array }, spreadIncludedCount?: number, similarityIncludedReasons?: Array }}
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

  const totalCandidates = images.length;
  const urlMetaList = images.map((img) => {
    const url = getUrl(img);
    const sig = buildUrlSignature(url);
    const parsed = parseUrlSafe(url);
    let fileNum = null;
    if (parsed && parsed.pathname) {
      const filename = parsed.pathname.split('/').filter(Boolean).pop() || '';
      fileNum = extractFileToken(filename).num;
    }
    return { ...sig, fileNum };
  });
  const imagesWithMeta = images.map((img, index) => ({
    img,
    index,
    meta: urlMetaList[index],
  }));
  const cohesionByPrefix = computeUrlCohesionPerPrefix(imagesWithMeta, totalCandidates);
  const cohesionBonusByPrefix = new Map();
  cohesionByPrefix.forEach((v, prefixSig) => {
    cohesionBonusByPrefix.set(prefixSig, Math.min(10, Math.round(v.urlCohesion * 10)));
  });
  const cohesionBonuses = urlMetaList.map((m) => cohesionBonusByPrefix.get(m.prefixSig) || 0);

  const scores = images.map((img, i) => scoreImage(img, i, stats, cohesionBonuses[i]));
  const groups = buildGroups(images, scores, urlMetaList, cohesionByPrefix);

  const indexToGroupKey = new Map();
  groups.forEach((group) => {
    group.items.forEach(({ index }) => indexToGroupKey.set(index, group.key));
  });

  let best = { group: null, confidence: 0, meanScore: 0 };
  let second = { group: null, confidence: 0 };
  const groupInfos = [];

  groups.forEach((group) => {
    const confidence = groupConfidence(group, totalCandidates);
    const meanScore = group.items.reduce((s, { score }) => s + score, 0) / group.items.length;
    groupInfos.push({
      key: group.key,
      count: group.items.length,
      confidence,
      meanScore,
      urlCohesion: group.urlCohesion != null ? group.urlCohesion : 0,
      numericSequenceStrength: group.numericSequenceStrength != null ? group.numericSequenceStrength : 0,
    });
    if (confidence > best.confidence) {
      second = { group: best.group, confidence: best.confidence };
      best = { group, confidence, meanScore };
    } else if (confidence > second.confidence && group !== best.group) {
      second = { group, confidence };
    }
  });

  let selected = [];
  let overallConfidence = 0;
  let reason = 'no suitable group';
  let spreadIncludedCount = 0;
  const spreadIncludedReasons = [];
  const similarityIncludedReasons = [];
  const debug = { candidates: [] };

  if (best.group) {
    const winnerPrefixSig = best.group.prefixSig;
    const urlCohesion = best.group.urlCohesion != null ? best.group.urlCohesion : 0;
    const count = best.group.items.length;
    const gatedBoost = urlCohesion >= COHESION_FOR_SIMILARITY_BOOST && count >= COUNT_FOR_SIMILARITY_BOOST && winnerPrefixSig && winnerPrefixSig !== 'global';

    const winnerMetasForSim = best.group.items.map(({ index: idx }) => urlMetaList[idx] || {});
    selected = best.group.items
      .filter(({ score, index }) => {
        const meta = urlMetaList[index] || {};
        const urlSim = urlSimilarityToWinner(meta, winnerPrefixSig, winnerMetasForSim);
        const boost = gatedBoost ? Math.min(SIMILARITY_BOOST_CAP, urlSim * SIMILARITY_BOOST_CAP) : 0;
        return score + boost >= MIN_PAGE_SCORE;
      })
      .map(({ img }) => img);
    const selectedMetas = selected.map((img) => {
      const i = images.indexOf(img);
      return i >= 0 ? (urlMetaList[i] || {}) : {};
    });

    overallConfidence = best.confidence;

    if (second.group && second.confidence > 0) {
      const diff = best.confidence - second.confidence;
      const topCohesion = best.group.urlCohesion != null ? best.group.urlCohesion : 0;
      const secondCohesion = second.group.urlCohesion != null ? second.group.urlCohesion : 0;
      const countMuchLarger = best.group.items.length >= second.group.items.length * 1.5;
      const cohesionClearWin = topCohesion - secondCohesion > URL_COHESION_CLEAR_WIN;
      if (diff < AMBIGUITY_THRESHOLD && !cohesionClearWin && !countMuchLarger) {
        overallConfidence = Math.max(0, overallConfidence - 0.06);
      }
    }

    const selectedKeys = new Set(selected.map(imageKey));
    const selectedAreas = selected.map((img) => {
      const { w, h } = getDimensions(img);
      return w * h;
    }).filter((a) => a > 0);
    const medianArea = selectedAreas.length > 0 ? median(selectedAreas) : 0;
    const madArea = selectedAreas.length > 0 ? mad(selectedAreas) : 0;
    const areaMin = medianArea * SPREAD_AREA_MIN;
    const areaMax = medianArea * SPREAD_AREA_MAX;
    const areaMinMAD = medianArea - MAD_K * (madArea || medianArea * 0.3);
    const areaMaxMAD = medianArea + MAD_K * (madArea || medianArea * 0.3);

    if (winnerPrefixSig && winnerPrefixSig !== 'global' && urlCohesion >= COHESION_FOR_SIMILARITY_BOOST && count >= COUNT_FOR_SIMILARITY_BOOST) {
      const added = [];
      images.forEach((img, i) => {
        if (selectedKeys.has(imageKey(img))) return;
        const meta = urlMetaList[i] || {};
        if (meta.prefixSig !== winnerPrefixSig) return;
        const url = getUrl(img);
        if ((url.match(JUNK_TOKENS) || []).length > 0) return;
        const urlSim = urlSimilarityToWinner(meta, winnerPrefixSig, selectedMetas);
        const { w, h } = getDimensions(img);
        const area = w * h;
        const inAreaRange = area > 0 && area >= areaMinMAD && area <= areaMaxMAD;
        const inSpreadRange = area > 0 && area >= areaMin && area <= areaMax;
        const allowOverride = urlCohesion >= COHESION_FOR_OVERRIDE && urlSim >= SIMILARITY_FOR_OVERRIDE && scores[i] >= MIN_SCORE_OVERRIDE;
        if (inSpreadRange && scores[i] >= MIN_PAGE_SCORE) {
          selectedKeys.add(imageKey(img));
          added.push(img);
          spreadIncludedReasons.push({ index: i, area, medianArea, prefixSig: winnerPrefixSig });
        } else if (allowOverride && inAreaRange) {
          selectedKeys.add(imageKey(img));
          added.push(img);
          similarityIncludedReasons.push({ index: i, area, medianArea, urlSimilarityToWinner: urlSim, includedByUrlSimilarity: true });
        }
      });
      if (added.length > 0) {
        spreadIncludedCount = spreadIncludedReasons.length;
        const similarityAdded = similarityIncludedReasons.length;
        selected = [...selected, ...added];
      }
    }

    reason = `best group ${best.group.key} count=${best.group.items.length} confidence=${overallConfidence.toFixed(2)}`;
    if (spreadIncludedCount > 0) reason += ` spreadIncluded=${spreadIncludedCount}`;
    if (similarityIncludedReasons.length > 0) reason += ` similarityIncluded=${similarityIncludedReasons.length}`;
  }

  const selectedByKey = new Map();
  selected.forEach((img) => {
    const k = imageKey(img);
    if (!selectedByKey.has(k)) selectedByKey.set(k, img);
  });
  selected = [...selectedByKey.values()];

  const winnerPrefixSig = best.group ? best.group.prefixSig : null;
  const selectedMetasForDebug = selected.map((img) => {
    const i = images.indexOf(img);
    return i >= 0 ? (urlMetaList[i] || {}) : {};
  }).filter((m) => m.prefixSig);
  const selectedDedupKeys = new Set(selected.map(imageKey));
  const dedupKeyToFirstSelectedIndex = new Map();
  selected.forEach((img) => {
    const k = imageKey(img);
    if (!dedupKeyToFirstSelectedIndex.has(k)) {
      const idx = images.indexOf(img);
      if (idx >= 0) dedupKeyToFirstSelectedIndex.set(k, idx);
    }
  });
  debug.winningGroupKey = best.group ? best.group.key : null;
  debug.winningUrlCohesion = best.group && best.group.urlCohesion != null ? best.group.urlCohesion : null;
  debug.winningCount = best.group ? best.group.items.length : null;
  debug.postPassRan = (spreadIncludedCount > 0 || similarityIncludedReasons.length > 0);

  images.forEach((img, index) => {
    const meta = urlMetaList[index] || {};
    const groupKey = indexToGroupKey.get(index) ?? null;
    const inWinningGroup = best.group && groupKey === best.group.key;
    const url = getUrl(img);
    const queryless = getQuerylessUrl(img);
    const isJunk = (url.match(JUNK_TOKENS) || []).length > 0;
    const urlSim = winnerPrefixSig && selectedMetasForDebug.length ? urlSimilarityToWinner(meta, winnerPrefixSig, selectedMetasForDebug) : 0;
    const components = scoreImageComponents(img, index, stats, cohesionBonuses[index]);
    const score = scores[index];
    const { w, h } = getDimensions(img);
    const sizeBucketKey = orientationInvariantBucketKey(w, h);
    const dedupKey = imageKey(img);
    const isSelected = selected.some((s) => imageKey(s) === dedupKey);
    const otherWithSameKeySelected = !isSelected && selectedDedupKeys.has(dedupKey);
    let exclusionReason = null;
    if (isSelected) {
      exclusionReason = 'selected';
    } else if (isJunk) {
      exclusionReason = 'junk';
    } else if (best.group && inWinningGroup && score < MIN_PAGE_SCORE) {
      exclusionReason = 'below_min_score';
    } else if (best.group && !inWinningGroup) {
      exclusionReason = 'competing_group';
    } else if (!best.group) {
      exclusionReason = 'no_winner';
    } else {
      exclusionReason = 'below_min_score';
    }
    debug.candidates.push({
      index,
      rawUrl: url,
      querylessUrl: queryless,
      prefixSig: meta.prefixSig,
      fullSig: meta.fullSig,
      sizeBucketKey,
      perImageScore: score,
      groupKey,
      inWinningGroup: !!inWinningGroup,
      score,
      scoreComponents: components,
      exclusionReason,
      urlSimilarityToWinner: urlSim,
      dedupKey,
      droppedDueToKeyCollision: !!otherWithSameKeySelected,
    });
  });

  return {
    selected,
    confidence: overallConfidence,
    groups: groupInfos,
    reason,
    spreadIncludedCount,
    spreadIncludedReasons,
    similarityIncludedReasons,
    debug,
  };
}

export default autoDetectPages;

/**
 * Lightweight self-tests (no framework). Call from console or test runner.
 * Fixture A: same prefixSig + sequential filenames -> high confidence (>0.75).
 * Fixture B: mixed icons/ads -> low confidence (<0.45).
 * Fixture C: two competing groups -> top chosen, ambiguity penalty applied.
 */
export function runSelfTests() {
  const base = 'https://cdn.example.com/manga/title/chapter1';
  const fixtureA = Array.from({ length: 20 }, (_, i) => ({
    src: `${base}/${String(i + 1).padStart(3, '0')}.png`,
    width: 800,
    height: 1200,
  }));
  const resultA = autoDetectPages(fixtureA);
  const passA = resultA.confidence > 0.75;
  console.log('[autoDetectPages] Fixture A (sequential URLs):', passA ? 'PASS' : 'FAIL', 'confidence=', resultA.confidence.toFixed(3));

  const fixtureB = [
    { src: 'https://site.com/logo.png', width: 64, height: 64 },
    { src: 'https://site.com/ads/banner.gif', width: 728, height: 90 },
    { src: 'https://site.com/avatar/user123.jpg', width: 48, height: 48 },
    { src: 'https://site.com/tracking/pixel.png', width: 1, height: 1 },
    { src: 'https://other.com/random/image1.jpg', width: 200, height: 200 },
    { src: 'https://other.com/random/image2.jpg', width: 150, height: 150 },
  ];
  const resultB = autoDetectPages(fixtureB);
  const passB = resultB.confidence < 0.45;
  console.log('[autoDetectPages] Fixture B (mixed/icons):', passB ? 'PASS' : 'FAIL', 'confidence=', resultB.confidence.toFixed(3));

  const prefix1 = 'https://cdn.a.com/series/vol1';
  const prefix2 = 'https://cdn.a.com/series/vol2';
  const fixtureC = [
    ...Array.from({ length: 10 }, (_, i) => ({ src: `${prefix1}/page_${i + 1}.jpg`, width: 800, height: 1200 })),
    ...Array.from({ length: 10 }, (_, i) => ({ src: `${prefix2}/page_${i + 1}.jpg`, width: 800, height: 1200 })),
  ];
  const resultC = autoDetectPages(fixtureC);
  const topGroup = resultC.groups.length >= 1 ? resultC.groups[0] : null;
  const secondGroup = resultC.groups.length >= 2 ? resultC.groups[1] : null;
  const ambiguityApplied = secondGroup && (topGroup.confidence - secondGroup.confidence) < AMBIGUITY_THRESHOLD
    ? resultC.confidence <= topGroup.confidence
    : true;
  const passC = resultC.selected.length > 0 && ambiguityApplied;
  console.log('[autoDetectPages] Fixture C (competing groups):', passC ? 'PASS' : 'FAIL', 'confidence=', resultC.confidence.toFixed(3), 'top=', topGroup?.key);

  const allPass = passA && passB && passC;
  console.log('[autoDetectPages] Self-tests:', allPass ? 'ALL PASS' : 'SOME FAIL');
  return allPass;
}
