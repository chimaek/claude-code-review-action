// Go 예시: 파일 처리기 (보안 및 성능 이슈)
package main

import (
	"bufio"
	"crypto/md5" // 보안 이슈: 약한 해시 함수
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// 보안 이슈: 전역 변수에 민감한 정보
var (
	API_KEY    = "secret-api-key-12345"
	SECRET_KEY = "my-secret-key"
)

type FileProcessor struct {
	basePath   string
	cache      map[string][]byte // 메모리 누수 가능성
	processedFiles int
}

// 생성자에서 검증 부족
func NewFileProcessor(basePath string) *FileProcessor {
	return &FileProcessor{
		basePath: basePath, // 경로 검증 없음
		cache:    make(map[string][]byte),
	}
}

// 보안 이슈: 경로 순회 공격 가능
func (fp *FileProcessor) ReadFile(filename string) ([]byte, error) {
	// 입력 검증 없음
	fullPath := filepath.Join(fp.basePath, filename)
	
	// 보안 이슈: 경로 정보 로깅
	log.Printf("Reading file: %s", fullPath)
	
	// 성능 이슈: 파일을 통째로 메모리에 로드
	data, err := ioutil.ReadFile(fullPath)
	if err != nil {
		// 보안 이슈: 에러 정보 노출
		log.Printf("File read error: %v", err)
		return nil, err
	}
	
	// 메모리 누수: 캐시 크기 제한 없음
	fp.cache[filename] = data
	
	return data, nil
}

// 보안 이슈: 명령어 인젝션 가능
func (fp *FileProcessor) ExecuteCommand(command string) (string, error) {
	// 입력 검증 없이 시스템 명령어 실행
	log.Printf("Executing command: %s", command) // 명령어 로깅
	
	cmd := exec.Command("sh", "-c", command) // 매우 위험!
	output, err := cmd.Output()
	
	if err != nil {
		log.Printf("Command execution failed: %v", err)
		return "", err
	}
	
	return string(output), nil
}

// 성능 이슈: 비효율적인 파일 처리
func (fp *FileProcessor) ProcessFiles(pattern string) error {
	files, err := filepath.Glob(filepath.Join(fp.basePath, pattern))
	if err != nil {
		return err
	}
	
	// 성능 이슈: 모든 파일을 순차 처리 (병렬 처리 없음)
	for _, file := range files {
		// 성능 이슈: 매번 파일 크기 확인
		info, err := os.Stat(file)
		if err != nil {
			continue
		}
		
		// 대용량 파일도 동일하게 처리
		if info.Size() > 0 {
			data, err := fp.ReadFile(filepath.Base(file))
			if err != nil {
				continue
			}
			
			// 성능 이슈: 불필요한 문자열 변환
			content := string(data)
			
			// 보안 이슈: 약한 해시 함수 사용
			hash := md5.Sum(data)
			log.Printf("Processed file: %s, hash: %x", file, hash)
			
			// 성능 이슈: 비효율적인 문자열 검색
			for i := 0; i < len(content); i++ {
				if strings.HasPrefix(content[i:], "password") {
					log.Printf("Found password reference in %s at position %d", file, i)
				}
			}
		}
		
		fp.processedFiles++
	}
	
	return nil
}

// 메모리 누수: 무한 성장하는 캐시
func (fp *FileProcessor) GetFromCache(filename string) []byte {
	// 캐시 만료 로직 없음
	return fp.cache[filename]
}

// 보안 이슈: 민감한 정보 평문 저장
func (fp *FileProcessor) SaveConfig(config map[string]string) error {
	file, err := os.Create("config.txt")
	if err != nil {
		return err
	}
	defer file.Close()
	
	writer := bufio.NewWriter(file)
	
	for key, value := range config {
		// 비밀번호도 평문으로 저장
		line := fmt.Sprintf("%s=%s\n", key, value)
		writer.WriteString(line)
	}
	
	writer.Flush()
	
	// 보안 이슈: 파일 권한 설정 없음 (기본적으로 모든 사용자가 읽기 가능)
	log.Println("Configuration saved to config.txt")
	
	return nil
}

// 성능 이슈: 고루틴 누수 가능성
func (fp *FileProcessor) StartBackgroundProcessor() {
	// 고루틴 생명주기 관리 없음
	go func() {
		for {
			// 무한 루프에서 지속적으로 작업
			time.Sleep(1 * time.Second)
			
			// 성능 이슈: 매초마다 모든 파일 스캔
			files, _ := filepath.Glob(fp.basePath + "/*")
			for _, file := range files {
				// 불필요한 파일 접근
				os.Stat(file)
			}
			
			log.Printf("Background scan completed, processed files: %d", fp.processedFiles)
		}
	}()
}

// 코드 스타일 이슈: 네이밍 컨벤션 위반
func (fp *FileProcessor) Process_Large_File(FileName string) error {
	// 변수명 일관성 없음
	file_path := filepath.Join(fp.basePath, FileName)
	
	// 들여쓰기 일관성 없음
	    data, err := ioutil.ReadFile(file_path)
	if err != nil {
		return err
	}
	
	// 성능 이슈: 대용량 파일을 한번에 처리
	lines := strings.Split(string(data), "\n")
	
	    // 성능 이슈: 비효율적인 문자열 연산
	var result string
	for _, line := range lines {
		result += line + "\n" // 매번 새 문자열 생성
	}
	
	log.Printf("Processed %d lines", len(lines))
	return nil
}

// 보안 이슈: 사용자 입력을 직접 시스템 명령어로 실행
func (fp *FileProcessor) CustomCommand(userInput string) {
	// 입력 검증 전혀 없음
	command := fmt.Sprintf("echo %s > output.txt", userInput)
	
	// 명령어 인젝션 취약점
	exec.Command("sh", "-c", command).Run()
}

func main() {
	processor := NewFileProcessor("/tmp")
	
	// 보안 이슈: 하드코딩된 패턴
	processor.ProcessFiles("*.txt")
	
	// 백그라운드 프로세서 시작 (고루틴 누수 위험)
	processor.StartBackgroundProcessor()
	
	// 메인 고루틴 종료되지 않음
	select {}
}