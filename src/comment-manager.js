/**
 * Comment Manager Module
 * GitHub PR 및 Commit에 코드 리뷰 댓글을 작성하는 모듈
 * 
 * 주요 기능:
 * - PR 댓글 작성 및 업데이트
 * - 인라인 코드 댓글 작성
 * - 리뷰 결과 포맷팅
 * - 심각도별 이모지 및 색상 지원
 */

const github = require('@actions/github');

class CommentManager {
  /**
   * CommentManager 생성자
   * @param {string} githubToken - GitHub API 접근 토큰
   * @param {Object} context - GitHub Actions 컨텍스트
   */
  constructor(githubToken, context) {
    // GitHub API 클라이언트 초기화
    this.octokit = github.getOctokit(githubToken);
    this.context = context;
  }

  /**
   * 리뷰 결과를 GitHub에 댓글로 작성
   * @param {Array} reviewResults - 파일별 리뷰 결과 배열
   * @param {Object} metadata - 리뷰 메타데이터
   */
  async postReviewComment(reviewResults, metadata) {
    // 리뷰 댓글 본문 생성
    const commentBody = this.buildCommentBody(reviewResults, metadata);

    // 이벤트 타입에 따라 다른 방식으로 댓글 작성
    if (this.context.eventName === 'pull_request') {
      // PR인 경우: 일반 댓글과 인라인 댓글 모두 작성
      await this.postPullRequestComment(commentBody);
      await this.postInlineComments(reviewResults);
    } else {
      // Push인 경우: 커밋 댓글만 작성
      await this.postCommitComment(commentBody);
    }
  }

  /**
   * 리뷰 결과를 보기 좋은 형식으로 포맷팅
   * @param {Array} reviewResults - 리뷰 결과 배열
   * @param {Object} metadata - 메타데이터
   * @returns {string} 포맷팅된 댓글 본문
   */
  buildCommentBody(reviewResults, metadata) {
    const { totalFiles, totalIssues, reviewType } = metadata;
    
    // 댓글 헤더
    let comment = `## 🤖 Claude AI 코드 리뷰\n\n`;
    comment += `**리뷰 타입:** ${this.getReviewTypeEmoji(reviewType)} ${reviewType}\n`;
    comment += `**검토한 파일:** ${totalFiles}개\n`;
    comment += `**발견된 이슈:** ${totalIssues}개\n\n`;

    // 이슈가 없는 경우
    if (totalIssues === 0) {
      comment += `### ✅ 훌륭합니다!\n`;
      comment += `리뷰한 코드에서 특별한 이슈를 발견하지 못했습니다. 잘 작성된 코드네요! 👏\n\n`;
    } else {
      // 이슈가 있는 경우
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

    // 댓글 푸터
    comment += `\n---\n`;
    comment += `*리뷰 시간: ${new Date().toISOString()}*\n`;
    comment += `*Powered by Claude AI* 🚀`;

    return comment;
  }

  /**
   * 리뷰 타입별 이모지 반환
   * @param {string} reviewType - 리뷰 타입
   * @returns {string} 이모지
   */
  getReviewTypeEmoji(reviewType) {
    const emojis = {
      full: '🔍',
      security: '🔒',
      performance: '⚡',
      style: '🎨'
    };
    return emojis[reviewType] || '🔍';
  }

  /**
   * 심각도별 통계 계산
   * @param {Array} reviewResults - 리뷰 결과
   * @returns {Object} 심각도별 카운트
   */
  getSeverityStats(reviewResults) {
    const stats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    reviewResults.forEach(result => {
      result.issues.forEach(issue => {
        stats[issue.severity] = (stats[issue.severity] || 0) + 1;
      });
    });

    return stats;
  }

  /**
   * 심각도 통계 테이블 생성
   * @param {Object} stats - 심각도별 통계
   * @returns {string} 마크다운 테이블
   */
  buildSeverityTable(stats) {
    let table = `| 심각도 | 개수 | 설명 |\n`;
    table += `|--------|------|------|\n`;
    
    if (stats.critical > 0) {
      table += `| 🔴 **Critical** | ${stats.critical} | 즉시 수정이 필요한 심각한 문제 |\n`;
    }
    if (stats.high > 0) {
      table += `| 🟠 **High** | ${stats.high} | 중요한 문제, 빠른 수정 권장 |\n`;
    }
    if (stats.medium > 0) {
      table += `| 🟡 **Medium** | ${stats.medium} | 일반적인 개선 사항 |\n`;
    }
    if (stats.low > 0) {
      table += `| 🟢 **Low** | ${stats.low} | 선택적 개선 사항 |\n`;
    }

    return table;
  }

  /**
   * 파일별 리뷰 내용 생성
   * @param {Object} result - 파일 리뷰 결과
   * @returns {string} 포맷팅된 리뷰 내용
   */
  buildFileReview(result) {
    let review = `<details>\n`;
    review += `<summary><b>📄 ${result.file}</b> (${result.issues.length}개 이슈)</summary>\n\n`;
    
    // 파일 요약
    if (result.summary) {
      review += `> ${result.summary}\n\n`;
    }

    // 각 이슈 상세 내용
    result.issues.forEach((issue, index) => {
      review += this.buildIssueBlock(issue, index + 1);
    });

    review += `</details>\n\n`;
    return review;
  }

  /**
   * 개별 이슈 블록 생성
   * @param {Object} issue - 이슈 정보
   * @param {number} index - 이슈 번호
   * @returns {string} 포맷팅된 이슈 블록
   */
  buildIssueBlock(issue) {
    const severityEmoji = this.getSeverityEmoji(issue.severity);
    const typeEmoji = this.getTypeEmoji(issue.type);
    
    let block = `#### ${severityEmoji} ${issue.title}\n`;
    block += `**타입:** ${typeEmoji} ${issue.type} | `;
    block += `**심각도:** ${issue.severity}`;
    
    if (issue.line) {
      block += ` | **라인:** ${issue.line}`;
    }
    block += `\n\n`;

    // 설명
    if (issue.description) {
      block += `**문제점:**\n${issue.description}\n\n`;
    }

    // 개선 제안
    if (issue.suggestion) {
      block += `**개선 방안:**\n${issue.suggestion}\n\n`;
    }

    // 코드 예시
    if (issue.codeExample) {
      block += `**예시 코드:**\n\`\`\`\n${issue.codeExample}\n\`\`\`\n\n`;
    }

    block += `---\n\n`;
    return block;
  }

  /**
   * 심각도별 이모지 반환
   * @param {string} severity - 심각도
   * @returns {string} 이모지
   */
  getSeverityEmoji(severity) {
    const emojis = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };
    return emojis[severity] || '🔵';
  }

