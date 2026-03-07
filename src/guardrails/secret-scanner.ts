export interface SecretScanResult {
  readonly found: boolean;
  readonly redacted: string;
  readonly patterns: readonly string[];
}

const SECRET_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp }> = [
  { name: "AWS Access Key", regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/g },
  { name: "GitHub Token", regex: /ghp_[a-zA-Z0-9]{36}/g },
  { name: "OpenAI API Key", regex: /sk-[a-zA-Z0-9]{20,}/g },
  { name: "Password", regex: /password\s*[:=]\s*\S+/gi },
  { name: "Bearer Token", regex: /Bearer\s+[a-zA-Z0-9._-]+/g },
  { name: "API Key", regex: /API[_-]?KEY\s*[:=]\s*\S+/gi },
];

export function scanForSecrets(text: string): SecretScanResult {
  const matchedPatterns: string[] = [];
  let redacted = text;

  for (const { name, regex } of SECRET_PATTERNS) {
    const pattern = new RegExp(regex.source, regex.flags);
    if (pattern.test(redacted)) {
      matchedPatterns.push(name);
      const replacePattern = new RegExp(regex.source, regex.flags);
      redacted = redacted.replace(replacePattern, "[REDACTED]");
    }
  }

  return {
    found: matchedPatterns.length > 0,
    redacted,
    patterns: matchedPatterns,
  };
}
