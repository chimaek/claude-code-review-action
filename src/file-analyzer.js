/**
 * File Analyzer Module
 * GitHub 리포지토리에서 변경된 파일을 분석하고 필터링하는 모듈
 * 
 * 주요 기능:
 * - PR 및 Push 이벤트에서 변경된 파일 감지
 * - 파일 패턴 기반 필터링
 * - 파일 내용 및 diff 추출
 */

const { minimatch } = require('minimatch');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const path = require('path');
const github = require('@actions/github');

class FileAnalyzer {
  /**
   * FileAnalyzer 생성자
   * @param {Object} config - 설정 객체
   * @param {string} config.filePatterns - 포함할 파일 패턴 (쉼표로 구분)
   * @param {string} config.excludePatterns - 제외할 파일 패턴 (쉼표로 구분)
   * @param {number} config.maxFiles - 최대 리뷰 파일 수
   * @param {string} config.githubToken - GitHub 토큰
   */
  constructor(config) {
    // 파일 패턴을 배열로 변환
    this.filePatterns = config.filePatterns.split(',').map(p => p.trim());
    this.excludePatterns = config.excludePatterns.split(',').map(p => p.trim());
    this.maxFiles = config.maxFiles;
    // Git 작업을 위한 simple-git 인스턴스
    this.git = simpleGit();
    // GitHub API 클라이언트 생성
    this.octokit = github.getOctokit(config.githubToken);
  }

  /**
   * GitHub 이벤트에 따라 변경된 파일 목록 가져오기
   * @param {Object} context - GitHub 액션 컨텍스트
   * @returns {Promise<Array>} 변경된 파일 목록
   */
  async getChangedFiles(context) {
    try {
      // 이벤트 타입에 따라 다른 방식으로 파일 목록 가져오기
      if (context.eventName === 'pull_request') {
        // PR 이벤트: GitHub API를 통해 파일 목록 가져오기
        return await this.getPullRequestFiles(context);
      } else if (context.eventName === 'push') {
        // Push 이벤트: Git diff를 통해 파일 목록 가져오기
        return await this.getPushFiles(context);
      }
      return [];
    } catch (error) {
      throw new Error(`Failed to get changed files: ${error.message}`);
    }
  }

