export const FORBIDDEN_TRANSITIONS = ["Ready->derive-terminal-report", "Planned->derive-terminal-report", "Authorized->derive-terminal-report", "RiskAccepted->derive-terminal-report"];
export const runCase = invocation => ({ candidateId: invocation.candidateId, caseId: invocation.caseId });
