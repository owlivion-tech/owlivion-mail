// ============================================================================
// Owlivion Mail - Recipient Input Component
// ============================================================================

import React, { useState, useRef, useEffect } from 'react';
import type { EmailAddress } from '../../types';

interface RecipientInputProps {
  recipients: EmailAddress[];
  onChange: (recipients: EmailAddress[]) => void;
  placeholder?: string;
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RecipientInput({
  recipients,
  onChange,
  placeholder = 'Alıcı ekle...',
}: RecipientInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<EmailAddress[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mock contacts for autocomplete
  const mockContacts: EmailAddress[] = [
    { email: 'mert@example.com', name: 'Mert Şakirler' },
    { email: 'support@ptt.gov.tr', name: 'PTT Destek' },
    { email: 'info@shopier.com', name: 'Shopier' },
    { email: 'contact@babafpv.com', name: 'BabaFPV' },
  ];

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.length >= 2) {
      const query = inputValue.toLowerCase();
      const filtered = mockContacts.filter(
        (contact) =>
          !recipients.some((r) => r.email === contact.email) &&
          (contact.email.toLowerCase().includes(query) ||
            contact.name?.toLowerCase().includes(query))
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedSuggestion(0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [inputValue, recipients]);

  // Handle input change
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
  }

  // Handle key down
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestions[selectedSuggestion]) {
          addRecipient(suggestions[selectedSuggestion]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else {
      if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
        e.preventDefault();
        const email = inputValue.trim().replace(/,$/, '');
        if (email && EMAIL_REGEX.test(email)) {
          addRecipient({ email });
        }
      } else if (e.key === 'Backspace' && inputValue === '' && recipients.length > 0) {
        // Remove last recipient
        onChange(recipients.slice(0, -1));
      }
    }
  }

  // Add recipient
  function addRecipient(recipient: EmailAddress) {
    if (!recipients.some((r) => r.email === recipient.email)) {
      onChange([...recipients, recipient]);
    }
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  }

  // Remove recipient
  function removeRecipient(index: number) {
    onChange(recipients.filter((_, i) => i !== index));
    inputRef.current?.focus();
  }

  // Handle paste (multiple emails)
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text');

    // Check if pasted content contains multiple emails
    if (pasted.includes(',') || pasted.includes(';') || pasted.includes('\n')) {
      e.preventDefault();

      const emails = pasted
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter((s) => EMAIL_REGEX.test(s))
        .map((email) => ({ email }));

      const uniqueEmails = emails.filter(
        (e) => !recipients.some((r) => r.email === e.email)
      );

      if (uniqueEmails.length > 0) {
        onChange([...recipients, ...uniqueEmails]);
      }
    }
  }

  // Handle blur - add email if valid
  function handleBlur() {
    const email = inputValue.trim();
    if (email && EMAIL_REGEX.test(email)) {
      addRecipient({ email });
    }
    // Delay hiding suggestions for click handling
    setTimeout(() => setShowSuggestions(false), 200);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[36px]">
        {/* Recipient Pills */}
        {recipients.map((recipient, index) => (
          <span
            key={recipient.email}
            className="inline-flex items-center gap-1 px-2 py-1 bg-owl-surface-2 border border-owl-border rounded-md text-sm"
          >
            <span className="text-owl-text">
              {recipient.name || recipient.email}
            </span>
            <button
              type="button"
              onClick={() => removeRecipient(index)}
              className="text-owl-text-secondary hover:text-owl-error ml-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          onFocus={() => inputValue.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={recipients.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] px-1 py-1 bg-transparent text-owl-text placeholder-owl-text-secondary focus:outline-none text-sm"
        />
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-owl-surface border border-owl-border rounded-lg shadow-owl-lg overflow-hidden z-10">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.email}
              type="button"
              onClick={() => addRecipient(suggestion)}
              className={`w-full px-3 py-2 text-left flex items-center gap-3 transition-colors ${
                index === selectedSuggestion
                  ? 'bg-owl-accent/10 text-owl-accent'
                  : 'text-owl-text hover:bg-owl-surface-2'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-owl-surface-2 flex items-center justify-center text-xs font-medium text-owl-text-secondary">
                {suggestion.name ? suggestion.name.charAt(0).toUpperCase() : suggestion.email.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                {suggestion.name && (
                  <div className="text-sm font-medium truncate">{suggestion.name}</div>
                )}
                <div className={`text-xs truncate ${suggestion.name ? 'text-owl-text-secondary' : ''}`}>
                  {suggestion.email}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default RecipientInput;