  /**
   * Pull Request에서 변경된 파일 목록 가져오기
   * @param {Object} context - GitHub 액션 컨텍스트
   * @returns {Promise<Array>} PR에서 변경된 파일 목록
   */
  async getPullRequestFiles(context) {
    // GitHub REST API를 사용하여 PR 파일 목록 조회
    const { data: files } = await this.octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request.number,
      per_page: 100 // 한 번에 가져올 최대 파일 수
    });

    // 삭제된 파일은 제외하고, 실제 변경사항이 있는 파일만 반환
    return files.filter(file => 
      file.status !== 'removed' && 
      file.additions + file.deletions > 0
    );
  }

  /**
   * Push 이벤트에서 변경된 파일 목록 가져오기
   * @param {Object} context - GitHub 액션 컨텍스트
   * @returns {Promise<Array>} Push에서 변경된 파일 목록
   */
  async getPushFiles(context) {
    try {
      // Push 이벤트에서 제공하는 before/after 커밋 SHA
      const beforeSha = context.payload.before;
      const afterSha = context.payload.after;

      // 새 브랜치 생성인 경우 (before가 null 커밋)
      if (beforeSha === '0000000000000000000000000000000000000000') {
        // HEAD 커밋과 이전 커밋 비교
        const diffSummary = await this.git.diff(['--name-status', 'HEAD~1', 'HEAD']);
        return this.parseDiffOutput(diffSummary);
      } else {
        // 기존 브랜치에 푸시: before와 after 커밋 비교
        const diffSummary = await this.git.diff(['--name-status', beforeSha, afterSha]);
        return this.parseDiffOutput(diffSummary);
      }
    } catch (error) {
      // Git diff 실패 시 빈 배열 반환 (액션 실패 방지)
      console.warn('Git diff failed, using alternative method');
      return [];
    }
  }

  /**
   * Git diff 출력을 파싱하여 파일 정보 배열로 변환
   * @param {string} diffOutput - git diff --name-status 출력
   * @returns {Array} 파일 정보 배열
   */
  parseDiffOutput(diffOutput) {
    const files = [];
    const lines = diffOutput.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Git diff 형식: "M\tfilename" 또는 "A\tfilename" 등
      const [status, filename] = line.split('\t');
      
      // 삭제된 파일은 제외
      if (status !== 'D' && filename) {
        files.push({
          filename: filename.trim(),
          status: this.mapGitStatus(status),
          additions: 0, // Push 이벤트에서는 정확한 수치를 알 수 없음
          deletions: 0
        });
      }
    }

    return files;
  }

  /**
   * Git 상태 코드를 GitHub API 형식으로 매핑
   * @param {string} gitStatus - Git 상태 코드 (A, M, R 등)
   * @returns {string} GitHub API 상태
   */
  mapGitStatus(gitStatus) {
    const statusMap = {
      'A': 'added',
      'M': 'modified',
      'R': 'renamed',
      'C': 'copied',
      'T': 'changed',
      'U': 'updated'
    };
    return statusMap[gitStatus] || 'modified';
  }

  /**
   * 파일 목록을 패턴에 따라 필터링
   * @param {Array} files - 전체 파일 목록
   * @returns {Promise<Array>} 필터링된 파일 목록
   */
  async filterFiles(files) {
    // 1. 패턴 기반 필터링
    const patternFiltered = files.filter(file => {
      // 포함 패턴 체크: 하나라도 매치되면 포함
      const isIncluded = this.filePatterns.some(pattern => 
        minimatch(file.filename, pattern)
      );

      // 제외 패턴 체크: 하나라도 매치되면 제외
      const isExcluded = this.excludePatterns.some(pattern => 
        minimatch(file.filename, pattern)
      );

      return isIncluded && !isExcluded;
    });

    // 2. 파일 크기 및 복잡도 필터링 (속도 개선)
    const sizeFiltered = await this.filterByFileSize(patternFiltered);
    
    // 3. 파일 크기로 정렬 (작은 파일부터 리뷰)
    const sortedFiles = await this.sortFilesBySize(sizeFiltered);
    
    // 4. 최대 파일 수 제한 적용
    return sortedFiles.slice(0, this.maxFiles);
  }

  /**
   * 파일 크기 기반 필터링 (너무 큰 파일 제외로 속도 개선)
   * @param {Array} files - 파일 목록
   * @returns {Promise<Array>} 크기 필터링된 파일 목록
   */
  async filterByFileSize(files) {
    const MAX_FILE_SIZE = 100 * 1024; // 100KB 제한
    const MIN_FILE_SIZE = 10; // 10 bytes 이상
    
    const sizeCheckedFiles = await Promise.all(
      files.map(async (file) => {
        try {
          const stats = await fs.stat(file.filename);
          
          // 너무 크거나 작은 파일 제외
          if (stats.size > MAX_FILE_SIZE) {
            console.warn(`Skipping large file: ${file.filename} (${stats.size} bytes)`);
            return null;
          }
          
          if (stats.size < MIN_FILE_SIZE) {
            console.warn(`Skipping tiny file: ${file.filename} (${stats.size} bytes)`);
            return null;
          }
          
          return { ...file, size: stats.size };
        } catch (error) {
          console.warn(`Cannot access file: ${file.filename}`);
          return null;
        }
      })
    );

    return sizeCheckedFiles.filter(file => file !== null);
  }

  /**
   * 파일 크기에 따라 정렬 (작은 파일부터)
   * @param {Array} files - 파일 목록
   * @returns {Promise<Array>} 정렬된 파일 목록
   */
  async sortFilesBySize(files) {
    // 각 파일의 크기 정보 추가
    const filesWithSize = await Promise.all(
      files.map(async (file) => {
        try {
          const stats = await fs.stat(file.filename);
          return { ...file, size: stats.size };
        } catch (error) {
          // 파일을 읽을 수 없는 경우 최대 크기로 설정 (나중에 처리)
          return { ...file, size: Number.MAX_SAFE_INTEGER };
        }
      })
    );

    // 크기 순으로 정렬
    return filesWithSize.sort((a, b) => a.size - b.size);
  }

  /**
   * 파일 내용 읽기
   * @param {Object} file - 파일 정보 객체
   * @returns {Promise<string>} 파일 내용
   */
  async getFileContent(file) {
    try {
      // UTF-8 인코딩으로 파일 읽기
      const content = await fs.readFile(file.filename, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Cannot read file ${file.filename}: ${error.message}`);
    }
  }

  /**
   * 파일의 Git diff 가져오기
   * @param {Object} file - 파일 정보 객체
   * @returns {Promise<string>} Git diff 내용
   */
  async getFileDiff(file) {
    try {
      // HEAD와 이전 커밋 간의 특정 파일 diff
      const diff = await this.git.diff(['HEAD~1', 'HEAD', '--', file.filename]);
      return diff || '';
    } catch (error) {
      // diff 실패 시 빈 문자열 반환 (리뷰는 계속 진행)
      console.warn(`Failed to get diff for ${file.filename}: ${error.message}`);
      return '';
    }
  }
}

module.exports = FileAnalyzer;