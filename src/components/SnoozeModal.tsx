// ============================================================================
// Owlivion Mail - Snooze Modal
// Lets user pick a snooze time for an email
// ============================================================================

import { useState } from 'react';

interface SnoozeModalProps {
  onSnooze: (snoozeUntil: string) => void;
  onClose: () => void;
}

const PRESETS = [
  { label: '1 saat sonra', hours: 1 },
  { label: '4 saat sonra', hours: 4 },
  { label: 'Yarin sabah', preset: 'tomorrow_morning' as const },
  { label: 'Yarin aksam', preset: 'tomorrow_evening' as const },
  { label: '2 gun sonra', days: 2 },
  { label: '1 hafta sonra', days: 7 },
];

function getPresetDate(preset: typeof PRESETS[number]): Date {
  const now = new Date();

  if ('preset' in preset && preset.preset === 'tomorrow_morning') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  if ('preset' in preset && preset.preset === 'tomorrow_evening') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d;
  }

  if ('hours' in preset && preset.hours) {
    return new Date(now.getTime() + preset.hours * 60 * 60 * 1000);
  }

  if ('days' in preset && preset.days) {
    const d = new Date(now);
    d.setDate(d.getDate() + preset.days);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  return now;
}

function toLocalISO(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function SnoozeModal({ onSnooze, onClose }: SnoozeModalProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('09:00');

  const handlePreset = (preset: typeof PRESETS[number]) => {
    const d = getPresetDate(preset);
    onSnooze(toLocalISO(d));
  };

  const handleCustom = () => {
    if (!customDate) return;
    const [h, m] = customTime.split(':').map(Number);
    const d = new Date(customDate);
    d.setHours(h, m, 0, 0);

    if (d <= new Date()) return; // Must be in future
    onSnooze(toLocalISO(d));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-owl-bg-secondary rounded-xl border border-owl-border w-full max-w-[320px] mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-owl-border">
          <h3 className="text-sm font-semibold text-owl-text-primary">E-postayi Ertele</h3>
          <p className="text-xs text-owl-text-muted mt-1">Secilen zamanda tekrar hatirlatilacak</p>
        </div>

        <div className="p-2">
          {PRESETS.map((preset, i) => {
            const d = getPresetDate(preset);
            const timeStr = d.toLocaleString('tr-TR', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <button
                key={i}
                onClick={() => handlePreset(preset)}
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
                Ozel tarih sec...
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
                  Ertele
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
