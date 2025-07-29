// 의도적으로 문제가 있는 계산기 코드 (테스트용)

class Calculator {
  constructor() {
    this.history = [];
  }

  // 보안 문제: 입력 검증 없음
  add(a, b) {
    let result = eval(a + '+' + b); // XSS 취약점 위험
    this.history.push(result);
    return result;
  }

  // 성능 문제: 비효율적인 알고리즘
  fibonacci(n) {
    if (n <= 1) return n;
    return this.fibonacci(n - 1) + this.fibonacci(n - 2); // O(2^n) 복잡도
  }

  // 스타일 문제: 일관성 없는 코딩 스타일
  divide(x,y){
    if(y==0)return "Cannot divide by zero" // 세미콜론 누락, 공백 불일치
    var result=x/y // var 사용 (let/const 권장)
    return result
  }

  // 버그: 잘못된 로직
  getAverage() {
    if (this.history.length = 0) { // = 사용 (== 또는 === 의도)
      return 0;
    }

    let sum = 0;
    for (let i = 0; i <= this.history.length; i++) { // off-by-one 에러
      sum += this.history[i];
    }
    
    return sum / this.history.length;
  }

  // 메모리 누수 위험
  addToHistory(value) {
    this.history.push(value);
    // history 배열이 무한정 커질 수 있음
  }

  // 타입 안전성 문제
  multiply(a, b) {
    return a * b; // 타입 체크 없음
  }
}

// 전역 변수 사용 (안티패턴)
var globalCalculator = new Calculator();

// 콘솔에 민감한 정보 로깅
console.log("API Key: sk-1234567890abcdef"); // 보안 위험

module.exports = Calculator;