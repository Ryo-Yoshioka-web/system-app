const app = express();
const server = http.createServer(app);
const io = socketIo(server);

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const assignmentSchema = new mongoose.Schema({
    group: String,
    data: Object,
});

const GroupAssignment = mongoose.model('GroupAssignment', assignmentSchema);

let groupAssignments = {};

// 🔹 データの読み込み（サーバー起動時）
async function loadGroupAssignments() {
    try {
        const assignments = await GroupAssignment.find();
        groupAssignments = {};
        assignments.forEach(item => {
            groupAssignments[item.group] = item.data;
        });
        console.log("✅ MongoDBからデータを読み込みました");
    } catch (error) {
        console.error("❌ データの読み込みエラー:", error);
    }
}

// 🔹 データの保存
async function saveGroupAssignments() {
    try {
        await GroupAssignment.deleteMany({}); // 既存データを削除
        const assignments = Object.entries(groupAssignments).map(([group, data]) => ({ group, data }));
        await GroupAssignment.insertMany(assignments);
        console.log("✅ MongoDBにデータを保存しました");
    } catch (error) {
        console.error("❌ データの保存エラー:", error);
    }
}

// 初回ロード
loadGroupAssignments();
app.get('/download-assignments', (req, res) => {
    res.download(path.join(__dirname, 'groupAssignments.json'), 'groupAssignments.json');
});

app.get('/groups', (req, res) => {
    console.log("現在の groupAssignments:", groupAssignments); // デバッグ用

    res.json(groupAssignments);
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

    // クライアントからデータ要求があれば送信
    socket.on('request group assignments', () => {
        console.log("📨 グループデータを送信:", groupAssignments);
        socket.emit('update group assignments', groupAssignments);
    });

    // 初回接続時にも送信
    socket.emit('update group assignments', groupAssignments);

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

    socket.on('assign courses', async ({ group, courses, allergy, memo, plate }) => {
        if (!groupAssignments[group]) {
            groupAssignments[group] = {
                seats: [],
                seatCourses: {},
                groupAllergy: 'なし',
                groupMemo: '',
                groupPlate: 'なし' // ✅ プレート情報を追加（グループ単位）
            };
        }

        if (!groupAssignments[group].seatCourses) {
            groupAssignments[group].seatCourses = {};
        }

        // ✅ 選ばれた席を保存
        const selectedSeats = courses.map(({ seat }) => seat);
        groupAssignments[group].seats = selectedSeats;

        // ✅ 各席のコースを保存
        courses.forEach(({ seat, course }) => {
            if (!seat || !course) return;
            groupAssignments[group].seatCourses[seat] = course;
        });

        // ✅ グループ単位の情報を保存
        groupAssignments[group].groupAllergy = allergy || 'なし';
        groupAssignments[group].groupMemo = memo || '';
        groupAssignments[group].groupPlate = plate || 'なし'; // ✅ プレート情報を保存

        console.log("保存されたデータ:", groupAssignments[group]); // デバッグ用

        try {
            await saveGroupAssignments();
            io.emit('update group assignments', groupAssignments);
        } catch (error) {
            console.error('データ保存エラー:', error);
        }
    });




    socket.on('assign group settings', async ({ group, course, memo, allergies }) => {
        if (!groupAssignments[group]) {
            groupAssignments[group] = {};
        }

        // グループごとの設定を保存
        groupAssignments[group].course = course;
        groupAssignments[group].memo = memo;
        groupAssignments[group].allergies = allergies;

        await saveGroupAssignments();

        // クライアントに更新を通知
        io.emit('update group assignments', groupAssignments);
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

    socket.on('mark dish as complete', async ({ group, dish, userType }) => {
        if (!groupAssignments[group]) {
            console.warn(`⚠️ グループ ${group} が見つかりません`);
            return;
        }

        if (!groupAssignments[group].completed) {
            groupAssignments[group].completed = [];
        }

        // 既に完了している場合はスキップ
        if (groupAssignments[group].completed.some(d => d.dish === dish)) {
            console.warn(`⚠️ 既に完了済みの料理です: ${dish}`);
            return;
        }

        // ✅ 完了リストに追加
        groupAssignments[group].completed.push({ dish, userType });

        try {
            await saveGroupAssignments();
            console.log(`✅ データ保存完了: ${dish} を ${group} に記録`);
        } catch (error) {
            console.error("❌ データ保存エラー:", error);
        }

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


