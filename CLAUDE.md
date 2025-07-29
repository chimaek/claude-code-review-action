# Claude AI Code Review Action 구현 가이드

이 문서는 Claude Code를 사용하여 GitHub Actions 기반의 AI 코드 리뷰 시스템을 구현하는 완전한 가이드입니다.

## 📋 프로젝트 개요

**목표**: Claude API를 활용한 자동화된 코드 리뷰 GitHub Action 개발
**기술 스택**: Node.js, GitHub Actions API, Anthropic Claude API
**주요 기능**: PR/Push 이벤트 감지, 코드 분석, AI 리뷰, 자동 댓글 생성

## 🏗 프로젝트 구조

```
claude-code-review-action/
├── action.yml                 # GitHub Action 정의
├── package.json              # Node.js 프로젝트 설정
├── README.md                 # 프로젝트 문서
├── src/
│   ├── index.js             # 메인 엔트리 포인트
│   ├── code-reviewer.js     # Claude API 클라이언트
│   ├── file-analyzer.js     # 파일 분석 로직
│   └── comment-manager.js   # GitHub 댓글 관리
├── scripts/
│   └── build.js             # 빌드 스크립트
├── dist/                    # 빌드 결과물 (자동 생성)
└── tests/                   # 테스트 파일
```

## 🚀 Claude Code 구현 단계

### 1단계: 프로젝트 초기화

```bash
# 새 디렉토리 생성 및 이동
mkdir claude-code-review-action
cd claude-code-review-action

# Git 저장소 초기화
git init

# Node.js 프로젝트 초기화
npm init -y
```

### 2단계: 핵심 파일 생성

#### action.yml 생성
GitHub Action의 메타데이터와 인터페이스를 정의합니다.

```yaml
name: 'Claude AI Code Review'
description: 'AI-powered code review using Claude API for pull requests and commits'
author: 'Your Name'

branding:
  icon: 'eye'
  color: 'purple'

inputs:
  anthropic_api_key:
    description: 'Anthropic API key for Claude'
    required: true
  github_token:
    description: 'GitHub token for posting comments'
    required: true
    default: ${{ github.token }}
  review_type:
    description: 'Type of review: full, security, performance, style'
    required: false
    default: 'full'
  file_patterns:
    description: 'File patterns to review (comma-separated)'
    required: false
    default: '**/*.js,**/*.ts,**/*.jsx,**/*.tsx,**/*.py,**/*.java,**/*.go,**/*.rs'
  exclude_patterns:
    description: 'File patterns to exclude (comma-separated)'
    required: false
    default: '**/node_modules/**,**/dist/**,**/build/**'
  max_files:
    description: 'Maximum number of files to review'
    required: false
    default: '10'
  language:
    description: 'Review language (ko, en, ja, zh)'
    required: false
    default: 'en'
  severity_filter:
    description: 'Minimum severity to report (low, medium, high, critical)'
    required: false
    default: 'medium'

outputs:
  review_summary:
    description: 'Summary of the code review'
  issues_found:
    description: 'Number of issues found'
  files_reviewed:
    description: 'Number of files reviewed'

runs:
  using: 'node20'
  main: 'dist/index.js'
```

#### package.json 설정
프로젝트 의존성과 빌드 스크립트를 정의합니다.

```json
{
  "name": "claude-code-review-action",
  "version": "1.0.0",
  "description": "GitHub Action for AI-powered code review using Claude API",
  "main": "src/index.js",
  "scripts": {
    "build": "ncc build src/index.js -o dist --source-map --license licenses.txt",
    "test": "jest",
    "lint": "eslint src/**/*.js",
    "format": "prettier --write src/**/*.js"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/yourusername/claude-code-review-action.git"
  },
  "keywords": [
    "github-action",
    "code-review",
    "ai",
    "claude",
    "anthropic"
  ],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "@actions/core": "^1.10.1",
    "@actions/github": "^6.0.0",
    "@anthropic-ai/sdk": "^0.24.3",
    "minimatch": "^9.0.3",
    "simple-git": "^3.21.0"
  },
  "devDependencies": {
    "@vercel/ncc": "^0.38.1",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "prettier": "^3.1.1"
  }
}
```

### 3단계: 메인 로직 구현

