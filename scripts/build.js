#!/usr/bin/env node

/**
 * Build Script for Claude Code Review Action
 * 
 * 이 스크립트는 GitHub Action을 배포 가능한 형태로 빌드합니다.
 * @vercel/ncc를 사용하여 모든 의존성을 하나의 파일로 번들링합니다.
 * 
 * 빌드 과정:
 * 1. dist 폴더 정리
 * 2. 의존성 설치
 * 3. 코드 린팅
 * 4. ncc로 번들링
 * 5. 필요한 파일 복사
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 콘솔 색상 코드
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

/**
 * 색상이 있는 로그 출력
 * @param {string} message - 출력할 메시지
 * @param {string} color - 색상 코드
 */
function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * 빌드 단계 시작 로그
 * @param {string} step - 단계 설명
 */
function startStep(step) {
  log(`\n${step}`, colors.bright + colors.blue);
}

/**
 * 성공 로그
 * @param {string} message - 성공 메시지
 */
function success(message) {
  log(`✅ ${message}`, colors.green);
}

/**
 * 에러 로그
 * @param {string} message - 에러 메시지
 */
function error(message) {
  log(`❌ ${message}`, colors.red);
}

/**
 * 경고 로그
 * @param {string} message - 경고 메시지
 */
function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

/**
 * 메인 빌드 함수
 */
async function build() {
  log('🚀 Building Claude Code Review Action...', colors.bright);
  
  try {
    // 1. dist 폴더 정리
    startStep('🧹 Cleaning dist folder...');
    const distPath = path.join(process.cwd(), 'dist');
    
    if (fs.existsSync(distPath)) {
      // 기존 dist 폴더 삭제
      fs.rmSync(distPath, { recursive: true, force: true });
      success('Removed existing dist folder');
    }
    
    // 새 dist 폴더 생성
    fs.mkdirSync(distPath, { recursive: true });
    success('Created fresh dist folder');

    // 2. 의존성 설치
    startStep('📦 Installing dependencies...');
    execSync('npm ci', { 
      stdio: 'inherit',
      cwd: process.cwd() 
    });
    success('Dependencies installed');

    // 3. 코드 린팅 (선택적)
    startStep('🔍 Running linter...');
    try {
      execSync('npm run lint', { 
        stdio: 'pipe',
        cwd: process.cwd() 
      });
      success('Linting passed');
    } catch (lintError) {
      warning('Linting failed, but continuing build...');
      // 린트 실패는 빌드를 중단시키지 않음
    }

    // 4. ncc로 번들링
    startStep('📦 Building with @vercel/ncc...');
    const nccCommand = [
      'npx @vercel/ncc build',
      'src/index.js',
      '-o dist',
      '--source-map',
      '--license licenses.txt',
      '--minify'
    ].join(' ');
    
    execSync(nccCommand, { 
      stdio: 'inherit',
      cwd: process.cwd() 
    });
    success('Bundle created successfully');

    // 5. 필수 파일 복사
    startStep('📋 Copying required files...');
    
    // action.yml은 루트에 있어야 함 (GitHub Actions 요구사항)
    const actionYmlSrc = path.join(process.cwd(), 'action.yml');
    const actionYmlDest = path.join(process.cwd(), 'action.yml');
    
    // 이미 루트에 있으므로 복사할 필요 없음
    if (fs.existsSync(actionYmlSrc)) {
      success('action.yml is in the correct location');
    } else {
      error('action.yml not found!');
      process.exit(1);
    }

    // 라이선스 파일 복사 (있는 경우)
    const licenseSrc = path.join(process.cwd(), 'LICENSE');
    const licenseDest = path.join(distPath, 'LICENSE');
    
    if (fs.existsSync(licenseSrc)) {
      fs.copyFileSync(licenseSrc, licenseDest);
      success('LICENSE file copied');
    }

    // 6. 빌드 검증
    startStep('🔍 Verifying build output...');
    
    const requiredFiles = [
      'dist/index.js',
      'dist/index.js.map',
      'dist/licenses.txt'
    ];
    
    const missingFiles = requiredFiles.filter(file => 
      !fs.existsSync(path.join(process.cwd(), file))
    );
    
    if (missingFiles.length > 0) {
      error(`Missing required files: ${missingFiles.join(', ')}`);
      process.exit(1);
    }
    
    success('All required files are present');

    // 7. 빌드 정보 출력
    startStep('📊 Build Summary:');
    
    const stats = fs.statSync(path.join(distPath, 'index.js'));
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`  Bundle size: ${sizeMB} MB`);
    console.log(`  Output directory: ${distPath}`);
    console.log(`  Build time: ${new Date().toISOString()}`);

    // 완료 메시지
    log('\n✅ Build completed successfully!', colors.bright + colors.green);
    log('\nNext steps:', colors.bright);
    console.log('  1. Test the action locally');
    console.log('  2. Commit and push changes');
    console.log('  3. Create a release tag');
    console.log('  4. Publish to GitHub Marketplace');

  } catch (error) {
    // 빌드 실패 처리
    error(`Build failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 스크립트가 직접 실행될 때만 빌드 수행
if (require.main === module) {
  build().catch(err => {
    error('Unexpected error during build');
    console.error(err);
    process.exit(1);
  });
}

module.exports = { build };