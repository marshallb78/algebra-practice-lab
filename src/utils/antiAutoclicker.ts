/**
 * MATTHEW CLICKER — STATISTICAL ANTI-AUTOCLICKER GUARD (v3.0)
 *
 * Tuned for 60Hz Chromebook/trackpad timing so fast natural clicking (< 25 CPS with natural jitter)
 * never triggers false positives, while rejecting:
 *  - Non-user synthetic events (`event.isTrusted === false`)
 *  - Superhuman bursts at or above the 25 CPS cutoff (`cps >= AUTOCLICKER_CPS_CUTOFF`)
 *  - Robotic hardware/software macro loops (`CV < 0.042 && stdDev < 2.2` or near-identical repeating intervals)
 */

export const AUTOCLICKER_CPS_CUTOFF = 25;
export const AUTOBAN_CPS_CUTOFF = 50;

export interface ClickValidationInput {
  timestampMs: number;
  isTrusted: boolean;
}

export interface ClickValidationResult {
  accepted: boolean;
  reason?: 'untrusted_event' | 'robotic_cadence' | 'low_entropy' | 'superhuman_rate';
  shouldFlagProbation?: boolean;
  shouldAutoBan?: boolean;
  cps: number;
  cv: number;
  entropy: number;
  anomalyScore: number;
}

export class AntiAutoclickerGuard {
  private timestamps: number[] = [];
  private consecutiveBotFlags = 0;
  private consecutiveCpsViolations = 0;
  private throttledUntilMs = 0;
  private probationRaised = false;
  private readonly maxWindowMs = 2000;
  private readonly maxSamples = 60;

