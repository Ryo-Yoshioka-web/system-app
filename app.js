const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MongoDBに接続
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('✅ MongoDBに接続しました'))
    .catch(err => console.error('❌ MongoDB接続エラー:', err));

// MongoDB用スキーマとモデルを定義
const assignmentSchema = new mongoose.Schema({
    group: String,
    data: Object,
});

const GroupAssignment = mongoose.model('GroupAssignment', assignmentSchema);

let groupAssignments = {};

// データの読み込み
async function loadGroupAssignments() {
    const assignments = await GroupAssignment.find();
    groupAssignments = {};
    assignments.forEach(item => {
        groupAssignments[item.group] = item.data;
    });
}

// データの保存
async function saveGroupAssignments() {
    await GroupAssignment.deleteMany({});
    const assignments = Object.entries(groupAssignments).map(([group, data]) => ({ group, data }));
    await GroupAssignment.insertMany(assignments);
    console.log("✅ MongoDBにデータを保存しました");
}

// 初回起動時にデータを読み込み
loadGroupAssignments();

app.use(express.static('public'));

// Socket.ioのイベント
io.on('connection', (socket) => {
    console.log('🔗 クライアントが接続しました');

    socket.emit('update group assignments', groupAssignments);

    socket.on('assign to group', async (data) => {
        const { group, seats } = data;
        if (!groupAssignments[group]) {
            groupAssignments[group] = { seats: [] };
        }
        groupAssignments[group].seats = [...new Set([...groupAssignments[group].seats, ...seats])];
        await saveGroupAssignments();
        io.emit('update group assignments', groupAssignments);
    });

    socket.on('reset group', async (group) => {
        delete groupAssignments[group];
        await saveGroupAssignments();
        io.emit('update group assignments', groupAssignments);
    });
});

server.listen(3000, () => {
    console.log('🚀 サーバーがポート3000で起動しました');
});