  /**
   * 이슈 타입별 이모지 반환
   * @param {string} type - 이슈 타입
   * @returns {string} 이모지
   */
  getTypeEmoji(type) {
    const emojis = {
      bug: '🐛',
      security: '🔒',
      performance: '⚡',
      style: '🎨',
      maintainability: '🔧',
      'best-practice': '📚'
    };
    return emojis[type] || '📝';
  }

  /**
   * Pull Request에 댓글 작성
   * @param {string} commentBody - 댓글 본문
   */
  async postPullRequestComment(commentBody) {
    try {
      // 기존 봇 댓글 찾기 (중복 방지)
      const { data: comments } = await this.octokit.rest.issues.listComments({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        issue_number: this.context.payload.pull_request.number
      });

      // 이전에 작성한 봇 댓글 찾기
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

  /**
   * 인라인 코드 댓글 작성
   * @param {Array} reviewResults - 리뷰 결과
   */
  async postInlineComments(reviewResults) {
    try {
      // PR 리뷰 생성
      const review = await this.octokit.rest.pulls.createReview({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        pull_number: this.context.payload.pull_request.number,
        event: 'COMMENT',
        body: 'Claude AI가 코드를 검토했습니다. 아래 인라인 댓글을 확인해주세요.',
        comments: this.buildInlineComments(reviewResults)
      });

      return review;
    } catch (error) {
      // 인라인 댓글 실패는 무시 (메인 댓글이 더 중요)
      console.warn(`Failed to post inline comments: ${error.message}`);
    }
  }

  /**
   * 인라인 댓글 배열 생성
   * @param {Array} reviewResults - 리뷰 결과
   * @returns {Array} GitHub API 형식의 인라인 댓글 배열
   */
  buildInlineComments(reviewResults) {
    const comments = [];

    reviewResults.forEach(result => {
      result.issues.forEach(issue => {
        // 라인 번호가 있는 이슈만 인라인 댓글로 생성
        if (issue.line && issue.line > 0) {
          comments.push({
            path: result.file,
            line: issue.line,
            body: this.buildInlineCommentBody(issue)
          });
        }
      });
    });

    return comments;
  }

  /**
   * 인라인 댓글 본문 생성
   * @param {Object} issue - 이슈 정보
   * @returns {string} 인라인 댓글 본문
   */
  buildInlineCommentBody(issue) {
    const severityEmoji = this.getSeverityEmoji(issue.severity);
    let body = `${severityEmoji} **${issue.title}**\n\n`;
    
    if (issue.description) {
      body += `${issue.description}\n\n`;
    }
    
    if (issue.suggestion) {
      body += `💡 **제안:** ${issue.suggestion}`;
    }

    return body;
  }

  /**
   * 커밋에 댓글 작성 (Push 이벤트용)
   * @param {string} commentBody - 댓글 본문
   */
  async postCommitComment(commentBody) {
    try {
      await this.octokit.rest.repos.createCommitComment({
        owner: this.context.repo.owner,
        repo: this.context.repo.repo,
        commit_sha: this.context.sha,
        body: commentBody
      });
    } catch (error) {
      throw new Error(`Failed to post commit comment: ${error.message}`);
    }
  }
}

module.exports = CommentManager;