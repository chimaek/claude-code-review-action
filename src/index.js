/**
 * Claude AI Code Review Action
 * 메인 엔트리 포인트 - GitHub Action의 시작점
 * 
 * 이 파일은 다음 작업을 수행합니다:
 * 1. GitHub Action 입력값 파싱
 * 2. 변경된 파일 감지 및 필터링
 * 3. Claude AI를 통한 코드 리뷰 실행
 * 4. GitHub PR/Commit에 리뷰 결과 댓글 작성
 */

const core = require('@actions/core');
const github = require('@actions/github');
const CodeReviewer = require('./code-reviewer');
const FileAnalyzer = require('./file-analyzer');
const CommentManager = require('./comment-manager');

/**
 * 메인 실행 함수
 * GitHub Action이 실행될 때 호출되는 진입점
 */
async function run() {
  try {
    // 1. 액션 입력값 수집
    // core.getInput()을 통해 action.yml에 정의된 입력값들을 가져옵니다
    console.log('Raw inputs from GitHub Action:');
    console.log('file_patterns input:', core.getInput('file_patterns'));
    console.log('exclude_patterns input:', core.getInput('exclude_patterns'));
    
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
    
    console.log('Final inputs used:', {
      filePatterns: inputs.filePatterns,
      excludePatterns: inputs.excludePatterns
    });

    // GitHub 컨텍스트 정보 가져오기
    // PR 정보, 커밋 정보, 리포지토리 정보 등이 포함됨
    const context = github.context;
    core.info(`Starting code review for ${context.eventName}`);

    // 2. 필요한 컴포넌트 초기화
    const fileAnalyzer = new FileAnalyzer({
      ...inputs,
      githubToken: inputs.githubToken
    });
    const codeReviewer = new CodeReviewer(inputs.anthropicApiKey, inputs.language);
    const commentManager = new CommentManager(inputs.githubToken, context);

    // 3. 변경된 파일 목록 가져오기
    // PR이나 Push에서 변경된 파일들을 감지
    const changedFiles = await fileAnalyzer.getChangedFiles(context);
    core.info(`Found ${changedFiles.length} changed files`);

    // 변경된 파일이 없으면 조기 종료
    if (changedFiles.length === 0) {
      core.info('No files to review');
      return;
    }

    // 4. 파일 필터링
    // 설정된 패턴에 맞는 파일만 선택하고, 제외 패턴 적용
    const filesToReview = await fileAnalyzer.filterFiles(changedFiles);
    core.info(`Reviewing ${filesToReview.length} files after filtering`);

    if (filesToReview.length === 0) {
      core.info('No files match the review criteria');
      return;
    }

    // 리뷰 결과 저장 변수
    let totalIssues = 0;
    const reviewResults = [];

    // 5. 병렬로 각 파일에 대해 AI 리뷰 실행 (속도 개선)
    core.info(`Starting parallel review of ${filesToReview.length} files...`);
    
    const reviewPromises = filesToReview.map(async (file) => {
      try {
        core.info(`Reviewing file: ${file.filename}`);
        
        // 파일 내용과 diff를 병렬로 가져오기
        const [fileContent, diff] = await Promise.all([
          fileAnalyzer.getFileContent(file),
          fileAnalyzer.getFileDiff(file)
        ]);
        
        // Claude AI를 통한 코드 리뷰 실행
        const review = await codeReviewer.reviewFile({
          filename: file.filename,
          content: fileContent,
          diff: diff,
          reviewType: inputs.reviewType
        });

        // 리뷰 결과 처리 및 필터링
        if (review && review.issues.length > 0) {
          // 설정된 심각도 이상의 이슈만 필터링
          const filteredIssues = review.issues.filter(issue => 
            getSeverityLevel(issue.severity) >= getSeverityLevel(inputs.severityFilter)
          );
          
          if (filteredIssues.length > 0) {
            return {
              file: file.filename,
              issues: filteredIssues,
              summary: review.summary
            };
          }
        }
        
        return null;
      } catch (error) {
        // 개별 파일 리뷰 실패 시 경고만 출력하고 계속 진행
        core.warning(`Failed to review file ${file.filename}: ${error.message}`);
        return null;
      }
    });

    // 모든 리뷰 완료까지 대기
    const parallelResults = await Promise.all(reviewPromises);
    
    // null이 아닌 결과만 수집
    parallelResults.forEach(result => {
      if (result) {
        totalIssues += result.issues.length;
        reviewResults.push(result);
      }
    });

    // 6. 리뷰 결과를 GitHub에 댓글로 작성
    if (reviewResults.length > 0) {
      await commentManager.postReviewComment(reviewResults, {
        totalFiles: filesToReview.length,
        totalIssues: totalIssues,
        reviewType: inputs.reviewType
      });
    }

    // 7. 액션 출력값 설정
    // 다른 액션이나 워크플로우에서 사용할 수 있는 출력값
    core.setOutput('review_summary', generateSummary(reviewResults));
    core.setOutput('issues_found', totalIssues.toString());
    core.setOutput('files_reviewed', filesToReview.length.toString());

    core.info(`Code review completed. Found ${totalIssues} issues in ${filesToReview.length} files`);

  } catch (error) {
    // 전체 액션 실패 처리
    core.setFailed(`Action failed: ${error.message}`);
    core.error(error.stack);
  }
}

/**
 * 심각도 레벨을 숫자로 변환
 * @param {string} severity - 심각도 문자열 (low, medium, high, critical)
 * @returns {number} 심각도 레벨 (1-4)
 */
function getSeverityLevel(severity) {
  const levels = { 
    low: 1, 
    medium: 2, 
    high: 3, 
    critical: 4 
  };
  return levels[severity.toLowerCase()] || 1;
}

/**
 * 리뷰 결과 요약 생성
 * @param {Array} reviewResults - 리뷰 결과 배열
 * @returns {string} 요약 문자열
 */
function generateSummary(reviewResults) {
  if (reviewResults.length === 0) {
    return 'No issues found in the code review.';
  }

  const totalIssues = reviewResults.reduce((sum, result) => sum + result.issues.length, 0);
  const filesWithIssues = reviewResults.length;
  
  return `Found ${totalIssues} issues across ${filesWithIssues} files. Check the detailed comments for specific recommendations.`;
}

// 이 파일이 직접 실행될 때만 run() 함수 호출
// 테스트 시에는 실행되지 않도록 함
if (require.main === module) {
  run();
}

// 테스트를 위해 run 함수 export
module.exports = run;