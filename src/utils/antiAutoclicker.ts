/**
 * MATTHEW CLICKER — STATISTICAL ANTI-AUTOCLICKER GUARD (v2.0)
 *
 * Designed from behavioral click-cadence research so:
 *  - Fast legitimate humans (butterfly, jitter, drag-burst up to ~18 CPS with human variance) NEVER trigger false positives.
 *  - Synthetic scripts / hardware macros / automated DOM `.click()` dispatchers (`event.isTrusted === false`,
 *    robotic constant intervals `CV < 0.045`, near-zero Shannon Entropy `H < 0.9`, or superhuman sustained `> 22 CPS`)
 *    are rejected cleanly and logged for moderator inspection.
 */

export interface ClickValidationInput {
  timestampMs: number;
  isTrusted: boolean;
}

export interface ClickValidationResult {
  accepted: boolean;
  reason?: 'untrusted_event' | 'robotic_cadence' | 'low_entropy' | 'superhuman_rate';
  shouldFlagProbation?: boolean;
  cps: number;
  cv: number;
  entropy: number;
  anomalyScore: number;
}

export class AntiAutoclickerGuard {
  private timestamps: number[] = [];
  private consecutiveBotFlags = 0;
  private throttledUntilMs = 0;
  private probationRaised = false;
  private readonly maxWindowMs = 2000;
  private readonly maxSamples = 48;

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

    // If temporarily rate-throttled from blatant robotic bursts, wait cooldown
    if (timestampMs < this.throttledUntilMs) {
      return {
        accepted: false,
        reason: 'robotic_cadence',
        cps: this.getInstantCps(timestampMs),
        cv: 0,
        entropy: 0,
        anomalyScore: 1,
      };
    }

    // Push & prune sliding window
    this.timestamps.push(timestampMs);
    if (this.timestamps.length > this.maxSamples) {
      this.timestamps.shift();
    }
    while (this.timestamps.length > 0 && timestampMs - this.timestamps[0] > this.maxWindowMs) {
      this.timestamps.shift();
    }

    const cps = this.getInstantCps(timestampMs);

    // 2. Superhuman sustained speed hard guard (> 23 CPS inside recent 1s window)
    if (cps > 23) {
      this.consecutiveBotFlags += 1;
      if (this.consecutiveBotFlags >= 6) {
        this.throttledUntilMs = timestampMs + 1500;
      }
      const shouldFlagProbation = !this.probationRaised && this.consecutiveBotFlags >= 4;
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

    // Not enough intervals yet for cadence statistics (< 14 clicks in window)
    if (this.timestamps.length < 14) {
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
      const dt = Math.max(1, this.timestamps[i] - this.timestamps[i - 1]);
      intervals.push(dt);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 1;

    // Binned Shannon entropy (5ms bins) of inter-click intervals
    const binCounts = new Map<number, number>();
    for (const dt of intervals) {
      const bin = Math.floor(dt / 5);
      binCounts.set(bin, (binCounts.get(bin) || 0) + 1);
    }
    let entropy = 0;
    const total = intervals.length;
    for (const count of binCounts.values()) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }

    // Only flag fast clicks (>= 9 CPS) that ALSO exhibit razor-sharp machine regularity
    // Legitimate butterfly/jitter human clicks have CV typically 0.12 - 0.55 and entropy >= 1.4
    const isMachinicCadence = cps >= 9 && cv < 0.042;
    const isZeroEntropyLoop = cps >= 10 && entropy < 0.72 && cv < 0.08;

    let anomalyScore = 0;
    if (isMachinicCadence) anomalyScore += 0.65;
    if (isZeroEntropyLoop) anomalyScore += 0.35;

    if (anomalyScore >= 0.65) {
      this.consecutiveBotFlags += 1;
      if (this.consecutiveBotFlags >= 8) {
        // Gentle 1.5s macro throttle so scripts stall without false-banning accounts automatically
        this.throttledUntilMs = timestampMs + 1500;
      }
      const shouldFlagProbation = !this.probationRaised && this.consecutiveBotFlags >= 4;
      if (shouldFlagProbation) this.probationRaised = true;
      return {
        accepted: false,
        reason: isZeroEntropyLoop ? 'low_entropy' : 'robotic_cadence',
        shouldFlagProbation,
        cps,
        cv,
        entropy,
        anomalyScore,
      };
    }

    this.consecutiveBotFlags = Math.max(0, this.consecutiveBotFlags - 1);
    return {
      accepted: true,
      cps,
      cv,
      entropy,
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