  public evaluateClick(input: ClickValidationInput): ClickValidationResult {
    const { timestampMs, isTrusted } = input;

    // 1. Reject programmatic non-user clicks immediately
    if (!isTrusted) {
      this.consecutiveBotFlags += 1;
      const shouldFlagProbation = !this.probationRaised && this.consecutiveBotFlags >= 3;
      if (shouldFlagProbation) this.probationRaised = true;
      return {
        accepted: false,
        reason: 'untrusted_event',
        shouldFlagProbation,
        cps: 0,
        cv: 0,
        entropy: 0,
        anomalyScore: 1,
      };
    }

    // Record every trusted click timestamp BEFORE early exits so instant CPS reflects raw true speed (25..100+ CPS)
    this.timestamps.push(timestampMs);
    if (this.timestamps.length > this.maxSamples) {
      this.timestamps.shift();
    }
    while (this.timestamps.length > 0 && timestampMs - this.timestamps[0] > this.maxWindowMs) {
      this.timestamps.shift();
    }

    const cps = this.getInstantCps(timestampMs);

    // 2. Immediate auto-ban flag threshold at >= 50 CPS
    if (cps >= AUTOBAN_CPS_CUTOFF) {
      this.consecutiveBotFlags += 1;
      this.throttledUntilMs = timestampMs + 5000;
      const shouldFlagProbation = !this.probationRaised;
      this.probationRaised = true;
      return {
        accepted: false,
        reason: 'superhuman_rate',
        shouldFlagProbation,
        shouldAutoBan: true,
        cps,
        cv: 0,
        entropy: 0,
        anomalyScore: 1,
      };
    }

    // If temporarily rate-throttled from blatant robotic bursts, wait cooldown
    if (timestampMs < this.throttledUntilMs) {
      return {
        accepted: false,
        reason: 'robotic_cadence',
        cps,
        cv: 0,
        entropy: 0,
        anomalyScore: 1,
      };
    }

    // 3. Superhuman speed cutoff (>= 25 CPS inside 1s window)
    if (cps >= AUTOCLICKER_CPS_CUTOFF) {
      this.consecutiveCpsViolations += 1;
      this.consecutiveBotFlags += 1;
      this.throttledUntilMs = timestampMs + 1500;
      const shouldFlagProbation =
        !this.probationRaised && (this.consecutiveCpsViolations >= 2 || cps >= 28);
      if (shouldFlagProbation) this.probationRaised = true;
      return {
        accepted: false,
        reason: 'superhuman_rate',
        shouldFlagProbation,
        cps,
        cv: 0,
        entropy: 0,
        anomalyScore: 0.95,
      };
    }
    this.consecutiveCpsViolations = 0;

    // Require >= 20 samples and >= 12 CPS before cadence variance checks (avoids 60Hz Chromebook false positives)
    if (this.timestamps.length < 20 || cps < 12) {
      this.consecutiveBotFlags = Math.max(0, this.consecutiveBotFlags - 1);
      return {
        accepted: true,
        cps,
        cv: 1,
        entropy: 2.5,
        anomalyScore: 0,
      };
    }

    const intervals: number[] = [];
    for (let i = 1; i < this.timestamps.length; i++) {
      const dt = Math.max(0.5, this.timestamps[i] - this.timestamps[i - 1]);
      intervals.push(dt);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1;

    // Count nearly identical adjacent intervals (|dt[i] - dt[i-1]| <= 1.5ms), typical of timer loops
    let nearIdenticalPairs = 0;
    for (let i = 1; i < intervals.length; i++) {
      if (Math.abs(intervals[i] - intervals[i - 1]) <= 1.5) {
        nearIdenticalPairs++;
      }
    }
    const nearIdenticalRatio =
      intervals.length > 1 ? nearIdenticalPairs / (intervals.length - 1) : 0;

    const isMachinicCadence = cv < 0.042 && stdDev < 2.2;
    const isLoopPattern = nearIdenticalRatio >= 0.85 && cv < 0.065;

    let anomalyScore = 0;
    if (isMachinicCadence) anomalyScore += 0.7;
    if (isLoopPattern) anomalyScore += 0.65;

    if (anomalyScore >= 0.65) {
      this.consecutiveBotFlags += 1;
      if (this.consecutiveBotFlags >= 4) {
        this.throttledUntilMs = timestampMs + 1500;
      }
      const shouldFlagProbation = !this.probationRaised && this.consecutiveBotFlags >= 4;
      if (shouldFlagProbation) this.probationRaised = true;
      return {
        accepted: false,
        reason: isLoopPattern && !isMachinicCadence ? 'low_entropy' : 'robotic_cadence',
        shouldFlagProbation,
        cps,
        cv,
        entropy: nearIdenticalRatio,
        anomalyScore,
      };
    }

    this.consecutiveBotFlags = Math.max(0, this.consecutiveBotFlags - 1);
    return {
      accepted: true,
      cps,
      cv,
      entropy: nearIdenticalRatio,
      anomalyScore,
    };
  }

  public getInstantCps(nowMs: number = Date.now()): number {
    const oneSecAgo = nowMs - 1000;
    let count = 0;
    for (let i = this.timestamps.length - 1; i >= 0; i--) {
      if (this.timestamps[i] >= oneSecAgo) count++;
      else break;
    }
    return count;
  }

  public reset(): void {
    this.timestamps = [];
    this.consecutiveBotFlags = 0;
    this.consecutiveCpsViolations = 0;
    this.throttledUntilMs = 0;
    this.probationRaised = false;
  }
}

/**
 * Validates server-side / cloud score deltas to block devtools/memory-injected coin jumps.
 * Caps a single sync delta against generous upper bound of active CPS + click power + pet/event buffs.
 */
export function validateCloudScoreProgression(params: {
  previousScore: number;
  proposedScore: number;
  elapsedSeconds: number;
  estimatedMaxRatePerSec: number;
}): { valid: boolean; clampedScore: number } {
  const { previousScore, proposedScore, elapsedSeconds, estimatedMaxRatePerSec } = params;
  if (!Number.isFinite(proposedScore) || proposedScore < 0) {
    return { valid: false, clampedScore: Math.max(0, previousScore) };
  }
  const safeElapsed = Math.max(5, Math.min(86400 * 3, elapsedSeconds));
  const maxReasonableGain = Math.max(5e6, estimatedMaxRatePerSec * safeElapsed * 25);
  if (proposedScore - previousScore > maxReasonableGain && previousScore > 0) {
    return {
      valid: false,
      clampedScore: Math.floor(previousScore + maxReasonableGain),
    };
  }
  return { valid: true, clampedScore: proposedScore };
}

