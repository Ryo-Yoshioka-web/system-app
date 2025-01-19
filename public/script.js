const socket = io();
const seatContainer = document.getElementById('seatContainer');
const groupSelect = document.getElementById('groupSelect');
const groupAssignments = document.getElementById('groupAssignments');
let selectedSeats = [];
let assignedSeats = {}; // 割り当て済み席を管理するオブジェクト
let selectedGroupForCourses = null;
let groupAssignmentsData = {}; // 割り当てデータを保持する変数
let dishTimers = {};
let completedDishes = {};
let groupColors = {};

const fixedGroupColors = {
    Group1: '#add8e6', // 薄い青
    Group2: '#90ee90', // 薄い緑
    Group3: '#ffcccb', // 薄い赤
    Group4: '#ffffe0', // 薄い黄色
    Group5: '#dda0dd', // 薄い紫
    Group6: '#87cefa', // スカイブルー
    Group7: '#f0e68c', // カーキ
    Group8: '#ffc0cb', // ピンク
    Group9: '#e6e6fa', // 薄いラベンダー
    Group10: '#98fb98', // 薄いパステルグリーン
};


const userType = localStorage.getItem('userType');

const rows = ['F', 'E', 'D', 'C', 'B', 'A'];
const seatsPerRow = 2;

// メインの座席を作成
const mainSeatsDiv = document.createElement('div');
mainSeatsDiv.className = 'main-seats';

rows.forEach((row) => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'seat-row';

    for (let seatNumber = 1; seatNumber <= seatsPerRow; seatNumber++) {
        const seat = document.createElement('div');
        seat.className = 'seat';
        seat.textContent = `${row}${seatNumber}`;
        rowDiv.appendChild(seat);
    }

    mainSeatsDiv.appendChild(rowDiv);
});

seatContainer.appendChild(mainSeatsDiv);

// 数字席を作成
const numberSeatsDiv = document.createElement('div');
numberSeatsDiv.className = 'number-seats';

for (let i = 9; i >= 1; i--) {
    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.textContent = `${i}`;
    numberSeatsDiv.appendChild(seat);
}

seatContainer.appendChild(numberSeatsDiv);

const Tableseats = seatContainer.getElementsByClassName('seat');

// クリック時の動作を更新
function toggleSeatSelection(seat) {
    const seatLetter = seat.textContent;
    if (assignedSeats[seatLetter]) {
        alert(`${seatLetter} は既に ${assignedSeats[seatLetter]} に割り当てられています`);
        return;
    }

    seat.classList.toggle('selected');
    if (selectedSeats.includes(seatLetter)) {
        selectedSeats = selectedSeats.filter(s => s !== seatLetter);
    } else {
        selectedSeats.push(seatLetter);
    }
}

function assignToGroup() {
    const selectedGroup = groupSelect.value;
    if (!selectedGroup || selectedSeats.length === 0) {
        alert('グループと席を選択してください');
        return;
    }

    // サーバーに割り当て情報を送信
    socket.emit('assign to group', { group: selectedGroup, seats: selectedSeats });

    // 選択をリセット
    selectedSeats.forEach(seatLetter => {
        const seat = Array.from(Tableseats).find(s => s.textContent === seatLetter);
        seat.classList.remove('selected');
    });
    selectedSeats = [];
    groupSelect.value = '';
}



function selectGroup(group) {
    selectedGroup = group;
}


function resetGroup(group) {
    if (confirm(`${group}を削除してもよろしいですか？`)) {
        socket.emit('reset group', group);
        // グループのディスプレイ要素を削除
        const groupDiv = Array.from(groupAssignments.children).find(div => div.querySelector('p').textContent.includes(group));
        if (groupDiv) {
            groupDiv.remove();
        }
    }
}



function createGroupOptions(numGroups) {
    const groupSelect = document.getElementById('groupSelect');
    groupSelect.innerHTML = '<option value="">グループを選択</option>';

    // 各グループに対して「なし」と「あり」の選択肢を作成
    for (let i = 1; i <= numGroups; i++) {
        // 「なし」のグループ
        const optionNone = document.createElement('option');
        optionNone.value = `Group${i}`;
        optionNone.textContent = `グループ${i}`;
        groupSelect.appendChild(optionNone);

        // 「あり」のグループ
        const optionYes = document.createElement('option');
        optionYes.value = `Group${i}/プレートあり`;
        optionYes.textContent = `グループ${i}/プレートあり`;


        // 「あり」の場合に色を付ける
        optionYes.style.backgroundColor = '#ffff0061'; // 好きな色に変更可能
        groupSelect.appendChild(optionYes);
    }
}