#### src/index.js - 엔트리 포인트
```javascript
const core = require('@actions/core');
const github = require('@actions/github');
const CodeReviewer = require('./code-reviewer');
const FileAnalyzer = require('./file-analyzer');
const CommentManager = require('./comment-manager');

async function run() {
  try {
    // 입력값 가져오기
    const inputs = {
      anthropicApiKey: core.getInput('anthropic_api_key', { required: true }),
      githubToken: core.getInput('github_token', { required: true }),
      reviewType: core.getInput('review_type') || 'full',
      filePatterns: core.getInput('file_patterns') || '**/*.js,**/*.ts,**/*.jsx,**/*.tsx,**/*.py,**/*.java,**/*.go,**/*.rs',
      excludePatterns: core.getInput('exclude_patterns') || '**/node_modules/**,**/dist/**,**/build/**',
      maxFiles: parseInt(core.getInput('max_files') || '10'),
      language: core.getInput('language') || 'en',
      severityFilter: core.getInput('severity_filter') || 'medium'
    };

    const context = github.context;
    core.info(`Starting code review for ${context.eventName}`);

    // 컴포넌트 초기화
    const fileAnalyzer = new FileAnalyzer(inputs);
    const codeReviewer = new CodeReviewer(inputs.anthropicApiKey, inputs.language);
    const commentManager = new CommentManager(inputs.githubToken, context);

    // 변경된 파일 분석
    const changedFiles = await fileAnalyzer.getChangedFiles(context);
    core.info(`Found ${changedFiles.length} changed files`);

    if (changedFiles.length === 0) {
      core.info('No files to review');
      return;
    }

    // 파일 필터링
    const filesToReview = await fileAnalyzer.filterFiles(changedFiles);
    core.info(`Reviewing ${filesToReview.length} files after filtering`);

    if (filesToReview.length === 0) {
      core.info('No files match the review criteria');
      return;
    }

    let totalIssues = 0;
    const reviewResults = [];

    // 각 파일 리뷰
    for (const file of filesToReview) {
      try {
        core.info(`Reviewing file: ${file.filename}`);
        
        const fileContent = await fileAnalyzer.getFileContent(file);
        const diff = await fileAnalyzer.getFileDiff(file);
        
        const review = await codeReviewer.reviewFile({
          filename: file.filename,
          content: fileContent,
          diff: diff,
          reviewType: inputs.reviewType
        });

        if (review && review.issues.length > 0) {
          const filteredIssues = review.issues.filter(issue => 
            getSeverityLevel(issue.severity) >= getSeverityLevel(inputs.severityFilter)
          );
          
          if (filteredIssues.length > 0) {
            totalIssues += filteredIssues.length;
            reviewResults.push({
              file: file.filename,
              issues: filteredIssues,
              summary: review.summary
            });
          }
        }
      } catch (error) {
        core.warning(`Failed to review file ${file.filename}: ${error.message}`);
      }
    }

    // 리뷰 결과 처리
    if (reviewResults.length > 0) {
      await commentManager.postReviewComment(reviewResults, {
        totalFiles: filesToReview.length,
        totalIssues: totalIssues,
        reviewType: inputs.reviewType
      });
    }

    // 출력값 설정
    core.setOutput('review_summary', generateSummary(reviewResults));
    core.setOutput('issues_found', totalIssues.toString());
    core.setOutput('files_reviewed', filesToReview.length.toString());

    core.info(`Code review completed. Found ${totalIssues} issues in ${filesToReview.length} files`);

  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
    core.error(error.stack);
  }
}

function getSeverityLevel(severity) {
  const levels = { low: 1, medium: 2, high: 3, critical: 4 };
  return levels[severity.toLowerCase()] || 1;
}

function generateSummary(reviewResults) {
  if (reviewResults.length === 0) {
    return 'No issues found in the code review.';
  }

  const totalIssues = reviewResults.reduce((sum, result) => sum + result.issues.length, 0);
  const filesWithIssues = reviewResults.length;
  
  return `Found ${totalIssues} issues across ${filesWithIssues} files. Check the detailed comments for specific recommendations.`;
}

// 액션 실행
if (require.main === module) {
  run();
}

module.exports = run;
```

### 4단계: Claude API 통합

