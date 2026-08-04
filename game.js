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

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

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

let isBgmPlaying = false;
let gameOverTriggered = false;

function triggerGameOver() {
  if (!gameOverTriggered) {
    isGameOver = true;
    gameOverTriggered = true;
    bgm.pause();
    gameOverSound.currentTime = 0;
    gameOverSound.play().catch(e => {});
  }
}

let score = 0;
let isGameOver = false;
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
  speed: 5,
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
  if (e.key in keys) {
    keys[e.key] = false;
    if (e.key === ' ' || e.key.startsWith('Arrow')) {
      e.preventDefault();
    }
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
const MISSILE_SPEED = 15;
const ENEMY_MISSILE_SPEED = 10;
const MISSILE_WIDTH = 5;
const MISSILE_HEIGHT = 15;
let fireCooldown = 0;
const FIRE_RATE = 10; // 연속 발사 간격 (프레임)

// 위치 업데이트 및 화면 경계 제한
function update() {
  // 별(배경) 이동 및 반짝임 처리
  for (let i = 0; i < stars.length; i++) {
    let s = stars[i];
    s.y += s.speed;
    s.alpha += (Math.random() - 0.5) * 0.1; // 반짝임
    if (s.alpha < 0) s.alpha = 0;
    if (s.alpha > 1) s.alpha = 1;

    // 화면 밖으로 나가면 위에서 다시 나타나게 무한 스크롤
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
  }

  if (isGameOver) {
    document.getElementById('gameOverScreen').classList.remove('hidden');
    document.getElementById('finalScore').innerText = '최종 점수: ' + score + '점';
    return;
  }

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
    missiles.push({
      x: player.x + player.width / 2 - MISSILE_WIDTH / 2, // 비행기 중앙에서 발사
      y: player.y,
      width: MISSILE_WIDTH,
      height: MISSILE_HEIGHT
    });
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
    em.y += ENEMY_MISSILE_SPEED;

    // 화면 밖으로 나가면 삭제
    if (em.y > canvas.height) {
      enemyMissiles.splice(i, 1);
      continue;
    }

    // 플레이어와 적 미사일 충돌 검사
    if (isColliding(player, em)) {
      triggerGameOver();
    }
  }

  // 레벨 계산 (50점마다 1레벨 상승)
  let level = 1 + Math.floor(score / 50);

  // 레벨에 따른 스폰 주기 계산 (최소 15프레임 제한)
  let spawnInterval = Math.max(15, 60 - (level - 1) * 5);

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
    if (isColliding(player, t)) {
      if (t.type === 'airship' || t.type === 'meteorite') {
        triggerGameOver();
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

  // 2. 플레이어(비행기 이미지) 그리기
  if (isAdmin) {
    if (premiumImg.complete && premiumImg.naturalHeight !== 0) {
      ctx.drawImage(premiumImg, player.x, player.y, player.width, player.height);
    } else {
      ctx.fillStyle = 'gold';
      ctx.fillRect(player.x, player.y, player.width, player.height);
    }
  } else {
    if (playerImg.complete && playerImg.naturalHeight !== 0) {
      ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
    } else {
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x, player.y, player.width, player.height);
    }
  }

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
  let currentLevel = 1 + Math.floor(score / 50);
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Score: ' + score, 10, 30);
  ctx.fillText('Level: ' + currentLevel, 10, 55);

}

// 메인 게임 루프
function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

let isGameStarted = false;
let isAdmin = false; // 관리자 여부 체크

// 구글 로그인 버튼 이벤트 리스너
document.getElementById('googleLoginBtn').addEventListener('click', () => {
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
  
  if (idInput.length < 3) {
    alert("아이디는 3글자 이상 입력해주세요!");
    return;
  }
  if (pwInput.length < 6) {
    alert("비밀번호는 6자리 이상 입력해주세요!");
    return;
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

// 관리자 여부 확인 후 게임 시작
function checkAdminAndStart(user) {
  if (user && user.email) {
    // 아이디가 boss 이거나 boos 인 경우 관리자로 취급
    if (user.email === 'boss@air-flying.com' || user.email === 'boos@air-flying.com') {
      isAdmin = true;
      player.width = 80;  // 일반 기체(50)보다 크게
      player.height = 80;
      console.log("관리자 계정 로그인 감지! 3D 프리미엄 기체 탑승!");
    } else {
      isAdmin = false;
      player.width = 50;
      player.height = 50;
    }
  }
  
  document.getElementById('loginScreen').classList.add('hidden');
  if (!isGameStarted) {
    isGameStarted = true;
    bgm.play().catch(e => { console.log("BGM play failed", e); });
    isBgmPlaying = true;
    gameLoop();
  }
}

// 로그인 상태 자동 확인 (새로고침 시)
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('loginScreen').classList.add('hidden');
    if (!isGameStarted) {
      isGameStarted = true;
      checkAdminAndStart(user);
    }
  }
});

// 재시작 이벤트 처리
document.getElementById('restartBtn').addEventListener('click', () => {
  score = 0;
  isGameOver = false;
  gameOverTriggered = false;
  bgm.currentTime = 0;
  bgm.play().catch(e => {});
  slowEndTime = 0;
  targets.length = 0;
  missiles.length = 0;
  enemyMissiles.length = 0;
  targetSpawnTimer = 0;
  
  // 플레이어 위치 초기화
  player.x = (canvas.width - player.width) / 2;
  player.y = canvas.height - player.height - 20;
  
  // UI 숨기기
  document.getElementById('gameOverScreen').classList.add('hidden');
});
