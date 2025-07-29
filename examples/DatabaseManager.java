// Java 예시: 데이터베이스 매니저 (보안 및 성능 이슈)
package com.example.database;

import java.sql.*;
import java.util.*;
import java.io.FileWriter;
import java.io.IOException;
import java.util.logging.Logger;

public class DatabaseManager {
    // 보안 이슈: 하드코딩된 데이터베이스 정보
    private static final String DB_URL = "jdbc:mysql://localhost:3306/mydb";
    private static final String USERNAME = "admin";
    private static final String PASSWORD = "password123";
    
    private Connection connection;
    private static Logger logger = Logger.getLogger(DatabaseManager.class.getName());
    
    // 성능 이슈: 싱글톤 패턴 미사용, 매번 새 연결
    public DatabaseManager() {
        try {
            Class.forName("com.mysql.cj.jdbc.Driver");
            connection = DriverManager.getConnection(DB_URL, USERNAME, PASSWORD);
        } catch (Exception e) {
            // 보안 이슈: 상세한 에러 정보 노출
            logger.severe("Database connection failed: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    // 보안 이슈: SQL Injection 취약점
    public List<User> getUsersByRole(String role) {
        List<User> users = new ArrayList<>();
        
        try {
            // 파라미터 바인딩 없이 문자열 연결
            String query = "SELECT * FROM users WHERE role = '" + role + "'";
            logger.info("Executing query: " + query); // 쿼리 로깅 (정보 노출)
            
            Statement stmt = connection.createStatement();
            ResultSet rs = stmt.executeQuery(query);
            
            while (rs.next()) {
                User user = new User();
                user.setId(rs.getInt("id"));
                user.setUsername(rs.getString("username"));
                user.setPassword(rs.getString("password")); // 보안 이슈: 비밀번호 포함
                user.setRole(rs.getString("role"));
                users.add(user);
            }
            
            // 리소스 해제 안함 (메모리 누수)
            
        } catch (SQLException e) {
            logger.severe("Query execution failed: " + e.getMessage());
        }
        
        return users;
    }
    
    // 성능 이슈: N+1 쿼리 문제
    public void updateUserProfiles(List<Integer> userIds) {
        for (Integer userId : userIds) {
            try {
                // 각 사용자마다 개별 쿼리 실행
                String query = "UPDATE users SET last_updated = NOW() WHERE id = ?";
                PreparedStatement stmt = connection.prepareStatement(query);
                stmt.setInt(1, userId);
                stmt.executeUpdate();
                
                // 연결 닫지 않음 (리소스 누수)
                
            } catch (SQLException e) {
                logger.severe("Update failed for user " + userId + ": " + e.getMessage());
            }
        }
    }
    
    // 보안 이슈: 권한 검증 없는 삭제
    public boolean deleteUser(String username) {
        try {
            // 권한 확인 없이 삭제 실행
            String query = "DELETE FROM users WHERE username = '" + username + "'";
            Statement stmt = connection.createStatement();
            int affectedRows = stmt.executeUpdate(query);
            
            // 보안 이슈: 삭제된 사용자 정보 로깅
            logger.info("Deleted user: " + username + ", affected rows: " + affectedRows);
            
            return affectedRows > 0;
        } catch (SQLException e) {
            logger.severe("User deletion failed: " + e.getMessage());
            return false;
        }
    }
    
    // 성능 이슈: 대용량 데이터를 한번에 메모리로 로드
    public List<String> getAllUserEmails() {
        List<String> emails = new ArrayList<>();
        
        try {
            String query = "SELECT email FROM users"; // LIMIT 없음
            Statement stmt = connection.createStatement();
            ResultSet rs = stmt.executeQuery(query);
            
            // 모든 결과를 메모리에 저장
            while (rs.next()) {
                emails.add(rs.getString("email"));
            }
            
        } catch (SQLException e) {
            logger.severe("Failed to fetch emails: " + e.getMessage());
        }
        
        return emails;
    }
    
    // 보안 이슈: 민감한 정보를 평문 파일로 저장
    public void exportUserData(List<User> users) {
        try {
            FileWriter writer = new FileWriter("user_export.txt");
            
            for (User user : users) {
                // 비밀번호 포함하여 내보내기
                String line = user.getId() + "," + user.getUsername() + "," + 
                             user.getPassword() + "," + user.getRole() + "\n";
                writer.write(line);
            }
            
            writer.close();
            logger.info("User data exported to user_export.txt");
            
        } catch (IOException e) {
            logger.severe("Export failed: " + e.getMessage());
        }
    }
    
    // 코드 스타일 이슈: 네이밍 컨벤션 위반
    public void ExecuteBatchOperation(List<String> SQLQueries) {
        try {
            connection.setAutoCommit(false);
            Statement stmt = connection.createStatement();
            
            // 코드 스타일 이슈: 일관성 없는 들여쓰기
            for(String query : SQLQueries) {
                    stmt.addBatch(query); // SQL Injection 가능
                logger.info("Added to batch: " + query);
            }
            
            int[] results = stmt.executeBatch();
            connection.commit();
            
            // 성능 이슈: 불필요한 로깅
            for (int i = 0; i < results.length; i++) {
                logger.info("Batch operation " + i + " affected " + results[i] + " rows");
            }
            
        } catch (SQLException e) {
            try {
                connection.rollback();
            } catch (SQLException rollbackError) {
                logger.severe("Rollback failed: " + rollbackError.getMessage());
            }
            logger.severe("Batch operation failed: " + e.getMessage());
        }
    }
    
    // 메모리 누수: finalize에서 리소스 정리 (잘못된 패턴)
    @Override
    protected void finalize() throws Throwable {
        if (connection != null && !connection.isClosed()) {
            connection.close();
        }
        super.finalize();
    }
}

// 코드 스타일 이슈: 같은 파일에 여러 클래스
class User {
    private int id;
    private String username;
    private String password;
    private String role;
    
    // getter/setter 생략
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}