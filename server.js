const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// 1. 기본 브라우저 접속 확인용 (502 방지)
app.get('/', (req, res) => {
  res.send('🌌 Dear my cosmos Socket.IO Backend is LIVE!');
});

// 2. 외부 모든 웹사이트(GitHub Pages) 접속 허용 (CORS)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// 3. 행성 방 및 플레이어 상태 관리
const planetCounts = {};
for (let i = 1; i <= 10; i++) {
  const pid = i < 10 ? `planet0${i}` : `planet${i}`;
  planetCounts[pid] = 0;
}

io.on('connection', (socket) => {
  let currentPlanet = null;

  // 인원수 전송
  socket.emit('planetCounts', planetCounts);

  // 행성 방 입장
  socket.on('joinPlanet', (data) => {
    const planetId = typeof data === 'string' ? data : (data?.planetId || data?.room);
    if (!planetId) return;

    if (currentPlanet) {
      socket.leave(currentPlanet);
      planetCounts[currentPlanet] = Math.max(0, (planetCounts[currentPlanet] || 1) - 1);
    }

    currentPlanet = planetId;
    socket.join(planetId);
    planetCounts[planetId] = (planetCounts[planetId] || 0) + 1;

    io.emit('planetCounts', planetCounts);
    socket.to(planetId).emit('peerJoined', { id: socket.id, ...data });
  });

  // 캐릭터 이동 및 상태 동기화
  socket.on('updateState', (state) => {
    if (currentPlanet) {
      socket.to(currentPlanet).emit('peerUpdated', { id: socket.id, ...state });
    }
  });

  socket.on('peerUpdated', (state) => {
    if (currentPlanet) {
      socket.to(currentPlanet).emit('peerUpdated', { id: socket.id, ...state });
    }
  });

  // 관리자 연출 및 별/편지 동기화
  socket.on('adminAction', (payload) => {
    if (currentPlanet) socket.to(currentPlanet).emit('adminAction', payload);
  });
  socket.on('newTrack', (payload) => {
    if (currentPlanet) socket.to(currentPlanet).emit('newTrack', payload);
  });
  socket.on('starCountdownStarted', (payload) => {
    if (currentPlanet) socket.to(currentPlanet).emit('starCountdownStarted', payload);
  });

  // 퇴장 처리
  socket.on('disconnect', () => {
    if (currentPlanet) {
      planetCounts[currentPlanet] = Math.max(0, (planetCounts[currentPlanet] || 1) - 1);
      io.emit('planetCounts', planetCounts);
      socket.to(currentPlanet).emit('peerLeft', socket.id);
    }
  });
});

// 4. Render 필수: process.env.PORT 사용 (고정 3000번 쓰면 502 에러 발생)
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});