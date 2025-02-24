const socket = io();

// ページ読み込み時にグループ情報を取得
document.addEventListener("DOMContentLoaded", async () => {
    fetchGroupList();
});


async function fetchGroupList() {
    const groupListContainer = document.getElementById("groupList");

    try {
        const response = await fetch("/groups");
        const groupAssignments = await response.json();
        console.log("取得したグループデータ:", groupAssignments);

        groupListContainer.innerHTML = '';

        if (Object.keys(groupAssignments).length === 0) {
            groupListContainer.innerHTML = "<p>登録されているグループはありません。</p>";
            return;
        }

        Object.entries(groupAssignments).forEach(([group, data]) => {
            const groupDiv = document.createElement("div");
            groupDiv.className = "group-item";

            const allergies = data.groupAllergy || "なし";
            const memo = data.groupMemo || "なし";
            const numPeople = data.seats ? data.seats.length : "不明";
            const seatsText = data.seats ? data.seats.join(', ') : "なし"; // ✅ グループの席を表示
            const plateOption = data.groupPlate || "なし"; // ✅ グループのプレート情報

            let groupHTML = `
                <div class="group-header" style="color: ${data.seatCourses && Object.values(data.seatCourses).includes('OSAKA') ? 'red' : 'black'}">
                    <strong>席:</strong> ${seatsText}  <!-- ✅ テーブル名ではなく席を表示 -->
                </div>
                <div class="group-info"><strong>人数:</strong> ${numPeople} 人</div>
            `;

            const courseCounts = { OMAKASE: 0, WAGYU: 0, OSAKA: 0, KIDS: 0 };
            if (data.seatCourses) {
                Object.values(data.seatCourses).forEach(course => {
                    if (courseCounts.hasOwnProperty(course)) {
                        courseCounts[course]++;
                    }
                });
            }

            groupHTML += `<div class="course-counts">`;
            Object.entries(courseCounts).forEach(([course, count]) => {
                if (count > 0) {
                    let color = 'black';
                    if (course === 'OSAKA') color = 'red';
                    if (course === 'OMAKASE') color = 'blue';
                    groupHTML += `<span class="course-count" style="color: ${color}">${course}: ${count}人</span>`;
                }
            });
            groupHTML += `</div>`;
            groupHTML += `<div class="group-info"><strong>アレルギー:</strong> ${allergies}</div>`;

            groupDiv.innerHTML = groupHTML;

            let dishList = [];
            let hasOsaka = courseCounts.OSAKA > 0;
            let hasWagyu = courseCounts.WAGYU > 0;
            let hasOmakase = courseCounts.OMAKASE > 0;

            if (hasOsaka && hasWagyu && hasOmakase) {
                dishList = ['ペアリング', '前菜', 'しょうゆ', '寿司', 'とんかつ', 'ステーキ', 'すきやき', '出汁', '鰻', 'ラーメン', 'デザート'];
            } else if (hasOsaka && hasWagyu) {
                dishList = ['前菜', 'しょうゆ', '寿司', 'とんかつ', 'ステーキ', 'すきやき', '出汁', '鰻', 'ラーメン', 'デザート'];
            } else if (hasOmakase && hasWagyu) {
                dishList = ['ペアリング', '前菜', 'しょうゆ', '寿司', 'とんかつ', 'ステーキ', 'すきやき', '出汁', '鰻', 'デザート'];
            } else if (hasOmakase && hasOsaka) {
                dishList = ['ペアリング', '前菜', 'しょうゆ', '寿司', 'とんかつ', 'ステーキ', 'すきやき', '出汁', '鰻', 'ラーメン', 'デザート'];
            } else if (hasOsaka) {
                dishList = ['前菜', 'しょうゆ', '寿司', 'とんかつ', 'すきやき', '出汁', '鰻', 'ラーメン', 'デザート'];
            } else if (hasWagyu) {
                dishList = ['前菜', 'しょうゆ', '寿司', 'とんかつ', 'ステーキ', 'すきやき', '出汁', '鰻', 'デザート'];
            } else if (hasOmakase) {
                dishList = ['ペアリング', '前菜', 'しょうゆ', '寿司', 'とんかつ', 'ステーキ', 'すきやき', '出汁', '鰻', 'デザート'];
            }

            if (plateOption === "あり") {
                const dessertIndex = dishList.indexOf("デザート");
                if (dessertIndex !== -1) {
                    dishList.splice(dessertIndex, 0, "プレート");
                }
            }

            const dishUl = document.createElement('ul');
            dishUl.className = "dish-list";

            dishList.forEach((dish, index) => {
                const dishItem = document.createElement('li');
                dishItem.textContent = `${index + 1}. ${dish}`;

                if (dish === 'ラーメン' || dish === 'OSAKA') {
                    dishItem.style.color = 'red';
                } else if (dish === 'ペアリング' || dish === 'OMAKASE') {
                    dishItem.style.color = 'blue';
                } else if (dish === 'プレート') {
                    dishItem.style.color = 'green'; // ✅ プレートを緑色に設定
                }

                const completeButton = createCompleteButton(dishItem, group, dish);
                dishItem.appendChild(completeButton);

                const completedDishes = data.completed || [];
                if (completedDishes.some(d => d.dish === dish)) {
                    dishItem.classList.add("completed");
                    completeButton.textContent = "完了済み";
                    completeButton.style.backgroundColor = "#ddd";
                    completeButton.disabled = true;
                }

                dishUl.appendChild(dishItem);
            });

            groupDiv.appendChild(dishUl);

            const memoSection = document.createElement("div");
            memoSection.className = "memo-section";
            memoSection.innerHTML = `<strong>メモ:</strong> ${memo}`;
            groupDiv.appendChild(memoSection);

            groupListContainer.appendChild(groupDiv);
        });
    } catch (error) {
        console.error("グループデータの取得に失敗しました", error);
        groupListContainer.innerHTML = "<p>データの取得に失敗しました。</p>";
    }
}



function createCompleteButton(dishElement, group, dish) {
    console.log(`✔️ 完了ボタン作成: グループ ${group}, 料理 ${dish}`);

    const completeButton = document.createElement('button');
    completeButton.className = "complete-button";
    completeButton.textContent = '完了';

    completeButton.onclick = () => markAsComplete(dishElement, completeButton, group, dish);
    return completeButton;
}


function markAsComplete(dishElement, button, group, dish) {
    console.log(`🔵 料理完了リクエスト送信: グループ ${group}, 料理 ${dish}`);

    dishElement.classList.add("completed");
    button.textContent = "完了済み";
    button.style.backgroundColor = "#ddd";
    button.disabled = true;

    const userType = localStorage.getItem('userType') || 'A';

    socket.emit('mark dish as complete', { group, dish, userType });

    setTimeout(fetchGroupList, 500);
}


// **サーバーから更新を受け取る**
socket.on('update group assignments', () => {
    fetchGroupList();
});
