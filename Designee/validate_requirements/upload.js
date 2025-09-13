// upload.js
document.addEventListener("DOMContentLoaded", () => {
    console.log("upload.js loaded");

    const uploadBtn = document.getElementById("uploadBtn");
    const uploadInput = document.getElementById("uploadInput");
    const studentsTableBody = document.getElementById("studentsTableBody");
    const usernameDisplay = document.getElementById("usernameDisplay");

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
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // Get userData
    let userData = {};
    try {
        const userDataString = localStorage.getItem("userData");
        if (userDataString) userData = JSON.parse(userDataString);
    } catch (err) {
        console.error("Failed to parse userData:", err);
    }

    const office = userData.office || null;
    const category = userData.category || null; // 🔑 used as Membership doc ID
    const department = userData.department || null;

    // Hide upload button for restricted offices
    const restrictedOffices = ["302","303","304","305","306","307","308","309", "315"];
    const officeFromStorage = (office || "").toString().trim();
    const categoryFromStorage = (category || "").toString().trim();

    if (restrictedOffices.includes(officeFromStorage) || categoryFromStorage === "401") {
        uploadBtn.style.display = "none";
        uploadInput.style.display = "none";
        console.log(`Upload button hidden for office ${officeFromStorage} or category ${categoryFromStorage}`);
    } else {
        console.log(`Upload button visible for office ${officeFromStorage} and category ${categoryFromStorage}`);
    }

    // Resolve collection name (for display/logging)
    async function resolveCollectionName() {
        try {
            if (category) {
                const acadSnap = await db.collection("acadClubTable").doc(category).get();
                if (acadSnap.exists) return acadSnap.data().codeName || category;

                const groupSnap = await db.collection("groupTable").doc(category).get();
                if (groupSnap.exists) return groupSnap.data().club || category;

                const labSnap = await db.collection("labTable").doc(category).get();
                if (labSnap.exists) return labSnap.data().lab || category;

                return category;
            } else if (department) {
                const deptSnap = await db.collection("departmentTable").doc(department).get();
                if (deptSnap.exists) return deptSnap.data().department || department;
                return department;
            } else if (office) {
                const officeSnap = await db.collection("officeTable").doc(office).get();
                if (officeSnap.exists) return officeSnap.data().office || office;
                return office;
            } else {
                return "Students"; // fallback
            }
        } catch (err) {
            console.error("Error resolving collection:", err);
            return "Students";
        }
    }

    // ✅ Get the current semester string
    async function getCurrentSemester() {
        try {
            const snapshot = await db.collection("semesterTable")
                .where("currentSemester", "==", true)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                return snapshot.docs[0].data().semester || null;
            } else {
                console.warn("⚠️ No active semester found in semesterTable");
                return null;
            }
        } catch (err) {
            console.error("Error fetching current semester:", err);
            return null;
        }
    }

    // Open file dialog
    uploadBtn.addEventListener("click", () => uploadInput.click());

    // Handle file upload
    uploadInput.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const collectionName = await resolveCollectionName();
            console.log("📂 Using Membership collection for:", collectionName);

            const currentSemester = await getCurrentSemester();
            if (!currentSemester) {
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

                // ✅ Only extract studentId (first column)
                const studentIds = rows.slice(1)
                    .map(row => row[0] ? row[0].toString().trim() : null)
                    .filter(id => id);

                if (!category) {
                    alert("No category found in user data. Cannot upload.");
                    return;
                }

                // 🔑 Membership structure
                const membershipDocRef = db.collection("Membership").doc(category);

                // Ensure membership document exists (only a placeholder doc, no extra fields in students)
               const membershipDoc = await membershipDocRef.get();
if (!membershipDoc.exists) {
    await membershipDocRef.set({
        id: category   // ✅ store the category itself as the field
    });
    console.log(`✅ Created Membership document for category ID "${category}"`);
}


                // Upload students (only studentId field)
                const subCollectionRef = membershipDocRef.collection("Members");
                for (const studentId of studentIds) {
                    await subCollectionRef.doc(studentId).set({
                        studentId: studentId
                    });
                }

                console.log(`✅ Uploaded ${studentIds.length} student IDs under Membership/${category}/Members`);
                alert(`Uploaded ${studentIds.length} students successfully for ${currentSemester}!`);
                uploadInput.value = ""; // reset
            };
            reader.readAsArrayBuffer(file);
        } catch (err) {
            console.error("❌ Upload failed:", err);
            alert("Upload failed. Check console.");
        }
    });

    // Load students should now read from:
    // Membership/{category}/students
});
