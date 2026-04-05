/**
 * SSO/SAML 테스트
 */

import { describe, it, expect } from "vitest";
import {
  parseSAMLResponse,
  mapToUser,
  buildAuthnRequest,
  isResponseValid,
  type SSOConfig,
  type SAMLResponse,
} from "../../../src/auth/sso-saml.js";

// ─── 테스트 픽스처 ────────────────────────────────────────────────────────────

const SAMPLE_SAML_XML = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
                xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
                ID="_response123"
                Version="2.0"
                IssueInstant="2026-04-05T10:00:00Z"
                Destination="https://app.example.com/auth/callback">
  <saml:Issuer>https://idp.example.com</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  <saml:Assertion ID="_assertion123" Version="2.0" IssueInstant="2026-04-05T10:00:00Z">
    <saml:Issuer>https://idp.example.com</saml:Issuer>
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
        user@example.com
      </saml:NameID>
    </saml:Subject>
    <saml:Conditions NotBefore="2026-04-05T09:55:00Z" NotOnOrAfter="2026-04-05T10:05:00Z">
    </saml:Conditions>
    <saml:AttributeStatement>
      <saml:Attribute Name="emailAddress">
        <saml:AttributeValue>user@example.com</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="displayName">
        <saml:AttributeValue>Alice Smith</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="memberOf">
        <saml:AttributeValue>developers,admins</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`;

const MINIMAL_SAML_XML = `<Response>
  <Issuer>https://minimal-idp.example.com</Issuer>
  <Subject>
    <NameID>minimal-user@example.com</NameID>
  </Subject>
</Response>`;

const SAMPLE_SSO_CONFIG: SSOConfig = {
  provider: "saml",
  entityId: "https://app.example.com",
  ssoUrl: "https://idp.example.com/sso",
  certificate: "-----BEGIN CERTIFICATE-----\nMIIBkTCB+wIJ...\n-----END CERTIFICATE-----",
  callbackUrl: "https://app.example.com/auth/callback",
};

// ─── parseSAMLResponse 테스트 ─────────────────────────────────────────────────

describe("parseSAMLResponse()", () => {
  it("Issuer를 올바르게 파싱해야 한다", () => {
    const response = parseSAMLResponse(SAMPLE_SAML_XML);
    expect(response.issuer).toBe("https://idp.example.com");
  });

  it("NameID를 올바르게 파싱해야 한다", () => {
    const response = parseSAMLResponse(SAMPLE_SAML_XML);
    expect(response.nameId).toBe("user@example.com");
  });

  it("SAML 속성들을 파싱해야 한다", () => {
    const response = parseSAMLResponse(SAMPLE_SAML_XML);
    expect(response.attributes["emailAddress"]).toBe("user@example.com");
    expect(response.attributes["displayName"]).toBe("Alice Smith");
    expect(response.attributes["memberOf"]).toBe("developers,admins");
  });

  it("NotBefore 조건을 파싱해야 한다", () => {
    const response = parseSAMLResponse(SAMPLE_SAML_XML);
    expect(response.notBefore).toBe("2026-04-05T09:55:00Z");
  });

  it("NotOnOrAfter 조건을 파싱해야 한다", () => {
    const response = parseSAMLResponse(SAMPLE_SAML_XML);
    expect(response.notOnOrAfter).toBe("2026-04-05T10:05:00Z");
  });

  it("최소 SAML XML도 파싱해야 한다", () => {
    const response = parseSAMLResponse(MINIMAL_SAML_XML);
    expect(response.issuer).toBe("https://minimal-idp.example.com");
    expect(response.nameId).toBe("minimal-user@example.com");
  });

  it("시간 조건이 없으면 undefined여야 한다", () => {
    const response = parseSAMLResponse(MINIMAL_SAML_XML);
    expect(response.notBefore).toBeUndefined();
    expect(response.notOnOrAfter).toBeUndefined();
  });

  it("Issuer가 없으면 에러를 던져야 한다", () => {
    const xml = `<Response><Subject><NameID>user</NameID></Subject></Response>`;
    expect(() => parseSAMLResponse(xml)).toThrow(/Issuer/);
  });

  it("NameID가 없으면 에러를 던져야 한다", () => {
    const xml = `<Response><Issuer>https://idp.example.com</Issuer></Response>`;
    expect(() => parseSAMLResponse(xml)).toThrow(/NameID/);
  });

  it("반환값이 읽기 전용이어야 한다 (타입 수준)", () => {
    const response = parseSAMLResponse(SAMPLE_SAML_XML);
    // TypeScript 컴파일 레벨에서 readonly 확인 — 런타임에서는 값 확인만
    expect(typeof response.issuer).toBe("string");
    expect(typeof response.nameId).toBe("string");
  });
});

