/**
 * 테스트용 샘플 코드
 * 이 파일은 Claude AI 코드 리뷰 액션이 제대로 동작하는지 테스트하기 위한 코드입니다.
 * 의도적으로 몇 가지 문제점을 포함하고 있습니다.
 */

// 문제 1: 사용하지 않는 변수
const unusedVariable = "This variable is never used";

// 문제 2: 글로벌 변수 사용
var globalVar = "Should avoid global variables";

// 문제 3: 안전하지 않은 eval 사용 (보안 문제)
function executeCode(code) {
    return eval(code); // 보안 취약점
}

// 문제 4: 에러 처리 없는 비동기 함수
async function fetchData(url) {
    const response = await fetch(url); // 에러 처리 없음
    return response.json();
}

// 문제 5: 매직 넘버 사용
function calculateDiscount(price) {
    if (price > 100) {
        return price * 0.1; // 매직 넘버 0.1
    }
    return 0;
}

// 문제 6: 깊은 중첩과 복잡한 조건문
function complexFunction(data) {
    if (data) {
        if (data.length > 0) {
            for (let i = 0; i < data.length; i++) {
                if (data[i].active) {
                    if (data[i].type === 'premium') {
                        if (data[i].score > 80) {
                            console.log('Premium user with high score');
                        }
                    }
                }
            }
        }
    }
}

// 문제 7: 함수명이 명확하지 않음
function doStuff(x, y) {
    return x + y * 2 - 5;
}

// 문제 8: 하드코딩된 값들
const config = {
    apiUrl: 'http://localhost:3000/api', // 하드코딩된 URL
    timeout: 5000,
    retries: 3
};

// 문제 9: SQL 인젝션 가능성 (보안 문제)
function getUserData(userId) {
    const query = `SELECT * FROM users WHERE id = ${userId}`; // SQL 인젝션 위험
    return database.query(query);
}

// 문제 10: 메모리 누수 가능성
let cache = {};
function addToCache(key, value) {
    cache[key] = value; // 캐시가 계속 증가하여 메모리 누수 가능
}

// 좋은 코드 예시 (Claude가 긍정적으로 평가할 부분)
/**
 * 사용자 정보를 안전하게 가져오는 함수
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} 사용자 정보
 */
async function getUserInfoSafely(userId) {
    try {
        // 입력 검증
        if (!userId || typeof userId !== 'string') {
            throw new Error('Invalid user ID');
        }
        
        // 안전한 파라미터화된 쿼리
        const query = 'SELECT * FROM users WHERE id = ?';
        const result = await database.query(query, [userId]);
        
        return result;
    } catch (error) {
        console.error('Error fetching user info:', error);
        throw error;
    }
}

module.exports = {
    executeCode,
    fetchData,
    calculateDiscount,
    complexFunction,
    doStuff,
    getUserData,
    addToCache,
    getUserInfoSafely
};