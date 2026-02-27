// ============================================================================
// Owlivion Mail - Attachment Preview Modal
// ============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Attachment, AttachmentThreatAnalysis } from '../types';
import { getFileIcon, formatFileSize, canPreview, isImageType, isPdfType, base64ToBlob } from '../utils/attachmentUtils';
import { analyzeMagicBytes, analyzeAttachmentWithAI, getThreatLabel } from '../services/attachmentThreatService';
import { useToastStore } from '../stores/toastStore';

interface AttachmentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  attachments: Attachment[];
  initialIndex: number;
  accountId: string;
  folder: string;
  emailUid: number;
  attachmentThreats?: Record<number, AttachmentThreatAnalysis> | null;
  geminiApiKey?: string;
  emailContext?: { from: { name: string; email: string }; subject: string };
}

interface CachedAttachment {
  blobUrl: string;
  contentType: string;
  filename: string;
  rawBase64?: string;
}

export function AttachmentPreview({
  isOpen,
  onClose,
  attachments,
  initialIndex,
  accountId,
  folder,
  emailUid,
  attachmentThreats,
  geminiApiKey,
  emailContext,
}: AttachmentPreviewProps) {
  const toast = useToastStore();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<number, CachedAttachment>>({});
  const [zoom, setZoom] = useState(1);
  const [aiAnalysis, setAiAnalysis] = useState<Record<number, AttachmentThreatAnalysis>>({});
  const [analyzingAI, setAnalyzingAI] = useState(false);
  const [magicBytesThreats, setMagicBytesThreats] = useState<Record<number, AttachmentThreatAnalysis>>({});
  const [warningCollapsed, setWarningCollapsed] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const currentAttachment = attachments[currentIndex];

  // Get the effective threat analysis for current attachment (AI > magic bytes merged > static)
  const getEffectiveThreat = useCallback((attIndex: number): AttachmentThreatAnalysis | null => {
    return aiAnalysis[attIndex] || magicBytesThreats[attIndex] || attachmentThreats?.[attIndex] || null;
  }, [aiAnalysis, magicBytesThreats, attachmentThreats]);

  const currentThreat = currentAttachment ? getEffectiveThreat(currentAttachment.index) : null;
  const showWarning = currentThreat && currentThreat.score >= 20;

  // Reset state when modal opens with new attachment
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoom(1);
      setError(null);
      setWarningCollapsed(false);
    }
  }, [isOpen, initialIndex]);

  // Load attachment data
  useEffect(() => {
    if (!isOpen || !currentAttachment) return;
    if (cache[currentAttachment.index]) return;
    if (!canPreview(currentAttachment.contentType)) return;

    let cancelled = false;

    const loadAttachment = async () => {
      setLoading(true);
      setError(null);
      try {
        const { downloadAttachment } = await import('../services/mailService');
        const result = await downloadAttachment(accountId, folder, emailUid, currentAttachment.index);

        if (cancelled) return;

        const blob = base64ToBlob(result.data, result.contentType);
        const blobUrl = URL.createObjectURL(blob);

        setCache(prev => ({
          ...prev,
          [currentAttachment.index]: {
            blobUrl,
            contentType: result.contentType,
            filename: result.filename,
            rawBase64: result.data,
          },
        }));

        // Run magic bytes analysis after download
        const magicResult = analyzeMagicBytes(result.data, result.filename, result.contentType);
        if (magicResult) {
          const staticThreat = attachmentThreats?.[currentAttachment.index];
          const mergedScore = (staticThreat?.score || 0) + (magicResult.severity === 'critical' ? 60 : magicResult.severity === 'high' ? 40 : 20);
          setMagicBytesThreats(prev => ({
            ...prev,
            [currentAttachment.index]: {
              isMalicious: mergedScore >= 50,
              riskLevel: mergedScore >= 80 ? 'critical' : mergedScore >= 50 ? 'high' : mergedScore >= 25 ? 'medium' : mergedScore >= 10 ? 'low' : 'safe',
              score: mergedScore,
              reasons: [...(staticThreat?.reasons || []), magicResult.detail],
              recommendations: [
                ...(staticThreat?.recommendations || []),
                'Dosyanın gerçek formatı bildirilen formatla uyuşmuyor - açmayın',
              ],
              detectedThreats: [...(staticThreat?.detectedThreats || []), magicResult],
            },
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Ek yüklenirken hata oluştu: ${err}`);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAttachment();
    return () => { cancelled = true; };
  }, [isOpen, currentAttachment, accountId, folder, emailUid, cache, attachmentThreats]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(cache).forEach(c => URL.revokeObjectURL(c.blobUrl));
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          navigatePrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateNext();
          break;
        case 'Enter':
          e.preventDefault();
          handleDownload();
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom(z => Math.min(z + 0.25, 3));
          break;
        case '-':
          e.preventDefault();
          setZoom(z => Math.max(z - 0.25, 0.25));
          break;
        case '0':
          e.preventDefault();
          setZoom(1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, attachments.length]);

  const navigatePrev = useCallback(() => {
    setCurrentIndex(i => (i > 0 ? i - 1 : attachments.length - 1));
    setZoom(1);
    setWarningCollapsed(false);
  }, [attachments.length]);

  const navigateNext = useCallback(() => {
    setCurrentIndex(i => (i < attachments.length - 1 ? i + 1 : 0));
    setZoom(1);
    setWarningCollapsed(false);
  }, [attachments.length]);

  const handleDownload = useCallback(async () => {
    if (!currentAttachment) return;
    try {
      const { downloadAttachment } = await import('../services/mailService');
      const result = await downloadAttachment(accountId, folder, emailUid, currentAttachment.index);

      const blob = base64ToBlob(result.data, result.contentType);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Ek indirme hatasi', 'Dosya indirilirken bir hata olustu.');
    }
  }, [currentAttachment, accountId, folder, emailUid]);

  const handleAIAnalysis = useCallback(async () => {
    if (!currentAttachment || !geminiApiKey || analyzingAI) return;
    if (aiAnalysis[currentAttachment.index]) return;

    setAnalyzingAI(true);
    try {
      const staticThreat = getEffectiveThreat(currentAttachment.index) || {
        isMalicious: false,
        riskLevel: 'safe' as const,
        score: 0,
        reasons: [],
        recommendations: [],
        detectedThreats: [],
      };

      const cached = cache[currentAttachment.index];
      let hexBytes: string | null = null;
      if (cached?.rawBase64) {
        const { extractHexFromBase64 } = await import('../services/attachmentThreatService');
        hexBytes = extractHexFromBase64(cached.rawBase64);
      }

      const result = await analyzeAttachmentWithAI(
        { filename: currentAttachment.filename, contentType: currentAttachment.contentType, size: currentAttachment.size },
        emailContext,
        hexBytes,
        staticThreat,
        geminiApiKey,
        'tr'
      );

      setAiAnalysis(prev => ({ ...prev, [currentAttachment.index]: result }));
    } catch (err) {
      console.error('AI analysis failed:', err);
    } finally {
      setAnalyzingAI(false);
    }
  }, [currentAttachment, geminiApiKey, analyzingAI, aiAnalysis, cache, emailContext, getEffectiveThreat]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  if (!isOpen || !currentAttachment) return null;

  const cached = cache[currentAttachment.index];
  const previewable = canPreview(currentAttachment.contentType);

  // Warning banner colors
  const bannerColors = currentThreat ? {
    critical: { bg: 'bg-red-500/15', border: 'border-red-500/40', text: 'text-red-400', icon: 'text-red-500' },
    high: { bg: 'bg-orange-500/15', border: 'border-orange-500/40', text: 'text-orange-400', icon: 'text-orange-500' },
    medium: { bg: 'bg-yellow-500/15', border: 'border-yellow-500/40', text: 'text-yellow-400', icon: 'text-yellow-500' },
    low: { bg: 'bg-blue-400/10', border: 'border-blue-400/30', text: 'text-blue-400', icon: 'text-blue-400' },
    safe: { bg: '', border: '', text: '', icon: '' },
  }[currentThreat.riskLevel as string as 'critical' | 'high' | 'medium' | 'low' | 'safe'] : null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="relative flex flex-col w-[90vw] h-[90vh] max-w-6xl bg-owl-bg rounded-xl border border-owl-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-owl-border bg-owl-surface">
          <div className="text-owl-accent">
            {getFileIcon(currentAttachment.contentType, currentAttachment.filename)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-owl-text truncate">{currentAttachment.filename}</p>
            <p className="text-xs text-owl-text-secondary">
              {formatFileSize(currentAttachment.size)}
              {attachments.length > 1 && ` — ${currentIndex + 1} / ${attachments.length}`}
            </p>
          </div>

          {/* Zoom controls (only for images) */}
          {isImageType(currentAttachment.contentType) && cached && (
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))}
                className="p-1.5 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors"
                title="Küçült (-)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-xs text-owl-text-secondary min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                className="p-1.5 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors"
                title="Büyüt (+)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-1.5 text-xs text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors ml-1"
                title="Sıfırla (0)"
              >
                1:1
              </button>
            </div>
          )}

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="p-2 text-owl-text-secondary hover:text-owl-accent hover:bg-owl-accent/10 rounded-lg transition-colors"
            title="İndir (Enter)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 text-owl-text-secondary hover:text-owl-text hover:bg-owl-surface-2 rounded-lg transition-colors"
            title="Kapat (Esc)"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Threat Warning Banner */}
        {showWarning && bannerColors && (
          <div className={`${bannerColors.bg} border-b ${bannerColors.border} px-5 py-3`}>
            <div className="flex items-start gap-3">
              {/* Shield/Warning icon */}
              <div className={`flex-shrink-0 mt-0.5 ${bannerColors.icon}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-semibold ${bannerColors.text}`}>
                    {getThreatLabel(currentThreat!.riskLevel)} — Skor: {currentThreat!.score}/100
                  </span>
                  <button
                    onClick={() => setWarningCollapsed(!warningCollapsed)}
                    className={`text-xs ${bannerColors.text} hover:underline`}
                  >
                    {warningCollapsed ? 'Detayları Göster' : 'Gizle'}
                  </button>
                </div>

                {!warningCollapsed && (
                  <>
                    <ul className={`text-xs ${bannerColors.text} space-y-0.5 mb-2`}>
                      {(currentThreat!.reasons || []).slice(0, 3).map((reason: string | undefined, i: number) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="mt-1 w-1 h-1 rounded-full bg-current flex-shrink-0" />
                          {reason}
                        </li>
                      ))}
                      {(currentThreat!.reasons || []).length > 3 && (
                        <li className="opacity-70">+{(currentThreat!.reasons || []).length - 3} daha...</li>
                      )}
                    </ul>

                    {/* AI Analysis button */}
                    {geminiApiKey && !aiAnalysis[currentAttachment.index] && (
                      <button
                        onClick={handleAIAnalysis}
                        disabled={analyzingAI}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                          analyzingAI
                            ? 'bg-owl-surface-2 text-owl-text-secondary cursor-not-allowed'
                            : `${bannerColors.bg} ${bannerColors.text} hover:opacity-80 border ${bannerColors.border}`
                        }`}
                      >
                        {analyzingAI ? (
                          <>
                            <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                            AI Analiz Ediliyor...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            AI ile Derinlemesine Analiz
                          </>
                        )}
                      </button>
                    )}

                    {/* Show AI badge if already analyzed */}
                    {aiAnalysis[currentAttachment.index] && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        AI Analiz Tamamlandı
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 flex items-center justify-center overflow-auto relative">
          {/* Navigation arrows */}
          {attachments.length > 1 && (
            <>
              <button
                onClick={navigatePrev}
                className="absolute left-3 z-10 p-2 bg-owl-surface/90 hover:bg-owl-surface-2 text-owl-text rounded-full shadow-lg transition-colors"
                title="Önceki (←)"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={navigateNext}
                className="absolute right-3 z-10 p-2 bg-owl-surface/90 hover:bg-owl-surface-2 text-owl-text rounded-full shadow-lg transition-colors"
                title="Sonraki (→)"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center gap-3 text-owl-text-secondary">
              <div className="w-10 h-10 border-3 border-owl-accent/30 border-t-owl-accent rounded-full animate-spin" />
              <p className="text-sm">Ek yükleniyor...</p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="flex flex-col items-center gap-3 text-owl-text-secondary p-8 text-center">
              <svg className="w-12 h-12 text-owl-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm">{error}</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-owl-accent hover:bg-owl-accent-hover text-white rounded-lg transition-colors text-sm"
              >
                Dosyayı İndir
              </button>
            </div>
          )}

          {/* Image preview */}
          {!loading && !error && cached && isImageType(currentAttachment.contentType) && (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
              <img
                src={cached.blobUrl}
                alt={currentAttachment.filename}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
                draggable={false}
              />
            </div>
          )}

          {/* PDF preview */}
          {!loading && !error && cached && isPdfType(currentAttachment.contentType) && (
            <iframe
              src={cached.blobUrl}
              className="w-full h-full border-0"
              title={currentAttachment.filename}
            />
          )}

          {/* Non-previewable file */}
          {!loading && !error && !previewable && (
            <div className="flex flex-col items-center gap-4 text-owl-text-secondary p-8 text-center">
              <div className="w-20 h-20 bg-owl-surface-2 rounded-2xl flex items-center justify-center">
                <div className="scale-[2]">
                  {getFileIcon(currentAttachment.contentType, currentAttachment.filename)}
                </div>
              </div>
              <div>
                <p className="text-lg font-medium text-owl-text mb-1">{currentAttachment.filename}</p>
                <p className="text-sm">{formatFileSize(currentAttachment.size)}</p>
              </div>
              <p className="text-sm">Bu dosya türü için önizleme mevcut değil.</p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2.5 bg-owl-accent hover:bg-owl-accent-hover text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Dosyayı İndir
              </button>
            </div>
          )}
        </div>

        {/* Footer - thumbnail strip for multiple attachments */}
        {attachments.length > 1 && (
          <div className="flex items-center gap-2 px-5 py-3 border-t border-owl-border bg-owl-surface overflow-x-auto">
            {attachments.map((att, idx) => {
              const attThreat = getEffectiveThreat(att.index);
              const attHasThreat = attThreat && attThreat.score >= 20;
              return (
              <button
                key={att.index}
                onClick={() => { setCurrentIndex(idx); setZoom(1); setWarningCollapsed(false); }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0 relative ${
                  idx === currentIndex
                    ? 'bg-owl-accent/20 text-owl-accent border border-owl-accent/40'
                    : attHasThreat
                      ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:border-red-500/50'
                      : 'bg-owl-surface-2 text-owl-text-secondary hover:text-owl-text border border-transparent'
                }`}
              >
                {attHasThreat && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-[7px] font-bold">!</span>
                  </span>
                )}
                {getFileIcon(att.contentType, att.filename)}
                <span className="truncate max-w-[120px]">{att.filename}</span>
              </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AttachmentPreview;
