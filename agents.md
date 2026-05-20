# agents.md

## 프로젝트 원칙

이 저장소는 애빙하우스 망각 곡선을 핵심 기능으로 삼는 단어장 SPA입니다. React, Next.js, Vue.js, TypeScript를 사용하지 않고 바닐라 JavaScript, Web Components, Shadow DOM으로 구현합니다.

## 파일 규칙

- 모든 파일명과 디렉터리명은 소문자로 작성하고, 단어 구분은 대시를 사용합니다.
- 앱 소스는 `src`, 빌드/개발 스크립트는 `scripts`, 테스트는 `tests`에 둡니다.
- 빌드 결과는 `dist`에 생성하며 직접 수정하지 않습니다.
- JSDoc은 한국어로 자세히 작성합니다.

## 아키텍처 규칙

- UI는 Custom Element 단위로 나누고 각 컴포넌트는 Shadow DOM을 사용합니다.
- Firestore 호출은 `src/services/firebase-service.js`에서만 수행합니다.
- 망각곡선, 검색, 정렬, 학습 큐 조작은 `src/domain/study-scheduler.js`에 둡니다.
- 화면에서 검색/필터/정렬은 이미 가져온 로컬 데이터로 처리해 Firestore 호출을 늘리지 않습니다.

## Firebase 호환성

기존 `fuck-naver-wordbooks` Firebase 프로젝트와 같은 DB를 사용합니다. 기존 `wordbooks`, `words`, `userStats` 구조를 읽을 수 있어야 하며, 새 필드는 기존 필드를 깨지 않는 방식으로 추가합니다.

## 접근성 규칙

- 폼 입력에는 명시적인 `label`을 연결합니다.
- 확인/편집 UI는 가능한 `<dialog>`를 사용합니다.
- 키보드만으로 로그인, 단어장 관리, 단어 관리, 학습 카드 조작이 가능해야 합니다.
- `prefers-reduced-motion`을 존중합니다.