// 例: 10個のグループを作成
createGroupOptions(15);




function selectCourse(course, group) {
    console.log("selectCourse");

    // 選択されたグループを引数として受け取る
    console.log(group);

    if (group) {
        // サーバーにコースを割り当てる
        socket.emit('assign course', { group: group, course: course });

        // コースが割り当てられた後にタイマーを開始する
        const groupData = groupAssignmentsData[group];
        const seats = groupData?.seats;
        console.log(seats);

        if (seats) {
            seats.forEach(seat => {
                startDishTimers(group, seat, course);  // ここでタイマーを開始
            });
        }
    }
}

// socket.on('group deleted', (updatedAssignments) => {
//     updateGroupAssignmentsDisplay(updatedAssignments);
//     selectedGroup = null;
// });

socket.on('update group assignments', (assignments) => {
    updateGroupAssignmentsDisplay(assignments);
});

// 初期グループ割り当て情報を受信
socket.on('init group assignments', (assignments) => {
    updateGroupAssignmentsDisplay(assignments);
});

function openCourseModal(group) {
    console.log(group);
    selectedGroupForCourses = group;

    const groupData = groupAssignmentsData[group];
    const seats = groupData?.seats;
    if (!Array.isArray(seats) || seats.length === 0) {
        alert(`${group}には割り当てられた席がありません`);
        return;
    }

    const courseInputs = document.getElementById('courseInputs');
    courseInputs.innerHTML = '';
    seats.forEach((seat, index) => {
        const inputDiv = document.createElement('div');
        inputDiv.innerHTML = `
            <label for="course-${seat}">${seat}のコース:</label>
            <select id="course-${seat}" data-seat="${seat}">
                <option value="">選択してください</option>
                <option value="OMAKASE">OMAKASE</option>
                <option value="WAGYU">WAGYU</option>
                <option value="OSAKA">OSAKA</option>
                <option value="KIDS">KIDS</option>
            </select>
            <label>アレルギー:</label>
            <label><input type="checkbox" name="allergy-${seat}" value="生卵" onclick="handleAllergySelection(this, '${seat}')"> 生卵</label>
            <label><input type="checkbox" name="allergy-${seat}" value="小麦" onclick="handleAllergySelection(this, '${seat}')"> 小麦</label>
            <label><input type="checkbox" name="allergy-${seat}" value="牛乳" onclick="handleAllergySelection(this, '${seat}')"> 牛乳</label>
            <label><input type="checkbox" name="allergy-${seat}" value="エビ" onclick="handleAllergySelection(this, '${seat}')"> エビ</label>
            <label><input type="checkbox" name="allergy-${seat}" value="サーモン" onclick="handleAllergySelection(this, '${seat}')"> サーモン</label>
            <label><input type="checkbox" name="allergy-${seat}" value="マグロ" onclick="handleAllergySelection(this, '${seat}')"> マグロ</label>
            <label><input type="checkbox" name="allergy-${seat}" value="牛" onclick="handleAllergySelection(this, '${seat}')"> 牛</label>
            <label><input type="checkbox" name="allergy-${seat}" value="豚" onclick="handleAllergySelection(this, '${seat}')"> 豚</label>
            <label><input type="checkbox" name="allergy-${seat}" value="鰻" onclick="handleAllergySelection(this, '${seat}')"> 鰻</label>
            <textarea id="memo-${seat}" placeholder="メモを入力してください"></textarea>
        `;
        courseInputs.appendChild(inputDiv);

        const courseSelect = inputDiv.querySelector('select');
        courseSelect.addEventListener('change', function () {
            const selectedCourse = this.value;
            selectCourse(selectedCourse, group);  // グループを引数として渡す
        });
    });

    document.getElementById('courseModal').style.display = 'block';
}

