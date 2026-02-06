// ============================================================================
// Owlivion Mail - Filter Test Modal
// ============================================================================

import { useState, useEffect } from 'react';
import { filterTest } from '../../services/filterService';
import { emailList } from '../../services/mailService';
import type { EmailSummary } from '../../types';

interface FilterTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterId: number;
  accountId: number;
}

const Icons = {
  X: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Check: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  X2: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

export function FilterTestModal({ isOpen, onClose, filterId, accountId }: FilterTestModalProps) {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [testResults, setTestResults] = useState<Map<number, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  // Load sample emails when modal opens
  useEffect(() => {
    if (isOpen && accountId) {
      loadSampleEmails();
    }
  }, [isOpen, accountId]);

  const loadSampleEmails = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await emailList(accountId.toString(), 0, 20, 'INBOX');
      setEmails(result.emails);

      // Test all emails automatically
      await testAllEmails(result.emails);
    } catch (err) {
      console.error('Failed to load emails:', err);
      setError('Emailler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const testAllEmails = async (emailsToTest: EmailSummary[]) => {
    setTesting(true);
    const results = new Map<number, boolean>();

    try {
      // Test each email
      for (const email of emailsToTest) {
        const matches = await filterTest(filterId, email.id);
        results.set(email.id, matches);
      }

      setTestResults(results);
    } catch (err) {
      console.error('Failed to test emails:', err);
      setError('Test sırasında hata oluştu');
    } finally {
      setTesting(false);
    }
  };

  const testSingleEmail = async (emailId: number) => {
    try {
      const matches = await filterTest(filterId, emailId);
      setTestResults(prev => new Map(prev).set(emailId, matches));
    } catch (err) {
      console.error('Failed to test email:', err);
    }
  };

  const matchedCount = Array.from(testResults.values()).filter(Boolean).length;
  const totalCount = emails.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">
              Filtre Test Sonuçları
            </h2>
            {!loading && (
              <p className="text-sm text-gray-400 mt-1">
                {matchedCount} / {totalCount} email eşleşti
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
          >
            <Icons.X />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Emailler yükleniyor...</div>
            </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {!loading && !error && emails.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-gray-400 mb-2">Gelen kutusunda email bulunamadı</p>
                <p className="text-sm text-gray-500">Test için en az bir email gereklidir</p>
              </div>
            </div>
          )}

          {!loading && !error && emails.length > 0 && (
            <div className="space-y-2">
              {testing && (
                <div className="px-4 py-3 bg-blue-900/20 border border-blue-800 rounded-lg text-sm text-blue-400 mb-4">
                  Emailler test ediliyor...
                </div>
              )}

              {/* Email List with Test Results */}
              {emails.map(email => {
                const matches = testResults.get(email.id);
                const isTesting = testing && matches === undefined;

                return (
                  <div
                    key={email.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                      matches === true
                        ? 'bg-green-900/10 border-green-700 hover:bg-green-900/20'
                        : matches === false
                        ? 'bg-gray-700/30 border-gray-600 hover:bg-gray-700/50'
                        : 'bg-gray-700/30 border-gray-600'
                    }`}
                  >
                    {/* Match Indicator */}
                    <div className="flex-shrink-0 mt-1">
                      {isTesting ? (
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : matches === true ? (
                        <div className="w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white">
                          <Icons.Check />
                        </div>
                      ) : matches === false ? (
                        <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-gray-400">
                          <Icons.X2 />
                        </div>
                      ) : null}
                    </div>

                    {/* Email Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="font-medium text-gray-100 truncate">
                          {email.fromName || email.fromAddress}
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap">
                          {new Date(email.date).toLocaleDateString('tr-TR')}
                        </div>
                      </div>

                      <div className="text-sm text-gray-300 mb-1 truncate">
                        {email.subject}
                      </div>

                      <div className="text-xs text-gray-500 truncate">
                        {email.preview}
                      </div>

                      {/* Match Status */}
                      {matches !== undefined && (
                        <div className="mt-2">
                          {matches ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-900/30 text-green-400 text-xs rounded">
                              <Icons.Check />
                              Filtre ile eşleşti
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded">
                              <Icons.X2 />
                              Eşleşmedi
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Retest Button */}
                    {!testing && matches !== undefined && (
                      <button
                        onClick={() => testSingleEmail(email.id)}
                        className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                      >
                        Tekrar Test Et
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {matchedCount > 0 ? (
              <>
                Bu filtre <span className="text-green-400 font-medium">{matchedCount} email</span>e uygulanacak
              </>
            ) : (
              'Hiçbir email eşleşmedi'
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