#### src/code-reviewer.js - AI 리뷰어
Claude API와 통신하여 코드 리뷰를 수행하는 핵심 컴포넌트입니다.

```javascript
const Anthropic = require('@anthropic-ai/sdk');

class CodeReviewer {
  constructor(apiKey, language = 'en') {
    this.client = new Anthropic({ apiKey });
    this.language = language;
    this.maxTokens = 4000;
  }

  async reviewFile({ filename, content, diff, reviewType }) {
    const prompt = this.buildPrompt(filename, content, diff, reviewType);
    
    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: this.maxTokens,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      return this.parseResponse(response.content[0].text);
    } catch (error) {
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  buildPrompt(filename, content, diff, reviewType) {
    const basePrompt = this.getBasePrompt(reviewType);
    const languageInstruction = this.getLanguageInstruction();
    
    return `${basePrompt}

${languageInstruction}

파일명: ${filename}

변경 사항 (Git Diff):
\`\`\`diff
${diff}
\`\`\`

전체 파일 내용:
\`\`\`
${content}
\`\`\`

다음 JSON 형식으로 응답해주세요:
{
  "summary": "전체 리뷰 요약",
  "issues": [
    {
      "line": 행번호,
      "severity": "low|medium|high|critical",
      "type": "bug|security|performance|style|maintainability|best-practice",
      "title": "이슈 제목",
      "description": "상세 설명",
      "suggestion": "개선 제안",
      "code_example": "개선된 코드 예시 (선택사항)"
    }
  ],
  "positive_feedback": ["잘 작성된 부분들"],
  "overall_score": 점수(1-10)
}`;
  }

  getBasePrompt(reviewType) {
    const prompts = {
      full: `당신은 경험이 풍부한 시니어 개발자입니다. 다음 코드 변경사항을 종합적으로 리뷰해주세요.

리뷰 관점:
- 코드 품질 및 가독성
- 버그 및 잠재적 문제
- 보안 취약점
- 성능 최적화
- 베스트 프랙티스 준수
- 유지보수성`,

      security: `당신은 보안 전문가입니다. 다음 코드의 보안 취약점을 중점적으로 리뷰해주세요.

리뷰 관점:
- SQL 인젝션, XSS 등 일반적인 취약점
- 인증 및 권한 부여 문제
- 민감한 정보 노출
- 입력 검증 부족
- 암호화 및 해싱 이슈`,

      performance: `당신은 성능 최적화 전문가입니다. 다음 코드의 성능 관련 이슈를 리뷰해주세요.

리뷰 관점:
- 알고리즘 효율성
- 메모리 사용량
- 네트워크 호출 최적화
- 캐싱 전략
- 리소스 관리`,

      style: `당신은 코드 스타일 및 컨벤션 전문가입니다. 다음 코드의 스타일과 일관성을 리뷰해주세요.

리뷰 관점:
- 네이밍 컨벤션
- 코드 포맷팅
- 주석 및 문서화
- 코드 구조
- 일관성`
    };

    return prompts[reviewType] || prompts.full;
  }

  getLanguageInstruction() {
    const instructions = {
      ko: '한국어로 리뷰를 작성해주세요.',
      en: 'Please write the review in English.',
      ja: '日本語でレビューを書いてください。',
      zh: '请用中文写评审。'
    };

    return instructions[this.language] || instructions.en;
  }

  parseResponse(responseText) {
    try {
      // JSON 응답 파싱
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // 응답 검증
      if (!parsed.summary || !Array.isArray(parsed.issues)) {
        throw new Error('Invalid response format');
      }

      return {
        summary: parsed.summary,
        issues: parsed.issues.map(issue => ({
          line: issue.line || null,
          severity: issue.severity || 'medium',
          type: issue.type || 'general',
          title: issue.title || 'Issue found',
          description: issue.description || '',
          suggestion: issue.suggestion || '',
          codeExample: issue.code_example || null
        })),
        positiveFeedback: parsed.positive_feedback || [],
        overallScore: parsed.overall_score || 5
      };
    } catch (error) {
      // JSON 파싱 실패 시 fallback 처리
      return {
        summary: 'Code review completed, but response parsing failed.',
        issues: [{
          line: null,
          severity: 'medium',
          type: 'general',
          title: 'Review Processing Error',
          description: `Failed to parse review response: ${error.message}`,
          suggestion: 'Please check the code manually.',
          codeExample: null
        }],
        positiveFeedback: [],
        overallScore: 5
      };
    }
  }
}

