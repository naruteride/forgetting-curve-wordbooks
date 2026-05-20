# 망각곡선 단어장

애빙하우스의 망각 곡선을 단어장 학습 흐름에 적용한 정적 SPA입니다. 바닐라 JavaScript, Web Components, Shadow DOM, Firebase Auth, Firestore만 사용합니다.

## 실행

```bash
npm run dev
```

개발 서버는 `dist`를 생성한 뒤 기본 포트 `4173`에서 정적 파일을 제공합니다.

## 테스트

```bash
npm test
```

Node 내장 `node:test`로 망각곡선, 검색/필터, 줄바꿈 파싱, 학습 큐 재삽입 규칙을 검증합니다.

## 빌드

```bash
npm run build
```

빌드 시 Firebase 웹 설정값을 `FIREBASE_*` 환경변수에서 읽어 `dist/config/firebase-config.js`를 생성합니다. Vercel에도 같은 이름으로 설정합니다.

## Firebase 설정

기존 Firebase 프로젝트와 동일한 값을 Vercel 환경변수로 설정합니다.

모든 Firebase 설정값은 저장소에 커밋하지 않고 빌드 시 `dist/config/firebase-config.js`에만 생성합니다. 누락된 값은 `MISSING_ENV_VAR`로 출력됩니다.

## Firestore 구조

### `wordbooks/{wordbookId}`

- `name`: 단어장 이름
- `createdBy`: 생성한 사용자 UID
- `collaborators`: 접근 가능한 사용자 UID 배열
- `createdAt`: 생성 시각
- `updatedAt`: 수정 시각
- `order`: 사용자 목록 정렬값
- `language`: 기존 앱 호환용 필드

### `wordbooks/{wordbookId}/words/{wordId}`

- `term`: 외울 단어
- `pronunciations`: 발음 배열
- `meanings`: 한국어 뜻 배열
- `examples`: 예문 배열
- `createdBy`: 생성한 사용자 UID
- `createdAt`: 생성 시각
- `updatedAt`: 수정 시각
- `spelling`, `pronunciation`: 기존 앱 호환용 필드

읽을 때는 기존 `spelling`, `kanji`, `pronunciation`, `onyomi`, `kunyomi` 필드도 새 표준 모델로 변환합니다.

### `wordbooks/{wordbookId}/userStats/{uid}/words/{wordId}`

- `studyCount`: 외운 횟수
- `lastStudiedAt`: 마지막 학습 시각

## 망각곡선 규칙

- `0회`: 즉시 노출
- `1~7회`: 해당 횟수만큼 지난 날짜부터 노출
- `8회 이상`: 30일 뒤부터 노출

날짜 차이는 사용자의 로컬 날짜 기준으로 계산합니다.
