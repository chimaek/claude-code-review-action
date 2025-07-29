// JavaScript 예시: 사용자 서비스 (다양한 이슈 포함)
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class UserService {
    constructor() {
        this.users = new Map();
        this.SECRET_KEY = "hardcoded-secret-123"; // 보안 이슈: 하드코딩된 시크릿
    }

    // 성능 이슈: 비효율적인 검색
    findUserByEmail(email) {
        for (let [id, user] of this.users) {
            if (user.email === email) {
                return user;
            }
        }
        return null;
    }

    // 보안 이슈: SQL Injection 가능성
    authenticateUser(email, password) {
        const query = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`;
        console.log("Executing query:", query); // 보안 이슈: 비밀번호 로깅
        
        const user = this.findUserByEmail(email);
        if (!user) return null;
        
        // 보안 이슈: 평문 비밀번호 비교
        if (user.password === password) {
            return this.generateToken(user);
        }
        return null;
    }

    // 코드 스타일 이슈: 네이밍 컨벤션 위반
    CreateNewUser(Email, Password, UserName) {
        // 입력 검증 없음 (보안 이슈)
        const userId = Math.random().toString(36); // 약한 ID 생성
        
        const newUser = {
            id: userId,
            email: Email,
            password: Password, // 평문 저장 (보안 이슈)
            username: UserName,
            createdAt: new Date()
        };
        
        this.users.set(userId, newUser);
        return newUser;
    }

    generateToken(user) {
        // 보안 이슈: 토큰 만료시간 없음
        return jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                password: user.password // 보안 이슈: 토큰에 비밀번호 포함
            }, 
            this.SECRET_KEY
        );
    }

    // 성능 이슈: 동기 처리
    validateToken(token) {
        try {
            const decoded = jwt.verify(token, this.SECRET_KEY);
            return decoded;
        } catch (error) {
            console.log("Token validation error:", error.message);
            return null;
        }
    }

    // 메모리 누수 가능성
    getUserSessions(userId) {
        const sessions = [];
        // 세션 정리 로직 없음
        for (let i = 0; i < 1000; i++) {
            sessions.push({
                id: i,
                userId: userId,
                data: new Array(1000).fill("session-data")
            });
        }
        return sessions;
    }
}

module.exports = UserService;