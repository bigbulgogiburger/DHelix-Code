/**
 * SSO/SAML Integration Path — Enterprise SSO 기초 인터페이스 및 SAML 응답 파싱
 *
 * SAML 2.0 기반 SSO 통합의 기초 구조를 제공합니다.
 * 외부 XML 파서 없이 정규식 기반으로 SAML 응답을 파싱합니다.
 *
 * 지원 기능:
 * - SAML AuthnRequest XML 생성
 * - SAML Response 파싱 (정규식 기반)
 * - 사용자 속성 매핑
 * - 시간 유효성 검사
 *
 * 제한 사항:
 * - 서명 검증은 TODO (기초 구조만 제공)
 * - XML 네임스페이스 처리는 단순화됨
 * - 멀티라인 복잡 XML 파싱은 미지원
 *
 * @example
 * ```ts
 * const config: SSOConfig = {
 *   provider: "saml",
 *   entityId: "https://app.example.com",
 *   ssoUrl: "https://idp.example.com/sso",
 *   certificate: "-----BEGIN CERTIFICATE-----\n...",
 *   callbackUrl: "https://app.example.com/auth/callback",
 * };
 *
 * const authnRequest = buildAuthnRequest(config);
 * // → SAML AuthnRequest XML 문자열
 *
 * const samlResponse = parseSAMLResponse(xmlString);
 * const user = mapToUser(samlResponse, { email: "emailAddress", name: "displayName" });
 * ```
 */

// ─── 인터페이스 정의 ─────────────────────────────────────────────────────────

/**
 * SSO 공급자 설정
 */
export interface SSOConfig {
  /** SSO 프로토콜 종류 */
  readonly provider: "saml" | "oidc";
  /** Service Provider 엔티티 ID (SP의 고유 식별자 URL) */
  readonly entityId: string;
  /** Identity Provider SSO 엔드포인트 URL */
  readonly ssoUrl: string;
  /** X.509 인증서 (PEM 형식) — 서명 검증용 */
  readonly certificate: string;
  /** SP 콜백 URL — IdP가 응답을 전송할 엔드포인트 */
  readonly callbackUrl: string;
}

/**
 * SSO 인증 후 반환되는 사용자 정보
 */
export interface SSOUser {
  /** 사용자 고유 식별자 (NameID 기반) */
  readonly id: string;
  /** 사용자 이메일 */
  readonly email: string;
  /** 사용자 표시 이름 */
  readonly name: string;
  /** 사용자가 속한 그룹 목록 */
  readonly groups: readonly string[];
  /** 추가 속성 맵 */
  readonly attributes: Readonly<Record<string, string>>;
}

/**
 * 파싱된 SAML Response 구조
 */
export interface SAMLResponse {
  /** SAML Response를 발급한 IdP 엔티티 ID */
  readonly issuer: string;
  /** 사용자를 식별하는 NameID 값 */
  readonly nameId: string;
  /** SAML Assertion에서 추출한 속성 맵 */
  readonly attributes: Readonly<Record<string, string>>;
  /** 이 응답이 유효하기 시작하는 시각 (ISO 8601) */
  readonly notBefore?: string;
  /** 이 응답이 만료되는 시각 (ISO 8601) */
  readonly notOnOrAfter?: string;
}

/**
 * 유효성 검사 결과
 */
export interface ValidationResult {
  /** 유효 여부 */
  readonly valid: boolean;
  /** 유효하지 않은 경우 사유 */
  readonly reason?: string;
}

// ─── 내부 유틸리티 ─────────────────────────────────────────────────────────

/**
 * XML 문자열에서 단일 태그의 텍스트 내용을 추출합니다.
 *
 * 네임스페이스 접두사를 포함한 태그명을 지원합니다.
 * (예: "saml:Issuer", "samlp:StatusCode")
 *
 * @param xml - 검색할 XML 문자열
 * @param tagName - 추출할 태그명 (네임스페이스 접두사 포함 가능)
 * @returns 태그 텍스트 내용, 없으면 undefined
 */
function extractTagContent(xml: string, tagName: string): string | undefined {
  // 네임스페이스 접두사를 선택적으로 처리
  const localName = tagName.includes(":") ? tagName.split(":")[1]! : tagName;

  // 정확한 태그명 또는 네임스페이스 접두사 포함 태그명 매칭
  const pattern = new RegExp(
    `<(?:[a-zA-Z0-9_-]+:)?${escapeRegex(localName)}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${escapeRegex(localName)}>`,
  );
  const match = pattern.exec(xml);
  return match?.[1]?.trim();
}

/**
 * XML 속성값을 추출합니다.
 *
 * @param xml - XML 태그 문자열
 * @param attrName - 추출할 속성명
 * @returns 속성값, 없으면 undefined
 */
function extractAttribute(xml: string, attrName: string): string | undefined {
  const pattern = new RegExp(`${escapeRegex(attrName)}=["']([^"']*)["']`);
  const match = pattern.exec(xml);
  return match?.[1];
}

