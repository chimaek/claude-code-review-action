// Express API 엔드포인트 - 다양한 문제점들

const express = require('express');
const app = express();

// CORS 설정 문제
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // 모든 도메인 허용 - 보안 위험
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// Rate limiting 없음 - DoS 공격 위험
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  // 입력 검증 없음
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  // 비동기 처리 오류
  try {
    const user = authenticateUser(username, password); // await 누락
    res.json({ success: true, user });
  } catch (error) {
    console.log(error); // 에러 정보 노출
    res.status(500).json({ error: error.message }); // 내부 에러 노출
  }
});

// Path traversal 취약점
app.get('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = `./uploads/${filename}`; // 경로 검증 없음
  
  // 파일 존재 여부만 확인
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath); // 절대 경로가 아님
  } else {
    res.status(404).send('File not found');
  }
});

// SQL 인젝션 위험
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  
  // 매개변수화된 쿼리 대신 문자열 연결
  const query = `SELECT * FROM users WHERE id = ${userId}`;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// 메모리 누수 위험
const cache = new Map();
app.get('/api/cache/:key', (req, res) => {
  const key = req.params.key;
  const value = generateExpensiveData(key);
  
  cache.set(key, value); // 캐시 크기 제한 없음
  res.json({ data: value });
});

// 인증 없이 민감한 정보 노출
app.get('/api/admin/logs', (req, res) => {
  // 권한 검사 없음
  const logs = fs.readFileSync('./app.log', 'utf8');
  res.json({ logs });
});

// 비효율적인 데이터베이스 쿼리
app.get('/api/dashboard', async (req, res) => {
  const users = [];
  
  // N+1 쿼리 문제
  const userIds = await db.query('SELECT id FROM users');
  for (const userId of userIds) {
    const user = await db.query(`SELECT * FROM users WHERE id = ${userId.id}`);
    const posts = await db.query(`SELECT * FROM posts WHERE user_id = ${userId.id}`);
    users.push({ ...user, posts });
  }
  
  res.json(users);
});

// 파일 업로드 검증 부족
app.post('/api/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  
  // 파일 타입, 크기 검증 없음
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // 원본 파일명 그대로 사용 (경로 조작 위험)
  const filename = file.originalname;
  fs.writeFileSync(`./uploads/${filename}`, file.buffer);
  
  res.json({ message: 'File uploaded', filename });
});

// 하드코딩된 설정값들
const PORT = 3000;
const DB_PASSWORD = 'admin123'; // 하드코딩된 비밀번호
const JWT_SECRET = 'my-secret-key'; // 하드코딩된 JWT 시크릿

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database password: ${DB_PASSWORD}`); // 로그에 비밀번호 출력
});

module.exports = app;