/**
 * Claude AI Code Reviewer
 * Claude API와 통신하여 실제 코드 리뷰를 수행하는 모듈
 * 
 * 주요 기능:
 * - Claude API 클라이언트 초기화
 * - 코드 리뷰 프롬프트 생성
 * - AI 응답 파싱 및 구조화
 * - 다국어 지원
 */

const Anthropic = require('@anthropic-ai/sdk');

class CodeReviewer {
  /**
   * CodeReviewer 생성자
   * @param {string} apiKey - Anthropic API 키
   * @param {string} language - 리뷰 언어 (ko, en, ja, zh)
   */
  constructor(apiKey, language = 'en') {
    // Claude API 클라이언트 초기화
    this.client = new Anthropic({ apiKey });
    this.language = language;
    this.maxTokens = 4000; // Claude 응답 최대 토큰 수 (JSON 완성도 향상)
  }

  /**
   * 파일에 대한 코드 리뷰 실행
   * @param {Object} params - 리뷰 파라미터
   * @param {string} params.filename - 파일명
   * @param {string} params.content - 파일 전체 내용
   * @param {string} params.diff - Git diff 내용
   * @param {string} params.reviewType - 리뷰 타입 (full, security, performance, style)
   * @returns {Promise<Object>} 파싱된 리뷰 결과
   */
  async reviewFile({ filename, content, diff, reviewType }) {
    // 리뷰 프롬프트 생성
    const prompt = this.buildPrompt(filename, content, diff, reviewType);
    
    try {
      // Claude API 호출
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514', // 코드 분석에 적합한 모델
        max_tokens: this.maxTokens,
        temperature: 0.1, // 일관성 있는 응답을 위해 낮은 temperature 사용
        system: "You are a senior code reviewer. Always respond with ONLY valid JSON format. Do not include any explanation, markdown, or other text outside the JSON structure.",
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      // API 응답을 구조화된 형식으로 파싱
      return this.parseResponse(response.content[0].text);
    } catch (error) {
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  /**
   * 리뷰 프롬프트 생성
   * @param {string} filename - 파일명
   * @param {string} content - 파일 내용
   * @param {string} diff - Git diff
   * @param {string} reviewType - 리뷰 타입
   * @returns {string} 완성된 프롬프트
   */
  buildPrompt(filename, content, diff, reviewType) {
    // 리뷰 타입별 기본 프롬프트 가져오기
    const basePrompt = this.getBasePrompt(reviewType);
    // 언어별 지시사항
    const languageInstruction = this.getLanguageInstruction();
    
    // 파일 내용 길이 제한 (속도 개선)
    const truncatedContent = content.length > 5000 ? 
      content.substring(0, 5000) + '\n// ... (truncated for performance)' : 
      content;
    
    const truncatedDiff = diff && diff.length > 1000 ? 
      diff.substring(0, 1000) + '\n// ... (truncated)' : 
      diff;
    
    // 명확한 JSON 형식 요청
    return `${basePrompt} ${languageInstruction}

파일: ${filename}

${truncatedDiff ? `변경사항:\n\`\`\`diff\n${truncatedDiff}\n\`\`\`` : ''}

코드:
\`\`\`
${truncatedContent}
\`\`\`

**중요**: 반드시 아래 정확한 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요.

{
  "summary": "리뷰 요약을 여기에 작성",
  "issues": [
    {
      "line": 라인번호_또는_null,
      "severity": "low|medium|high|critical",
      "type": "bug|security|performance|style|maintainability",
      "title": "이슈 제목",
      "description": "상세 설명",
      "suggestion": "개선 제안"
    }
  ],
  "overall_score": 1부터_10까지의_숫자
}`;
  }

  /**
   * 리뷰 타입별 기본 프롬프트 반환
   * @param {string} reviewType - 리뷰 타입
   * @returns {string} 기본 프롬프트
   */
  getBasePrompt(reviewType) {
    const prompts = {
      // 전체 리뷰: 모든 측면을 종합적으로 검토
      full: `당신은 경험이 풍부한 시니어 개발자입니다. 다음 코드 변경사항을 종합적으로 리뷰해주세요.

리뷰 관점:
- 코드 품질 및 가독성
- 버그 및 잠재적 문제
- 보안 취약점
- 성능 최적화
- 베스트 프랙티스 준수
- 유지보수성`,

      // 보안 중심 리뷰: 보안 취약점에 집중
      security: `당신은 보안 전문가입니다. 다음 코드의 보안 취약점을 중점적으로 리뷰해주세요.

리뷰 관점:
- SQL 인젝션, XSS 등 일반적인 취약점
- 인증 및 권한 부여 문제
- 민감한 정보 노출
- 입력 검증 부족
- 암호화 및 해싱 이슈`,

      // 성능 중심 리뷰: 최적화 기회 찾기
      performance: `당신은 성능 최적화 전문가입니다. 다음 코드의 성능 관련 이슈를 리뷰해주세요.

리뷰 관점:
- 알고리즘 효율성
- 메모리 사용량
- 네트워크 호출 최적화
- 캐싱 전략
- 리소스 관리`,

      // 스타일 중심 리뷰: 코드 일관성과 가독성
      style: `당신은 코드 스타일 및 컨벤션 전문가입니다. 다음 코드의 스타일과 일관성을 리뷰해주세요.

리뷰 관점:
- 네이밍 컨벤션
- 코드 포맷팅
- 주석 및 문서화
- 코드 구조
- 일관성`
    };

    // 지정된 타입의 프롬프트 반환, 없으면 full 사용
    return prompts[reviewType] || prompts.full;
  }

  /**
   * 언어별 지시사항 반환
   * @returns {string} 언어 지시사항
   */
  getLanguageInstruction() {
    const instructions = {
      ko: '한국어로 리뷰를 작성해주세요.',
      en: 'Please write the review in English.',
      ja: '日本語でレビューを書いてください。',
      zh: '请用中文写评审。'
    };

    return instructions[this.language] || instructions.en;
  }

  /**
   * Claude API 응답을 구조화된 형식으로 파싱
   * @param {string} responseText - Claude API 응답 텍스트
   * @returns {Object} 파싱된 리뷰 결과
   */
  parseResponse(responseText) {
    try {
      console.log('Raw Claude response:', responseText);
      
      // 1. 여러 방법으로 JSON 추출 시도
      let jsonText = null;
      
      // 방법 1: 마크다운 코드 블록에서 추출
      const codeBlockMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      }
      
      // 방법 2: 일반 JSON 패턴 매칭
      if (!jsonText) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }
      
      // 방법 3: 첫 번째 { 부터 마지막 } 까지
      if (!jsonText) {
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonText = responseText.substring(firstBrace, lastBrace + 1);
        }
      }
      
      if (!jsonText) {
        throw new Error('No JSON found in response');
      }
      
      // 2. JSON 정리 (일반적인 파싱 오류 수정)
      jsonText = jsonText
        .replace(/,\s*}/g, '}')  // 마지막 콤마 제거
        .replace(/,\s*]/g, ']')  // 배열 마지막 콤마 제거
        .replace(/\n/g, '\\n')   // 개행 문자 이스케이프
        .replace(/\t/g, '\\t')   // 탭 문자 이스케이프
        .replace(/\r/g, '\\r');  // 캐리지 리턴 이스케이프
      
      console.log('Cleaned JSON text:', jsonText);
      
      // 3. JSON 파싱 시도
      const parsed = JSON.parse(jsonText);
      
      // 4. 응답 형식 검증
      if (!parsed.summary) {
        parsed.summary = 'Code review completed';
      }
      if (!Array.isArray(parsed.issues)) {
        parsed.issues = [];
      }

      // 5. 응답 정규화 및 기본값 설정
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
      console.error('JSON parsing failed:', error.message);
      console.error('Problematic text:', responseText);
      
      // JSON 파싱 실패 시 fallback 응답 생성
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