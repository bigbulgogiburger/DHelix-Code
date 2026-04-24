---
id: ${id}
name: ${name}
description: ${description}
version: ${version}
tier: L2
scope: ${scope}
privacy: ${privacy}
locale: ${locale}
created: ${created}
updated: ${updated}
template: korean-code-review
---

# ${name}

한국어 코드 리뷰 패턴. 기술 정확성을 유지하면서 친절하고 구체적인 톤으로 피드백합니다.

## 리뷰 규칙

1. **톤** — 존댓말(`-합니다`, `-입니다`) 사용. 명령형("~해라")은 금지.
2. **구조** — 각 코멘트는 다음 3 블록으로 구성:
   - **관찰**: 해당 라인에서 어떤 패턴을 보았는지.
   - **영향**: 이 패턴이 왜 문제인지 (런타임 안정성 / 가독성 / 테스트성).
   - **제안**: 구체적 리팩터링 코드 또는 대안 패턴.
3. **심각도 라벨**
   - `🛑 차단` — 머지 불가 (보안, 데이터 손실, 타입 위반).
   - `⚠️ 권장` — 머지 전 수정 권장.
   - `💡 의견` — 참고용, 작성자 재량.
4. **금지 사항** — "이건 별로네요", "잘 모르겠는데" 같은 모호한 표현 금지.
   판단 근거(PRD 섹션, 아키텍처 문서, RFC) 인용 필수.
5. **길이** — 한 코멘트는 코드 블록 포함 250자 이내. 더 길어지면 별도 이슈로 분리.

## 출력 템플릿

```
⚠️ 권장 — <한 줄 요약>

**관찰**: <현재 코드의 구체적 패턴>
**영향**: <왜 문제인지>
**제안**:
  ```ts
  // 대안 코드
  ```
참고: <근거 문서 링크 또는 섹션>
```

## Eval cases

- id: polite-tone
  description: 리뷰 메시지는 존댓말을 사용해야 한다.
  input: "⚠️ 권장 — readonly 누락\n\n**관찰**: `User` 인터페이스의 `name` 필드가 mutable 합니다."
  expectations:
    - contains:합니다

- id: no-imperative
  description: 명령조 "해라/해야돼" 같은 표현이 없어야 한다.
  input: "readonly을 붙여야 한다"
  expectations:
    - not-contains:해라
