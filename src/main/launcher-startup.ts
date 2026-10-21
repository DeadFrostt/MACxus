/** A locked wallet must never keep the whole launcher behind Steam's spinner. */
export async function showBeforeAccountCheck(show: () => Promise<void>, refresh: () => Promise<unknown>, failed: () => void): Promise<void> {
  await show();
  // Deliberately not awaited. A native wallet prompt must not hide the launcher.
  void Promise.resolve().then(refresh).catch(failed);
}
