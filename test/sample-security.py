"""
보안 취약점 테스트용 Python 코드
Claude AI가 보안 문제를 잘 찾아내는지 테스트하기 위한 샘플입니다.
"""

import os
import subprocess
import pickle
import hashlib

# 문제 1: 하드코딩된 비밀번호
SECRET_KEY = "hardcoded_secret_123"
DATABASE_PASSWORD = "admin123"

# 문제 2: 안전하지 않은 명령어 실행
def execute_command(user_input):
    # 사용자 입력을 직접 실행 - 명령어 인젝션 위험
    result = subprocess.run(user_input, shell=True, capture_output=True)
    return result.stdout

# 문제 3: 안전하지 않은 pickle 사용
def load_data(file_path):
    with open(file_path, 'rb') as f:
        # pickle.load는 임의 코드 실행 가능
        return pickle.load(f)

# 문제 4: 약한 해시 알고리즘 사용
def hash_password(password):
    # MD5는 더 이상 안전하지 않음
    return hashlib.md5(password.encode()).hexdigest()

# 문제 5: 파일 경로 검증 없음 (Path Traversal)
def read_file(filename):
    # ../../../etc/passwd 같은 경로로 시스템 파일 접근 가능
    with open(f"/uploads/{filename}", 'r') as f:
        return f.read()

# 문제 6: SQL 인젝션 위험
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    # 파라미터화되지 않은 쿼리
    return database.execute(query)

# 문제 7: 예외 처리에서 민감한 정보 노출
def connect_database():
    try:
        connection = database.connect(
            host="192.168.1.100",
            user="admin",
            password=DATABASE_PASSWORD
        )
        return connection
    except Exception as e:
        # 에러 메시지에 민감한 정보가 포함될 수 있음
        print(f"Database connection failed: {e}")
        raise

# 문제 8: 안전하지 않은 랜덤 생성
import random
def generate_token():
    # random 모듈은 암호학적으로 안전하지 않음
    return ''.join(random.choices('abcdefghijklmnopqrstuvwxyz', k=32))

# 좋은 코드 예시
import secrets
import bcrypt
from pathlib import Path

def hash_password_securely(password):
    """비밀번호를 안전하게 해시화"""
    # bcrypt 사용으로 안전한 해시
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt)

def generate_secure_token():
    """암호학적으로 안전한 토큰 생성"""
    return secrets.token_urlsafe(32)

def read_file_safely(filename):
    """안전한 파일 읽기"""
    # 경로 검증
    safe_path = Path("/uploads") / filename
    if not str(safe_path).startswith("/uploads/"):
        raise ValueError("Invalid file path")
    
    try:
        with open(safe_path, 'r') as f:
            return f.read()
    except FileNotFoundError:
        return None