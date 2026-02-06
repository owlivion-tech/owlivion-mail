// ============================================================================
// Owlivion Mail - Conflict Resolution Modal (Enhanced)
// ============================================================================

import { useState } from 'react';
import { resolveConflict } from '../../services/syncService';
import type { ConflictInfo } from '../../types';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ConflictInfo[];
  masterPassword: string;
  onResolveComplete: () => void;
}

export function ConflictResolutionModal({
  isOpen,
  onClose,
  conflicts,
  masterPassword,
  onResolveComplete,
}: ConflictResolutionModalProps) {
  const [selectedStrategies, setSelectedStrategies] = useState<
    Map<string, 'use_local' | 'use_server'>
  >(new Map());
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Strategy selection handler
  const handleStrategyChange = (
    dataType: string,
    strategy: 'use_local' | 'use_server'
  ) => {
    setSelectedStrategies((prev) => new Map(prev).set(dataType, strategy));
  };

  // Resolve all conflicts
  const handleResolve = async () => {
    // Validation: all conflicts must have selected strategy
    if (selectedStrategies.size !== conflicts.length) {
      setError('Lütfen tüm çakışmalar için bir strateji seçin');
      return;
    }

    setResolving(true);
    setError(null);

    try {
      // Resolve each conflict
      for (const conflict of conflicts) {
        const strategy = selectedStrategies.get(conflict.dataType);
        if (!strategy) continue;

        await resolveConflict(conflict.dataType, strategy, masterPassword);
      }

      // Success
      onResolveComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Çözüm başarısız');
    } finally {
      setResolving(false);
    }
  };

  // Get data type label with icon
  const getDataTypeLabel = (dataType: string) => {
    switch (dataType) {
      case 'contacts':
        return '📇 Kişiler';
      case 'accounts':
        return '📧 Hesaplar';
      case 'preferences':
        return '⚙️ Tercihler';
      case 'signatures':
        return '✍️ İmzalar';
      default:
        return dataType;
    }
  };

  // Get field label in Turkish
  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      // Account fields
      display_name: 'Görünen Ad',
      imap_host: 'IMAP Sunucu',
      imap_port: 'IMAP Port',
      imap_security: 'IMAP Güvenlik',
      smtp_host: 'SMTP Sunucu',
      smtp_port: 'SMTP Port',
      smtp_security: 'SMTP Güvenlik',
      signature: 'İmza',
      sync_days: 'Senkronizasyon Günleri',
      is_default: 'Varsayılan Hesap',
      oauth_provider: 'OAuth Sağlayıcı',

      // Preferences fields
      theme: 'Tema',
      language: 'Dil',
      notifications_enabled: 'Bildirimler',
      notification_sound: 'Bildirim Sesi',
      notification_badge: 'Bildirim Rozeti',
      auto_mark_read: 'Otomatik Okundu İşaretle',
      auto_mark_read_delay: 'Okundu Gecikmesi',
      confirm_delete: 'Silme Onayı',
      confirm_send: 'Gönderme Onayı',
      signature_position: 'İmza Konumu',
      reply_position: 'Cevap Konumu',
      gemini_api_key: 'Gemini API Anahtarı',
      ai_auto_summarize: 'AI Otomatik Özet',
      ai_reply_tone: 'AI Cevap Tonu',
      keyboard_shortcuts_enabled: 'Klavye Kısayolları',
      compact_list_view: 'Kompakt Liste',
      show_avatars: 'Avatar Göster',
      conversation_view: 'Konuşma Görünümü',

      // Signature fields
      signature_html: 'İmza İçeriği',
    };

    return labels[field] || field;
  };

  // Render field-level diff for accounts/preferences
  const renderFieldDiff = (conflict: ConflictInfo) => {
    if (!conflict.fieldChanges || conflict.fieldChanges.length === 0) {
      return null;
    }

    return (
      <div className="mb-4 p-3 bg-owl-surface-1 rounded border border-owl-border">
        <div className="text-xs font-medium text-owl-text-primary mb-2">
          Değişen Alanlar ({conflict.fieldChanges.length})
        </div>
        <div className="flex flex-wrap gap-2">
          {conflict.fieldChanges.map((field) => (
            <span
              key={field}
              className="px-2 py-1 bg-owl-warning/20 text-owl-warning text-xs rounded"
            >
              {getFieldLabel(field)}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Render data comparison based on type
  const renderDataComparison = (conflict: ConflictInfo) => {
    // Signatures: Special HTML preview
    if (conflict.dataType === 'signatures') {
      return (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Local Signature */}
          <div className="border-l-4 border-owl-accent p-3 bg-owl-surface-3 rounded">
            <div className="text-xs font-medium text-owl-text-primary mb-2">
              Yerel İmza
            </div>
            {conflict.localData?.signature_html ? (
              <>
                <div className="text-xs text-owl-text-muted mb-1">Önizleme:</div>
                <div
                  className="p-2 bg-white text-black rounded text-xs mb-2 max-h-32 overflow-auto"
                  dangerouslySetInnerHTML={{ __html: conflict.localData.signature_html }}
                />
                <div className="text-xs text-owl-text-muted">
                  Düz metin: {conflict.localData.signature_text || 'Boş'}
                </div>
              </>
            ) : (
              <div className="text-xs text-owl-text-muted">İmza yok</div>
            )}
            {conflict.localUpdatedAt && (
              <div className="text-xs text-owl-text-muted mt-2">
                Güncellenme: {new Date(conflict.localUpdatedAt).toLocaleString('tr-TR')}
              </div>
            )}
          </div>

          {/* Server Signature */}
          <div className="border-l-4 border-owl-warning p-3 bg-owl-surface-3 rounded">
            <div className="text-xs font-medium text-owl-text-primary mb-2">
              Sunucu İmzası
            </div>
            {conflict.serverData?.signature_html ? (
              <>
                <div className="text-xs text-owl-text-muted mb-1">Önizleme:</div>
                <div
                  className="p-2 bg-white text-black rounded text-xs mb-2 max-h-32 overflow-auto"
                  dangerouslySetInnerHTML={{ __html: conflict.serverData.signature_html }}
                />
                <div className="text-xs text-owl-text-muted">
                  Düz metin: {conflict.serverData.signature_text || 'Boş'}
                </div>
              </>
            ) : (
              <div className="text-xs text-owl-text-muted">İmza yok</div>
            )}
            {conflict.serverUpdatedAt && (
              <div className="text-xs text-owl-text-muted mt-2">
                Güncellenme: {new Date(conflict.serverUpdatedAt).toLocaleString('tr-TR')}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Accounts/Preferences/Contacts: Field-by-field comparison
    if (conflict.dataType === 'accounts' || conflict.dataType === 'preferences') {
      const changedFields = conflict.fieldChanges || [];

      return (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Local Data */}
          <div className="border-l-4 border-owl-accent p-3 bg-owl-surface-3 rounded">
            <div className="text-xs font-medium text-owl-text-primary mb-2">
              Yerel Veri
            </div>
            <div className="space-y-1 text-xs max-h-64 overflow-auto">
              {changedFields.length > 0 ? (
                changedFields.map((field) => (
                  <div key={field} className="flex justify-between items-start gap-2">
                    <span className="font-medium text-owl-text-primary">{getFieldLabel(field)}:</span>
                    <span className="text-owl-accent break-all">
                      {JSON.stringify(conflict.localData[field])}
                    </span>
                  </div>
                ))
              ) : (
                <pre className="text-owl-text-secondary font-mono whitespace-pre-wrap">
                  {JSON.stringify(conflict.localData, null, 2)}
                </pre>
              )}
            </div>
            {conflict.localUpdatedAt && (
              <div className="text-xs text-owl-text-muted mt-2">
                Güncellenme: {new Date(conflict.localUpdatedAt).toLocaleString('tr-TR')}
              </div>
            )}
          </div>

          {/* Server Data */}
          <div className="border-l-4 border-owl-warning p-3 bg-owl-surface-3 rounded">
            <div className="text-xs font-medium text-owl-text-primary mb-2">
              Sunucu Verisi
            </div>
            <div className="space-y-1 text-xs max-h-64 overflow-auto">
              {changedFields.length > 0 ? (
                changedFields.map((field) => (
                  <div key={field} className="flex justify-between items-start gap-2">
                    <span className="font-medium text-owl-text-primary">{getFieldLabel(field)}:</span>
                    <span className="text-owl-warning break-all">
                      {JSON.stringify(conflict.serverData[field])}
                    </span>
                  </div>
                ))
              ) : (
                <pre className="text-owl-text-secondary font-mono whitespace-pre-wrap">
                  {JSON.stringify(conflict.serverData, null, 2)}
                </pre>
              )}
            </div>
            {conflict.serverUpdatedAt && (
              <div className="text-xs text-owl-text-muted mt-2">
                Güncellenme: {new Date(conflict.serverUpdatedAt).toLocaleString('tr-TR')}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Default: JSON view (for contacts)
    return (
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border-l-4 border-owl-accent p-3 bg-owl-surface-3 rounded">
          <div className="text-xs font-medium text-owl-text-primary mb-2">
            Yerel Veri
          </div>
          <pre className="text-xs text-owl-text-secondary overflow-auto max-h-32 font-mono whitespace-pre-wrap">
            {JSON.stringify(conflict.localData, null, 2)}
          </pre>
          {conflict.localUpdatedAt && (
            <div className="text-xs text-owl-text-muted mt-2">
              Güncellenme: {new Date(conflict.localUpdatedAt).toLocaleString('tr-TR')}
            </div>
          )}
        </div>

        <div className="border-l-4 border-owl-warning p-3 bg-owl-surface-3 rounded">
          <div className="text-xs font-medium text-owl-text-primary mb-2">
            Sunucu Verisi
          </div>
          <pre className="text-xs text-owl-text-secondary overflow-auto max-h-32 font-mono whitespace-pre-wrap">
            {JSON.stringify(conflict.serverData, null, 2)}
          </pre>
          {conflict.serverUpdatedAt && (
            <div className="text-xs text-owl-text-muted mt-2">
              Güncellenme: {new Date(conflict.serverUpdatedAt).toLocaleString('tr-TR')}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-owl-surface-1 rounded-lg shadow-xl border border-owl-border overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-owl-border">
          <h2 className="text-2xl font-bold text-owl-text-primary mb-2">
            Senkronizasyon Çakışmaları
          </h2>
          <p className="text-sm text-owl-text-secondary">
            {conflicts.length} çakışma tespit edildi. Lütfen her biri için bir çözüm seçin.
          </p>
        </div>

        {/* Conflict List */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {conflicts.map((conflict, index) => (
            <div
              key={index}
              className="border border-owl-warning rounded-lg p-4 bg-owl-surface-2"
            >
              {/* Data Type Badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 bg-owl-warning/10 text-owl-warning rounded-full text-sm font-medium">
                  {getDataTypeLabel(conflict.dataType)}
                </span>
              </div>

              {/* Conflict Details */}
              <p className="text-sm text-owl-text-secondary mb-4">
                {conflict.conflictDetails}
              </p>

              {/* Field-level diff (if available) */}
              {renderFieldDiff(conflict)}

              {/* Data Comparison */}
              {renderDataComparison(conflict)}

              {/* Strategy Selection */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-owl-border rounded cursor-pointer hover:bg-owl-surface-1 transition-colors">
                  <input
                    type="radio"
                    name={`strategy-${index}`}
                    value="use_local"
                    checked={
                      selectedStrategies.get(conflict.dataType) === 'use_local'
                    }
                    onChange={() =>
                      handleStrategyChange(conflict.dataType, 'use_local')
                    }
                    className="w-4 h-4 accent-owl-accent"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-owl-text-primary">
                      Yerel veriyi kullan
                    </div>
                    <div className="text-xs text-owl-text-secondary">
                      Sunucudaki değişiklikler silinecek
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border border-owl-border rounded cursor-pointer hover:bg-owl-surface-1 transition-colors">
                  <input
                    type="radio"
                    name={`strategy-${index}`}
                    value="use_server"
                    checked={
                      selectedStrategies.get(conflict.dataType) === 'use_server'
                    }
                    onChange={() =>
                      handleStrategyChange(conflict.dataType, 'use_server')
                    }
                    className="w-4 h-4 accent-owl-accent"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-owl-text-primary">
                      Sunucu verisini kullan
                    </div>
                    <div className="text-xs text-owl-text-secondary">
                      Yerel değişiklikler silinecek
                    </div>
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-owl-error/10 border border-owl-error rounded text-owl-error text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-6 border-t border-owl-border flex gap-3">
          <button
            onClick={onClose}
            disabled={resolving}
            className="flex-1 px-4 py-2 border border-owl-border rounded hover:bg-owl-surface-2 text-owl-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            İptal
          </button>
          <button
            onClick={handleResolve}
            disabled={
              resolving || selectedStrategies.size !== conflicts.length
            }
            className="flex-1 px-4 py-2 bg-owl-accent text-white rounded hover:bg-owl-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resolving ? 'Çözülüyor...' : 'Tümünü Çöz'}
          </button>
        </div>
      </div>
    </div>
  );
}
