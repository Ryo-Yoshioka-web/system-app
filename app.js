const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let groupAssignments = {};  // グループ割り当て情報を保持
let users = {};  // ユーザー情報を保持（ソケットIDをキーとしてユーザータイプ）

function loadGroupAssignments() {
    const filePath = path.join(__dirname, 'groupAssignments.json');
    if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        groupAssignments = JSON.parse(data);
    }
}

async function saveGroupAssignments() {
    const filePath = path.join(__dirname, 'groupAssignments.json');
    await fs.writeFileSync(filePath, JSON.stringify(groupAssignments, null, 2));
}

loadGroupAssignments();

app.get('/download-assignments', (req, res) => {
    res.download(path.join(__dirname, 'groupAssignments.json'), 'groupAssignments.json');
});

let groups = {};

io.on('connection', (socket) => {
    console.log('a user connected');

    // ユーザーがログインした時
    socket.on('login', (data) => {
        // ユーザー情報を保存（ユーザータイプ）
        users[socket.id] = data.userType;
        socket.emit('userType', { userType: data.userType });  // ユーザータイプをクライアントに送信
        console.log(`${data.userType}がログインしました`);
    });

    // 接続時に現在のグループ割り当て情報を送信
    socket.emit('init group assignments', groupAssignments);

    socket.on('assign to group', (data) => {
        const { group, seats } = data;
        if (!groupAssignments[group]) {
            groupAssignments[group] = { seats: [] };
        }
        groupAssignments[group].seats = [...new Set([...groupAssignments[group].seats, ...seats])];
        saveGroupAssignments();
        io.emit('update group assignments', groupAssignments); // ブロードキャスト
    });

    socket.on('reset group', (group) => {
        if (groupAssignments[group]) {
            delete groupAssignments[group];
            saveGroupAssignments();
            io.emit('update group assignments', groupAssignments);
        }
    });

    socket.on('assign course', (data) => {
        const { group, course } = data;
        if (groupAssignments[group]) {
            groupAssignments[group].course = course;
            saveGroupAssignments();
            io.emit('update group assignments', groupAssignments);
        }
    });

    socket.on('delete group', (group) => {
        if (groupAssignments[group]) {
            delete groupAssignments[group];
            saveGroupAssignments();
            io.emit('update group assignments', groupAssignments);
        }
    });

    // グループ作成時にコースモーダルを表示
    socket.on('create group', () => {
        showCourseModal();
    });

    socket.on('assign courses', async ({ group, courses }) => {
        if (!groupAssignments[group]) return;
        if (!groupAssignments[group].seatCourses) groupAssignments[group].seatCourses = {};
        if (!groupAssignments[group].seatAllergies) groupAssignments[group].seatAllergies = {};
        if (!groupAssignments[group].seatNotes) groupAssignments[group].seatNotes = {};
        console.log("-------------------------------");
        console.log(courses);
        console.log(group);
        console.log("-------------------------------");

        courses.forEach(({ seat, course, allergy, memo }) => {  // アレルギーとメモも取得
            if (!seat || !course) return;
            groupAssignments[group].seatCourses[seat] = course;
            groupAssignments[group].seatAllergies[seat] = allergy || 'no';  // アレルギーを追加
            groupAssignments[group].seatNotes[seat] = memo || '';  // メモを追加
        });

        try {
            // データの保存と全クライアントへのブロードキャスト
            await saveGroupAssignments();
            console.log('コース割り当てデータ保存完了');
            io.emit('update group assignments', groupAssignments);
        } catch (error) {
            console.error('データ保存エラー:', error);
        }
    });



    socket.on('updateDishStatus', ({ group, seat, course, dish, userType, color }) => {
        if (!groupAssignmentsData[group]) {
            groupAssignmentsData[group] = {
                seatCourses: {}, // コース割り当て情報
                completed: {} // 完了した料理情報
            };
        }

        const groupData = groupAssignmentsData[group];
        if (!groupData.completed[seat]) {
            groupData.completed[seat] = {};
        }
        if (!groupData.completed[seat][course]) {
            groupData.completed[seat][course] = {};
        }

        // 完了した料理とその色を保存
        groupData.completed[seat][course][dish] = { userType, color };

        console.log(groupAssignmentsData);  // データが正しく更新されたか確認
    });

    socket.on('mark dish as complete', async ({ group, seat, course, dish, userType }) => {
        const groupData = groupAssignments[group];
        console.log("受信データ:", { group, seat, course, dish, userType });
        if (!groupData || !groupData.seatCourses) {
            console.warn("グループデータが存在しません");
            return;
        }

        // `completed`オブジェクトの初期化
        if (!groupData.completed) groupData.completed = {};
        if (!groupData.completed[seat]) groupData.completed[seat] = {};
        if (!groupData.completed[seat][course]) groupData.completed[seat][course] = [];

        // 既に完了済みの場合はスキップ
        if (groupData.completed[seat][course].includes(dish)) {
            console.warn("既に完了済みの料理です:", dish);
            return;
        }

        // 完了リストへの追加
        groupData.completed[seat][course].push({ dish, userType });
        console.log("更新されたデータ:", groupData);

        // データ保存（永続化）
        try {
            await saveGroupAssignments();
            console.log("データ保存完了");
        } catch (error) {
            console.log(groupData);

            console.error("データ保存エラー:", error);
        }

        console.log(groupAssignments);


        // 全クライアントへ更新通知
        io.emit('update group assignments', groupAssignments);
    });

    socket.on('update group assignments', (assignments) => {
        groupAssignmentsData = assignments;
        console.log("更新しました");
        updateGroupAssignmentsDisplay(assignments);
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});


