import {
  ipcDeleteAllLocalData,
  ipcRestartApp,
  ipcQuitApp,
  type CleanupResultDto,
} from "../../lib/tauri/ipc";

export type { CleanupResultDto };

export function clearAppWebStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("text-dynamics") || key.startsWith("text_dynamics"))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn("Failed to clear app localStorage keys:", e);
  }

  try {
    sessionStorage.clear();
  } catch (e) {
    console.warn("Failed to clear sessionStorage:", e);
  }
}

export async function deleteAllLocalData(): Promise<CleanupResultDto> {
  const result = await ipcDeleteAllLocalData();
  // Clear frontend-owned storage after backend cleanup completes
  clearAppWebStorage();
  return result;
}

export async function restartApplication(): Promise<void> {
  return ipcRestartApp();
}

export async function quitApplication(): Promise<void> {
  return ipcQuitApp();
}
