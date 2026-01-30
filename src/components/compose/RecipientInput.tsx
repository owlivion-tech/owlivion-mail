// ============================================================================
// Owlivion Mail - Recipient Input Component
// ============================================================================
// SECURITY HARDENED: RFC-compliant email validation, length limits, no mock data

import React, { useState, useRef, useEffect } from 'react';
import type { EmailAddress } from '../../types';

interface RecipientInputProps {
  recipients: EmailAddress[];
  onChange: (recipients: EmailAddress[]) => void;
  placeholder?: string;
  maxRecipients?: number;
}

// SECURITY: RFC 5322 compliant email validation regex
// More strict than simple regex - validates local part and domain properly
const EMAIL_REGEX = /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;

// SECURITY: Additional validation function
function isValidEmail(email: string): boolean {
  // Length check (RFC 5321)
  if (!email || email.length === 0 || email.length > 254) {
    return false;
  }

  // Must contain exactly one @
  const atCount = (email.match(/@/g) || []).length;
  if (atCount !== 1) {
    return false;
  }

  const [localPart, domain] = email.split('@');

  // Local part length (RFC 5321)
  if (!localPart || localPart.length === 0 || localPart.length > 64) {
    return false;
  }

  // Domain length
  if (!domain || domain.length === 0 || domain.length > 253) {
    return false;
  }

  // Domain must have at least one dot and valid TLD
  if (!domain.includes('.') || domain.endsWith('.') || domain.startsWith('.')) {
    return false;
  }

  // TLD must be at least 2 characters
  const tld = domain.split('.').pop();
  if (!tld || tld.length < 2) {
    return false;
  }

  // No consecutive dots
  if (email.includes('..')) {
    return false;
  }

  // Regex validation
  return EMAIL_REGEX.test(email);
}

// SECURITY: Contacts should be loaded from backend, not hardcoded
// Empty array - contacts will be loaded from database when implemented
const contacts: EmailAddress[] = [];

export function RecipientInput({
  recipients,
  onChange,
  placeholder = 'Alıcı ekle...',
  maxRecipients = 50, // SECURITY: Default limit
}: RecipientInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<EmailAddress[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.length >= 2 && contacts.length > 0) {
      const query = inputValue.toLowerCase();
      const filtered = contacts.filter(
        (contact) =>
          !recipients.some((r) => r.email === contact.email) &&
          (contact.email.toLowerCase().includes(query) ||
            contact.name?.toLowerCase().includes(query))
      );
      setSuggestions(filtered.slice(0, 5)); // SECURITY: Limit suggestions
      setShowSuggestions(filtered.length > 0);
      setSelectedSuggestion(0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [inputValue, recipients]);

  // Clear error after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle input change with length validation
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    // SECURITY: Limit input length
    if (value.length <= 254) {
      setInputValue(value);
      setError(null);
    }
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
        const email = inputValue.trim().replace(/,$/, '').toLowerCase();
        if (email) {
          if (isValidEmail(email)) {
            addRecipient({ email });
          } else {
            setError('Geçersiz e-posta adresi');
          }
        }
      } else if (e.key === 'Backspace' && inputValue === '' && recipients.length > 0) {
        // Remove last recipient
        onChange(recipients.slice(0, -1));
      }
    }
  }

  // Add recipient with validation
  function addRecipient(recipient: EmailAddress) {
    // SECURITY: Check max recipients limit
    if (recipients.length >= maxRecipients) {
      setError(`En fazla ${maxRecipients} alıcı ekleyebilirsiniz`);
      return;
    }

    // SECURITY: Validate email format
    const email = recipient.email.toLowerCase().trim();
    if (!isValidEmail(email)) {
      setError('Geçersiz e-posta adresi');
      return;
    }

    // Check for duplicates
    if (!recipients.some((r) => r.email.toLowerCase() === email)) {
      onChange([...recipients, { ...recipient, email }]);
    }

    setInputValue('');
    setShowSuggestions(false);
    setError(null);
    inputRef.current?.focus();
  }

  // Remove recipient
  function removeRecipient(index: number) {
    onChange(recipients.filter((_, i) => i !== index));
    inputRef.current?.focus();
  }

  // Handle paste (multiple emails) with validation
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text');

    // Check if pasted content contains multiple emails
    if (pasted.includes(',') || pasted.includes(';') || pasted.includes('\n')) {
      e.preventDefault();

      // SECURITY: Limit paste content
      const MAX_PASTE_LENGTH = 10000;
      const truncatedPaste = pasted.substring(0, MAX_PASTE_LENGTH);

      const emails = truncatedPaste
        .split(/[,;\n\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => isValidEmail(s))
        .map((email) => ({ email }));

      // SECURITY: Check max recipients limit
      const remainingSlots = maxRecipients - recipients.length;
      const uniqueEmails = emails
        .filter((e) => !recipients.some((r) => r.email.toLowerCase() === e.email))
        .slice(0, remainingSlots);

      if (uniqueEmails.length > 0) {
        onChange([...recipients, ...uniqueEmails]);
      }

      if (emails.length > uniqueEmails.length) {
        setError(`${emails.length - uniqueEmails.length} adres zaten ekli veya limit aşıldı`);
      }
    }
  }

  // Handle blur - add email if valid
  function handleBlur() {
    const email = inputValue.trim().toLowerCase();
    if (email && isValidEmail(email)) {
      addRecipient({ email });
    } else if (email) {
      setError('Geçersiz e-posta adresi');
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
            <span className="text-owl-text max-w-[200px] truncate">
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
          type="email"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          onFocus={() => inputValue.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={recipients.length === 0 ? placeholder : ''}
          maxLength={254}
          className="flex-1 min-w-[120px] px-1 py-1 bg-transparent text-owl-text placeholder-owl-text-secondary focus:outline-none text-sm"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute top-full left-0 mt-1 px-2 py-1 bg-red-900/50 border border-red-500/50 rounded text-xs text-red-400">
          {error}
        </div>
      )}

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
