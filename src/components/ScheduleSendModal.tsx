// ============================================================================
// Owlivion Mail - Schedule Send Modal
// Lets user pick a future time to send an email
// ============================================================================

import { useState } from 'react';
import { useTranslation } from '../i18n';

interface ScheduleSendModalProps {
  onSchedule: (sendAt: string) => void;
  onClose: () => void;
}

function getPresetDate(preset: string): Date {
  const now = new Date();

  if (preset === 'tomorrow_morning') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  if (preset === 'tomorrow_noon') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(13, 0, 0, 0);
    return d;
  }

  if (preset === 'monday_morning') {
    const d = new Date(now);
    const day = d.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + daysUntilMonday);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  return now;
}

function toISO(d: Date): string {
  return d.toISOString();
}

export function ScheduleSendModal({ onSchedule, onClose }: ScheduleSendModalProps) {
  const { t } = useTranslation();
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');
  const [showCustom, setShowCustom] = useState(false);

  const PRESETS = [
    { label: t('scheduleSend.tomorrowMorning'), preset: 'tomorrow_morning' as const },
    { label: t('scheduleSend.tomorrowAfternoon'), preset: 'tomorrow_noon' as const },
    { label: t('scheduleSend.mondayMorning'), preset: 'monday_morning' as const },
  ];

  const handlePreset = (preset: string) => {
    const d = getPresetDate(preset);
    onSchedule(toISO(d));
  };

  const handleCustom = () => {
    if (!customDate) return;
    const [h, m] = customTime.split(':').map(Number);
    const d = new Date(customDate);
    d.setHours(h, m, 0, 0);

    if (d <= new Date()) return;
    onSchedule(toISO(d));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-owl-bg-secondary rounded-xl border border-owl-border w-full max-w-[320px] mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-owl-border">
          <h3 className="text-sm font-semibold text-owl-text-primary">{t('scheduleSend.title')}</h3>
          <p className="text-xs text-owl-text-muted mt-1">{t('scheduleSend.subtitle')}</p>
        </div>

        <div className="p-2">
          {PRESETS.map((preset, i) => {
            const d = getPresetDate(preset.preset);
            const timeStr = d.toLocaleString('tr-TR', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <button
                key={i}
                onClick={() => handlePreset(preset.preset)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm hover:bg-owl-bg-tertiary transition-colors group"
              >
                <span className="text-owl-text-primary group-hover:text-owl-accent-primary">
                  {preset.label}
                </span>
                <span className="text-xs text-owl-text-muted">{timeStr}</span>
              </button>
            );
          })}

          <div className="border-t border-owl-border mt-1 pt-1">
            {!showCustom ? (
              <button
                onClick={() => setShowCustom(true)}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-owl-text-secondary hover:bg-owl-bg-tertiary transition-colors text-left"
              >
                {t('scheduleSend.customDate')}
              </button>
            ) : (
              <div className="p-3 space-y-2">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-2 py-1.5 bg-owl-bg-primary border border-owl-border rounded text-sm text-owl-text-primary"
                />
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full px-2 py-1.5 bg-owl-bg-primary border border-owl-border rounded text-sm text-owl-text-primary"
                />
                <button
                  onClick={handleCustom}
                  disabled={!customDate}
                  className="w-full py-1.5 bg-owl-accent-primary text-white text-sm rounded-lg hover:bg-owl-accent-primary/90 disabled:opacity-50 transition-colors"
                >
                  {t('scheduleSend.scheduleAction')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
