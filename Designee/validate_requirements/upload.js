// upload.js
document.addEventListener("DOMContentLoaded", () => {
    console.log("upload.js loaded");

    const uploadBtn = document.getElementById("uploadBtn");
    const uploadInput = document.getElementById("uploadInput");
    const studentsTableBody = document.getElementById("studentsTableBody");

    if (!uploadBtn || !uploadInput || !studentsTableBody) {
        console.error("Upload button, input, or table body not found in DOM");
        return;
    }

    // Firebase initialization
    const firebaseConfig = {
        apiKey: "AIzaSyDdSSYjX1DHKskbjDOnnqq18yXwLpD3IpQ",
        authDomain: "tatak-mobile-web.firebaseapp.com",
        projectId: "tatak-mobile-web",
        storageBucket: "tatak-mobile-web.appspot.com",
        messagingSenderId: "771908675869",
        appId: "1:771908675869:web:88e68ca51ed7ed4da019f4",
        measurementId: "G-CENPP29LKQ"
    };
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();

    // Get office and category from localStorage
    const userDataString = localStorage.getItem("userData");
    let office = null;
    let category = null;
    let userData = null;

    if (userDataString) {
        try {
            userData = JSON.parse(userDataString);
            office = userData.office || null;
            category = userData.category || null;
        } catch (err) {
            console.error("Failed to parse userData:", err);
        }
    }

    // Offices allowed to use personal collection
    const personalCollectionOffices = ["301","310","311","312","313"];
    const usePersonalCollection = personalCollectionOffices.includes(office) && category !== "401";

    // Show/hide upload button
    uploadBtn.style.display = usePersonalCollection ? "inline-block" : "none";

    // Open file dialog
    uploadBtn.addEventListener("click", () => uploadInput.click());

    // Handle file upload
    uploadInput.addEventListener("change", (event) => {
        if (!usePersonalCollection) return;

        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            // Standardized format: ID No., First Name, Last Name, Department, Year Level
            const studentData = rows.slice(1).map(row => {
                const idNo = row[0] || "";
                const firstName = row[1] || "";
                const lastName = row[2] || "";
                const department = row[3] || "";
                const yearLevel = row[4] || "";

                return {
                    idNo,
                    firstName,
                    lastName,
                    fullName: `${firstName} ${lastName}`.trim(),
                    department,
                    yearLevel
                };
            });

            if (!category) {
                console.error("Category not set for this user.");
                return;
            }

            const collectionRef = db.collection(category);

            studentData.forEach(student => {
                if (student.idNo) {
                    collectionRef.doc(student.idNo.toString())
                        .set(student, { merge: true }) // merge to avoid overwriting
                        .catch(err => console.error("Failed to upload student:", student, err));
                }
            });

            console.log(`Uploaded ${studentData.length} records to collection "${category}"`);
        };
        reader.readAsArrayBuffer(file);
    });

    // Real-time fetch from personal collection
    async function loadStudents() {
        if (!category) {
            studentsTableBody.innerHTML = "<tr><td colspan='6'>No category selected.</td></tr>";
            return;
        }

        const collectionRef = db.collection(category);

        collectionRef.onSnapshot(async snapshot => {
            studentsTableBody.innerHTML = "";

            snapshot.forEach(doc => {
                const student = doc.data();

                const row = `
                    <tr>
                        <td>${student.idNo || doc.id}</td>
                        <td>${student.fullName || `${student.firstName || ""} ${student.lastName || ""}`.trim()}</td>
                        <td>${student.department || ""}</td>
                        <td>${student.yearLevel || ""}</td>
                        <td>
                            <button class="status-button validate-button" data-studentid="${doc.id}">
                                VALIDATE
                            </button>
                        </td>
                        <td>
                            <button class="action-button view-button">VIEW</button>
                        </td>
                    </tr>
                `;
                studentsTableBody.innerHTML += row;
            });

            // Attach validate button handlers
            document.querySelectorAll(".validate-button").forEach(btn => {
                btn.addEventListener("click", (e) => {
                    const studentID = e.target.getAttribute("data-studentid");
                    let designeeUserID = userData?.id || null;

                    if (typeof window.openRequirementsModal === "function") {
                        window.openRequirementsModal(studentID, designeeUserID, db);
                    } else {
                        console.error("openRequirementsModal function not found");
                    }
                });
            });
        });
    }

    // ✅ Load students immediately on page load
    loadStudents();
});
