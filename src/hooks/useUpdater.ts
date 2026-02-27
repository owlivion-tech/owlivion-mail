import { useState, useEffect, useCallback } from "react";
import { check } from "@tauri-apps/plugin-updater";

interface UpdateInfo {
  version: string;
  body: string | null;
}

export function useUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdate = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    try {
      const update = await check();
      if (update) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: update.version,
          body: update.body ?? null,
        });
        return update;
      }
      setUpdateAvailable(false);
      setUpdateInfo(null);
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Don't treat "no updater config" as a real error in dev mode
      if (!msg.includes("updater not configured")) {
        setError(msg);
      }
      return null;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setError(null);
    try {
      const update = await check();
      if (!update) return;

      let totalSize = 0;
      let downloaded = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalSize = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (totalSize > 0) {
            setDownloadProgress(Math.round((downloaded / totalSize) * 100));
          }
        } else if (event.event === "Finished") {
          setDownloadProgress(100);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsDownloading(false);
    }
  }, []);

  // Check on mount (after 5 second delay to not block startup)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 5000);
    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  return {
    updateAvailable,
    updateInfo,
    isChecking,
    isDownloading,
    downloadProgress,
    error,
    checkForUpdate,
    downloadAndInstall,
  };
}