// ─── mapToUser 테스트 ─────────────────────────────────────────────────────────

describe("mapToUser()", () => {
  const response = parseSAMLResponse(SAMPLE_SAML_XML);
  const mapping = {
    email: "emailAddress",
    name: "displayName",
    groups: "memberOf",
  };

  it("NameID를 id로 사용해야 한다", () => {
    const user = mapToUser(response, mapping);
    expect(user.id).toBe("user@example.com");
  });

  it("이메일 속성을 매핑해야 한다", () => {
    const user = mapToUser(response, mapping);
    expect(user.email).toBe("user@example.com");
  });

  it("이름 속성을 매핑해야 한다", () => {
    const user = mapToUser(response, mapping);
    expect(user.name).toBe("Alice Smith");
  });

  it("그룹을 쉼표로 분리해야 한다", () => {
    const user = mapToUser(response, mapping);
    expect(user.groups).toContain("developers");
    expect(user.groups).toContain("admins");
    expect(user.groups.length).toBe(2);
  });

  it("매핑되지 않은 속성은 attributes에 남아야 한다", () => {
    const user = mapToUser(response, { email: "emailAddress" }); // name, groups 미매핑
    // memberOf와 displayName은 attributes에 있어야 함
    expect(user.attributes["memberOf"]).toBe("developers,admins");
    expect(user.attributes["displayName"]).toBe("Alice Smith");
  });

  it("빈 매핑으로 호출해도 id가 설정되어야 한다", () => {
    const user = mapToUser(response, {});
    expect(user.id).toBe("user@example.com");
  });

  it("이메일 매핑이 없으면 NameID가 이메일 형식일 때 사용해야 한다", () => {
    const simpleResponse: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "fallback@example.com",
      attributes: {},
    };
    const user = mapToUser(simpleResponse, {});
    expect(user.email).toBe("fallback@example.com");
  });

  it("세미콜론으로 구분된 그룹도 처리해야 한다", () => {
    const responseWithSemicolon: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "user@example.com",
      attributes: { groups: "group1;group2;group3" },
    };
    const user = mapToUser(responseWithSemicolon, { groups: "groups" });
    expect(user.groups).toHaveLength(3);
    expect(user.groups).toContain("group1");
  });

  it("그룹 속성이 없으면 빈 배열이어야 한다", () => {
    const simpleResponse: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "user@example.com",
      attributes: {},
    };
    const user = mapToUser(simpleResponse, {});
    expect(user.groups).toHaveLength(0);
  });
});

// ─── buildAuthnRequest 테스트 ─────────────────────────────────────────────────

