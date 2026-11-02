/** Copy feedback is shown only on success; unavailable or denied clipboard access is silent. */
export async function copyPrivacyId(userId: string, onCopied: () => void): Promise<void> {
  try {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(userId);
    onCopied();
  } catch {
    // Clipboard access can be unavailable or denied by the platform.
  }
}
