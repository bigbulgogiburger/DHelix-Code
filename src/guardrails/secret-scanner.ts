/**
 * 시크릿 스캐너 — 코드 출력에서 민감한 인증 정보를 탐지하고 삭제하는 모듈
 *
 * AWS 키, GitHub 토큰, JWT, 개인키, 데이터베이스 연결 문자열 등
 * 28가지 패턴의 비밀 정보를 정규식으로 탐지하여 [REDACTED]로 대체합니다.
 * 실수로 비밀 정보가 LLM에게 노출되는 것을 방지합니다.
 *
 * 주요 탐지 대상:
 * - 클라우드 서비스 키 (AWS, GCP, Azure)
 * - AI/ML API 키 (OpenAI, Anthropic)
 * - 버전 관리 토큰 (GitHub)
 * - 결제 서비스 키 (Stripe)
 * - 개인키 (RSA, EC, OpenSSH, PEM)
 * - JWT 토큰
 * - 데이터베이스 연결 문자열 (PostgreSQL, MongoDB, MySQL)
 * - 일반적인 비밀번호/API 키 패턴
 */

/**
 * 시크릿 스캔 결과 인터페이스
 *
 * @property found - 하나 이상의 비밀 정보가 발견되었는지 여부
 * @property redacted - [REDACTED]로 대체된 텍스트 (비밀 정보가 없으면 원본 그대로)
 * @property patterns - 탐지된 패턴의 이름 목록 (예: ["AWS Access Key", "JWT Token"])
 */
export interface SecretScanResult {
  readonly found: boolean;
  readonly redacted: string;
  readonly patterns: readonly string[];
}

/**
 * 시크릿 패턴 정의 목록
 *
 * 각 패턴은 name(패턴 이름)과 regex(탐지 정규식)로 구성됩니다.
 * 정규식에 /g 플래그가 있어 텍스트 내 모든 매칭을 찾아 대체합니다.
 *
 * 패턴 순서: 구체적인 패턴 → 일반적인 패턴 순서로 배치되어 있습니다.
 * 일반 패턴이 먼저 오면 구체적 패턴의 탐지 기회를 빼앗을 수 있기 때문입니다.
 */
