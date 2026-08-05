import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyAD5tyTBUKibpiiGdaAYMUP0m6g257qYfw",
  authDomain: "air-flying-eeacf.firebaseapp.com",
  projectId: "air-flying-eeacf",
  storageBucket: "air-flying-eeacf.firebasestorage.app",
  messagingSenderId: "473270505100",
  appId: "1:473270505100:web:4ee8c8a647d5824df075a9",
  measurementId: "G-C8NH7XSDB3"
};

let app, analytics, auth, provider;
try {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
  auth = getAuth(app);
  provider = new GoogleAuthProvider();
} catch (error) {
  console.error("Firebase 초기화 실패 (로컬 우회 모드 작동):", error);
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 비행기 이미지 로드
const playerImg = new Image();
playerImg.src = 'public/basic.png';

const premiumImg = new Image();
premiumImg.src = 'public/premium_01.png';

const enemyImg = new Image();
enemyImg.src = 'public/enemy.png';

const meteorImg = new Image();
meteorImg.src = 'public/unseog.png';

const octopusImg1 = new Image();
octopusImg1.src = 'public/aline.png';

const octopusImg2 = new Image();
octopusImg2.src = 'public/aline_1.png';

// 사운드 로드
const bgm = new Audio('public/sound/bmg.mp3');
bgm.loop = true;
bgm.volume = 0.3; // 배경음 작게

const shotSound = new Audio('public/sound/me_laser.wav');
const enemyShotSound = new Audio('public/sound/ememy.wav');
const explosionSound = new Audio('public/sound/explision.wav');
const gameOverSound = new Audio('public/sound/game over.wav');

const allSounds = [bgm, shotSound, enemyShotSound, explosionSound, gameOverSound];

// 몰폰용 음소거 로직
let isMuted = false;
const muteBtn = document.getElementById('muteBtn');

function applyMuteState() {
  if (isMuted) {
    muteBtn.innerText = '🔇';
    allSounds.forEach(snd => snd.volume = 0);
  } else {
    muteBtn.innerText = '🔊';
    allSounds.forEach(snd => snd.volume = 1);
  }
}

muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  localStorage.setItem('airFlyingMuted', isMuted);
  applyMuteState();
});

let isBgmPlaying = false;
let gameOverTriggered = false;

function triggerGameOver() {
  if (!gameOverTriggered) {
    isGameOver = true;
    gameOverTriggered = true;
    bgm.pause();
    gameOverSound.currentTime = 0;
    gameOverSound.play().catch(e => {});
    
    // 죽는 즉시 모든 애니메이션(게임 엔진) 강제 완전 정지!
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    
    // 게임 오버 창 띄우기
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('finalScore').innerText = '최종 점수: ' + score + '점';
  }
}

let score = 0;
let isGameOver = false;
let shieldLevel = 0; // 0: None, 1: Blue, 2: Gold
let shieldBreakTimer = 0;
let bombCount = 0;
let bombFlashTimer = 0; // 쉴드 파괴 연출용 타이머
let invincibleTimer = 0; // 쉴드 파괴 후 무적 시간 타이머
let gameFrameCount = 0; // 생존 시간(레벨) 측정 타이머
let bosses = []; // 거대 보스 오브젝트 배열
let slowEndTime = 0;

// --- 별(배경) 초기화 ---
const stars = [];
const NUM_STARS = 100;
for (let i = 0; i < NUM_STARS; i++) {
  stars.push({
    x: Math.random() * (window.innerWidth || 800),
    y: Math.random() * (window.innerHeight || 600),
    radius: Math.random() * 1.5 + 0.5,
    speed: Math.random() * 2 + 0.5,
    alpha: Math.random()
  });
}
// ----------------------
const targets = [];
let targetSpawnTimer = 0;

// 플레이어 비행기 (파란색 정사각형 50x50)
const player = {
  width: 50,
  height: 50,
  x: 0,
  y: 0,
  speed: 4, // 원래 5에서 80% 수준으로 감속
  color: '#0077ff'
};

let isInitialized = false;

function resizeCanvas() {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  
  if (winH > winW) {
    // 1. 모바일 환경 (세로가 가로보다 길 때): 100% 꽉 차게
    canvas.width = winW;
    canvas.height = winH;
  } else {
    // 2. PC 환경 (가로가 세로보다 길거나 같을 때): 높이 100%, 가로는 3:4 비율
    const newW = winH * (3 / 4);
    canvas.width = newW;
    canvas.height = winH;
  }
  
  // CSS 크기도 논리적 크기와 동일하게 설정
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';

  if (!isInitialized) {
    // 처음 실행 시 하단 중앙 배치
    player.x = (canvas.width - player.width) / 2;
    player.y = canvas.height - player.height - 20;
    isInitialized = true;
  } else {
    // 3. 비행기는 화면 밖으로 나가지 못하게 유지 (리사이즈 보정)
    if (player.x + player.width > canvas.width) {
      player.x = Math.max(0, canvas.width - player.width);
    }
    if (player.y + player.height > canvas.height) {
      player.y = Math.max(0, canvas.height - player.height);
    }
  }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // 초기 화면 비율 설정

// 키 입력 상태 관리
const keys = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  ' ': false // 스페이스바 추가
};

