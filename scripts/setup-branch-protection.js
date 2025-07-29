#!/usr/bin/env node

/**
 * GitHub CLI를 사용하여 브랜치 보호 규칙을 설정하는 스크립트
 */

const { execSync } = require('child_process');

// 브랜치 보호 설정
const branchProtectionConfig = {
  required_status_checks: {
    strict: true,
    contexts: ["Claude AI Code Review / code-review"]
  },
  enforce_admins: false, // 관리자도 규칙 적용
  required_pull_request_reviews: {
    required_approving_review_count: 1,
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    require_last_push_approval: false
  },
  restrictions: null, // 푸시 제한 없음
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: true
};

console.log('🛡️  Setting up branch protection rules...');

try {
  // 현재 리포지토리 정보 확인
  const repoInfo = JSON.parse(execSync('gh repo view --json name,owner').toString());
  const { name: repo, owner } = repoInfo;
  
  console.log(`Repository: ${owner.login}/${repo}`);
  
  // 기본 브랜치 확인
  const defaultBranch = 'master'; // 또는 main
  
  // 브랜치 보호 규칙 적용
  const command = [
    'gh api',
    `repos/${owner.login}/${repo}/branches/${defaultBranch}/protection`,
    '--method PUT',
    `--field required_status_checks='${JSON.stringify(branchProtectionConfig.required_status_checks)}'`,
    `--field enforce_admins=${branchProtectionConfig.enforce_admins}`,
    `--field required_pull_request_reviews='${JSON.stringify(branchProtectionConfig.required_pull_request_reviews)}'`,
    `--field restrictions=${branchProtectionConfig.restrictions}`,
    `--field allow_force_pushes=${branchProtectionConfig.allow_force_pushes}`,
    `--field allow_deletions=${branchProtectionConfig.allow_deletions}`,
    `--field block_creations=${branchProtectionConfig.block_creations}`,
    `--field required_conversation_resolution=${branchProtectionConfig.required_conversation_resolution}`
  ].join(' ');
  
  console.log('Executing:', command);
  execSync(command, { stdio: 'inherit' });
  
  console.log('✅ Branch protection rules applied successfully!');
  
  // 현재 보호 규칙 확인
  console.log('\n📋 Current protection status:');
  execSync(`gh api repos/${owner.login}/${repo}/branches/${defaultBranch}/protection --jq '.required_status_checks.contexts, .required_pull_request_reviews.required_approving_review_count'`, { stdio: 'inherit' });
  
} catch (error) {
  console.error('❌ Error setting up branch protection:', error.message);
  
  // Fallback: 기본 보호 규칙 설정
  console.log('\n🔄 Applying basic protection rules...');
  
  try {
    const repoInfo2 = JSON.parse(execSync('gh repo view --json name,owner').toString());
    const { name: repo2, owner: owner2 } = repoInfo2;
    execSync(`gh api repos/${owner2.login}/${repo2}/branches/master/protection --method PUT --field required_pull_request_reviews='{"required_approving_review_count":1}'`, { stdio: 'inherit' });
    console.log('✅ Basic branch protection applied');
  } catch (fallbackError) {
    console.error('❌ Fallback also failed:', fallbackError.message);
    console.log('\n📝 Manual setup required. Please visit:');
    console.log(`   https://github.com/chimaek/claude-code-review-action/settings/branches`);
  }
}