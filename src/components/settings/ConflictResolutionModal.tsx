// ============================================================================
// Owlivion Mail - Conflict Resolution Modal
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-owl-surface-1 rounded-lg shadow-xl border border-owl-border overflow-hidden">
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

              {/* Data Comparison */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Local Data */}
                <div className="border-l-4 border-owl-accent p-3 bg-owl-surface-3 rounded">
                  <div className="text-xs font-medium text-owl-text-primary mb-2">
                    Yerel Veri
                  </div>
                  <pre className="text-xs text-owl-text-secondary overflow-auto max-h-32 font-mono">
                    {JSON.stringify(conflict.localData, null, 2)}
                  </pre>
                  {conflict.localUpdatedAt && (
                    <div className="text-xs text-owl-text-muted mt-2">
                      Güncellenme:{' '}
                      {new Date(conflict.localUpdatedAt).toLocaleString('tr-TR')}
                    </div>
                  )}
                </div>

                {/* Server Data */}
                <div className="border-l-4 border-owl-warning p-3 bg-owl-surface-3 rounded">
                  <div className="text-xs font-medium text-owl-text-primary mb-2">
                    Sunucu Verisi
                  </div>
                  <pre className="text-xs text-owl-text-secondary overflow-auto max-h-32 font-mono">
                    {JSON.stringify(conflict.serverData, null, 2)}
                  </pre>
                  {conflict.serverUpdatedAt && (
                    <div className="text-xs text-owl-text-muted mt-2">
                      Güncellenme:{' '}
                      {new Date(conflict.serverUpdatedAt).toLocaleString('tr-TR')}
                    </div>
                  )}
                </div>
              </div>

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