// 키보드 이벤트 리스너 등록
window.addEventListener('keydown', (e) => {
  if (!isBgmPlaying) {
    bgm.play().catch(e => {});
    isBgmPlaying = true;
  }
  if (e.key in keys) {
    keys[e.key] = true;
    if (e.key === ' ' || e.key.startsWith('Arrow')) {
      e.preventDefault(); // 스페이스바, 방향키 입력 시 브라우저 스크롤 방지
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    keys[' '] = false;
  }
  
  // R 키: 폭탄 사용 (VIP 기체 전용)
  if (e.key === 'r' || e.key === 'R') {
    if (bombCount > 0 && isGameStarted && !isGameOver) {
      bombCount--;
      // 폭탄 사용: 화면 내 일반 적, 적 미사일 전멸. 보스에게는 큰 데미지.
      targets.length = 0; 
      enemyMissiles.length = 0;
      bosses.forEach(b => b.hp -= 30);
      
      bombFlashTimer = 30; // 30프레임 동안 화면 번쩍임 효과
      explosionSound.currentTime = 0;
      explosionSound.play().catch(e => {});
    }
  }
  if (e.key.startsWith('Arrow')) {
    keys[e.key] = false;
    e.preventDefault();
  }
});

// 터치 이벤트 리스너 등록 (스마트폰 대응)
let isTouching = false;
window.addEventListener('touchstart', (e) => {
  isTouching = true;
});
window.addEventListener('touchend', (e) => {
  isTouching = false;
});
window.addEventListener('touchcancel', (e) => {
  isTouching = false;
});

function isColliding(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&
         rect1.x + rect1.width > rect2.x &&
         rect1.y < rect2.y + rect2.height &&
         rect1.y + rect1.height > rect2.y;
}

// 미사일 상태 관리
const missiles = [];
const enemyMissiles = []; // 적 미사일 배열
let MISSILE_SPEED = 10.5; // 원래 15에서 70%로 감속 (기체별로 변동 가능)
const ENEMY_MISSILE_SPEED = 10;
const MISSILE_WIDTH = 5;
const MISSILE_HEIGHT = 15;
let fireCooldown = 0;
let FIRE_RATE = 20; // 연속 발사 간격 (기존 10에서 20으로 증가시켜 연사속도 50% 하향, 기체별 변동)

// 위치 업데이트 및 화면 경계 제한
function update() {
  if (!isGameStarted) return;
  if (isGameOver) return; // 강제 정지 전 안전장치

  // 무적 타이머 감소
  if (invincibleTimer > 0) {
    invincibleTimer--;
  }

  // 레벨 계산 (별자리 워프 효과용)
  let currentLevel = 1 + Math.floor(gameFrameCount / 1200);
  let starSpeedMultiplier = currentLevel >= 11 ? 20 : 1; // 2번째 보스(레벨 10) 처치 후 11레벨부터 워프 모드

  // 별(배경) 이동 및 반짝임 처리
  for (let i = 0; i < stars.length; i++) {
    let s = stars[i];
    // 워프 모드일 때는 선처럼 보이게 만들기 위한 스피드 뻥튀기
    s.y += s.speed * starSpeedMultiplier;
    s.alpha += (Math.random() - 0.5) * 0.1; // 반짝임
    if (s.alpha < 0) s.alpha = 0;
    if (s.alpha > 1) s.alpha = 1;

    // 화면 밖으로 나가면 위에서 다시 나타나게 무한 스크롤
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
  }

  if (isGameOver) return; // 강제 정지 전 안전장치

  let currentSpeed = player.speed;
  if (Date.now() < slowEndTime) {
    currentSpeed *= 0.5;
  }

  if (keys.ArrowUp) {
    player.y -= currentSpeed;
  }
  if (keys.ArrowDown) {
    player.y += currentSpeed;
  }
  if (keys.ArrowLeft) {
    player.x -= currentSpeed;
  }
  if (keys.ArrowRight) {
    player.x += currentSpeed;
  }

  // 화면 밖으로 나가지 않도록 경계 제한 (Clamping)
  if (player.x < 0) {
    player.x = 0;
  }
  if (player.x + player.width > canvas.width) {
    player.x = canvas.width - player.width;
  }
  if (player.y < 0) {
    player.y = 0;
  }
  if (player.y + player.height > canvas.height) {
    player.y = canvas.height - player.height;
  }

  // 쿨다운 감소
  if (fireCooldown > 0) {
    fireCooldown--;
  }

  // 미사일 발사 (스페이스바 또는 화면 터치)
  if ((keys[' '] || isTouching) && fireCooldown === 0) {
    if (selectedFighterType === 'vip') {
      // VIP 기체: 미사일 2줄 (듀얼 샷)
      missiles.push({ x: player.x + player.width * 0.1, y: player.y, width: MISSILE_WIDTH, height: MISSILE_HEIGHT });
      missiles.push({ x: player.x + player.width * 0.9 - MISSILE_WIDTH, y: player.y, width: MISSILE_WIDTH, height: MISSILE_HEIGHT });
    } else {
      // 기본 & 프리미엄 01 기체: 미사일 1줄 (싱글 샷)
      missiles.push({
        x: player.x + player.width / 2 - MISSILE_WIDTH / 2, // 비행기 중앙에서 발사
        y: player.y,
        width: MISSILE_WIDTH,
        height: MISSILE_HEIGHT
      });
    }
    fireCooldown = FIRE_RATE; // 쿨다운 리셋
    shotSound.currentTime = 0;
    shotSound.play().catch(e => {});
  }

  // 미사일 이동 및 메모리 정리 (화면 밖으로 나가면 삭제)
  for (let i = missiles.length - 1; i >= 0; i--) {
    let m = missiles[i];
    m.y -= MISSILE_SPEED; // 위로 빠르게 이동

    // (매우 중요) 화면 위쪽으로 완전히 벗어난 미사일은 데이터에서 삭제
    if (m.y + m.height < 0) {
      missiles.splice(i, 1);
    }
  }

  // 적 미사일 이동, 충돌 및 메모리 정리
  for (let i = enemyMissiles.length - 1; i >= 0; i--) {
    let em = enemyMissiles[i];
    em.x += (em.vx || 0); // 좌우 확산탄을 위한 vx 추가
    em.y += (em.vy || ENEMY_MISSILE_SPEED); // 보스탄과 잡몹탄 속도 구분을 위한 vy 추가

    // 화면 밖으로 나가면 삭제
    if (em.y > canvas.height) {
      enemyMissiles.splice(i, 1);
      continue;
    }

    // 플레이어와 적 미사일 충돌 검사
    if (invincibleTimer === 0 && isColliding(player, enemyMissiles[i])) {
      if (shieldLevel > 0) {
        shieldLevel--; // 쉴드 1단계 깎임
        shieldBreakTimer = 15;
        invincibleTimer = 60;
        enemyMissiles.splice(i, 1); // 미사일 소멸
        continue;
      } else {
        triggerGameOver();
      }
    }
  }

  // 시간 기반 레벨 계산 (20초 = 1200프레임마다 1레벨, 레벨 제한 해제!)
  if (bosses.length === 0) {
    gameFrameCount++; // 보스가 없을 때만 타이머 가동 (보스전 중 레벨 동결)
  }
  let level = 1 + Math.floor(gameFrameCount / 1200);

  // 1분 30초(5400프레임, 약 5레벨 진입 시점)마다 거대 보스 주기적 스폰
  if (bosses.length === 0 && gameFrameCount > 0 && gameFrameCount % 5400 === 0) {
    bosses.push({
      x: canvas.width / 2 - 100,
      y: -200,
      width: 200,
      height: 200,
      hp: 100 + (level * 20), // 레벨 비례 보스 체력 증가
      maxHp: 100 + (level * 20),
      speed: 1.5 + (level * 0.1), // 레벨 비례 보스 이동 속도
      direction: 1,
      isEntering: true, // 등장 중인지 여부
      fireTimer: 0 // 미사일 발사 타이머
    });
    // 보스 등장 시 경고음 (있는 사운드 재사용)
    explosionSound.currentTime = 0;
    explosionSound.play().catch(e => {});
    // 스폰 후 동일 프레임에서 무한 생성되지 않도록 1프레임 즉시 추가
    gameFrameCount++;
  }

  // 보스 이동 및 공격 로직
  for (let i = bosses.length - 1; i >= 0; i--) {
    let b = bosses[i];
    
    if (b.isEntering) {
      b.y += 1.5;
      if (b.y >= 30) b.isEntering = false;
    } else {
      b.x += b.speed * b.direction;
      if (b.x <= 0 || b.x + b.width >= canvas.width) {
        b.direction *= -1;
      }
      
      b.fireTimer++;
      // 보스 공격 속도도 레벨에 따라 빨라짐 (최소 20프레임)
      let bossFireRate = Math.max(20, 70 - level * 3);
      if (b.fireTimer > bossFireRate) {
        b.fireTimer = 0;
        let centerX = b.x + b.width / 2 - MISSILE_WIDTH / 2;
        let bottomY = b.y + b.height;
        // 3갈래 부채꼴 발사
        enemyMissiles.push({ x: centerX, y: bottomY, width: MISSILE_WIDTH, height: MISSILE_HEIGHT, vx: 0, vy: ENEMY_MISSILE_SPEED * 0.9 });
        enemyMissiles.push({ x: centerX, y: bottomY, width: MISSILE_WIDTH, height: MISSILE_HEIGHT, vx: -2, vy: ENEMY_MISSILE_SPEED * 0.8 });
        enemyMissiles.push({ x: centerX, y: bottomY, width: MISSILE_WIDTH, height: MISSILE_HEIGHT, vx: 2, vy: ENEMY_MISSILE_SPEED * 0.8 });
        
        enemyShotSound.currentTime = 0;
        enemyShotSound.play().catch(e => {});
      }
    }

    // 플레이어 미사일로 보스 타격
    for (let j = missiles.length - 1; j >= 0; j--) {
      if (isColliding(missiles[j], b)) {
        b.hp--;
        missiles.splice(j, 1);
        
        if (b.hp <= 0) {
          score += 1000; // 보스 처치 점수
          explosionSound.currentTime = 0;
          explosionSound.play().catch(e => {});
          bosses.splice(i, 1);
          break; // 다음 보스(있다면)로 넘어감
        }
      }
    }
    
    // 보스와 플레이어 본체 충돌
    if (bosses[i] && invincibleTimer === 0 && isColliding(player, bosses[i])) {
      if (shieldLevel > 0) {
        shieldLevel--; // 쉴드 1단계 강등
        shieldBreakTimer = 15;
        invincibleTimer = 60;
      } else {
        triggerGameOver();
      }
    }
  }

  // 레벨에 따른 스폰 주기 계산
  let spawnInterval = Math.max(15, 60 - (level - 1) * 5);
  // 레벨 11 이상 하이퍼 모드: 2번째 보스 격파 후 스폰 빈도 미친듯이 증가
  if (level >= 11) {
    spawnInterval = Math.max(2, 10 - (level - 11) * 2);
  }

  // 타겟 생성 로직
  targetSpawnTimer++;
  if (targetSpawnTimer > spawnInterval) {
    targetSpawnTimer = 0;
    // 적기(airship)의 등장 확률을 대폭(50%로) 상향
    const types = ['airship', 'airship', 'meteorite', 'octopus'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let size = 40;
    if (type === 'airship') {
      size = 60;
    } else if (type === 'meteorite') {
      const meteoriteSizes = [30, 50, 70]; // 소, 중, 대 3가지 크기
      size = meteoriteSizes[Math.floor(Math.random() * meteoriteSizes.length)];
    } else if (type === 'octopus') {
      size = 80; // 기존 40의 200%
    }
    
    // 레벨에 따라 낙하 속도 증가
    let baseSpeed = 3 + Math.random() * 2;
    let levelSpeedBonus = (level - 1) * 0.5;
    if (level >= 11) {
      levelSpeedBonus += (level - 10) * 3; // 11레벨부터 적 하강 속도 급발진
    }

    targets.push({
      x: Math.random() * (canvas.width - size),
      y: -size,
      width: size,
      height: size,
      type: type,
      speed: baseSpeed + levelSpeedBonus
    });
  }

  // 타겟 이동 및 충돌 처리
  for (let i = targets.length - 1; i >= 0; i--) {
    let t = targets[i];
    t.y += t.speed;

    // 화면 밖으로 나가면 삭제
    if (t.y > canvas.height) {
      targets.splice(i, 1);
      continue;
    }

    // 적 비행선 랜덤 사격
    if (t.type === 'airship') {
      let fireChance = 0.01 + (level * 0.002); 
      if (Math.random() < fireChance) {
        enemyMissiles.push({
          x: t.x + t.width / 2 - MISSILE_WIDTH / 2,
          y: t.y + t.height,
          width: MISSILE_WIDTH,
          height: MISSILE_HEIGHT
        });
        enemyShotSound.currentTime = 0;
        enemyShotSound.play().catch(e => {});
      }
    }

    // 플레이어 충돌 검사
    if (invincibleTimer === 0 && isColliding(player, t)) {
      if (t.type === 'airship' || t.type === 'meteorite') {
        if (shieldLevel > 0) {
          shieldLevel--; // 쉴드 파괴(강등)
          shieldBreakTimer = 15; // 파괴 이펙트 15프레임 지속
          invincibleTimer = 60; // 쉴드 파괴 후 1초(60프레임) 무적
          targets.splice(i, 1); // 부딪힌 적 파괴
          continue;
        } else {
          triggerGameOver();
        }
      } else if (t.type === 'octopus') {
        slowEndTime = Date.now() + 3000;
        targets.splice(i, 1);
        continue;
      }
    }

    // 미사일 충돌 검사
    let hitMissileIndex = -1;
    for (let j = 0; j < missiles.length; j++) {
      if (isColliding(missiles[j], t)) {
        hitMissileIndex = j;
        break;
      }
    }

    if (hitMissileIndex !== -1) {
      missiles.splice(hitMissileIndex, 1); // 미사일 삭제
      if (t.type === 'airship') {
        targets.splice(i, 1);
        score += 10;
        explosionSound.currentTime = 0;
        explosionSound.play().catch(e => {});
      } else if (t.type === 'octopus') {
        targets.splice(i, 1);
        score += 5; // 문어 맞추면 5점 획득
        explosionSound.currentTime = 0;
        explosionSound.play().catch(e => {}); // 문어도 타격감 있게 폭발음 재생
      }
      // 운석은 미사일만 파괴되고 타겟은 삭제 안됨
    }
  }
}

// 화면 렌더링
function render() {
  // 1. 검은색 배경 그리기
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1.5 반짝이는 별 그리기
  for (let i = 0; i < stars.length; i++) {
    let s = stars[i];
    ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. 플레이어(비행기 이미지) 그리기 및 쉴드(에너지 필드) 연출
  let currentFighterImg = playerImg;
  
  ctx.save();
  
  // 쉴드 파괴 이펙트 (강렬한 하얀색 실루엣 발광)
  if (shieldBreakTimer > 0) {
    let alpha = shieldBreakTimer / 15;
    ctx.shadowBlur = 50;
    ctx.shadowColor = 'white';
    ctx.globalAlpha = alpha;
    
    // 하얀색 글로우를 강조하기 위해 여러 번 겹쳐 그리기
    if (currentFighterImg.complete && currentFighterImg.naturalHeight !== 0) {
      ctx.drawImage(currentFighterImg, player.x, player.y, player.width, player.height);
      ctx.drawImage(currentFighterImg, player.x, player.y, player.width, player.height);
    }
    
    shieldBreakTimer--;
    ctx.globalAlpha = 1.0; // 투명도 원상복구
  }
  // 정상 쉴드 활성화 상태 (푸른색/황금색 플라즈마 에너지 필드)
  else if (shieldLevel > 0) {
    let pulse = 15 + Math.sin(Date.now() / 100) * 10; // 5 ~ 25 사이로 요동침
    ctx.shadowBlur = pulse;
    // 쉴드 레벨에 따라 색상 차등 적용 (2: 황금색, 1: 푸른색)
    ctx.shadowColor = shieldLevel === 2 ? '#ffcc00' : '#00e5ff';
    
    // 에너지 느낌을 주입하기 위해 약간 투명하게 한 겹 더 그려서 글로우 증폭
    if (currentFighterImg.complete && currentFighterImg.naturalHeight !== 0) {
      ctx.globalAlpha = shieldLevel === 2 ? 0.7 : 0.5; // 황금 쉴드가 약간 더 진함
      ctx.drawImage(currentFighterImg, player.x, player.y, player.width, player.height);
      ctx.globalAlpha = 1.0;
    }
  }

  // 실제 비행기 본체 그리기 (쉴드가 있든 없든 항상 그림)
  if (currentFighterImg.complete && currentFighterImg.naturalHeight !== 0) {
    if (invincibleTimer > 0) {
      ctx.globalAlpha = (Math.floor(Date.now() / 100) % 2 === 0) ? 0.3 : 1.0; // 무적 상태 시 깜빡임
    }
    ctx.drawImage(currentFighterImg, player.x, player.y, player.width, player.height);
  }
  ctx.restore();

  // 3. 미사일(노란색) 그리기
  ctx.fillStyle = '#ffff00'; // 노란색
  for (let i = 0; i < missiles.length; i++) {
    let m = missiles[i];
    ctx.fillRect(m.x, m.y, m.width, m.height);
  }

  // 적 미사일(주황색) 그리기
  ctx.fillStyle = '#ffa500'; // 주황색
  for (let i = 0; i < enemyMissiles.length; i++) {
    let em = enemyMissiles[i];
    ctx.fillRect(em.x, em.y, em.width, em.height);
  }

  // 폭탄 사용 시 전체 화면 번쩍임 효과
  if (bombFlashTimer > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${bombFlashTimer / 30})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    bombFlashTimer--;
  }

  // 보스 렌더링 (거대화 및 붉은 글로우)
  for (let i = 0; i < bosses.length; i++) {
    let b = bosses[i];
    ctx.save();
    ctx.shadowBlur = 40 + Math.sin(Date.now() / 150) * 15;
    ctx.shadowColor = 'red';
    
    if (enemyImg.complete && enemyImg.naturalHeight !== 0) {
      ctx.drawImage(enemyImg, b.x, b.y, b.width, b.height);
    } else {
      ctx.fillStyle = 'darkred';
      ctx.fillRect(b.x, b.y, b.width, b.height);
    }
    
    // HP 바 (체력바)
    let hpPercent = b.hp / 30; // 최대 체력 30으로 변경
    ctx.fillStyle = 'red';
    ctx.fillRect(b.x + 20, b.y - 15, (b.width - 40) * hpPercent, 8);
    ctx.strokeStyle = 'white';
    ctx.strokeRect(b.x + 20, b.y - 15, b.width - 40, 8);
    ctx.restore();
  }

  // 4. 타겟 그리기
  for (let i = 0; i < targets.length; i++) {
    let t = targets[i];
    if (t.type === 'airship') {
      if (enemyImg.complete && enemyImg.naturalHeight !== 0) {
        ctx.drawImage(enemyImg, t.x, t.y, t.width, t.height);
      } else {
        ctx.fillStyle = 'red';
        ctx.fillRect(t.x, t.y, t.width, t.height);
      }
    } else if (t.type === 'meteorite') {
      if (meteorImg.complete && meteorImg.naturalHeight !== 0) {
        ctx.drawImage(meteorImg, t.x, t.y, t.width, t.height);
      } else {
        ctx.fillStyle = '#555555';
        ctx.beginPath();
        ctx.arc(t.x + t.width / 2, t.y + t.height / 2, t.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (t.type === 'octopus') {
      // 500ms마다 이미지 번갈아 보여주기 (애니메이션 효과)
      const isImg1 = Math.floor(Date.now() / 500) % 2 === 0;
      const currentOctopusImg = isImg1 ? octopusImg1 : octopusImg2;
      
      if (currentOctopusImg.complete && currentOctopusImg.naturalHeight !== 0) {
        ctx.drawImage(currentOctopusImg, t.x, t.y, t.width, t.height);
      } else {
        ctx.fillStyle = 'purple';
        ctx.fillRect(t.x, t.y, t.width, t.height);
      }
    }
  }

  // 5. UI (점수, 레벨 및 게임 오버) 그리기
  let currentLevel = 1 + Math.floor(gameFrameCount / 1200);
  currentLevel = Math.min(10, currentLevel);
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Score: ' + score, 10, 30);
  ctx.fillText('Level: ' + currentLevel, 10, 55);

}

let animationId;
// 메인 게임 루프
function gameLoop() {
  if (!isGameStarted || isGameOver) return; // 게임이 멈춰야 할 때는 다음 프레임을 예약하지 않음 (루프 완벽 종료)
  update();
  render();
  animationId = requestAnimationFrame(gameLoop);
}

// 페이지 로드 시 로컬 스토리지 상태 불러오기
window.addEventListener('DOMContentLoaded', () => {
  // 1. 아이디 저장 로드
  const savedId = localStorage.getItem('savedAirFlyingId');
  if (savedId) {
    document.getElementById('customId').value = savedId;
    document.getElementById('saveIdCheck').checked = true;
  }
  
  // 2. 음소거 설정 로드
  const savedMute = localStorage.getItem('airFlyingMuted');
  if (savedMute === 'true') {
    isMuted = true;
    applyMuteState();
  }
});

let isGameStarted = false;
let isAdmin = false; // 관리자 여부 체크

// 구글 로그인 버튼 이벤트 리스너
document.getElementById('googleLoginBtn').addEventListener('click', () => {
  const isLocal = window.location.protocol === 'file:' || window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  if (isLocal) {
    console.log("로컬 테스트 감지: 구글 로그인을 우회합니다.");
    checkAdminAndStart({ email: 'local@test.com' });
    return;
  }
  signInWithPopup(auth, provider)
    .then((result) => {
      console.log("Logged in as:", result.user.displayName);
      checkAdminAndStart(result.user);
    }).catch((error) => {
      console.error("Login failed:", error);
      alert("로그인에 실패했습니다.");
    });
});

// 커스텀 아이디(꼼수) 로그인 버튼 이벤트 리스너
document.getElementById('customLoginBtn').addEventListener('click', () => {
  const idInput = document.getElementById('customId').value.trim();
  const pwInput = document.getElementById('customPw').value.trim();
  const saveIdCheck = document.getElementById('saveIdCheck').checked;
  
  if (idInput.length < 3) {
    alert("아이디는 3글자 이상 입력해주세요!");
    return;
  }
  if (pwInput.length < 6) {
    alert("비밀번호는 6자리 이상 입력해주세요!");
    return;
  }
  
  // 아이디 저장 로직
  if (saveIdCheck) {
    localStorage.setItem('savedAirFlyingId', idInput);
  } else {
    localStorage.removeItem('savedAirFlyingId');
  }
  
  // 몰래 이메일 형식으로 변환
  const fakeEmail = idInput + '@air-flying.com';
  
  // 먼저 로그인을 시도해봅니다 (기존 유저인지 확인)
  signInWithEmailAndPassword(auth, fakeEmail, pwInput)
    .then((userCredential) => {
      console.log("Custom login success:", idInput);
      checkAdminAndStart(userCredential.user);
    })
    .catch((error) => {
      // 만약 유저가 없거나 비밀번호가 틀렸다는 에러가 나오면
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        // 회원가입을 시도해봅니다! (유저가 없는 경우 회원가입 성공)
        createUserWithEmailAndPassword(auth, fakeEmail, pwInput)
          .then((userCredential) => {
            console.log("Custom signup success:", idInput);
            checkAdminAndStart(userCredential.user);
          })
          .catch((signupError) => {
            if (signupError.code === 'auth/email-already-in-use') {
              // 이미 가입된 아이디인데 위에서 로그인이 실패했다면, 비밀번호가 틀린 것!
              alert("비밀번호가 틀렸습니다!");
            } else {
              alert("가입 오류: " + signupError.message);
            }
          });
      } else {
        alert("로그인 오류: " + error.message);
      }
    });
});

// === 격납고 (비행기 선택) 로직 (Stitch UI 기반) ===
const fighters = [
  { type: 'premium', status: 'ACTIVE', imgSrc: 'public/premium_01.png', shieldClass: 'blue-shield' },
  { type: 'vip', status: 'VIP_MODE', imgSrc: 'public/premium_02.png', shieldClass: 'gold-shield' }
];

let currentFighterIndex = 0;
let selectedFighterType = 'premium';

const prevFighterBtn = document.getElementById('prevFighterBtn');
const nextFighterBtn = document.getElementById('nextFighterBtn');
const currentFighterImg = document.getElementById('currentFighterImg');
const fighterStatusText = document.getElementById('fighterStatusText');
const startGameBtn = document.getElementById('startGameBtn');

function updateFighterDisplay() {
  const fighter = fighters[currentFighterIndex];
  selectedFighterType = fighter.type;
  
  const currentFighterImg = document.getElementById('currentFighterImg');
  if (currentFighterImg) {
    currentFighterImg.src = fighter.imgSrc;
    // 이전 보호막 클래스 제거 후 새 보호막 적용
    currentFighterImg.className = '';
    if (fighter.shieldClass) {
      currentFighterImg.classList.add(fighter.shieldClass);
    }
  }
  
  const prevBtn = document.getElementById('prevFighterBtn');
  if (prevBtn) {
    if (currentFighterIndex === 0) {
      prevBtn.style.display = 'none';
    } else {
      prevBtn.style.display = 'block';
    }
  }
  
  const nextBtn = document.getElementById('nextFighterBtn');
  if (nextBtn) {
    if (currentFighterIndex === fighters.length - 1) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = 'block';
    }
  }
  
  // 하단 결제 버튼 금액 업데이트
  const startBtnText = document.querySelector('#startGameBtn .nav-text');
  if (startBtnText) {
    if (currentFighterIndex === 0) {
      startBtnText.textContent = '$6.99 결제 하기';
    } else if (currentFighterIndex === 1) {
      startBtnText.textContent = '$10.99 결제 하기';
    }
  }
}

if (prevFighterBtn) {
  prevFighterBtn.addEventListener('click', () => {
    currentFighterIndex = (currentFighterIndex - 1 + fighters.length) % fighters.length;
    updateFighterDisplay();
  });
}

if (nextFighterBtn) {
  nextFighterBtn.addEventListener('click', () => {
    currentFighterIndex = (currentFighterIndex + 1) % fighters.length;
    updateFighterDisplay();
  });
}

// 초기 표시
updateFighterDisplay();

// 게임 시작 공통 함수 (모달에서 출격 시 호출)
function launchGame() {
  document.getElementById('hangarScreen').classList.add('hidden');
  
  if (selectedFighterType === 'vip') {
    // VIP 기체 스펙 (사기급 스피드 1.96배, 3목숨, 3폭탄)
    player.width = 90;
    player.height = 90;
    player.speed = 4 * 1.96;
    MISSILE_SPEED = 10.5 * 1.96;
    FIRE_RATE = 10; // 기존 발속의 약 2배 빠른 10프레임 연사
    shieldLevel = 2; // 황금 쉴드 -> 블루 쉴드 -> 맨몸 (3목숨)
    bombCount = 3; // 특수 폭탄 3개
    playerImg.src = fighters[currentFighterIndex].imgSrc;
  } else if (selectedFighterType === 'premium') {
    // 프리미엄 01 스펙 (스피드 1.4배, 2목숨)
    player.width = 90;
    player.height = 90;
    player.speed = 4 * 1.4;
    MISSILE_SPEED = 10.5 * 1.4;
    FIRE_RATE = 14;
    shieldLevel = 1; // 블루 쉴드 -> 맨몸 (2목숨)
    bombCount = 0;
    playerImg.src = fighters[currentFighterIndex].imgSrc;
  } else {
    // 기본 전투기 스펙 (스피드 1.0배, 1목숨)
    player.width = 60;
    player.height = 60;
    player.speed = 4;
    MISSILE_SPEED = 10.5;
    FIRE_RATE = 20;
    shieldLevel = 0; // 쉴드 없음 (1목숨)
    bombCount = 0;
    playerImg.src = 'public/basic.png'; // 기본 기체 이미지 강제 적용
  }
  
  // 위치를 다시 하단 중앙으로 보정
  player.x = (canvas.width - player.width) / 2;
  player.y = canvas.height - player.height - 20;
  
  // 새 게임을 위한 보스 & 레벨 초기화
  gameFrameCount = 0;
  bosses.length = 0;

  if (!isGameStarted) {
    isGameStarted = true;
    bgm.play().catch(e => { console.log("BGM play failed", e); });
    isBgmPlaying = true;
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    gameLoop();
  }
}

// 관리자 여부 확인 후 격납고 띄우기
function checkAdminAndStart(user) {
  if (user && user.email) {
    if (user.email === 'boss@air-flying.com' || user.email === 'boos@air-flying.com') {
      isAdmin = true;
      console.log("관리자 계정 로그인 감지! 격납고 자물쇠 해제!");
      // 자물쇠 UI 풀기
      if (typeof premiumCard !== 'undefined' && premiumCard) {
        premiumCard.classList.remove('locked');
        document.getElementById('premiumLockIcon').style.display = 'none';
      }
    } else {
      isAdmin = false;
    }
  }
  
  // 게임 화면 대신 격납고 화면 표시
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('hangarScreen').classList.remove('hidden');
}

// 로그인 상태 자동 확인 (새로고침 시)
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('loginScreen').classList.add('hidden');
    // 아직 게임 화면으로 안 넘어간 상태라면 격납고 띄우기
    if (!isGameStarted && document.getElementById('hangarScreen').classList.contains('hidden')) {
      checkAdminAndStart(user);
    }
  }
});