function handleAllergySelection(clickedCheckbox, seat) {
    const allergyCheckboxes = document.querySelectorAll(`input[name="allergy-${seat}"]`);
    const seatElement = Array.from(Tableseats).find(seatDiv => seatDiv.textContent === seat);

    if (clickedCheckbox.value === "なし" && clickedCheckbox.checked) {
        // 「なし」を選択した場合、他のチェックボックスを解除し、スタイルをリセット
        allergyCheckboxes.forEach(checkbox => {
            if (checkbox !== clickedCheckbox) checkbox.checked = false;
        });
        if (seatElement) {
            seatElement.classList.remove('allergy-marked'); // 線を削除
            seatElement.style.color = ''; // 赤文字を解除
        }
    } else if (clickedCheckbox.value !== "なし") {
        // 他のアレルギー項目を選択した場合、「なし」を解除し、スタイルを適用
        const noneCheckbox = Array.from(allergyCheckboxes).find(checkbox => checkbox.value === "なし");
        if (noneCheckbox) noneCheckbox.checked = false;
        if (seatElement) {
            seatElement.classList.add('allergy-marked'); // 線を追加
            seatElement.style.color = 'red'; // 赤文字を設定
        }
    }
}


function assignCourses() {
    const selects = document.querySelectorAll('#courseInputs select');
    const courses = Array.from(selects).map(select => {
        const seat = select.dataset.seat;
        const courseValue = select.value;
        // 選択されたアレルギー項目を取得
        const allergies = Array.from(document.querySelectorAll(`input[name="allergy-${seat}"]:checked`))
            .map(checkbox => checkbox.value)
            .join(', ');
        const memo = document.getElementById(`memo-${seat}`).value.trim();  // メモの取得
        return { seat, course: courseValue, allergy: allergies, memo };  // メモも含める
    }).filter(course => course.course);  // コースが選択されているもののみフィルタリング

    socket.emit('assign courses', { group: selectedGroupForCourses, courses });

    // モーダルを閉じる
    document.getElementById('courseModal').style.display = 'none';
}

function createCompleteButton(dishElement, seat, course, dish) {
    const completeButton = document.createElement('button');
    completeButton.textContent = '完了';
    completeButton.style.marginLeft = '10px';
    completeButton.onclick = () => markAsComplete(dishElement, seat, course, dish);
    return completeButton;
}




const courseDishes = {
    OMAKASE: ['Drink pairing', 'Starters', 'Sushi', 'Tonkatsu', 'WAGYU steak', 'Sukiyaki', 'Eel', 'Dessert'],
    WAGYU: ['Starters', 'Sushi', 'Tonkatsu', 'WAGYU steak', 'Sukiyaki', 'Eel', 'Dessert'],
    OSAKA: ['Starters', 'Sushi', 'Tonkatsu', 'Ramen', 'Sukiyaki', 'Eel', 'Dessert'],
    KIDS: ['xxx', 'xx']
};


function openCourseStatusModal(group) {
    const groupData = groupAssignmentsData[group];
    const seatCourses = groupData?.seatCourses || {};

    const courseStatusList = document.getElementById('courseStatusList');
    courseStatusList.innerHTML = '';

    if (Object.keys(seatCourses).length === 0) {
        courseStatusList.innerHTML = '<p>このグループにはコースが割り当てられていません。</p>';
    } else {
        Object.entries(seatCourses).forEach(([seat, course]) => {
            const listItemContainer = document.createElement('div');
            const listItem = document.createElement('p');
            listItem.textContent = `${seat}: ${course}`;
            courseStatusList.appendChild(listItemContainer);  // <div>の中に<p>を追加
            listItemContainer.appendChild(listItem);

            const dishList = document.createElement('ul');
            const dishes = courseDishes[course] || [];  // ここで直接取得

            dishes.forEach((dish, index) => {
                const dishItem = document.createElement('li');
                const completeButton = createCompleteButton(dishItem, seat, course, dish);
                dishItem.textContent = `${index + 1}. ${dish}`;

                const completedDishes = groupData.completed?.[seat]?.[course] || [];
                const completedDish = completedDishes.find(d => d.dish === dish);

                if (completedDish) {
                    dishItem.style.textDecoration = 'line-through';
                    dishItem.style.color = '#888';
                    completeButton.style.backgroundColor = completedDish.userType === 'A' ? 'green' : 'blue';
                }

                dishItem.appendChild(completeButton);
                dishList.appendChild(dishItem);
            });

            listItemContainer.appendChild(dishList);
        });
    }

    document.getElementById('courseStatusModal').style.display = 'block';
}

