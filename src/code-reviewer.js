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
   * @param {number} maxIssuesPerFile - 파일당 최대 이슈 개수 (1-10)
   */
  constructor(apiKey, language = 'en', maxIssuesPerFile = 3) {
    // Claude API 클라이언트 초기화
    this.client = new Anthropic({ apiKey });
    this.language = language;
    this.maxIssuesPerFile = Math.max(1, Math.min(10, maxIssuesPerFile)); // 1-10 범위로 제한
    // 이슈 개수에 따라 토큰 수 동적 조정 (더 많은 이슈 = 더 많은 토큰 필요)
    this.maxTokens = Math.min(8000, 3000 + (this.maxIssuesPerFile * 500));
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
      // Claude API 호출 (토큰 수 증가 및 스트림 비활성화)
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514', // 코드 분석에 적합한 모델
        max_tokens: 8000, // 토큰 수 증가로 완전한 응답 보장
        temperature: 0.1, // 일관성 있는 응답을 위해 낮은 temperature 사용
        system: "You are a senior code reviewer. CRITICAL: Always respond with complete, valid JSON format. Never truncate your response. Ensure the JSON is properly closed with all brackets and braces. Do not include any explanation, markdown, or other text outside the JSON structure.",
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = response.content[0].text;
      console.log(`Response length: ${responseText.length} characters`);
      console.log(`Response ends with: "${responseText.slice(-50)}"`);

      // API 응답을 구조화된 형식으로 파싱
      return this.parseResponse(responseText);
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

**중요**: 완전한 JSON만 반환하세요. 최대 ${this.maxIssuesPerFile}개 이슈만 포함하고 간결하게 작성하세요.

형식:
{"summary":"요약(30자)","issues":[{"line":숫자,"severity":"low/medium/high/critical","type":"bug/security/performance/style/maintainability","title":"제목(20자)","description":"설명(50자)","suggestion":"제안(50자)"}],"overall_score":숫자}

중요도 높은 이슈부터 우선적으로 ${this.maxIssuesPerFile}개까지 선별해서 보고하세요.`;
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
      // 디버깅을 위한 원본 응답 로깅
      console.log('Raw Claude response:', responseText.substring(0, 500));
      
      // 1. 응답 텍스트 전처리
      let cleanedText = responseText.trim();
      
      // 2. 여러 방법으로 JSON 추출 시도
      let jsonText = null;
      
      // 방법 1: 마크다운 코드 블록에서 추출
      const codeBlockMatch = cleanedText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim();
      }
      
      // 방법 2: 일반 JSON 패턴 매칭 (가장 완전한 JSON 찾기)
      if (!jsonText) {
        const jsonMatches = cleanedText.match(/\{[\s\S]*?\}/g);
        if (jsonMatches && jsonMatches.length > 0) {
          // 가장 긴 JSON 객체 선택 (더 완전할 가능성)
          jsonText = jsonMatches.reduce((longest, current) => 
            current.length > longest.length ? current : longest
          );
        }
      }
      
      // 방법 3: 첫 번째 { 부터 마지막 } 까지
      if (!jsonText) {
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonText = cleanedText.substring(firstBrace, lastBrace + 1);
        }
      }
      
      if (!jsonText) {
        throw new Error('No JSON structure found in response');
      }
      
      console.log('Extracted JSON text:', jsonText.substring(0, 200));
      
      // 3. JSON 정리 및 수정
      jsonText = jsonText
        // 잘못된 콤마 제거
        .replace(/,(\s*[}\]])/g, '$1')
        // 문자열 내 특수문자 처리
        .replace(/\\/g, '\\\\')  // 백슬래시 이스케이프
        .replace(/\n/g, ' ')     // 개행을 공백으로 변경
        .replace(/\r/g, '')      // 캐리지 리턴 제거
        .replace(/\t/g, ' ')     // 탭을 공백으로 변경
        // 잘못된 따옴표 수정
        .replace(/"/g, '"')      // 유니코드 따옴표 정규화
        .replace(/"/g, '"')
        .replace(/'/g, "'")      // 작은따옴표 정규화
        // 여분의 공백 제거
        .replace(/\s+/g, ' ')
        .trim();
      
      // 4. JSON 파싱 시도 (여러 번 시도)
      let parsed;
      try {
        parsed = JSON.parse(jsonText);
      } catch (firstError) {
        console.log('First parse attempt failed:', firstError.message);
        
        // JSON 수정 재시도 1: 기본 수정
        let fixedJson = jsonText
          .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // 키에 따옴표 추가
          .replace(/:\s*([^",\[\]{}]+)(\s*[,}])/g, ': "$1"$2')  // 값에 따옴표 추가
          .replace(/: ""(\d+)""([,}])/g, ': $1$2')  // 숫자 값 수정
          .replace(/: ""(true|false|null)""([,}])/g, ': $1$2');  // 불린/null 값 수정
        
        try {
          parsed = JSON.parse(fixedJson);
        } catch (secondError) {
          console.log('Second parse attempt failed:', secondError.message);
          
          // JSON 수정 재시도 2: 불완전한 JSON 복구
          fixedJson = this.repairIncompleteJson(jsonText);
          
          try {
            parsed = JSON.parse(fixedJson);
            console.log('Successfully repaired incomplete JSON');
          } catch (thirdError) {
            console.log('Third parse attempt failed:', thirdError.message);
            throw new Error(`JSON parsing failed: ${firstError.message}`);
          }
        }
      }
      
      // 5. 응답 형식 검증 및 기본값 설정
      const result = {
        summary: parsed.summary || 'Code review completed',
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        positiveFeedback: Array.isArray(parsed.positive_feedback) ? parsed.positive_feedback : [],
        overallScore: typeof parsed.overall_score === 'number' ? parsed.overall_score : 5
      };
      
      // 6. 이슈 정규화
      result.issues = result.issues.map(issue => ({
        line: typeof issue.line === 'number' ? issue.line : null,
        severity: ['low', 'medium', 'high', 'critical'].includes(issue.severity) ? issue.severity : 'medium',
        type: ['bug', 'security', 'performance', 'style', 'maintainability'].includes(issue.type) ? issue.type : 'general',
        title: issue.title || 'Issue found',
        description: issue.description || '',
        suggestion: issue.suggestion || '',
        codeExample: issue.code_example || issue.codeExample || null
      }));
      
      console.log(`Successfully parsed review with ${result.issues.length} issues`);
      return result;
      
    } catch (error) {
      console.error('Parse error details:', error);
      console.error('Original response:', responseText);
      
      // JSON 파싱 실패 시 안전한 fallback 응답 생성
      return {
        summary: 'Code review was processed, but the response format was invalid.',
        issues: [{
          line: null,
          severity: 'low',
          type: 'system',
          title: 'Response Parsing Issue',
          description: `AI 응답 파싱 중 오류가 발생했습니다: ${error.message}. 원본 응답을 확인해주세요.`,
          suggestion: '코드를 수동으로 검토하거나 다시 시도해주세요.',
          codeExample: null
        }],
        positiveFeedback: [],
        overallScore: 5
      };
    }
  }

  /**
   * 불완전한 JSON을 복구하는 메서드
   * @param {string} incompleteJson - 불완전한 JSON 문자열
   * @returns {string} 복구된 JSON 문자열
   */
  repairIncompleteJson(incompleteJson) {
    console.log('Attempting to repair incomplete JSON...');
    
    let repaired = incompleteJson.trim();
    
    // 1. 가장 마지막 완전한 이슈 찾기
    const issuesMatch = repaired.match(/"issues":\s*\[([\s\S]*)/);
    if (issuesMatch) {
      const issuesContent = issuesMatch[1];
      
      // 완전한 이슈 객체들만 추출
      const completeIssues = [];
      let depth = 0;
      let currentIssue = '';
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < issuesContent.length; i++) {
        const char = issuesContent[i];
        
        if (escapeNext) {
          escapeNext = false;
          currentIssue += char;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          currentIssue += char;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
        }
        
        if (!inString) {
          if (char === '{') {
            depth++;
          } else if (char === '}') {
            depth--;
            
            if (depth === 0) {
              currentIssue += char;
              
              // 완전한 이슈 객체 발견
              try {
                const issueObj = JSON.parse(currentIssue);
                if (issueObj.title && issueObj.description) {
                  completeIssues.push(currentIssue);
                }
              } catch (e) {
                // 파싱 실패한 객체는 무시
              }
              
              currentIssue = '';
              continue;
            }
          }
        }
        
        currentIssue += char;
      }
      
      // 복구된 JSON 생성
      const summaryMatch = repaired.match(/"summary":\s*"([^"]*)"/) || ["", "Code review completed"];
      const scoreMatch = repaired.match(/"overall_score":\s*(\d+)/) || ["", "5"];
      
      const repairedJson = {
        summary: summaryMatch[1] || "Code review completed",
        issues: completeIssues.map(issue => JSON.parse(issue)),
        overall_score: parseInt(scoreMatch[1]) || 5
      };
      
      console.log(`Repaired JSON with ${repairedJson.issues.length} complete issues`);
      return JSON.stringify(repairedJson);
    }
    
    // 기본 복구 로직 (위 방법이 실패한 경우)
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;
    
    // 불완전한 마지막 부분 제거
    repaired = repaired.replace(/,\s*\{[^}]*$/, '');
    repaired = repaired.replace(/,\s*"[^"]*":[^,}]*$/, '');
    repaired = repaired.replace(/:\s*"[^"]*$/, ': "incomplete"');
    
    // 괄호 닫기
    for (let i = closeBrackets; i < openBrackets; i++) {
      repaired += ']';
    }
    for (let i = closeBraces; i < openBraces; i++) {
      repaired += '}';
    }
    
    console.log('Fallback repair applied');
    return repaired;
  }
}

module.exports = CodeReviewer;