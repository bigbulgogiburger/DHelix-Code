export interface SecretScanResult {
  readonly found: boolean;
  readonly redacted: string;
  readonly patterns: readonly string[];
}

const SECRET_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp }> = [
  // Cloud provider keys
  { name: "AWS Access Key", regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/g },
  { name: "Google Cloud Service Account", regex: /"type"\s*:\s*"service_account"/g },
  { name: "Azure Connection String", regex: /(?:DefaultEndpointsProtocol|AccountKey|SharedAccessSignature)\s*=[^\s;]+/gi },

  // AI/ML provider keys
  { name: "OpenAI API Key", regex: /sk-[a-zA-Z0-9]{20,}/g },
  { name: "Anthropic API Key", regex: /sk-ant-[a-zA-Z0-9_-]{20,}/g },

  // VCS tokens
  { name: "GitHub Token", regex: /ghp_[a-zA-Z0-9]{36}/g },
  { name: "GitHub OAuth", regex: /gho_[a-zA-Z0-9]{36}/g },
  { name: "GitHub App Token", regex: /(?:ghu|ghs|ghr)_[a-zA-Z0-9]{36}/g },

  // Communication platform tokens
  { name: "Slack Token", regex: /xox[bpsa]-[a-zA-Z0-9-]{10,}/g },

  // Payment provider keys
  { name: "Stripe Secret Key", regex: /sk_(?:live|test)_[a-zA-Z0-9]{20,}/g },
  { name: "Stripe Publishable Key", regex: /pk_(?:live|test)_[a-zA-Z0-9]{20,}/g },

  // Private keys (PEM encoded)
  { name: "RSA Private Key", regex: /-----BEGIN RSA PRIVATE KEY-----/g },
  { name: "EC Private Key", regex: /-----BEGIN EC PRIVATE KEY-----/g },
  { name: "OpenSSH Private Key", regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g },
  { name: "Generic Private Key", regex: /-----BEGIN PRIVATE KEY-----/g },

  // JWT tokens
  { name: "JWT Token", regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },

  // Package registry tokens
  { name: "npm Token", regex: /npm_[a-zA-Z0-9]{36}/g },

  // SaaS provider keys
  { name: "Heroku API Key", regex: /(?:heroku[_-]?api[_-]?key|HEROKU_API_KEY)\s*[:=]\s*\S+/gi },
  { name: "SendGrid API Key", regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g },
  { name: "Twilio Auth Token", regex: /(?:twilio[_-]?auth[_-]?token|TWILIO_AUTH_TOKEN)\s*[:=]\s*[a-f0-9]{32}/gi },

  // Database connection strings
  { name: "PostgreSQL Connection", regex: /postgresql:\/\/[^\s'"]+/gi },
  { name: "MongoDB Connection", regex: /mongodb(?:\+srv)?:\/\/[^\s'"]+/gi },
  { name: "MySQL Connection", regex: /mysql:\/\/[^\s'"]+/gi },

  // Generic patterns (keep last — broader matches)
  { name: "Password", regex: /password\s*[:=]\s*\S+/gi },
  { name: "Bearer Token", regex: /Bearer\s+[a-zA-Z0-9._-]+/g },
  { name: "API Key", regex: /API[_-]?KEY\s*[:=]\s*\S+/gi },
  { name: "Generic Secret Assignment", regex: /(?:secret|token|credential|auth_key)\s*[:=]\s*['"][^\s'"]{8,}['"]/gi },
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
