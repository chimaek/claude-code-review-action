/**
 * 추가 테스트 코드 - PR 테스트용
 * 이 파일은 PR에서 Claude AI 코드 리뷰가 동작하는지 확인하기 위해 추가합니다.
 */

// 의도적인 문제들이 포함된 코드
function badFunction() {
    // 문제 1: var 사용
    var x = 10;
    
    // 문제 2: == 대신 === 사용해야 함
    if (x == "10") {
        console.log("Equal");
    }
    
    // 문제 3: 사용하지 않는 변수
    let unusedVar = "This is not used";
    
    // 문제 4: 에러 처리 없음
    JSON.parse('{"invalid": json}');
    
    return x;
}

// 개선된 코드
function goodFunction() {
    const x = 10;
    
    if (x === 10) {
        console.log("Equal");
    }
    
    try {
        return JSON.parse('{"valid": "json"}');
    } catch (error) {
        console.error('JSON parsing failed:', error);
        return null;
    }
}

module.exports = { badFunction, goodFunction };