# Claude AI Code Review Action

[![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-blue.svg?logo=github-actions)](https://github.com/chimaek/claude-code-review-action)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.1-green.svg)](https://github.com/chimaek/claude-code-review-action/releases)

Claude API를 활용한 지능형 AI 코드 리뷰 GitHub Action입니다. Pull Request와 Push 이벤트에서 자동으로 코드를 분석하고 개선 사항을 제안합니다.

## 🌟 주요 기능

- **🤖 AI 기반 코드 리뷰**: Claude AI가 코드 품질, 버그, 보안 취약점 등을 자동 검토
- **🌍 다국어 지원**: 한국어, 영어, 일본어, 중국어 리뷰 지원
- **🎯 맞춤형 리뷰**: 전체, 보안, 성능, 스타일 등 다양한 리뷰 타입 선택 가능
- **📊 상세한 리포트**: 심각도별 분류, 파일별 상세 리뷰, 개선 제안 포함
- **💬 GitHub 통합**: PR 댓글 자동 작성 (안정성 개선)
- **⚡ 고성능**: 병렬 처리로 2-3배 빠른 리뷰 속도 (v1.0.1+)

## 📸 스크린샷

### PR 리뷰 댓글 예시

```markdown
## 🤖 Claude AI 코드 리뷰

**리뷰 타입:** 🔍 full  
**검토한 파일:** 3개  
**발견된 이슈:** 12개

### 📋 리뷰 요약

| 심각도 | 개수 | 설명 |
|--------|------|------|
| 🔴 **Critical** | 2 | 즉시 수정이 필요한 심각한 문제 |
| 🟠 **High** | 4 | 중요한 문제, 빠른 수정 권장 |
| 🟡 **Medium** | 6 | 일반적인 개선 사항 |

### 📁 파일별 상세 리뷰

... (상세한 이슈 목록)
```

![PR Review Comment](https://github.com/chimaek/claude-code-review-action/blob/master/examples/images/pr_example.png)

## 🚀 빠른 시작

### 1. Anthropic API 키 발급

1. [Anthropic Console](https://console.anthropic.com)에 접속
2. API Keys 섹션에서 새 API 키 생성
3. 생성된 키를 안전하게 보관

### 2. GitHub Secret 설정

1. GitHub 리포지토리의 Settings → Secrets and variables → Actions로 이동
2. "New repository secret" 클릭
3. Name: `ANTHROPIC_API_KEY`, Value: 발급받은 API 키 입력
4. "Add secret" 클릭

### 3. 워크플로우 설정

`.github/workflows/code-review.yml` 파일을 생성하고 다음 내용을 추가:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [ opened, synchronize ]
  push:
    branches: [ develop, feature/* ]  # master 브랜치는 제외 (선택사항)

jobs:
  review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
      repository-projects: read

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Claude AI Code Review
        uses: chimaek/claude-code-review-action@master
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          review_type: full
          language: ko
          max_files: 8
          severity_filter: medium
```

## 📋 설정 옵션

### 필수 입력값

| 입력값                 | 설명                | 필수 |
|---------------------|-------------------|----|
| `anthropic_api_key` | Anthropic API 키   | ✅  |
| `github_token`      | GitHub 토큰 (자동 제공) | ✅  |

### 선택적 입력값

| 입력값                | 설명                                                 | 기본값                                                                   |
|--------------------|----------------------------------------------------|-----------------------------------------------------------------------|
| `review_type`      | 리뷰 타입 (`full`, `security`, `performance`, `style`) | `full`                                                                |
| `language`         | 리뷰 언어 (`ko`, `en`, `ja`, `zh`)                     | `en`                                                                  |
| `file_patterns`    | 리뷰할 파일 패턴 (쉼표 구분)                                  | `**/*.js,**/*.ts,**/*.jsx,**/*.tsx,**/*.py,**/*.java,**/*.go,**/*.rs` |
| `exclude_patterns` | 제외할 파일 패턴 (쉼표 구분)                                  | `**/node_modules/**,**/dist/**,**/build/**`                           |
| `max_files`        | 최대 리뷰 파일 수                                         | `8`                                                                   |
| `severity_filter`  | 최소 심각도 필터 (`low`, `medium`, `high`, `critical`)    | `medium`                                                              |

### 출력값

| 출력값              | 설명       |
|------------------|----------|
| `review_summary` | 리뷰 요약    |
| `issues_found`   | 발견된 이슈 수 |
| `files_reviewed` | 리뷰한 파일 수 |

## 📖 사용 예시

### 기본 사용

```yaml
- uses: chimaek/claude-code-review-action@master
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### 보안 중심 리뷰

```yaml
- uses: chimaek/claude-code-review-action@master
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
    review_type: security
    severity_filter: low
    max_files: 10
```

### 특정 파일만 리뷰

```yaml
- uses: chimaek/claude-code-review-action@master
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
    file_patterns: "src/**/*.js,lib/**/*.js"
    exclude_patterns: "**/*.test.js,**/*.spec.js,**/node_modules/**"
```

### 한국어 고성능 리뷰 (권장)

```yaml
- uses: chimaek/claude-code-review-action@master
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
    language: ko
    review_type: full
    max_files: 8
    severity_filter: medium
```

## 📈 버전 히스토리

### v1.0.1 (2025-07-29) - 성능 개선 릴리즈

🚀 **주요 개선사항:**

- **병렬 파일 처리**: 여러 파일을 동시에 분석하여 **2-3배 속도 개선**
- **파일 크기 필터링**: 100KB 초과 파일 자동 제외로 안정성 향상
- **Claude API 최적화**: 토큰 수 2K로 제한, 파일 내용 5KB로 절삭하여 응답 속도 개선
- **octokit 오류 수정**: GitHub API 클라이언트 초기화 문제 해결
- **인라인 댓글 제거**: GitHub API 제약으로 인한 오류 방지, PR 댓글로 통합

### v1.0.0 (2025-07-29) - 초기 릴리즈

✨ **기본 기능:**

- Claude AI 기반 코드 리뷰
- 다국어 지원 (한국어, 영어, 일본어, 중국어)
- 다양한 리뷰 타입 (전체, 보안, 성능, 스타일)
- GitHub PR/Push 이벤트 통합

## 🔧 고급 설정

### 리뷰 타입별 특징

#### `full` (전체 리뷰)

- 코드 품질, 버그, 보안, 성능, 스타일 모두 검토
- 가장 포괄적인 리뷰 제공
- 일반적인 용도에 추천

#### `security` (보안 리뷰)

- SQL 인젝션, XSS 등 보안 취약점 집중 검토
- 인증/권한, 암호화 이슈 확인
- 민감한 정보 노출 감지

#### `performance` (성능 리뷰)

- 알고리즘 효율성 분석
- 메모리 사용량 최적화 제안
- 캐싱 전략 추천

#### `style` (스타일 리뷰)

- 코드 일관성 확인
- 네이밍 컨벤션 검토
- 가독성 개선 제안

### 파일 패턴 예시

```yaml
# JavaScript/TypeScript 프로젝트
file_patterns: "**/*.{js,jsx,ts,tsx}"
exclude_patterns: "**/node_modules/**,**/dist/**,**/*.test.js,**/*.spec.js"

# Python 프로젝트  
file_patterns: "**/*.py"
exclude_patterns: "**/venv/**,**/__pycache__/**,**/test_*.py"

# 다중 언어 프로젝트
file_patterns: "**/*.{js,py,go,java}"
exclude_patterns: "**/node_modules/**,**/target/**,**/build/**"

# 특정 디렉토리만
file_patterns: "src/**/*.js,lib/**/*.js"
exclude_patterns: "**/*.min.js,**/bundle.js"
```

### 권장 워크플로우 설정

```yaml
name: AI Code Review

on:
  pull_request:
    types: [ opened, synchronize, reopened ]
  push:
    branches: [ develop, feature/* ]
    # master/main 브랜치는 제외 (배포용)

jobs:
  code-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
      repository-projects: read

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Claude AI Code Review
        uses: chimaek/claude-code-review-action@master
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          review_type: full
          language: ko
          max_files: 8
          severity_filter: medium
          file_patterns: "src/**/*.{js,ts,jsx,tsx,py}"
          exclude_patterns: "**/*.test.*,**/*.spec.*,**/node_modules/**"
        continue-on-error: true  # 리뷰 실패해도 CI 통과
```

## 🚧 문제 해결

### API 키 관련

**문제**: "Invalid API key" 에러

- API 키가 올바른지 확인
- Secret 이름이 정확한지 확인 (`ANTHROPIC_API_KEY`)
- API 키에 충분한 크레딧이 있는지 확인

### 권한 관련

**문제**: "Resource not accessible by integration" 에러

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write                    # 커밋 댓글 작성용
  repository-projects: read        # GitHub API 접근용
```

워크플로우에 위 권한 설정 추가 (특히 Push 이벤트 시 필요)

### 파일 크기 제한

**문제**: 큰 파일 리뷰 실패

- 단일 파일 크기 제한: **100KB** (v1.0.1+에서 자동 필터링)
- 파일 내용 5KB로 자동 절삭 (성능 최적화)
- `max_files` 값을 8 이하로 설정 권장

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 🙏 감사의 말

- [Anthropic](https://www.anthropic.com) - Claude AI API 제공
- [GitHub Actions](https://github.com/features/actions) - CI/CD 플랫폼
- 모든 기여자와 사용자 여러분

## 📞 지원

- 이슈 리포트: [GitHub Issues](https://github.com/chimaek/claude-code-review-action/issues)
- 실제 동작 확인: [Actions 탭](https://github.com/chimaek/claude-code-review-action/actions)
- 소스 코드: [GitHub Repository](https://github.com/chimaek/claude-code-review-action)
- 이메일: pipiru100@gmail.com

## 🔍 리뷰 결과 확인 방법

### Pull Request의 경우

- PR 댓글에 자동으로 리뷰 결과가 작성됩니다

### Push의 경우

- 해당 커밋 페이지에서 댓글로 리뷰 결과 확인
- 예시: `https://github.com/your-repo/commit/커밋해시`

### Actions 로그

- `Actions` 탭 → `AI Code Review` 워크플로우에서 실행 로그 확인

---

Made with ❤️ by [chimaek](https://github.com/chimaek)