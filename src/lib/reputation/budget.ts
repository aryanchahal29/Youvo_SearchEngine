export class VerificationBudgetManager {
  private readonly maxTotalTavilyCalls: number;
  private readonly maxTavilyCallsPerCandidate: number;
  private totalCallsMade: number = 0;
  private candidateCalls: Map<string, number> = new Map();

  constructor(maxTotalCalls: number = 15, maxCallsPerCandidate: number = 3) {
    this.maxTotalTavilyCalls = maxTotalCalls;
    this.maxTavilyCallsPerCandidate = maxCallsPerCandidate;
  }

  /**
   * Atomically attempts to consume a Tavily call for a specific candidate.
   * Returns true if the budget allows it, false otherwise.
   */
  public tryConsumeTavilyCall(candidateId: string): boolean {
    if (this.totalCallsMade >= this.maxTotalTavilyCalls) {
      return false;
    }

    const callsForCandidate = this.candidateCalls.get(candidateId) || 0;
    if (callsForCandidate >= this.maxTavilyCallsPerCandidate) {
      return false;
    }

    // Since JS is single-threaded, this check-and-increment is atomic per event-loop tick
    this.totalCallsMade++;
    this.candidateCalls.set(candidateId, callsForCandidate + 1);

    return true;
  }

  public getTotalCalls(): number {
    return this.totalCallsMade;
  }

  public getCandidateCalls(candidateId: string): number {
    return this.candidateCalls.get(candidateId) || 0;
  }

  public getRemainingTavilyCalls(): number {
    return this.maxTotalTavilyCalls - this.totalCallsMade;
  }
}
