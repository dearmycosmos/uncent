const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const MAX_PER_PLANET = 5;
const planets = {};
for (let i = 1; i <= 10; i++) {
  const pId = `planet${String(i).padStart(2, '0')}`;
  planets[pId] = { users: {} };
}

io.on('connection', (socket) => {
  // 현재 행성별 인원 수 전송
  socket.emit('planetCounts', getCounts());

  // 행성 입장 시도
  socket.on('joinPlanet', (planetId, callback) => {
    if (!planets[planetId]) return callback({ success: false, message: "존재하지 않는 행성입니다." });
    
    const currentCount = Object.keys(planets[planetId].users).length;
    if (currentCount >= MAX_PER_PLANET) {
      return callback({ success: false, message: "이 행성은 가득 찼어요. 다른 행성을 선택해 주세요." });
    }

    // 기존 방 퇴장 처리
    leaveCurrentPlanet(socket);

    // 새 방 입장
    socket.join(planetId);
    socket.planetId = planetId;
    planets[planetId].users[socket.id] = {
      id: socket.id,
      x: 400,
      y: 500,
      vx: 0,
      vy: 0,
      facing: 'right',
      isJumping: false,
      cloak: 'black'
    };

    // 응답 및 기존 유저 정보 전송
    callback({ 
      success: true, 
      peers: planets[planetId].users, 
      myId: socket.id 
    });

    // 다른 유저들에게 신규 접속 알림
    socket.to(planetId).emit('peerJoined', planets[planetId].users[socket.id]);
    io.emit('planetCounts', getCounts());
  });

  // 캐릭터 이동 동기화
  socket.on('updateState', (state) => {
    const pId = socket.planetId;
    if (pId && planets[pId] && planets[pId].users[socket.id]) {
      Object.assign(planets[pId].users[socket.id], state);
      socket.to(pId).emit('peerUpdated', { id: socket.id, ...state });
    }
  });

  // 퇴장 처리
  socket.on('disconnect', () => {
    leaveCurrentPlanet(socket);
  });
});

function leaveCurrentPlanet(socket) {
  const pId = socket.planetId;
  if (pId && planets[pId] && planets[pId].users[socket.id]) {
    delete planets[pId].users[socket.id];
    socket.to(pId).emit('peerLeft', socket.id);
    socket.leave(pId);
    socket.planetId = null;
    io.emit('planetCounts', getCounts());
  }
}

function getCounts() {
  const counts = {};
  for (const pId in planets) {
    counts[pId] = Object.keys(planets[pId].users).length;
  }
  return counts;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Dear my cosmos server running on port ${PORT}`);
});
