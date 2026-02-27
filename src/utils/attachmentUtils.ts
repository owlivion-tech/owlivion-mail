// ============================================================================
// Owlivion Mail - Attachment Utilities (shared between compose & email view)
// ============================================================================

import React from 'react';

// Format file size to human-readable string
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Check if content type is previewable (image or PDF)
export function canPreview(contentType: string): boolean {
  return isImageType(contentType) || isPdfType(contentType);
}

// Check if content type is an image
export function isImageType(contentType: string): boolean {
  return contentType.startsWith('image/');
}

// Check if content type is a PDF
export function isPdfType(contentType: string): boolean {
  return contentType === 'application/pdf';
}

// Get icon SVG for file type
export function getFileIcon(contentType: string, filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase();

  // Image
  if (contentType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' })
    );
  }

  // PDF
  if (contentType === 'application/pdf' || ext === 'pdf') {
    return React.createElement('svg', { className: 'w-5 h-5 text-red-400', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' })
    );
  }

  // Document
  if (contentType.includes('document') || contentType.includes('msword') || ['doc', 'docx', 'odt', 'rtf'].includes(ext || '')) {
    return React.createElement('svg', { className: 'w-5 h-5 text-blue-400', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' })
    );
  }

  // Spreadsheet
  if (contentType.includes('spreadsheet') || contentType.includes('excel') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext || '')) {
    return React.createElement('svg', { className: 'w-5 h-5 text-green-400', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' })
    );
  }

  // Archive
  if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('tar') || contentType.includes('gzip') || ['zip', 'rar', 'tar', 'gz', '7z'].includes(ext || '')) {
    return React.createElement('svg', { className: 'w-5 h-5 text-yellow-400', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' })
    );
  }

  // Code
  if (contentType.includes('javascript') || contentType.includes('json') || contentType.includes('text/') || ['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'md', 'txt'].includes(ext || '')) {
    return React.createElement('svg', { className: 'w-5 h-5 text-purple-400', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
      React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' })
    );
  }

  // Default file icon
  return React.createElement('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
    React.createElement('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z' })
  );
}

// Convert base64 data to Blob
export function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}
