// 사용자 서비스 - 보안 및 성능 문제가 있는 코드

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class UserService {
  constructor() {
    this.users = [];
    this.secret = 'hardcoded-secret-key'; // 보안 문제: 하드코딩된 시크릿
  }

  // SQL 인젝션 취약점
  async getUserByEmail(email) {
    const query = `SELECT * FROM users WHERE email = '${email}'`; // 위험한 문자열 연결
    // 실제 DB 쿼리 실행 코드는 생략
    return this.users.find(user => user.email === email);
  }

  // 약한 패스워드 정책
  createUser(userData) {
    if (!userData.password || userData.password.length < 3) { // 너무 약한 최소 길이
      throw new Error('Password too short');
    }

    // 패스워드 해싱 없이 저장
    const user = {
      id: Date.now(), // 예측 가능한 ID
      email: userData.email,
      password: userData.password, // 평문 저장!
      createdAt: new Date()
    };

    this.users.push(user);
    return user;
  }

  // 브루트포스 공격에 취약
  async login(email, password) {
    const user = await this.getUserByEmail(email);
    
    if (!user) {
      return null; // 시간 기반 공격 가능
    }

    // 평문 비교
    if (user.password === password) {
      const token = jwt.sign({ userId: user.id }, this.secret);
      return { token, user };
    }

    return null;
  }

  // 권한 검증 누락
  deleteUser(userId) {
    const index = this.users.findIndex(user => user.id == userId); // == 사용
    if (index !== -1) {
      this.users.splice(index, 1);
      return true;
    }
    return false;
  }

  // 성능 문제: N+1 쿼리 패턴
  async getUsersWithProfiles() {
    const users = await this.getAllUsers();
    const usersWithProfiles = [];

    for (const user of users) {
      const profile = await this.getUserProfile(user.id); // 각 사용자마다 개별 쿼리
      usersWithProfiles.push({
        ...user,
        profile
      });
    }

    return usersWithProfiles;
  }

  // 메모리 누수 위험
  cacheUserData(userId, data) {
    if (!this.cache) {
      this.cache = new Map();
    }
    
    this.cache.set(userId, data); // 캐시 만료나 정리 로직 없음
  }

  // 입력 검증 부족
  updateUser(userId, updateData) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      Object.assign(user, updateData); // 모든 필드 업데이트 허용
    }
    return user;
  }

  // 비동기 처리 오류
  async sendEmailVerification(email) {
    // await 없이 비동기 함수 호출
    this.emailService.sendEmail(email, 'Verify your account');
    console.log('Email sent'); // 실제로는 아직 전송되지 않았을 수 있음
  }
}

// 환경변수 없이 민감한 정보 노출
process.env.NODE_ENV !== 'production' && console.log('Database password: admin123');

module.exports = UserService;