/**
 * 정규식 특수문자를 이스케이프합니다.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * XML 엔티티를 디코딩합니다.
 */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * SAML Assertion에서 AttributeStatement 속성들을 파싱합니다.
 *
 * @param xml - SAML Response XML
 * @returns 속성명 → 속성값 맵
 */
function parseSAMLAttributes(xml: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  // <saml:Attribute Name="..."> ... <saml:AttributeValue>...</saml:AttributeValue> ... </saml:Attribute>
  const attrBlockPattern =
    /<(?:[a-zA-Z0-9_-]+:)?Attribute\s[^>]*Name=["']([^"']*)["'][^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?Attribute>/g;

  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrBlockPattern.exec(xml)) !== null) {
    const attrName = attrMatch[1]!.trim();
    const attrBlock = attrMatch[2]!;

    // AttributeValue 추출 (첫 번째 값 사용)
    const valueMatch =
      /<(?:[a-zA-Z0-9_-]+:)?AttributeValue[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?AttributeValue>/.exec(
        attrBlock,
      );
    if (valueMatch?.[1] !== undefined) {
      attributes[attrName] = decodeXmlEntities(valueMatch[1].trim());
    }
  }

  return attributes;
}

/**
 * Conditions 요소에서 시간 조건을 파싱합니다.
 *
 * @param xml - SAML XML
 * @returns { notBefore, notOnOrAfter } 또는 빈 객체
 */
function parseConditions(xml: string): {
  notBefore?: string;
  notOnOrAfter?: string;
} {
  const conditionsPattern =
    /<(?:[a-zA-Z0-9_-]+:)?Conditions\s([^>]*)>/;
  const match = conditionsPattern.exec(xml);
  if (!match) return {};

  const condAttrs = match[1]!;
  const notBefore = extractAttribute(condAttrs, "NotBefore");
  const notOnOrAfter = extractAttribute(condAttrs, "NotOnOrAfter");

  return {
    ...(notBefore !== undefined && { notBefore }),
    ...(notOnOrAfter !== undefined && { notOnOrAfter }),
  };
}

// ─── 공개 API ─────────────────────────────────────────────────────────────────

/**
 * SAML Response XML을 파싱하여 구조화된 SAMLResponse 객체를 반환합니다.
 *
 * 정규식 기반 파싱을 사용하며, 외부 XML 파서 의존성이 없습니다.
 * 서명 검증은 현재 미구현 상태입니다 (TODO).
 *
 * @param xml - SAML Response XML 문자열 (Base64 디코딩 후)
 * @returns 파싱된 SAMLResponse 객체
 * @throws Error - 필수 필드(issuer, nameId)가 없는 경우
 *
 * @example
 * ```ts
 * const response = parseSAMLResponse(decodedXml);
 * // response.issuer === "https://idp.example.com"
 * // response.nameId === "user@example.com"
 * ```
 */
export function parseSAMLResponse(xml: string): SAMLResponse {
  // Issuer 추출
  const issuer = extractTagContent(xml, "Issuer");
  if (!issuer) {
    throw new Error("SAML Response에서 Issuer를 찾을 수 없습니다.");
  }

  // NameID 추출
  const nameId = extractTagContent(xml, "NameID");
  if (!nameId) {
    throw new Error("SAML Response에서 NameID를 찾을 수 없습니다.");
  }

  // 속성 파싱
  const attributes = parseSAMLAttributes(xml);

  // 시간 조건 파싱
  const { notBefore, notOnOrAfter } = parseConditions(xml);

  // TODO: 서명 검증 (X.509 인증서 기반 xmldsig 검증)
  // 현재는 구조 파싱만 수행하며, 실제 프로덕션 사용 전 서명 검증 구현 필요

  return {
    issuer: decodeXmlEntities(issuer),
    nameId: decodeXmlEntities(nameId),
    attributes,
    ...(notBefore !== undefined && { notBefore }),
    ...(notOnOrAfter !== undefined && { notOnOrAfter }),
  };
}

/**
 * SAMLResponse를 SSOUser 객체로 변환합니다.
 *
 * mapping 파라미터는 SSOUser 필드명 → SAML 속성명 매핑입니다.
 * 예: `{ email: "emailAddress", name: "displayName", groups: "memberOf" }`
 *
 * @param response - 파싱된 SAMLResponse
 * @param mapping - SSOUser 필드 → SAML 속성명 매핑
 * @returns 변환된 SSOUser 객체
 *
 * @example
 * ```ts
 * const user = mapToUser(response, {
 *   email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
 *   name: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
 *   groups: "http://schemas.xmlsoap.org/claims/Group",
 * });
 * ```
 */