// 재시작 이벤트 처리
document.getElementById('restartBtn').addEventListener('click', () => {
  score = 0;
  isGameOver = false;
  gameOverTriggered = false;
  invincibleTimer = 0; // 무적 상태 초기화
  gameFrameCount = 0; // 레벨 측정 초기화
  bosses.length = 0; // 보스 초기화
  bgm.pause();
  bgm.currentTime = 0;
  slowEndTime = 0;
  targets.length = 0;
  missiles.length = 0;
  enemyMissiles.length = 0;
  targetSpawnTimer = 0;
  
  // 플레이어 위치 초기화
  player.x = (canvas.width - player.width) / 2;
  player.y = canvas.height - player.height - 20;
  
  isGameStarted = false; // 게임 일시 정지 (선택창 상태)
  
  render(); // 깨끗해진 밤하늘과 플레이어 기체를 1회 렌더링
  
  // 게임 오버 창 닫고 격납고 띄우기
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('hangarScreen').classList.remove('hidden');
});

// === 출격 확인 모달(팝업) 로직 ===
const startModal = document.getElementById('startModal');
const modalFighterName = document.getElementById('modalFighterName');
const modalStartBtn = document.getElementById('modalStartBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const subFighterImg = document.querySelector('.sub-fighter-img');
const bottomStartBtn = document.getElementById('startGameBtn');

// 모달 열기 함수
function openStartModal(fighterName, isPremium) {
  if (startModal) {
    startModal.classList.remove('hidden');
    if (modalFighterName) {
      modalFighterName.textContent = `[ ${fighterName} ]`;
    }
    
    // 기체 타입 명확하게 설정 (버그 픽스)
    if (isPremium) {
      selectedFighterType = fighters[currentFighterIndex].type;
    } else {
      selectedFighterType = 'basic';
    }
    
    // 테스트용: 잠긴 기체는 UNLOCK, 무료/해제된 기체는 START
    if (isPremium && currentFighterIndex === 1) { 
      modalStartBtn.textContent = '$10.99 UNLOCK';
    } else if (isPremium && currentFighterIndex === 0) {
      modalStartBtn.textContent = '$6.99 UNLOCK';
    } else {
      modalStartBtn.textContent = 'START';
    }
  }
}

// 1. 기본 전투기 클릭 시
if (subFighterImg) {
  subFighterImg.addEventListener('click', () => {
    openStartModal('BASIC FIGHTER', false);
  });
}

// 2. 프리미엄 전투기 (홀로그램 중앙) 클릭 시
if (currentFighterImg) {
  currentFighterImg.addEventListener('click', () => {
    const name = currentFighterIndex === 0 ? 'PREMIUM FIGHTER' : 'VIP FIGHTER';
    openStartModal(name, true);
  });
}

// 3. 하단 결제 버튼 클릭 시
if (bottomStartBtn) {
  bottomStartBtn.addEventListener('click', () => {
    const name = currentFighterIndex === 0 ? 'PREMIUM FIGHTER' : 'VIP FIGHTER';
    openStartModal(name, true);
  });
}

// 모달 닫기
if (modalCancelBtn) {
  modalCancelBtn.addEventListener('click', () => {
    startModal.classList.add('hidden');
  });
}

// 모달 START/UNLOCK 버튼 클릭 시
if (modalStartBtn) {
  modalStartBtn.addEventListener('click', () => {
    startModal.classList.add('hidden');
    // START 이거나, 테스트를 위해 잠겨있어도 무조건 출격하도록 연결
    launchGame();
  });
}
