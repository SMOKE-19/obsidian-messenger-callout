# Messenger Callout

YAML 프로필로 정의한 임의의 메신저 텍스트 형식을 Obsidian Callout 안에서 줄 단위로
파싱·컬러링·lint하는 플러그인입니다. 특정 서비스의 내보내기 형식에 종속되지 않으며,
프로필의 정규식 또는 glob 규칙으로 헤더·본문·구분선을 정의합니다.

Callout 레이아웃, 이미지, 위키링크와 일반 Markdown 렌더링은 Obsidian 기본 동작을
유지합니다.

## 주요 기능

- Callout 타입과 YAML 프로필 연결
- 프로필 규칙에 따른 `header → body → separator` 상태 파싱
- 편집 모드와 읽기 모드 sender 컬러링
- 프로필별 배경색, 제목색과 SVG 아이콘 설정
- 새 sender 색상 자동 배정 및 별도 YAML 저장
- 여러 줄 텍스트 붙여넣기의 Callout 접두사 유지
- Obsidian 기본 이미지 붙여넣기와 로컬 이미지 embed 유지
- Obsidian 기본 Callout ID와 사용자 프로필 ID의 충돌 차단

## 설치

`dist/messenger-callout/`을 Vault의 다음 경로에 복사합니다.

```text
.obsidian/plugins/messenger-callout/
```

배포 폴더에는 `main.js`, `manifest.json`, `styles.css`, `versions.json`, `profiles/`,
`assets/`가 포함됩니다. 복사한 뒤 Obsidian의 커뮤니티 플러그인 설정에서
`Messenger Callout`을 활성화합니다.

## 사용법

프로필의 `app_id`를 Callout 타입으로 사용합니다.

```markdown
> [!<profile_id>] <optional title>
> <header line matched by the profile>
> <message body>
> ![[local-image.png]]
>
> <next header line>
> <next message body>
```

실제 입력 문자열의 sender, ID, 조직, 날짜 및 시간 형식은 플러그인이 고정하지
않습니다. 선택한 프로필의 `rules.pattern`과 named capture가 해석 방법을 결정합니다.

Callout 제목은 `[!<profile_id>]` 뒤에 직접 작성합니다. `display_name`은 프로필
메타데이터이며 Obsidian의 네이티브 제목을 강제로 교체하지 않습니다.

### 렌더링

- sender capture만 sender 고유 색상과 굵은 글씨로 표시합니다.
- 헤더의 나머지 capture는 공통 헤더 스타일을 사용합니다.
- 본문은 해당 sender 색상을 기준으로 구분합니다.
- 이미지 embed DOM은 텍스트 컬러링 대상에서 제외합니다.
- 행간, 문단 여백과 이미지 크기는 변경하지 않습니다.
- 배경색, 제목색과 아이콘은 프로필 `appearance`에서 선택합니다.

### 붙여넣기

- 여러 줄 일반 텍스트를 Callout 안에 붙여넣으면 후속 줄에 `> `를 추가합니다.
- 빈 줄에도 Callout 접두사를 유지합니다.
- 이미지 클립보드는 가로채지 않고 Obsidian 기본 처리에 맡깁니다.
- fenced code block 문법은 지원하지 않습니다.

## YAML 프로필

프로필은 플러그인 설치 폴더의 `profiles/*.yaml`에 둡니다. 아래 내용은 특정 메신저
형식이 아닌 프로필 구조 예시입니다.

```yaml
app_id: custom_profile
display_name: Custom Profile

appearance:
  background_color: '#3a3a3a'
  title_color: '#ffffff'
  icon: assets/custom-icon.svg

senders: {}

rules:
  - id: custom-header
    match: regex
    role: header
    pattern: '<regular expression containing a named sender capture>'
    style: message-header
    captures:
      sender: sender

  - id: custom-body
    match: regex
    role: body
    pattern: '<regular expression for a message body line>'
    style: message-body
    captures:
      message: message

  - id: custom-separator
    match: regex
    role: separator
    pattern: '^\s*$'
    style: separator

fallback:
  style: unknown
  lint: warning
  message: No parser rule matched this line.
```

실행 가능한 번들 예시는 `profiles/example.yaml`에서 확인할 수 있습니다.

### 프로필 필드

- `app_id`: Callout 타입으로 사용할 고유 ID
- `display_name`: 프로필 메타데이터 이름
- `appearance.background_color`: Callout 배경색
- `appearance.title_color`: Callout 제목과 아이콘 색
- `appearance.icon`: 플러그인 폴더 기준 `assets/*.svg` 상대 경로
- `senders`: 사용자 지정 sender별 고정 색상
- `rules`: 위에서 아래로 평가하는 파싱 규칙 목록
- `match`: `regex` 또는 `glob`
- `role`: `header`, `body`, `separator` 상태
- `captures`: named capture와 CSS 토큰의 매핑
- `fallback`: 일치하는 규칙이 없는 줄의 lint 처리

`appearance.icon`은 `assets/` 아래의 안전한 SVG 상대 경로만 허용합니다. 이전
`icon: messenger-tiles` 값은 기본 SVG의 호환 별칭으로 처리합니다.

이전 프로필의 `appearance.text_color`는 읽을 수 있지만 본문 전체 색상에는 적용하지
않습니다.

### sender 자동 등록

헤더 규칙의 `sender` capture에서 새 값이 발견되면 기존 색상을 피해 자동 배정하고
다음 파일에 저장합니다.

```text
profiles/senders/<app_id>.yaml
```

원본 프로필은 수정하지 않으며 한 번 등록된 sender는 이후에도 같은 색상을 사용합니다.

### 기본 Callout 보호

Obsidian 기본 Callout 타입과 별칭은 네이티브 동작을 우선합니다. 기본 ID와 충돌하는
`app_id`는 로드하지 않고 오류 Notice를 표시합니다.

프로필 변경 사항은 플러그인을 다시 로드한 뒤 적용됩니다. 기본 예제 프로필은 설치
폴더에 없을 때만 생성하며 기존 파일을 덮어쓰지 않습니다.

## 개발 및 빌드

```bash
npm install
npm test
npm run build
```

`npm run build`는 TypeScript 검사와 프로덕션 번들 생성을 수행하고
`dist/messenger-callout/`을 직접 갱신합니다. ZIP 생성은 빌드 명령에 포함되지
않습니다.

## 프로젝트 구조

- `main.ts`: 플러그인 진입점과 lifecycle 등록
- `assets/`: 프로필에서 참조하는 SVG 아이콘
- `profiles/`: YAML 파서 프로필
- `src/callout.ts`: Callout 식별과 여러 줄 텍스트 paste 보조
- `src/editor.ts`: 편집 모드 컬러링과 lint decoration
- `src/parser.ts`: 상태 기반 줄 파서
- `src/profile-loader.ts`: 프로필 로드와 검증
- `src/profile-styles.ts`: 프로필별 배경·제목·아이콘 CSS 생성
- `src/reading-renderer.ts`: 읽기 모드 텍스트 컬러링
- `src/sender-registry.ts`: sender 색상 배정과 YAML 저장
- `tests/`: parser와 프로필 계약 테스트
