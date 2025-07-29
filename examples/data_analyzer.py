# Python 예시: 데이터 분석기 (성능 및 보안 이슈)
import os
import pickle
import hashlib
import subprocess
import pandas as pd
from typing import List, Dict, Any

class DataAnalyzer:
    def __init__(self, data_path: str):
        self.data_path = data_path
        self.cache = {}
        self.api_key = "sk-1234567890abcdef"  # 보안 이슈: 하드코딩된 API 키
    
    # 보안 이슈: 경로 순회 공격 가능
    def load_data(self, filename: str) -> pd.DataFrame:
        # 입력 검증 없음
        full_path = os.path.join(self.data_path, filename)
        print(f"Loading data from: {full_path}")  # 경로 정보 노출
        
        try:
            # 보안 이슈: pickle.load 사용 (코드 실행 가능)
            if filename.endswith('.pkl'):
                with open(full_path, 'rb') as f:
                    return pickle.load(f)  # 매우 위험!
            else:
                return pd.read_csv(full_path)
        except Exception as e:
            print(f"Error loading data: {str(e)}")  # 에러 정보 노출
            return pd.DataFrame()
    
    # 성능 이슈: 비효율적인 데이터 처리
    def analyze_data(self, data: pd.DataFrame) -> Dict[str, Any]:
        results = {}
        
        # 성능 이슈: 반복문으로 통계 계산
        for column in data.columns:
            column_stats = []
            for value in data[column]:
                # 매우 비효율적인 처리
                if str(value).isdigit():
                    column_stats.append(float(value))
            
            if column_stats:
                results[column] = {
                    'mean': sum(column_stats) / len(column_stats),
                    'max': max(column_stats),
                    'min': min(column_stats)
                }
        
        return results
    
    # 보안 이슈: 명령어 인젝션 가능
    def execute_query(self, query: str) -> str:
        # 입력 검증 없이 시스템 명령어 실행
        command = f"mysql -e '{query}'"
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        return result.stdout
    
    # 메모리 누수: 캐시 정리 없음
    def cache_result(self, key: str, data: Any) -> None:
        # 캐시 크기 제한 없음
        self.cache[key] = data
        print(f"Cached {len(str(data))} bytes for key: {key}")
    
    # 보안 이슈: 약한 해시 함수 사용
    def generate_hash(self, data: str) -> str:
        # MD5는 보안상 취약함
        return hashlib.md5(data.encode()).hexdigest()
    
    # 성능 이슈: 중첩 반복문
    def find_duplicates(self, data_list: List[Dict]) -> List[Dict]:
        duplicates = []
        
        # O(n²) 복잡도
        for i in range(len(data_list)):
            for j in range(i + 1, len(data_list)):
                if data_list[i] == data_list[j]:
                    duplicates.append(data_list[i])
        
        return duplicates
    
    # 코드 스타일 이슈: 네이밍 컨벤션 위반
    def ProcessLargeDataset(self, DataSet: List) -> None:
        # 변수명이 일관성 없음
        processedData = []
        Total_Count = 0
        
        for item in DataSet:
            # 들여쓰기 일관성 없음
                processed_item = self.process_item(item)
                processedData.append(processed_item)
                Total_Count += 1
        
        print(f"Processed {Total_Count} items")
    
    def process_item(self, item):
        # 타입 힌트 없음
        return item
    
    # 보안 이슈: 민감한 정보 로깅
    def authenticate_user(self, username: str, password: str) -> bool:
        print(f"Authenticating user: {username} with password: {password}")  # 비밀번호 로깅!
        
        # 보안 이슈: 약한 비밀번호 정책
        if len(password) >= 4:
            return True
        return False
    
    # 메모리 누수: 대용량 데이터 처리 시 문제
    def load_all_data(self) -> List[pd.DataFrame]:
        all_data = []
        
        # 메모리 사용량 고려 없음
        for filename in os.listdir(self.data_path):
            if filename.endswith(('.csv', '.pkl')):
                data = self.load_data(filename)
                all_data.append(data)  # 모든 데이터를 메모리에 보관
        
        return all_data

# 모듈 레벨에서 인스턴스 생성 (좋지 않은 패턴)
analyzer = DataAnalyzer("/tmp/data")