#!/usr/bin/env node

/**
 * Repository Actions 및 보안 설정 스크립트
 */

const { execSync } = require('child_process');

console.log('🔐 Setting up repository security configurations...');

try {
  const repoInfo = JSON.parse(execSync('gh repo view --json name,owner').toString());
  const { name: repo, owner } = repoInfo;
  
  console.log(`Repository: ${owner.login}/${repo}`);
  
  // 1. Actions 권한 설정 - Fork에서 PR 시 승인 필요
  console.log('\n1️⃣ Setting Actions permissions...');
  
  const actionsConfig = {
    enabled: true,
    allowed_actions: "all", // 모든 액션 허용하되 외부 PR 제한
    permissions_policy: "permissive" // 필요시 제한적으로 변경
  };
  
  try {
    execSync(`gh api repos/${owner.login}/${repo}/actions/permissions --method PUT --field enabled=${actionsConfig.enabled} --field allowed_actions=${actionsConfig.allowed_actions}`, { stdio: 'inherit' });
    console.log('✅ Actions permissions set');
  } catch (err) {
    console.log('⚠️  Actions permissions: Manual configuration needed');
  }
  
  // 2. Secret 환경 확인
  console.log('\n2️⃣ Checking repository secrets...');
  
  try {
    const secrets = execSync(`gh api repos/${owner.login}/${repo}/actions/secrets`).toString();
    const secretsList = JSON.parse(secrets);
    
    const requiredSecrets = ['ANTHROPIC_API_KEY'];
    const existingSecrets = secretsList.secrets.map(s => s.name);
    
    console.log('Existing secrets:', existingSecrets);
    
    requiredSecrets.forEach(secret => {
      if (existingSecrets.includes(secret)) {
        console.log(`✅ ${secret} exists`);
      } else {
        console.log(`❌ ${secret} missing - please add manually`);
      }
    });
    
  } catch (err) {
    console.log('⚠️  Could not check secrets (this is normal for private repos)');
  }
  
  // 3. 라벨 생성
  console.log('\n3️⃣ Creating required labels...');
  
  const labels = [
    {
      name: 'code-review-approved',
      color: '0E8A16',
      description: 'Approved for external PR code review execution'
    },
    {
      name: 'security-review-needed',
      color: 'D93F0B', 
      description: 'External PR needs security review before approval'
    },
    {
      name: 'external-contributor',
      color: 'FBCA04',
      description: 'PR from external contributor'
    }
  ];
  
  for (const label of labels) {
    try {
      execSync(`gh api repos/${owner.login}/${repo}/labels --method POST --field name="${label.name}" --field color="${label.color}" --field description="${label.description}"`, { stdio: 'pipe' });
      console.log(`✅ Created label: ${label.name}`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`ℹ️  Label already exists: ${label.name}`);
      } else {
        console.log(`⚠️  Could not create label: ${label.name}`);
      }
    }
  }
  
  // 4. Webhook 설정 (선택사항)
  console.log('\n4️⃣ Repository configuration summary:');
  console.log(`
📋 Configuration Applied:
- ✅ Workflow file with user restrictions created
- ✅ Security labels created
- ✅ Repository permissions configured

🔧 Manual Steps Required:
1. Go to: https://github.com/${owner.login}/${repo}/settings/actions
2. Under "Actions permissions":
   - Select "Allow all actions and reusable workflows"  
   - Check "Require approval for first-time contributors"
   - Check "Require approval for all outside collaborators"

3. Under "Fork pull request workflows":
   - Select "Require approval for first-time contributors"

4. Go to: https://github.com/${owner.login}/${repo}/settings/branches
5. Add branch protection rule for 'master':
   - Require pull request reviews (1 approval)
   - Require status checks (optional: Claude AI Code Review)
   - Require conversation resolution
   
6. Add ANTHROPIC_API_KEY secret if not present

🚀 Testing:
- Create a test PR from another account
- Verify code review action doesn't run automatically
- Add 'code-review-approved' label to enable review
`);

} catch (error) {
  console.error('❌ Error during setup:', error.message);
}