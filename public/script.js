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

const courseDishes = {
    OMAKASE: ['ペアリング', '前菜', 'しょうゆ', '寿司', 'とんかつ', 'ステーキ', 'すきやき', '出汁', '鰻', 'プレート'],
    WAGYU: ['ペアリング', '前菜', 'しょうゆ', '寿司', 'とんかつ', 'ステーキ', 'すきやき', '出汁', '鰻', 'プレート'],
    OSAKA: ['ペアリング', '前菜', 'しょうゆ', '寿司', 'とんかつ', 'ラーメン', 'すきやき', '出汁', '鰻', 'プレート'],
    KIDS: ['xxx', 'xx']
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
    if (selectedSeats.length === 0) {
        alert('席を選択してください');
        return;
    }

    let selectedGroup = groupSelect.value;

    // グループ未選択の場合は自動的に空いているグループを選択
    if (!selectedGroup) {
        const existingGroups = Object.keys(groupAssignmentsData);
        for (let i = 1; i <= 15; i++) {
            const groupName = `Group${i}`;
            if (!existingGroups.includes(groupName)) {
                selectedGroup = groupName;
                break;
            }
        }
    }

    if (!selectedGroup) {
        alert('利用可能なグループがありません');
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
    groupSelect.value = ''; // 選択をリセット
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

socket.on('connect', () => {
    console.log("🔄 サーバーに再接続しました。データを取得します...");
    socket.emit('request group assignments');  // 接続時にデータを要求
});

socket.on('update group assignments', (assignments) => {
    updateGroupAssignmentsDisplay(assignments);
});

// 初回ロード時にもデータを要求
window.onload = () => {
    socket.emit('request group assignments');
};

function openSeatSettingsModal(group) {
    selectedGroupForCourses = group;
    localStorage.setItem('selectedGroupForCourses', group);
    const modalContent = document.getElementById('courseInputs');
    modalContent.innerHTML = '';

    const groupData = groupAssignmentsData[group];
    const seats = groupData?.seats || [];

    seats.forEach(seat => {
        modalContent.innerHTML += `
            <label for="course-${seat}">${seat} のコース:</label>
            <select id="course-${seat}">
                <option value="">選択してください</option>
                <option value="OMAKASE">OMAKASE</option>
                <option value="WAGYU">WAGYU</option>
                <option value="OSAKA">OSAKA</option>
                <option value="KIDS">KIDS</option>
            </select>

            <label>プレート:</label>
            <select id="plate-${seat}">
                <option value="なし">なし</option>
                <option value="あり">あり</option>
            </select>

            <label for="memo-${seat}">メモ:</label>
            <textarea id="memo-${seat}" placeholder="メモを入力してください"></textarea>

            <label>アレルギー:</label>
            <input type="text" id="allergy-${seat}" placeholder="例: 小麦, エビ">
            <hr>
        `;
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

function openSeatSettingsModal(group) {
    selectedGroupForCourses = group;
    localStorage.setItem('selectedGroupForCourses', group);
    const modalContent = document.getElementById('courseInputs');
    modalContent.innerHTML = '';

    const groupData = groupAssignmentsData[group] || {};
    const seats = groupData.seats || [];
    const seatCourses = groupData.seatCourses || {};

    seats.forEach(seat => {
        const selectedCourse = seatCourses[seat] || "";

        modalContent.innerHTML += `
            <div>
                <label for="course-${seat}">${seat} のコース:</label>
                <select id="course-${seat}">
                    <option value="">選択してください</option>
                    <option value="OMAKASE" ${selectedCourse === "OMAKASE" ? "selected" : ""}>OMAKASE</option>
                    <option value="WAGYU" ${selectedCourse === "WAGYU" ? "selected" : ""}>WAGYU</option>
                    <option value="OSAKA" ${selectedCourse === "OSAKA" ? "selected" : ""}>OSAKA</option>
                    <option value="KIDS" ${selectedCourse === "KIDS" ? "selected" : ""}>KIDS</option>
                </select>
            </div>
            <hr>
        `;
    });

    // ✅ 既存のプレート情報を取得
    const selectedPlate = groupData.groupPlate || "なし";

    modalContent.innerHTML += `
        <div>
            <label for="group-plate">プレート:</label>
            <select id="group-plate">
                <option value="なし" ${selectedPlate === "なし" ? "selected" : ""}>なし</option>
                <option value="あり" ${selectedPlate === "あり" ? "selected" : ""}>あり</option>
            </select>
        </div>
    `;

    // ✅ 既存のアレルギー情報を取得（カンマ区切り）
    const existingAllergy = groupData.groupAllergy ? groupData.groupAllergy.split(', ') : ["なし"];
    const allergyOptions = ["なし", "生卵", "小麦", "牛乳", "エビ", "サーモン", "マグロ", "牛", "豚", "鰻"];

    modalContent.innerHTML += `
        <div>
            <label>グループのアレルギー:</label>
            <div id="group-allergy">
                ${allergyOptions.map(allergy => `
                    <label class="allergy-option">
                        <input type="checkbox" name="allergy" value="${allergy}" 
                            ${existingAllergy.includes(allergy) ? "checked" : ""} 
                            onchange="handleAllergySelection(this)">
                        ${allergy}
                    </label>
                `).join('')}
            </div>
        </div>
    `;

    modalContent.innerHTML += `
        <div>
            <label for="group-memo">メモ:</label>
            <textarea id="group-memo" placeholder="メモを入力してください">${groupData.groupMemo || ""}</textarea>
        </div>
    `;

    document.getElementById('courseModal').style.display = 'block';
}


function handleAllergySelection(clickedCheckbox) {
    const allergyCheckboxes = document.querySelectorAll('input[name="allergy"]');

    if (clickedCheckbox.value === "なし" && clickedCheckbox.checked) {
        // ✅ 「なし」を選択した場合、他のチェックボックスを解除
        allergyCheckboxes.forEach(checkbox => {
            if (checkbox !== clickedCheckbox) checkbox.checked = false;
        });
    } else if (clickedCheckbox.value !== "なし") {
        // ✅ 他のアレルギー項目を選択した場合、「なし」を解除
        const noneCheckbox = Array.from(allergyCheckboxes).find(checkbox => checkbox.value === "なし");
        if (noneCheckbox) noneCheckbox.checked = false;
    }
}

function assignSeatCourses() {
    const group = selectedGroupForCourses || localStorage.getItem('selectedGroupForCourses');
    if (!group) {
        alert("グループが選択されていません");
        return;
    }

    const groupData = groupAssignmentsData[group];
    const seats = groupData?.seats || [];
    const courses = [];

    seats.forEach(seat => {
        const courseElement = document.getElementById(`course-${seat}`);
        if (courseElement) {
            const course = courseElement.value;
            if (course) {
                courses.push({ seat, course });
            }
        }
    });

    const plateElement = document.getElementById('group-plate');
    const plate = plateElement ? plateElement.value : "なし";

    // ✅ チェックされたアレルギーを取得
    const allergyCheckboxes = document.querySelectorAll('input[name="allergy"]:checked');
    const selectedAllergies = Array.from(allergyCheckboxes).map(checkbox => checkbox.value);

    // ✅ もし「なし」が選択されていたら、他のアレルギーを無視
    const allergy = selectedAllergies.includes("なし") ? "なし" : selectedAllergies.join(', ');

    const memoElement = document.getElementById('group-memo');
    const memo = memoElement ? memoElement.value : "";

    if (courses.length === 0) {
        alert("コースを割り当ててください");
        return;
    }

    // ✅ サーバーにデータを送信
    socket.emit('assign courses', { group, courses, allergy, memo, plate });

    document.getElementById('courseModal').style.display = 'none';
}



// **料理の完了ボタン**
function createCompleteButton(dishElement, group, dish) {
    const completeButton = document.createElement('button');
    completeButton.textContent = '完了';
    completeButton.style.marginLeft = '10px';

    completeButton.onclick = () => markAsComplete(dishElement, group, dish);
    return completeButton;
}

// **料理を完了としてマーク**
function markAsComplete(dishElement, group, dish) {
    dishElement.style.textDecoration = 'line-through';
    dishElement.style.color = '#888';
    const completeButton = dishElement.querySelector('button');
    completeButton.disabled = true;

    // ユーザータイプを取得
    const userType = localStorage.getItem('userType') || 'A';

    // サーバーへ完了通知を送信
    socket.emit('mark dish as complete', { group, dish, userType });

    console.log(`完了: グループ ${group}, 料理 ${dish}`);

    // 画面上のリストを即座に更新
    setTimeout(fetchAndUpdateCourseStatus, 500);
}

function updateGroupAssignmentsDisplay(assignments) {
    groupAssignments.innerHTML = '';
    assignedSeats = {};  // ✅ 修正：割り当てられた座席情報を初期化
    groupAssignmentsData = assignments;

    console.log("受信したデータ:", assignments); // ✅ デバッグ用

    for (const [group, data] of Object.entries(assignments)) {
        const groupDiv = document.createElement('div');
        groupDiv.classList.add('group-box');

        const assignment = document.createElement('p');
        assignment.textContent = `${data.seats ? data.seats.join(', ') : 'なし'}`;
        groupDiv.appendChild(assignment);

        if (!groupColors[group]) {
            groupColors[group] = fixedGroupColors[group] || getRandomColor();
        }
        groupDiv.style.backgroundColor = groupColors[group];

        if (data.seatCourses) {
            const courseList = document.createElement('ul');
            for (const seat in data.seatCourses) {
                let courseData = data.seatCourses[seat]; // ✅ `{ course, plate }` or `"OMAKASE"`
                let course = "未選択"; // デフォルト値

                // ✅ コース情報のデータ構造をチェック
                if (typeof courseData === "object" && courseData !== null) {
                    course = courseData.course || "未選択"; // `{ course, plate }` の場合
                } else if (typeof courseData === "string") {
                    course = courseData; // `"OMAKASE"` のように直接格納されている場合
                }

                const courseItem = document.createElement('li');
                courseItem.textContent = `${seat}: ${course}`;
                courseList.appendChild(courseItem);

                // ✅ 修正：座席の割り当てを保存
                assignedSeats[seat] = group;
            }
            groupDiv.appendChild(courseList);
        }

        // ✅ グループ単位の情報を表示
        const allergyText = data.groupAllergy !== undefined ? data.groupAllergy : 'なし';
        const memoText = data.groupMemo !== undefined ? data.groupMemo : 'なし';
        const plateText = data.groupPlate !== undefined ? data.groupPlate : 'なし'; // ✅ グループのプレート情報のみ表示

        const allergyInfo = document.createElement('p');
        allergyInfo.textContent = `アレルギー: ${allergyText}`;
        allergyInfo.style.color = 'red';

        const memoInfo = document.createElement('p');
        memoInfo.textContent = `メモ: ${memoText}`;

        const plateInfo = document.createElement('p');
        plateInfo.textContent = `プレート: ${plateText}`; // ✅ グループ単位でプレートを表示

        groupDiv.appendChild(allergyInfo);
        groupDiv.appendChild(memoInfo);
        groupDiv.appendChild(plateInfo);

        if (allergyText !== 'なし') {
            groupDiv.style.border = '3px solid red';
            groupDiv.style.backgroundColor = '#ffcccc';
        }

        const assignCourseButton = document.createElement('button');
        assignCourseButton.textContent = 'コースを割り当て';
        assignCourseButton.onclick = () => openSeatSettingsModal(group);
        groupDiv.appendChild(assignCourseButton);

        const resetButton = document.createElement('button');
        resetButton.textContent = '削除';
        resetButton.onclick = () => resetGroup(group);
        groupDiv.appendChild(resetButton);

        groupAssignments.appendChild(groupDiv);
    }

    updateSeatStyles(); // ✅ 修正：座席のスタイルを更新
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


function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 5000); // 5秒後に通知を消す
}