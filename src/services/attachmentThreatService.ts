// ============================================================================
// Owlivion Mail - Attachment Threat Analysis Service
// ============================================================================
// Rule-based (instant) + optional Gemini AI analysis for attachment threats

import type { AttachmentThreatAnalysis, ThreatIndicator } from '../types';
import { makeGeminiRequest, extractGeminiText } from './geminiService';

// ============================================================================
// Constants
// ============================================================================

// Executable and dangerous file extensions
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'scr', 'bat', 'cmd', 'ps1', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
  'dll', 'com', 'pif', 'hta', 'msi', 'msp', 'mst', 'cpl', 'inf', 'reg',
  'lnk', 'application', 'gadget', 'sct', 'shb', 'shs',
]);

// Macro-enabled document formats
const MACRO_EXTENSIONS = new Set([
  'docm', 'xlsm', 'pptm', 'dotm', 'xltm', 'potm', 'xlam', 'ppam', 'sldm',
]);

// Potentially suspicious but sometimes legitimate
const SUSPICIOUS_EXTENSIONS = new Set([
  'iso', 'img', 'jar', 'sh', 'py', 'rb', 'pl', 'cgi', 'apk', 'ipa',
  'cab', 'arj', 'ace', 'r00', 'r01',
]);

// Expected MIME type to extension mapping for mismatch detection
const MIME_EXTENSION_MAP: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'application/msword': ['doc', 'dot'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.ms-excel': ['xls', 'xlt'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/vnd.ms-powerpoint': ['ppt', 'pot'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
  'image/jpeg': ['jpg', 'jpeg', 'jpe'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'image/svg+xml': ['svg'],
  'text/plain': ['txt', 'log', 'csv', 'tsv', 'md'],
  'text/html': ['html', 'htm'],
  'application/zip': ['zip'],
  'application/x-rar-compressed': ['rar'],
  'application/x-7z-compressed': ['7z'],
  'application/gzip': ['gz', 'gzip'],
  'application/x-tar': ['tar'],
  'video/mp4': ['mp4'],
  'audio/mpeg': ['mp3'],
  'application/octet-stream': [], // Generic binary, skip mismatch check
};

// Magic bytes signatures (hex prefix)
const MAGIC_BYTES: Record<string, { name: string; dangerous: boolean }> = {
  '4d5a': { name: 'PE Executable (Windows .exe/.dll)', dangerous: true },
  '7f454c46': { name: 'ELF Executable (Linux)', dangerous: true },
  'cafebabe': { name: 'Java Class / Mach-O', dangerous: true },
  'feedface': { name: 'Mach-O 32-bit', dangerous: true },
  'feedfacf': { name: 'Mach-O 64-bit', dangerous: true },
  'cefaedfe': { name: 'Mach-O Reverse Byte', dangerous: true },
  '504b0304': { name: 'ZIP Archive', dangerous: false },
  '504b0506': { name: 'ZIP Archive (empty)', dangerous: false },
  '504b0708': { name: 'ZIP Archive (spanned)', dangerous: false },
  '255044462d': { name: 'PDF Document', dangerous: false },
  '89504e47': { name: 'PNG Image', dangerous: false },
  'ffd8ff': { name: 'JPEG Image', dangerous: false },
  '47494638': { name: 'GIF Image', dangerous: false },
  'd0cf11e0': { name: 'OLE Compound Document (Office)', dangerous: false },
  '52617221': { name: 'RAR Archive', dangerous: false },
  '1f8b': { name: 'GZIP Archive', dangerous: false },
  '377abcaf': { name: 'LZMA/7z Archive', dangerous: false },
  '23212f': { name: 'Script (Shebang #!/)', dangerous: true },
};

// ============================================================================
// Rule-based Analysis (Synchronous, Instant)
// ============================================================================

export function analyzeAttachmentThreats(
  attachments: Array<{ index: number; filename: string; contentType: string; size: number; isInline: boolean }>,
  emailContext?: { from?: { name?: string; email: string }; subject?: string; isPhishing?: boolean }
): Record<number, AttachmentThreatAnalysis> {
  const results: Record<number, AttachmentThreatAnalysis> = {};

  for (const att of attachments) {
    if (att.isInline) continue; // Skip inline images

    let score = 0;
    const threats: ThreatIndicator[] = [];
    const reasons: string[] = [];

    const ext = getFileExtension(att.filename);
    const allExts = getAllExtensions(att.filename);

    // Check 1: Dangerous extension
    if (ext && DANGEROUS_EXTENSIONS.has(ext)) {
      const severity: ThreatIndicator['severity'] = ['exe', 'scr', 'dll', 'com', 'pif', 'hta'].includes(ext) ? 'critical' : 'high';
      const points = severity === 'critical' ? 60 : 40;
      score += points;
      threats.push({
        type: 'dangerous_extension',
        severity,
        detail: `.${ext} uzantısı genellikle zararlı yazılım içerebilir`,
      });
      reasons.push(`Tehlikeli dosya uzantısı: .${ext}`);
    }

    // Check 2: Double extension (e.g., document.pdf.exe)
    if (allExts.length >= 2) {
      const lastExt = allExts[allExts.length - 1];
      const prevExt = allExts[allExts.length - 2];
      if (DANGEROUS_EXTENSIONS.has(lastExt) && !DANGEROUS_EXTENSIONS.has(prevExt)) {
        score += 50;
        threats.push({
          type: 'double_extension',
          severity: 'critical',
          detail: `Çift uzantı tespit edildi: .${prevExt}.${lastExt} - dosya gerçek türünü gizlemeye çalışıyor`,
        });
        reasons.push(`Çift uzantı: .${prevExt}.${lastExt} (dosya türü gizleme girişimi)`);
      }
    }

    // Check 3: MIME type / extension mismatch
    if (ext && att.contentType && att.contentType !== 'application/octet-stream') {
      const expectedExts = MIME_EXTENSION_MAP[att.contentType.toLowerCase()];
      if (expectedExts && expectedExts.length > 0 && !expectedExts.includes(ext)) {
        // More severe if MIME says image/document but extension is executable
        const isMasquerade = DANGEROUS_EXTENSIONS.has(ext);
        const points = isMasquerade ? 50 : 20;
        score += points;
        threats.push({
          type: 'mime_mismatch',
          severity: isMasquerade ? 'critical' : 'medium',
          detail: `MIME tipi (${att.contentType}) ile uzantı (.${ext}) uyuşmuyor`,
        });
        reasons.push(`MIME tipi uyuşmazlığı: ${att.contentType} ≠ .${ext}`);
      }
    }

    // Check 4: Macro-enabled documents
    if (ext && MACRO_EXTENSIONS.has(ext)) {
      score += 35;
      threats.push({
        type: 'macro_enabled',
        severity: 'high',
        detail: `Makro içerebilen belge formatı: .${ext}`,
      });
      reasons.push(`Makro etkin belge formatı: .${ext} (kötü amaçlı makrolar içerebilir)`);
    }

    // Check 5: Suspicious size (very small document - might be a dropper)
    if (att.size > 0 && att.size < 1024 && ext && ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf'].includes(ext)) {
      score += 15;
      threats.push({
        type: 'suspicious_size',
        severity: 'low',
        detail: `Belge boyutu çok küçük (${att.size} byte) - dropper olabilir`,
      });
      reasons.push(`Şüpheli küçük boyut: ${att.size} byte`);
    }

    // Check 6: Suspicious extensions
    if (ext && SUSPICIOUS_EXTENSIONS.has(ext) && !DANGEROUS_EXTENSIONS.has(ext)) {
      score += 15;
      reasons.push(`Şüpheli dosya türü: .${ext}`);
    }

    // Check 7: PDF in phishing context (not aggressive - only when phishing detected)
    if (ext === 'pdf' && emailContext?.isPhishing) {
      score += 15;
      reasons.push('Phishing e-postasında PDF eki (reverse shell/exploit riski)');
    }

    // Bonus: Attachment in a phishing email
    if (emailContext?.isPhishing && threats.length > 0) {
      score += 20;
      reasons.push('Phishing olarak tespit edilen e-postada ek dosya');
    }

    // Determine risk level
    const riskLevel = getRiskLevel(score);
    const isMalicious = score >= 50;

    results[att.index] = {
      isMalicious,
      riskLevel,
      score,
      reasons,
      recommendations: generateRecommendations(threats, riskLevel, ext),
      detectedThreats: threats,
    };
  }

  return results;
}

// ============================================================================
// Magic Bytes Analysis (Post-download)
// ============================================================================

export function analyzeMagicBytes(
  base64Data: string,
  filename: string,
  contentType: string
): ThreatIndicator | null {
  try {
    const hexBytes = extractHexFromBase64(base64Data);
    if (!hexBytes) return null;

    const ext = getFileExtension(filename);

    // Check magic bytes against known signatures
    for (const [signature, info] of Object.entries(MAGIC_BYTES)) {
      if (hexBytes.startsWith(signature)) {
        // If magic bytes indicate an executable but file claims to be something else
        if (info.dangerous) {
          const isClaimingNonExec = ext && !DANGEROUS_EXTENSIONS.has(ext);
          if (isClaimingNonExec) {
            return {
              type: 'magic_bytes_mismatch',
              severity: 'critical',
              detail: `Dosya .${ext} uzantılı ama gerçek formatı: ${info.name}`,
            };
          }
          // Even if extension is executable, flag it
          return {
            type: 'magic_bytes_mismatch',
            severity: 'high',
            detail: `Çalıştırılabilir dosya tespit edildi: ${info.name}`,
          };
        }

        // Check if non-dangerous magic bytes mismatch the MIME type
        if (contentType && contentType !== 'application/octet-stream') {
          const mimeIsImage = contentType.startsWith('image/');
          const magicIsImage = ['PNG Image', 'JPEG Image', 'GIF Image'].includes(info.name);

          if (mimeIsImage && !magicIsImage) {
            return {
              type: 'magic_bytes_mismatch',
              severity: 'high',
              detail: `MIME tipi resim (${contentType}) ama dosya gerçekte: ${info.name}`,
            };
          }
        }

        break; // Found matching signature
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// Gemini AI Analysis (Optional)
// ============================================================================

export async function analyzeAttachmentWithAI(
  attachment: { filename: string; contentType: string; size: number },
  emailContext: { from?: { name?: string; email: string }; subject?: string } | undefined,
  magicBytesHex: string | null,
  staticAnalysis: AttachmentThreatAnalysis,
  apiKey: string,
  language: 'tr' | 'en' = 'tr'
): Promise<AttachmentThreatAnalysis> {
  const prompt = language === 'tr'
    ? `Bir e-posta eki güvenlik analizi yap. Sonucu JSON olarak ver.

Dosya Bilgileri:
- Dosya adı: ${attachment.filename}
- MIME tipi: ${attachment.contentType}
- Boyut: ${attachment.size} byte
${magicBytesHex ? `- Magic bytes (hex): ${magicBytesHex}` : ''}
${emailContext?.from ? `- Gönderen: ${emailContext.from.name || ''} <${emailContext.from.email}>` : ''}
${emailContext?.subject ? `- E-posta konusu: ${emailContext.subject}` : ''}

Statik analiz sonuçları:
- Risk skoru: ${staticAnalysis.score}/100
- Tespit edilen tehditler: ${(staticAnalysis.reasons ?? []).join(', ') || 'Yok'}

Lütfen aşağıdaki JSON formatında yanıt ver (sadece JSON, başka metin yok):
{
  "isMalicious": boolean,
  "riskLevel": "safe" | "low" | "medium" | "high" | "critical",
  "score": 0-100,
  "reasons": ["sebep1", "sebep2"],
  "recommendations": ["öneri1", "öneri2"]
}`
    : `Perform a security analysis of an email attachment. Return result as JSON.

File Info:
- Filename: ${attachment.filename}
- MIME type: ${attachment.contentType}
- Size: ${attachment.size} bytes
${magicBytesHex ? `- Magic bytes (hex): ${magicBytesHex}` : ''}
${emailContext?.from ? `- Sender: ${emailContext.from.name || ''} <${emailContext.from.email}>` : ''}
${emailContext?.subject ? `- Email subject: ${emailContext.subject}` : ''}

Static analysis results:
- Risk score: ${staticAnalysis.score}/100
- Detected threats: ${(staticAnalysis.reasons ?? []).join(', ') || 'None'}

Please respond in the following JSON format only (no other text):
{
  "isMalicious": boolean,
  "riskLevel": "safe" | "low" | "medium" | "high" | "critical",
  "score": 0-100,
  "reasons": ["reason1", "reason2"],
  "recommendations": ["recommendation1", "recommendation2"]
}`;

  try {
    const response = await makeGeminiRequest(apiKey, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    });

    if (!response.ok) {
      return staticAnalysis;
    }

    const data = await response.json();
    const text = extractGeminiText(data);
    if (!text) return staticAnalysis;

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return staticAnalysis;

    const aiResult = JSON.parse(jsonMatch[0]);

    // Merge AI result with static analysis (take the higher risk)
    const mergedScore = Math.max(staticAnalysis.score, aiResult.score || 0);
    const mergedRiskLevel = getRiskLevel(mergedScore);

    return {
      isMalicious: mergedScore >= 50,
      riskLevel: mergedRiskLevel,
      score: mergedScore,
      reasons: [
        ...(staticAnalysis.reasons ?? []),
        ...(aiResult.reasons || []).filter((r: string) => !(staticAnalysis.reasons ?? []).includes(r)),
      ],
      recommendations: [
        ...(staticAnalysis.recommendations ?? []),
        ...(aiResult.recommendations || []).filter((r: string) => !(staticAnalysis.recommendations ?? []).includes(r)),
      ],
      detectedThreats: staticAnalysis.detectedThreats,
    };
  } catch (err) {
    console.error('AI attachment analysis failed:', err);
    return staticAnalysis;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function getRiskLevel(score: number): AttachmentThreatAnalysis['riskLevel'] {
  if (score >= 80) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  if (score >= 10) return 'low';
  return 'safe';
}

export function getFileExtension(filename: string): string | null {
  const parts = filename.split('.');
  if (parts.length < 2) return null;
  return parts[parts.length - 1].toLowerCase();
}

function getAllExtensions(filename: string): string[] {
  const parts = filename.split('.');
  if (parts.length < 2) return [];
  return parts.slice(1).map(p => p.toLowerCase());
}

export function extractHexFromBase64(base64Data: string): string | null {
  try {
    // Decode first 44 base64 chars to get ~32 bytes
    const snippet = base64Data.substring(0, 44);
    const binary = atob(snippet);
    let hex = '';
    for (let i = 0; i < binary.length; i++) {
      hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
  } catch {
    return null;
  }
}

function generateRecommendations(
  threats: ThreatIndicator[],
  riskLevel: AttachmentThreatAnalysis['riskLevel'],
  ext: string | null
): string[] {
  const recs: string[] = [];

  if (riskLevel === 'critical' || riskLevel === 'high') {
    recs.push('Bu dosyayı açmayın - zararlı yazılım içerebilir');
    recs.push('Göndereni tanımıyorsanız dosyayı silin');
  }

  const hasDangerousExt = threats.some(t => t.type === 'dangerous_extension');
  if (hasDangerousExt) {
    recs.push(`Çalıştırılabilir dosyalar (.${ext}) e-posta ile gönderilmemelidir`);
  }

  const hasDoubleExt = threats.some(t => t.type === 'double_extension');
  if (hasDoubleExt) {
    recs.push('Çift uzantılı dosyalar genellikle sosyal mühendislik saldırısı göstergesidir');
  }

  const hasMacro = threats.some(t => t.type === 'macro_enabled');
  if (hasMacro) {
    recs.push('Makroları etkinleştirmeyin - güvenilir kaynaklardan bile gelse dikkatli olun');
  }

  const hasMimeMismatch = threats.some(t => t.type === 'mime_mismatch');
  if (hasMimeMismatch) {
    recs.push('Dosya türü ile uzantı uyuşmuyor - manipülasyon olabilir');
  }

  const hasMagicMismatch = threats.some(t => t.type === 'magic_bytes_mismatch');
  if (hasMagicMismatch) {
    recs.push('Dosyanın gerçek formatı bildirilen formatla uyuşmuyor');
  }

  if (riskLevel === 'medium') {
    recs.push('Dosyayı açmadan önce göndereni doğrulayın');
  }

  if (riskLevel === 'safe' && recs.length === 0) {
    recs.push('Bilinen güvenli dosya türü');
  }

  return recs;
}

// Risk level badge helpers for UI
export function getThreatBadgeColor(riskLevel: AttachmentThreatAnalysis['riskLevel']): string {
  switch (riskLevel) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-blue-400';
    default: return '';
  }
}

export function getThreatBorderColor(riskLevel: AttachmentThreatAnalysis['riskLevel']): string {
  switch (riskLevel) {
    case 'critical': return 'border-red-500/60';
    case 'high': return 'border-orange-500/60';
    case 'medium': return 'border-yellow-500/60';
    default: return 'border-owl-border';
  }
}

export function getThreatLabel(riskLevel: AttachmentThreatAnalysis['riskLevel'], language: 'tr' | 'en' = 'tr'): string {
  if (language === 'tr') {
    switch (riskLevel) {
      case 'critical': return 'Kritik Risk';
      case 'high': return 'Yüksek Risk';
      case 'medium': return 'Orta Risk';
      case 'low': return 'Düşük Risk';
      default: return 'Güvenli';
    }
  }
  switch (riskLevel) {
    case 'critical': return 'Critical Risk';
    case 'high': return 'High Risk';
    case 'medium': return 'Medium Risk';
    case 'low': return 'Low Risk';
    default: return 'Safe';
  }
}