function updateGroupAssignmentsDisplay(assignments) {
    groupAssignments.innerHTML = '';
    assignedSeats = {};
    groupAssignmentsData = assignments;
    console.log(assignments);


    for (const [group, data] of Object.entries(assignments)) {
        const groupDiv = document.createElement('div');
        const assignment = document.createElement('p');
        assignment.textContent = `${group}: ${data.seats.join(', ')}`;
        selectedGroupForCourses = group;
        groupDiv.appendChild(assignment);

        if (!groupColors[group]) {
            groupColors[group] = fixedGroupColors[group]
        }
        groupDiv.style.backgroundColor = groupColors[group];

        if (data.seatCourses) {
            const courseList = document.createElement('ul');
            for (const seat in data.seatCourses) {
                const course = data.seatCourses[seat];
                const allergy = data.seatAllergies?.[seat] || '未設定';
                const memo = data.seatNotes?.[seat] || 'なし';

                const courseItem = document.createElement('li');
                courseItem.textContent = `${seat}: ${course}`;

                const allergyInfo = document.createElement('p');
                allergyInfo.textContent = `アレルギー: ${allergy}`;

                const memoInfo = document.createElement('p');
                memoInfo.textContent = `メモ: ${memo}`;

                courseList.appendChild(courseItem);
                courseList.appendChild(allergyInfo);
                courseList.appendChild(memoInfo);
            }
            groupDiv.appendChild(courseList);
        }

        const assignCourseButton = document.createElement('button');
        assignCourseButton.textContent = 'コースを割り当て';
        assignCourseButton.onclick = () => openCourseModal(group);
        groupDiv.appendChild(assignCourseButton);

        const resetButton = document.createElement('button');
        resetButton.textContent = '削除';
        resetButton.onclick = () => resetGroup(group);
        groupDiv.appendChild(resetButton);

        const checkCourseButton = document.createElement('button');
        checkCourseButton.textContent = 'コース確認';
        checkCourseButton.onclick = () => openCourseStatusModal(group);
        groupDiv.appendChild(checkCourseButton);

        groupAssignments.appendChild(groupDiv);

        if (data.seats) {
            data.seats.forEach(seat => {
                assignedSeats[seat] = group;
            });
        }
    }
    updateSeatStyles();
    highlightGroupAssignments();
}

function highlightGroupAssignments() {
    const groupAssignments = document.getElementById('groupAssignments');
    const divTags = groupAssignments.getElementsByTagName('div');  // id="groupAssignments" の中の全ての <p> タグを取得

    // 各 <p> タグをループして「あり」を含む場合に色を付ける
    for (let p of divTags) {
        if (p.textContent.includes('あり')) {
            p.style.backgroundColor = '#ffff0061';  // 色を付ける（任意の色に変更可能）
        }
    }
}

function getRandomColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 30) + 70; // 70-100%
    const lightness = Math.floor(Math.random() * 20) + 70; // 70-90%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// グループごとの色を保持するオブジェクト

function updateSeatStyles() {
    Array.from(Tableseats).forEach(seat => {
        const seatLetter = seat.textContent;

        if (assignedSeats[seatLetter]) {
            const group = assignedSeats[seatLetter];
            seat.classList.add('assigned');

            // グループ名に「あり」が含まれる場合は固定色を適用
            if (group.includes('あり')) {
                seat.style.backgroundColor = '#ffff0061'; // 薄い黄色
            } else {
                // グループごとの固定色を適用
                if (!groupColors[group]) {
                    groupColors[group] = fixedGroupColors[group] || getRandomColor();
                }
                seat.style.backgroundColor = groupColors[group];
            }

            seat.onclick = null; // 割り当て済み席はクリック不可
        } else {
            // 割り当てがない場合はスタイルをリセット
            seat.classList.remove('assigned');
            seat.style.backgroundColor = ''; // 元のスタイルに戻す
            seat.onclick = () => toggleSeatSelection(seat);
        }

        // アレルギー情報を基にスタイルを更新
        const groupData = groupAssignmentsData[assignedSeats[seatLetter]];
        if (groupData && groupData.seatAllergies && groupData.seatAllergies[seatLetter]) {
            if (groupData.seatAllergies[seatLetter] !== 'no') {
                seat.classList.add('allergy-marked'); // 線を追加
                seat.style.color = 'red'; // 赤文字を設定
            } else {
                seat.classList.remove('allergy-marked'); // 線を削除
                seat.style.color = ''; // 色をリセット
            }
        } else {
            seat.classList.remove('allergy-marked'); // 線を削除
            seat.style.color = ''; // 色をリセット
        }
    });
}




