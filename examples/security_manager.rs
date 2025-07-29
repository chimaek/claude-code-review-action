// Rust 예시: 보안 매니저 (안전하지 않은 코드 사용 및 보안 이슈)
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Write};
use std::process::Command;
use std::ffi::CString;
use std::ptr;

// 보안 이슈: 하드코딩된 시크릿
const SECRET_KEY: &str = "hardcoded-secret-key-123";
const ADMIN_PASSWORD: &str = "admin123";

pub struct SecurityManager {
    users: HashMap<String, String>,
    sessions: HashMap<String, u64>,
    // 메모리 누수 가능성: Vec이 무제한 성장
    audit_log: Vec<String>,
}

impl SecurityManager {
    pub fn new() -> Self {
        Self {
            users: HashMap::new(),
            sessions: HashMap::new(),
            audit_log: Vec::new(),
        }
    }

    // 보안 이슈: 평문 비밀번호 저장
    pub fn create_user(&mut self, username: String, password: String) -> bool {
        // 입력 검증 없음
        if username.is_empty() || password.is_empty() {
            return false;
        }

        // 보안 이슈: 비밀번호 평문 저장
        self.users.insert(username.clone(), password);
        
        // 보안 이슈: 민감한 정보 로깅
        let log_entry = format!("User created: {} with password: {}", username, password);
        self.audit_log.push(log_entry);
        
        true
    }

    // 보안 이슈: 약한 세션 ID 생성
    pub fn authenticate(&mut self, username: &str, password: &str) -> Option<String> {
        if let Some(stored_password) = self.users.get(username) {
            // 보안 이슈: 평문 비밀번호 비교
            if stored_password == password {
                // 보안 이슈: 예측 가능한 세션 ID
                let session_id = format!("session_{}", self.sessions.len());
                self.sessions.insert(session_id.clone(), 1);
                
                // 보안 이슈: 인증 정보 로깅
                println!("Authentication successful for: {}", username);
                
                return Some(session_id);
            }
        }
        
        // 보안 이슈: 사용자 존재 여부 유추 가능한 에러 메시지
        println!("Authentication failed: Invalid username or password");
        None
    }

    // 안전하지 않은 코드: 메모리 안전성 위반 가능
    pub unsafe fn process_raw_data(&self, data: *const u8, len: usize) -> Vec<u8> {
        let mut result = Vec::new();
        
        // 경계 검사 없음 - 버퍼 오버플로우 가능
        for i in 0..len {
            let byte_val = *data.offset(i as isize);
            result.push(byte_val);
        }
        
        result
    }

    // 보안 이슈: 명령어 인젝션 취약점
    pub fn execute_system_command(&self, user_input: &str) -> Result<String, std::io::Error> {
        // 입력 검증 없음
        let command = format!("echo {}", user_input);
        
        // 명령어 인젝션 가능
        let output = Command::new("sh")
            .arg("-c")
            .arg(&command)
            .output()?;

        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    }

    // 메모리 누수: 무한 성장하는 로그
    pub fn add_audit_log(&mut self, message: String) {
        // 로그 크기 제한 없음
        self.audit_log.push(message);
        
        // 성능 이슈: 매번 전체 로그 출력
        for (i, log) in self.audit_log.iter().enumerate() {
            println!("Log {}: {}", i, log);
        }
    }

    // 보안 이슈: 민감한 정보를 평문 파일로 저장
    pub fn export_user_data(&self, filename: &str) -> Result<(), std::io::Error> {
        let mut file = File::create(filename)?;
        
        // 사용자 데이터를 평문으로 저장
        for (username, password) in &self.users {
            let line = format!("{}:{}\n", username, password);
            file.write_all(line.as_bytes())?;
        }
        
        // 보안 이슈: 파일 경로 로깅
        println!("User data exported to: {}", filename);
        
        Ok(())
    }

    // 안전하지 않은 코드: C 스타일 포인터 사용
    pub unsafe fn manipulate_memory(&self, ptr: *mut u8, size: usize) {
        // 경계 검사 없음
        for i in 0..size * 2 {  // 의도적으로 잘못된 크기
            *ptr.offset(i as isize) = 0xFF;  // 버퍼 오버플로우 가능
        }
    }

    // 성능 이슈: 비효율적인 검색
    pub fn find_user_by_partial_name(&self, partial: &str) -> Vec<String> {
        let mut results = Vec::new();
        
        // O(n) 검색을 여러 번 수행
        for username in self.users.keys() {
            // 성능 이슈: 비효율적인 문자열 비교
            for i in 0..username.len() {
                if username[i..].starts_with(partial) {
                    results.push(username.clone());
                    break;
                }
            }
        }
        
        results
    }

    // 보안 이슈: 권한 검증 없는 관리자 기능
    pub fn admin_reset_all_passwords(&mut self) {
        // 권한 확인 없음
        for (username, password) in &mut self.users {
            *password = "temp123".to_string();  // 모든 비밀번호를 약한 것으로 변경
            
            // 보안 이슈: 비밀번호 변경 로깅
            println!("Reset password for user: {}", username);
        }
    }

    // 안전하지 않은 코드: 원시 포인터로 문자열 생성
    pub unsafe fn create_c_string(&self, data: &[u8]) -> *const i8 {
        let c_string = CString::new(data).unwrap();
        let ptr = c_string.as_ptr();
        
        // 메모리 해제 없이 포인터 반환 (use-after-free 가능성)
        std::mem::forget(c_string);
        
        ptr
    }
}

// 전역 변수 (thread-safety 문제)
static mut GLOBAL_MANAGER: Option<SecurityManager> = None;

// 보안 이슈: 스레드 안전성 없는 전역 접근
pub unsafe fn get_global_manager() -> &'static mut SecurityManager {
    if GLOBAL_MANAGER.is_none() {
        GLOBAL_MANAGER = Some(SecurityManager::new());
    }
    
    GLOBAL_MANAGER.as_mut().unwrap()
}

// 코드 스타일 이슈: 네이밍 컨벤션 위반
pub struct User_Session {
    pub Session_ID: String,
    pub User_Name: String,
    pub Is_Admin: bool,
}

impl User_Session {
    // 보안 이슈: 관리자 권한 체크 로직 결함
    pub fn Check_Admin_Access(&self) -> bool {
        // 단순한 문자열 비교로 관리자 확인
        self.User_Name == "admin" || self.Session_ID.contains("admin")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unsafe_operations() {
        let mut manager = SecurityManager::new();
        
        unsafe {
            // 안전하지 않은 테스트 코드
            let data = vec![1, 2, 3, 4, 5];
            let processed = manager.process_raw_data(data.as_ptr(), data.len());
            assert_eq!(processed, data);
            
            // 메모리 오류 가능성이 있는 테스트
            let mut buffer = vec![0u8; 10];
            manager.manipulate_memory(buffer.as_mut_ptr(), 5);  // 의도적으로 작은 크기
        }
    }
}