module.exports = CodeReviewer;
```

### 5단계: 파일 분석 및 GitHub 통합

#### src/file-analyzer.js - 파일 분석기
```javascript
const { minimatch } = require('minimatch');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');

class FileAnalyzer {
  constructor(config) {
    this.filePatterns = config.filePatterns.split(',').map(p => p.trim());
    this.excludePatterns = config.excludePatterns.split(',').map(p => p.trim());
    this.maxFiles = config.maxFiles;
    this.git = simpleGit();
  }

  async getChangedFiles(context) {
    try {
      if (context.eventName === 'pull_request') {
        return await this.getPullRequestFiles(context);
      } else if (context.eventName === 'push') {
        return await this.getPushFiles(context);
      }
      return [];
    } catch (error) {
      throw new Error(`Failed to get changed files: ${error.message}`);
    }
  }

  async getPullRequestFiles(context) {
    const { data: files } = await context.octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request.number,
      per_page: 100
    });

    return files.filter(file => 
      file.status !== 'removed' && 
      file.additions + file.deletions > 0
    );
  }

  async getPushFiles(context) {
    try {
      // 최근 커밋과 이전 커밋 비교
      const beforeSha = context.payload.before;
      const afterSha = context.payload.after;

      if (beforeSha === '0000000000000000000000000000000000000000') {
        // 새 브랜치인 경우 HEAD 커밋의 파일들
        const diffSummary = await this.git.diff(['--name-status', 'HEAD~1', 'HEAD']);
        return this.parseDiffOutput(diffSummary);
      } else {
        // 기존 브랜치 업데이트
        const diffSummary = await this.git.diff(['--name-status', beforeSha, afterSha]);
        return this.parseDiffOutput(diffSummary);
      }
    } catch (error) {
      // Git diff 실패 시 fallback
      console.warn('Git diff failed, using alternative method');
      return [];
    }
  }

  async filterFiles(files) {
    const filtered = files.filter(file => {
      // 포함 패턴 체크
      const isIncluded = this.filePatterns.some(pattern => 
        minimatch(file.filename, pattern)
      );

      // 제외 패턴 체크
      const isExcluded = this.excludePatterns.some(pattern => 
        minimatch(file.filename, pattern)
      );

      return isIncluded && !isExcluded;
    });

    // 파일 크기로 정렬 (작은 파일부터)
    const sortedFiles = await this.sortFilesBySize(filtered);
    
    // 최대 파일 수 제한
    return sortedFiles.slice(0, this.maxFiles);
  }

  async getFileContent(file) {
    try {
      const content = await fs.readFile(file.filename, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Cannot read file ${file.filename}: ${error.message}`);
    }
  }

  async getFileDiff(file) {
    try {
      // PR인 경우 베이스 브랜치와 비교
      const diff = await this.git.diff(['HEAD~1', 'HEAD', '--', file.filename]);
      return diff || '';
    } catch (error) {
      console.warn(`Failed to get diff for ${file.filename}: ${error.message}`);
      return '';
    }
  }
}

module.exports = FileAnalyzer;
```

#### src/comment-manager.js - 댓글 관리자
```javascript
const github = require('@actions/github');

class CommentManager {
  constructor(githubToken, context) {
    this.octokit = github.getOctokit(githubToken);
    this.context = context;
  }

  async postReviewComment(reviewResults, metadata) {
    const commentBody = this.buildCommentBody(reviewResults, metadata);

    if (this.context.eventName === 'pull_request') {
      await this.postPullRequestComment(commentBody);
      await this.postInlineComments(reviewResults);
    } else {
      await this.postCommitComment(commentBody);
    }
  }

  buildCommentBody(reviewResults, metadata) {
    const { totalFiles, totalIssues, reviewType } = metadata;
    
    let comment = `## 🤖 Claude AI 코드 리뷰\n\n`;
    comment += `**리뷰 타입:** ${this.getReviewTypeEmoji(reviewType)} ${reviewType}\n`;
    comment += `**검토한 파일:** ${totalFiles}개\n`;
    comment += `**발견된 이슈:** ${totalIssues}개\n\n`;

    if (totalIssues === 0) {
      comment += `### ✅ 훌륭합니다!\n`;
      comment += `리뷰한 코드에서 특별한 이슈를 발견하지 못했습니다. 잘 작성된 코드네요! 👏\n\n`;
    } else {
      comment += `### 📋 리뷰 요약\n\n`;
      
      // 심각도별 통계
      const severityStats = this.getSeverityStats(reviewResults);
      comment += this.buildSeverityTable(severityStats);
      
      // 파일별 상세 리뷰
      comment += `\n### 📁 파일별 상세 리뷰\n\n`;
      
      for (const result of reviewResults) {
        comment += this.buildFileReview(result);
      }
    }

    comment += `\n---\n`;
    comment += `*리뷰 시간: ${new Date().toISOString()}*\n`;
    comment += `*Powered by Claude AI* 🚀`;

    return comment;
  }

  async postPullRequestComment(commentBody) {
    try {
      // 기존 봇 댓글 찾기
      const { data: comments } = await this.octokit.rest.issues.listComments({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        issue_number: this.context.payload.pull_request.number
      });

      const botComment = comments.find(comment => 
        comment.user.type === 'Bot' && 
        comment.body.includes('🤖 Claude AI 코드 리뷰')
      );

      if (botComment) {
        // 기존 댓글 업데이트
        await this.octokit.rest.issues.updateComment({
          owner: this.context.repo.owner,
          repo: this.context.repo.repo,
          comment_id: botComment.id,
          body: commentBody
        });
      } else {
        // 새 댓글 생성
        await this.octokit.rest.issues.createComment({
          owner: this.context.repo.owner,
          repo: this.context.repo.repo,
          issue_number: this.context.payload.pull_request.number,
          body: commentBody
        });
      }
    } catch (error) {
      throw new Error(`Failed to post PR comment: ${error.message}`);
    }
  }
}

module.exports = CommentManager;
```

### 6단계: 빌드 및 배포 설정

#### scripts/build.js - 빌드 스크립트
```javascript
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 Building Claude Code Review Action...');

try {
  // Clean dist folder
  console.log('🧹 Cleaning dist folder...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }

  // Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm ci', { stdio: 'inherit' });

  // Run linting
  console.log('🔍 Running linter...');
  execSync('npm run lint', { stdio: 'inherit' });

  // Build with ncc
  console.log('📦 Building with ncc...');
  execSync('npx @vercel/ncc build src/index.js -o dist --source-map --license licenses.txt', { 
    stdio: 'inherit' 
  });

  // Copy action.yml to dist
  console.log('📋 Copying action.yml...');
  fs.copyFileSync('action.yml', 'dist/action.yml');

  console.log('✅ Build completed successfully!');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
```

### 7단계: 테스트 및 문서화

#### README.md 작성
사용자를 위한 상세한 문서를 작성합니다.

```markdown
# Claude AI Code Review Action

Claude API를 활용한 AI 기반 코드 리뷰 GitHub Action입니다.

## 사용법

```yaml
- uses: your-username/claude-code-review-action@v1
  with:
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    github_token: ${{ secrets.GITHUB_TOKEN }}
    review_type: full
    language: ko
```

## 설정 옵션

- `anthropic_api_key`: Claude API 키 (필수)
- `github_token`: GitHub 토큰 (필수)
- `review_type`: 리뷰 타입 (full, security, performance, style)
- `language`: 리뷰 언어 (ko, en, ja, zh)
- `file_patterns`: 리뷰할 파일 패턴
- `exclude_patterns`: 제외할 파일 패턴
- `max_files`: 최대 리뷰 파일 수
- `severity_filter`: 최소 심각도 필터

## API 키 설정

1. Anthropic Console에서 API 키 발급
2. GitHub 저장소 Settings > Secrets에 `ANTHROPIC_API_KEY` 추가
```

## 🛠 Claude Code 구현 명령어

다음 명령어를 Claude Code에서 순차적으로 실행하세요:

### 1. 프로젝트 구조 생성
```bash
# 프로젝트 디렉토리 생성
mkdir claude-code-review-action
cd claude-code-review-action

# 기본 디렉토리 구조 생성
mkdir -p src scripts tests .github/workflows

# Git 저장소 초기화
git init
```

### 2. 핵심 파일 생성
```bash
# package.json 생성
cat > package.json << 'EOF'
{
  "name": "claude-code-review-action",
  "version": "1.0.0",
  "description": "GitHub Action for AI-powered code review using Claude API",
  "main": "src/index.js",
  "scripts": {
    "build": "ncc build src/index.js -o dist --source-map --license licenses.txt",
    "test": "jest",
    "lint": "eslint src/**/*.js",
    "format": "prettier --write src/**/*.js"
  },
  "dependencies": {
    "@actions/core": "^1.10.1",
    "@actions/github": "^6.0.0",
    "@anthropic-ai/sdk": "^0.24.3",
    "minimatch": "^9.0.3",
    "simple-git": "^3.21.0"
  },
  "devDependencies": {
    "@vercel/ncc": "^0.38.1",
    "eslint": "^8.57.0",
    "jest": "^29.7.0",
    "prettier": "^3.1.1"
  }
}
EOF

# action.yml 생성 (위의 내용 복사)
# src/index.js 생성 (위의 내용 복사)
# src/code-reviewer.js 생성 (위의 내용 복사)
# src/file-analyzer.js 생성 (위의 내용 복사)
# src/comment-manager.js 생성 (위의 내용 복사)
```

### 3. 의존성 설치 및 빌드
```bash
# 의존성 설치
npm install

# 빌드 스크립트 실행
npm run build

# 테스트 실행
npm test
```

### 4. GitHub에 배포
```bash
# 모든 변경사항 커밋
git add .
git commit -m "Initial commit: Claude AI Code Review Action"

# GitHub 저장소에 푸시
git remote add origin https://github.com/yourusername/claude-code-review-action.git
git push -u origin main

# 릴리스 태그 생성
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### 5. 액션 테스트
```bash
# 테스트 워크플로우 파일 생성
cat > .github/workflows/test.yml << 'EOF'
name: Test Action
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: ./
      with:
        anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
        github_token: ${{ secrets.GITHUB_TOKEN }}
        review_type: full
        language: ko
EOF
```

## 🚀 고급 기능 확장

### 1. 캐싱 시스템 추가
```javascript
// 리뷰 결과 캐싱으로 API 호출 최적화
const cache = new Map();
const cacheKey = `${filename}-${contentHash}`;

if (cache.has(cacheKey)) {
  return cache.get(cacheKey);
}
```

### 2. 웹훅 통합
```javascript
// Slack, Discord 등으로 리뷰 결과 알림
const webhook = new WebhookClient(process.env.SLACK_WEBHOOK_URL);
await webhook.send({
  text: `코드 리뷰 완료: ${totalIssues}개 이슈 발견`
});
```

### 3. 대시보드 연동
```javascript
// 메트릭 수집 및 대시보드 전송
const metrics = {
  timestamp: new Date(),
  repository: context.repo,
  issues_found: totalIssues,
  files_reviewed: filesToReview.length
};

await sendMetrics(metrics);
```

## 📋 체크리스트

- [ ] Anthropic API 키 발급 및 설정
- [ ] GitHub 저장소 생성
- [ ] 모든 소스 파일 작성 완료
- [ ] package.json 의존성 설정
- [ ] action.yml 메타데이터 정의
- [ ] 빌드 스크립트 작성
- [ ] README.md 문서 작성
- [ ] 테스트 케이스 작성
- [ ] GitHub Marketplace 배포
- [ ] 사용자 피드백 수집

## 🔧 문제 해결

### API 호출 제한
- 파일 크기 제한 (1MB 이하)
- 동시 요청 수 제한
- 토큰 사용량 모니터링

### 성능 최적화
- 파일 필터링 최적화
- 불필요한 diff 제거
- 캐싱 전략 적용

### 보안 고려사항
- API 키 안전한 저장
- 민감한 정보 로깅 방지
- 권한 최소화 원칙

이 가이드를 따라 Claude Code에서 단계별로 구현하면 완전히 작동하는 GitHub Action을 만들 수 있습니다. 각 단계에서 코드를 테스트하고 필요에 따라 수정하면서 진행하세요.
