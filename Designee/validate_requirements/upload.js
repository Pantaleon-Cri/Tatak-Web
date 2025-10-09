document.addEventListener("DOMContentLoaded", () => {
    console.log("upload.js loaded");

    const uploadBtn = document.getElementById("uploadBtn");
    const uploadInput = document.getElementById("uploadInput");
    const studentsTableBody = document.getElementById("studentsTableBody");
    const usernameDisplay = document.getElementById("usernameDisplay");
    const downloadBtn = document.getElementById("downloadBtn"); // Download Template button
    const editMembersBtn = document.getElementById("UserEditBtn"); // Edit Members button
    const membersContainer = document.getElementById("membersContainer"); // Popup container

    if (!uploadBtn || !uploadInput || !studentsTableBody) {
        console.error("Upload button, input, or table body not found in DOM");
        return;
    }

    // -------------------- Firebase Initialization --------------------
    const firebaseConfig = {
        apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
        authDomain: "tatak-mobile-web.firebaseapp.com",
        projectId: "tatak-mobile-web",
        storageBucket: "tatak-mobile-web.appspot.com",
        messagingSenderId: "771908675869",
        appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
        measurementId: "G-CENPP29LKQ"
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // -------------------- Get user data --------------------
    let userData = {};
    try {
        const userDataString = localStorage.getItem("userData");
        if (userDataString) userData = JSON.parse(userDataString);
    } catch (err) {
        console.error("Failed to parse userData:", err);
    }

    const office = userData.office || null;
    const category = userData.category || null;
    const department = userData.department || null;
    const designeeId = userData.id || null; // designee ID

    // -------------------- Hide buttons for restricted offices --------------------
    const restrictedOffices = ["1","2","3","4","5","6","7","9","10","11","12"];
    const officeFromStorage = (office || "").toString().trim();
    const categoryFromStorage = (category || "").toString().trim();

    if (restrictedOffices.includes(officeFromStorage) || categoryFromStorage === "39") {
        uploadBtn.style.display = "none";
        uploadInput.style.display = "none";
        if (downloadBtn) downloadBtn.style.display = "none";
        if (editMembersBtn) editMembersBtn.style.display = "none";
        console.log(`Buttons hidden for office ${officeFromStorage} or category ${categoryFromStorage}`);
    } else {
        console.log(`Buttons visible for office ${officeFromStorage} and category ${categoryFromStorage}`);
    }

    // -------------------- Download Template --------------------
    if (downloadBtn) {
        downloadBtn.addEventListener("click", () => {
            try {
                const ws = XLSX.utils.aoa_to_sheet([["ID No."]]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Template");
                XLSX.writeFile(wb, "Student_Template.xlsx");
                console.log("📥 Template downloaded successfully");
            } catch (err) {
                console.error("Error generating template:", err);
                alert("Failed to download template.");
            }
        });
    }

    // -------------------- File Upload --------------------
    uploadBtn.addEventListener("click", () => uploadInput.click());

    uploadInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const currentSemesterId = await getCurrentSemesterId();
            if (!currentSemesterId) {
                alert("No active semester found. Please contact admin.");
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (!rows || rows.length < 2) return;

                const studentIds = rows.slice(1)
                    .map(row => row[0] ? row[0].toString().trim() : null)
                    .filter(id => id);

                const membershipDocRef = db.collection("Membership").doc(category);
                const membershipDoc = await membershipDocRef.get();
                if (!membershipDoc.exists) {
                    await membershipDocRef.set({ id: category });
                    console.log(`✅ Created Membership document for category ID "${category}"`);
                }

                const subCollectionRef = membershipDocRef.collection("Members");
                for (const studentId of studentIds) {
                    await subCollectionRef.doc(studentId).set({
                        studentId,
                        semester: currentSemesterId
                    });
                }

                console.log(`✅ Uploaded ${studentIds.length} student IDs`);
                alert(`Uploaded ${studentIds.length} students successfully for the current semester!`);
                uploadInput.value = "";
            };
            reader.readAsArrayBuffer(file);
        } catch (err) {
            console.error("❌ Upload failed:", err);
            alert("Upload failed. Check console.");
        }
    });

    // -------------------- EDIT MEMBERS POPUP --------------------
    if (editMembersBtn && membersContainer) {
        editMembersBtn.addEventListener("click", async () => {
            membersContainer.innerHTML = `
                <div class="members-popup">
                    <div class="members-popup-header">
                        <h2>Members List</h2>
                        <button class="close-members-btn">×</button>
                    </div>
                    <div class="members-list">
                        <p>Loading members...</p>
                    </div>
                </div>
            `;
            membersContainer.classList.add("active");

            const closeBtn = membersContainer.querySelector(".close-members-btn");
            closeBtn.addEventListener("click", () => membersContainer.classList.remove("active"));

            try {
                const membersList = membersContainer.querySelector(".members-list");
                const membersSnapshot = await db.collection("Membership")
                    .doc(category)
                    .collection("Members")
                    .get();

                if (membersSnapshot.empty) {
                    membersList.innerHTML = "<p>No members found.</p>";
                    return;
                }

                membersList.innerHTML = "";

                membersSnapshot.forEach(doc => {
                    const member = doc.data();
                    const card = document.createElement("div");
                    card.className = "member-card";
                    card.innerHTML = `
                        <p><strong>ID:</strong> ${member.studentId}</p>
                        <button class="delete-member-btn" data-id="${member.studentId}">Delete</button>
                    `;
                    membersList.appendChild(card);
                });

                // -------------------- Attach delete buttons --------------------
                membersList.querySelectorAll(".delete-member-btn").forEach(btn => {
                    btn.addEventListener("click", async (e) => {
                        const studentId = e.target.dataset.id;
                        if (!confirm(`Are you sure you want to delete member ${studentId}?`)) return;

                        try {
                            // Delete from Membership
                            await db.collection("Membership")
                                .doc(category)
                                .collection("Members")
                                .doc(studentId)
                                .delete();
                            console.log(`Deleted member ${studentId} from Membership`);

                            // Delete from Validation (if designeeId exists)
                            if (designeeId) {
                                const validationRef = db.collection("Validation").doc(designeeId).collection(studentId);
                                const validationSnapshot = await validationRef.get();
                                validationSnapshot.forEach(doc => doc.ref.delete());
                                console.log(`Deleted Validation records for student ${studentId}`);
                            }

                            // Remove card from DOM
                            e.target.closest(".member-card").remove();

                        } catch (err) {
                            console.error(`Failed to delete member ${studentId}:`, err);
                            alert("Failed to delete member. Check console.");
                        }
                    });
                });

            } catch (err) {
                console.error("Failed to load members:", err);
                membersContainer.querySelector(".members-list").innerHTML = "<p>Error loading members.</p>";
            }
        });
    }

    // -------------------- Helper: Get Current Semester --------------------
    async function getCurrentSemesterId() {
        try {
            const snapshot = await db.collection("DataTable").doc("Semester")
                .collection("SemesterDocs")
                .where("currentSemester", "==", true)
                .limit(1)
                .get();
            if (!snapshot.empty) return snapshot.docs[0].id;
            return null;
        } catch (err) {
            console.error(err);
            return null;
        }
    }
});