export function mapToUser(
  response: SAMLResponse,
  mapping: Readonly<Record<string, string>>,
): SSOUser {
  const { attributes, nameId } = response;

  // 이메일 해석: mapping["email"] → 속성값 → fallback to nameId
  const emailAttr = mapping["email"];
  const email =
    (emailAttr !== undefined ? attributes[emailAttr] : undefined) ??
    (nameId.includes("@") ? nameId : "");

  // 이름 해석: mapping["name"] → 속성값 → fallback to email prefix
  const nameAttr = mapping["name"];
  const name =
    (nameAttr !== undefined ? attributes[nameAttr] : undefined) ??
    email.split("@")[0] ??
    nameId;

  // 그룹 해석: mapping["groups"] → 속성값을 쉼표 또는 세미콜론으로 분리
  const groupsAttr = mapping["groups"];
  const groupsRaw =
    groupsAttr !== undefined ? (attributes[groupsAttr] ?? "") : "";
  const groups: readonly string[] =
    groupsRaw.length > 0
      ? groupsRaw
          .split(/[,;]/)
          .map((g) => g.trim())
          .filter((g) => g.length > 0)
      : [];

  // 나머지 SAML 속성을 attributes로 전달 (매핑된 필드 제외)
  const mappedValues = new Set(Object.values(mapping));
  const remainingAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!mappedValues.has(key)) {
      remainingAttributes[key] = value;
    }
  }

  return {
    id: nameId,
    email,
    name,
    groups,
    attributes: remainingAttributes,
  };
}

/**
 * SAML AuthnRequest XML을 생성합니다.
 *
 * Service Provider가 Identity Provider에게 인증을 요청할 때 사용합니다.
 * 생성된 XML은 HTTP Redirect Binding 또는 POST Binding으로 전송합니다.
 *
 * @param config - SSO 설정
 * @returns SAML AuthnRequest XML 문자열
 *
 * @example
 * ```ts
 * const xml = buildAuthnRequest(config);
 * const encoded = Buffer.from(xml).toString("base64");
 * // → IdP의 ssoUrl로 리다이렉트
 * ```
 */
export function buildAuthnRequest(config: SSOConfig): string {
  const id = `_${generateRequestId()}`;
  const issueInstant = new Date().toISOString();

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<samlp:AuthnRequest`,
    `  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"`,
    `  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
    `  ID="${id}"`,
    `  Version="2.0"`,
    `  IssueInstant="${issueInstant}"`,
    `  Destination="${config.ssoUrl}"`,
    `  AssertionConsumerServiceURL="${config.callbackUrl}"`,
    `  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">`,
    `  <saml:Issuer>${config.entityId}</saml:Issuer>`,
    `  <samlp:NameIDPolicy`,
    `    Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"`,
    `    AllowCreate="true"/>`,
    `</samlp:AuthnRequest>`,
  ].join("\n");
}

/**
 * SAMLResponse의 유효성을 검사합니다.
 *
 * 검사 항목:
 * 1. issuer가 비어 있지 않은지
 * 2. nameId가 비어 있지 않은지
 * 3. notBefore — 현재 시각이 notBefore 이후인지
 * 4. notOnOrAfter — 현재 시각이 notOnOrAfter 이전인지
 *
 * @param response - 유효성 검사할 SAMLResponse
 * @returns { valid: boolean; reason?: string }
 *
 * @example
 * ```ts
 * const result = isResponseValid(response);
 * if (!result.valid) {
 *   console.error("SAML 응답 유효하지 않음:", result.reason);
 * }
 * ```
 */
export function isResponseValid(response: SAMLResponse): ValidationResult {
  // Issuer 확인
  if (!response.issuer || response.issuer.trim().length === 0) {
    return { valid: false, reason: "Issuer가 비어 있습니다." };
  }

  // NameID 확인
  if (!response.nameId || response.nameId.trim().length === 0) {
    return { valid: false, reason: "NameID가 비어 있습니다." };
  }

  const now = Date.now();

  // NotBefore 검사
  if (response.notBefore !== undefined) {
    const notBeforeMs = parseIsoDate(response.notBefore);
    if (notBeforeMs === undefined) {
      return { valid: false, reason: `NotBefore 날짜 형식이 올바르지 않습니다: ${response.notBefore}` };
    }
    // 시계 오차 허용: 5분
    if (now < notBeforeMs - 5 * 60 * 1000) {
      return {
        valid: false,
        reason: `SAML 응답이 아직 유효하지 않습니다 (NotBefore: ${response.notBefore})`,
      };
    }
  }

  // NotOnOrAfter 검사
  if (response.notOnOrAfter !== undefined) {
    const notOnOrAfterMs = parseIsoDate(response.notOnOrAfter);
    if (notOnOrAfterMs === undefined) {
      return {
        valid: false,
        reason: `NotOnOrAfter 날짜 형식이 올바르지 않습니다: ${response.notOnOrAfter}`,
      };
    }
    if (now >= notOnOrAfterMs) {
      return {
        valid: false,
        reason: `SAML 응답이 만료되었습니다 (NotOnOrAfter: ${response.notOnOrAfter})`,
      };
    }
  }

  return { valid: true };
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

/**
 * SAML AuthnRequest ID 생성 — 타임스탬프 + 랜덤 16진수
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 10);
  return `${timestamp}${random}`;
}

/**
 * ISO 8601 날짜 문자열을 밀리초 타임스탬프로 변환합니다.
 *
 * @param iso - ISO 8601 형식 날짜 문자열
 * @returns 밀리초 타임스탬프, 파싱 실패 시 undefined
 */
function parseIsoDate(iso: string): number | undefined {
  const ms = Date.parse(iso);
  return isNaN(ms) ? undefined : ms;
}
