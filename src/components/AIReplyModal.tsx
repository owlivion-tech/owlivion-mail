// ============================================================================
// Owlivion Mail - AI Reply Modal
// ============================================================================

import { useState } from 'react';
import { generateReply } from '../services/geminiService';
import type { Settings } from '../types';

interface AIReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailContent: string;
  emailSubject: string;
  senderName: string;
  apiKey?: string;
}

type Tone = Settings['aiReplyTone'];

const toneLabels: Record<Tone, { label: string; description: string }> = {
  professional: { label: 'Profesyonel', description: 'İş ortamına uygun, net ve kibar' },
  friendly: { label: 'Samimi', description: 'Dostça ama saygılı' },
  formal: { label: 'Resmi', description: 'Protokollere uygun, diplomatik' },
  casual: { label: 'Günlük', description: 'Doğal ve rahat' },
};

export function AIReplyModal({ isOpen, onClose, emailContent, emailSubject, senderName, apiKey }: AIReplyModalProps) {
  const [tone, setTone] = useState<Tone>('professional');
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [generatedReply, setGeneratedReply] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!apiKey) {
      setError('Gemini API anahtarı ayarlanmamış. Lütfen Ayarlar > AI bölümünden ayarlayın.');
      setStatus('error');
      return;
    }

    setStatus('generating');
    setError('');

    try {
      // Auto-detect language from email content
      const response = await generateReply({
        emailContent,
        tone,
        language: 'tr', // Default to Turkish
      }, apiKey);

      setGeneratedReply(response.reply);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
      setStatus('error');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStatus('idle');
    setGeneratedReply('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="w-full max-w-2xl bg-owl-surface rounded-xl shadow-2xl border border-owl-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-owl-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-owl-accent/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-owl-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-owl-text">AI Yanıt Oluştur</h2>
              <p className="text-sm text-owl-text-secondary">Gemini ile akıllı yanıt</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-owl-surface-2 text-owl-text-secondary hover:text-owl-text rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Email Context */}
          <div className="mb-6 p-4 bg-owl-bg rounded-lg border border-owl-border">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-owl-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-medium text-owl-text">{senderName}</span>
              <span className="text-xs text-owl-text-secondary">- {emailSubject}</span>
            </div>
            <p className="text-sm text-owl-text-secondary line-clamp-2">{emailContent.slice(0, 150)}...</p>
          </div>

          {/* Tone Selection */}
          {status === 'idle' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-owl-text mb-3">Yanıt Tonu Seçin</label>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(toneLabels) as Tone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      tone === t
                        ? 'border-owl-accent bg-owl-accent/10'
                        : 'border-owl-border hover:border-owl-accent/50 hover:bg-owl-surface-2'
                    }`}
                  >
                    <div className={`text-sm font-medium ${tone === t ? 'text-owl-accent' : 'text-owl-text'}`}>
                      {toneLabels[t].label}
                    </div>
                    <div className="text-xs text-owl-text-secondary mt-0.5">{toneLabels[t].description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generating State */}
          {status === 'generating' && (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-owl-accent/20 rounded-full mb-4">
                <svg className="w-8 h-8 text-owl-accent animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-owl-text font-medium">Yanıt oluşturuluyor...</p>
              <p className="text-sm text-owl-text-secondary mt-1">Gemini AI çalışıyor</p>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="p-4 bg-owl-error/10 border border-owl-error/20 rounded-lg mb-6">
              <div className="flex items-center gap-2 text-owl-error">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">Hata</span>
              </div>
              <p className="text-sm text-owl-error/80 mt-1">{error}</p>
            </div>
          )}

          {/* Generated Reply */}
          {status === 'done' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-owl-text">Oluşturulan Yanıt</label>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    copied
                      ? 'bg-owl-success/20 text-owl-success'
                      : 'bg-owl-surface-2 hover:bg-owl-border text-owl-text-secondary'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Kopyalandı
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Kopyala
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={generatedReply}
                onChange={(e) => setGeneratedReply(e.target.value)}
                className="w-full h-48 p-4 bg-owl-bg border border-owl-border rounded-lg text-owl-text placeholder-owl-text-secondary focus:outline-none focus:ring-2 focus:ring-owl-accent resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-owl-border flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-owl-text-secondary hover:text-owl-text transition-colors"
          >
            Kapat
          </button>

          {status === 'idle' && (
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-2 bg-owl-accent hover:bg-owl-accent-hover text-white rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Yanıt Oluştur
            </button>
          )}

          {(status === 'error' || status === 'done') && (
            <button
              onClick={() => { setStatus('idle'); setGeneratedReply(''); }}
              className="flex items-center gap-2 px-4 py-2 bg-owl-surface-2 hover:bg-owl-border text-owl-text rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Yeniden Dene
            </button>
          )}

          {status === 'done' && (
            <button
              onClick={() => { /* TODO: Use reply in composer */ handleClose(); }}
              className="flex items-center gap-2 px-4 py-2 bg-owl-accent hover:bg-owl-accent-hover text-white rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Yanıtla
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIReplyModal;