const SECRET_PATTERNS: ReadonlyArray<{ readonly name: string; readonly regex: RegExp }> = [
  // ===== 클라우드 서비스 키 =====

  // AWS 접근 키: "AKIA" 또는 "ASIA"로 시작하고 16자의 영대문자/숫자가 뒤따름
  // AKIA = 장기 자격 증명, ASIA = 임시 자격 증명 (STS에서 발급)
  { name: "AWS Access Key", regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/g },

  // Google Cloud 서비스 계정: JSON 키 파일에서 "type": "service_account" 패턴 탐지
  { name: "Google Cloud Service Account", regex: /"type"\s*:\s*"service_account"/g },

  // Azure 연결 문자열: DefaultEndpointsProtocol, AccountKey, SharedAccessSignature 키워드
  // 스토리지 계정, 서비스 버스 등 Azure 서비스의 연결 정보를 포함
  {
    name: "Azure Connection String",
    regex: /(?:DefaultEndpointsProtocol|AccountKey|SharedAccessSignature)\s*=[^\s;]+/gi,
  },

  // ===== AI/ML 서비스 API 키 =====

  // OpenAI API 키: "sk-"로 시작하고 20자 이상의 영숫자가 뒤따름
  { name: "OpenAI API Key", regex: /sk-[a-zA-Z0-9]{20,}/g },

  // Anthropic API 키: "sk-ant-"로 시작하고 20자 이상의 영숫자/하이픈/밑줄이 뒤따름
  { name: "Anthropic API Key", regex: /sk-ant-[a-zA-Z0-9_-]{20,}/g },

  // ===== 버전 관리 시스템 토큰 =====

  // GitHub 개인 접근 토큰: "ghp_"로 시작하고 36자의 영숫자가 뒤따름
  { name: "GitHub Token", regex: /ghp_[a-zA-Z0-9]{36}/g },

  // GitHub OAuth 토큰: "gho_"로 시작
  { name: "GitHub OAuth", regex: /gho_[a-zA-Z0-9]{36}/g },

  // GitHub App 토큰: "ghu_"(사용자), "ghs_"(서버), "ghr_"(리프레시)로 시작
  { name: "GitHub App Token", regex: /(?:ghu|ghs|ghr)_[a-zA-Z0-9]{36}/g },

  // ===== 커뮤니케이션 플랫폼 토큰 =====

  // Slack 토큰: "xoxb-"(봇), "xoxp-"(사용자), "xoxs-"(소켓), "xoxa-"(앱)로 시작
  { name: "Slack Token", regex: /xox[bpsa]-[a-zA-Z0-9-]{10,}/g },

  // ===== 결제 서비스 키 =====

  // Stripe 비밀 키: "sk_live_" 또는 "sk_test_"로 시작 (결제 처리 API 키)
  { name: "Stripe Secret Key", regex: /sk_(?:live|test)_[a-zA-Z0-9]{20,}/g },

  // Stripe 공개 키: "pk_live_" 또는 "pk_test_"로 시작 (클라이언트에서 사용)
  { name: "Stripe Publishable Key", regex: /pk_(?:live|test)_[a-zA-Z0-9]{20,}/g },

  // ===== 개인키 (PEM 인코딩) =====
  // PEM(Privacy-Enhanced Mail)이란 암호화 키를 텍스트로 인코딩하는 형식
  // "-----BEGIN ... PRIVATE KEY-----"로 시작하는 블록으로 구분됨

  // RSA 개인키: 가장 널리 사용되는 비대칭 암호화 알고리즘의 키
  { name: "RSA Private Key", regex: /-----BEGIN RSA PRIVATE KEY-----/g },

  // EC(타원 곡선) 개인키: RSA보다 짧은 키로 동등한 보안 수준 제공
  { name: "EC Private Key", regex: /-----BEGIN EC PRIVATE KEY-----/g },

  // OpenSSH 개인키: SSH 연결에 사용되는 키 형식
  { name: "OpenSSH Private Key", regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g },

  // 일반 PKCS#8 개인키: 알고리즘 독립적인 키 형식
  { name: "Generic Private Key", regex: /-----BEGIN PRIVATE KEY-----/g },

  // ===== JWT 토큰 =====
  // JWT(JSON Web Token)란 사용자 인증 정보를 JSON으로 인코딩한 토큰
  // 구조: header.payload.signature (모두 Base64URL 인코딩)
  // "eyJ"는 Base64URL로 인코딩된 '{"'의 시작 부분 (JSON 객체의 시작)
  { name: "JWT Token", regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g },

  // ===== 패키지 레지스트리 토큰 =====

  // npm 인증 토큰: "npm_"로 시작하고 36자의 영숫자가 뒤따름
  { name: "npm Token", regex: /npm_[a-zA-Z0-9]{36}/g },

  // ===== SaaS 서비스 키 =====

  // Heroku API 키: 환경변수 또는 설정에서 heroku_api_key 패턴 탐지
  { name: "Heroku API Key", regex: /(?:heroku[_-]?api[_-]?key|HEROKU_API_KEY)\s*[:=]\s*\S+/gi },

  // SendGrid API 키: "SG." 접두사 + 22자 + "." + 43자 구조
  { name: "SendGrid API Key", regex: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g },

  // Twilio 인증 토큰: 32자의 16진수 문자열 (SMS/전화 API 서비스)
  {
    name: "Twilio Auth Token",
    regex: /(?:twilio[_-]?auth[_-]?token|TWILIO_AUTH_TOKEN)\s*[:=]\s*[a-f0-9]{32}/gi,
  },

  // ===== 데이터베이스 연결 문자열 =====
  // 연결 문자열에는 보통 사용자명, 비밀번호, 호스트 정보가 포함됨

  // PostgreSQL: postgresql://user:password@host:port/database
  { name: "PostgreSQL Connection", regex: /postgresql:\/\/[^\s'"]+/gi },

  // MongoDB: mongodb://user:password@host:port/database 또는 mongodb+srv:// (SRV 레코드 사용)
  { name: "MongoDB Connection", regex: /mongodb(?:\+srv)?:\/\/[^\s'"]+/gi },

  // MySQL: mysql://user:password@host:port/database
  { name: "MySQL Connection", regex: /mysql:\/\/[^\s'"]+/gi },

  // ===== 일반적인 비밀 정보 패턴 (마지막에 배치 — 범위가 넓음) =====
  // 이 패턴들은 다양한 형태의 비밀 정보를 포괄적으로 탐지

  // password = "..." 형태의 비밀번호 할당
  { name: "Password", regex: /password\s*[:=]\s*\S+/gi },

  // Bearer 인증 토큰: HTTP Authorization 헤더에 사용되는 형식
  { name: "Bearer Token", regex: /Bearer\s+[a-zA-Z0-9._-]+/g },

  // API_KEY = "..." 형태의 API 키 할당
  { name: "API Key", regex: /API[_-]?KEY\s*[:=]\s*\S+/gi },

  // secret, token, credential 등의 변수에 8자 이상의 값이 할당된 패턴
  {
    name: "Generic Secret Assignment",
    regex: /(?:secret|token|credential|auth_key)\s*[:=]\s*['"][^\s'"]{8,}['"]/gi,
  },
];

/**
 * 텍스트에서 비밀 정보를 탐지하고 [REDACTED]로 대체합니다.
 *
 * 모든 SECRET_PATTERNS를 순서대로 검사하여, 매칭되는 부분을
 * [REDACTED]로 교체합니다. 원본 텍스트는 변경하지 않고
 * 새로운 문자열을 반환합니다.
 *
 * @param text - 비밀 정보를 검사할 텍스트
 * @returns 스캔 결과 (발견 여부, 대체된 텍스트, 매칭된 패턴 목록)
 *
 * @example
 * ```ts
 * const result = scanForSecrets("export AWS_KEY=AKIAIOSFODNN7EXAMPLE");
 * // result.found === true
 * // result.redacted === "export AWS_KEY=[REDACTED]"
 * // result.patterns === ["AWS Access Key"]
 * ```
 */
export function scanForSecrets(text: string): SecretScanResult {
  const matchedPatterns: string[] = [];
  let redacted = text;

  for (const { name, regex } of SECRET_PATTERNS) {
    // 정규식 객체를 새로 생성하여 lastIndex 상태를 초기화
    // (같은 RegExp 객체를 재사용하면 lastIndex가 누적되어 오탐 발생 가능)
    const pattern = new RegExp(regex.source, regex.flags);

    // 먼저 패턴이 매칭되는지 확인
    if (pattern.test(redacted)) {
      matchedPatterns.push(name);
      // 새로운 RegExp 객체로 실제 대체 수행 (test()가 lastIndex를 변경했으므로)
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
