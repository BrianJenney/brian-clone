import { median } from "../lib/util";
import type { Post, ScoredPost } from "../schemas";

export type ScoreOptions = {
  now?: Date;
  /** Posts younger than this haven't finished their initial distribution; don't judge them. */
  minAgeHours?: number;
  /** views / account-median to count as an outlier. 3x is a signal, 5–10x is strong. */
  threshold?: number;
  /** Fallback for posts with no account history (keyword search): views / followers. */
  viewsPerFollowerThreshold?: number;
  /** Minimum other posts by the same account needed for a baseline. */
  minBaselinePosts?: number;
};

/**
 * Outlier scoring, the same method vidIQ / Sandcastles-style tools use:
 * compare each post against the *same account's* typical (median) views, so a
 * 50k-view post on a 5k-median account beats a 500k-view post on a 1M-median one.
 */
export function scorePosts(
  posts: Post[],
  opts: ScoreOptions = {},
): ScoredPost[] {
  const {
    now = new Date(),
    minAgeHours = 48,
    threshold = 3,
    viewsPerFollowerThreshold = 2,
    minBaselinePosts = 5,
  } = opts;

  const byAccount = new Map<string, Post[]>();
  for (const p of posts) {
    const key = `${p.platform}:${p.handle}`;
    byAccount.set(key, [...(byAccount.get(key) ?? []), p]);
  }

  const ageHours = (p: Post) =>
    Math.max(1, (now.getTime() - new Date(p.postedAt).getTime()) / 3_600_000);

  return posts.map((p) => {
    const age = ageHours(p);
    const peers = (byAccount.get(`${p.platform}:${p.handle}`) ?? []).filter(
      (q) => q.id !== p.id && ageHours(q) >= minAgeHours,
    );
    const baseline =
      peers.length >= minBaselinePosts
        ? median(peers.map((q) => q.views))
        : null;
    const multiple = baseline && baseline > 0 ? p.views / baseline : null;
    const viewsPerFollower = p.followers ? p.views / p.followers : null;
    const sharesPerView =
      p.shares !== null && p.views > 0 ? p.shares / p.views : null;
    const matured = age >= minAgeHours;
    const isOutlier =
      matured &&
      (multiple !== null
        ? multiple >= threshold
        : viewsPerFollower !== null &&
          viewsPerFollower >= viewsPerFollowerThreshold);
    return {
      ...p,
      ageHours: Math.round(age),
      baselineViews: baseline,
      multiple: multiple === null ? null : Math.round(multiple * 10) / 10,
      viewsPerFollower:
        viewsPerFollower === null
          ? null
          : Math.round(viewsPerFollower * 100) / 100,
      sharesPerView,
      viewsPerHour: Math.round(p.views / age),
      isOutlier,
    };
  });
}

/** Rank outliers: account multiple first, then share rate (sends drive non-follower reach). */
export function rankOutliers(scored: ScoredPost[]): ScoredPost[] {
  const key = (s: ScoredPost) =>
    (s.multiple ?? s.viewsPerFollower ?? 0) * (1 + 10 * (s.sharesPerView ?? 0));
  return scored.filter((s) => s.isOutlier).sort((a, b) => key(b) - key(a));
}