// モーダルを閉じる
document.getElementById('closeCourseStatusModal').onclick = () => {
    document.getElementById('courseStatusModal').style.display = 'none';
};

window.onclick = (event) => {
    const modal = document.getElementById('courseStatusModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

document.getElementById('closeModal').onclick = () => {
    document.getElementById('courseModal').style.display = 'none';
};

document.getElementById('closeCourseModal').onclick = () => {
    document.getElementById('courseStatusModal').style.display = 'none';
};



socket.on('update group assignments', (assignments) => {
    groupAssignmentsData = assignments;
    updateGroupAssignmentsDisplay(assignments);
});


function startDishTimers(group, seat, course) {
    console.log("タイマー開始");

    const dishes = courseDishes[course] || [];
    dishes.forEach((dish, index) => {
        const timerId = `${group}-${seat}-${course}-${dish}`;

        // 完了状態を初期化
        if (!completedDishes[group]) completedDishes[group] = {};
        if (!completedDishes[group][seat]) completedDishes[group][seat] = {};
        if (!completedDishes[group][seat][course]) completedDishes[group][seat][course] = [];

        // インデックスに基づいて20分ごとのタイマーを設定
        const delay = (index + 1) * 1200000; // 20分 (1200000ミリ秒) ごとに遅延
        dishTimers[timerId] = setTimeout(() => {
            // 完了ボタンが押されていない場合のみ通知と席を赤くする
            if (!completedDishes[group][seat][course].includes(dish)) {
                const seatElement = Array.from(Tableseats).find(seatDiv => seatDiv.textContent === seat);
                if (seatElement) {
                    seatElement.classList.add('timed-out');  // 席を赤くする
                    showNotification(`グループ ${group} の席 ${seat} の ${course}コース「${dish}」が${delay / 60000}分経過しました。席が赤く表示されます。`);
                }
            }
        }, delay);
    });
}

function markAsComplete(dishElement, seat, course, dish) {
    dishElement.style.textDecoration = 'line-through';
    dishElement.style.color = '#888';
    const completeButton = dishElement.querySelector('button');

    // ボタンの無効化をユーザータイプに依存させない
    completeButton.disabled = true;

    console.log(userType);

    // ユーザータイプによってボタンの色を変更
    if (userType === 'A') {
        completeButton.style.backgroundColor = 'green';  // ユーザーAの場合、緑
    } else if (userType === 'B') {
        completeButton.style.backgroundColor = 'blue';   // ユーザーBの場合、青
    }

    console.log(selectedGroupForCourses);

    const group = selectedGroupForCourses;
    const timerId = `${group}-${seat}-${course}-${dish}`;

    // タイマー解除（時間前に完了した場合）
    if (dishTimers[timerId]) {
        clearTimeout(dishTimers[timerId]);
        delete dishTimers[timerId];
    }

    // 完了状態を更新
    if (!completedDishes[group]) completedDishes[group] = {};
    if (!completedDishes[group][seat]) completedDishes[group][seat] = {};
    if (!completedDishes[group][seat][course]) completedDishes[group][seat][course] = [];
    completedDishes[group][seat][course].push(dish);

    // 席の色をリセット
    const seatElement = Array.from(Tableseats).find(seatDiv => seatDiv.textContent === seat);
    if (seatElement && seatElement.classList.contains('timed-out')) {
        seatElement.classList.remove('timed-out');  // 赤色解除
    }

    // 進捗をサーバーに送信
    socket.emit('mark dish as complete', { group: selectedGroupForCourses, seat, course, dish, userType });

    // コースの全ての料理が完了したかチェック
    const allDishesCompleted = (courseElement) => {
        const dishes = courseElement.querySelectorAll('li');
        return Array.from(dishes).every(dish => dish.style.textDecoration === 'line-through');
    };

    const courseElement = dishElement.closest('ul');
    if (allDishesCompleted(courseElement)) {
        alert(`${seat}の${course}コースが完了しました！`);
    }
}



function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000); // 5秒後に通知を消す
}