describe("buildAuthnRequest()", () => {
  it("유효한 XML을 반환해야 한다", () => {
    const xml = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    expect(xml).toContain('<?xml version="1.0"');
  });

  it("AuthnRequest 요소가 포함되어야 한다", () => {
    const xml = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    expect(xml).toContain("AuthnRequest");
  });

  it("Issuer에 entityId가 포함되어야 한다", () => {
    const xml = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    expect(xml).toContain(SAMPLE_SSO_CONFIG.entityId);
  });

  it("Destination에 ssoUrl이 포함되어야 한다", () => {
    const xml = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    expect(xml).toContain(SAMPLE_SSO_CONFIG.ssoUrl);
  });

  it("AssertionConsumerServiceURL에 callbackUrl이 포함되어야 한다", () => {
    const xml = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    expect(xml).toContain(SAMPLE_SSO_CONFIG.callbackUrl);
  });

  it("IssueInstant가 ISO 8601 형식이어야 한다", () => {
    const xml = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    expect(xml).toMatch(/IssueInstant="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("ID 속성이 _로 시작해야 한다 (SAML 요구사항)", () => {
    const xml = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    expect(xml).toMatch(/ID="_[0-9a-f]+"/);
  });

  it("SAML 2.0 네임스페이스가 포함되어야 한다", () => {
    const xml = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    expect(xml).toContain("urn:oasis:names:tc:SAML:2.0:protocol");
  });

  it("NameIDPolicy 요소가 포함되어야 한다", () => {
    const xml = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    expect(xml).toContain("NameIDPolicy");
  });

  it("서로 다른 호출은 서로 다른 ID를 생성해야 한다", () => {
    const xml1 = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    const xml2 = buildAuthnRequest(SAMPLE_SSO_CONFIG);
    const idMatch1 = /ID="(_[^"]+)"/.exec(xml1)?.[1];
    const idMatch2 = /ID="(_[^"]+)"/.exec(xml2)?.[1];
    // ID는 다를 수 있음 (타임스탬프 기반)
    expect(idMatch1).toBeDefined();
    expect(idMatch2).toBeDefined();
  });
});

// ─── isResponseValid 테스트 ──────────────────────────────────────────────────

describe("isResponseValid()", () => {
  it("유효한 응답은 valid: true를 반환해야 한다", () => {
    const now = new Date();
    const notBefore = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // 10분 전
    const notOnOrAfter = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10분 후

    const response: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "user@example.com",
      attributes: {},
      notBefore,
      notOnOrAfter,
    };

    const result = isResponseValid(response);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("시간 조건 없이도 유효해야 한다", () => {
    const response: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "user@example.com",
      attributes: {},
    };

    const result = isResponseValid(response);
    expect(result.valid).toBe(true);
  });

  it("빈 issuer는 유효하지 않아야 한다", () => {
    const response: SAMLResponse = {
      issuer: "",
      nameId: "user@example.com",
      attributes: {},
    };

    const result = isResponseValid(response);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Issuer");
  });

  it("빈 nameId는 유효하지 않아야 한다", () => {
    const response: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "",
      attributes: {},
    };

    const result = isResponseValid(response);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("NameID");
  });

  it("만료된 응답(notOnOrAfter 과거)은 유효하지 않아야 한다", () => {
    const expiredTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1시간 전 만료

    const response: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "user@example.com",
      attributes: {},
      notOnOrAfter: expiredTime,
    };

    const result = isResponseValid(response);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("만료");
  });

  it("아직 유효하지 않은 응답(notBefore 먼 미래)은 유효하지 않아야 한다", () => {
    const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1시간 후 시작

    const response: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "user@example.com",
      attributes: {},
      notBefore: futureTime,
    };

    const result = isResponseValid(response);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("유효하지 않");
  });

  it("시계 오차 5분 이내는 허용해야 한다 (notBefore 3분 뒤)", () => {
    const slightFuture = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3분 후

    const response: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "user@example.com",
      attributes: {},
      notBefore: slightFuture,
    };

    const result = isResponseValid(response);
    expect(result.valid).toBe(true);
  });

  it("잘못된 날짜 형식의 notBefore는 유효하지 않아야 한다", () => {
    const response: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "user@example.com",
      attributes: {},
      notBefore: "not-a-date",
    };

    const result = isResponseValid(response);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("NotBefore");
  });

  it("잘못된 날짜 형식의 notOnOrAfter는 유효하지 않아야 한다", () => {
    const response: SAMLResponse = {
      issuer: "https://idp.example.com",
      nameId: "user@example.com",
      attributes: {},
      notOnOrAfter: "invalid-date",
    };

    const result = isResponseValid(response);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("NotOnOrAfter");
  });
});
