export function writeTakramV3FormalEvidence(
  captureEnabled: boolean,
  write: () => void
) {
  if (!captureEnabled) return false;
  write();
  return true;
}
